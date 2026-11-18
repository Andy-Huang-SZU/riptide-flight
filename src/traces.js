'use strict';

function makeTraces(scene,pastWing){
  const {V,TAU,mix,smooth,envelope,railX,railY}=Flight;
  let seed=2107;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const pigments=[[.77,.28,.11],[.99,.69,.28],[.85,.69,.42],[.94,.86,.64],[.13,.27,.36],[.9,.81,.60]];
  const items=[];
  for(const [event,count] of [[3.449,24],[5.805,27],[7.695,25],[10.531,26],[15.279,104],[17.171,54],[19.065,34],[20.953,44]]){
    for(let i=0;i<count;i++){
      const t0=event-.08+rnd()*(event===15.279?.43:.34);
      const p=Flight.pose(t0),side=rnd()<.5?-1:1;
      let origin,velocity;
      if(event===15.279){
        const y=(rnd()-.46)*6.2;
        origin=V(railX(114.8)+side*(.86+.18*rnd())+.16*y,railY(114.8)+y,-114.8+.15*rnd());
        velocity=V(side*(1.0+4.4*rnd()),.7+3.1*rnd(),-.2-1.9*rnd());
      }else if(event>=17){
        const a=mix(-.8,2.85,rnd()),z=p.s+1.1+5*rnd(),radius=3.5+rnd()*3;
        origin=V(railX(z)+Math.cos(a)*radius,railY(z)+Math.sin(a)*radius,-z);
        velocity=V(-Math.sin(a)*2.5,.8+Math.cos(a)*2.3,-1.2-rnd());
      }else{
        origin=pastWing(t0,side<0?0:1);velocity=V(side*(1.0+2.0*rnd()),.2+1.1*rnd(),-.35-rnd());
      }
      items.push({t0,origin,velocity,life:.46+rnd()*.85,length:.033+.19*rnd()**2,
        width:.013+.061*rnd()**2,angle:rnd()*TAU,spin:(rnd()-.5)*8,color:pigments[Math.floor(rnd()*pigments.length)]});
    }
  }
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexColors:true,transparent:true,depthWrite:false,
    vertexShader:'attribute float aInk;varying vec3 vCol;varying float vInk;void main(){vCol=color;vInk=aInk;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vCol;varying float vInk;void main(){if(vInk<.015)discard;gl_FragColor=vec4(vCol,vInk);}'});
  function buffer(slots){
    const g=new THREE.BufferGeometry();
    for(const [name,size] of [['position',3],['color',3],['aInk',1]])g.setAttribute(name,new THREE.BufferAttribute(new Float32Array(slots*size),size).setUsage(THREE.DynamicDrawUsage));
    const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.renderOrder=3;scene.add(m);
    let i=0;return {begin(){i=0;},vertex(p,color,alpha){
      g.attributes.position.setXYZ(i,p.x,p.y,p.z);g.attributes.color.setXYZ(i,...color);g.attributes.aInk.setX(i,alpha);i++;
    },end(){g.setDrawRange(0,i);for(const a of Object.values(g.attributes))a.needsUpdate=true;m.visible=i>0;}};
  }
  const flow=buffer(6*32*2),chips=buffer(items.length*3);
  const strokes=[[2.92,3.46,3.60,4.32],[4.98,5.78,6.12,6.86],[7.1,7.72,8.08,8.66],
    [9.87,10.55,10.8,11.45],[15.40,15.65,15.82,16.08],[16.5,17.32,17.92,18.68],[18.70,19.07,19.56,20.36],[20.32,21.04,21.31,22.06]];
  return (t,p,camera)=>{
    const eyeX=V().setFromMatrixColumn(camera.matrixWorld,0),eyeY=V().setFromMatrixColumn(camera.matrixWorld,1);
    const visibility=Math.max(...strokes.map(w=>envelope(...w,t)));
    flow.begin();
    if(visibility>.003)for(let side=0;side<2;side++){
      const pen=side===0?(.5+.5*p.wave):.86,colour=side===0?[.91,.55+.15*p.wave,.26]:[.93,.80,.52];
      let last=null;
      for(let j=0;j<=32;j++){
        const u=j/32,anchor=pastWing(t-u*(.26+.18*visibility),side);
        const ahead=pastWing(t-u*(.26+.18*visibility)-.005,side);
        const normal=ahead.sub(anchor).cross(camera.position.clone().sub(anchor)).normalize();
        const width=(side===0?.026:.017)*Math.pow(1-u,.66)*(.58+.42*Math.sin(u*9+.2)**2);
        const alpha=visibility*pen*(.65+.15*p.wave)*Math.sin(Math.PI*(.08+.92*u))**.56*(1-u);
        const now=[anchor.clone().addScaledVector(normal,width),anchor.clone().addScaledVector(normal,-width),alpha];
        if(last){for(const [pair,idx] of [[last,0],[last,1],[now,0],[now,0],[last,1],[now,1]])flow.vertex(pair[idx],colour,pair[2]);}
        last=now;
      }
    }
    flow.end();chips.begin();
    for(const it of items){
      const age=t-it.t0;if(age<0||age>=it.life)continue;const u=age/it.life;
      const point=it.origin.clone().addScaledVector(it.velocity,age);point.y-=1.2*age*age;
      const a=it.angle+it.spin*age,leaf=eyeX.clone().multiplyScalar(Math.cos(a)).addScaledVector(eyeY,Math.sin(a)).multiplyScalar(it.length);
      const across=eyeY.clone().multiplyScalar(Math.cos(a)).addScaledVector(eyeX,-Math.sin(a)).multiplyScalar(it.width*(.35+.65*Math.abs(Math.cos(a*.74))));
      const alpha=smooth(0,.08,u)*(1-smooth(.48,1,u))*.87;
      chips.vertex(point.clone().sub(leaf),it.color,alpha);chips.vertex(point.clone().add(leaf),it.color,alpha*.86);
      chips.vertex(point.clone().add(across).addScaledVector(leaf,.32),it.color,alpha);
    }
    chips.end();
  };
}
