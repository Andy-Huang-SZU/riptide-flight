'use strict';

// The landscape has three physical leaves. They carry the same landscape coordinates
// across the first tear and tip far enough to expose the relief behind them.
function makeOpeningPrint(scene,texture,micro){
  const {smooth}=Flight;
  const sheets=[];
  const vs=`varying vec2 vPage;varying float vBend;uniform float uTime,uLeaf;
    float ease(float a,float b,float t){float f=clamp((t-a)/(b-a),0.,1.);return f*f*(3.-2.*f);}
    void main(){vec2 p=uv;vPage=p;float y=p.y-.5;
      float delay=uLeaf==1.?.19*(1.-p.y):.17*p.y;
      float a=uLeaf==0.?.48:uLeaf==1.?.84:.61;
      float w=ease(a+delay,a+1.23+delay,uTime);
      float bend=sin(w*3.14159);
      vec2 result=p;
      if(uLeaf==0.){result.x-=w*(1.38-.16*y);result.y+=.21*w+.078*bend*sin(p.y*3.4);}
      else if(uLeaf==1.){result.y+=1.42*w;result.x-=.31*w+.16*bend*(p.x-.37);result.y+=.105*bend*sin(p.x*3.8);}
      else {result.x+=w*(1.42+.19*y);result.y-=.21*w+.06*bend*sin(p.y*4.3);}
      result.x+=.065*bend*y*y;
      vBend=bend;
      gl_Position=vec4(result.x*2.-1.,1.-result.y*2.,0.,1.);}`;
  const fs=`varying vec2 vPage;varying float vBend;uniform sampler2D uDawn;uniform float uLeaf,uTime,uScale,uRoll;uniform vec2 uDelta;
    ${PrintedSurface.landscape}
    float rift(float v){return .013*sin(v*18.+.5)+.005*sin(57.*v)+.0028*sin(147.*v)+.0011*sin(363.*v);}
    void main(){
      if(any(lessThan(vPage,vec2(0.)))||any(greaterThan(vPage,vec2(1.))))discard;
      float a=.28+.51*(vPage.y-.5)+rift(vPage.y);
      float b=.67+.37*(vPage.y-.5)-rift(vPage.y+.49);
      float dist=uLeaf==0.?a-vPage.x:uLeaf==1.?min(vPage.x-a,b-vPage.x):vPage.x-b;
      if(dist<0.)discard;
      vec2 d=(vPage-.5)*vec2(1.77778,1.);float c=cos(uRoll),s=sin(uRoll);
      d=mat2(c,s,-s,c)*d/vec2(1.77778,1.);
      vec2 p=.5+d/uScale+uDelta;vec3 col=printedDawn(p,uDelta);
      col*=1.-.115*dot(d,d);
      float rim=(1.-smoothstep(.001,.009,dist))*smoothstep(.34,.70,uTime);
      float shadow=vBend*exp(-max(0.,dist)*10.);
      col*=1.-.45*shadow-.061*vBend;
      col=mix(col,vec3(.96,.78,.49),rim*(.68+.32*vBend));
      gl_FragColor=vec4(col,1.);}`;
  for(let i=0;i<3;i++){
    const uniforms={uDawn:{value:texture},uMicro:{value:micro},uTime:{value:0},uLeaf:{value:i},
      uScale:{value:1.12},uRoll:{value:0},uDelta:{value:new THREE.Vector2()}};
    const g=new THREE.PlaneGeometry(1,1,72,50),uv=g.getAttribute('uv');
    for(let j=0;j<uv.count;j++)uv.setXY(j,-.26+1.52*uv.getX(j),-.28+1.56*uv.getY(j));
    const m=new THREE.Mesh(g,new THREE.ShaderMaterial({side:THREE.DoubleSide,depthTest:false,depthWrite:false,uniforms,
      vertexShader:vs,fragmentShader:fs}));
    m.frustumCulled=false;m.renderOrder=2+i;scene.add(m);sheets.push(m);
  }
  return (t,un)=>{
    for(const m of sheets){m.visible=t>.01&&t<2.62;
      m.material.uniforms.uTime.value=t;m.material.uniforms.uScale.value=un.uScale.value;
      m.material.uniforms.uDelta.value.copy(un.uDelta.value);m.material.uniforms.uRoll.value=un.uRoll.value;}
  };
}

function makeLooseStrokes(scene,tideTexture,micro){
  const {V,TAU,mix,smooth,clamp}=Flight, strokes=[];
  const vert=`attribute float aU,aEdge;uniform float uTime,uIndex,uLift,uRelease;varying float vU,vEdge,vLife;varying vec2 vArt;varying vec3 vWorld;
    const float TAU=6.28318530718;
    void main(){
      float i=uIndex,u=aU,e=aEdge;
      float s=150.+9.*i+(41.-1.6*i)*u;
      float turn=.72+.16*sin(i*3.);float a=1.28+i*1.57+u*(2.95+turn)+.27*sin(u*8.+i*1.73);
      float born=smoothstep(17.98+u*.90+i*.07,19.65+u*.55+i*.08,uTime);
      float leave=smoothstep(21.58+i*.10,23.40+i*.13,uTime);
      a+=born*(.66+.42*u)-leave*(.69+.33*u);
      float rad=5.69+1.35*sin(u*5.+i)+u*(1.15+.27*i)+leave*(14.+9.*u);
      float taper=pow(max(0.,sin(3.14159*pow(u,.91))),.61);
      float rough=.05*sin(u*77.+i*4.)+.026*sin(u*193.+i*7.)+.018*sin(u*363.);
      float spread=taper*(.69+.34*sin(i*4.+.5))*(1.+.43*sin(u*10.+i));
      float y=e*spread*(1.+rough)+rough*taper;
      a+=y/rad;
      rad+=(1.-e*e)*spread*.29+e*.28+.23*sin(u*13.+i);
      vec2 axis=vec2(1.10*sin(s*TAU/69.-.60)+.54*sin(s*TAU/34.5+.45),
        .54*sin(s*TAU/51.75+.50)+.22*sin(s*TAU/29.57143-.3));
      vWorld=vec3(axis+vec2(cos(a),sin(a))*rad,-s+leave*(3.+2.*i));
      vU=u;vEdge=e;vLife=born*(1.-leave);vArt=vec2(.067+.84*u+.05*sin(i),.75+.105*e+.053*sin(7.*u+i*1.3));
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
  const frag=`uniform sampler2D uTide;uniform float uIndex;varying float vU,vEdge,vLife;varying vec2 vArt;varying vec3 vWorld;
    ${PrintedSurface.oil}
    void main(){float e=abs(vEdge),u=vU;vec3 paint=texture2D(uTide,vArt).rgb;
      float l=dot(paint,vec3(.24,.63,.13));
      float groove=.45+.55*sin(vEdge*57.+u*25.+5.*sin(u*8.+uIndex)+6.*l);
      float tear=e+.065*sin(u*147.+vEdge*16.)+.055*(1.-l);
      if(tear>.99||vLife<.006||u>.32+.68*vLife)discard;
      float split=smoothstep(.65,.99,u)*smoothstep(.12,.7,groove);
      if(split>.47 && e>.39)discard;
      vec3 gold=mix(vec3(.24,.12,.066),vec3(.99,.81,.44),.20+.76*l+.10*groove);
      vec3 deep=mix(vec3(.039,.094,.15),vec3(.23,.55,.62),l);
      vec3 col=mix(paint,deep,.40);
      float rim=smoothstep(.42,.96,vEdge+.11*sin(u*12.+uIndex));
      col=mix(col,gold,rim*(.52+.36*groove));
      if(mod(uIndex,3.)>1.5)col=mix(gold,paint,.32+.29*groove);
      vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));float illum=.72+.28*abs(dot(n,normalize(vec3(-.3,.78,.49))));
      col+=oilRelief(vArt)*vec3(.23,.20,.14);
      gl_FragColor=vec4(col*illum,1.);}`;
  for(let i=0;i<5;i++){
    const g=new THREE.PlaneGeometry(1,1,168,5),uv=g.getAttribute('uv'),u=[],edge=[];
    for(let j=0;j<uv.count;j++){u.push(uv.getX(j));edge.push(2*uv.getY(j)-1);}
    g.setAttribute('aU',new THREE.Float32BufferAttribute(u,1));g.setAttribute('aEdge',new THREE.Float32BufferAttribute(edge,1));
    const m=new THREE.Mesh(g,new THREE.ShaderMaterial({side:THREE.DoubleSide, uniforms:{uTide:{value:tideTexture},uMicro:{value:micro},
      uTime:{value:0},uIndex:{value:i},uLift:{value:0},uRelease:{value:0}},vertexShader:vert,fragmentShader:frag}));
    m.frustumCulled=false;scene.add(m);strokes.push(m);
  }
  return t=>{for(const m of strokes){m.visible=t>18&&t<24.1;m.material.uniforms.uTime.value=t;}};
}
