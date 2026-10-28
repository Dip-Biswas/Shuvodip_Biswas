(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Headball=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const W=960,H=500,FLOOR=426,GOAL=296,R=16,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class Match {
    constructor(){this.difficulty='casual';this.reset();this.phase='ready';}
    reset(difficulty='casual'){this.difficulty=difficulty;this.score=[0,0];this.time=90;this.phase='kickoff';this.delay=1.2;this.lastGoal=-1;this.events=[];this.round=0;this.resetPositions();}
    resetPositions(){this.players=[{x:235,y:FLOOR,vx:0,vy:0,face:1,cooldown:0,kick:0},{x:725,y:FLOOR,vx:0,vy:0,face:-1,cooldown:0,kick:0}];this.ball={x:W/2,y:180,vx:(this.round%2?1:-1)*55,vy:0,angle:0};this.aiClock=0;this.aiMove=0;}
    pause(){if(['playing','kickoff','goal'].includes(this.phase)){this.resumePhase=this.phase;this.phase='paused';}}
    resume(){if(this.phase==='paused')this.phase=this.resumePhase;}
    finish(){this.phase='ended';this.events.push('end');}
    goal(side){this.score[side]++;this.lastGoal=side;this.events.push('goal');if(this.score[side]>=5){this.finish();return;}this.phase='goal';this.delay=1.7;}
    kick(p){if(p.cooldown>0)return;p.cooldown=.32;p.kick=.16;const b=this.ball,dx=b.x-p.x,dy=b.y-(p.y-39);if(Math.hypot(dx,dy)<99&&dx*p.face>-34){b.vx=p.face*760+p.vx*.3;b.vy=-440+(dy<-30?-120:0);this.events.push('kick');}}
    update(dt,input={}){
      if(!Number.isFinite(dt)||dt<=0)return;
      dt=Math.min(dt,1/30);
      if(['ready','paused','ended'].includes(this.phase))return;
      if(this.phase==='kickoff'||this.phase==='goal'){this.delay-=dt;if(this.delay<=0){if(this.phase==='goal'){this.round++;this.resetPositions();this.phase='kickoff';this.delay=1.2;}else this.phase='playing';}return;}
      this.time=Math.max(0,this.time-dt);if(this.time<=0){this.finish();return;}
      const b=this.ball,ai=this.players[1],hard=this.difficulty==='challenge';
      this.aiClock-=dt;
      if(this.aiClock<=0){this.aiClock=hard?.09:.22;let target;
        if(b.x<360&&b.vx<100)target=640;
        else target=Math.max(hard?400:460,b.x+80+Math.max(0,b.vx)*(hard?.48:.28));
        if(b.y>FLOOR-28&&Math.abs(b.vx)<65)target=b.x+65;
        target=clamp(target,110,865);this.aiMove=Math.abs(target-ai.x)<18?0:Math.sign(target-ai.x);
      }
      this.players.forEach((p,i)=>{
        const move=i===0?Number(!!input.right)-Number(!!input.left):this.aiMove;
        const speed=i===0?310:hard?295:235;
        p.vx+=(move*speed-p.vx)*Math.min(1,dt*15);if(move)p.face=move;
        if(i===1)p.face=-1;
        const jump=i===0?input.jump:Math.abs(b.x-p.x)<(hard?115:85)&&b.y<p.y-68&&b.y>p.y-235&&b.vy>-220;
        if(jump&&p.y>=FLOOR-.1)p.vy=-600;
        p.vy+=1600*dt;p.x=clamp(p.x+p.vx*dt,83,W-83);p.y+=p.vy*dt;
        if(p.y>=FLOOR){p.y=FLOOR;p.vy=0;}
        p.cooldown=Math.max(0,p.cooldown-dt);p.kick=Math.max(0,p.kick-dt);
        if(i===0?input.kick:Math.abs(b.x-p.x)<85&&b.y>p.y-110&&b.x<p.x+20)this.kick(p);
      });
      // Soft body separation keeps both players on the pitch without trapping the ball.
      const [a,c]=this.players,px=c.x-a.x,py=c.y-a.y;
      if(Math.abs(px)<58&&Math.abs(py)<58){const correction=(58-Math.abs(px))/2,sign=px>=0?1:-1;a.x=clamp(a.x-correction*sign,83,W-83);c.x=clamp(c.x+correction*sign,83,W-83);}
      b.vy+=1040*dt;b.vx*=Math.exp(-.12*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.vx*dt/R;
      for(const p of this.players){
        const cy=p.y-57,dx=b.x-p.x,dy=b.y-cy,dist=Math.hypot(dx,dy);
        if(dist<46){const nx=dist>.001?dx/dist:p.face,ny=dist>.001?dy/dist:-.2;b.x=p.x+nx*46;b.y=cy+ny*46;const relative=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;if(relative<0){b.vx-=1.65*relative*nx;b.vy-=1.65*relative*ny;}b.vx+=p.vx*.08;b.vy-=25;}
        // The torso and boots also deflect low balls.
        const nx=clamp(b.x,p.x-19,p.x+19),ny=clamp(b.y,p.y-34,p.y-4),tx=b.x-nx,ty=b.y-ny,d=Math.hypot(tx,ty);
        if(d<R){const ux=d>.001?tx/d:(b.x>=p.x?1:-1),uy=d>.001?ty/d:0;b.x=nx+ux*(R+1);b.y=ny+uy*(R+1);const rel=(b.vx-p.vx)*ux+(b.vy-p.vy)*uy;if(rel<0){b.vx-=1.5*rel*ux;b.vy-=1.5*rel*uy;}}
      }
      // Rounded crossbars, full-height side walls above the goal mouth.
      for(const x of [53,W-53]){const dx=b.x-x,dy=b.y-GOAL,d=Math.hypot(dx,dy);if(d<R+5){const nx=d>.001?dx/d:1,ny=d>.001?dy/d:-1;b.x=x+nx*(R+5);b.y=GOAL+ny*(R+5);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.8*dot*nx;b.vy-=1.8*dot*ny;}}}
      if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*.78;}
      if(b.y>FLOOR-R){b.y=FLOOR-R;b.vy=-Math.abs(b.vy)*.76;if(Math.abs(b.vy)<50)b.vy=0;b.vx*=.985;}
      if(b.y<GOAL+R){if(b.x<R){b.x=R;b.vx=Math.abs(b.vx)*.84;}if(b.x>W-R){b.x=W-R;b.vx=-Math.abs(b.vx)*.84;}}
      else if(b.x<25){this.goal(1);return;}else if(b.x>W-25){this.goal(0);return;}
      b.vx=clamp(b.vx,-950,950);b.vy=clamp(b.vy,-950,1050);
    }
  }
  return {Match,W,H,FLOOR,GOAL,R};
});
