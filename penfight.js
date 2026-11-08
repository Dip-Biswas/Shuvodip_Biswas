import { DESK, STEP, PENS, place, setup, flick, step, outcome, chooseShot } from './penfight-engine.js';

const byId = id => document.getElementById(id);
const desk = byId('desk');
const context = desk.getContext('2d');
const angleInput = byId('angle');
const powerInput = byId('power');
const shotButton = byId('shoot');
const startButton = byId('start');
const state = {
  phase: 'setup', selected: 0, opponent: 2, pens: [], scores: [0, 0],
  round: 0, shooter: 0, wait: 0, drag: null
};

function drawPen(ctx, pen) {
  const spec = PENS[pen.type];
  const half = spec.length / 2, radius = spec.radius;
  ctx.save();
  ctx.translate(pen.x, pen.y);
  ctx.rotate(pen.angle);
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 3;
  ctx.shadowColor = '#452b1f65';
  ctx.fillStyle = spec.ink;
  ctx.beginPath();
  ctx.roundRect(-half, -radius, spec.length - 12, radius * 2, radius);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const highlight = ctx.createLinearGradient(0, -radius, 0, radius);
  highlight.addColorStop(0, '#ffffff0a');
  highlight.addColorStop(0.25, '#ffffff70');
  highlight.addColorStop(0.55, '#ffffff00');
  highlight.addColorStop(1, '#121c2640');
  ctx.fillStyle = highlight;
  ctx.fill();
  const brass = pen.type === 2;
  ctx.fillStyle = brass ? '#d8ad61' : '#d6d9d3';
  ctx.beginPath();
  ctx.moveTo(half - 17, -radius * .72);
  ctx.lineTo(half, 0);
  ctx.lineTo(half - 17, radius * .72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#222c29';
  ctx.fillRect(half - 2, -1, 3, 2);
  if (brass) {
    ctx.fillRect(half - 12, -.7, 10, 1.4);
    ctx.fillStyle = '#d2ac69';
    ctx.fillRect(-half + 34, -radius, 3, radius * 2);
  } else if (pen.type === 1) {
    ctx.fillStyle = '#183144';
    for (let i = 0; i < 5; i++) ctx.fillRect(half - 37 + i * 4, -radius + 1, 2, radius * 2 - 2);
  } else if (pen.type === 3) {
    ctx.fillStyle = '#33283f';
    ctx.fillRect(-half + 4, -radius, 27, 2 * radius);
  }
  ctx.fillStyle = brass ? '#e7c789' : '#d9ded6';
  ctx.beginPath();
  ctx.roundRect(-half + 6, -radius + 2, brass ? 30 : 23, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

// Paint the stationary desktop once. All motion uses the same logical coordinates.
const background = document.createElement('canvas');
background.width = DESK.width;
background.height = DESK.height;
const wood = background.getContext('2d');
wood.fillStyle = '#294439';
wood.fillRect(0, 0, DESK.width, DESK.height);
const edge = DESK.edge;
const surfaceWidth = DESK.width - edge * 2, surfaceHeight = DESK.height - edge * 2;
wood.fillStyle = '#172c23';
wood.fillRect(edge + 5, edge + 8, surfaceWidth, surfaceHeight);
const grain = wood.createLinearGradient(0, edge, DESK.width, DESK.height);
grain.addColorStop(0, '#eed7a9');
grain.addColorStop(.56, '#e7c795');
grain.addColorStop(1, '#d1aa78');
wood.fillStyle = grain;
wood.fillRect(edge, edge, surfaceWidth, surfaceHeight);
wood.save();
wood.beginPath();
wood.rect(edge, edge, surfaceWidth, surfaceHeight);
wood.clip();
for (let i = 0; i < 79; i++) {
  const y = edge + i * 5.1;
  wood.strokeStyle = i % 4 ? '#875b3614' : '#fff2d538';
  wood.lineWidth = i % 3 ? 1 : 1.7;
  wood.beginPath();
  wood.moveTo(edge - 2, y);
  wood.bezierCurveTo(240, y - 12 * Math.sin(i * .42), 510, y + 9 * Math.cos(i * .53), DESK.width - edge + 2, y + 4 * Math.sin(i));
  wood.stroke();
}
wood.restore();
wood.strokeStyle = '#88623b';
wood.lineWidth = 2;
wood.strokeRect(edge, edge, surfaceWidth, surfaceHeight);
wood.strokeStyle = '#ffedcc99';
wood.strokeRect(edge + 3, edge + 3, surfaceWidth - 6, surfaceHeight - 6);
function drawField() {
  context.drawImage(background, 0, 0);
  state.pens.forEach((p, i) => {
    if (p.fallen) return;
    drawPen(context, p);
    const labelX = Math.max(64, Math.min(DESK.width - 64, p.x));
    const labelY = Math.max(edge + 12, Math.min(DESK.height - edge + 14, p.y + 47));
    context.font = 'bold 13px Arial';
    context.textAlign = 'center';
    context.fillStyle = '#fff8e9ed';
    context.fillRect(labelX - 30, labelY - 12, 60, 18);
    context.fillStyle = '#203b33';
    context.fillText(i === 0 ? 'YOU' : 'CPU', labelX, labelY + 1);
  });
  if (state.phase === 'aim') drawGuide();
}
function drawGuide() {
  const pen = state.pens[0];
  const radians = Number(angleInput.value) * Math.PI / 180;
  const distance = 45 + Number(powerInput.value) * 1.3;
  context.save();
  context.translate(pen.x, pen.y);
  context.rotate(radians);
  context.strokeStyle = '#193e33';
  context.fillStyle = '#193e33';
  context.lineWidth = 3;
  context.setLineDash([6, 5]);
  context.beginPath();
  context.moveTo(10, 0);
  context.lineTo(distance - 8, 0);
  context.stroke();
  context.beginPath();
  context.moveTo(distance, 0);
  context.lineTo(distance - 13, -6);
  context.lineTo(distance - 13, 6);
  context.closePath();
  context.fill();
  context.restore();
}
PENS.forEach((spec, i) => {
  const label = document.createElement('label');
  label.className = 'choice';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'pen';
  radio.value = i;
  radio.checked = i === 0;
  const swatch = document.createElement('canvas');
  swatch.width = 165;
  swatch.height = 31;
  swatch.setAttribute('aria-hidden', 'true');
  drawPen(swatch.getContext('2d'), place(i, 76, 14, -.02));
  const name = document.createElement('b');
  name.textContent = spec.name;
  const detail = document.createElement('small');
  detail.textContent = spec.detail;
  label.append(radio, swatch, name, detail);
  byId('choices').append(label);
  radio.addEventListener('change', () => {
    state.selected = i;
    prepare();
  });
});
function setPhase(phase, title, message) {
  state.phase = phase;
  state.drag = null;
  byId('turn').textContent = title;
  byId('message').textContent = message;
  desk.classList.toggle('aimable', phase === 'aim');
  angleInput.disabled = powerInput.disabled = phase !== 'aim';
  shotButton.disabled = !['aim', 'between', 'over'].includes(phase);
  shotButton.textContent = phase === 'between' ? 'Next round ↗' : phase === 'over' ? 'Rematch ↗' : 'Flick pen ↗';
  byId('case').disabled = phase !== 'setup';
  startButton.textContent = phase === 'setup' ? 'Start match ↗' : phase === 'over' ? 'Choose pens' : 'End match & choose pens';
  byId('your-score').textContent = state.scores[0];
  byId('cpu-score').textContent = state.scores[1];
  drawField();
}
function prepare() {
  state.opponent = (state.selected + 2) % PENS.length;
  state.scores = [0, 0];
  state.round = 0;
  state.pens = setup(state.selected, state.opponent);
  byId('visitor-type').textContent = PENS[state.selected].name;
  byId('cpu-type').textContent = PENS[state.opponent].name;
  setPhase('setup', 'Choose your pen', 'Start a match when you’re ready.');
}
function setAim(angle, power) {
  angleInput.value = Math.round(angle);
  powerInput.value = Math.round(power);
  byId('angle-value').textContent = angleInput.value + '°';
  byId('power-value').textContent = powerInput.value + '%';
  drawField();
}
function startTurn(side) {
  state.shooter = side;
  if (side === 1) {
    state.wait = .8;
    setPhase('think', 'Shuvodip’s turn', 'Shuvodip is lining up a shot.');
    return;
  }
  const [p, cpu] = state.pens;
  setPhase('aim', 'Your turn', 'Drag back and release, or set your shot below.');
  setAim(Math.atan2(cpu.y - p.y, cpu.x - p.x) * 180 / Math.PI, 75);
}
function startRound() {
  state.pens = setup(state.selected, state.opponent, state.round);
  startTurn(state.round % 2);
}
function launch(radians, power) {
  flick(state.pens[state.shooter], radians, power);
  setPhase('moving', state.shooter ? 'Shuvodip flicked' : 'You flicked', 'Waiting for the pens to settle.');
}
function finishTurn() {
  const winner = outcome(state.pens);
  if (!winner) { startTurn(1 - state.shooter); return; }
  if (winner !== 'tie') state.scores[winner === 'visitor' ? 0 : 1]++;
  if (state.scores.includes(3)) {
    const won = state.scores[0] === 3;
    setPhase('over', won ? 'You win!' : 'Shuvodip wins', 'Final score ' + state.scores.join('–') + '. Ready for a rematch?');
  } else {
    const result = winner === 'tie' ? 'Both pens fell. No point awarded.' : winner === 'visitor' ? 'You knocked Shuvodip’s pen off the desk.' : 'Your pen went off the desk.';
    setPhase('between', winner === 'tie' ? 'Draw' : winner === 'visitor' ? 'Your point' : 'Point to Shuvodip', result);
  }
}
function takeShot() {
  if (state.phase === 'aim') launch(Number(angleInput.value) * Math.PI / 180, Number(powerInput.value) / 100);
  else if (state.phase === 'between') { state.round++; startRound(); }
  else if (state.phase === 'over') { state.scores = [0, 0]; state.round = 0; startRound(); }
}
startButton.addEventListener('click', () => {
  if (state.phase !== 'setup') { prepare(); byId('case').querySelector(':checked').focus(); return; }
  startRound();
  byId('match').scrollIntoView({ block: 'start' });
  desk.focus({ preventScroll: true });
});
shotButton.addEventListener('click', takeShot);
for (const slider of [angleInput, powerInput]) {
  slider.addEventListener('input', () => setAim(Number(angleInput.value), Number(powerInput.value)));
}
function point(event) {
  const box = desk.getBoundingClientRect();
  return { x: (event.clientX - box.left) * DESK.width / box.width,
    y: (event.clientY - box.top) * DESK.height / box.height };
}
desk.addEventListener('pointerdown', event => {
  if (state.phase !== 'aim' || state.drag || event.button !== 0) return;
  event.preventDefault();
  desk.focus({ preventScroll: true });
  state.drag = { ...point(event), id: event.pointerId };
  desk.setPointerCapture(event.pointerId);
});
function updateDrag(event) {
  if (!state.drag || event.pointerId !== state.drag.id) return 0;
  const p = point(event), dx = state.drag.x - p.x, dy = state.drag.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= 5) setAim(Math.atan2(dy, dx) * 180 / Math.PI, Math.min(100, distance / 1.35));
  return distance;
}
desk.addEventListener('pointermove', updateDrag);
desk.addEventListener('pointerup', event => {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  const distance = updateDrag(event);
  state.drag = null;
  if (distance >= 8) takeShot();
});
for (const name of ['pointercancel', 'lostpointercapture']) desk.addEventListener(name, () => { state.drag = null; });
window.addEventListener('blur', () => { state.drag = null; });
desk.addEventListener('keydown', event => {
  if (state.phase !== 'aim') return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
  event.preventDefault();
  if (event.key === ' ') { if (!event.repeat) takeShot(); return; }
  let angle = Number(angleInput.value), power = Number(powerInput.value);
  if (event.key === 'ArrowLeft') angle -= 5;
  if (event.key === 'ArrowRight') angle += 5;
  if (event.key === 'ArrowUp') power += 5;
  if (event.key === 'ArrowDown') power -= 5;
  setAim(((angle + 540) % 360) - 180, power);
});
let last = 0, accumulator = 0;
function frame(now) {
  const delta = last ? Math.min(.08, (now - last) / 1000) : 0;
  last = now;
  if (state.phase === 'think') {
    state.wait -= delta;
    if (state.wait <= 0) {
      const shot = chooseShot(state.pens);
      launch(shot.radians, shot.power);
    }
  }
  if (state.phase === 'moving') {
    accumulator += delta;
    while (accumulator >= STEP && state.phase === 'moving') {
      accumulator -= STEP;
      if (step(state.pens)) { accumulator = 0; finishTurn(); }
    }
    drawField();
  }
  requestAnimationFrame(frame);
}
prepare();
requestAnimationFrame(frame);
