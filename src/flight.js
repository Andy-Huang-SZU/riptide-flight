'use strict';

const Flight = (() => {
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const PI=Math.PI, TAU=2*PI, duration=SCORE.duration;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const mix=(a,b,w)=>a+(b-a)*w;
  const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a)); return u*u*(3-2*u);};
  const envelope=(a,b,c,d,t)=>smooth(a,b,t)*(1-smooth(c,d,t));
  const route=[[0,0],[.619,3.1],[1.55,9.0],[3.449,26],[5.805,48],[7.695,63],[10.531,87],
    [12.895,104],[13.367,106.7],[14.781,110.7],[15.279,114],[17.171,132],[19.065,152],
    [20.953,170],[22.845,184],[24.711,197],[26.5,207]];
  const segmentSlopes=route.slice(1).map(([t,s],i)=>(s-route[i][1])/(t-route[i][0]));
  const harmonic=(a,b)=>2*a*b/(a+b);
  const rates=route.map((_,i)=>harmonic(segmentSlopes[(i-1+segmentSlopes.length)%segmentSlopes.length],
    segmentSlopes[i%segmentSlopes.length]));
  function distance(time){
    const cycle=Math.floor(time/duration), t=time-cycle*duration;
    const ix=Math.max(0,route.findLastIndex(([mark])=>mark<=t));
    const [a,p]=route[ix], [b,q]=route[ix+1]||route.at(-1);
    const u=clamp((t-a)/(b-a||1));
    return cycle*207+mix(p,q,u*u*(3-2*u))+(b-a)*u*(1-u)*(rates[ix]*(1-u)-rates[ix+1]*u);
  }
  const railX=s=>1.10*Math.sin(s*TAU/69-.60)+.54*Math.sin(s*TAU/34.5+.45);
  const railY=s=>.54*Math.sin(s*TAU/51.75+.50)+.22*Math.sin(s*TAU/29.571428571-.3);
  // Angles are measured on the mesh. Its cream breast is on +Y and the dark back on -Y.
  const landmarks={bill:24598,leftFork:4098,rightFork:18269};
  const restBill=V(-.18859066,.18707429,.71312815);
  const restTail=V(-.10490214,.15070881,-1.8450555);
  const nose=restBill.clone().sub(restTail).normalize();
  const starboard=V(0,-1,0).cross(nose).normalize();
  const back=nose.clone().cross(starboard).normalize();
  const fromMesh=new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(starboard,back,nose)).invert();
  function cycleTime(t){return t-duration*Math.floor(t/duration);}
  function rhythm(t){
    const u=t/duration;
    return 47*u+.63*Math.sin(TAU*u*2-.7)+.32*Math.sin(TAU*u*4+.45);
  }
  function tuckAt(t){return envelope(12.44,14.27,15.15,15.97,t);}
  function bodyPoint(t){
    const s=distance(t), k=cycleTime(t), phase=TAU*rhythm(t);
    const tuck=tuckAt(k);
    const wave=envelope(15.05,16.24,19.95,21.75,k);
    const lateral=(.36*Math.sin(TAU*3*t/duration-.36)+.17*Math.sin(TAU*6*t/duration))*(1-tuck);
    const rise=wave*(.68*Math.sin((k-15.53)*1.22)+.33);
    return V(railX(s)+lateral,railY(s)+rise+(.067-.044*tuck)*Math.sin(phase-1.12),-s);
  }
  function pose(t){
    const k=cycleTime(t),s=distance(t), pos=bodyPoint(t);
    const tangent=bodyPoint(t+.009).sub(bodyPoint(t-.009)).normalize();
    const wing=TAU*rhythm(t);
    const tuck=tuckAt(k),glide=envelope(17.40,18.45,20.65,21.81,k)+.64*envelope(22.93,23.8,24.65,25.85,k);
    const turn= .20*Math.sin(t*TAU*3/duration+.31)+.14*Math.sin(t*TAU*7/duration-.2)
      -.48*envelope(4.84,5.72,6.27,7.51,k)+.48*envelope(8.77,9.48,10.07,11.46,k)
      +1.31*tuck-.55*envelope(16.10,17.05,17.86,19.15,k)+.34*envelope(19.20,19.8,20.35,21.4,k);
    const right=V(0,1,0).cross(tangent).normalize().applyAxisAngle(tangent,turn);
    const dorsal=tangent.clone().cross(right).normalize();
    const orientation=new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right,dorsal,tangent)).multiply(fromMesh);
    const amplitude=(.64-.42*glide)*(1-.65*tuck);
    return {s,pos,tangent,orientation,bank:turn,tuck,
      flap:.075+amplitude*(.79*Math.sin(wing)+.21*Math.sin(2*wing-.4)),
      flex:.27*Math.sin(wing-1.17)*(1-glide*.82)*(1-tuck*.8),
      sweep:.055+.13*(1-Math.cos(wing-.55))*(1-glide*.68)+.90*tuck,
      twist:.108*Math.cos(wing-.72)*(1-tuck),wave:envelope(14.91,15.72,21.38,22.65,k)};
  }

  function makeBird(gltf){
    const root=new THREE.Group();root.add(gltf.scene);
    let mesh;root.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
    const paperInk=mesh.geometry.getAttribute('_pigment');
    function flatTexture(r,g,b){
      const texture=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1);
      texture.needsUpdate=true;return texture;
    }
    const normalMap=mesh.material.normalMap||flatTexture(128,128,255), map=mesh.material.map||flatTexture(255,255,255);
    if(paperInk)mesh.geometry.setAttribute('aPaperInk',paperInk);
    const points=mesh.geometry.getAttribute('position');
    const ids=paperInk?{bill:0,leftFork:0,rightFork:0}:landmarks;
    const rigToStudio=new THREE.Quaternion();
    if(paperInk){
      let front=-Infinity,left=Infinity,right=Infinity;
      for(let i=0;i<points.count;i++){
        const x=points.getX(i),z=points.getZ(i);
        if(z>front){front=z;ids.bill=i;}
        if(x<0&&z<left){left=z;ids.leftFork=i;}
        if(x>0&&z<right){right=z;ids.rightFork=i;}
      }
      const point=i=>V().fromBufferAttribute(points,i);
      const midTail=point(ids.leftFork).lerp(point(ids.rightFork),.5);
      const fwd=point(ids.bill).sub(midTail).normalize(),rightAxis=V(0,1,0).cross(fwd).normalize();
      const up=fwd.clone().cross(rightAxis);
      const publicRest=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rightAxis,up,fwd));
      rigToStudio.copy(fromMesh).invert().multiply(publicRest.invert());
    }
    map.colorSpace=THREE.NoColorSpace;map.anisotropy=16;normalMap.anisotropy=16;
    map.needsUpdate=normalMap.needsUpdate=true;
    const un={uPigment:{value:map},uRelief:{value:normalMap},uCool:{value:0},uGold:{value:0},uRim:{value:0}};
    const inkDeclaration=paperInk?'attribute vec4 aPaperInk; varying vec4 vPaperInk;':'';
    const inkAssignment=paperInk?'vPaperInk=aPaperInk;':'';
    mesh.material=new THREE.ShaderMaterial({uniforms:un,side:paperInk?THREE.DoubleSide:THREE.FrontSide,vertexShader:
      inkDeclaration+'\n#include <skinning_pars_vertex>\nvarying vec2 vUv; varying vec3 vN,vP; void main(){'+inkAssignment+'vec3 transformed=position;vec3 objectNormal=normal;\n#include <skinbase_vertex>\n#include <skinning_vertex>\n#include <skinnormal_vertex>\nvUv=uv; vN=normalize(mat3(modelMatrix)*objectNormal);vP=(modelMatrix*vec4(transformed,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}',
      fragmentShader:(paperInk?'varying vec4 vPaperInk;':'')+`varying vec2 vUv;varying vec3 vN,vP;uniform sampler2D uPigment,uRelief;uniform float uCool,uGold,uRim;
      void main(){vec3 col=texture2D(uPigment,vUv).rgb;vec3 n=normalize(vN);vec3 dx=dFdx(vP),dy=dFdy(vP);
        ${paperInk?'vec4 pigment=vPaperInk/max(.001,dot(vPaperInk,vec4(1.)));col=pigment.x*vec3(.98,.81,.57)+pigment.y*vec3(.18,.49,.54)+pigment.z*vec3(.86,.32,.17)+pigment.w*vec3(.17,.14,.30);':''}
        vec2 ux=dFdx(vUv),uy=dFdy(vUv);vec3 T=cross(dy,n)*ux.x+cross(n,dx)*uy.x;
        vec3 B=cross(dy,n)*ux.y+cross(n,dx)*uy.y;vec3 detail=texture2D(uRelief,vUv).xyz*2.-1.;
        float k=inversesqrt(max(.0000001,max(dot(T,T),dot(B,B))));vec3 relief=normalize(n+.40*k*(T*detail.x+B*detail.y));
        vec3 view=normalize(cameraPosition-vP);vec3 key=normalize(vec3(-.53,.76,-.31));
        float light=.5+.5*dot(relief,key),edge=pow(1.-abs(dot(view,n)),2.8);
        float l=dot(col,vec3(.24,.61,.15));float cream=smoothstep(.45,.86,l);
        col=mix(col,col*vec3(.81,.91,1.12)+vec3(.01,.029,.046),uCool*.70);
        col=mix(col,vec3(.92,.65,.28)*(.61+.43*l),uGold*.33*cream);
        col*=.73+.30*light; col+=edge*vec3(.30,.18,.085)*(.4+uRim)+cream*.04;
        col+=vec3(.19,.15,.087)*pow(max(0.,dot(reflect(-key,relief),view)),24.);
        gl_FragColor=vec4(col,1.);}`});
    mesh.frustumCulled=false;root.updateMatrixWorld(true);
    const parts=['L','R'].map(name=>{
      const get=label=>{const o=gltf.scene.getObjectByName(label+name);
        if(!o)throw new Error('Missing flight bone '+label+name);
        const world=o.getWorldQuaternion(new THREE.Quaternion());
        return {o,rest:o.quaternion.clone(),world,inv:world.clone().invert()};};
      const wing=get('Wing'),tip=get('Tip'),tail=get('Tail');
      return {wing,tip,tail,side:Math.sign(wing.o.getWorldPosition(V()).x)};
    });
    const e=new THREE.Euler(),q=new THREE.Quaternion();
    function bend(part,x,y,z){part.o.quaternion.copy(part.rest).multiply(part.inv)
      .multiply(q.setFromEuler(e.set(x,y,z))).multiply(part.world);}
    function apply(p){
      root.position.copy(p.pos);root.quaternion.copy(p.orientation).multiply(rigToStudio);
      for(const {wing,tip,tail,side} of parts){
        const flapSide=paperInk?side:-side;
        bend(wing,p.twist,side*p.sweep,flapSide*(p.flap+.077*side*p.bank));
        bend(tip,.11*p.sweep,side*(.055+.28*p.sweep),flapSide*p.flex);
        bend(tail,.042*p.flap,side*(.078-.065*p.tuck),0);
      }
      un.uCool.value=p.wave;un.uGold.value=1-p.wave;un.uRim.value=.43+.30*p.wave;
      root.updateMatrixWorld(true);
    }
    const count=mesh.geometry.attributes.position.count, tmp=V(),wings=[0,0];
    for(let i=0,lo=Infinity,hi=-Infinity;i<count;i++){
      tmp.fromBufferAttribute(mesh.geometry.attributes.position,i);
      if(tmp.x<lo){wings[0]=i;lo=tmp.x;}if(tmp.x>hi){wings[1]=i;hi=tmp.x;}
    }
    const vertex=i=>mesh.getVertexPosition(i,V()).applyMatrix4(mesh.matrixWorld);
    return {root,mesh,apply,vertex,wings,landmarks:ids,count};
  }
  return {V,PI,TAU,clamp,mix,smooth,envelope,distance,railX,railY,cycleTime,pose,makeBird};
})();
