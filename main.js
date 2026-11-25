import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SCENES,clamp,ease,eo} from './scenes.js';

const P=new URLSearchParams(location.search);
const JOB=P.get('job'),IDX=parseInt(P.get('i')||'0'),Q=parseFloat(P.get('q')||'0.6');
const STORY=await (await fetch(`/jobs/${JOB}/story.json`)).json();
const SC=STORY.scenes[IDX];const L=SC.lines;const DUR=SC.dur;
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(Math.round(1080*Q),Math.round(1920*Q),false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const env=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(50,1080/1920,.1,400);
const kind=SC.type==='story'?SC.kind:SC.type;
const S=SCENES[kind]({scene,camera,L,env,dur:DUR,spec:SC});
const TH=Object.assign({accent:'#ffb400',bloom:.55,ticker:true,grain:true},STORY.theme||{});if(P.get('bloom')!==null)TH.bloom=parseFloat(P.get('bloom'));
const composer=new EffectComposer(renderer);composer.setPixelRatio(1);composer.setSize(Math.round(1080*Q),Math.round(1920*Q));
composer.addPass(new RenderPass(scene,camera));
if(TH.bloom>0)composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.round(1080*Q),Math.round(1920*Q)),TH.bloom,.65,.72));
composer.addPass(new OutputPass());

/* ---------- overlay engine ---------- */
const hud=document.getElementById('hud');const items=[];
function add(css,html,t0,t1,o={}){const e=document.createElement('div');e.className='el';e.style.cssText='position:absolute;'+css;if(typeof html==='string')e.innerHTML=html;hud.appendChild(e);items.push({e,t0,t1,html,anim:o.anim||'up',inT:o.inT||.45,outT:o.outT||.3,last:null});return e}
const CATC={WORLD:'#ff6b5a',AI:'#6ea8ff','GOLD & SILVER':'#ffc233',MONEY:'#4fe3a0',TECH:'#3fe0d0',NEWS:'#ffb400'};
const catColor=c=>CATC[c]||['#ff9ecb','#b6a3ff','#7fe0ff','#ffd27f'][[...c].reduce((a,x)=>a+x.charCodeAt(0),0)%4];
const card=(k,v,s,col,small)=>`<div style="background:rgba(8,12,24,.74);border:2px solid ${col}66;border-radius:26px;padding:20px 28px"><div style="font-size:24px;letter-spacing:4px;font-weight:800;color:${col};opacity:.95">${esc(k)}</div><div style="font-size:${small?(v.length>34?42:50):(v.length>9?60:78)}px;font-weight:900;line-height:1.08;margin-top:8px;letter-spacing:-1.5px">${esc(v)}</div>${s?`<div style="font-size:26px;color:#b9c1d6;margin-top:8px;line-height:1.25;font-weight:500">${esc(s)}</div>`:''}</div>`;
const Y=1150,ROW='left:56px;width:968px;';
const brandBar=`<span style="display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px;letter-spacing:6px"><i style="width:16px;height:16px;border-radius:50%;background:#ffb400;box-shadow:0 0 18px #ffb400;display:inline-block"></i>${esc(STORY.brand)}</span>`;
add('left:56px;top:70px',brandBar,.2,DUR,{anim:'fade'});
const e=i=>L[i].start+L[i].dur;
const countUp=(v,t,t0)=>{const m=/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(v);if(!m)return v;const raw=m[2].replace(/,/g,''),dec=(raw.split('.')[1]||'').length,end=parseFloat(raw);
  const k=eo(clamp((t-t0)/.9)),val=(end*k).toFixed(dec);const parts=val.split('.');if(m[2].includes(','))parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');return m[1]+parts.join('.')+m[3]};
const acc=SC.type==='story'?catColor(SC.cat):TH.accent;
/* colour tint behind the whole frame, tied to the story category */
document.getElementById('vig').style.background=`radial-gradient(ellipse at 18% 8%,${acc}33 0%,rgba(0,0,0,0) 46%),radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 45%,rgba(0,0,0,.55) 100%),linear-gradient(180deg,rgba(3,4,10,.78) 0%,rgba(3,4,10,0) 24%,rgba(3,4,10,0) 62%,rgba(3,4,10,.82) 100%)`;
/* segmented story progress under the brand bar (same on every video) */
if(SC.type==='story'||SC.type==='also'){const n=STORY.scenes.filter(x=>x.type==='story').length,cur=SC.type==='story'?SC.n:n;
  let h='';for(let i=1;i<=n;i++)h+=`<i style="flex:1;height:6px;border-radius:4px;background:${i<cur?acc+'aa':i===cur?acc:'rgba(255,255,255,.16)'}"></i>`;
  add('left:56px;width:968px;top:118px;display:flex;gap:6px',h,.25,DUR,{anim:'fade'});}
/* news ticker: identical on every video */
if(TH.ticker&&SC.type!=='intro'){const heads=STORY.scenes.filter(x=>x.type==='story').map(x=>x.headline.replace(/\s+/g,' '));
  const txt=(heads.join('   ●   ')+'   ●   ').repeat(3);
  add('left:0;width:1080px;top:1858px;height:62px;background:rgba(5,8,18,.92);border-top:2px solid '+acc+'88;overflow:hidden',`<div id="tk" style="white-space:nowrap;font-size:26px;font-weight:700;color:#cfd6ea;line-height:62px;letter-spacing:.5px"><span style="color:${acc};font-weight:900;letter-spacing:4px;margin-right:24px;background:#05081299;padding-right:10px;position:relative;z-index:2">LIVE BRIEF</span>${esc(txt)}</div>`,.3,DUR,{anim:'fade'});}


if(SC.type==='intro'){
  const m=/(\d{1,2})\s?AM/i.exec(STORY.brand);
  add('left:0;width:1080px;top:690px;text-align:center;font-weight:900;font-size:260px;letter-spacing:-8px;text-shadow:0 0 60px rgba(255,180,0,.6)',m?`0${m[1]}:00`.slice(-5):'',.2,DUR,{anim:'pop',inT:.5});
  add('left:40px;width:1000px;top:1010px;text-align:center;font-weight:900;font-size:'+(STORY.brand.length>14?60:76)+'px;letter-spacing:10px;color:#ffb400',esc(STORY.brand),.8,DUR);
  add('left:0;width:1080px;top:1110px;text-align:center;font-weight:600;font-size:30px;letter-spacing:3px;color:#9aa3b8',esc((STORY.date||'').toUpperCase()+(SC.tagline?' · '+SC.tagline.toUpperCase():'')).slice(0,120),1.1,DUR,{anim:'fade'});
}
if(SC.type==='intro'&&SC.teasers&&L[1]){SC.teasers.forEach((t,i)=>add(`left:56px;width:968px;top:${1250+i*110}px`,`<div style="display:flex;gap:18px;align-items:center;background:rgba(8,12,24,.74);border:2px solid ${TH.accent}55;border-radius:22px;padding:18px 26px;font-size:34px;font-weight:800;line-height:1.15"><span style="color:${TH.accent};font-weight:900;font-size:30px">0${i+1}</span>${esc(t)}</div>`,L[1].start+i*Math.max(.6,L[1].dur/4.2),DUR,{anim:'left'}))}
if(SC.type==='story'||SC.type==='outro'){const cta=(TH.cta??'FOLLOW · NEW BRIEFING EVERY MORNING');if(cta)add(`left:0;width:1080px;top:${SC.type==='outro'?1360:1700}px;text-align:center`,`<span style="display:inline-block;background:${TH.accent};color:#1a1200;font-weight:900;font-size:30px;letter-spacing:3px;padding:14px 30px;border-radius:40px;box-shadow:0 8px 30px ${TH.accent}66">${esc(cta)}</span>`,SC.type==='outro'?3.2:DUR-3.4,DUR,{anim:'pop'})}
if(SC.type==='story'){
  const col=catColor(SC.cat);
  add('right:56px;top:70px;font-weight:700;font-size:30px;letter-spacing:4px;color:#9aa3b8',`${String(SC.n).padStart(2,'0')} / ${String(SC.total).padStart(2,'0')}`,.2,DUR,{anim:'fade'});
  add(`left:56px;top:150px;font-weight:800;font-size:28px;letter-spacing:5px;padding:10px 22px;border-radius:40px;border:2px solid ${col};color:${col};background:rgba(0,0,0,.35)`,esc(SC.cat),.25,DUR,{anim:'left'});
  const hl=SC.headline.length,fs=hl<=45?76:hl<=70?64:hl<=96?54:46;
  add(`left:30px;top:232px;width:8px;height:${SC.headline.length<=45?82:SC.headline.length<=70?70:60}px;border-radius:5px;background:${col};box-shadow:0 0 18px ${col}`,'',.35,DUR,{anim:'fade'});
  const head=add(`left:56px;top:226px;width:968px;font-weight:900;font-size:${fs}px;line-height:1.05;letter-spacing:-1.2px;text-shadow:0 4px 30px rgba(0,0,0,.85)`,esc(SC.headline),.35,DUR,{inT:.6});
  const sub=add('left:56px;width:968px;font-weight:500;font-size:30px;line-height:1.25;color:#c3cbe0;text-shadow:0 2px 14px rgba(0,0,0,.95)',esc(SC.tagline),.6,DUR);
  sub.style.top=(head.offsetHeight+226+14)+'px';
  if(SC.tag){const tc=SC.tag==='CONFIRMED'?'#35e08a':'#ffb400';add(`right:56px;top:150px;font-weight:900;font-size:26px;letter-spacing:4px;padding:10px 20px;border-radius:40px;background:${tc};color:#06110a`,esc(SC.tag),.5,DUR,{anim:'pop'})}
  if(SC.source||SC.tagnote)add('left:56px;width:968px;top:1745px;font-size:23px;line-height:1.3;color:#8791aa;text-align:center;letter-spacing:.5px',(SC.tagnote?`<b style="color:${SC.tag==='CONFIRMED'?'#35e08a':'#ffb400'}">${esc(SC.tagnote)}</b>`+(SC.source?'<br>':''):'')+(SC.source?esc('Source: '+SC.source):''),.5,DUR,{anim:'fade'});
  SC.cards.forEach(c=>{const i=Math.min(c.line,L.length-1);const nxt=SC.cards.filter(x=>x.line>c.line).length;
    add(ROW+`top:${Y}px`,c.small?card(c.k,c.v,c.s,'#ffc233',true):(()=>card(c.k,countUp(c.v,cur,L[i].start+.1),c.s,col,false)),L[i].start,c.small?DUR:e(i)+.3);});
  add('left:56px;width:968px;top:1000px;font-size:23px;color:#8791aa;text-align:center','Illustrative graphic',1,3.5,{anim:'fade'});
}
if(SC.type==='also'){
  add('right:56px;top:70px;font-weight:700;font-size:30px;letter-spacing:4px;color:#9aa3b8','QUICK HITS',.2,DUR,{anim:'fade'});
  add('left:56px;top:226px;width:968px;font-weight:900;font-size:84px;line-height:1.02;letter-spacing:-2px','Also<br><span style="color:#ffb400">watching</span>',.35,DUR,{inT:.6});
  SC.bullets.forEach((b,i)=>add(ROW+`top:${Y-60}px`,`<div style="background:rgba(8,12,24,.78);border:2px solid #35e0ff55;border-radius:26px;padding:26px 30px;font-size:36px;font-weight:700;line-height:1.25"><span style="color:#35e0ff;font-weight:900;letter-spacing:3px;font-size:24px;display:block;margin-bottom:8px">${String(i+1).padStart(2,'0')} / ${String(SC.bullets.length).padStart(2,'0')}</span>${esc(b)}</div>`,L[i].start,e(i)+.25));
}
if(SC.type==='outro'){
  const w=SC.big.replace(/[.]$/,'').split(' '),cut=SC.big.includes(',')?SC.big.indexOf(',')+1:null;
  let a,b;if(cut){a=SC.big.slice(0,cut);b=SC.big.slice(cut).replace(/\.$/,'').trim()}else{const h=Math.ceil(w.length/2);a=w.slice(0,h).join(' ');b=w.slice(h).join(' ').replace(/\.$/,'')}
  const sz=SC.big.length>34?84:104;
  add(`left:30px;width:1020px;top:470px;text-align:center;font-weight:900;font-size:${sz}px;line-height:1.02;letter-spacing:-3px;text-shadow:0 6px 40px rgba(0,0,0,.8)`,esc(a),.4,DUR,{inT:.7});
  add(`left:30px;width:1020px;top:${470+sz*1.05}px;text-align:center;font-weight:900;font-size:${sz}px;line-height:1.02;letter-spacing:-3px;color:#ffb400;text-shadow:0 6px 40px rgba(0,0,0,.8)`,esc(b),1.2,DUR,{inT:.7});
  add('left:0;width:1080px;top:1180px;text-align:center;font-weight:800;font-size:44px;letter-spacing:12px',esc(SC.brand),2.4,DUR);
  add('left:60px;width:960px;top:1260px;text-align:center;font-size:26px;line-height:1.35;color:#8791aa','AI-generated narration and visuals · Sources in the description<br>Informational only · Not financial, legal or investment advice',2.8,DUR,{anim:'fade'});
}

/* captions: <=5-word chunks timed by characters within each narrated line */
const caps=[];
L.forEach(ln=>{const w=(ln.disp||ln.text).split(/\s+/);const ch=[];let c=[];w.forEach(x=>{c.push(x);if(c.length>=5||(/[.,;:!?]$/.test(x)&&c.length>=3)){ch.push(c.join(' '));c=[]}});
  if(c.length){if(ch.length&&c.length<2)ch[ch.length-1]+=' '+c.join(' ');else ch.push(c.join(' '))}
  const tot=ch.reduce((a,b)=>a+b.length,0)||1;let t=ln.start;ch.forEach(x=>{const d=ln.dur*x.length/tot;caps.push({t0:t,t1:t+d,text:x});t+=d})});
const capEl=document.createElement('div');capEl.style.cssText='position:absolute;left:60px;width:960px;top:1520px;text-align:center;font-weight:900;font-size:66px;line-height:1.12;-webkit-text-stroke:10px rgba(0,0,0,.92);paint-order:stroke fill;text-shadow:0 6px 24px rgba(0,0,0,.8);opacity:0';hud.appendChild(capEl);
const wipe=document.createElement('div');wipe.style.cssText=`position:absolute;inset:0;background:linear-gradient(100deg,${acc} 0%,${acc} 82%,#fff 100%);opacity:0;pointer-events:none;transform:translateX(-100%)`;document.getElementById('stage').appendChild(wipe);
let cur=0;const fade=document.getElementById('fade');
window.renderAt=(t)=>{
  cur=t;S.update(t);composer.render();
  for(const it of items){
    const pi=ease(clamp((t-it.t0)/it.inT)),po=clamp((it.t1-t)/it.outT);const op=Math.min(pi,po);
    let tr='';if(it.anim==='up')tr=`translateY(${(1-pi)*46}px)`;else if(it.anim==='left')tr=`translateX(${-(1-pi)*60}px)`;else if(it.anim==='pop')tr=`scale(${.85+.15*pi})`;
    if(typeof it.html==='function'){const h=it.html();if(h!==it.last){it.e.innerHTML=h;it.last=h}}
    it.e.style.opacity=op.toFixed(3);it.e.style.transform=tr;
  }
  const c=caps.find(x=>t>=x.t0&&t<x.t1+.05);
  if(c){capEl.textContent=c.text;capEl.style.opacity=1;capEl.style.transform=`scale(${.94+.06*eo(clamp((t-c.t0)/.12))})`}else capEl.style.opacity=0;
  const tk=document.getElementById('tk');if(tk)tk.style.transform=`translateX(${-(t+SC.id.length*3)*70}px)`;
  const inP=clamp(t/.5),out=SC.type==='outro'?.9:.4,outP=clamp((t-(DUR-out))/out);
  wipe.style.transform=inP<1?`translateX(${(inP<.5?-100+inP*2*100:(inP-.5)*2*100)}%)`:(outP>0?`translateX(${outP<.5?-100+outP*2*100:(outP-.5)*2*100}%)`:'translateX(-100%)');
  wipe.style.opacity=(inP<1||outP>0)?1:0;
  fade.style.opacity=Math.max(1-clamp(t/.18),clamp((t-(DUR-.15))/.15)).toFixed(3);
};
window.READY=true;window.DUR=DUR;
