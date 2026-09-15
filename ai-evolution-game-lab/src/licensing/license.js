/**
 * Asset & code licensing registry (spec 11, 53).
 *
 * Rule of the lab: anything whose licence we cannot read is recorded as
 * LICENSE_UNKNOWN and is never marked commercially usable. We detect, we never
 * assume, and we surface attribution requirements.
 */

export const LICENSE_UNKNOWN = 'LICENSE_UNKNOWN';

const SPDX_PATTERNS = [
  [/\bMIT\b/i, 'MIT'],
  [/Apache License,? Version 2\.0|Apache-2\.0/i, 'Apache-2.0'],
  [/GNU GENERAL PUBLIC LICENSE\s*Version 3|GPL-3\.0/i, 'GPL-3.0'],
  [/GNU GENERAL PUBLIC LICENSE\s*Version 2|GPL-2\.0/i, 'GPL-2.0'],
  [/GNU LESSER GENERAL PUBLIC|LGPL/i, 'LGPL'],
  [/Mozilla Public License|MPL-2\.0/i, 'MPL-2.0'],
  [/BSD 3-Clause|BSD-3-Clause/i, 'BSD-3-Clause'],
  [/BSD 2-Clause|BSD-2-Clause/i, 'BSD-2-Clause'],
  [/\bISC\b/i, 'ISC'],
  [/Creative Commons Zero|CC0[- ]1\.0|public domain/i, 'CC0-1.0'],
  [/CC[- ]BY[- ]SA/i, 'CC-BY-SA-4.0'],
  [/CC[- ]BY[- ]NC/i, 'CC-BY-NC-4.0'],
  [/CC[- ]BY\b/i, 'CC-BY-4.0'],
  [/The Unlicense|unlicense\.org/i, 'Unlicense'],
  [/Zlib License|zlib\/libpng/i, 'Zlib'],
  [/All rights reserved/i, 'PROPRIETARY'],
];

/** Licences under which generated projects may redistribute an asset as-is. */
const REDISTRIBUTABLE = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'CC0-1.0', 'Unlicense', 'Zlib', 'MPL-2.0']);
const ATTRIBUTION_REQUIRED = new Set(['Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'MIT', 'Zlib']);
const NONCOMMERCIAL = new Set(['CC-BY-NC-4.0']);
const COPYLEFT = new Set(['GPL-3.0', 'GPL-2.0', 'LGPL', 'CC-BY-SA-4.0']);

export function detectLicenseText(text = '') {
  const head = text.slice(0, 8000);
  for (const [re, id] of SPDX_PATTERNS) if (re.test(head)) return id;
  return null;
}

export function detectLicenseFromFiles(files) {
  // files: [{rel, text?}]
  const licFile = files.find((f) => /^(license|licence|copying|notice)(\.(txt|md))?$/i.test(f.rel.split('/').pop() || ''));
  if (licFile?.text) {
    const id = detectLicenseText(licFile.text);
    if (id) return { license: id, source: licFile.rel, method: 'license-file' };
  }
  const pkg = files.find((f) => /(^|\/)package\.json$/i.test(f.rel));
  if (pkg?.text) {
    try {
      const j = JSON.parse(pkg.text);
      if (typeof j.license === 'string' && j.license.trim()) return { license: j.license.trim(), source: pkg.rel, method: 'package.json' };
    } catch { /* malformed package.json */ }
  }
  for (const f of files.slice(0, 200)) {
    if (!f.text) continue;
    const m = f.text.slice(0, 1200).match(/SPDX-License-Identifier:\s*([A-Za-z0-9.\-+]+)/);
    if (m) return { license: m[1], source: f.rel, method: 'spdx-header' };
  }
  return { license: LICENSE_UNKNOWN, source: null, method: 'not-found' };
}

export function licenseProfile(license) {
  const id = license || LICENSE_UNKNOWN;
  const known = id !== LICENSE_UNKNOWN && id !== 'PROPRIETARY';
  return {
    license: id,
    known,
    redistributable: REDISTRIBUTABLE.has(id),
    attributionRequired: ATTRIBUTION_REQUIRED.has(id),
    nonCommercial: NONCOMMERCIAL.has(id),
    copyleft: COPYLEFT.has(id),
    // The lab never auto-approves commercial use; unknown stays unknown.
    commercialUse: known ? (NONCOMMERCIAL.has(id) ? 'not-allowed' : COPYLEFT.has(id) ? 'allowed-with-copyleft-obligations' : REDISTRIBUTABLE.has(id) ? 'allowed' : 'check-terms') : 'unknown-do-not-assume',
    warning: known ? null : 'Licence could not be determined from the files. Treat as all-rights-reserved until you confirm it yourself.',
  };
}

/** Assets the user owns still need a record; ownership is declared, not inferred. */
export function assetRecord({ name, source, license, ownedByUser = false, notes = '' }) {
  const profile = licenseProfile(license);
  return {
    name,
    source,
    ...profile,
    ownedByUser,
    usableInGenerated: ownedByUser || profile.redistributable,
    notes,
  };
}
