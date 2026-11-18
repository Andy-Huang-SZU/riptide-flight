'use strict';

const Riptide=(()=>{
  const {V,TAU,clamp,mix,smooth,envelope,pose,makeBird,distance,railX,railY}=Flight;
  const T=SCORE.duration;
  const chapters=[['Sun',0],['Print gallery',3.449],['Hinged pages',7.695],['Ink fissure',12.895],['Wave',15.279],['Return',20.953]];
  const look=[
    // t, eye right, eye above, eye behind, vertical FOV, subject x, subject y, lens roll
    [0,8.3,2.75,4.65,43,.37,.48,-.015],[.64,8.15,2.68,4.69,43,.37,.48,-.017],
    [2.06,4.3,1.45,5.62,56,.40,.49,-.066],[3.47,2.6,.80,6.70,62,.43,.51,-.127],
    [5.03,4.48,1.98,4.95,55,.37,.51,-.18],[5.90,3.12,.94,4.83,58,.38,.55,-.10],
    [7.37,2.61,-.47,5.55,63,.46,.50,.043],[8.38,3.29,-.79,6.50,59,.44,.53,.14],
    [9.92,4.60,1.93,5.42,53,.39,.55,.17],[11.48,2.93,2.45,6.15,61,.4,.55,.06],
    [12.93,1.8,.92,7.35,56,.48,.54,.011],[14.48,1.51,.55,6.30,49,.47,.55,-.033],
    [15.27,1.62,.25,5.86,48,.44,.56,-.067],[16.20,3.32,1.38,5.23,64,.41,.54,-.16],
    [17.29,3.92,2.64,4.93,60,.42,.56,-.20],[18.47,2.69,2.83,6.60,65,.47,.55,-.085],
    [19.68,2.67,1.10,7.05,61,.42,.54,.089],[20.99,2.16,-.22,7.13,62,.40,.52,.115],
    [22.06,3.45,1.34,6.75,57,.42,.51,.04],[23.37,7.18,2.13,5.85,50,.47,.46,-.021],
    [24.85,8.23,2.78,4.72,43,.377,.48,-.018],[26.5,8.3,2.75,4.65,43,.37,.48,-.015]
  ];
  function cameraAt(t){
    const i=Math.min(look.length-2,Math.max(0,look.findLastIndex(row=>row[0]<=t)));
    const a=look[i],b=look[i+1],p=look[Math.max(0,i-1)],n=look[Math.min(look.length-1,i+2)];
    const span=b[0]-a[0],w=clamp((t-a[0])/span);
    return a.slice(1).map((v,j)=>{
      const k=j+1,va=i?span*(b[k]-p[k])/(b[0]-p[0]):0,vb=i<look.length-2?span*(n[k]-a[k])/(n[0]-a[0]):0;
      return mix(v,b[k],w*w*(3-2*w))+w*(1-w)*(va*(1-w)-vb*w);
    });
  }
  function sky(scene,texture,rock,micro){
    const un={uDawn:{value:texture},uMicro:{value:micro},uDelta:{value:new THREE.Vector2()},uScale:{value:1},uRoll:{value:0},uDepth:{value:0},uBed:{value:0},uRock:{value:rock}};
    const paper=makeOpeningPrint(scene,texture,micro);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
      uniforms:un,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.999999,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D uDawn,uRock;uniform vec2 uDelta;uniform float uScale,uRoll,uDepth,uBed;
      ${PrintedSurface.landscape}
      void main(){vec2 uv=vec2(vUv.x,1.-vUv.y),d=(uv-.5)*vec2(1.77778,1.);
        float c=cos(uRoll),s=sin(uRoll);d=mat2(c,s,-s,c)*d/vec2(1.77778,1.);
        vec2 p=vec2(.50,.50)+d/uScale+uDelta;
        vec3 col=printedDawn(p,uDelta);
        float vign=dot(d,d);col*=1.-.115*vign;
        col=mix(col,vec3(.71,.58,.43),uDepth*.18);
        vec3 vein=texture2D(uRock,p*.70+vec2(.17,.15)).rgb;
        float ink=dot(vein,vec3(.25,.63,.12));
        float light=exp(-2.7*length((p-vec2(.67,.47))*vec2(1.,1.65)));
        vec3 inside=mix(vec3(.094,.068,.085),vec3(.78,.30,.12),light*(.68+.29*ink));
        inside+=vec3(.067,.044,.026)*(ink-.40);
        col=mix(col,inside,uBed);
        gl_FragColor=vec4(col,1.);}`}));
    plane.frustumCulled=false;plane.renderOrder=-100;scene.add(plane);
    return (t,roll,cx,cy)=>{
      const p=t/T*TAU;
      const inside=envelope(.65,4.20,20.10,23.25,t);
      un.uDelta.value.set(.024*Math.sin(p)+.035*inside+.023*Math.sin(2*p)*inside,
        .011*Math.sin(2*p-.3)+.016*inside);
      un.uScale.value=1.12+.10*inside+.029*Math.sin(p);
      un.uRoll.value=.45*roll;un.uDepth.value=inside;un.uBed.value=envelope(.012,.76,11.61,13.85,t);paper(t,un);
    };
  }
  function create(canvas,art,rig){
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setSize(canvas.width,canvas.height,false);renderer.setPixelRatio(1);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(52,canvas.width/canvas.height,.09,245);
    const bird=makeBird(rig);scene.add(bird.root);
    art.stamps=makeWingStamps(renderer,bird);
    const sheet=makePrintworks(scene,art), ocean=makeTide(scene,art), setSky=sky(scene,art.dawn,art.strata,art.micro);
    const samples=120,count=Math.round(T*samples);
    const trail=Array.from({length:count+1},(_,i)=>{
      const p=pose(i/samples);bird.apply(p);
      return bird.wings.map(id=>bird.vertex(id));
    });
    function pastWing(t,side){
      const n=Math.floor(t/T),k=(t-n*T)*samples,i=Math.min(count-1,Math.max(0,Math.floor(k)));
      const p=trail[i][side].clone().lerp(trail[i+1][side],k-i);
      p.z-=207*n;return p;
    }
    const marks=makeTraces(scene,pastWing), loose=makeLooseStrokes(scene,art.tide,art.micro);
    bird.mesh.renderOrder=8;
    function setCamera(t,p){
      const [x,y,z,fov,cx,cy,roll]=cameraAt(t), bob=.067*Math.sin(t/T*TAU*2);
      camera.position.copy(p.pos).add(V(x,y+bob,z));
      // The lens follows the mean route. Wingbeats can move the torso inside the frame.
      const aim=p.pos.clone();aim.y=mix(aim.y,railY(p.s),.42*envelope(1.6,3.1,20.5,22.3,t));
      camera.up.set(0,1,0);camera.lookAt(aim);camera.rotateZ(roll);
      camera.fov=fov;camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8]=-2*(cx-.5);camera.projectionMatrix.elements[9]=2*(cy-.5);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld();
      setSky(t,roll,cx,cy);
    }
    function anatomy(p){
      const bill=bird.vertex(bird.landmarks.bill), l=bird.vertex(bird.landmarks.leftFork),r=bird.vertex(bird.landmarks.rightFork);
      const fork=l.add(r).multiplyScalar(.5), actual=bill.clone().sub(fork).normalize();
      const project=v=>{const ndc=v.clone().project(camera);return [(ndc.x+1)/2,(1-ndc.y)/2];};
      const projected=project(bill),tail=project(fork),center=project(p.pos);
      return {heading:actual.dot(p.tangent),front:projected,tail,center,headLead:projected[0]-tail[0]};
    }
    function draw(t,info=false){
      if(t===T)t=0;
      const p=pose(t);setCamera(t,p);bird.apply(p);
      const jaw=sheet.update(t,p.s),wave=ocean.update(t,p.s);marks(t,p,camera);loose(t);
      renderer.render(scene,camera);
      return info?{time:t,distance:p.s,...jaw,...wave,...anatomy(p)}:null;
    }
    function audit(){
      let heading=1, lowLead=1,behind=0,clear=Infinity,minZSpeed=Infinity,maxRoll=0;
      let wingGap=Infinity,when=0, checkedVerts=0,clipFrames=0;
      const contact=V(),prev=pose(-1/60);
      for(let i=0;i<=T*60;i++){
        const t=i/60,p=pose(t);setCamera(t,p);bird.apply(p);
        const a=anatomy(p);heading=Math.min(heading,a.heading);lowLead=Math.min(lowLead,a.headLead);
        if(a.headLead<=0)behind++;
        maxRoll=Math.max(maxRoll,Math.abs(p.bank));
        minZSpeed=Math.min(minZSpeed,(prev.pos.z-p.pos.z)*60);prev.pos.copy(p.pos);
        if(Math.abs(p.s-sheet.jawAt)<3.65){
          let touched=false;
          for(let j=0;j<bird.count;j++){
            bird.mesh.getVertexPosition(j,contact).applyMatrix4(bird.mesh.matrixWorld);
            const dz=-contact.z-sheet.jawAt;
            if(dz<-.15||dz>1.05)continue;
            const gap=sheet.gapAtPoint(contact,t);
            if(!Number.isFinite(gap))continue;
            touched=true;checkedVerts++;
            if(gap<clear){when=t;clear=gap;}
          }
          if(touched)clipFrames++;
          for(const j of bird.wings){const tip=bird.vertex(j);if(Math.abs(-tip.z-sheet.jawAt)<.84)wingGap=Math.min(wingGap,sheet.gapAtPoint(tip,t));}
        }
      }
      return {frames:Math.round(T*60)+1,minHeading:heading,minScreenLead:lowLead,reversedScreenFrames:behind,minForwardSpeed:minZSpeed,
        maxBankDegrees:maxRoll*180/Math.PI,jawClearance:clear,at:when,tipsAtJaw:wingGap,checkedVertices:checkedVerts,jawContactFrames:clipFrames};
    }
    function resize(width,height){
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
    }
    return {draw,audit,resize};
  }
  return {create,chapters};
})();
