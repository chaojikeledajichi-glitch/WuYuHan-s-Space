let content = {...window.SPACE_CONTENT,siteTitle:'一方小天地',headline:'生活的碎片，\n灵感的形状。',blurb:'在这里，收集作品、日常，\n还有一些不设限的想法。',customized:false};
content.projects=content.projects.map(p=>({...p,art:p.art.replace(/<br\s*\/?\s*>/gi,'\n')}));
function normalizeContent(value){return {...normalizePortfolio(structuredClone(value)),experiences:structuredClone(value.experiences||[]).map(item=>({...item,image:item.image||''})),highlights:structuredClone(value.highlights||{}),phone:value.phone||'',wechat:value.wechat||''};}
content=normalizeContent(content);
const defaultContent=structuredClone(content);
const dialog = document.querySelector('#detail-dialog');
const body = document.querySelector('#dialog-body');
const kicker = document.querySelector('#dialog-kicker');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const highlighted=(path,text)=>renderHighlightedText(text,content.highlights[path]);
const entries = [
  ['welcome','00','欢迎来访','黄色钥匙牌'],['about','01','关于我','透明证件卡'],['works','02','作品档案','亚克力作品夹'],['experiences','03','过往经历','黑色经历牌'],['notes','04','日常碎片','随手记清单'],['contact','05','写信给我','航空信封']
];
const tags = values => `<div class="tag-list">${values.map(v=>`<span>${esc(v)}</span>`).join('')}</div>`;
let sampleNote = '<p class="detail-note">这是一份个人网站示例内容，等待换上你的真实故事。</p>';
const artHtml=value=>esc(value).replace(/\n/g,'<br>');
const layout = (eyebrow,title,html) => `<article class="dialog-content"><p class="detail-eyebrow">${esc(eyebrow)}</p><h2 id="dialog-title">${esc(title)}</h2>${html}</article>`;
let disposePdf=null,projectReturn=null;
const projectBack=document.querySelector('#back-project');
const clearPdf=()=>{disposePdf?.();disposePdf=null;projectBack.hidden=true;dialog.classList.remove('document-only','portfolio-mode');dialog.removeAttribute('aria-label');dialog.setAttribute('aria-labelledby','dialog-title');};
const projectCover=p=>p.cover?`<img src="${esc(p.cover)}" alt="${esc(p.title)}的封面" loading="lazy">`:'<span>封面待上传</span>';
function portfolioColorStyle(value,kind){
  const color=typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:'#7957c9';
  const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
  const luminance=channels=>channels.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const light=luminance([255,248,233]),dark=luminance([40,35,28]),background=luminance(rgb);
  const lightContrast=(light+.05)/(background+.05),darkContrast=(background+.05)/(dark+.05);
  const ink=lightContrast>darkContrast?'#fff8e9':'#28231c';
  const back='#'+rgb.map(n=>Math.round(n*.82).toString(16).padStart(2,'0')).join('');
  return kind==='folder'?`--folder-color:${color};--folder-back:${back};--folder-ink:${ink}`:`--sheet-color:${color};--sheet-ink:${ink}`;
}
function contactCopyButton(field,label){
  return `<button type="button" class="primary-button contact-copy-button" ${field==='email'?'id="copy-email"':`data-copy-contact="${field}"`} aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg><span class="contact-copy-tooltip" aria-hidden="true">${label}</span></button>`;
}
function contactMethods(){
  const methods=[];
  if(content.email)methods.push(`<section class="contact-method"><span class="contact-method-label">邮箱</span><div class="contact-address"><strong>${esc(content.email)}</strong><div class="contact-method-actions">${contactCopyButton('email','复制邮箱')}</div></div><p class="copy-status" id="copy-status" aria-live="polite"></p></section>`);
  if(content.phone)methods.push(`<section class="contact-method"><span class="contact-method-label">电话（微信同号）</span><div class="contact-address"><strong>${esc(content.phone)}</strong><div class="contact-method-actions">${contactCopyButton('phone','复制电话')}</div></div><p class="copy-status" id="copy-phone-status" aria-live="polite"></p></section>`);
  methods.push(`<section class="contact-method"><span class="contact-method-label">微信号</span><div class="contact-address contact-wechat-address"><div class="wechat-qr"><img src="assets/wechat-qr.png" width="80" height="80" alt="微信联系二维码" loading="lazy"></div>${content.wechat?`<strong>${esc(content.wechat)}</strong><div class="contact-method-actions">${contactCopyButton('wechat','复制微信号')}</div>`:''}</div><p class="copy-status" id="copy-wechat-status" aria-live="polite"></p></section>`);
  return methods.length?`<div class="contact-methods">${methods.join('')}</div>`:`<div class="contact-address"><strong>联系方式待补充</strong><span>这只信封，先为你留着。</span></div>${window.SPACE_CAN_EDIT?'<p class="detail-note">在“编辑内容”的“首页与个人”里填写邮箱、电话或微信号。</p>':''}`;
}
function renderCategories(){
  dialog.classList.add('portfolio-mode');
  return layout('02 / SELECTED WORKS','作品分类',`<div class="portfolio-categories folder-categories">${content.projectCategories.map((c,i)=>`<button class="portfolio-category archive-folder folder-tone-${i+1}" data-category="${esc(c.id)}" style="${portfolioColorStyle(c.folderColor,'folder')+(c.folderColor===DEFAULT_FOLDER_COLORS[i]?';--folder-ink:'+['#33352a','#294268','#fbe7c0'][i]:'')}" aria-label="打开${esc(c.title)}文件夹"><span class="folder-object"><span class="folder-back" aria-hidden="true"></span><span class="folder-paper paper-one" aria-hidden="true"></span><span class="folder-paper paper-two" aria-hidden="true"></span><span class="folder-paper paper-three" aria-hidden="true"></span><span class="folder-front"><strong class="folder-cover-copy">${esc(c.coverText)}</strong></span></span><span class="folder-caption">${content.projects.filter(p=>p.categoryId===c.id).length} 个项目</span></button>`).join('')}</div>${sampleNote}`);
}
function setPortfolioView(html){
  clearPdf();
  dialog.classList.add('portfolio-mode');
  kicker.textContent='PERSONAL COLLECTION / 02';
  body.innerHTML=html;dialog.scrollTop=0;
  const heading=body.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
  updateProjectStack();
}
function updateProjectStack(){
  const cards=Array.from(body.querySelectorAll('.project-sheet'));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  cards.forEach((card,i)=>{const next=cards[i+1];const overlap=next?Math.max(0,Math.min(1,1-(next.getBoundingClientRect().top-card.getBoundingClientRect().top)/card.offsetHeight)):0;card.style.setProperty('--sheet-scale',String(reduced?1:1-overlap*.07));});
}
let projectStackFrame=0;
const scheduleProjectStack=()=>{if(projectStackFrame)return;projectStackFrame=requestAnimationFrame(()=>{projectStackFrame=0;updateProjectStack();});};
dialog.addEventListener('scroll',scheduleProjectStack,{passive:true});
window.addEventListener('resize',scheduleProjectStack);
function showPortfolioCategory(id){
  const c=content.projectCategories.find(c=>c.id===id);if(!c)return;
  const projects=content.projects.filter(p=>p.categoryId===id);
  setPortfolioView(layout('02 / PROJECT COLLECTION',c.title,`<button type="button" class="back-projects folder-return" data-open="works" aria-label="返回三个文件夹" title="返回三个文件夹"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 5-7 7 7 7M3 12h18"/></svg></button><div class="project-list project-stack">${projects.map((p,i)=>`<button class="project-card project-sheet sheet-tone-${i%5+1}" data-project="${esc(p.id)}" style="--stack-index:${i};${portfolioColorStyle(p.cardColor,'sheet')}" aria-label="查看${esc(p.title)}项目详情"><span class="project-sheet-copy"><small class="sheet-number">${String(i+1).padStart(2,'0')}</small><strong>${esc(p.title)}</strong><span class="sheet-open">查看项目</span></span><span class="project-sheet-cover">${projectCover(p)}</span></button>`).join('')||'<p class="detail-copy">这个文件夹的项目正在整理中。</p>'}</div>${sampleNote}`));
}
function showPortfolioProject(id){
  const p=content.projects.find(p=>p.id===id);if(!p)return;
  projectReturn={categoryId:p.categoryId,scrollTop:dialog.scrollTop,projectId:p.id};
  clearPdf();dialog.classList.add('document-only');dialog.removeAttribute('aria-labelledby');dialog.setAttribute('aria-label',p.title);
  projectBack.hidden=false;
  if(p.detailImages?.length){
    body.innerHTML=`<section class="project-image-pages" aria-label="${esc(p.title)}">${p.detailImages.map((image,i)=>`<img src="${esc(image.url)}" width="${image.width}" height="${image.height}" alt="${esc(p.title)} · 第 ${i+1} 段" loading="${i?'lazy':'eager'}" fetchpriority="${i?'auto':'high'}" decoding="async">`).join('')}</section>`;
    for(const image of body.querySelectorAll('img'))image.addEventListener('error',()=>{if(image.nextElementSibling?.classList.contains('image-load-error'))return;const message=document.createElement('p');message.className='image-load-error';message.textContent='图片加载失败，';const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>{message.remove();const url=new URL(image.src);url.searchParams.set('retry',Date.now());image.src=url.href;};message.append(retry);image.after(message);});
  }else if(p.pdf){
    body.innerHTML='<section class="pdf-reader" aria-label="项目内容"><p data-pdf-status role="status">正在读取内容…</p><div class="pdf-long-pages" data-pdf-pages></div></section>';
    disposePdf=window.ProjectPDF.mount(body.querySelector('.pdf-reader'),p.pdf.url);
  }else body.innerHTML='<p class="document-empty">项目详情待上传。</p>';
  dialog.scrollTop=0;projectBack.focus({preventScroll:true});
}
projectBack.addEventListener('click',()=>{
  if(!projectReturn)return;const previous=projectReturn;
  showPortfolioCategory(previous.categoryId);dialog.scrollTop=previous.scrollTop;
  Array.from(body.querySelectorAll('[data-project]')).find(button=>button.dataset.project===previous.projectId)?.focus({preventScroll:true});
  projectReturn=null;
});
const albumCover=album=>album.cover||album.photos[0]?.url||'';
function renderLifeAlbums(){
  return layout('04 / LIFE LATELY','不赶路的时候。',`<p class="detail-lead">日子里的小事，也值得认真收藏。</p><div class="life-albums">${content.lifeAlbums.map((album,i)=>`<button class="life-album" data-life-album="${album.id}"><span class="life-album-cover">${albumCover(album)?`<img src="${esc(albumCover(album))}" alt="${esc(album.title)}的封面" loading="lazy">`:'<span class="life-cover-empty">照片待收藏</span>'}</span><span class="life-album-label"><span class="life-album-number">0${i+1}</span><strong>${esc(album.title)}</strong><small>${album.photos.length} 张照片</small></span></button>`).join('')}</div>`);
}
function setLifeView(html){
  clearPdf();kicker.textContent='PERSONAL COLLECTION / 04';body.innerHTML=html;dialog.scrollTop=0;
  for(const image of body.querySelectorAll('img'))image.addEventListener('error',()=>{if(image.closest('figure').querySelector('.life-image-retry'))return;const retry=document.createElement('button');retry.type='button';retry.className='life-image-retry';retry.textContent='照片加载失败，点击重试';retry.onclick=event=>{event.stopPropagation();retry.remove();const url=new URL(image.src);url.searchParams.set('retry',Date.now());image.src=url.href;};image.closest('figure').append(retry);});
  const heading=body.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
}
function showLifeAlbum(id){
  const album=content.lifeAlbums.find(item=>item.id===id);if(!album)return;
  setLifeView(layout('04 / LITTLE MOMENTS',album.title,`<button class="back-projects" data-open="notes">返回四个板块</button>${album.photos.length?`<div class="film-controls film-scroll-controls"><div><button type="button" data-film-scroll="-1" aria-label="向前浏览照片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><button type="button" data-film-scroll="1" aria-label="向后浏览照片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div></div><div class="film-strip" tabindex="0" role="region" aria-label="${esc(album.title)}胶卷相册，可左右滚动">${album.photos.map((photo,i)=>`<figure class="film-frame"><div class="film-edge" aria-hidden="true"></div><span class="film-number">${String(i+1).padStart(2,'0')} / ${String(album.photos.length).padStart(2,'0')}</span><button class="film-image" data-life-photo="${i}" data-album-id="${id}" aria-label="放大第 ${i+1} 张照片${photo.caption?'：'+esc(photo.caption):''}"><img src="${esc(photo.url)}" alt="${esc(photo.caption||album.title+' · 第 '+(i+1)+' 张照片')}" loading="${i?'lazy':'eager'}" decoding="async"></button><figcaption>${esc(photo.caption)}</figcaption><div class="film-edge" aria-hidden="true"></div></figure>`).join('')}</div>`:`<div class="life-empty"><div class="film-edge" aria-hidden="true"></div><p>这一卷，等着装下新的日常。</p>${window.SPACE_CAN_EDIT?'<button class="primary-button" data-edit-life>添加照片</button>':''}<div class="film-edge" aria-hidden="true"></div></div>`}`));
}
function showLifePhoto(id,index){
  const album=content.lifeAlbums.find(item=>item.id===id),photo=album?.photos[index];if(!photo)return;
  setLifeView(layout('04 / LITTLE MOMENTS',album.title,`<button class="back-projects" data-life-album="${id}">返回胶卷相册</button><figure class="film-large"><div class="film-edge" aria-hidden="true"></div><img src="${esc(photo.url)}" alt="${esc(photo.caption||album.title+' · 第 '+(index+1)+' 张照片')}"><figcaption>${esc(photo.caption)}</figcaption><div class="film-edge" aria-hidden="true"></div></figure><div class="film-controls"><button data-life-photo="${index-1}" data-album-id="${id}" ${index===0?'disabled':''}>上一张</button><span>${index+1} / ${album.photos.length}</span><button data-life-photo="${index+1}" data-album-id="${id}" ${index===album.photos.length-1?'disabled':''}>下一张</button></div>`));
}
function renderAboutPolaroid(){
  return `<figure class="instant-camera"><div class="instant-camera-stage">${content.photo?'<button type="button" class="instant-camera-trigger" data-reveal-portrait aria-label="点击拍立得相机，打印我的照片" aria-expanded="false" aria-controls="about-instant-print"><img class="instant-camera-body" src="/assets/instant-camera.png" alt="" aria-hidden="true"></button>':'<img class="instant-camera-body" src="/assets/instant-camera.png" alt="拍立得相机">'}<div class="camera-print-bay" id="about-instant-print" aria-hidden="true"></div></div><figcaption class="camera-status" aria-live="polite">${content.photo?'点一下相机，认识我':'照片待添加'}</figcaption>${!content.photo&&window.SPACE_CAN_EDIT?'<button type="button" class="portrait-action" id="add-about-photo">添加照片</button><input type="file" id="about-photo-file" accept="image/jpeg,image/png,image/webp" hidden><p id="about-photo-status" class="portrait-status" aria-live="polite"></p>':''}</figure>`;
}
function revealAboutPortrait(button){
  const camera=button.closest('.instant-camera');
  if(!content.photo||button.dataset.loading||camera.classList.contains('is-revealed'))return;
  const caption=camera.querySelector('.camera-status'),bay=camera.querySelector('.camera-print-bay');
  button.dataset.loading='true';button.setAttribute('aria-busy','true');camera.classList.add('is-printing');caption.textContent='相纸显影中…';
  const image=new Image();image.alt=content.name+'的照片';image.decoding='async';
  image.onload=()=>{const paper=document.createElement('div');paper.className='camera-photo';const window=document.createElement('div');window.className='camera-photo-window';window.append(image);const label=document.createElement('span');label.className='camera-photo-label';label.textContent='THIS IS ME.';paper.append(window,label);bay.replaceChildren(paper);bay.setAttribute('aria-hidden','false');camera.classList.remove('is-printing');camera.classList.add('is-revealed');button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','拍立得相机，照片已打印');button.removeAttribute('aria-busy');delete button.dataset.loading;caption.textContent='很高兴认识你。';};
  image.onerror=()=>{delete button.dataset.loading;button.removeAttribute('aria-busy');camera.classList.remove('is-printing');caption.textContent='加载失败，点击相机重试';};
  image.src=content.photo;
}
function render(key){
  kicker.textContent = 'PERSONAL COLLECTION / '+(entries.find(e=>e[0]===key)?.[1] || 'INDEX');
  if(key==='welcome') return layout('00 / HELLO, STRANGER.','欢迎，随便看看。','<p class="detail-lead">这是我的一方小天地。<br>没有固定的参观路线，好奇哪件，就点开哪件。</p><p class="detail-copy">作品夹里放着我做过的东西，证件卡里是关于我的介绍。黑色挂牌记录我的过往经历，纸条收集日常，信封则留给下一次相遇。</p><div class="tag-list"><button class="primary-button" data-open="about">先认识一下 ↗</button><button class="primary-button" data-open="works">看看作品 ↗</button></div>');
  if(key==='about') return layout('01 / THE PERSON BEHIND THE BOARD',`你好，我是${content.name}。`,`<div class="about-layout has-photo">${renderAboutPolaroid()}<div><p class="detail-lead">${esc(content.role)}</p><p class="detail-copy">${highlighted('about',content.about)}</p>${tags(content.tags)}</div></div>${sampleNote}`);
  if(key==='works') return renderCategories();
  if(key==='experiences') return layout('03 / MY JOURNEY','过往经历',content.experiences.length?`<ol class="experience-list">${content.experiences.map((item,i)=>`<li class="experience-item"><div class="experience-meta"><span class="experience-number">${String(i+1).padStart(2,'0')}</span>${item.period?`<span class="experience-period">${esc(item.period)}</span>`:''}${item.image?`<img class="experience-image" src="${esc(item.image)}" alt="${esc(item.organization||item.title)}的经历图片" loading="lazy">`:''}</div><div class="experience-body"><h3>${esc(item.title)}</h3>${item.organization||item.role?`<p class="experience-place">${[item.organization,item.role].filter(Boolean).map(esc).join(' · ')}</p>`:''}${item.description?`<p class="experience-description">${highlighted('experiences.'+i+'.description',item.description)}</p>`:''}</div></li>`).join('')}</ol>`:`<p class="detail-lead">经历整理中。</p>${window.SPACE_CAN_EDIT?'<p class="detail-copy">在“编辑内容”的“过往经历”中，添加学习、工作或实践记录。</p>':''}`);
  if(key==='notes') return renderLifeAlbums();
  if(key==='contact') return layout('05 / LET’S MAKE SOMETHING','期待您的来信。',`<p class="detail-lead">一个有趣的项目、一段新的合作，或者只是分享一个不错的想法。</p><p class="detail-copy">选择你方便的方式联系我。</p>${contactMethods()}`);
  return layout('THE OBJECT INDEX','从一个物件开始。',`<div class="index-list">${entries.map(e=>`<button class="index-item" data-open="${e[0]}"><span class="index-number">${e[1]}</span><span><strong>${e[2]}</strong><small>${e[3]}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`);
}
let opener=null;
function openDetail(key){
  clearPdf();
  if(!dialog.open) opener=document.activeElement;
  body.innerHTML=render(key);
  if(!dialog.open){dialog.showModal();document.body.style.overflow='hidden';}
  dialog.scrollTop=0;
  document.querySelector('#close-dialog').focus({preventScroll:true});
}
function closeDetail(){dialog.close();}
dialog.addEventListener('close',()=>{clearPdf();document.body.style.overflow='';opener?.focus({preventScroll:true});});
document.addEventListener('click',async event=>{
  const portrait=event.target.closest('[data-reveal-portrait]');if(portrait){revealAboutPortrait(portrait);return;}
  const album=event.target.closest('[data-life-album]');if(album){showLifeAlbum(album.dataset.lifeAlbum);return;}
  const photo=event.target.closest('[data-life-photo]');if(photo){showLifePhoto(photo.dataset.albumId,Number(photo.dataset.lifePhoto));return;}
  const filmScroll=event.target.closest('[data-film-scroll]');if(filmScroll){const strip=body.querySelector('.film-strip');strip?.scrollBy({left:Number(filmScroll.dataset.filmScroll)*strip.clientWidth*.85,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  const open=event.target.closest('[data-open]');if(open){openDetail(open.dataset.open);return;}
  const category=event.target.closest('[data-category]');if(category){showPortfolioCategory(category.dataset.category);return;}
  const project=event.target.closest('[data-project]');if(project){showPortfolioProject(project.dataset.project);return;}
  if(event.target.closest('#copy-email')){const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText(content.email);status.textContent='邮箱已复制，期待你的来信。';}catch{status.textContent='暂时无法自动复制，请选中上方邮箱手动复制。';}}
  const contactCopy=event.target.closest('[data-copy-contact]');
  if(contactCopy){const field=contactCopy.dataset.copyContact;if(!['phone','wechat'].includes(field))return;const status=document.querySelector('#copy-'+field+'-status');try{await navigator.clipboard.writeText(content[field]);status.textContent=field==='phone'?'电话已复制。':'微信号已复制。';}catch{status.textContent='暂时无法自动复制，请选中上方号码手动复制。';}}
});
document.querySelector('#index-button').addEventListener('click',()=>openDetail('index'));
document.querySelector('#close-dialog').addEventListener('click',closeDetail);
document.querySelector('#back-board').addEventListener('click',closeDetail);
document.querySelector('#home-button').addEventListener('click',()=>{if(dialog.open)closeDetail();document.querySelector('.installation').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail();});
const light=document.querySelector('#light-button');
function setLight(night){document.body.classList.toggle('night',night);light.setAttribute('aria-pressed',String(night));light.setAttribute('aria-label',night?'切换到日间灯光':'切换到夜间灯光');}
try{setLight(localStorage.getItem('pegboard-light')==='night');}catch{}
light.addEventListener('click',()=>{const night=!document.body.classList.contains('night');setLight(night);try{localStorage.setItem('pegboard-light',night?'night':'day');}catch{}});
document.querySelectorAll('[data-profile="name"]').forEach(el=>el.textContent=content.name);
document.querySelector('#year').textContent=new Date().getFullYear();
// Start the narrow-screen view on the complete central clipboard.
if(matchMedia('(max-width: 800px)').matches){const scroller=document.querySelector('.board-scroll');scroller.scrollLeft=Math.max(0,document.querySelector('.pegboard').clientWidth*.435-scroller.clientWidth/2);}
function applyContent(next){
  content=normalizeContent(next);
  sampleNote=content.customized?'':'<p class="detail-note">这是一份个人网站示例内容，等待换上你的真实故事。</p>';
  document.querySelectorAll('[data-profile="name"]').forEach(el=>el.textContent=content.name);
  syncBoardPortrait();
  document.querySelector('.brand>span:last-child').firstChild.textContent=content.siteTitle;
  document.querySelector('.profile-intro h1').textContent=content.headline;
  document.querySelector('.intro-copy').innerHTML=`我是${esc(content.name)}。\n${highlighted('blurb',content.blurb)}`;
  document.title=content.siteTitle+' — 个人洞洞板';
  document.querySelector('.template-note').textContent=content.customized?'个人空间':'个人空间 · 内容示例';
  document.querySelector('.work-list').innerHTML=content.projectCategories.map((category,i)=>`<span class="work-row"><span><b>0${i+1}</b> ${esc(category.title)}<small>${content.projects.filter(p=>p.categoryId===category.id).length} 个项目</small></span><span class="work-thumb ${['thumb-yellow','thumb-blue','thumb-red'][i]}" aria-hidden="true">${artHtml(category.coverText)}</span></span>`).join('');
  fitWorkCoverText();
}
function syncBoardPortrait(){
  const image=document.querySelector('.board-portrait');
  if(!content.photo){image.hidden=true;image.removeAttribute('src');return;}
  if(image.getAttribute('src')===content.photo)return;
  image.hidden=true;
  image.onload=()=>{if(image.getAttribute('src')===content.photo)image.hidden=false;};
  image.onerror=()=>{image.hidden=true;};
  image.src=content.photo;
}
function fitWorkCoverText(){
  document.querySelectorAll('.work-thumb').forEach(element=>{
    element.style.fontSize='';
    const original=parseFloat(getComputedStyle(element).fontSize);
    for(let size=original;size>original*.45&&(element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth);size-=original*.05)element.style.fontSize=size+'px';
  });
}
window.addEventListener('resize',fitWorkCoverText);
