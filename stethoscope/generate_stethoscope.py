#!/usr/bin/env python3
"""Procedural, game-ready (AAA style) stethoscope -> binary glTF (.glb).

Real-world scale (metres), Y-up, PBR metal/rough materials, bevelled edges,
smooth analytic normals, UVs on every part. Only numpy is required.

    python3 generate_stethoscope.py [output.glb]
"""
import json
import math
import struct
import sys

import numpy as np

SEG = 96  # radial resolution of turned (lathe) parts


# --------------------------------------------------------------- math helpers
def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def basis_from_y(d):
    d = unit(d)
    ref = np.array([0, 1.0, 0]) if abs(d[1]) < 0.9 else np.array([1.0, 0, 0])
    x = unit(np.cross(ref, d))
    z = np.cross(x, d)
    return np.stack([x, d, z], axis=1)  # columns: local X, Y(=d), Z


def orient(P, N, I):
    """Flip triangle winding so geometric normals agree with vertex normals."""
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    fn = np.cross(b - a, c - a)
    vn = N[I[:, 0]] + N[I[:, 1]] + N[I[:, 2]]
    return I[:, [0, 2, 1]] if np.einsum("ij,ij->i", fn, vn).sum() < 0 else I


def place(m, origin, direction):
    """Move a part modelled along +Y so that +Y points along `direction`."""
    R = basis_from_y(direction)
    m["P"] = m["P"] @ R.T + np.asarray(origin, float)
    m["N"] = unit(m["N"] @ R.T)
    return m


def merge(name, mat, parts):
    P, N, UV, I, off = [], [], [], [], 0
    for m in parts:
        P.append(m["P"]); N.append(m["N"]); UV.append(m["UV"]); I.append(m["I"] + off)
        off += len(m["P"])
    return dict(name=name, mat=mat, P=np.vstack(P), N=np.vstack(N),
                UV=np.vstack(UV), I=np.vstack(I))


# ------------------------------------------------------------------- profiles
def fillet(pts, radii, steps=8):
    """Round the corners of a 2D polyline (first/last points are kept)."""
    P = [np.array(p, float) for p in pts]
    out = []
    for i, p1 in enumerate(P):
        rad = radii[i]
        if i in (0, len(P) - 1) or rad <= 0:
            out.append(p1)
            continue
        v0, v1 = P[i - 1] - p1, P[i + 1] - p1
        l0, l1 = np.linalg.norm(v0), np.linalg.norm(v1)
        v0, v1 = v0 / l0, v1 / l1
        ang = math.acos(np.clip(v0 @ v1, -1, 1))
        if ang > math.pi - 1e-3 or ang < 1e-3:
            out.append(p1)
            continue
        d = rad / math.tan(ang / 2)
        dmax = 0.5 * min(l0, l1)
        if d > dmax:
            rad *= dmax / d
            d = dmax
        c = p1 + unit(v0 + v1) * (rad / math.sin(ang / 2))
        t0, t1 = p1 + v0 * d, p1 + v1 * d
        a0 = math.atan2((t0 - c)[1], (t0 - c)[0])
        a1 = math.atan2((t1 - c)[1], (t1 - c)[0])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        for u in np.linspace(0, 1, steps + 1):
            a = a0 + da * u
            out.append(c + rad * np.array([math.cos(a), math.sin(a)]))
    return np.array(out)


def lathe(name, mat, prof, seg=SEG, brk=38.0):
    """Revolve a (radius, axial) profile around +Y. Hard edges are split."""
    p = np.asarray(prof, float)
    keep = [0]
    for i in range(1, len(p)):
        if np.linalg.norm(p[i] - p[keep[-1]]) > 1e-9:
            keep.append(i)
    p = p[keep]
    K = len(p)
    d = p[1:] - p[:-1]
    ln = np.linalg.norm(d, axis=1)
    t = d / ln[:, None]
    sn = np.stack([t[:, 1], -t[:, 0]], 1)  # outward (radial, axial) normals
    vt = np.concatenate([[0], np.cumsum(ln)])
    vt /= vt[-1]
    cosb = math.cos(math.radians(brk))
    rows, ii, oo = [], [0] * K, [0] * K

    def row(i, n):
        rows.append((p[i, 0], p[i, 1], n[0], n[1], vt[i]))
        return len(rows) - 1

    for i in range(K):
        if i == 0:
            ii[i] = oo[i] = row(i, sn[0])
        elif i == K - 1:
            ii[i] = oo[i] = row(i, sn[-1])
        else:
            a, b = sn[i - 1], sn[i]
            if a @ b >= cosb:
                ii[i] = oo[i] = row(i, unit(a + b))
            else:
                ii[i] = row(i, a)
                oo[i] = row(i, b)
    rows = np.array(rows)
    S1 = seg + 1
    th = np.linspace(0, 2 * np.pi, S1)
    c, s = np.cos(th), np.sin(th)
    R_ = len(rows)
    P = np.stack([rows[:, 0, None] * c, np.repeat(rows[:, 1, None], S1, 1),
                  rows[:, 0, None] * s], -1).reshape(-1, 3)
    N = np.stack([rows[:, 2, None] * c, np.repeat(rows[:, 3, None], S1, 1),
                  rows[:, 2, None] * s], -1).reshape(-1, 3)
    UV = np.stack([np.tile(th / (2 * np.pi), (R_, 1)),
                   np.repeat(rows[:, 4, None], S1, 1)], -1).reshape(-1, 2)
    tris, k = [], np.arange(seg)
    for i in range(K - 1):
        a0 = oo[i] * S1 + k
        b0 = ii[i + 1] * S1 + k
        a1, b1 = a0 + 1, b0 + 1
        if p[i, 0] > 1e-9:
            tris.append(np.stack([a0, b0, a1], 1))
        if p[i + 1, 0] > 1e-9:
            tris.append(np.stack([a1, b0, b1], 1))
    I = np.vstack(tris)
    return dict(name=name, mat=mat, P=P, N=N, UV=UV, I=orient(P, N, I))


# --------------------------------------------------------------------- paths
def catmull_rom(P, n_per=40, alpha=0.5):
    P = np.asarray(P, float)
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        t0 = 0.0
        t1 = t0 + np.linalg.norm(p1 - p0) ** alpha
        t2 = t1 + np.linalg.norm(p2 - p1) ** alpha
        t3 = t2 + np.linalg.norm(p3 - p2) ** alpha
        t = np.linspace(t1, t2, n_per, endpoint=False)[:, None]
        A1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        A2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        A3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2
        B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3
        out.append((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2)
    out.append(P[-2][None])
    return np.vstack(out)


class Path:
    """Arc-length parametrised polyline."""

    def __init__(self, C, step=0.0015):
        C = np.asarray(C, float)
        d = np.linalg.norm(np.diff(C, axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(d)])
        self.length = s[-1]
        t = np.linspace(0, self.length, max(2, int(round(self.length / step)) + 1))
        self.C = np.stack([np.interp(t, s, C[:, j]) for j in range(3)], 1)
        self.t = t
        self.step = step

    def at(self, q):
        q = np.atleast_1d(q)
        return np.stack([np.interp(q, self.t, self.C[:, j]) for j in range(3)], 1)

    def tangent(self, q):
        e = 1e-4
        return unit(self.at(q + e) - self.at(q - e))

    def span(self, a, b):
        m = max(2, int(round((b - a) / self.step)) + 1)
        q = np.linspace(a, b, m)
        return self.at(q), q


def ease_keys(s, keys):
    xs = [k[0] for k in keys]
    ys = np.array([k[1] for k in keys], float)
    u = np.interp(s, xs, np.arange(len(xs)))
    i = np.minimum(np.floor(u).astype(int), len(xs) - 2)
    f = u - i
    f = f * f * (3 - 2 * f)
    return ys[i] * (1 - f) + ys[i + 1] * f


def sweep(name, mat, C, R, nseg=40, caps=(False, False)):
    """Tube along polyline C with (optionally varying) radius R."""
    C = np.asarray(C, float)
    n = len(C)
    R = np.full(n, float(R)) if np.isscalar(R) else np.asarray(R, float)
    T = unit(np.gradient(C, axis=0))
    s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    dR = np.gradient(R, s)
    N0 = np.cross(T[0], [0, 1.0, 0])
    if np.linalg.norm(N0) < 1e-6:
        N0 = np.cross(T[0], [1.0, 0, 0])
    Nf = np.zeros_like(C)
    Nf[0] = unit(N0)
    for i in range(1, n):  # parallel-transport frames
        Nf[i] = unit(Nf[i - 1] - (Nf[i - 1] @ T[i]) * T[i])
    Bf = np.cross(T, Nf)
    phi = np.linspace(0, 2 * np.pi, nseg + 1)
    ring = np.cos(phi)[None, :, None] * Nf[:, None, :] + np.sin(phi)[None, :, None] * Bf[:, None, :]
    P = (C[:, None, :] + R[:, None, None] * ring).reshape(-1, 3)
    N = unit(ring - dR[:, None, None] * T[:, None, :]).reshape(-1, 3)
    UV = np.stack([np.tile(phi / (2 * np.pi), (n, 1)),
                   np.repeat((s / (2 * np.pi * R.mean()))[:, None], nseg + 1, 1)], -1).reshape(-1, 2)
    S1 = nseg + 1
    a0 = (np.arange(n - 1)[:, None] * S1 + np.arange(nseg)[None, :]).ravel()
    b0, a1, b1 = a0 + S1, a0 + 1, a0 + S1 + 1
    I = orient(P, N, np.vstack([np.stack([a0, b0, a1], 1), np.stack([a1, b0, b1], 1)]))
    parts = [dict(P=P, N=N, UV=UV, I=I)]
    for end, flag in ((0, caps[0]), (n - 1, caps[1])):
        if not flag:
            continue
        nrm = -T[end] if end == 0 else T[end]
        ringp = P.reshape(n, S1, 3)[end]
        cp = np.vstack([ringp, C[end]])
        cn = np.tile(nrm, (S1 + 1, 1))
        cuv = np.zeros((S1 + 1, 2))
        ci = np.full(S1 - 1, S1)
        ci_I = orient(cp, cn, np.stack([ci, np.arange(S1 - 1), np.arange(1, S1)], 1))
        parts.append(dict(P=cp, N=cn, UV=cuv, I=ci_I))
    return merge(name, mat, parts)


# ------------------------------------------------------------------ materials
MATS = [
    dict(name="Steel_Polished", base=(0.62, 0.63, 0.65), metal=1.0, rough=0.14),
    dict(name="Steel_Brushed", base=(0.50, 0.51, 0.53), metal=1.0, rough=0.36),
    dict(name="Tube_Navy_Gloss", base=(0.006, 0.016, 0.075), metal=0.0, rough=0.38, clearcoat=0.45),
    dict(name="Rubber_Navy_Matte", base=(0.005, 0.012, 0.055), metal=0.0, rough=0.68),
    dict(name="Diaphragm_Epoxy", base=(0.66, 0.68, 0.70), metal=0.0, rough=0.52),
    dict(name="Eartip_Silicone", base=(0.012, 0.012, 0.014), metal=0.0, rough=0.50),
]
M_POL, M_BRU, M_TUBE, M_RUB, M_DIA, M_EAR = range(6)


# ---------------------------------------------------------------------- model
def build():
    meshes = []
    Y_H = 0.0150  # height of the stem axis above the table

    # ---- chestpiece (axis Y, bell side down, diaphragm side up) -------------
    br = np.linspace(0, 0.0148, 16)
    bowl = np.stack([br, 0.0008 + 0.0064 * (1 - (br / 0.0148) ** 2)], 1)
    corners = [(0.0148, 0.0008, 0), (0.0151, 0.0000, 0.0003), (0.0166, 0.0000, 0.0012),
               (0.0166, 0.0072, 0.0015), (0.0128, 0.0108, 0.0030), (0.0120, 0.0195, 0.0030),
               (0.0178, 0.0226, 0.0020), (0.0202, 0.0232, 0.0004), (0.0202, 0.0262, 0.0003),
               (0.0, 0.0262, 0)]
    body = np.vstack([bowl[:-1], fillet([c[:2] for c in corners], [c[2] for c in corners])])
    meshes.append(lathe("Chestpiece_Body", M_POL, body))

    rim = fillet([(0.0222, 0.0218), (0.0246, 0.0218), (0.0246, 0.0302), (0.0200, 0.0302),
                  (0.0200, 0.0218), (0.0222, 0.0218)],
                 [0, 0.0012, 0.0020, 0.0008, 0.0006, 0])
    meshes.append(lathe("Chestpiece_RimRing", M_RUB, rim))

    ring = fillet([(0.0190, 0.0272), (0.0200, 0.0272), (0.0200, 0.0292), (0.0180, 0.0292),
                   (0.0180, 0.0272), (0.0190, 0.0272)], [0, 0, 0.0003, 0.0004, 0.0001, 0])
    meshes.append(lathe("Chestpiece_RetainingRing", M_POL, ring))

    dr = np.linspace(0.018, 0, 12)
    dome = np.stack([dr, 0.0284 + 0.0003 * (1 - (dr / 0.018) ** 2)], 1)
    meshes.append(lathe("Diaphragm", M_DIA,
                        np.vstack([[(0, 0.0262), (0.0200, 0.0262), (0.0200, 0.0284)], dome])))

    # ---- stem: selector collar, neck, strain relief --------------------------
    st = [(0, 0.0090), (0.0075, 0.0090), (0.0087, 0.0105)]
    for g in (0.0122, 0.0138, 0.0154):
        st += [(0.0087, g - 0.0007), (0.0083, g - 0.0004), (0.0083, g + 0.0004), (0.0087, g + 0.0007)]
    st += [(0.0087, 0.0172), (0.0066, 0.0180), (0.0066, 0.0300), (0, 0.0300)]
    meshes.append(place(lathe("Stem_Collar", M_BRU, st, seg=64), (0, Y_H, 0), (1, 0, 0)))

    ss = np.linspace(0.0318, 0.0580, 24)
    f = (ss - ss[0]) / (ss[-1] - ss[0])
    f = f * f * (3 - 2 * f)
    relief = [(0.0066, 0.0272), (0.0074, 0.0272), (0.0074, 0.0318)] + \
             [(0.0055 + 0.0019 * (1 - u), s_) for u, s_ in zip(f, ss)][1:]
    meshes.append(place(lathe("Stem_StrainRelief", M_RUB, relief, seg=64), (0, Y_H, 0), (1, 0, 0)))

    # ---- main tube: chestpiece -> Y splitter ---------------------------------
    raw = np.array([(0, 0), (0.064, 0), (0.134, -0.050), (0.184, -0.130), (0.264, -0.190),
                    (0.354, -0.170), (0.394, -0.100), (0.414, -0.020), (0.464, 0.050),
                    (0.534, 0.085), (0.604, 0.080)])
    pr = catmull_rom(np.stack([raw[:, 0], np.zeros(len(raw)), raw[:, 1]], 1), 40)
    raw_len = np.linalg.norm(np.diff(pr, axis=0), axis=1).sum()
    k = 0.50 / raw_len  # real main-tube length: 50 cm
    xz = pr[:, [0, 2]] * k + np.array([0.058, 0.0])
    L0 = np.linalg.norm(np.diff(xz, axis=0), axis=1).sum()
    p3 = Path(np.stack([xz[:, 0], np.zeros(len(xz)), xz[:, 1]], 1))
    T_end = p3.tangent(p3.length - 0.002)
    tail = p3.C[-1] + T_end * np.linspace(0.002, 0.034, 17)[:, None]
    p3 = Path(np.vstack([p3.C, tail]))
    L = L0
    ys = ease_keys(p3.t, [(0, Y_H), (0.015, Y_H), (0.10, 0.0055), (L - 0.05, 0.0055), (L + 0.02, 0.0085)])
    p3.C[:, 1] = ys
    p3 = Path(p3.C)

    C, q = p3.span(0.0, L + 0.012)
    meshes.append(sweep("Tube_Main", M_TUBE, C, 0.0055, nseg=48))
    Cf, qf = p3.span(L - 0.016, L + 0.010)
    rf = np.interp(qf, [L - 0.016, L - 0.0145, L + 0.008, L + 0.010], [0.0058, 0.0066, 0.0066, 0.0058])
    meshes.append(sweep("Tube_Main_Ferrule", M_BRU, Cf, rf, nseg=48, caps=(False, True)))

    # ---- Y splitter -----------------------------------------------------------
    Hc = p3.at(L + 0.020)[0]
    Td = p3.tangent(L + 0.020)[0]
    hub = fillet([(0, -0.011), (0.0086, -0.011), (0.0086, 0.009), (0, 0.009)], [0, 0.0045, 0.0045, 0])
    meshes.append(place(lathe("Y_Splitter", M_BRU, hub, seg=64), Hc, Td))

    # ---- binaural arms ---------------------------------------------------------
    arm_raw = np.array([(0, 0), (0.030, 0.008), (0.070, 0.024), (0.110, 0.040),
                        (0.145, 0.048), (0.172, 0.040), (0.190, 0.026)]) * 0.85
    F = unit(np.array([Td[0], 0, Td[2]]))
    Lv = np.array([F[2], 0, -F[0]])
    for tag, sgn in (("L", 1), ("R", -1)):
        pts = np.array([Hc + F * f_ + Lv * (sgn * l_) for f_, l_ in arm_raw])
        arm = Path(catmull_rom(pts, 40), step=0.0008)
        La = arm.length
        sc = 0.080
        # arms rest on the table, then the ear tubes rise slightly (spring tension)
        arm.C[:, 1] = ease_keys(arm.t, [(0, Hc[1]), (0.05, 0.0050), (sc + 0.01, 0.0050),
                                        (La - 0.015, 0.0092), (La, 0.0092)])
        arm = Path(arm.C, step=0.0008)
        La = arm.length

        Cf, qf = arm.span(0.0, 0.0205)  # splitter ferrule
        rf = np.interp(qf, [0, 0.018, 0.0205], [0.0052, 0.0052, 0.0045])
        meshes.append(sweep(f"Binaural_{tag}_Ferrule", M_BRU, Cf, rf, nseg=32))
        Cr, _ = arm.span(0.010, sc + 0.004)  # flexible tube
        meshes.append(sweep(f"Binaural_{tag}_Tube", M_TUBE, Cr, 0.0041, nseg=32))
        Cc, qc = arm.span(sc - 0.007, sc + 0.007)  # transition collar
        rc = np.interp(qc - sc, [-0.007, -0.0055, 0.0055, 0.007], [0.0043, 0.0050, 0.0050, 0.0043])
        meshes.append(sweep(f"Binaural_{tag}_Collar", M_BRU, Cc, rc, nseg=32))
        Cm, qm = arm.span(sc + 0.004, La - 0.002)  # steel ear tube
        rm = np.interp(qm, [sc + 0.004, La - 0.04, La - 0.002], [0.0031, 0.0031, 0.0027])
        meshes.append(sweep(f"Binaural_{tag}_Steel", M_POL, Cm, rm, nseg=32, caps=(False, True)))

        tip = fillet([(0.0040, -0.0060), (0.0042, 0.0010), (0.0058, 0.0035), (0.0088, 0.0070),
                      (0.0090, 0.0095), (0.0072, 0.0122), (0.0022, 0.0124), (0.0020, 0.0110),
                      (0.0020, -0.0060)], [0, 0.0010, 0.0012, 0.0020, 0.0020, 0.0012, 0.0004, 0.0004, 0],
                     steps=6)
        meshes.append(place(lathe(f"EarTip_{tag}", M_EAR, tip, seg=48),
                            arm.at(La)[0], arm.tangent(La - 0.001)[0]))
    return meshes


# ----------------------------------------------------------------- GLB writer
def write_glb(path, meshes):
    chunks, views, accs, gmeshes, nodes = [], [], [], [], []
    off = 0

    def view(arr, target):
        nonlocal off
        raw = arr.tobytes()
        pad = (-len(raw)) % 4
        views.append(dict(buffer=0, byteOffset=off, byteLength=len(raw), target=target))
        chunks.append(raw + b"\0" * pad)
        off += len(raw) + pad
        return len(views) - 1

    for m in meshes:
        P = m["P"].astype("<f4"); N = m["N"].astype("<f4")
        UV = m["UV"].astype("<f4"); I = m["I"].astype("<u4").reshape(-1)
        vp, vn, vt, vi = view(P, 34962), view(N, 34962), view(UV, 34962), view(I, 34963)
        a = len(accs)
        accs += [dict(bufferView=vp, componentType=5126, count=len(P), type="VEC3",
                      min=P.min(0).tolist(), max=P.max(0).tolist()),
                 dict(bufferView=vn, componentType=5126, count=len(N), type="VEC3"),
                 dict(bufferView=vt, componentType=5126, count=len(UV), type="VEC2"),
                 dict(bufferView=vi, componentType=5125, count=len(I), type="SCALAR")]
        gmeshes.append(dict(name=m["name"], primitives=[dict(
            attributes=dict(POSITION=a, NORMAL=a + 1, TEXCOORD_0=a + 2), indices=a + 3,
            material=m["mat"], mode=4)]))
        nodes.append(dict(name=m["name"], mesh=len(gmeshes) - 1))
    nodes.append(dict(name="Stethoscope", children=list(range(len(nodes)))))

    mats = []
    for m in MATS:
        j = dict(name=m["name"], pbrMetallicRoughness=dict(
            baseColorFactor=[*m["base"], 1.0], metallicFactor=m["metal"], roughnessFactor=m["rough"]))
        if "clearcoat" in m:
            j["extensions"] = {"KHR_materials_clearcoat": dict(
                clearcoatFactor=m["clearcoat"], clearcoatRoughnessFactor=0.10)}
        mats.append(j)

    doc = dict(asset=dict(version="2.0", generator="procedural stethoscope generator",
                          extras=dict(units="metres", up="Y")),
               extensionsUsed=["KHR_materials_clearcoat"], scene=0,
               scenes=[dict(name="Scene", nodes=[len(nodes) - 1])], nodes=nodes,
               meshes=gmeshes, materials=mats, accessors=accs, bufferViews=views,
               buffers=[dict(byteLength=off)])
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    bn = b"".join(chunks)
    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bn), 0x004E4942) + bn)
    return total


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Stethoscope_AAA.glb"
    ms = build()
    size = write_glb(out, ms)
    allP = np.vstack([m["P"] for m in ms])
    bad = sum(int(not np.isfinite(m["P"]).all() or not np.isfinite(m["N"]).all()) for m in ms)
    tris = sum(len(m["I"]) for m in ms)
    print(f"{out}: {size/1e6:.2f} MB, {len(ms)} meshes, {tris:,} triangles, non-finite meshes: {bad}")
    print("bbox min", np.round(allP.min(0), 4), "max", np.round(allP.max(0), 4))
    for m in ms:
        print(f"  {m['name']:<28}{len(m['P']):>7} verts {len(m['I']):>7} tris")
