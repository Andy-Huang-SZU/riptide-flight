'use strict';
function captureTechnical(name){
  const {bird,art,ocean,renderer,scene,camera}=window.proofRig;
  const work=new THREE.Scene(),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const image=(cv,extra={})=>({image:cv.toDataURL('image/png'),...extra});
  if(name==='stamps'){
    const {data,width,height}=art.stamps.image,w=width/4;
    const display=canvas(1440,286),ctx=display.getContext('2d');
    ctx.fillStyle='#f5e9d7';ctx.fillRect(0,0,display.width,display.height);
    const tile=canvas(w,height),tx=tile.getContext('2d');
    for(let j=0;j<4;j++){
      const im=tx.createImageData(w,height),ink=j%2?[166,61,38]:[30,55,65];
      let x0=w,y0=height,x1=0,y1=0;
      for(let y=0;y<height;y++)for(let x=0;x<w;x++){
        const input=((height-y-1)*width+j*w+x)*4,o=(y*w+x)*4,alpha=data[input]/255;
        if(alpha>.4){x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1);}
        const tone=(data[input+1]/255-.35)*18;
        im.data[o]=ink[0]+tone;im.data[o+1]=ink[1]+tone;im.data[o+2]=ink[2]+tone;im.data[o+3]=data[input];
      }
      tx.putImageData(im,0,0);
      const bw=x1-x0+1,bh=y1-y0+1,f=Math.min(326/bw,247/bh);
      ctx.drawImage(tile,x0,y0,bw,bh,360*j+(360-bw*f)/2,(286-bh*f)/2,bw*f,bh*f);
    }
    return image(display);
  }
  if(name==='rig'||name==='mesh'){
    const width=1280,height=620,ratio=2;renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
    work.background=new THREE.Color(0xeaf1f8);
    const state=Flight.pose(2.18);state.pos.set(0,0,0);state.orientation.identity();
    state.flap=.08;state.flex=.07;state.sweep=.08;state.bank=0;state.wave=0;bird.apply(state);
    const material=bird.mesh.material,diagnostic=material.clone();
    if(name==='mesh'){diagnostic.wireframe=true;diagnostic.fragmentShader='void main(){gl_FragColor=vec4(.14,.27,.43,1.);}';bird.mesh.material=diagnostic;}
    work.add(bird.root);
    const eye=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);
    eye.position.set(2.65,-6.5,2.35);eye.up.set(-.5,0,.866);eye.lookAt(0,0,-.37);
    bird.root.updateMatrixWorld(true);
    const points=Object.fromEntries(bird.mesh.skeleton.bones.map(b=>[b.name,b.getWorldPosition(V())]));
    const center=V(0,0,-.37),normal=eye.position.clone().sub(center).normalize();
    const wingAxis=points.TipL.clone().sub(points.TipR);
    const up=normal.clone().cross(wingAxis).normalize();
    const tail=bird.vertex(bird.landmarks.leftFork).add(bird.vertex(bird.landmarks.rightFork)).multiplyScalar(.5);
    if(up.dot(bird.vertex(bird.landmarks.bill).sub(tail))<0)up.negate();
    eye.up.copy(up);eye.lookAt(center);eye.updateMatrixWorld();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let i=0;i<bird.count;i++){
      const q=bird.vertex(i).applyMatrix4(eye.matrixWorldInverse);
      minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
    }
    const hh=Math.max((maxY-minY)*.60,(maxX-minX)*.56*height/width),hw=hh*width/height,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    eye.left=cx-hw;eye.right=cx+hw;eye.top=cy+hh;eye.bottom=cy-hh;eye.updateProjectionMatrix();
    if(name==='mesh'){
      const center=points.TipR.clone().applyMatrix4(eye.matrixWorldInverse);
      const hh=(eye.top-eye.bottom)/10.0,hw=hh*width/height;
      eye.left=center.x-hw;eye.right=center.x+hw;eye.top=center.y+hh;eye.bottom=center.y-hh;eye.updateProjectionMatrix();
    }
    renderer.render(work,eye);
    const dst=canvas(width*ratio,height*ratio),ctx=dst.getContext('2d');ctx.scale(ratio,ratio);ctx.drawImage(renderer.domElement,0,0,width,height);
    const project=vec=>{const q=vec.clone().project(eye);return [(q.x+1)*width*.5,(1-q.y)*height*.5];};
    const bones=bird.mesh.skeleton.bones,positions=Object.fromEntries(bones.map(b=>[b.name,project(b.getWorldPosition(V()))]));
    function line(a,b,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
    if(name==='rig'){
      ctx.lineCap='round';
      for(const pass of [0,1])for(const bone of bones)if(bone.parent?.isBone)line(positions[bone.name],positions[bone.parent.name],pass?'#fbd07c':'#233640',pass?4:9);
      for(const point of Object.values(positions)){ctx.beginPath();ctx.arc(...point,7,0,Math.PI*2);ctx.fillStyle='#ffdc8e';ctx.fill();ctx.strokeStyle='#29323a';ctx.lineWidth=2.5;ctx.stroke();}
      const bill=project(bird.vertex(bird.landmarks.bill));
      const fork=project(bird.vertex(bird.landmarks.leftFork).add(bird.vertex(bird.landmarks.rightFork)).multiplyScalar(.5));
      const dx=bill[0]-fork[0],dy=bill[1]-fork[1],ll=Math.hypot(dx,dy),vx=dx/ll,vy=dy/ll;
      const arrow=Math.min(66,(bill[1]-15)/Math.max(.001,-vy));
      const start=[bill[0]+5*vx,bill[1]+5*vy],end=[bill[0]+arrow*vx,bill[1]+arrow*vy];
      line(start,end,'#034cc5',4);line(end,[end[0]-16*vx+8*vy,end[1]-16*vy-8*vx],'#034cc5',4);
      line(end,[end[0]-16*vx-8*vy,end[1]-16*vy+8*vx],'#034cc5',4);
      ctx.font='600 28px sans-serif';ctx.textBaseline='middle';ctx.lineJoin='round';
      function label(target,text,right,y){
        const elbow=right?width-245:245,edge=right?width-160:148;
        const lcolor='#175da3';line(target,[elbow,y],lcolor,2);line([elbow,y],[edge,y],lcolor,2);
        ctx.textAlign=right?'left':'right';const tx=edge+(right?8:-8);
        ctx.strokeStyle='#eaf1f8';ctx.lineWidth=7;ctx.strokeText(text,tx,y);
        ctx.fillStyle='#123c68';ctx.fillText(text,tx,y);
      }
      label(bill,'bill',true,80);label(fork,'tail fork',false,height-65);
      const tips=[positions.TipL,positions.TipR].sort((a,b)=>a[0]-b[0]);
      label(tips[1],'outer wing',true,height-122);
    }
    scene.add(bird.root);bird.mesh.material=material;diagnostic.dispose();return image(dst,{joints:positions});
  }
  renderer.setPixelRatio(2);renderer.setSize(1400,768,false);seek(17.171);
  const water=ocean.water,mat=water.material.clone();
  mat.fragmentShader=`varying vec2 vArt; varying vec3 vWorld;
    void main(){
      if(-vWorld.z<116.)discard;
      ${name==='wire-side'?'if(vArt.x<0.||vArt.x>1.||vArt.y<0.||vArt.y>1.)discard; if(vWorld.x>1.0&&vWorld.y>-.8)discard;':''}
      vec2 cell=(vArt+vec2(.62,.64))/vec2(2.30,2.32)*vec2(205.,127.)/5.;
      vec2 dist=abs(fract(cell-.5)-.5)/max(fwidth(cell),vec2(.0001));
      float g=1.-smoothstep(1.15,3.1,min(dist.x,dist.y));
      float depth=clamp((-vWorld.z-126.)/72.,0.,1.);
      vec3 base=mix(vec3(.86,.92,.98),vec3(.63,.81,.92),depth),ink=mix(vec3(.07,.24,.49),vec3(.035,.36,.48),depth);
      gl_FragColor=vec4(mix(base,ink,g),1.);}`;
  const model=new THREE.Mesh(water.geometry,mat);model.frustumCulled=false;work.add(model);work.background=new THREE.Color(0xf0f5fa);
  let eye=camera;
  if(name==='wire-side'){eye=new THREE.OrthographicCamera(-49,49,26.88,-26.88,.1,300);eye.position.set(72,30,-124);eye.lookAt(0,0,-164);eye.updateMatrixWorld();}
  renderer.render(work,eye);const dst=canvas(2800,1536);dst.getContext('2d').drawImage(renderer.domElement,0,0);
  mat.dispose();return image(dst);
}
