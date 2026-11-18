'use strict';

function makeTide(scene,art) {
  const {V,clamp,mix,smooth,envelope,railX,railY,TAU}=Flight;
  const origin=110.6, eyeU=.669, eyeV=.506;
  const uniforms={uT:{value:0},uRoll:{value:0},uPeel:{value:0},uLift:{value:0},uCarry:{value:0},uTide:{value:art.tide},uMicro:{value:art.micro}};
  // Perspective from the mouth of the barrel reconstructs the painting.
  // Rings nearer the eye of the print are farther down the physical passage.
  const unfold=`
  uniform float uRoll,uPeel,uT,uLift,uCarry;
  varying vec2 vArt; varying vec3 vWorld; varying float vRadius,vFoam;
  const float TAU=6.28318530718;
  vec3 wavePoint(vec2 painted,float standOff){
    vec2 d=painted-vec2(.669,.506);float r=length(vec2(d.x*1.52,d.y));
    float ang=atan(-d.y,1.52*d.x);
    float depth=9.8/(.110+pow(max(r,.000001),1.38));
    float s=107.0+depth+uCarry*(.45+.55*smoothstep(2.,42.,depth));
    float twist=uRoll*(.22+.78*smoothstep(3.,43.,depth))+.08*sin(.15*depth-uT*1.36)*uLift;
    float tear=clamp(uPeel*(.63+.27*sin(ang-.44)+.10*sin(3.*ang+.4)),0.,1.);
    float lip=smoothstep(.11,.38,r)*(1.-smoothstep(.63,.99,r));
    twist-=tear*(.26+.66*lip);
    float c=cos(twist),n=sin(twist);
    vec2 off=vec2(d.x*2.28,-d.y*1.28)*depth;
    off*=1.+tear*(.60+1.1*(1.-smoothstep(.06,.51,r)));
    off*=1.-standOff;
    off=mat2(c,n,-n,c)*off;
    off+=vec2(cos(ang),sin(ang))*(.21*sin(ang*4.+depth*.22-uT*1.6)*uLift*lip);
    vec2 axis=vec2(1.10*sin(s*TAU/69.-.60)+.54*sin(s*TAU/34.5+.45),
      .54*sin(s*TAU/51.75+.50)+.22*sin(s*TAU/29.57143-.3));
    return vec3(axis+off,-s+tear*(4.+4.*cos(ang+.7)));
  }`;
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms,
    vertexShader:unfold+`void main(){vArt=uv;vWorld=wavePoint(uv,0.);
      vRadius=length((uv-vec2(.669,.506))*vec2(1.52,1.));vFoam=0.;
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform sampler2D uTide;uniform float uPeel,uLift;varying vec2 vArt;varying vec3 vWorld;varying float vRadius;
    ${PrintedSurface.oil}
    void main(){if(-vWorld.z<116.0)discard;vec2 off=vArt-vec2(.669,.506);float a=atan(-off.y,off.x*1.52);
      float cut=uPeel*(.42+.13*sin(a-.42)+.046*sin(3.*a+.81)+.016*sin(8.*a));
      vec2 uv=vec2(vArt.x,1.-vArt.y);
      // Continue the tangential stroke direction past the edge of the painted sheet.
      vec2 spill=max(abs(uv-.5)-.5,vec2(0.));
      uv+=vec2(.67*spill.y,-.58*spill.x)+vec2(.11*sin(8.*uv.y)*spill.x,.14*cos(7.*uv.x)*spill.y);
      vec3 rgb=texture2D(uTide,uv).rgb;
      float l=dot(rgb,vec3(.22,.66,.12));
      cut+=uPeel*(.005*sin(27.*a)+.004*sin(47.*a)+.010*(l-.5));
      if(vRadius<cut && uPeel>.0002)discard;
      float edge=uPeel*(1.-smoothstep(.001,.017,vRadius-cut));
      rgb=mix(rgb,vec3(.98,.80,.51)*(.76+.22*l),edge*.85);
      float distanceToEye=length(cameraPosition-vWorld);
      rgb*=.93+.065*smoothstep(.14,.81,l);
      rgb+=oilRelief(uv)*(.19+.12*l)*mix(vec3(.70,.94,1.),vec3(1.,.89,.65),smoothstep(.27,.73,l));
      rgb+=vec3(.006,.017,.018)*smoothstep(32.,100.,distanceToEye);
      gl_FragColor=vec4(rgb,1.);}`});
  const g=new THREE.PlaneGeometry(1,1,205,127);
  const uv=g.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,-.62+2.30*uv.getX(i),-.64+2.32*uv.getY(i));
  const water=new THREE.Mesh(g,material);water.frustumCulled=false;scene.add(water);

  // Separate knife ridges cast moving occlusions along the curling print.
  const crests=[];
  function generateCrest(side,seed){
    const pp=[],uv=[],ids=[],width=[],offset=[];
    for(let i=0;i<=108;i++){
      const t=i/108, a=mix(side===0?.42:2.65,side===0?2.65:4.95,t)+.052*seed;
      const r=(side===0?.53:.40)+.024*seed+.085*Math.sin(t*3.5+.44*seed);
      for(let j=0;j<2;j++){
        const rip=(.0027*Math.sin(i*1.61+seed)+.0014*Math.sin(i*3.39))*(.6+j);
        const spread=(.009+.004*seed)*Math.pow(Math.sin(t*Math.PI),.68);
        const rr=r+j*spread+rip;
        pp.push(0,0,0);uv.push(eyeU+Math.cos(a)*rr/1.52,eyeV-Math.sin(a)*rr);
        width.push(j);offset.push((.036+.024*seed)*Math.sin(t*Math.PI)*(.3+j*.7));
      }
      if(i){const k=2*i;ids.push(k-2,k-1,k,k,k-1,k+1);}
    }
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));
    bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bg.setAttribute('aFlake',new THREE.Float32BufferAttribute(offset,1));
    bg.setAttribute('aEdge',new THREE.Float32BufferAttribute(width,1));bg.setIndex(ids);
    const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms,vertexShader:unfold+`attribute float aFlake,aEdge;
      void main(){vArt=uv;vFoam=aEdge;vWorld=wavePoint(uv,aFlake);vRadius=aFlake;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
      fragmentShader:`varying vec2 vArt;varying vec3 vWorld;varying float vFoam,vRadius;uniform sampler2D uTide;
      ${PrintedSurface.oil}
      void main(){if(-vWorld.z<116.0)discard;vec3 pigment=texture2D(uTide,vec2(vArt.x,1.-vArt.y)).rgb;
        float light=dot(pigment,vec3(.25,.65,.10));if(light<.26 || vRadius<.001)discard;
        vec3 edge=mix(vec3(.35,.26,.15),vec3(.92,.83,.60),light);
        pigment+=oilRelief(vec2(vArt.x,1.-vArt.y))*vec3(.23,.21,.17);
        gl_FragColor=vec4(mix(pigment*.86,edge,smoothstep(.56,.96,vFoam)*.83),1.);}`});
    const crest=new THREE.Mesh(bg,mat);crest.frustumCulled=false;scene.add(crest);crests.push(crest);
  }
  for(let i=0;i<3;i++){generateCrest(0,i);generateCrest(1,i);}
  const waveRoll=t=>.05*envelope(14.6,15.38,15.6,16.6,t)+.80*smooth(15.62,18.35,t)
    -.64*smooth(18.62,20.64,t)-.36*smooth(20.54,21.78,t);
  function update(t,s){
    water.visible=t>6.8&&t<23.75;
    const peel=smooth(19.88,22.65,t);
    for(const crest of crests)crest.visible=water.visible&&peel<.997;
    uniforms.uCarry.value=18.0*smooth(15.35,18.9,t)+9.0*smooth(18.8,20.7,t);
    uniforms.uT.value=t;uniforms.uRoll.value=waveRoll(t);uniforms.uPeel.value=peel;
    uniforms.uLift.value=envelope(14.20,16.32,21.05,22.5,t);
    return {waveRoll:uniforms.uRoll.value,wavePeel:peel};
  }
  return {update};
}
