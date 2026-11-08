import { DESK, FALL_TIME, PENS } from './penfight-engine.js?v=motion2';

const { width, height, edge } = DESK;
const palettes = [
  ['#763118', '#ef9566', '#9d4829'], ['#132f45', '#6dacc0', '#305773'],
  ['#0e2922', '#568875', '#254b40'], ['#422d42', '#ba92a3', '#835b74']
];

function cylinder(ctx, y, radius, dark, light, mid) {
  const fill = ctx.createLinearGradient(0, y - radius, 0, y + radius);
  for (const [at, color] of [[0,dark],[0.23,mid],[0.38,light],[0.55,mid],[0.92,dark],[1,mid]]) {
    fill.addColorStop(at, color);
  }
  return fill;
}

function band(ctx, x, length, radius, fill, rounding = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, -radius, length, 2 * radius, rounding);
  ctx.fill();
}

function nib(ctx, start, end, radius, ink, fountain) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(start, -radius);
  ctx.quadraticCurveTo(start + 7, -radius * (fountain ? 1.2 : 0.8), end, -0.65);
  ctx.lineTo(end, 0.65);
  ctx.quadraticCurveTo(start + 7, radius * (fountain ? 1.2 : 0.8), start, radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#352c29';
  if (fountain) {
    ctx.beginPath();
    ctx.arc(start+8, 0, 1.55, 0, 2*Math.PI);
    ctx.fill();
    ctx.fillRect(start+8, -.5, end-start-8, 1);
  }
  ctx.fillRect(end-1, -0.8, 2, 1.6);
}

export function drawPen(ctx, pen, shadow = true) {
  const spec = PENS[pen.type];
  const half = spec.length / 2, r = spec.radius, tail = -half, nose = half;
  const roll = pen.roll + pen.rock;
  ctx.save();
  ctx.translate(pen.x, pen.y);
  ctx.rotate(pen.angle);
  if (shadow) {
    ctx.save();
    // Slip of light under a rocking barrel separates it from its contact shadow.
    ctx.translate(1.8*Math.sin(pen.angle), (2.8+8*Math.abs(pen.rock))*Math.cos(pen.angle));
    band(ctx, tail+2, spec.length-5, r*.90, 'rgba(32,16,9,.34)', r);
    ctx.restore();
  }
  const lacquer = cylinder(ctx, 0, r, ...palettes[pen.type]);
  const steel = cylinder(ctx, 0, r, '#55616b', '#fcfcf4', '#9da9a8');
  const brass = cylinder(ctx, 0, r, '#785125', '#ffe3a0', '#c49850');
  const rubber = cylinder(ctx, 0, r, '#142222', '#5b6560', '#273735');
  const nibLength = pen.type === 2 ? 24 : 15;
  const shoulder = nose - nibLength;

  band(ctx, tail, shoulder-tail+2, r, lacquer, r);
  if (pen.type === 0) {
    band(ctx, tail+8, 46, r*.84, '#c4b7a5', 3);
    band(ctx, tail+9, 45, r*.62, '#e9d9c1', 2);
    band(ctx, tail+10, 43, 1.9, '#4f322c', 1);
    ctx.fillStyle = '#fff8e1aa'; ctx.fillRect(tail+11,-r*.59,41,1.1);
    band(ctx, shoulder-4, 5, r*.82, steel);
  } else if (pen.type === 1) {
    band(ctx, shoulder-26, 27, r, rubber, 3);
    for (let i=0;i<6;i++) band(ctx, shoulder-23+i*4, 1.1, r*.92, '#101f24aa');
    band(ctx, tail, 8, r*.80, steel, 3);
  } else if (pen.type === 2) {
    band(ctx, tail+29, 3.5, r, brass);
    band(ctx, tail+35, 1.4, r, brass);
    band(ctx, shoulder-9, 11, r*.80, rubber, 3);
  } else {
    band(ctx, tail, 24, r, rubber, 3);
    band(ctx, shoulder-3, 4, r*.86, '#cac1b2');
  }
  nib(ctx, shoulder, nose, r*(pen.type===3?.51:.77), pen.type===2 ? brass : steel, pen.type===2);

  // A clip moves around the cylinder and disappears on the far side.
  const face = Math.cos(roll - .62);
  if (face > 0) {
    const clipY = r * Math.sin(roll - .62);
    ctx.save();
    ctx.translate(tail + 6, clipY);
    ctx.scale(1, Math.max(.15, face));
    band(ctx, 0, pen.type === 2 ? 29 : 23, 1.8, pen.type === 2 ? brass : steel, 1.7);
    ctx.restore();
  }
  ctx.restore();
}

export function makeTable() {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const w = width-2*edge, h = height-2*edge;
  const floor = ctx.createLinearGradient(0,0,width,height);
  floor.addColorStop(0,'#37473f'); floor.addColorStop(1,'#172821');
  ctx.fillStyle=floor; ctx.fillRect(0,0,width,height);
  ctx.shadowColor='#08130f'; ctx.shadowBlur=13; ctx.shadowOffsetY=8;
  ctx.fillStyle='#624125'; ctx.fillRect(edge,edge,w,h+6);
  ctx.shadowColor='transparent';
  const light=ctx.createLinearGradient(edge,edge,width,height);
  light.addColorStop(0,'#e4c395'); light.addColorStop(.52,'#c29666'); light.addColorStop(1,'#a7754f');
  ctx.fillStyle=light; ctx.fillRect(edge,edge,w,h);
  ctx.save(); ctx.beginPath(); ctx.rect(edge,edge,w,h); ctx.clip();
  let seed=36;
  function noise() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
  for(let y=edge-10;y<height-edge+10;y+=.85+noise()*2.8) {
    ctx.beginPath();
    ctx.strokeStyle=noise()>.54?'rgba(255,240,203,.18)':'rgba(86,49,29,.17)';
    ctx.lineWidth=.4+noise();
    for(let x=edge;x<=width-edge+8;x+=8) {
      const knot=16*Math.exp(-((x-583)**2)/7200)*Math.tanh((y-307)/8)*Math.exp(-Math.abs(y-307)/36);
      const v=y+2.8*Math.sin(x/125+y/57)+knot;
      if(x===edge) ctx.moveTo(x,v); else ctx.lineTo(x,v);
    }
    ctx.stroke();
  }
  for(let i=0;i<3100;i++) {
    ctx.fillStyle=noise()>.45?'#5738241b':'#fff7e223';
    ctx.fillRect(edge+noise()*w,edge+noise()*h,1+noise()*4,.6);
  }
  ctx.restore();
  ctx.strokeStyle='#f5d2a0'; ctx.lineWidth=1.5; ctx.strokeRect(edge+1,edge+1,w-2,h-2);
  return canvas;
}

// The visual tilt is in the direction of the edge. The piece keeps its heading
// and tangential momentum while gravity pulls the unsupported end down.
export function drawDrop(ctx, pose) {
  const t = Math.min(1, pose.fallTime/FALL_TIME);
  if (t === 1) return;
  const tangent = pose.dropX ? pose.vy : pose.vx;
  const travel = 17*t + 24*t*t;
  const drift = Math.max(-45,Math.min(45,tangent*.16))*t;
  const x = pose.x + pose.dropX*travel + (pose.dropY ? drift : 0);
  const y = pose.y + pose.dropY*travel + (pose.dropX ? drift : 0);
  const tilt = Math.cos(Math.min(Math.PI*.47, 2.1*t*t));
  ctx.save();
  // Once under the lip, the solid tabletop occludes the falling barrel.
  if (t > .36) {
    ctx.beginPath(); ctx.rect(0,0,width,height);
    ctx.rect(edge,edge,width-2*edge,height-2*edge); ctx.clip('evenodd');
  }
  ctx.translate(x,y);
  ctx.scale(pose.dropX ? tilt : 1, pose.dropY ? tilt : 1);
  ctx.globalAlpha = Math.min(1, (1-t)*3);
  drawPen(ctx,{...pose,x:0,y:0, angle:pose.angle+pose.spin*.11*t, roll:pose.roll+2.3*t},false);
  ctx.restore();
}
