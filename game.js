(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const W=960,H=600,keys={},mouse={x:480,y:300,down:false};
let state='menu',last=0,worldTime=0,toastTimer=0,sound=true,audioCtx=null;
const missions=[
 {title:'01 / ТИХИЙ ВХОД',desc:'Доберись до ломбарда и забери сумку.',objective:'ЦЕЛЬ: НАЙТИ ЛОМБАРД',radio:'«Рэй, за дверью ломбард. Забери пакет и не устраивай фейерверк. Хотя кого я обманываю…»'},
 {title:'02 / ГРОМКИЙ ВЫХОД',desc:'Уходи от копов. Доберись до синего гаража.',objective:'ЦЕЛЬ: ДОБРАТЬСЯ ДО ГАРАЖА',radio:'«Полиция уже едет. В гараже ключи от тачки. Не бросай сумку, Рэй!»'},
 {title:'03 / ПОСЛЕДНИЙ РЕЙС',desc:'Найди тайник на набережной. Это твой выход.',objective:'ЦЕЛЬ: ДОБРАТЬСЯ ДО ТАЙНИКА',radio:'«Последняя точка — набережная. Забираешь долю и исчезаешь. Мы никогда не встречались». '}
];
let game={player:{x:145,y:300,hp:100,angle:0,speed:2.4},cash:0,heat:0,mission:0,progress:0,bag:false,dead:false,won:false,shots:[],enemies:[],particles:[],buildings:[],roadMarks:[],lastDamage:0,elapsed:0};
const targets=[{x:775,y:145,r:27,label:'ЛОМБАРД',color:'#ff3d91'},{x:770,y:470,r:27,label:'ГАРАЖ',color:'#36f4e8'},{x:160,y:100,r:27,label:'ТАЙНИК',color:'#ffcf5a'}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function initWorld(){
 game.buildings=[];
 const blocks=[[20,20,175,110],[235,20,180,110],[465,20,180,110],[730,20,205,90],[20,455,175,120],[240,455,170,120],[460,455,190,120],[740,455,195,120],[20,190,115,205],[825,185,110,220]];
 for(const [x,y,w,h] of blocks)game.buildings.push({x,y,w,h});
 game.enemies=[];for(let i=0;i<5;i++)game.enemies.push({x:500+(i%3)*75,y:230+Math.floor(i/3)*95,hp:2,speed:.65+Math.random()*.25,fire:Math.random()*2});
}
function reset(){game={player:{x:145,y:300,hp:100,angle:0,speed:2.4},cash:0,heat:0,mission:0,progress:0,bag:false,dead:false,won:false,shots:[],enemies:[],particles:[],buildings:[],roadMarks:[],lastDamage:0,elapsed:0};initWorld();updateUI();}
function beep(freq=440,dur=.06,type='square'){if(!sound)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch(e){}}
function notify(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1900)}
function save(){const data={version:1,cash:game.cash,heat:game.heat,mission:game.mission,progress:game.progress,bag:game.bag,player:{x:game.player.x,y:game.player.y,hp:game.player.hp},elapsed:game.elapsed};localStorage.setItem('neonAfterhoursSave',JSON.stringify(data));$('savedMark').textContent='●';notify('ПРОГРЕСС СОХРАНЁН');}
function load(data){try{const d=data||JSON.parse(localStorage.getItem('neonAfterhoursSave'));if(!d)throw Error();reset();game.cash=d.cash||0;game.heat=d.heat||0;game.mission=clamp(d.mission||0,0,2);game.progress=d.progress||0;game.bag=!!d.bag;game.player.x=d.player?.x||145;game.player.y=d.player?.y||300;game.player.hp=d.player?.hp||100;game.elapsed=d.elapsed||0;state='play';$('startScreen').classList.add('hidden');$('pauseScreen').classList.add('hidden');$('gameoverScreen').classList.add('hidden');updateUI();notify('СОХРАНЕНИЕ ЗАГРУЖЕНО');}catch(e){notify('СОХРАНЕНИЕ НЕ НАЙДЕНО');}}
function updateUI(){const m=missions[game.mission];$('cash').textContent='$ '+String(game.cash).padStart(4,'0');$('health').textContent=Math.ceil(game.player.hp)+'%';$('heat').textContent='★'.repeat(game.heat)+'☆'.repeat(5-game.heat);$('missionTitle').textContent=m.title;$('missionText').textContent=m.desc;$('objective').textContent=m.objective;$('radio').textContent=m.radio;$('progress').style.width=(game.progress*100)+'%';}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function draw(){
 ctx.clearRect(0,0,W,H);rect(0,0,W,H,'#11182a');
 // city grid / asphalt
 rect(0,150,W,300,'#202238');rect(180,0,55,H,'#29283d');rect(420,0,45,H,'#29283d');rect(650,0,80,H,'#29283d');
 ctx.strokeStyle='#55516a';ctx.lineWidth=2;ctx.setLineDash([18,18]);ctx.beginPath();ctx.moveTo(0,300);ctx.lineTo(W,300);ctx.moveTo(450,0);ctx.lineTo(450,H);ctx.stroke();ctx.setLineDash([]);
 // neon street edges
 ctx.strokeStyle='#3a3558';ctx.lineWidth=2;ctx.strokeRect(0,150,W,300);
 for(const b of game.buildings){rect(b.x+7,b.y+9,b.w,b.h,'#090b16');rect(b.x,b.y,b.w,b.h,'#303049');rect(b.x+5,b.y+5,b.w-10,b.h-10,'#1b1c31');ctx.strokeStyle='#55506e';ctx.strokeRect(b.x+5,b.y+5,b.w-10,b.h-10);
  for(let x=b.x+15;x<b.x+b.w-10;x+=28)for(let y=b.y+15;y<b.y+b.h-8;y+=24){rect(x,y,10,7,((x+y)%3<1)?'#e64c9a':'#4b8d9a');}}
 // target beacon
 const t=targets[game.mission];if(t){ctx.save();ctx.translate(t.x,t.y);ctx.globalAlpha=.35+Math.sin(worldTime*4)*.18;ctx.strokeStyle=t.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,38+Math.sin(worldTime*3)*5,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle=t.color;ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(t.label,t.x,t.y-43);}
 // target interaction distance
 // enemies
 for(const e of game.enemies){if(e.hp<=0)continue;ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle='#ff4e75';ctx.shadowColor='#ff315f';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#260e23';ctx.fillRect(-5,-3,10,4);ctx.restore();}
 // shots
 for(const s of game.shots){ctx.fillStyle=s.enemy?'#ff526e':'#fff3a0';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(s.x,s.y,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
 // particles
 for(const p of game.particles){ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
 // player
 const p=game.player;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.shadowColor='#36f4e8';ctx.shadowBlur=16;ctx.fillStyle='#36f4e8';ctx.fillRect(-9,-8,18,16);ctx.fillStyle='#102c36';ctx.fillRect(1,-5,12,10);ctx.fillStyle='#ff3d91';ctx.fillRect(-6,-5,5,10);ctx.restore();
 // minimap
 ctx.fillStyle='#090b17cc';ctx.fillRect(815,12,130,80);ctx.strokeStyle='#55506e';ctx.strokeRect(815,12,130,80);ctx.fillStyle='#777';ctx.fillRect(820,45,120,15);ctx.fillRect(865,15,10,70);ctx.fillStyle='#ff3d91';ctx.fillRect(820+game.player.x/W*120-2,45+game.player.y/H*35-2,5,5);ctx.fillStyle='#36f4e8';ctx.font='8px monospace';ctx.fillText('DISTRICT 04',823,25);
 // interaction hint
 const target=targets[game.mission];if(target&&dist(p,target)<70){ctx.fillStyle='#fff';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('НАЖМИ E',target.x,target.y+55);}
}
function blocked(x,y){return game.buildings.some(b=>x>b.x-10&&x<b.x+b.w+10&&y>b.y-10&&y<b.y+b.h+10)}
function shoot(){const p=game.player;game.shots.push({x:p.x+Math.cos(p.angle)*15,y:p.y+Math.sin(p.angle)*15,vx:Math.cos(p.angle)*8,vy:Math.sin(p.angle)*8,life:55});beep(180,.04);game.heat=clamp(game.heat+0.02,0,5);}
function interact(){const t=targets[game.mission];if(!t||dist(game.player,t)>72){notify('СЛИШКОМ ДАЛЕКО');return;}beep(620,.15,'sine');
 if(game.mission===0){game.cash+=1200;game.bag=true;game.progress=1;game.heat=Math.max(2,game.heat);game.mission=1;game.player.x=700;game.player.y=365;notify('СУМКА У ТЕБЯ. ВАЛИ!');}
 else if(game.mission===1){game.cash+=800;game.progress=1;game.mission=2;game.player.x=230;game.player.y=160;game.heat=1;notify('МАШИНА ЗАВЕДЕНА. ПОСЛЕДНИЙ РЫВОК');}
 else{game.cash+=2500;game.progress=1;game.won=true;state='won';notify('ДЕЛО ЗАКРЫТО. ТЫ СВОБОДЕН.');save();}
 updateUI();save();
}
function update(dt){
 if(state!=='play')return;worldTime+=dt;game.elapsed+=dt;
 const p=game.player;let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);const len=Math.hypot(dx,dy)||1;const speed=p.speed*(keys.shift?1.55:1);
 const nx=clamp(p.x+dx/len*speed*dt*60,12,W-12),ny=clamp(p.y+dy/len*speed*dt*60,12,H-12);if(!blocked(nx,p.y))p.x=nx;if(!blocked(p.x,ny))p.y=ny;
 p.angle=Math.atan2(mouse.y-p.y,mouse.x-p.x);
 if(mouse.down&&Math.random()<.22)shoot();
 // enemy AI
 for(const e of game.enemies){if(e.hp<=0)continue;const d=dist(e,p);if(d<330){const a=Math.atan2(p.y-e.y,p.x-e.x);e.x+=Math.cos(a)*e.speed*dt*60;e.y+=Math.sin(a)*e.speed*dt*60;e.fire-=dt;if(e.fire<=0&&d<270){game.shots.push({x:e.x,y:e.y,vx:Math.cos(a)*3.2,vy:Math.sin(a)*3.2,life:95,enemy:true});e.fire=1.5+Math.random();}}}
 for(const s of game.shots){s.x+=s.vx*dt*60;s.y+=s.vy*dt*60;s.life--;if(!s.enemy){for(const e of game.enemies){if(e.hp>0&&Math.hypot(e.x-s.x,e.y-s.y)<15){e.hp--;s.life=0;for(let i=0;i<5;i++)game.particles.push({x:e.x,y:e.y,life:1,color:'#ff3d91'});break;}}}else if(Math.hypot(p.x-s.x,p.y-s.y)<15&&game.elapsed-game.lastDamage>.45){p.hp-=9;game.lastDamage=game.elapsed;beep(90,.12);}}
 game.shots=game.shots.filter(s=>s.life>0&&s.x>0&&s.x<W&&s.y>0&&s.y<H);for(const q of game.particles){q.life-=dt*2;q.x+=(Math.random()-.5)*2;q.y+=(Math.random()-.5)*2;}game.particles=game.particles.filter(q=>q.life>0);
 game.heat=Math.max(0,game.heat-dt*.012);p.hp=clamp(p.hp,0,100);if(p.hp<=0){state='dead';$('gameoverScreen').classList.remove('hidden');}
 $('clock').textContent='02:'+String(17+Math.floor(game.elapsed/6)%43).padStart(2,'0')+' AM';$('health').textContent=Math.ceil(p.hp)+'%';$('heat').textContent='★'.repeat(Math.ceil(game.heat))+'☆'.repeat(5-Math.ceil(game.heat));
 if(Math.floor(game.elapsed)%12===0&&Math.floor(game.elapsed)!==game._lastAuto){game._lastAuto=Math.floor(game.elapsed);save();}
}
function loop(ts){const dt=Math.min((ts-last)/1000||0,.04);last=ts;update(dt);draw();requestAnimationFrame(loop)}
function start(){if(state==='menu'||state==='dead'){reset();}state='play';$('startScreen').classList.add('hidden');$('pauseScreen').classList.add('hidden');$('gameoverScreen').classList.add('hidden');notify('НОЧЬ НАЧИНАЕТСЯ');}
$('startBtn').onclick=start;$('retryBtn').onclick=start;$('resumeBtn').onclick=()=>{state='play';$('pauseScreen').classList.add('hidden')};
$('saveBtn').onclick=save;$('loadBtn').onclick=()=>load();$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent='ЗВУК: '+(sound?'ВКЛ':'ВЫКЛ')};
$('saveFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{load(JSON.parse(r.result));}catch(err){notify('ОШИБКА ФАЙЛА');}};r.readAsText(f);};
document.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key==='Escape'&&state==='play'){state='pause';$('pauseScreen').classList.remove('hidden')}else if(e.key.toLowerCase()==='e'&&state==='play')interact();});
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*W;mouse.y=(e.clientY-r.top)/r.height*H;});
canvas.addEventListener('mousedown',()=>mouse.down=true);window.addEventListener('mouseup',()=>mouse.down=false);
canvas.addEventListener('touchmove',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),t=e.touches[0];mouse.x=(t.clientX-r.left)/r.width*W;mouse.y=(t.clientY-r.top)/r.height*H;},{passive:false});
$('startScreen').classList.remove('hidden');initWorld();updateUI();requestAnimationFrame(loop);
})();