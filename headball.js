(() => {
  'use strict';
  const {Match,W,H,FLOOR,GOAL,R}=Headball,game=new Match(),canvas=document.getElementById('pitch'),ctx=canvas.getContext('2d');
  const $=id=>document.getElementById(id),overlay=$('overlay'),start=$('start'),pause=$('pause'),restart=$('restart'),difficulty=$('difficulty'),status=$('match-status');
  const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyX:'kick',KeyK:'kick'},pressed=new Set(),pointers=new Map();
  let last=0,accumulator=0,lastPhase='',lastScore='',lastTime='',sound=false,audio=null,queuedJump=false,queuedKick=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clearInput(){pressed.clear();pointers.clear();queuedJump=false;queuedKick=false;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
  function input(){const result={jump:queuedJump,kick:queuedKick};pressed.forEach(k=>{if(keyMap[k])result[keyMap[k]]=true;});pointers.forEach(k=>result[k]=true);return result;}
  function beep(freq,duration=.1){if(!sound)return;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{sound=false;$('sound').textContent='Sound unavailable';}}
  function begin(){clearInput();game.reset(difficulty.value);lastPhase='';accumulator=0;beep(440);canvas.focus({preventScroll:true});$('game').scrollIntoView({block:'start',behavior:'instant'});sync();}
  start.addEventListener('click',()=>{if(game.phase==='paused'){game.resume();canvas.focus({preventScroll:true});sync();}else begin();});
  restart.addEventListener('click',begin);
  function togglePause(){if(game.phase==='paused')game.resume();else game.pause();clearInput();sync();}
  pause.addEventListener('click',()=>{togglePause();canvas.focus({preventScroll:true});});
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');if(sound)beep(520);});
  document.addEventListener('keydown',e=>{if(e.target.closest('select,input,textarea')||(e.target.closest('button,a')&&['Space','Enter'].includes(e.code)))return;if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){togglePause();return;}if(keyMap[e.code]&&['playing','kickoff','goal'].includes(game.phase)){e.preventDefault();pressed.add(e.code);}});
  document.addEventListener('keyup',e=>pressed.delete(e.code));
  document.querySelectorAll('[data-control]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(!['playing','kickoff','goal'].includes(game.phase))return;button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,button.dataset.control);if(button.dataset.control==='jump')queuedJump=true;if(button.dataset.control==='kick')queuedKick=true;button.classList.add('pressed');});
    const release=e=>{pointers.delete(e.pointerId);if(![...pointers.values()].includes(button.dataset.control))button.classList.remove('pressed');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  });
  function autoPause(){clearInput();game.pause();sync();}
  window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
  function sync(){
    const score=game.score.join(':');if(score!==lastScore){$('you-score').textContent=game.score[0];$('ai-score').textContent=game.score[1];lastScore=score;}
    const sec=Math.ceil(game.time),time=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');if(time!==lastTime){$('timer').textContent=time;lastTime=time;}
    const phase=game.phase;if(phase!==lastPhase){
      overlay.hidden=!['ready','paused','ended'].includes(phase);pause.disabled=['ready','ended'].includes(phase);restart.disabled=phase==='ready';difficulty.disabled=!['ready','ended'].includes(phase);pause.textContent=phase==='paused'?'Resume':'Pause';
      if(phase==='kickoff')status.textContent='Kick-off. You’re in peach; score in the right goal.';
      if(phase==='playing')status.textContent='Match on. Move, jump, and kick. First to five wins.';
      if(phase==='goal')status.textContent=(game.lastGoal===0?'You scored!':'Shuvodip scored.')+' '+game.score[0]+'–'+game.score[1]+'. Next kick-off coming up.';
      if(phase==='paused'){$('overlay-label').textContent='TAKE A BREATHER';$('overlay-title').textContent='Half-time, whenever.';$('overlay-copy').textContent='The clock is stopped. Pick up where you left off.';start.innerHTML='Back to the match <span aria-hidden="true">↗</span>';$('overlay-foot').textContent='Press P or Esc to resume.';status.textContent='Match paused. Your score and time are saved until you resume.';}
      if(phase==='ended'){const win=game.score[0]>game.score[1],draw=game.score[0]===game.score[1];$('overlay-label').textContent='FULL TIME / '+game.score[0]+' – '+game.score[1];$('overlay-title').textContent=draw?'Honours even.':win?'You got me.':'One more round?';$('overlay-copy').textContent=draw?'A draw. There’s only one way to settle this.':win?'Well played. I’ll be over here working on my defence.':'Shuvodip takes this one. There’s a rematch with your name on it.';start.innerHTML='Play again <span aria-hidden="true">↗</span>';$('overlay-foot').textContent='Change the pace above, or go straight back in.';status.textContent=(draw?'Draw.':win?'You win!':'Shuvodip wins.')+' Final score '+game.score[0]+'–'+game.score[1]+'.';clearInput();}
      lastPhase=phase;
    }
    $('field-message').textContent=phase==='kickoff'?(game.delay>.55?'Ready?':'Go!'):phase==='goal'?(game.lastGoal===0?'Nice one!':'Goal for Shuvodip!'):'';
    for(const event of game.events.splice(0)){if(event==='kick')beep(220,.06);if(event==='goal')beep(660,.25);if(event==='end')beep(330,.3);}
  }
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
  function goal(x,flip){ctx.save();ctx.translate(x,GOAL);ctx.scale(flip,1);ctx.fillStyle='#d2dfc912';ctx.fillRect(0,0,53,FLOOR-GOAL);for(let i=0;i<=53;i+=10)line(i,0,i,FLOOR-GOAL,'#d9e3ce35');for(let y=0;y<FLOOR-GOAL;y+=12)line(0,y,53,y,'#d9e3ce35');line(0,0,53,0,'#e2e6d5',6);line(53,0,53,FLOOR,'#e2e6d5',6);ctx.restore();}
  function stadium(){
    ctx.fillStyle='#264b40';ctx.fillRect(0,0,W,H);
    const sky=ctx.createLinearGradient(0,0,0,FLOOR);sky.addColorStop(0,'#183d33');sky.addColorStop(1,'#365c46');ctx.fillStyle=sky;ctx.fillRect(0,0,W,FLOOR);
    // Quiet floodlights, terraces, and field markings; all drawn locally.
    for(const x of [108,852]){line(x,70,x,290,'#a6bbaa22',4);for(let i=0;i<4;i++){ctx.fillStyle='#d8dbb67a';ctx.fillRect(x-27+i*16,62,11,9);}ctx.fillStyle='#e8e8bd06';ctx.beginPath();ctx.moveTo(x-30,75);ctx.lineTo(x+160,330);ctx.lineTo(x-160,330);ctx.closePath();ctx.fill();}
    for(let row=0;row<3;row++){line(0,224+row*18,W,224+row*18,'#96ae9120');for(let col=0;col<45;col++){circle(10+col*22+(row%2)*9,216+row*18,3.5,col%4===0?'#ffc39c40':'#b2c5aa25');}}
    ctx.fillStyle='#213e32';ctx.fillRect(0,277,W,18);ctx.font='9px Courier New';ctx.fillStyle='#c5d1bb99';ctx.textAlign='center';ctx.fillText('SHUVODIP’S BACKYARD  /  FRIENDLY RIVALRY ONLY',W/2,289);
    ctx.fillStyle='#477052';ctx.fillRect(0,295,W,H-295);for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#ffffff04':'#152d240a';ctx.fillRect(i*120,295,120,H-295);}
    ctx.strokeStyle='#e5ead343';ctx.lineWidth=2;ctx.strokeRect(70,319,820,107);ctx.beginPath();ctx.ellipse(480,373,65,39,0,0,Math.PI*2);ctx.stroke();line(480,319,480,426,'#e5ead343',2);circle(480,373,3,'#e5ead355');line(0,FLOOR,W,FLOOR,'#d8e2c7',3);
    goal(0,1);goal(W,-1);ctx.font='10px Courier New';ctx.fillStyle='#dce6ca9c';ctx.fillText('← DEFEND',170,468);ctx.fillText('ATTACK →',790,468);ctx.font='italic 20px Georgia';ctx.fillStyle='#cdd6be66';ctx.fillText('a little less screen time. sort of.',480,476);
  }
  function player(p,i){
    const cpu=i===1,shirt=cpu?'#133c32':'#ffc39c',skin=cpu?'#c58c61':'#e3ad88';
    ctx.save();ctx.translate(p.x,FLOOR+3);ctx.scale(1,Math.max(.3,1-(FLOOR-p.y)/400));ctx.fillStyle='#102c2344';ctx.beginPath();ctx.ellipse(0,0,30,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.translate(p.x,p.y);const step=reduced?0:Math.sin(p.x*.11)*Math.min(5,Math.abs(p.vx)/50);
    line(-9,-17,-12+step,-4,'#172f2a',10);line(9,-17,12-step,-4,'#172f2a',10);
    ctx.fillStyle='#f5eee0';ctx.fillRect(-22+step,-7,20,7);ctx.fillRect(3-step,-7,20,7);
    if(p.kick>0){ctx.save();ctx.scale(p.face,1);line(9,-21,39,-25,'#172f2a',11);line(32,-25,47,-27,'#f5eee0',10);ctx.restore();}
    ctx.fillStyle=shirt;ctx.beginPath();ctx.roundRect(-22,-39,44,25,9);ctx.fill();line(-23,-34,-29,-18,skin,7);line(23,-34,29,-18,skin,7);ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillStyle=cpu?'#ffc39c':'#203b33';ctx.fillText(cpu?'SB':'YOU',0,-22);
    circle(0,-61,29,skin,'#152f29');circle(-28,-58,5,skin);circle(28,-58,5,skin);
    if(cpu){for(let j=0;j<9;j++){const a=Math.PI+j*Math.PI/8;circle(Math.cos(a)*26,-72+Math.sin(a)*19,10,'#17252a');}circle(-28,-74,8,'#17252a');circle(27,-74,8,'#17252a');ctx.strokeStyle='#183343';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-24,-69,21,16,5);ctx.roundRect(3,-69,21,16,5);ctx.stroke();line(-3,-63,3,-63,'#183343',3);}
    else{ctx.fillStyle='#654734';ctx.beginPath();ctx.arc(0,-69,27,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-27,-74,8,14);}
    circle(-12+p.face*2,-61,2.5,'#172b27');circle(12+p.face*2,-61,2.5,'#172b27');ctx.strokeStyle='#784931';ctx.lineWidth=2;ctx.beginPath();ctx.arc(1,-51,9,0.15,Math.PI-.15);ctx.stroke();if(cpu){line(-8,-48,8,-48,'#293029',3);line(-5,-40,5,-40,'#293029',3);}
    ctx.restore();
  }
  function ball(){const b=game.ball;ctx.fillStyle='#102c2333';ctx.beginPath();ctx.ellipse(b.x,FLOOR+3,Math.max(4,18-(FLOOR-b.y)*.025),4,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);circle(0,0,R,'#f9f3df','#19392d');ctx.fillStyle='#244b3a';ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const x=Math.cos(a)*7,y=Math.sin(a)*7;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;line(Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*15,Math.sin(a)*15,'#244b3a',1.5);}ctx.restore();}
  function render(){ctx.clearRect(0,0,W,H);stadium();game.players.forEach(player);ball();}
  function frame(now){if(!last)last=now;const elapsed=Math.min((now-last)/1000,.1);last=now;accumulator+=elapsed;while(accumulator>=1/120){const active=game.phase==='playing';game.update(1/120,input());if(active){queuedJump=false;queuedKick=false;}accumulator-=1/120;}sync();render();requestAnimationFrame(frame);}
  if(!ctx){status.textContent='Your browser cannot draw the game. Please try another browser.';start.disabled=true;return;}
  sync();requestAnimationFrame(frame);
})();
