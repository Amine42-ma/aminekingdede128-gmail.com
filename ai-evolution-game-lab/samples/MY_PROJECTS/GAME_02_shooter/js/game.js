const { Pool, SpatialHash, StateMachine, lerp, aabb, FIXED_STEP } = window.Engine;
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const audio = new (window.AudioContext || window.webkitAudioContext)();
const hash = new SpatialHash(64);
const bullets = new Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 2, alive: false }), 200);
const enemies = [];
const camera = { x: 0, y: 0, shake: 0 };
const state = new StateMachine('menu');
let acc = 0, lastTime = 0;
const settings = { speed: 180, friction: 0.92, spawnRate: 1.4, damage: 10, health: 100 };
const player = { x: 0, y: 0, vx: 0, vy: 0, r: 10, hp: settings.health, angle: 0 };
const input = { keys: {}, pointer: { x: 0, y: 0, down: false } };

addEventListener('keydown', e => input.keys[e.code] = true);
addEventListener('keyup', e => input.keys[e.code] = false);
addEventListener('pointermove', e => { input.pointer.x = e.clientX; input.pointer.y = e.clientY; });
addEventListener('pointerdown', () => { input.pointer.down = true; });
addEventListener('visibilitychange', () => { if (document.hidden) state.set('paused'); });

function playTone(freq) {
  const osc = audio.createOscillator(); const gain = audio.createGain();
  osc.frequency.value = freq; osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + 0.08);
}
function spawnEnemy() {
  const a = Math.random() * Math.PI * 2;
  enemies.push({ x: Math.cos(a) * 400, y: Math.sin(a) * 400, r: 12, hp: 30, speed: 60 });
}
function chasePlayer(e, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * e.speed * dt;
  e.y += (dy / d) * e.speed * dt;
}
function updatePhysics(dt) {
  player.vx *= settings.friction; player.vy *= settings.friction;
  if (input.keys.KeyA) player.vx -= settings.speed * dt;
  if (input.keys.KeyD) player.vx += settings.speed * dt;
  if (input.keys.KeyW) player.vy -= settings.speed * dt;
  if (input.keys.KeyS) player.vy += settings.speed * dt;
  player.x += player.vx * dt; player.y += player.vy * dt;
}
function checkCollisions() {
  hash.clear();
  for (const e of enemies) hash.insert(e);
  for (const e of hash.near(player)) if (aabb(player, e)) { player.hp -= settings.damage; playTone(120); }
}
function updateCamera(dt) {
  camera.x = lerp(camera.x, player.x, 1 - Math.pow(0.001, dt));
  camera.y = lerp(camera.y, player.y, 1 - Math.pow(0.001, dt));
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);
  ctx.fillStyle = '#0ff'; ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, 7); ctx.fill();
  ctx.fillStyle = '#f55';
  for (const e of enemies) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); }
}
function saveGame() { localStorage.setItem('orbit.save', JSON.stringify({ hp: player.hp, wave: enemies.length })); }
function loadGame() { const raw = localStorage.getItem('orbit.save'); return raw ? JSON.parse(raw) : null; }
state.on('playing', dt => { updatePhysics(dt); for (const e of enemies) chasePlayer(e, dt); checkCollisions(); updateCamera(dt); render(); });
function tick(now) {
  acc += Math.min(0.25, (now - lastTime) / 1000); lastTime = now;
  while (acc >= FIXED_STEP) { state.tick(FIXED_STEP); acc -= FIXED_STEP; }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
