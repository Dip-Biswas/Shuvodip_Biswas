import { makeTable, drawPen, drawDrop } from './penfight-render.js?v=motion2';
import { DESK, STEP, PENS, place, setup, gripAt, flick, step, outcome, chooseShot } from './penfight-engine.js?v=motion2';

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

const background = makeTable();
const edge = DESK.edge;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let previous = null, release = null, cpuShot = null, elapsed = 0;
let last = 0, accumulator = 0;
const camera = { zoom: 1, x: 0, y: 0 };

function trackShot(delta) {
  if (state.drag) return false;
  const [a,b] = state.pens;
  let zoom = 1, x = 0, y = 0;
  if (state.phase === 'moving' && !reduceMotion.matches) {
    // Keep both barrels and the desk edge in frame, even on a narrow screen.
    zoom = Math.max(1,Math.min(1.28, DESK.width/(Math.abs(a.x-b.x)+190),
      DESK.height/(Math.abs(a.y-b.y)+160)));
    const focusX = (a.x+b.x)/2, focusY = (a.y+b.y)/2;
    x = Math.max(DESK.width*(1-zoom),Math.min(0,DESK.width/2-focusX*zoom));
    y = Math.max(DESK.height*(1-zoom),Math.min(0,DESK.height/2-focusY*zoom));
  }
  const easing = reduceMotion.matches ? 1 : 1-Math.exp(-delta*8);
  const changed = Math.abs(camera.zoom-zoom)>.0001 || Math.abs(camera.x-x)>.02 || Math.abs(camera.y-y)>.02;
  camera.zoom += (zoom-camera.zoom)*easing;
  camera.x += (x-camera.x)*easing;
  camera.y += (y-camera.y)*easing;
  return changed;
}

function pullOffset(radians, strength) {
  const distance = reduceMotion.matches ? 0 : 7 * strength;
  return { x: -Math.cos(radians)*distance, y: -Math.sin(radians)*distance };
}
function visualPose(index, blend) {
  const pen = state.pens[index];
  const pose = {...pen};
  if (previous && state.phase === 'moving') {
    const lastPose = previous[index];
    for (const key of ['x','y','angle','roll','rock','fallTime']) {
      pose[key] = lastPose[key] + (pen[key]-lastPose[key])*blend;
    }
  }
  let offset = null;
  if (index === state.shooter) {
    if (state.drag) offset = pullOffset(angle*Math.PI/180, power/100);
    if (state.phase === 'think' && cpuShot) {
      const progress = Math.min(1, Math.max(0, 1-state.wait/.6));
      offset = pullOffset(cpuShot.radians, cpuShot.power*progress*progress);
    }
    if (state.phase === 'moving' && release) {
      const remaining = Math.max(0, 1-elapsed/.075)**2;
      offset = {x:release.x*remaining, y:release.y*remaining};
    }
  }
  if (offset) { pose.x += offset.x; pose.y += offset.y; }
  return pose;
}

function drawField(blend = 1) {
  context.save();
  context.translate(camera.x,camera.y);
  context.scale(camera.zoom,camera.zoom);
  context.drawImage(background,0,0,DESK.width,DESK.height);
  state.pens.forEach((pen,index) => {
    const pose = visualPose(index,blend);
    if (pen.fallen) { drawDrop(context,pose); return; }
    if (state.phase === 'moving' && !reduceMotion.matches && Math.hypot(pen.vx,pen.vy)>240) {
      context.save();
      context.globalAlpha=.115;
      drawPen(context,{...pose,x:pose.x-pen.vx*.007,y:pose.y-pen.vy*.007,angle:pose.angle-pen.spin*.007},false);
      context.restore();
    }
    drawPen(context,pose);
    if (state.phase !== 'setup' && state.phase !== 'aim') return;
    const labelX = Math.max(62,Math.min(DESK.width-62,pose.x));
    const labelY = Math.max(edge+12,Math.min(DESK.height-edge-4,pose.y+47));
    context.font = 'bold 12px Arial';
    context.textAlign = 'center';
    context.lineWidth = 3;
    context.strokeStyle = '#edd1a6';
    context.fillStyle = '#352f23';
    const name = index === 0 ? 'YOU' : 'CPU';
    context.strokeText(name,labelX,labelY);
    context.fillText(name,labelX,labelY);
  });
  if (state.phase === 'aim') drawGuide();
  context.restore();
}

function resizeDesk() {
  const scale = Math.min(2.5,window.devicePixelRatio || 1) * desk.getBoundingClientRect().width / DESK.width;
  const width = Math.max(1, Math.round(DESK.width*scale));
  const height = Math.max(1, Math.round(DESK.height*scale));
  if (desk.width !== width || desk.height !== height) {
    desk.width=width; desk.height=height;
  }
  context.setTransform(width/DESK.width,0,0,height/DESK.height,0,0);
  drawField();
}
function drawGuide() {
  const pen = state.pens[0];
  const grip = state.drag?.contact || pen;
  context.save();
  const offset = state.drag ? pullOffset(angle*Math.PI/180,power/100) : {x:0,y:0};
  context.translate(grip.x+offset.x, grip.y+offset.y);
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
  cpuShot = previous = release = null;
  camera.zoom = 1;
  camera.x = camera.y = 0;
  accumulator = 0;
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
    cpuShot = chooseShot(state.pens);
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
  elapsed = accumulator = 0;
  release = pullOffset(radians, power);
  previous = state.pens.map(pen => ({...pen}));
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
  return { x: ((e.clientX-box.left)*DESK.width/box.width-camera.x)/camera.zoom,
    y: ((e.clientY-box.top)*DESK.height/box.height-camera.y)/camera.zoom };
}
function hit(e) {
  const box = desk.getBoundingClientRect(), scale = DESK.width / box.width / camera.zoom;
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
function frame(now) {
  const delta = last ? Math.min(.08, (now - last) / 1000) : 0;
  last = now;
  const cameraMoved = trackShot(delta);
  if (state.phase === 'think') {
    state.wait -= delta;
    if (state.wait <= 0) launch(cpuShot.radians, cpuShot.power);
    else drawField();
  }
  if (state.phase === 'moving') {
    elapsed += delta;
    accumulator += delta;
    while (accumulator >= STEP && state.phase === 'moving') {
      accumulator -= STEP;
      previous = state.pens.map(pen => ({...pen}));
      if (step(state.pens)) { accumulator = 0; finishTurn(); }
    }
    drawField(accumulator/STEP);
  } else if (cameraMoved) drawField();
  requestAnimationFrame(frame);
}
prepare();
resizeDesk();
new ResizeObserver(resizeDesk).observe(desk);
requestAnimationFrame(frame);
