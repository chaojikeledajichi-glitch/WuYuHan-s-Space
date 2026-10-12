// Full objects rotate around fixed mounting points; hit areas never move.
(() => {
  const board=document.querySelector('.pegboard'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const objects={
    key:{bounds:[130,130,318,505],pin:[220,148],shine:.09,swing:2.2},
    work:{bounds:[405,55,938,876],pin:[653,77],shine:.18,swing:1.4},
    about:{bounds:[983,137,1360,451],pin:[1163,155],shine:.16,swing:1.8},
    skills:{bounds:[151,568,329,913],pin:[234,587],shine:.07,swing:2.1},
    contact:{bounds:[956,523,1345,864],pin:[1134,541],shine:.045,swing:1.5},
    notes:{bounds:[1370,467,1492,933],pin:[1425,486],shine:.04,swing:2}
  };
  const rest={rz:0,rx:0,ry:0,shine:0,light:50}, controllers=[];
  let ready=false, enabled=!reduced.matches;
  function sync(){
    document.documentElement.dataset.motion=enabled?'on':'off';
  }
  reduced.addEventListener('change',()=>{
    enabled=!reduced.matches;sync();controllers.forEach(c=>c.reset(true));
  });
  sync();
  const clip=([l,t,r,b])=>'inset('+t/1024*100+'% '+(1536-r)/1536*100+'% '+(1024-b)/1024*100+'% '+l/1536*100+'%)';
  for(const [name,config] of Object.entries(objects)){
    const hit=document.querySelector('button.object-'+name),holder=document.createElement('div'),face=document.createElement('div');
    holder.className='hanger';holder.dataset.item=name;face.className='object-face';
    face.style.transformOrigin=config.pin[0]/1536*100+'% '+config.pin[1]/1024*100+'%';
    const visual=document.createElement('span');visual.className='hanging-visual';
    const asset=document.createElement('span');asset.className='hanging-asset';
    const movingBounds=[...config.bounds];movingBounds[1]=config.pin[1];
    asset.style.clipPath=clip(movingBounds);
    asset.style.maskImage='url("assets/masks/'+name+'.svg")';visual.append(asset);
    const label=document.createElement('span');label.className=hit.className+' object-label';
    const tooltip=hit.querySelector('.object-tooltip');
    for(const child of [...hit.childNodes])if(child!==tooltip)label.append(child);
    const sheen=document.createElement('span');sheen.className='object-sheen';sheen.style.clipPath=clip(movingBounds);
    sheen.style.maskImage='url("assets/masks/'+name+'.svg")';
    const pin=document.createElement('span');pin.className='stationary-pin';
    const fixedBounds=[...config.bounds];fixedBounds[3]=config.pin[1]+15;pin.style.clipPath=clip(fixedBounds);
    face.setAttribute('aria-hidden','true');pin.setAttribute('aria-hidden','true');
    hit.before(holder);holder.append(face,hit);face.append(visual,label,sheen);board.append(pin);
    const current={...rest},velocity={rz:0,rx:0,ry:0,shine:0,light:0};
    let target={...rest},frame=0,last=0,active=false;
    function draw(){
      const flat=current.rz===0&&current.rx===0&&current.ry===0;
      face.style.transform=flat?'none':'perspective(1200px) rotateZ('+current.rz+'deg) rotateY('+current.ry+'deg) rotateX('+current.rx+'deg)';
      sheen.style.opacity=String(current.shine);sheen.style.backgroundPosition=current.light+'% 50%';
      const lift=Math.min(1,Math.abs(current.rx)/3);
      visual.style.filter='drop-shadow('+(3+lift*2)+'px '+(5+lift*6)+'px '+(3+lift*3)+'px rgb(54 40 19 / '+(.24+lift*.04)+'))';
    }
    function tick(now){
      const elapsed=Math.min((now-last)/1000||1/60,1/30);last=now;
      const steps=Math.ceil(elapsed/(1/120)),dt=elapsed/steps;let moving=false;
      for(const key of Object.keys(current)){
        for(let i=0;i<steps;i++){
          velocity[key]+=((target[key]-current[key])*144-velocity[key]*15)*dt;
          current[key]+=velocity[key]*dt;
        }
        if(Math.abs(target[key]-current[key])>.001||Math.abs(velocity[key])>.001)moving=true;
        else{current[key]=target[key];velocity[key]=0;}
      }
      draw();
      if(moving)frame=requestAnimationFrame(tick);
      else{frame=0;last=0;if(!active)holder.classList.remove('is-lifted');}
    }
    function wake(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
    function aim(event){
      const r=hit.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-r.left)/r.width*2-1)),y=Math.max(-1,Math.min(1,(event.clientY-r.top)/r.height*2-1));
      target={rz:x*config.swing,rx:-2.8+y*.6,ry:x*2.4,shine:config.shine,light:50+x*23};wake();
    }
    function enter(event){
      if(!ready||!enabled||event.pointerType==='touch')return;
      active=true;holder.classList.add('is-lifted');aim(event);velocity.rz+=(target.rz<0?-1:1)*9;
    }
    function reset(immediate=false){
      active=false;target={...rest};
      if(immediate){
        cancelAnimationFrame(frame);frame=0;last=0;Object.assign(current,rest);
        for(const key of Object.keys(velocity))velocity[key]=0;
        holder.classList.remove('is-lifted');draw();
      }else wake();
    }
    hit.addEventListener('pointerenter',enter);
    hit.addEventListener('pointermove',event=>{
      if(!ready||!enabled||event.pointerType==='touch')return;
      if(active)aim(event);else enter(event);
    });
    hit.addEventListener('pointerleave',()=>reset());
    hit.addEventListener('pointercancel',()=>reset(true));
    hit.addEventListener('click',()=>reset(true));
    hit.addEventListener('focus',()=>{
      if(!ready||!enabled||!hit.matches(':focus-visible'))return;
      active=true;holder.classList.add('is-lifted');
      target={rz:.65,rx:-2.8,ry:1.2,shine:config.shine,light:60};wake();
    });
    hit.addEventListener('blur',()=>reset());controllers.push({reset});draw();
  }
  // Decode both layers before replacing the complete original photograph.
  const clean=new Image(),foreground=new Image();
  clean.src='assets/pegboard-clean.png';foreground.src='assets/pegboard.png';
  const masks=Object.keys(objects).concat('pins').map(name=>{
    const mask=new Image();mask.src='assets/masks/'+name+'.svg';return mask.decode();
  });
  Promise.all([clean.decode(),foreground.decode(),...masks]).then(()=>{
    document.querySelector('.board-art').src=clean.src;board.classList.add('layers-ready');ready=true;
  }).catch(()=>{enabled=false;sync();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)controllers.forEach(c=>c.reset(true));});
})();
