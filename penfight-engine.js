// The tabletop uses a fixed coordinate system on desktop and mobile.
export const DESK = { width: 840, height: 450, edge: 32 };
export const STEP = 1 / 120;
export const PENS = [
  { name: 'Ballpoint', detail: 'Light and quick to accelerate.', mass: 0.85, friction: 300, length: 102, radius: 8, ink: '#bd5738' },
  { name: 'Gel pen', detail: 'Balanced weight and a grippy barrel.', mass: 1.05, friction: 390, length: 108, radius: 10, ink: '#31668b' },
  { name: 'Fountain pen', detail: 'Heavy brass body. Harder to dislodge.', mass: 1.45, friction: 270, length: 120, radius: 11, ink: '#285544' },
  { name: 'Fineliner', detail: 'Long, slim, and easy to spin.', mass: 0.93, friction: 250, length: 130, radius: 7, ink: '#875677' }
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function place(type, x, y, angle) {
  const spec = PENS[type];
  return { type, x, y, angle, vx: 0, vy: 0, spin: 0, fallen: false,
    inertia: spec.mass * (spec.length ** 2 + 4 * spec.radius ** 2) / 12 };
}
export function setup(playerType, cpuType, round = 0) {
  const offset = [-16, 26, -36, 12][round % 4];
  return [place(playerType, 285, 225 + offset, -0.85), place(cpuType, 555, 225 - offset, 1.05)];
}
export function flick(pen, radians, power) {
  const speed = (92 + clamp(power, 0, 1) * 600) / Math.sqrt(PENS[pen.type].mass);
  pen.vx = Math.cos(radians) * speed;
  pen.vy = Math.sin(radians) * speed;
}
function advance(pen, dt) {
  if (pen.fallen) return;
  const speed = Math.hypot(pen.vx, pen.vy);
  const remaining = Math.max(0, speed - PENS[pen.type].friction * dt);
  const ratio = speed ? remaining / speed : 0;
  pen.vx *= ratio;
  pen.vy *= ratio;
  pen.spin = Math.sign(pen.spin) * Math.max(0, Math.abs(pen.spin) - 8 * dt);
  pen.x += pen.vx * dt;
  pen.y += pen.vy * dt;
  pen.angle += pen.spin * dt;
}
// Find the closest contact between the rounded barrels by projecting their ends.
function ends(pen) {
  const half = PENS[pen.type].length / 2 - PENS[pen.type].radius;
  const dx = half * Math.cos(pen.angle), dy = half * Math.sin(pen.angle);
  return [{x: pen.x - dx, y: pen.y - dy}, {x: pen.x + dx, y: pen.y + dy}];
}
function project(point, [start, end]) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return { x: start.x + t * dx, y: start.y + t * dy };
}
function collide(a, b) {
  if (Math.abs(a.x - b.x) > 150 || Math.abs(a.y - b.y) > 150) return;
  const endsA = ends(a), endsB = ends(b);
  const contacts = [...endsA.map(p => [p, project(p, endsB)]), ...endsB.map(p => [project(p, endsA), p])];
  let best = Infinity, normalX = 0, normalY = 0, contactX = 0, contactY = 0;
  for (const [p, q] of contacts) {
    const distance = Math.hypot(q.x - p.x, q.y - p.y);
    if (distance >= best) continue;
    best = distance;
    const fallback = Math.atan2(b.y - a.y, b.x - a.x);
    normalX = distance > 0.001 ? (q.x - p.x) / distance : Math.cos(fallback);
    normalY = distance > 0.001 ? (q.y - p.y) / distance : Math.sin(fallback);
    contactX = (p.x + q.x) / 2;
    contactY = (p.y + q.y) / 2;
  }
  const overlap = PENS[a.type].radius + PENS[b.type].radius - best;
  if (overlap <= 0) return;
  const invA = 1 / PENS[a.type].mass, invB = 1 / PENS[b.type].mass;
  const correction = overlap / (invA + invB);
  const ax = contactX - a.x, ay = contactY - a.y, bx = contactX - b.x, by = contactY - b.y;
  a.x -= correction * invA * normalX;
  a.y -= correction * invA * normalY;
  b.x += correction * invB * normalX;
  b.y += correction * invB * normalY;
  const relativeX = b.vx - b.spin * by - a.vx + a.spin * ay;
  const relativeY = b.vy + b.spin * bx - a.vy - a.spin * ax;
  const closing = relativeX * normalX + relativeY * normalY;
  if (closing >= 0) return;
  const torqueA = ax * normalY - ay * normalX, torqueB = bx * normalY - by * normalX;
  const impulse = -1.65 * closing / (invA + invB + torqueA ** 2 / a.inertia + torqueB ** 2 / b.inertia);
  a.vx -= impulse * invA * normalX;
  a.vy -= impulse * invA * normalY;
  a.spin -= impulse * torqueA / a.inertia;
  b.vx += impulse * invB * normalX;
  b.vy += impulse * invB * normalY;
  b.spin += impulse * torqueB / b.inertia;
}
export function edgeDistance(pen) {
  return Math.min(pen.x, DESK.width - pen.x, pen.y, DESK.height - pen.y) - DESK.edge;
}
export function step(pens, dt = STEP) {
  pens.forEach(p => advance(p, dt));
  if (pens.every(p => !p.fallen)) collide(pens[0], pens[1]);
  for (const p of pens) {
    if (edgeDistance(p) < 0) p.fallen = true;
  }
  return pens.every(p => p.fallen || (!p.vx && !p.vy && !p.spin));
}
export function outcome(pens) {
  if (pens.every(p => p.fallen)) return 'tie';
  if (pens[0].fallen) return 'cpu';
  if (pens[1].fallen) return 'visitor';
  return null;
}
export function chooseShot(pens) {
  const [visitor, cpu] = pens;
  const direct = Math.atan2(visitor.y - cpu.y, visitor.x - cpu.x);
  let best = { radians: direct, power: 0.85 }, highScore = -Infinity;
  for (const offset of [-0.13, -0.06, 0, 0.06, 0.13]) {
    for (const power of [0.52, 0.76, 0.94]) {
      const trial = pens.map(p => ({ ...p }));
      flick(trial[1], direct + offset, power);
      for (let i = 0; i < 480 && !step(trial); i++) { /* resolve one candidate shot */ }
      const [target, shooter] = trial;
      const score = (target.fallen ? 1500 : 0) - (shooter.fallen ? 1900 : 0)
        + edgeDistance(visitor) - edgeDistance(target) + 0.3 * edgeDistance(shooter)
        - 0.14 * Math.hypot(target.x - shooter.x, target.y - shooter.y);
      if (score > highScore) { highScore = score; best = { radians: direct + offset, power }; }
    }
  }
  return best;
}
