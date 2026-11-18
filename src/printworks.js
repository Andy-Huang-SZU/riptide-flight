'use strict';

function makePrintworks(scene,art) {
  const {V,clamp,mix,smooth,envelope,railX,railY,TAU}=Flight;
  function builder(){
    const positions=[],uvs=[],faces=[];
    function tri(a,b,c,facet){
      for(const p of [a,b,c]){positions.push(p[0],p[1],p[2]);uvs.push(p[3],p[4]);faces.push(facet);}
    }
    function quad(a,b,c,d,facet=0){tri(a,b,d,facet);tri(b,c,d,facet);}
    function mesh(mat){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      g.setAttribute('facet',new THREE.Float32BufferAttribute(faces,1));g.computeBoundingSphere();
      const item=new THREE.Mesh(g,mat);scene.add(item);return item;
    }
    return {quad,mesh};
  }
  const vert=`attribute float facet;varying float vFace;varying vec2 vInk;varying vec3 vP;
    void main(){vFace=facet;vInk=uv;vP=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}`;
  const frag=`uniform sampler2D uInk,uPlate;uniform float uEdition,uType,uSeed,uBite,uPress,uSlot,uSide,uCharge,uFront;varying vec2 vInk;varying float vFace;varying vec3 vP;
  ${PrintedSurface.paper}
  void main(){
    vec2 uv=vInk+vec2(.147*uSeed,.18*sin(2.1*uSeed));
    vec3 tex=texture2D(uInk,uv).rgb;
    float lum=dot(tex,vec3(.23,.65,.12));float red=smoothstep(.10,.55,tex.r-tex.b);
    float paper=smoothstep(.46,.85,lum);
    vec3 face=tex;
    vec3 charcoal=mix(vec3(.036,.052,.074),vec3(.29,.34,.34),pow(lum,.82));
    vec3 oxide=mix(vec3(.10,.052,.057),vec3(1.,.260,.075),lum*.84+.12);
    vec3 warm=mix(vec3(.076,.088,.104),vec3(.94,.82,.62),smoothstep(.09,.86,lum));
    if(uEdition<.5){face=mix(face,warm,.12);}
    else if(uEdition<1.5){face=mix(oxide,vec3(1.,.48,.15),red*.43);face=mix(face,warm,.16*paper);}
    else if(uEdition<2.5){face=mix(charcoal,vec3(.72,.59,.38),paper*.28);face=mix(face,vec3(.75,.29,.12),red*.54);}
    else{face=mix(warm,vec3(.66,.24,.12),red*.77);}
    float bevel=1.-smoothstep(.20,.57,abs(vFace-1.));
    float side=smoothstep(1.2,1.8,vFace);
    vec3 layers=mix(vec3(.115,.087,.080),vec3(.45,.27,.15),lum);
    float line=abs(fract(vInk.y*35.+lum*.86)-.5);
    layers+=vec3(.22,.17,.10)*(1.-smoothstep(.025,.13+fwidth(line),line));
    face=mix(face,mix(vec3(.32,.22,.13),vec3(1.,.84,.53),.27+.68*lum),bevel);
    face=mix(face,layers,side);
    vec3 n=normalize(cross(dFdx(vP),dFdy(vP)));
    float light=.76+.24*abs(dot(n,normalize(vec3(-.44,.72,.58))));
    face*=light;
    if(uType>.5 && uType<1.5)face*=.72+.20*lum;
    if(uType>1.5 && uType<2.5){face=mix(charcoal*.65,vec3(.55,.33,.17),red*.12);
      float traveling=exp(-pow((vP.y-uFront)*.50,2.))*uCharge;
      vec3 cutEdge=mix(vec3(.82,.53,.26),vec3(1.,.90,.65),traveling);
      face=mix(face,cutEdge*(.61+.39*lum),bevel);
      face+=side*traveling*vec3(.11,.073,.032);
      face=mix(face,layers*.79,side);}
    if(uType>2.5 && uType<4.5){
      float shadow=.5+.5*sin(-vP.z*.47+vP.x*.67+sin(vP.z*.12));
      vec3 ink=mix(vec3(.023,.034,.053),vec3(.19,.14,.12),.15+.62*lum);
      float vein=smoothstep(.60,.92,lum)*(.26+.74*pow(shadow,4.));
      face=mix(ink,vec3(.62,.34,.16)*(.72+.28*lum),vein*.69);
      if(uType>3.5){face=mix(ink,vec3(.61,.47,.32),vein*.61);}
    }
    if(uType>4.5 && vFace<.5){
      vec2 raw=vInk-vec2(.17,.13);
      vec2 local=vec2(.76*raw.x-.14*raw.y,.16*raw.x+.47*raw.y)/.3796;
      vec2 tile=vec2((local.x-.46)/1.08,(local.y-.50)/.27)+.5;
      if(uSide<0.)tile.x=1.-tile.x;
      float press=clamp(uPress*1.42-.30*tile.x-.15*(1.-tile.y),0.,1.);
      float redMark=step(.5,mod(uSlot+step(0.,uSide),2.));
      vec3 page=mix(vec3(.33,.22,.17),vec3(.95,.79,.55),.42+.54*lum);
      page=mix(page,vec3(.78,.205,.092),red*.48);
      face=mix(face,page,.65+.23*paper);
      if(all(greaterThanEqual(tile,vec2(0.)))&&all(lessThanEqual(tile,vec2(1.)))){
        vec2 at=vec2((tile.x+uSlot)*.25,tile.y);
        vec3 stamp=texture2D(uPlate,at).rgb;
        float register=texture2D(uPlate,at+vec2(.0026,-.010)).r;
        float reveal=smoothstep(.04,.15,press);
        vec3 shadow=vec3(.91,.40,.15);
        face=mix(face,shadow,register*reveal*.82);
        vec3 ink=mix(vec3(.051,.086,.111),vec3(.62,.111,.066),redMark);
        float scratch=smoothstep(.50,.69,stamp.g)*smoothstep(.48,.82,lum);
        ink=mix(ink,page,scratch*.43);
        float nick=smoothstep(.80,.98,lum)*.34;
        face=mix(face,ink,stamp.r*(1.-nick)*reveal);
      }
    }
    float dist=length(cameraPosition-vP);
    float tooth=cutRelief(uv);
    // Black ink holds less light than exposed paper. Keep the coarse kerf inside the black.
    float block=step(1.5,uType)*(1.-step(4.5,uType));
    face+=tooth*(.18+.10*lum)*mix(vec3(.98,.83,.66),vec3(.71,.85,.90),block);
    vec3 haze=uType>1.5?vec3(.105,.15,.18):vec3(.43,.355,.287);
    face=mix(face,haze,smoothstep(18.,100.,dist)*(.31-.12*uBite));
    gl_FragColor=vec4(face,1.);
  }`;
  function material(edition,seed,type=0){
    return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{uInk:{value:art.strata},uMicro:{value:art.micro},
      uEdition:{value:edition},uSeed:{value:seed},uType:{value:type},uBite:{value:0},uPlate:{value:art.stamps},uPress:{value:0},uSlot:{value:0},uSide:{value:1},uCharge:{value:0},uFront:{value:0}},
      vertexShader:vert,fragmentShader:frag});
  }
  const gates=[],pages=[],banks=[];
  const breaks=[-1.56,.65,2.67,-1.56+TAU];
  const cx=s=>railX(s),cy=s=>railY(s);
  // A cut window has a face, a bright nick along the cut and an exposed printed edge.
  function plate(s,i,sector,wide,tall,slant){
    const b=builder(),a0=breaks[sector]+.09*Math.sin(i),a1=breaks[sector+1]+.09*Math.sin(i);
    const ash=53+i*2.4, n=54;
    function sample(j,level){
      const angle=mix(a0,a1,j/n),co=Math.cos(angle),si=Math.sin(angle),pow=2.6+i%3*.57;
      const base=Math.pow(Math.pow(Math.abs(co)/wide,pow)+Math.pow(Math.abs(si)/tall,pow),-1/pow);
      const torn=1+.14*Math.sin(3*angle+i*.83)+.058*Math.sin(7*angle-i)+.019*Math.sin(27*angle+1.1*i)+.008*Math.sin(63*angle+i);
      const inner=base*torn, radius=level===0?inner:level===1?inner+.095:ash;
      const x=co*radius+si*radius*slant, y=si*radius;
      const depth=(level===0?-.125:level===3?-.79:0);
      return [x,y,depth,.43+x*.038+y*.009,.55+y*.049+x*.012];
    }
    for(let j=0;j<n;j++){
      const a=sample(j,0),d=sample(j+1,0),a1=sample(j,1),d1=sample(j+1,1);
      const o=sample(j,2),on=sample(j+1,2);
      b.quad(a1,o,on,d1);b.quad(a,a1,d1,d,1);
      const back=(p,w)=>[p[0],p[1],p[2]-.7,w,.17];
      const innerA=back(a,j/n),innerD=back(d,(j+1)/n);
      b.quad([a[0],a[1],a[2],j/n,0],innerA,innerD,[d[0],d[1],d[2],(j+1)/n,0],2);
      b.quad(innerA,back(o,j/n),back(on,(j+1)/n),innerD,2);
      if(j===0)b.quad(a,o,back(o,0),innerA,2);
      if(j===n-1)b.quad(d,on,back(on,1),innerD,2);
    }
    const editions=[[0,2,3],[1,3,0],[2,0,1],[3,1,2],[0,2,1],[1,0,3]];
    const part=b.mesh(material(editions[i%6][sector],i*.83+sector*.55));
    const m=(a0+a1)*.5;
    gates.push({part,s,i,sector,dx:Math.cos(m),dy:Math.sin(m),slant});
  }
  [[21,5.9,5.1,-.36],[31.3,4.15,4.45,.26],[41.5,4.0,3.25,-.28],
   [51.5,3.65,4.35,.33],[60,4.55,3.50,-.37]].forEach(([s,w,h,k],i)=>{
    for(let part=0;part<3;part++)plate(s,i,part,w,h,k);
  });
  // An accordion of individual scored pages. The bound edge stays fixed when its leaf turns.
  function leaf(s,side,i){
    const b=builder(),nx=8,ny=32;
    function at(u,v,back=0){
      const y=mix(-7.0,7.4,v);
      const torn=(.33*Math.sin(y*.98+i*1.7)+.15*Math.sin(3.2*y+.3*i)+.065*Math.sin(y*10.4))*u*u;
      const x=-side*(u*(3.9+.62*Math.sin(i*.94)) + torn);
      const z=.89*Math.sin(u*Math.PI)+u*u*(.67*Math.sin(v*7+i*.73)+.16*y);
      return [x,y+u*(.9*Math.sin(i*2.1)),z+back,.17+u*.47+v*.14,.13+v*.76-u*.16];
    }
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
      const u=i/nx,v=j/ny,un=(i+1)/nx,vn=(j+1)/ny;
      b.quad(at(u,v),at(un,v),at(un,vn),at(u,vn));
      if(i===nx-1){b.quad(at(un,v),at(un,v,-.12),at(un,vn,-.12),at(un,vn),1);}
    }
    const stamped=(side<0&&i%3!==0)||(side>0&&i%3===1);
    const mat=material([0,2,3,1,2][(i+(side>0?1:0))%5],2+i*.47+side,stamped?5:0);
    mat.uniforms.uSlot.value=(i+(side>0?1:0))%4;mat.uniforms.uSide.value=side;
    pages.push({s,side,i,part:b.mesh(mat)});
  }
  for(let i=0;i<11;i++){
    leaf(59.5+4.15*i,-1,i);leaf(61.5+4.17*i,1,i);
  }
  // Long relief banks give the camera a continuous ground between travelling impressions.
  function bank(side){
    const b=builder(),ns=106,nh=15;
    function at(i,j){
      const s=12+94*i/ns, v=j/nh;
      const taper=1-smooth(17,39,s)+smooth(88,108,s);
      const off=10.4+taper*7.5+2.0*Math.sin(s*.135+side)+1.15*Math.sin(s*.22+v*5)+.63*Math.sin(v*13+s*.15);
      const y=-9.8+17*v+2.7*Math.sin(s*.13+side)*v+1.35*Math.sin(s*.25+1.2)*v*v;
      return [cx(s)+side*off,cy(s)+y,-s,s*.015+.1*side,v*.82+.1*Math.sin(s*.11)];
    }
    for(let i=0;i<ns;i++)for(let j=0;j<nh;j++)b.quad(at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1));
    banks.push({side,part:b.mesh(material(side>0?0:2,side+3,1))});
  }
  bank(-1);bank(1);
  const canopy=[];
  function vault(ceiling){
    const b=builder(),nx=44,nz=132;
    function at(i,j){
      const s=14+99*j/nz,u=-1+2*i/nx;
      const seam=3*Math.sin(s*.16)+1.1*Math.sin(s*.44);
      const width=.33+.83*(1-Math.cos(s*.22))+.12*Math.sin(s*.88);
      const x=ceiling?(i<nx/2?mix(-22,seam-width,i/(nx/2-1)):mix(seam+width,22,(i-nx/2)/(nx/2))):22*u,curved=u*u*(ceiling?-2.6:1.76);
      const crest=ceiling?1.48*Math.sin(s*.17+x*.19)+.75*Math.sin(s*.26-x*.12):
        .46*Math.sin(.24*s+x*.25)+.27*Math.sin(.37*s-x*.4);
      const margin=(1-smooth(16,33,s))*4.1;
      const y=railY(s)+(ceiling?6.5+margin:-4.85-margin)+curved+crest;
      return [railX(s)+x,y,-s,.25+x*.022+s*.012,s*.022-.021*x+.066*Math.sin(s*.1)];
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const x=(i/nx-.5)*44,s=14+99*j/nz;
      if(ceiling && i===nx/2-1)continue;
      b.quad(at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1));
    }
    canopy.push({part:b.mesh(material(2,ceiling?2.4:.6,ceiling?4:3)),ceiling});
  }
  vault(false);vault(true);
  const jawAt=114.8;
  function fracture(y){return .16*y+.19*Math.sin(y*1.56+.2)+.105*Math.sin(y*3.9)+.052*Math.sin(y*10.7+.21)+.022*Math.sin(y*26.9);}
  const jaws=[];
  function jaw(side){
    const b=builder(),ny=220;
    function at(j,xoff,depth=0){
      const y=mix(-24,24,j/ny),x=fracture(y)+side*xoff;
      return [x,y,depth,.59+x*.033+y*.007,.47+y*.045+side*.12];
    }
    for(let j=0;j<ny;j++){
      b.quad(at(j,.085),at(j,34),at(j+1,34),at(j+1,.085));
      b.quad(at(j,0,-.11),at(j,.085),at(j+1,.085),at(j+1,0,-.11),1);
      b.quad(at(j,0,-.11),at(j,0,-.86),at(j+1,0,-.86),at(j+1,0,-.11),2);
      b.quad(at(j,0,-.86),at(j,34,-.86),at(j+1,34,-.86),at(j+1,0,-.86),2);
    }
    jaws.push({side,part:b.mesh(material(2,side*2.2,2))});
  }
  jaw(-1);jaw(1);
  function gap(t){
    return 3.95-3.11*smooth(11.88,14.68,t)+6.55*smooth(15.285,15.87,t)+8.0*smooth(15.81,16.75,t);
  }
  const jawY=railY(jawAt),jawX=railX(jawAt);
  function update(t,s){
    const opening=smooth(.35,2.90,t);
    for(const {part,i,sector,s:z,dx,dy} of gates){
      const dt=s-z;
      const enter=smooth(-15,-1.6,dt),recoil=envelope(-1,.8,1.28,5.95,dt);
      const reach=(1-opening)*53+(1-enter)*(1.4+.54*sector)+.82*recoil+.12*sector;
      part.position.set(cx(z)+dx*reach,cy(z)+dy*reach,-z);
      part.rotation.set(.06*Math.sin(i*1.3+sector)+.12*dy*recoil,dx*(.13+.23*recoil),
        .13*Math.sin(i*.83)+.12*dx*(1-enter)+.08*dy*recoil);
      part.visible=t>.34&&dt<18&&dt>-75;
    }
    for(const {s:z,side,i,part} of pages){
      const dt=s-z;
      const sweep=smooth(-17,-1,dt),release=smooth(1.7,11,dt);
      const shuffle=envelope(8.92,10.57,10.95,12.1,t);
      part.position.set(cx(z)+side*(6.75+.58*Math.cos(i*.68)),cy(z)-.4,-z);
      part.rotation.set(.08*Math.sin(i*.85),side*(-.70+1.78*sweep-.69*release+.20*shuffle),
        side*(.092+.073*Math.sin(i*1.71)));
      part.material.uniforms.uPress.value=smooth(-13,-4,dt);
      part.visible=t>1.45&&dt<15&&dt>-67;
    }
    for(const {part,side} of banks){part.visible=t>.35&&s<126;part.position.x=side*(1-opening)*45;}
    for(const {part,ceiling} of canopy){part.visible=t>.40&&s<120;part.position.y=(ceiling?1:-1)*(1-opening)*44;}
    const half=gap(t);
    for(const {side,part} of jaws){
      part.visible=t>4&&s<138;
      part.material.uniforms.uCharge.value=envelope(14.36,14.84,15.46,15.76,t);
      part.material.uniforms.uFront.value=mix(-5.6,6.2,smooth(14.45,15.52,t));
      part.position.set(jawX+side*half,jawY,-jawAt);
      part.rotation.y=side*(.012+.135*smooth(15.22,16.32,t));
    }
    return {jawHalfGap:half};
  }
  function gapAtPoint(p,t){
    const y=p.y-jawY,z=p.z+jawAt,half=gap(t);
    let closest=Infinity;
    for(const side of [-1,1]){
      const a=side*(.012+.135*smooth(15.22,16.32,t)),c=Math.cos(a),sn=Math.sin(a);
      const x=p.x-jawX-side*half,localZ=sn*x+c*z;
      if(localZ<-.89||localZ>.035)continue;
      closest=Math.min(closest,side*(fracture(y)-(c*x-sn*z)));
    }
    return closest;
  }
  return {update,gapAtPoint,jawAt};
}
