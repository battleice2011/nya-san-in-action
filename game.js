(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const titleScreen=$('title-screen'),resultScreen=$('result-screen'),hud=$('hud'),controls=$('touch-controls');
const W=960,H=540,GROUND=445,WORLD=6200;
const idleFrames=Array.from({length:1},(_,i)=>{const im=new Image();im.src=`assets/hero/idle/frame_${String(i+1).padStart(2,'0')}.png`;return im;});
const runFrames=Array.from({length:6},(_,i)=>{const im=new Image();im.src=`assets/hero/run/frame_${String(i+1).padStart(2,'0')}.png`;return im;});
const jumpFrames=Array.from({length:5},(_,i)=>{const im=new Image();im.src=`assets/hero/jump/frame_${String(i+1).padStart(2,'0')}.png`;return im;});
const attackFrames=Array.from({length:4},(_,i)=>{const im=new Image();im.src=`assets/hero/attack/frame_${String(i+1).padStart(2,'0')}.png`;return im;});
const hitFrames=Array.from({length:4},(_,i)=>{const im=new Image();im.src=`assets/hero/hit/frame_${String(i+1).padStart(2,'0')}.png`;return im;});
const enemyFrames={
 slime:Array.from({length:4},(_,i)=>{const im=new Image();im.src=`assets/enemies/slime_${String(i+1).padStart(2,'0')}.png`;return im;}),
 pinkslime:Array.from({length:4},(_,i)=>{const im=new Image();im.src=`assets/enemies/pinkslime_${String(i+1).padStart(2,'0')}.png`;return im;}),
 bat:Array.from({length:2},(_,i)=>{const im=new Image();im.src=`assets/enemies/bat_${String(i+1).padStart(2,'0')}.png`;return im;}),
 goblin:Array.from({length:2},(_,i)=>{const im=new Image();im.src=`assets/enemies/goblin_${String(i+1).padStart(2,'0')}.png`;return im;}),
 wizard:Array.from({length:2},(_,i)=>{const im=new Image();im.src=`assets/enemies/wizard_${String(i+1).padStart(2,'0')}.png`;return im;}),
 golem:Array.from({length:2},(_,i)=>{const im=new Image();im.src=`assets/enemies/golem_${String(i+1).padStart(2,'0')}.png`;return im;})
};
let scale=1,running=false,last=0,time=0,camera=0,score=0,defeated=0,spawnIndex=0;
let audioCtx=null;
function initAudio(){
  if(audioCtx)return;
  try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch(e){audioCtx=null}
}
function sfxTone(freq,dur,type='square',gain=.055,slide=0){
  if(!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),audioCtx.currentTime+dur);
  g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(gain*1.65,audioCtx.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
  o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur+.02);
}
function sfxNoise(dur=.09,gain=.09,filterFreq=900){
  if(!audioCtx)return;
  const n=Math.max(1,Math.floor(audioCtx.sampleRate*dur)),b=audioCtx.createBuffer(1,n,audioCtx.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  f.type='lowpass';f.frequency.value=filterFreq;g.gain.setValueAtTime(Math.min(.85,gain*1.65),audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
  src.buffer=b;src.connect(f).connect(g).connect(audioCtx.destination);src.start();
}
function sfxAttack(){sfxTone(220,.07,'sawtooth',.035,90);}
function sfxHit(){sfxNoise(.075,.13,1100);sfxTone(105,.11,'square',.065,-45);}
function sfxJump(){sfxTone(430,.11,'triangle',.04,260);}
function sfxDamage(){sfxNoise(.16,.11,700);sfxTone(150,.18,'square',.045,-70);}
function sfxBossCharge(){sfxTone(95,.55,'sawtooth',.045,150);}
function sfxClear(){
  if(!audioCtx)return;
  const notes=[[660,0,.13,.075],[880,.12,.13,.085],[1175,.24,.16,.095],[1568,.40,.24,.11]];
  for(const [freq,delay,dur,gain] of notes){
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;
    o.type='triangle';o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.min(.85,gain*1.65),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+dur+.03);
  }
}
let boss=null,bossIntro=0,bossDefeated=false;
let player,enemies,particles,magicEffects,keys=Object.create(null),attackCooldown=0,hurtFlash=0,footstepTimer=0,jumpBuffer=0,coyoteTime=0;
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);scale=Math.min(canvas.width/W,canvas.height/H)}
addEventListener('resize',resize);resize();
function reset(){player={x:90,y:GROUND-140,w:58,h:140,vx:0,vy:0,hp:5,face:1,onGround:true,attack:0,attackStarted:0,jumpStarted:0,hurt:0,invuln:0};enemies=[];particles=[];magicEffects=[];camera=0;score=0;defeated=0;spawnIndex=0;boss=null;bossIntro=0;bossDefeated=false;attackCooldown=0;hurtFlash=0;footstepTimer=0;
 const types=['slime','pinkslime','bat','goblin','wizard','slime','bat','golem','pinkslime','goblin','wizard','slime'];
 types.forEach((type,i)=>spawnEnemy(520+i*430,type));updateHud();}
function spawnEnemy(x,type){const cfg={slime:[48,36,38,1,1.35],pinkslime:[48,36,46,1,1.35],bat:[52,34,62,2,1.4],goblin:[48,62,42,3,1.28],wizard:[44,64,30,2,1.25],golem:[66,70,24,3,1.18]}[type];enemies.push({x,y:GROUND-cfg[1],w:cfg[0],h:cfg[1],speed:cfg[2],hp:cfg[3],maxHp:cfg[3],type,dir:-1,phase:Math.random()*8,hit:0,attack:0,alive:true,vy:0,onGround:true,jumpTimer:.55+Math.random()*.8,spriteScale:cfg[4],chargeState:'idle',chargeTimer:1.2+Math.random()*1.6,chargeDir:-1});}
function start(){initAudio();reset();running=true;titleScreen.classList.add('hidden');resultScreen.classList.add('hidden');hud.classList.remove('hidden');controls.classList.remove('hidden');last=performance.now();requestAnimationFrame(loop)}
function finish(won){if(won)sfxClear();running=false;controls.classList.add('hidden');resultScreen.classList.remove('hidden');$('result-title').textContent=won?'STAGE CLEAR!':'GAME OVER';$('result-text').textContent=won?`敵を ${defeated} 体撃破！　スコア：${String(score).padStart(5,'0')}`:`スコア：${String(score).padStart(5,'0')}　もう一度チャレンジ！`}
$('start-button').addEventListener('click',start);$('restart-button').addEventListener('click',start);
for(const b of document.querySelectorAll('[data-control]')){const key=b.dataset.control;const down=e=>{e.preventDefault();keys[key]=true;b.classList.add('pressed');if(key==='jump')requestJump();if(key==='attack')doAttack()};const up=e=>{e.preventDefault();keys[key]=false;b.classList.remove('pressed')};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' ','z','x','a','d','w'].includes(k))e.preventDefault();if(k==='arrowleft'||k==='a')keys.left=true;if(k==='arrowright'||k==='d')keys.right=true;if(!e.repeat&&(k==='arrowup'||k==='w'||k===' '))requestJump();if(!e.repeat&&(k==='z'||k==='x'))doAttack()});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowleft'||k==='a')keys.left=false;if(k==='arrowright'||k==='d')keys.right=false});
function requestJump(){if(!running)return;jumpBuffer=.16;if(player.onGround||coyoteTime>0)performJump()}
function performJump(){if(!running||(!player.onGround&&coyoteTime<=0))return;sfxJump();player.vy=-560;player.onGround=false;coyoteTime=0;jumpBuffer=0;player.jumpStarted=time;player.hurt=0;burst(player.x+player.w/2,GROUND-3,'#fff',7);burst(player.x+player.w/2,GROUND-4,'#72f4ff',5)}
function doAttack(){if(!running||attackCooldown>0)return; sfxAttack(); attackCooldown=.32;player.attack=.54;player.hurt=0;player.attackStarted=time;const cx=player.x+player.w/2+player.face*70,cy=player.y+player.h-78;
 magicEffects.push({type:'nova',x:cx,y:cy,life:.5,max:.5,face:player.face});magicEffects.push({type:'beam',x:cx,y:cy,life:.34,max:.34,face:player.face});burst(cx,cy,'#fff7a8',24);burst(cx,cy,'#72f4ff',18);
 for(let i=0;i<16;i++){const a=Math.PI*2*i/16;particles.push({x:cx,y:cy,vx:Math.cos(a)*(130+Math.random()*130),vy:Math.sin(a)*(130+Math.random()*130),life:.38+Math.random()*.28,color:i%2?'#fff7a8':'#70efff',r:2+Math.random()*4,star:true})}
 for(const e of enemies){if(!e.alive)continue;const dx=e.x+e.w/2-(player.x+player.w/2),enemyCenterY=e.y+e.h*.5;const verticalReach=e.h*.5+28;const dy=Math.abs(enemyCenterY-cy);if(Math.abs(dx)<150&&dy<verticalReach&&Math.sign(dx||player.face)===player.face){e.hp--;sfxHit();e.hit=.22;e.x+=player.face*28;burst(e.x+e.w/2,e.y+e.h*.4,'#fff19a',14);magicEffects.push({type:'impact',x:e.x+e.w/2,y:e.y+e.h*.45,life:.3,max:.3,face:player.face});if(e.hp<=0){e.alive=false;defeated++;score+=enemyScore(e.type);burst(e.x+e.w/2,e.y+e.h*.4,'#8cf4ff',30);burst(e.x+e.w/2,e.y+e.h*.4,'#ffed8b',14)}}}
 if(boss && bossIntro<=0){
   const dx=boss.x+boss.w/2-(player.x+player.w/2), bossCy=boss.y+boss.h*.5;
   if(Math.abs(dx)<185&&Math.abs(bossCy-cy)<125&&Math.sign(dx||player.face)===player.face){
     boss.hp--;sfxHit();boss.hit=.22;boss.attackFlash=.22;boss.x+=player.face*34;
     burst(boss.x+boss.w/2,boss.y+boss.h*.35,'#fff19a',20);
     magicEffects.push({type:'impact',x:boss.x+boss.w/2,y:boss.y+boss.h*.42,life:.3,max:.3,face:player.face});
     if(boss.hp<=0){score+=2500;bossDefeated=true;burst(boss.x+boss.w/2,boss.y+boss.h*.35,'#8cf4ff',70);burst(boss.x+boss.w/2,boss.y+boss.h*.35,'#ffed8b',40);boss=null;updateHud();finish(true);return}
   }
 }
 updateHud()}
function spawnBoss(){
 boss={x:Math.max(900,Math.min(WORLD-260,player.x+430)),y:GROUND-144,w:192,h:144,hp:12,maxHp:12,dir:-1,phase:0,hit:0,vy:0,onGround:true,jumpTimer:1.0,chargeState:'idle',chargeTimer:2.0,chargeDir:-1,attackFlash:0};
 bossIntro=2.0;
 score+=500;
 updateHud();
}
function enemyScore(t){return {slime:100,pinkslime:140,bat:160,goblin:220,wizard:260,golem:400}[t]||100}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*250;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:.35+Math.random()*.5,color,r:2+Math.random()*5,star:Math.random()>.58})}}
function updateHud(){if(!player)return;$('hp-fill').style.width=`${Math.max(0,player.hp)/5*100}%`;$('hp-text').textContent='♥ '.repeat(Math.max(0,player.hp))||'♡';$('score').textContent=`✦ ${String(score).padStart(5,'0')}`;const remaining=enemies?.filter(e=>e.alive).length||0;$('enemy-count').textContent=boss?`BOSS: GIANT SLIME × ${boss.hp}`:`ENEMIES × ${remaining}`}
function update(dt){time+=dt;attackCooldown=Math.max(0,attackCooldown-dt);player.attack=Math.max(0,player.attack-dt);player.invuln=Math.max(0,player.invuln-dt);player.hurt=Math.max(0,player.hurt-dt);jumpBuffer=Math.max(0,jumpBuffer-dt);if(!player.onGround)coyoteTime=Math.max(0,coyoteTime-dt);const dir=(keys.right?1:0)-(keys.left?1:0);
 if(dir){player.vx=dir*255;player.face=dir}else player.vx*=Math.pow(.0008,dt);player.x=Math.max(0,Math.min(WORLD-player.w,player.x+player.vx*dt));player.vy+=1280*dt;player.y+=player.vy*dt;if(player.y+player.h>=GROUND){player.y=GROUND-player.h;player.vy=0;player.onGround=true;coyoteTime=.12;if(jumpBuffer>0)performJump()}else{if(player.onGround)coyoteTime=.12;player.onGround=false}
 if(dir&&player.onGround){footstepTimer-=dt;if(footstepTimer<=0){footstepTimer=.09;const fx=player.x+player.w/2-player.face*10;for(let i=0;i<2;i++)particles.push({x:fx+(Math.random()-.5)*14,y:GROUND-3,vx:-player.face*(30+Math.random()*70),vy:-18-Math.random()*35,life:.16+Math.random()*.16,color:i?'#fff':'#b6f5ff',r:2+Math.random()*3,star:false})}}else footstepTimer=0;
 camera=Math.max(0,Math.min(WORLD-W,player.x-W*.34));
 for(const e of enemies){if(!e.alive)continue;e.phase+=dt*5;e.hit=Math.max(0,e.hit-dt);e.attack=Math.max(0,e.attack-dt);const dx=player.x-e.x;if(Math.abs(dx)<360)e.dir=Math.sign(dx)||e.dir;else e.dir=Math.sin(e.phase*.35)>0?1:-1;
 let move=e.speed;if(e.type==='bat'){e.y=GROUND-112+Math.sin(e.phase*1.8)*35;move*=.7}else if(e.type==='slime'||e.type==='pinkslime'){e.jumpTimer-=dt;if(e.onGround&&e.jumpTimer<=0){e.vy=-(255+(e.type==='pinkslime'?28:0));e.onGround=false;e.jumpTimer=.85+Math.random()*.8;burst(e.x+e.w/2,GROUND-3,'#c8fff1',3)}e.vy+=900*dt;e.y+=e.vy*dt;if(e.y+e.h>=GROUND){e.y=GROUND-e.h;e.vy=0;e.onGround=true}}else if(e.type==='wizard'){move*=.5;if(Math.abs(dx)<250&&e.attack<=0){e.attack=1.8;magicEffects.push({type:'enemybolt',x:e.x,y:e.y+25,life:.8,max:.8,face:Math.sign(dx)||-1,vx:(Math.sign(dx)||-1)*240})}}else if(e.type==='golem'){
   // Heavy golems normally lumber forward, then suddenly charge toward Nya-san.
   // Telegraph briefly so the dash feels intentional rather than random.
   e.chargeTimer-=dt;
   if(e.chargeState==='idle' && Math.abs(dx)<330 && e.chargeTimer<=0){
     e.chargeState='windup'; e.chargeTimer=.32; e.chargeDir=Math.sign(dx)||e.dir; sfxBossCharge(); burst(e.x+e.w/2,e.y+12,'#fff19a',8);
   } else if(e.chargeState==='windup' && e.chargeTimer<=0){
     e.chargeState='charge'; e.chargeTimer=.48; e.chargeDir=Math.sign(dx)||e.dir;
     burst(e.x+e.w/2,GROUND-6,'#d6f5ff',10);
   } else if(e.chargeState==='charge' && e.chargeTimer<=0){
     e.chargeState='idle'; e.chargeTimer=1.4+Math.random()*1.2;
   }
   if(e.chargeState==='windup') move=0;
   else if(e.chargeState==='charge') move=520;
   else move*=.42;
 }
 e.x+=e.chargeState==='charge'?e.chargeDir*move*dt:e.dir*move*dt;e.x=Math.max(0,Math.min(WORLD-e.w,e.x));if(player.invuln<=0&&Math.abs(player.x+player.w/2-(e.x+e.w/2))<Math.max(34,e.w*.75)&&Math.abs(player.y+player.h-(e.y+e.h))<70){player.hp--;sfxDamage();player.invuln=1.15;player.hurt=.42;player.attack=0;player.vx=-player.face*150;burst(player.x+player.w/2,player.y+55,'#ff8da5',14);updateHud();if(player.hp<=0){finish(false);return}}}
 if(!boss && defeated===enemies.length && defeated>0){spawnBoss();}
 if(boss){
   bossIntro=Math.max(0,bossIntro-dt); boss.hit=Math.max(0,boss.hit-dt); boss.attackFlash=Math.max(0,boss.attackFlash-dt); boss.phase+=dt*4;
   const bdx=player.x-boss.x; boss.dir=Math.sign(bdx)||boss.dir;
   if(bossIntro<=0){
     boss.chargeTimer-=dt;
     if(boss.chargeState==='idle' && boss.onGround && boss.chargeTimer<=0 && Math.abs(bdx)<430){
       boss.chargeState='windup'; boss.chargeTimer=.80; boss.chargeDir=Math.sign(bdx)||boss.dir;
       sfxBossCharge(); burst(boss.x+boss.w/2,GROUND-8,'#fff19a',16);
     }else if(boss.chargeState==='windup' && boss.chargeTimer<=0){
       boss.chargeState='charge'; boss.chargeTimer=.58; boss.chargeDir=Math.sign(bdx)||boss.dir;
       burst(boss.x+boss.w/2,GROUND-10,'#d6f5ff',18);
     }else if(boss.chargeState==='charge' && boss.chargeTimer<=0){
       boss.chargeState='idle'; boss.chargeTimer=2.0+Math.random()*2.2;
     }
     if(boss.chargeState==='windup'){
       boss.vy+=1100*dt; boss.y+=boss.vy*dt;
     }else{
       if(boss.onGround){
         boss.jumpTimer-=dt;
         if(boss.jumpTimer<=0){
           boss.vy=-(470+Math.random()*55); boss.onGround=false; boss.jumpTimer=1.0+Math.random()*1.1;
           burst(boss.x+boss.w/2,GROUND-6,'#c8fff1',9);
         }
       }
       boss.vy+=1100*dt; boss.y+=boss.vy*dt;
       if(boss.chargeState==='charge') boss.x+=boss.chargeDir*392*dt;
       else boss.x+=boss.dir*58*dt;
     }
     if(boss.y+boss.h>=GROUND){boss.y=GROUND-boss.h;boss.vy=0;boss.onGround=true}
     else boss.onGround=false;
     boss.x=Math.max(520,Math.min(WORLD-boss.w-40,boss.x));
     if(player.invuln<=0&&Math.abs(player.x+player.w/2-(boss.x+boss.w/2))<Math.max(65,boss.w*.55)&&Math.abs(player.y+player.h-(boss.y+boss.h))<92){
       player.hp--;sfxDamage();player.invuln=1.15;player.hurt=.42;player.attack=0;player.vx=-boss.dir*180;
       burst(player.x+player.w/2,player.y+55,'#ff8da5',18);updateHud();if(player.hp<=0){finish(false);return}
     }
   }
 }
 for(const fx of magicEffects){fx.life-=dt;if(fx.type==='enemybolt'){fx.x+=fx.vx*dt;if(Math.abs(fx.x-player.x)<25&&Math.abs(fx.y-(player.y+55))<55&&player.invuln<=0){player.hp--;sfxDamage();player.invuln=1.1;player.hurt=.42;player.attack=0;burst(player.x+25,player.y+55,'#ff8da5',10);updateHud();if(player.hp<=0){finish(false);return}}}}
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;p.vx*=Math.pow(.94,dt*10);p.life-=dt}particles=particles.filter(p=>p.life>0);magicEffects=magicEffects.filter(f=>f.life>0);
 if(!boss && defeated===enemies.length&&defeated>0){spawnBoss();}if(Math.floor(time*2)%2===0)updateHud()}
function drawBackground(){
 // Night-time city stage: layered skyline, moon, neon signs, street lamps and asphalt.
 const sky=ctx.createLinearGradient(0,0,0,H);
 sky.addColorStop(0,'#070d2b');sky.addColorStop(.48,'#142d62');sky.addColorStop(1,'#244b76');
 ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // Stars
 ctx.fillStyle='#ffffffcc';
 for(let i=0;i<42;i++){const x=((i*173-camera*.06)%(W+30)+W+30)%(W+30),y=18+(i*47)%210;const r=(i%3)+.7;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
 // Moon and halo
 const g=ctx.createRadialGradient(795,82,8,795,82,75);g.addColorStop(0,'#fffbdc88');g.addColorStop(1,'#fffbdc00');ctx.fillStyle=g;ctx.fillRect(720,5,150,155);
 ctx.fillStyle='#fff8d9';ctx.beginPath();ctx.arc(795,82,42,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#d5d9d0';for(const [dx,dy,r] of [[-13,-10,5],[10,8,4],[-4,15,3],[16,-15,3]]){ctx.beginPath();ctx.arc(795+dx,82+dy,r,0,Math.PI*2);ctx.fill()}
 // Far skyline: complete, solid silhouettes with no rooftop props.
 const farBuildings=[[0,120],[72,170],[156,132],[232,205],[324,148],[406,188],[500,128],[578,214],[676,156],[760,192],[854,142],[946,220]];
 for(let i=0;i<farBuildings.length;i++){
   const [baseX,bh]=farBuildings[i],bx=Math.floor(baseX-camera*.12);
   ctx.fillStyle=i%2?'#101b3c':'#0d1837';ctx.fillRect(bx,GROUND-115-bh,88,bh);
 }
 // Mid skyline: fixed complete buildings; only individual windows vary between lit/dark.
 const midBuildings=[[0,178,104],[112,132,88],[208,214,96],[316,154,110],[438,196,92],[542,146,108],[662,222,96],[770,164,112],[894,204,92],[1000,150,110]];
 for(let i=0;i<midBuildings.length;i++){
   const [baseX,bh,bw]=midBuildings[i],bx=Math.floor(baseX-camera*.24),top=GROUND-120-bh;
   ctx.fillStyle=i%2?'#162b54':'#1b315c';ctx.fillRect(bx,top,bw,bh);
   let row=0;
   for(let wy=top+18;wy<GROUND-135;wy+=22,row++){
     let col=0;
     for(let wx=bx+13;wx<bx+bw-8;wx+=21,col++){
       const lit=((i*17+row*7+col*11)%13)!==0;
       if(lit){ctx.fillStyle=(row+col+i)%5===0?'#ffe59a99':'#ffd96a99';ctx.fillRect(Math.floor(wx),Math.floor(wy),7,9)}
     }
   }
 }
 // Street-level storefronts and neon panels
 ctx.fillStyle='#0d1b34';ctx.fillRect(0,GROUND-122,W,122);
 for(let i=0;i<9;i++){
   const bx=i*118-(camera*.45%118);
   ctx.fillStyle=i%2?'#142746':'#10223e';ctx.fillRect(bx,GROUND-108,104,96);
   ctx.fillStyle=i%3===0?'#4eeaff':'#ff72c8';ctx.fillRect(bx+12,GROUND-92,78,8);
   ctx.fillStyle='#ffffff30';ctx.fillRect(bx+14,GROUND-70,34,35);ctx.fillRect(bx+55,GROUND-70,30,35);
 }
 // Sidewalk / road
 ctx.fillStyle='#4b5365';ctx.fillRect(0,GROUND-12,W,12);
 ctx.fillStyle='#242a38';ctx.fillRect(0,GROUND,W,H-GROUND);
 // Road markings
 ctx.fillStyle='#d7c76b';for(let x=-(camera%110);x<W;x+=110)ctx.fillRect(x,GROUND+39,62,4);
 // Lamps
 for(let i=0;i<7;i++){
   const x=i*170-(camera*.65%170)+45;
   ctx.fillStyle='#111827';ctx.fillRect(x,GROUND-115,5,103);ctx.fillRect(x-12,GROUND-117,29,5);
   ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#ffeaa0';ctx.fillStyle='#fff2ad';ctx.beginPath();ctx.arc(x+2,GROUND-108,7,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 // Crosswalk-ish foreground detail
 ctx.fillStyle='#ffffff22';for(let x=-(camera%55);x<W;x+=55)ctx.fillRect(x,GROUND+72,28,3);
}
function drawEnemySprite(e){
 const frames=enemyFrames[e.type]||[]; if(!frames.length)return;
 const img=frames[Math.floor(time*(e.type==='slime'||e.type==='pinkslime'?8:5))%frames.length];
 const x=e.x-camera,y=e.y,drawW=e.w*e.spriteScale,drawH=e.h*e.spriteScale;
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=e.hit>0?.55:1;
 // Anchor the visible alpha pixels, not the transparent source canvas, to the ground.
 // This removes the small floating gap that was especially noticeable on slimes.
 const groundBottomRatio={slime:.766,pinkslime:.766,bat:.719,goblin:.891,wizard:.828,golem:.875}[e.type]||.8;
 const bottom=e.y+e.h;
 const imageTop=bottom-drawH*groundBottomRatio;
 ctx.translate(x+e.w/2+(e.dir<0?-2:2),0);
 if(e.dir<0)ctx.scale(-1,1);
 ctx.drawImage(img,-drawW/2,imageTop,drawW,drawH);
 ctx.restore();
}
function drawEnemy(e){
 drawEnemySprite(e);
}
function drawBoss(){
 const frames=enemyFrames.slime;
 const img=frames[Math.floor(time*8)%frames.length];
 const x=boss.x-camera,y=boss.y;
 const windup=boss.chargeState==='windup';
 const squash=windup?1.18:(boss.onGround?1+Math.sin(boss.phase)*.04:1);
 const drawW=250*squash,drawH=190/squash;
 // The source slime frames have different transparent bottoms; anchor each frame's
 // actual opaque pixels directly to the floor so the giant slime never floats.
 const slimeBottomRatios=[90,92,98,90].map(v=>v/128);
 const frameIndex=Math.floor(time*8)%frames.length;
 const bottomRatio=slimeBottomRatios[frameIndex]||.703125;
 const imageTop=(y+boss.h)-drawH*bottomRatio;
 ctx.save();
 ctx.globalAlpha=boss.hit>0?0.58:1;
 ctx.imageSmoothingEnabled=false;
 if(windup){
   ctx.globalCompositeOperation='lighter';
   ctx.globalAlpha=.28+Math.sin(time*22)*.08;
   ctx.shadowBlur=24;ctx.shadowColor='#fff19a';
   ctx.fillStyle='#fff19a';ctx.beginPath();ctx.ellipse(x+boss.w/2,GROUND-8,82,12,0,0,Math.PI*2);ctx.fill();
   ctx.globalCompositeOperation='source-over';
 }
 if(boss.dir<0){ctx.translate(x+boss.w/2+drawW*.1,imageTop);ctx.scale(-1,1);ctx.drawImage(img,-drawW/2,0,drawW,drawH)}
 else ctx.drawImage(img,x+boss.w/2-drawW/2,imageTop,drawW,drawH);
 ctx.restore();
 // Boss shadow
 ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(x+boss.w/2,GROUND+4,78,12,0,0,Math.PI*2);ctx.fill();
 // Boss HP bar
 const bw=260,bh=12,bx=W/2-bw/2,by=42;
 ctx.fillStyle='#10152e';ctx.fillRect(bx-3,by-3,bw+6,bh+6);
 ctx.fillStyle='#e94f7b';ctx.fillRect(bx,by,bw*(boss.hp/boss.maxHp),bh);
 ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,bh);
 ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('GIANT SLIME',W/2,34);
 if(bossIntro>0){ctx.fillStyle='#fff';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.shadowBlur=12;ctx.shadowColor='#73f5ff';ctx.fillText('GIANT SLIME!',W/2,150);ctx.shadowBlur=0}
}
function drawPlayer(){
 const x=player.x-camera,y=player.y,moving=(keys.left||keys.right)&&player.onGround;
 ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(x+player.w/2,GROUND+3,35,7,0,0,Math.PI*2);ctx.fill();
 if(player.invuln>0&&Math.floor(time*16)%2===0)return;
 let img=idleFrames[0]||runFrames[0],targetH=160;
 if(player.hurt>0){const idx=Math.min(3,Math.floor((.42-player.hurt)/.105));img=hitFrames[idx]||hitFrames[3];targetH=158}
 else if(player.attack>0){const idx=Math.min(3,Math.floor((time-player.attackStarted)/.135));img=attackFrames[idx]||attackFrames[3];targetH=156}
 else if(!player.onGround){const elapsed=Math.max(0,time-player.jumpStarted);const idx=Math.min(4,Math.floor(elapsed/.12));img=jumpFrames[idx]||jumpFrames[4];targetH=158}
 else if(moving){
   // Run animation: frame 04 stays on screen an extra 0.2s for a slightly longer stride/pose.
   const runDurations=[1/12,1/12,1/12,1/12+0.2,1/12,1/12];
   const runTotal=runDurations.reduce((a,b)=>a+b,0);
   let t=(time%runTotal),idx=0;
   for(let i=0;i<runDurations.length;i++){if(t<runDurations[i]){idx=i;break}t-=runDurations[i];idx=i}
   img=runFrames[idx]||runFrames[0];targetH=160
}
 else {img=idleFrames[0]||runFrames[0];targetH=160}
 // All hero states are normalized to the same 220x260 canvas and the same
 // visible character height. The opaque pixels occupy a 155px-tall band with
 // their feet fixed at source Y=228. This prevents jump frames from looking
 // larger and attack/hit frames from looking shorter. The common canvas also
 // leaves generous headroom so the apex frames never get clipped.
 const apexFrame=(!player.onGround && !player.hurt && !player.attack) ? Math.min(4,Math.floor(Math.max(0,time-player.jumpStarted)/.12)) : -1;
 const spriteScale=(apexFrame===2)?1.08:1;
 const drawW=180*spriteScale,drawH=(260/220)*drawW;
 const visibleBottomOffset=(228/260)*drawH;
 const bottom=player.y+player.h;
 ctx.save();
 ctx.translate(x+player.w/2+(player.face<0?4:-4),bottom);
 if(player.face<0)ctx.scale(-1,1);
 ctx.imageSmoothingEnabled=false;
 // All grounded states share the same bottom anchor. Attack toe tips are reinforced in the source art so the boot ends remain visible at game scale without changing the ground position.
 const stateBottomNudge=0;
 ctx.drawImage(img,-drawW/2,-visibleBottomOffset+stateBottomNudge,drawW,drawH);
 ctx.restore();
 if(player.attack>0){const p=1-player.attack/.54,cx=x+player.w/2+player.face*65,cy=player.y+player.h-78;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,p*3);ctx.translate(cx,cy);ctx.scale(player.face,1);ctx.shadowBlur=25;ctx.shadowColor='#73f5ff';ctx.strokeStyle='#fff7a0';ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,48+p*30,-1.35,1.05);ctx.stroke();ctx.restore()}}
function drawMagicEffects(){for(const f of magicEffects){const p=1-f.life/f.max,x=f.x-camera,y=f.y;ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.max(0,1-p);if(f.type==='nova'){const r=20+p*78;ctx.shadowBlur=30;ctx.shadowColor='#6ff5ff';for(let j=0;j<3;j++){ctx.strokeStyle=['#73f5ff','#fff29b','#ff9de8'][j];ctx.lineWidth=5-j;ctx.beginPath();ctx.arc(0,0,r*(.62+j*.17),-1+p*2,2+p*2);ctx.stroke()}for(let i=0;i<10;i++){const a=i*Math.PI/5+p;ctx.fillStyle=i%2?'#fff':'#73f5ff';ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,3+Math.sin(p*8+i)*1.5,0,Math.PI*2);ctx.fill()}}
 else if(f.type==='beam'){ctx.scale(f.face,1);ctx.shadowBlur=30;ctx.shadowColor='#fff';ctx.strokeStyle='#fff7a5';ctx.lineWidth=18*(1-p)+2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(140*(p+.15),-8);ctx.stroke();ctx.strokeStyle='#6ff5ff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(150*(p+.15),-8);ctx.stroke()}
 else if(f.type==='impact'){ctx.strokeStyle='#fff7a0';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,12+p*45,0,Math.PI*2);ctx.stroke()}
 else if(f.type==='enemybolt'){ctx.fillStyle='#d783ff';ctx.shadowBlur=18;ctx.shadowColor='#d783ff';ctx.beginPath();ctx.arc(0,0,10+Math.sin(p*12)*2,0,Math.PI*2);ctx.fill()}
 ctx.restore()}}
function drawParticles(){for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.8);ctx.fillStyle=p.color;ctx.shadowBlur=p.star?12:0;ctx.shadowColor=p.color;ctx.beginPath();if(p.star){ctx.moveTo(p.x-camera,p.y-p.r*2);ctx.lineTo(p.x-camera+p.r*.6,p.y-p.r*.5);ctx.lineTo(p.x-camera+p.r*2,p.y);ctx.lineTo(p.x-camera+p.r*.6,p.y+p.r*.5);ctx.lineTo(p.x-camera,p.y+p.r*2);ctx.lineTo(p.x-camera-p.r*.6,p.y+p.r*.5);ctx.lineTo(p.x-camera-p.r*2,p.y);ctx.lineTo(p.x-camera-p.r*.6,p.y-p.r*.5)}else ctx.arc(p.x-camera,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.shadowBlur=0}
function draw(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);const ox=(canvas.width-W*scale)/2,oy=(canvas.height-H*scale)/2;ctx.setTransform(scale,0,0,scale,ox,oy);drawBackground();for(const e of enemies)if(e.alive)drawEnemy(e);if(boss)drawBoss();drawPlayer();drawMagicEffects();drawParticles()}
function loop(now){if(!running)return;const dt=Math.min(.032,(now-last)/1000||0);last=now;update(dt);draw();if(running)requestAnimationFrame(loop)}
reset();function idle(now){if(!running){time=now/1000;draw()}requestAnimationFrame(idle)}requestAnimationFrame(idle);
})();
