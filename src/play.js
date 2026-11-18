'use strict';
(()=>{
  const el=id=>document.getElementById(id),canvas=el('view'),audio=el('score'),slider=el('scrub');
  const opts=new URLSearchParams(location.search),isRender=opts.has('render');
  if(isRender){document.documentElement.classList.add('render');const h=Number(opts.get('size'))||540;canvas.width=h*16/9;canvas.height=h;}
  let film,current=0,raf=0,resume=false;const chips=[];
  window.motion={duration:SCORE.duration,width:3840,height:2160,fps:60,bpm:SCORE.bpm,beats:SCORE.beats.map(b=>b.time_s),loop:true};
  window.seek=(t,info=false)=>{current=Flight.clamp(Number(t)||0,0,SCORE.duration);return film.draw(current,info);};
  const time=t=>'0:'+t.toFixed(1).padStart(4,'0');
  function show(t){
    window.seek(t);slider.value=current;el('time').textContent=time(current)+' / 0:26.5';
    const which=Riptide.chapters.findLastIndex(([,s])=>s<=current+.01);
    chips.forEach((b,i)=>{if(which===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  }
  function jump(t){audio.currentTime=t;show(t);}
  function sizeToDisplay(){
    const box=el('stage').getBoundingClientRect();
    const cssWidth=Math.min(box.width,box.height*16/9);
    const width=Math.min(3840,Math.max(16,16*Math.round(cssWidth*(window.devicePixelRatio||1)/16)));
    const height=width*9/16;
    if(width===canvas.width && height===canvas.height)return;
    if(film){film.resize(width,height);show(current);}
    else{canvas.width=width;canvas.height=height;}
  }
  function tick(){if(!audio.paused){show(audio.currentTime);raf=requestAnimationFrame(tick);}}
  async function play(){if(audio.paused){if(current>SCORE.duration-.04)jump(0);await audio.play();}else audio.pause();}
  function controls(){
    Riptide.chapters.forEach(([name,t])=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>jump(t);el('chapters').append(b);chips.push(b);});
    el('play').onclick=()=>play();canvas.onclick=()=>play();
    audio.onplay=()=>{cancelAnimationFrame(raf);el('play').textContent='Pause';tick();};
    audio.onpause=()=>{cancelAnimationFrame(raf);el('play').textContent='Play';};
    slider.onpointerdown=()=>{resume=!audio.paused;if(resume)audio.pause();};
    const resumeIfNeeded=()=>{if(resume){resume=false;audio.play();}};
    window.addEventListener('pointerup',resumeIfNeeded);window.addEventListener('pointercancel',resumeIfNeeded);
    slider.oninput=()=>jump(slider.valueAsNumber);
    el('mute').onclick=()=>{audio.muted=!audio.muted;el('mute').textContent=audio.muted?'Sound off':'Sound on';};
    const stage=el('stage');
    function expanded(state){
      stage.classList.toggle('expanded',state);el('exit').hidden=!state;
      el('fs').setAttribute('aria-expanded',String(state));sizeToDisplay();
    }
    async function closeFull(){
      expanded(false);
      if(document.fullscreenElement)await document.exitFullscreen();
    }
    el('fs').onclick=async()=>{
      expanded(true);
      try{await stage.requestFullscreen?.();}catch{/* The stage already fills the browser window. */}
    };
    el('exit').onclick=closeFull;
    document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)expanded(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('expanded'))closeFull();});
    document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();play();}});
  }
  const texture=async([name,source])=>{const pic=new Image();
    const master=isRender||opts.get('quality')==='master'||(screen.width*devicePixelRatio>2950);
    pic.src=typeof source==='string'?source:(master?source.full:source.screen);
    await pic.decode();const tex=new THREE.Texture(pic);
    tex.colorSpace=THREE.NoColorSpace;tex.wrapS=tex.wrapT=name==='dawn'?THREE.ClampToEdgeWrapping:THREE.MirroredRepeatWrapping;
    tex.anisotropy=16;tex.needsUpdate=true;return [name,tex];};
  window.ready=(async()=>{
    const [images,rig]=await Promise.all([Promise.all(Object.entries(ASSETS).map(texture)),
      new SwallowLoader.GLTFLoader().loadAsync(RIG)]);
    if(!isRender)sizeToDisplay();
    film=Riptide.create(canvas,Object.fromEntries(images),rig);
    if(isRender){window.audit=film.audit;}else{
      controls();
      new ResizeObserver(sizeToDisplay).observe(el('stage'));
      window.addEventListener('resize',sizeToDisplay);
      document.addEventListener('fullscreenchange',sizeToDisplay);
    }
    const start=isRender?0:Flight.clamp(Number(opts.get('t'))||0,0,SCORE.duration);
    if(start)jump(start);else show(0);el('notice').hidden=true;return true;
  })().catch(e=>{el('notice').textContent='This film needs WebGL 2.';console.error(e);throw e;});
})();
