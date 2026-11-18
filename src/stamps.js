'use strict';

// Four impressions made from the actual skinned swallow, printed onto the passage walls.
function makeWingStamps(renderer,bird){
  const slots=4,W=Math.min(1280,Math.floor(renderer.capabilities.maxTextureSize/slots));
  const H=Math.round(W*208/320),out=new Uint8Array(W*slots*H*4);
  const stage=new THREE.Scene(),target=new THREE.WebGLRenderTarget(W,H,{depthBuffer:true,generateMipmaps:false,samples:Math.min(4,renderer.capabilities.maxSamples)});
  const camera=new THREE.OrthographicCamera(-2.19,2.19,1.42,-1.42,.1,18);
  const original=bird.mesh.material,oldParent=bird.root.parent;
  const paper=!!bird.mesh.geometry.getAttribute('aPaperInk');
  const map=new THREE.ShaderMaterial({uniforms:original.uniforms,vertexShader:original.vertexShader,side:original.side,
    fragmentShader:(paper?'varying vec4 vPaperInk;':'')+`varying vec2 vUv;varying vec3 vN,vP;uniform sampler2D uPigment;void main(){
      vec3 ink=texture2D(uPigment,vUv).rgb;float value=dot(ink,vec3(.23,.63,.14));
      ${paper?'value=dot(vPaperInk,vec4(.82,.47,.36,.16))/max(.001,dot(vPaperInk,vec4(1.)));':''}
      gl_FragColor=vec4(1.,value,.5+.5*normalize(vN).y,1.);}`});
  stage.add(bird.root);bird.mesh.material=map;
  for(let i=0;i<slots;i++){
    const state=Flight.pose(2.11+i*.127);
    // All four impressions use the same view and differ in their wing phase.
    state.pos.set(0,0,0);bird.apply(state);
    camera.position.set(3.45,5.2,1.75);camera.lookAt(0,0,.17);camera.updateMatrixWorld();
    renderer.setRenderTarget(target);renderer.setClearColor(0x000000,1);renderer.clear();
    renderer.render(stage,camera);
    const pixels=new Uint8Array(W*H*4);renderer.readRenderTargetPixels(target,0,0,W,H,pixels);
    for(let row=0;row<H;row++)out.set(pixels.subarray(row*W*4,(row+1)*W*4),4*W*(row*slots+i));
  }
  bird.mesh.material=original;stage.remove(bird.root);if(oldParent)oldParent.add(bird.root);
  renderer.setRenderTarget(null);target.dispose();map.dispose();
  const tex=new THREE.DataTexture(out,W*slots,H);tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;tex.anisotropy=16;return tex;
}
