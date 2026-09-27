import { createWorld } from './world.js';
import { createTimeline, clamp } from './timeline.js';
import { setupUI } from './ui.js';

setupUI();
const timeline = createTimeline();
const canvas = document.querySelector('#world-canvas');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = preference.matches, paused = reduced;
let world;
try { world = createWorld(canvas); canvas.dataset.renderer = 'three-webgl'; }
catch(error) { console.error('WebGL unavailable:', error); document.querySelector('#render-notice').hidden = false; canvas.dataset.renderer = 'fallback'; }
const pointer = { x: 0, y: 0 }, targetPointer = { x: 0, y: 0 };
// Vector-like interface is intentionally small; Three uniforms copy x/y.
let active = 0, targetActive = 0, p = 0, clock = 0, previous = 0, raf = 0;
let frames = 0, fpsElapsed = 0, measuredFps = 0;
const button = document.querySelector('#motion-toggle');
let lastRenderedP = -1;
function updateToggle(){
  document.body.classList.toggle('motion-paused', paused);
  button.setAttribute('aria-pressed', String(paused));
  button.setAttribute('aria-label', paused ? 'Включить анимацию' : 'Приостановить анимацию');
  button.textContent = paused ? '▷' : 'Ⅱ';
}
button.addEventListener('click',()=>{paused=!paused;updateToggle();});
preference.addEventListener('change',event=>{reduced=event.matches;paused=reduced;updateToggle();});
addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  targetPointer.x=event.clientX/innerWidth*2-1;
  targetPointer.y=1-event.clientY/innerHeight*2;
  targetActive=1;
},{passive:true});
document.addEventListener('pointerleave',()=>{targetActive=0;targetPointer.x=0;targetPointer.y=0;});
addEventListener('blur',()=>{targetActive=0;});
function resize(){timeline.resize();world?.resize();lastRenderedP=-1;}
addEventListener('resize',resize,{passive:true});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();world=null;canvas.dataset.renderer='fallback';document.querySelector('#render-notice').hidden=false;
});
function frame(now){
  raf=0;
  if(document.hidden){previous=0;return;}
  const dt=previous?Math.min((now-previous)/1000,.06):1/60;previous=now;
  const target=clamp(scrollY/timeline.length);
  const oldP=p;
  p+= (target-p)*(reduced?1:1-Math.exp(-dt*7.5));
  if(Math.abs(target-p)<.000005)p=target;
  const ease=1-Math.exp(-dt*5.8);
  if(!paused){clock+=dt;pointer.x+=(targetPointer.x-pointer.x)*ease;pointer.y+=(targetPointer.y-pointer.y)*ease;active+=(targetActive-active)*ease;}
  timeline.update(p,pointer,reduced);
  if(!paused||Math.abs(p-lastRenderedP)>.00001){
    const result=world?.update(p,clock,pointer,active,dt,reduced);
    if(result){
      // DOM-only telemetry makes manual QA observable without a hidden control API.
      canvas.dataset.cameraZ=result.cameraZ.toFixed(3);
      canvas.dataset.shape=result.shape.toFixed(3);
      canvas.dataset.attraction=result.attraction.toFixed(3);
      canvas.dataset.pointer=`${pointer.x.toFixed(3)},${pointer.y.toFixed(3)}`;
      canvas.dataset.points=String(result.points);
    }
    lastRenderedP=p;
  }
  canvas.dataset.progress=p.toFixed(5);
  frames++;fpsElapsed+=dt;
  if(fpsElapsed>1){measuredFps=Math.round(frames/fpsElapsed);canvas.dataset.fps=String(measuredFps);frames=0;fpsElapsed=0;}
  document.querySelector('#scan-x').textContent=((pointer.x+1)*.5).toFixed(3);
  document.querySelector('#scan-y').textContent=((pointer.y+1)*.5).toFixed(3);
  if(oldP===0&&p===0&&clock>.12)document.body.classList.add('ready');
  raf=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!raf){previous=0;raf=requestAnimationFrame(frame);}});
updateToggle();
if(location.hash){const a=timeline.anchors.find(e=>'#'+e.id===location.hash);if(a){timeline.navigate(Number(a.dataset.stop),true);p=Number(a.dataset.stop);}}
raf=requestAnimationFrame(frame);
// Also dismiss the loading cover when reduced motion or a deep link is active.
setTimeout(()=>document.body.classList.add('ready'),350);
