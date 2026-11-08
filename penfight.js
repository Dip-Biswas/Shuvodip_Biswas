import { DESK, STEP, PENS, place, setup, gripAt, flick, step, outcome, chooseShot } from './penfight-engine.js?v=grip1';

const byId = id => document.getElementById(id);
const desk = byId('desk');
const context = desk.getContext('2d');
const coarse = window.matchMedia('(pointer: coarse)');
let mode = coarse.matches ? 'touch' : 'mouse';
let angle = 0, power = 75, keyboardAim = false;
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
  // Small material details remain visible when the pens turn or slide.
  if (pen.type === 0) {
    ctx.fillStyle = '#f4dfc9'; ctx.fillRect(-half+13, -3.8, 48, 7.6);
    ctx.fillStyle = '#40251c'; ctx.fillRect(-half+13, -1.7, 46, 2.8);
    ctx.fillStyle = '#ffffffaa'; ctx.fillRect(-half+15, -3.6, 43, 1);
  } else if (pen.type === 2) {
    ctx.fillStyle = '#644a24'; ctx.beginPath(); ctx.arc(half-9,0,1.5,0,2*Math.PI); ctx.fill();
    ctx.fillStyle = '#ffdf93'; ctx.fillRect(-half+39,-radius+.5,1.1,2*radius-1);
  } else if (pen.type === 3) {
    ctx.fillStyle = '#ddd7c9'; ctx.fillRect(half-13,-2.5,9,5);
    ctx.fillStyle = '#312a30'; ctx.fillRect(half-5,-1.3,5,2.6);
  }
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
// A cut through a knot bends neighbouring growth lines together. Fine pores
// and small breaks interrupt the grain instead of repeating a tiled image.
let seed = 1741;
function noise() { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; }
for (let y = edge - 14; y < DESK.height; y += .8 + noise()*2.5) {
  wood.beginPath();
  wood.strokeStyle = noise() > .6 ? 'rgba(255,242,203,.28)' : 'rgba(103,62,31,.14)';
  wood.lineWidth = .3 + noise()*1.1;
  for (let x=edge; x<=DESK.width-edge+8; x+=8) {
    const bend = (cx,cy) => 19*Math.exp(-((x-cx)**2)/7000)*Math.tanh((y-cy)/9)*Math.exp(-Math.abs(y-cy)/34);
    const h = y + 3*Math.sin(x/138+y/62)+bend(180,118)+bend(618,312);
    if(x===edge) wood.moveTo(x,h); else wood.lineTo(x,h);
  }
  wood.stroke();
}
for (let i=0;i<2500;i++) {
  wood.fillStyle = noise()>.45 ? '#693f241c' : '#fff7e228';
  wood.fillRect(edge+noise()*surfaceWidth,edge+noise()*surfaceHeight,1+noise()*4,.5);
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
  const grip = state.drag?.contact || pen;
  context.save();
  context.translate(grip.x, grip.y);
  context.strokeStyle = '#fff9e7';
  context.lineWidth = 2;
  context.beginPath(); context.arc(0, 0, state.drag ? 6 : 4, 0, Math.PI*2); context.stroke();
  if ((!state.drag && !keyboardAim) || power < 1) { context.restore(); return; }
  const radians = angle * Math.PI / 180;
  const distance = 20 + power * 1.55;
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
  clearGrip();
  state.phase = phase;
  keyboardAim = false;
  showPower(0);
  byId('turn').textContent = title;
  byId('message').textContent = message;
  desk.classList.toggle('aimable', phase === 'aim');
  shotButton.hidden = !['between', 'over'].includes(phase);
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
function describeInput(next) {
  mode = next;
  byId('input-mode').textContent = next === 'touch' ? 'Touch flick' : next === 'pen' ? 'Stylus flick' : 'Mouse flick';
  byId('gesture').textContent = (next === 'mouse' ? 'Click and hold' : 'Press and hold') + ' your pen. Pull back, then release.';
}
describeInput(mode);
coarse.addEventListener('change', () => describeInput(coarse.matches ? 'touch' : 'mouse'));
function showPower(value) {
  byId('power-value').value = Math.round(value) + '%';
  byId('strength').value = value;
}
function setAim(degrees, amount) {
  angle = degrees; power = Math.min(100, Math.max(0, amount));
  showPower(state.drag || keyboardAim ? power : 0);
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
  setPhase('aim', 'Your turn', 'Grip your pen in the middle for a straight shot, or near an end for spin.');
  setAim(Math.atan2(cpu.y - p.y, cpu.x - p.x) * 180 / Math.PI, 75);
}
function startRound() {
  state.pens = setup(state.selected, state.opponent, state.round);
  startTurn(state.round % 2);
}
function launch(radians, power, contact) {
  flick(state.pens[state.shooter], radians, power, contact);
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
  if (state.phase === 'aim') launch(angle * Math.PI / 180, power / 100);
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
function point(e, box) {
  return { x: (e.clientX-box.left)*DESK.width/box.width, y: (e.clientY-box.top)*DESK.height/box.height };
}
function hit(e) {
  const box = desk.getBoundingClientRect(), scale = DESK.width / box.width;
  const pen = state.pens[0];
  const pad = e.pointerType === 'touch' ? Math.max(4, 22*scale-PENS[pen.type].radius) : 4*scale;
  return gripAt(pen, point(e,box), pad);
}
function clearGrip() {
  const drag = state.drag;
  state.drag = null;
  if (drag && desk.hasPointerCapture(drag.id)) desk.releasePointerCapture(drag.id);
  desk.classList.remove('can-grip','gripped');
}
function cancelGrip() {
  if (!state.drag) return;
  clearGrip(); showPower(0); drawField();
}
desk.addEventListener('pointerdown', e => {
  if (state.phase !== 'aim' || state.drag || e.button !== 0 || !e.isPrimary) return;
  describeInput(e.pointerType);
  const contact = hit(e);
  if (!contact) return;
  e.preventDefault();
  desk.focus({ preventScroll: true });
  keyboardAim = false;
  state.drag = {id:e.pointerId, x:e.clientX, y:e.clientY, contact,
    travel:Math.max(52,Math.min(118,desk.getBoundingClientRect().width*.18))};
  desk.setPointerCapture(e.pointerId); desk.classList.add('gripped');
  setAim(angle, 0);
});
function updateDrag(e) {
  const d = state.drag;
  const dx=d.x-e.clientX, dy=d.y-e.clientY, distance=Math.hypot(dx,dy);
  const deadZone = e.pointerType === 'touch' ? 6 : 3;
  setAim(Math.atan2(dy,dx)*180/Math.PI, 100*Math.max(0,distance-deadZone)/(d.travel-deadZone));
}
desk.addEventListener('pointermove', e => {
  if (state.drag?.id === e.pointerId) updateDrag(e);
  else if (!state.drag && e.pointerType === 'mouse' && state.phase === 'aim') {
    if(mode!=='mouse') describeInput('mouse');
    desk.classList.toggle('can-grip', Boolean(hit(e)));
  }
});
desk.addEventListener('pointerup', e => {
  if (state.drag?.id !== e.pointerId) return;
  updateDrag(e);
  const contact = state.drag.contact;
  if (power >= 5) launch(angle*Math.PI/180, power/100, contact);
  else cancelGrip();
});
for (const name of ['pointercancel','lostpointercapture']) desk.addEventListener(name, e => {
  if (state.drag?.id === e.pointerId) cancelGrip();
});
desk.addEventListener('contextmenu', e => { if (state.drag) e.preventDefault(); });
window.addEventListener('blur', cancelGrip);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGrip(); });
desk.addEventListener('keydown', e => {
  if(e.key==='Escape') { cancelGrip(); return; }
  if (state.phase!=='aim' || state.drag || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) return;
  e.preventDefault();
  if (!keyboardAim && !power) power=75;
  keyboardAim=true;
  if(e.key===' ') { if(!e.repeat) takeShot(); return; }
  const sign = e.key==='ArrowLeft' ? -5 : e.key==='ArrowRight' ? 5 : 0;
  setAim(((angle+sign+540)%360)-180, Math.max(5, power+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0)));
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
