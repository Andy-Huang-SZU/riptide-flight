'use strict';
(() => {
  const byId=id=>document.getElementById(id);
  const heroMotion=byId('poster').querySelector('.hero-motion');
  const sceneKeys=['tear','fold','bank','peel','art','detail'];
  const times={tear:37/60,fold:632/60,bank:887/60,peel:1286/60};
  const headings={tear:'tear',fold:'fold',bank:'bank',peel:'peel',art:'artTitle',detail:'detailTitle'};
  const thumb={tear:'tear',fold:'fold',bank:'bank',peel:'peel'};
  const nav=byId('inspect'),view=byId('view'),reader=byId('scroll-area');
  const isExport=new URLSearchParams(location.search).has('export');
  let lang=new URLSearchParams(location.search).get('lang')==='zh'?1:0,zoom=false,active=null;
  const t=key=>COPY[key][lang];
  document.documentElement.classList.add(isExport?'export':'reading');
  let inspected=null;
  function resize(){
    if(!isExport){
      document.documentElement.classList.toggle('large-type',zoom);
      return;
    }
    const s=isExport?1:(zoom?Math.max(1,reader.clientWidth/800):reader.clientWidth/800);
    const box=byId('paper-size'),book=byId('book');
    box.style.width=(800*s)+'px';box.style.height=(book.offsetHeight*s)+'px';
    book.style.transform='scale('+s+')';
  }
  const bilingual=[...document.querySelectorAll('[data-zh]')].map(el=>[el,el.textContent,el.dataset.zh]);
  function localize(){
    document.documentElement.lang=lang?'zh-CN':'en';
    bilingual.forEach(([el,en,zh])=>{el.textContent=lang?zh:en;});
    document.querySelectorAll('[data-t]').forEach(el=>el.textContent=t(el.dataset.t));
    document.querySelectorAll('[data-alt]').forEach(el=>el.alt=t(el.dataset.alt));
    document.querySelectorAll('[data-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.aria)));
    byId('en').setAttribute('aria-pressed',String(!lang));byId('zh').setAttribute('aria-pressed',String(!!lang));
    byId('zoom').textContent=t(zoom?'fit':'zoom');
    if(active==='asset' && inspected)populateAsset(inspected);else if(active)populate(active);
    resize();
  }
  function picture(src,alt){
    const im=new Image();im.src=src;im.alt=alt;return im;
  }
  function wipe(){
    const n=Number(byId('wipe').value),front=view.querySelector('.front'),split=view.querySelector('.split');
    if(front){front.style.clipPath='inset(0 '+(100-n)+'% 0 0)';split.style.left=n+'%';}
  }
  function populateAsset(img){
    active='asset';inspected=img;nav.classList.add('big-inspect');
    const cap=img.closest('figure')?.querySelector('figcaption');
    const title=cap?.querySelector('b')?.textContent||img.alt;
    byId('modal-kicker').textContent=lang?'原始工程图':'Production image';
    byId('modal-title').textContent=title;
    byId('modal-text').textContent=cap?.querySelector('span')?.textContent||'';
    byId('jump').hidden=true;document.querySelector('.range-row').hidden=true;
    view.className='';view.replaceChildren(picture(img.currentSrc||img.src,title));
  }
  function populate(scene){
    nav.classList.remove('big-inspect');
    active=scene;const timing=times[scene];
    byId('modal-title').textContent=t(headings[scene]);
    byId('modal-text').textContent=t(scene+'Body');
    byId('modal-kicker').textContent=timing===undefined?t(scene==='art'?'source':'crop'):t('still')+'  /  '+timing.toFixed(2)+' s';
    byId('jump').hidden=timing===undefined;
    if(timing!==undefined)byId('jump').href=FILM_URL+(FILM_URL.endsWith('.mp4')?'#t=':'?t=')+timing.toFixed(4);
    document.querySelector('.range-row').hidden=scene!=='detail';
    view.replaceChildren();view.className='';
    if(scene==='art'){
      view.classList.add('modal-triplet');
      PICTURES.plates.forEach((src,i)=>view.append(picture(src,t(['skyAlt','rockAlt','waveAlt'][i]))));
    }else if(scene==='detail'){
      const [old,now]=document.querySelectorAll('.crops img');
      view.append(picture(now.src,t('after')));
      const left=picture(old.src,t('before'));left.className='front';view.append(left);
      const rule=document.createElement('i');rule.className='split';view.append(rule);
      byId('wipe').value=50;wipe();
    }else{
      const img=picture(PICTURES[thumb[scene]],t(headings[scene]));img.width=1920;img.height=1080;view.append(img);
    }
  }
  function open(scene){populate(scene);nav.showModal();byId('close').focus();}
  function move(step){populate(sceneKeys[(sceneKeys.indexOf(active)+sceneKeys.length+step)%sceneKeys.length]);}
  document.querySelectorAll('[data-scene]').forEach(el=>el.onclick=()=>open(el.dataset.scene));
  if(!isExport)document.querySelectorAll('article figure img').forEach(img=>{
    if(img.closest('button'))return;
    img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-haspopup','dialog');
    const show=()=>{populateAsset(img);nav.showModal();byId('close').focus();};
    img.addEventListener('click',show);
    img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
  });
  nav.addEventListener('close',()=>{active=null;inspected=null;nav.classList.remove('big-inspect');});
  nav.addEventListener('click',e=>{if(e.target===nav){const r=nav.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)nav.close();}});
  byId('prev').onclick=()=>move(-1);byId('next').onclick=()=>move(1);
  byId('close').onclick=()=>nav.close();byId('wipe').oninput=wipe;
  byId('en').onclick=()=>{lang=0;localize();};byId('zh').onclick=()=>{lang=1;localize();};
  byId('zoom').onclick=()=>{zoom=!zoom;byId('zoom').textContent=t(zoom?'fit':'zoom');resize();};
  const sheets=[...byId('book').children],chapter=byId('chapter-nav');
  chapter.onchange=()=>{
    if(chapter.value==='repo'){location.href='https://github.com/Andy-Huang-SZU/riptide-flight';return;}
    sheets[Number(chapter.value)].scrollIntoView({block:'start'});
  };
  let scrollPending=false;
  window.addEventListener('scroll',()=>{
    if(scrollPending || isExport)return;
    scrollPending=true;
    requestAnimationFrame(()=>{
      const threshold=Math.min(window.innerHeight*.45,300);
      const index=sheets.reduce((n,s,i)=>s.getBoundingClientRect().top<threshold?i:n,0);
      chapter.value=String(index);scrollPending=false;
    });
  },{passive:true});
  function drawRegions(){
    const c=byId('regions'),g=c.getContext('2d');
    const boxes=Object.entries(PLOTS.regions).filter(([key])=>key.startsWith('tide-'));
    const sx=c.width/1672,sy=c.height/941;
    boxes.forEach(([,box],i)=>{
      const [l,t,r,b]=box;
      const x=l*sx+2,y=t*sy+2,w=(r-l)*sx-4,h=(b-t)*sy-4;
      g.lineWidth=6;g.strokeStyle='#18323de0';g.strokeRect(x,y,w,h);
      g.lineWidth=3;g.strokeStyle='#ffe2a3';g.strokeRect(x,y,w,h);
      const px=x+w/2,py=y+h/2;
      g.fillStyle='#19333e';g.beginPath();g.arc(px,py,23,0,2*Math.PI);g.fill();
      g.strokeStyle='#ffdb87';g.lineWidth=2;g.stroke();
      g.fillStyle='#fff4d9';g.font='600 28px sans-serif';
      g.textAlign='center';g.textBaseline='middle';g.fillText(String(i+1),px,py+1);
    });
  }
  function drawScore(){
    const c=byId('waveplot'),g=c.getContext('2d'),w=c.width,h=c.height;
    const x=t=>t/26.5*(w-1);
    g.fillStyle='#f1f4f4';g.fillRect(0,0,w,h);
    for(const beat of PLOTS.beats){g.fillStyle='#829699';g.fillRect(x(beat),h-14,2,14);}
    const amp=PLOTS.amplitude,ampMax=Math.max(...amp),step=w/amp.length,mid=(h-10)/2;
    amp.forEach((a,i)=>{
      const extent=a/ampMax*(mid-5);
      g.fillStyle='#376a71';g.fillRect(i*step,mid-extent,Math.max(1,step-0.6),Math.max(1,extent*2));
    });
    for(const cue of ['inkSnap','coil','crest']){
      const px=x(PLOTS.cues[cue]);g.fillStyle='#694317';g.fillRect(px-3,0,7,h);g.fillStyle='#ffcf4c';g.fillRect(px-1,0,3,h);
      g.beginPath();g.moveTo(px-8,0);g.lineTo(px+8,0);g.lineTo(px,10);g.fill();
    }
  }
  drawRegions();drawScore();
  if(!isExport && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        if(!heroMotion.src)heroMotion.src=heroMotion.dataset.src;
        heroMotion.muted=true;
        heroMotion.play().then(()=>heroMotion.classList.add('playing')).catch(()=>{});
      }else{heroMotion.pause();}
    });
    observer.observe(heroMotion);
  }
  if(isExport)reader.style.width='800px';
  new ResizeObserver(resize).observe(reader);localize();
  window.posterReady=Promise.all([document.fonts.ready,...[...document.querySelectorAll('article img')].map(i=>i.decode())]).then(()=>{resize();return true;});
})();
