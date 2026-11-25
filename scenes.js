import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const ease=x=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
export const eo=x=>1-Math.pow(1-clamp(x),3);
const lerp=(a,b,t)=>a+(b-a)*t;
const bounce=x=>{x=clamp(x);const n=7.5625,d=2.75;if(x<1/d)return n*x*x;if(x<2/d)return n*(x-=1.5/d)*x+.75;if(x<2.5/d)return n*(x-=2.25/d)*x+.9375;return n*(x-=2.625/d)*x+.984375};
export function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5,metalness:.1},o));
const B=(c,o={})=>new THREE.MeshBasicMaterial(Object.assign({color:c},o));
function stars(scene,n,spread,seed,color=0xffffff,size=.08){
  const r=rng(seed),p=new Float32Array(n*3);
  for(let i=0;i<n;i++){p[i*3]=(r()-.5)*spread;p[i*3+1]=r()*spread*.5;p[i*3+2]=-r()*spread}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const pts=new THREE.Points(g,new THREE.PointsMaterial({color,size,sizeAttenuation:true,transparent:true,opacity:.9,fog:false}));
  scene.add(pts);return pts;
}
function lights(scene,key=0xffffff,ki=2.2,amb=.55){
  scene.add(new THREE.HemisphereLight(0xaac4ff,0x101018,amb));
  const d=new THREE.DirectionalLight(key,ki);d.position.set(6,12,8);scene.add(d);return d;
}

/* ---------------- S0 HOOK ---------------- */
function s0({scene,camera}){
  scene.background=new THREE.Color(0x03040a);scene.fog=new THREE.FogExp2(0x03040a,.03);
  stars(scene,1100,70,5);
  const rings=[];
  for(let i=0;i<9;i++){
    const m=new THREE.Mesh(new THREE.TorusGeometry(4+(i%3)*.6,.05,8,96),B(i%2?0x35d0ff:0xffb400));
    m.position.z=-i*13;m.rotation.z=i*.7;scene.add(m);rings.push(m);
  }
  const grid=new THREE.GridHelper(200,60,0x1c2a55,0x0f1733);grid.position.y=-4;scene.add(grid);
  return {update(t){
    camera.position.set(Math.sin(t*.8)*.6,.4,8-t*16);
    camera.lookAt(Math.sin(t*.8)*.3,0,camera.position.z-12);
    rings.forEach((r,i)=>{r.rotation.z=i*.7+t*(i%2?.5:-.4)});
  }};
}

/* ---------------- S1 HORMUZ ---------------- */
function tanker(color){
  const g=new THREE.Group();
  const sh=new THREE.Shape();sh.moveTo(-3,-.75);sh.lineTo(2.1,-.75);sh.lineTo(3.1,0);sh.lineTo(2.1,.75);sh.lineTo(-3,.75);sh.closePath();
  const hullG=new THREE.ExtrudeGeometry(sh,{depth:.8,bevelEnabled:false});hullG.rotateX(-Math.PI/2);
  const hull=new THREE.Mesh(hullG,M(color,{roughness:.6,flatShading:true}));hull.position.y=-.15;g.add(hull);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(4.6,.08,1.1),M(0x2b3138,{roughness:.8}));deck.position.set(-.2,.66,0);g.add(deck);
  for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.12,12),M(0x4a525c));t.position.set(-1+i*.9,.75,0);g.add(t)}
  const cab=new THREE.Mesh(new THREE.BoxGeometry(.9,1.1,1.1),M(0xe9edf2));cab.position.set(-2.4,1.15,0);g.add(cab);
  const win=new THREE.Mesh(new THREE.BoxGeometry(.04,.25,.9),B(0xffd27a));win.position.set(-1.96,1.45,0);g.add(win);
  const stack=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.5,8),M(0xcc3b2e));stack.position.set(-2.7,1.9,0);g.add(stack);
  return g;
}
function land(side,seed){
  const r=rng(seed),sh=new THREE.Shape();const s=side;
  const pts=[];for(let y=-60;y<=60;y+=5){let wob=Math.sin(y*.21)*1.4+r()*1.2;let bulge=(side>0&&y>-22&&y<-6)?Math.max(0,4-Math.abs(y+14)*.55)*-1:0; pts.push([s*(5.2+wob+bulge),y])}
  sh.moveTo(s*60,-60);pts.forEach(p=>sh.lineTo(p[0],p[1]));sh.lineTo(s*60,60);sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:2.2,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,-.8,0);
  const m=new THREE.Mesh(g,M(0x5a4b33,{roughness:.95,flatShading:true}));
  const grp=new THREE.Group();grp.add(m);
  for(let i=0;i<26;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(1.6+r()*2.6,2+r()*5,5),M(0x3d3427,{flatShading:true,roughness:1}));
    c.position.set(s*(12+r()*40),1.2+1,(r()-.5)*110);grp.add(c)}
  // coastal lights
  const lp=new Float32Array(90*3);for(let i=0;i<90;i++){const y=(r()-.5)*100;lp[i*3]=s*(6.3+r()*3+Math.sin(y*.21)*1.4);lp[i*3+1]=1.55;lp[i*3+2]=y}
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(lp,3));
  grp.add(new THREE.Points(lg,new THREE.PointsMaterial({color:0xffc86b,size:.22,fog:false})));
  return grp;
}
function ships({scene,camera,L,spec}){
  scene.background=new THREE.Color(0x050c18);scene.fog=new THREE.Fog(0x050c18,28,95);
  lights(scene,0xbfd4ff,1.6,.7);
  const moon=new THREE.DirectionalLight(0x6f94ff,1.1);moon.position.set(-10,10,-8);scene.add(moon);
  const red=new THREE.PointLight(0xff3a2a,0,60);red.position.set(0,6,0);scene.add(red);
  stars(scene,500,160,9);
  const geo=new THREE.PlaneGeometry(130,130,80,80);geo.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(geo,M(0x1a7a9a,{roughness:.3,metalness:.3,flatShading:true,emissive:0x04243a,emissiveIntensity:.6}));scene.add(water);
  const base=geo.attributes.position.array.slice();
  scene.add(land(-1,3));scene.add(land(1,8));
  // ships
  const cols=[0xb03030,0x2f5aa0,0x6a6a78,0xa0551f,0x2f7a5a,0x8a4a7a,0x3f7aa6,0xb09a3a];
  const ships=[];
  const slots=[[-2,-26,1.25],[2.2,-6,-1.0],[-2.1,-3,1.1],[2.0,-28,-1.2],[-2.3,8,1.0],[2.3,10,-.9],[-2.0,-14,1.2],[2.1,-16,-1.1]];
  slots.forEach((s,i)=>{const g=new THREE.Group();const t=tanker(cols[i]);t.rotation.y=Math.PI/2*(s[2]>0?1:-1)*-1+0;g.add(t);
    g.userData={x:s[0],z0:s[1],v:s[2]};g.position.set(s[0],0,s[1]);scene.add(g);ships.push(g)});
  // strikes on first 4
  const SP=spec.params||{};const E1=L[1].start,sd=Math.min(.8,L[1].dur/6);const strikeT=SP.strikes?[0,1,2,3].map(k=>E1+.35+k*sd):[1e9,1e9,1e9,1e9];
  const fx=ships.slice(0,4).map((sh,i)=>{
    const f=new THREE.Group();f.position.y=.7;sh.add(f);
    const blast=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),B(0xffb347,{transparent:true,opacity:0}));f.add(blast);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),B(0xff6a3d,{transparent:true,opacity:0,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.6;f.add(ring);
    const smoke=[];for(let k=0;k<10;k++){const sm=new THREE.Mesh(new THREE.SphereGeometry(.5,8,6),B(0x1b1b1f,{transparent:true,opacity:0}));f.add(sm);smoke.push(sm)}
    const mark=new THREE.Mesh(new THREE.ConeGeometry(.28,.7,4),B(0xff3b30));mark.rotation.x=Math.PI;mark.position.y=3.4;mark.visible=false;f.add(mark);
    return {f,blast,ring,smoke,mark,sh};
  });
  // cyber
  const CY=!!SP.cyber;const C0=L[2].start,C1=C0+L[2].dur;
  const hub=new THREE.Mesh(new THREE.OctahedronGeometry(1.4),B(0x35e0ff,{wireframe:true}));hub.position.set(0,9,-8);hub.visible=false;scene.add(hub);
  const lineG=new THREE.BufferGeometry();lineG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(ships.length*6),3));
  const lines=new THREE.LineSegments(lineG,new THREE.LineBasicMaterial({color:0x35e0ff,transparent:true,opacity:.0}));lines.frustumCulled=false;scene.add(lines);
  const rr=rng(77),dp=new Float32Array(50*3);for(let i=0;i<50;i++){dp[i*3]=(rr()-.5)*16;dp[i*3+1]=3+rr()*5;dp[i*3+2]=-34+rr()*46}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));dg.setDrawRange(0,0);
  scene.add(new THREE.Points(dg,new THREE.PointsMaterial({color:0x6af0ff,size:.55,sizeAttenuation:true})));
  const dots=scene.children[scene.children.length-1];
  const scan=ships.map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.96,1,40),B(0x35e0ff,{transparent:true,opacity:0,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=.1;scene.add(m);return m});
  return {
    shake:0,
    update(t){
      // water
      const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=base[i*3],z=base[i*3+2];p.array[i*3+1]=Math.sin(x*.4+t*1.3)*.16+Math.cos(z*.33+t*1.0)*.14+Math.sin((x+z)*.2+t*.7)*.12}
      p.needsUpdate=true;
      ships.forEach((s,i)=>{const d=s.userData;let v=d.v;let sink=0;
        if(i<4){const k=clamp((t-strikeT[i])/2.5);v*=1-.65*k;sink=ease(clamp((t-strikeT[i])/4))*.25}
        s.userData.z=d.z0+d.v*t*(i<4?(1-.3*clamp((t-strikeT[i])/2.5)):1);
        s.position.z=s.userData.z;s.position.y=Math.sin(t*1.4+i)*.05-sink;s.rotation.z=Math.sin(t*1.1+i*2)*.03+(i<4?sink*.4:0);s.rotation.x=0});
      let sh=0;
      fx.forEach((o,i)=>{const dt=t-strikeT[i];
        const a=clamp(dt/.7);o.blast.material.opacity=dt<0?0:(1-a)*.95;o.blast.scale.setScalar(.3+a*3.2);
        o.ring.material.opacity=dt<0?0:(1-clamp(dt/1.4))*.9;o.ring.scale.setScalar(1+clamp(dt/1.4)*7);
        o.smoke.forEach((sm,k)=>{const q=clamp((dt-.1-k*.07)/2.2);sm.material.opacity=dt<0?0:Math.sin(q*Math.PI)*.55;sm.position.set(Math.sin(k*2.3)*.3*q*3,.4+q*(3+k*.15),Math.cos(k*1.7)*.3*q*3);sm.scale.setScalar(.6+q*1.8)});
        o.mark.visible=dt>.5;o.mark.position.y=3.2+Math.sin(t*5+i)*.12;
        if(dt>0&&dt<.55)sh=Math.max(sh,(1-dt/.55)*.5);
      });
      red.intensity=Math.max(0,sh*60);
      // cyber
      const cp=clamp((t-C0)/.5);
      hub.visible=CY&&t>C0;hub.rotation.y=t*1.6;hub.rotation.x=t*.9;hub.scale.setScalar(.2+eo(cp)*.8);
      const arr=lineG.attributes.position.array;
      ships.forEach((s,i)=>{arr[i*6]=hub.position.x;arr[i*6+1]=hub.position.y;arr[i*6+2]=hub.position.z;arr[i*6+3]=s.position.x;arr[i*6+4]=2.2;arr[i*6+5]=s.position.z});
      lineG.attributes.position.needsUpdate=true;lines.material.opacity=CY&&t>C0?.8*cp:0;
      dg.setDrawRange(0,Math.floor(50*ease(clamp((t-C0)/(C1-C0-.6)))));
      dots.visible=CY&&t>C0;dots.material.opacity=1;
      scan.forEach((m,i)=>{const q=((t-C0)*.9+i*.17)%1;m.position.x=ships[i].position.x;m.position.z=ships[i].position.z;m.material.opacity=CY&&t>C0?(1-q)*.8*cp:0;m.scale.setScalar(1.5+q*5)});
      // camera
      const a=-.38+t*.035+Math.sin(t*.5)*.05;
      camera.position.set(Math.sin(a)*12,7.2-clamp((t-5)/6)*1.0,23-t*.2);
      camera.position.x+=Math.sin(t*95)*sh*.5;camera.position.y+=Math.cos(t*80)*sh*.4;
      camera.lookAt(0,1.0,-6);
    }};
}

/* ---------------- S2 NVIDIA CHIP ---------------- */
function circuitTex(){
  const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');
  g.fillStyle='#050a08';g.fillRect(0,0,1024,1024);const r=rng(21);
  g.strokeStyle='#38ff8a';g.lineCap='round';
  for(let i=0;i<340;i++){g.lineWidth=2+r()*3;g.globalAlpha=.25+r()*.65;let x=r()*1024,y=r()*1024;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<4;k++){if(r()<.5)x+=(r()-.5)*260;else y+=(r()-.5)*260;g.lineTo(x,y)}g.stroke();
    g.fillStyle='#8dffc0';g.beginPath();g.arc(x,y,3+r()*4,0,7);g.fill()}
  g.globalAlpha=1;g.strokeStyle='#39ff88';g.lineWidth=6;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){g.strokeRect(120+i*215,120+j*215,170,170);g.globalAlpha=.18;g.fillStyle='#39ff88';g.fillRect(120+i*215,120+j*215,170,170);g.globalAlpha=1}
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function chip({scene,camera,L,spec}){
  scene.background=new THREE.Color(0x02070a);scene.fog=new THREE.Fog(0x02070a,16,48);
  lights(scene,0xcfe8ff,1.3,.35);
  const key=new THREE.PointLight(0x39ff88,40,40);key.position.set(0,6,2);scene.add(key);
  stars(scene,400,90,12,0x7fffc0,.06);
  const grid=new THREE.GridHelper(120,60,0x0b3a2a,0x06201a);grid.position.y=-.5;scene.add(grid);
  const chip=new THREE.Group();scene.add(chip);
  const pcb=new THREE.Mesh(new RoundedBoxGeometry(8,.3,8,2,.08),M(0x0a2a1c,{roughness:.55,metalness:.4}));chip.add(pcb);
  const tex=circuitTex();
  const dieMat=M(0x0b110e,{map:tex,emissiveMap:tex,emissive:0x39ff88,emissiveIntensity:1.3,metalness:.7,roughness:.3});
  const die=new THREE.Mesh(new THREE.BoxGeometry(3.6,.22,3.6),dieMat);die.position.y=.26;chip.add(die);
  const fm=M(0xb8c2cc,{metalness:1,roughness:.28});
  [[0,-2.5,5.2,.3],[0,2.5,5.2,.3],[-2.5,0,.3,5.2],[2.5,0,.3,5.2]].forEach(([x,z,w,d])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w||.3,.34,d||.3),fm);b.position.set(x,.32,z);chip.add(b)});
  const hbm=[[-3.05,-1.3],[-3.05,1.3],[3.05,-1.3],[3.05,1.3]].map(([x,z])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.22,1.9),M(0x101a16,{map:tex,emissiveMap:tex,emissive:0x39ff88,emissiveIntensity:.8,metalness:.6,roughness:.4}));b.position.set(x,.2,z);chip.add(b);return b});
  const pin=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.07,.1,8),M(0xffc233,{metalness:1,roughness:.3}),160);
  const d=new THREE.Object3D();let n=0;for(let i=0;i<40;i++){const u=-3.7+i*.19;
    [[u,-3.78],[u,3.78],[-3.78,u],[3.78,u]].forEach(([x,z])=>{d.position.set(x,.2,z);d.updateMatrix();pin.setMatrixAt(n++,d.matrix)})}
  chip.add(pin);
  const halo=[3.4,3.9,4.4].map((r,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.025,8,120),B(0x39ff88,{transparent:true,opacity:.5}));m.rotation.x=Math.PI/2;m.position.y=.9+i*.35;scene.add(m);return m});
  // stock spikes
  const bars=[];const bg=new THREE.Group();bg.position.set(5.3,-.2,-2.6);scene.add(bg);
  for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.38,1,.38),M(0x2cff7a,{emissive:0x14c85a,emissiveIntensity:.8}));b.position.x=i*.55;bg.add(b);bars.push(b)}
  // gavel
  const gv=new THREE.Group();const head=new THREE.Mesh(new RoundedBoxGeometry(1.7,.8,.8,2,.15),M(0x6b3f1d,{roughness:.55}));
  const bandL=new THREE.Mesh(new THREE.BoxGeometry(.18,.86,.86),M(0xd8a93a,{metalness:1,roughness:.3}));bandL.position.x=-.6;const bandR=bandL.clone();bandR.position.x=.6;
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,3,12),M(0x8a5a2b));handle.rotation.z=Math.PI/2;handle.position.x=2.3;
  gv.add(head,bandL,bandR,handle);gv.position.set(-5.2,4.2,3);gv.visible=false;scene.add(gv);
  const block=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.4,.5,24),M(0x5a3517));block.position.set(-5.2,-.2,3.4);block.visible=false;scene.add(block);
  const SP=spec.params||{};const A=L[1].start,Bt=L[2].start,Ct=SP.gavel?L[3].start:1e9;
  return {update(t){
    chip.rotation.y=.5+t*.16;chip.rotation.x=-.05;chip.position.y=Math.sin(t*1.2)*.12;
    halo.forEach((h,i)=>{h.rotation.z=t*(.6+i*.3)*(i%2?-1:1);h.material.opacity=.35+.25*Math.sin(t*2+i)});
    // state colors
    let col=new THREE.Color(0x39ff88);
    if(SP.alarm&&t>=A&&t<Bt){const f=(Math.sin(t*22)>0.1)?1:0;const q=clamp((t-A)/.4);col.lerp(new THREE.Color(0xff2d2d),f*q)}
    if(t>=Ct)col.lerp(new THREE.Color(0xffb020),ease((t-Ct)/.6));
    dieMat.emissive.copy(col);key.color.copy(col);halo.forEach(h=>h.material.color.copy(col));
    const g=(SP.alarm&&t>=A&&t<A+.9)?(1-(t-A)/.9)*.12:0;chip.position.x=Math.sin(t*70)*g;
    // spikes
    bars.forEach((b,i)=>{const k=ease(clamp((t-Bt-.1-i*.14)/.7));const h=.2+(.6+i*.5+(i%2?.4:0))*k;b.scale.y=h;b.position.y=h/2});
    // gavel
    gv.visible=block.visible=t>Ct-.2;
    const hit=(tt)=>{const q=((t-tt)%1.3+1.3)%1.3;return q};
    let ang=.9;if(t>Ct){const q=hit(Ct+.3);ang=q<.25?lerp(.9,-.05,ease(q/.25)):lerp(-.05,.9,ease(clamp((q-.25)/.7)))}
    gv.rotation.z=-ang;gv.position.y=1.2+Math.sin(ang)*.9;
    if(t>Ct){const q=hit(Ct+.3);if(q>.22&&q<.4)block.scale.setScalar(1+(.4-q)*.4);else block.scale.setScalar(1)}
    const a=-.2+t*.06;camera.position.set(Math.sin(a)*3,9.5-ease(t/20)*1.4,13.5-ease(t/20)*1.5);camera.lookAt(0,-.4,0);
  }};
}

/* ---------------- S3 GOLD & SILVER ---------------- */
function metals({scene,camera,L,env,spec}){
  scene.background=new THREE.Color(0x0a0a10);scene.fog=new THREE.Fog(0x0a0a10,20,60);scene.environment=env;
  lights(scene,0xfff1d6,2.4,.35);
  stars(scene,300,80,31,0xffe9b0,.05);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),M(0x14141c,{roughness:.3,metalness:.7}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
  const grid=new THREE.GridHelper(80,40,0x2a2a38,0x1a1a26);grid.position.y=.01;scene.add(grid);
  const SP=spec.params||{};const DN=SP.down!==false;const BD=L[1].start+.4;
  const gold=M(0xffc233,{metalness:1,roughness:.22}),silver=M(0xd7dde6,{metalness:1,roughness:.2});
  const bars=[];const r=rng(9);
  const geo=new RoundedBoxGeometry(1.7,.55,.85,3,.1);
  const rows=[5,4,3,2,1];
  rows.forEach((n,ri)=>{for(let i=0;i<n;i++){const m=new THREE.Mesh(geo,gold);const x=(i-(n-1)/2)*1.85-.9,y=.28+ri*.58;m.position.set(x,y,0);
    scene.add(m);const topIdx=rows.length-1-ri;bars.push({m,x0:x,y0:y,delay:BD+(topIdx*.45)+r()*.3,fx:x+(r()-.5)*5,fz:(r()-.2)*5.5,fry:(r()-.5)*3,frz:(r()-.5)*.7,gy:.28})}});
  [3,2,1].forEach((n,ri)=>{for(let i=0;i<n;i++){const m=new THREE.Mesh(geo,silver);const x=(i-(n-1)/2)*1.85+3.3,y=.28+ri*.58;m.position.set(x,y,-.2);scene.add(m);
    bars.push({m,x0:x,y0:y,delay:BD+.9+(2-ri)*.4+r()*.3,fx:x+(r()-.5)*4,fz:(r()-.1)*5,fry:(r()-.5)*3,frz:(r()-.5)*.7,gy:.28})}});
  // chart ribbon
  const ys=DN?[7,8.2,7.4,6.2,5,3.6,2.6]:[2.6,3.6,5,6.2,7.4,8.2,9];const curve=new THREE.CatmullRomCurve3(ys.map((y,i)=>new THREE.Vector3(-9+i*3,y,-4)));
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,120,.12,8,false),B(DN?0xff4a3d:0x32e68a));scene.add(tube);tube.geometry.setDrawRange(0,0);
  const arrow=new THREE.Mesh(new THREE.ConeGeometry(.45,.9,12),B(DN?0xff4a3d:0x32e68a));scene.add(arrow);
  // dollar coin
  const cv=document.createElement('canvas');cv.width=cv.height=256;const cg=cv.getContext('2d');cg.fillStyle='#0d6b3c';cg.fillRect(0,0,256,256);cg.strokeStyle='#bff3d4';cg.lineWidth=10;cg.beginPath();cg.arc(128,128,108,0,7);cg.stroke();cg.fillStyle='#e8fff1';cg.font='900 170px Inter, sans-serif';cg.textAlign='center';cg.textBaseline='middle';cg.fillText('$',128,138);
  const ct=new THREE.CanvasTexture(cv);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(2,2,.35,48),[M(0xbff3d4,{metalness:.8,roughness:.3}),new THREE.MeshStandardMaterial({map:ct,metalness:.5,roughness:.35}),new THREE.MeshStandardMaterial({map:ct,metalness:.5,roughness:.35})]);
  coin.rotation.z=Math.PI/2;coin.position.set(10,3,0);scene.add(coin);
  // DCA bars
  const dca=[];for(let i=0;i<4;i++){const m=new THREE.Mesh(geo,gold);m.position.set(-3.3+i*2.1,8,5.5);m.visible=false;scene.add(m);dca.push(m)}
  const T1=L[2].start,T2=L[3].start;
  return {update(t){
    const draw=Math.floor(721*ease(clamp((t-.5)/(L[2].start-.5))));tube.geometry.setDrawRange(0,draw);
    const pr=ease(clamp((t-.5)/(L[2].start-.5)));const pt=curve.getPoint(clamp(pr));arrow.position.copy(pt);arrow.position.y-=.1;
    const tg=curve.getTangent(clamp(pr));arrow.rotation.z=Math.atan2(tg.y,tg.x)-Math.PI/2;arrow.visible=t>.6;
    bars.forEach(b=>{const qq=clamp((t-b.delay)/1.1);const q=DN?qq:1-qq;const e=bounce(q);const s=ease(clamp(q*1.2));
      b.m.position.x=lerp(b.x0,b.fx,s);b.m.position.z=lerp(0,b.fz,s);b.m.position.y=lerp(b.y0,b.gy,e)+Math.sin(q*Math.PI)*.8*(q>0&&q<1?1:0);
      b.m.rotation.y=b.fry*s;b.m.rotation.z=b.frz*e});
    const ci=ease(clamp((t-T1)/1.2));coin.position.x=lerp(9,3.4,ci);coin.position.y=4.6+Math.sin(t*2)*.2;coin.position.z=1;coin.rotation.x=t*2.2;coin.scale.setScalar(.4+ci*.35);coin.visible=!!SP.dollar&&t>T1-.1;
    dca.forEach((m,i)=>{const q=clamp((t-(T2+.8+i*1.4))/.9);m.visible=DN&&q>0;m.position.y=lerp(8,.28,bounce(q));m.position.x=-3.3+i*2.1});
    const a=.55-t*.035;camera.position.set(Math.sin(a)*17,6.5,Math.cos(a)*17+2);camera.lookAt(0,.5,0);
  }};
}

/* ---------------- S4 I BONDS ---------------- */
function coins({scene,camera,L,env,spec}){
  scene.background=new THREE.Color(0x050a14);scene.fog=new THREE.Fog(0x050a14,18,55);scene.environment=env;
  lights(scene,0xfff3dc,2.2,.4);stars(scene,350,80,41,0x9fffd0,.05);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(30,64),M(0x0c1626,{roughness:.25,metalness:.8}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const gold=M(0xffc233,{metalness:1,roughness:.2});
  const lock=new THREE.Group();scene.add(lock);
  const body=new THREE.Mesh(new RoundedBoxGeometry(3.2,2.6,1.4,4,.25),gold);body.position.y=1.6;lock.add(body);
  const key=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.2,24),M(0x1a1205));key.rotation.x=Math.PI/2;key.position.set(0,1.85,.72);lock.add(key);
  const slot=new THREE.Mesh(new THREE.BoxGeometry(.2,.7,.2),M(0x1a1205));slot.position.set(0,1.35,.72);lock.add(slot);
  const sh=new THREE.Group();const arc=new THREE.Mesh(new THREE.TorusGeometry(1.0,.22,16,40,Math.PI),M(0xdfe5ee,{metalness:1,roughness:.2}));sh.add(arc);
  [-1,1].forEach(s=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.6,16),M(0xdfe5ee,{metalness:1,roughness:.2}));l.position.set(s*1,-.3,0);sh.add(l)});
  sh.position.set(0,2.9,0);lock.add(sh);
  // coin stacks
  const cg=new THREE.CylinderGeometry(.8,.8,.16,32);const stacks=[];
  [[-4.3,.5],[4.4,-.3],[-3.2,-3],[3.4,-3.2],[0,-4.6]].forEach(([x,z],si)=>{const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
    const cs=[];for(let i=0;i<22;i++){const c=new THREE.Mesh(cg,gold);c.position.y=.09+i*.17;c.rotation.y=i*.7;c.visible=false;g.add(c);cs.push(c)}stacks.push({g,cs,si})});
  const ringM=B(0x4fe3a0,{transparent:true,opacity:.9,side:THREE.DoubleSide});
  const track=new THREE.Mesh(new THREE.RingGeometry(3.3,3.4,96),B(0x1c3a35,{side:THREE.DoubleSide}));track.position.y=2.2;track.position.z=-1;scene.add(track);
  let prog=new THREE.Mesh(new THREE.RingGeometry(3.25,3.45,96,1,Math.PI/2,-.01),ringM);prog.position.copy(track.position);scene.add(prog);
  const glow=new THREE.PointLight(0xffc233,30,30);glow.position.set(0,4,4);scene.add(glow);
  const T0=L[1].start-.5,T1=L[2].start,T2=L[2].start;
  return {update(t){
    const close=ease(clamp((t-T0-.8)/.7));sh.position.y=lerp(3.5,2.9,close);sh.rotation.y=lerp(1.2,0,close);sh.position.x=lerp(.9,0,close);
    lock.rotation.y=Math.sin(t*.5)*.35;lock.position.y=Math.sin(t*1.3)*.1;
    stacks.forEach(s=>{const start=T0+1.2+s.si*.9;const n=Math.floor(clamp((t-start)/(L[3].start+L[3].dur-start-2))*22);s.cs.forEach((c,i)=>{c.visible=i<n});s.g.rotation.y=t*.3});
    const p=ease(clamp((t-T2)/(L[2].dur+L[3].dur-.5)));prog.geometry.dispose();prog.geometry=new THREE.RingGeometry(3.25,3.45,96,1,Math.PI/2,-Math.max(.01,p*Math.PI*2));prog.visible=t>T2-.2;track.visible=t>T2-.2;
    glow.intensity=25+Math.sin(t*3)*8+(t>T1?10:0);
    const a=.25+t*.045;camera.position.set(Math.sin(a)*14,5.4,Math.cos(a)*14);camera.lookAt(0,1.2,-.5);
  }};
}

/* ---------------- S5 ANTHROPIC IPO CHART (illustrative) ---------------- */
function candles({scene,camera,L,spec}){
  scene.background=new THREE.Color(0x060812);scene.fog=new THREE.Fog(0x060812,22,60);
  lights(scene,0xdfe6ff,1.8,.5);stars(scene,300,90,53,0xb6c4ff,.05);
  const floor=new THREE.GridHelper(60,30,0x26304f,0x141a30);scene.add(floor);
  const IPO=4.2;
  // illustrative closes in "height" units; first day pop, drift, final under IPO
  const SP=spec.params||{};const DN=SP.down!==false;const cr=rng(100+(spec.n||0));
  const data=[];{let prev=DN?IPO:3.2;for(let i=0;i<12;i++){const tr=DN?(i===0?5.6:5.6-(i/11)*1.9):3.2+(i/11)*2.6;const c=i===11?(DN?3.7:5.9):tr+(cr()-.5)*.55;data.push([prev,c]);prev=c}}
  const candles=data.map(([o,c],i)=>{const g=new THREE.Group();const up=c>=o;const col=up?0x32e68a:0xff4d4d;
    const hi=Math.max(o,c)+.35,lo=Math.min(o,c)-.35;
    const bd=new THREE.Mesh(new THREE.BoxGeometry(.7,Math.abs(c-o)||.05,.7),M(col,{emissive:col,emissiveIntensity:.35,roughness:.4}));bd.position.y=(o+c)/2;
    const wk=new THREE.Mesh(new THREE.BoxGeometry(.08,hi-lo,.08),M(col,{emissive:col,emissiveIntensity:.5}));wk.position.y=(hi+lo)/2;
    g.add(bd,wk);g.position.x=(i-5.5)*1.05;scene.add(g);return g});
  const dashes=[];for(let i=0;i<30;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(.38,.07,.07),B(0xffb400));d.position.set(-7+i*.5,IPO,0);scene.add(d);dashes.push(d)}
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(15,3),B(0xff3b30,{transparent:true,opacity:0,side:THREE.DoubleSide}));plane.position.set(0,IPO-1.5,0);scene.add(plane);
  // rain
  const N=260,rp=new Float32Array(N*3),rr=rng(61);for(let i=0;i<N;i++){rp[i*3]=(rr()-.5)*20;rp[i*3+1]=rr()*14;rp[i*3+2]=(rr()-.5)*10}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
  const rain=new THREE.Points(rg,new THREE.PointsMaterial({color:0xff5a5a,size:.14,transparent:true,opacity:0}));scene.add(rain);
  const T0=L[1].start,T1=L[2].start,T2=L[3].start;
  const flash=new THREE.PointLight(0xff3b30,0,30);flash.position.set(5,4,4);scene.add(flash);
  return {update(t){
    candles.forEach((c,i)=>{const k=i===11?ease(clamp((t-T0-.2)/1.0)):ease(clamp((t-.3-i*.16)/.5));c.scale.set(1,Math.max(.001,k),1);c.position.y=0;
      // pivot at ground: scale from 0 using group scale; fine
    });
    dashes.forEach((d,i)=>{d.material.color.setHex(t>T0+.9&&Math.sin(t*10)>0?0xffffff:0xffb400)});
    const r=DN?clamp((t-T1)/1.0)*(1-clamp((t-T2)/1.5)):0;rain.material.opacity=r*.9;
    const p=rg.attributes.position.array;for(let i=0;i<N;i++){p[i*3+1]-=.22+((i%7)*.03);if(p[i*3+1]<0)p[i*3+1]+=14}rg.attributes.position.needsUpdate=true;
    plane.material.opacity=DN?clamp((t-T2)/1)*.28:0;
    flash.intensity=DN&&t>T0+.8&&t<T0+1.5?(1-(t-T0-.8)/.7)*80:0;
    const a=.35*Math.sin(t*.18)+.05;camera.position.set(Math.sin(a)*25,5.8+Math.sin(t*.25)*.6,Math.cos(a)*25);camera.lookAt(0,2.2,0);
  }};
}

/* ---------------- S6 OUTRO / SUNRISE ---------------- */
function s6({scene,camera}){
  scene.background=new THREE.Color(0x070a18);scene.fog=new THREE.Fog(0x070a18,30,120);
  stars(scene,700,150,67);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(9,48,32),B(0xffb55a));sun.position.set(0,-14,-60);scene.add(sun);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(15,32,24),B(0xff7a3a,{transparent:true,opacity:.22}));halo.position.copy(sun.position);scene.add(halo);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(240,240,1,1),M(0x16224a,{roughness:.35,metalness:.2,emissive:0x0a1030,emissiveIntensity:.6}));water.rotation.x=-Math.PI/2;water.position.y=-2;scene.add(water);
  const refl=new THREE.Mesh(new THREE.PlaneGeometry(12,70),B(0xff9a4a,{transparent:true,opacity:0}));refl.rotation.x=-Math.PI/2;refl.position.set(0,-1.95,-32);scene.add(refl);
  lights(scene,0xffd2a0,1.2,.5);
  return {update(t){
    const rise=ease(t/6.5);sun.position.y=lerp(-16,5,rise);halo.position.y=sun.position.y;halo.material.opacity=.15+rise*.2;refl.material.opacity=rise*.35;
    const sky=new THREE.Color(0x070a18).lerp(new THREE.Color(0x3a2450),rise*.7);scene.background.copy(sky);scene.fog.color.copy(sky);
    camera.position.set(Math.sin(t*.2)*2,2,12);camera.lookAt(0,4,-60);
  }};
}

/* ---------------- GLOBE (fallback / also-watching) ---------------- */
function globe({scene,camera,L,spec}){
  scene.background=new THREE.Color(0x040712);scene.fog=new THREE.Fog(0x040712,18,60);
  lights(scene,0xcfe0ff,1.4,.6);stars(scene,600,120,77);
  const g=new THREE.Group();scene.add(g);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(3,48,32),M(0x0b1d3a,{roughness:.55,metalness:.3,emissive:0x07162e,emissiveIntensity:.9})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(3.04,36,24),B(0x2f7bff,{wireframe:true,transparent:true,opacity:.32})));
  const r=rng(11+(spec.n||0)),sph=(rad,la,lo)=>new THREE.Vector3(rad*Math.cos(la)*Math.cos(lo),rad*Math.sin(la),rad*Math.cos(la)*Math.sin(lo));
  const nodes=[];for(let i=0;i<40;i++){const p=sph(3.06,(r()-.5)*2.2,r()*6.28);const m=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),B(0xffb400));m.position.copy(p);g.add(m);nodes.push({p,m})}
  const arcs=[];for(let i=0;i<16;i++){const a=nodes[Math.floor(r()*40)].p,b=nodes[Math.floor(r()*40)].p;const mid=a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(3.06+a.distanceTo(b)*.35);
    const tb=new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,mid,b),40,.018,6,false),B(i%3?0x35e0ff:0xff6b5a,{transparent:true,opacity:.85}));tb.geometry.setDrawRange(0,0);g.add(tb);arcs.push({tb,d:.4+i*.45})}
  const rings=[4.2,4.8].map((rr,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(rr,.015,8,160),B(0x35e0ff,{transparent:true,opacity:.35}));m.rotation.x=1.3+i*.3;scene.add(m);return m});
  return {update(t){
    g.rotation.y=t*.2+.5;g.rotation.x=.3;g.position.y=Math.sin(t*.8)*.1;
    arcs.forEach(a=>{const q=clamp((t-a.d)/1.6);a.tb.geometry.setDrawRange(0,Math.floor(q*40*6*6))});
    nodes.forEach((n,i)=>{n.m.scale.setScalar(1+.5*Math.sin(t*3+i))});
    rings.forEach((m,i)=>{m.rotation.z=t*(.2+i*.1)});
    camera.position.set(0,2.5,14);camera.lookAt(0,.4,0);
  }};
}

export const SCENES={intro:s0,ships,chip,metals,coins,candles,globe,also:globe,outro:s6};
