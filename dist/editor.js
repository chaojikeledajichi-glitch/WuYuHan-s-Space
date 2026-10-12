const editButton=document.querySelector('#edit-button');
let savedContent=structuredClone(content),draft=null,revision=0,canEdit=false,activeTab='profile',previewing=false,saving=false;
const editDialog=document.createElement('dialog');editDialog.className='editor-dialog';editDialog.setAttribute('aria-labelledby','editor-title');document.body.append(editDialog);
const draftBanner=document.createElement('div');draftBanner.className='draft-banner';draftBanner.hidden=true;draftBanner.innerHTML='<span>正在预览草稿，尚未保存到网站。</span><button id="resume-edit">继续编辑</button><button id="exit-preview">退出预览</button>';document.body.append(draftBanner);
const loadBanner=document.createElement('div');loadBanner.className='load-banner';loadBanner.hidden=true;loadBanner.innerHTML='<span>暂时无法读取最新内容。</span><button id="retry-content">重新连接</button>';document.body.append(loadBanner);
const tabs=[['profile','首页与个人'],['projects','作品'],['experiences','过往经历'],['notes','日常']];
const isDirty=()=>draft&&JSON.stringify(draft)!==JSON.stringify(savedContent);
const listText=value=>(value||[]).join('，');
const splitTags=value=>value.split(/[,，]/).map(v=>v.trim()).filter(Boolean);
function field(path,label,value,{type='text',max=100,required=false,help='',rows=4,options=[],highlight=true}={}){
  const id='field-'+path.replaceAll('.','-');
  const attrs=`id="${id}" name="${esc(path)}" maxlength="${max}" ${required?'required':''}`;
  const input=type==='textarea'?`<textarea ${attrs} rows="${rows}">${esc(value)}</textarea>`:type==='select'?`<select ${attrs}>${options.map(([v,t])=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(t)}</option>`).join('')}</select>`:`<input ${attrs} type="${type}" value="${esc(value)}">`;
  const control=`<label class="edit-field" for="${id}"><span>${label}${required?' *':''}</span>${input}${help?`<span class="field-help">${help}</span>`:''}</label>`;
  if(type!=='textarea'||path==='headline'||!highlight)return control;
  return `<div class="highlight-field" data-highlight-field="${esc(path)}"><div class="edit-field"><label for="${id}">${label}${required?' *':''}</label><div class="highlight-tools" role="group" aria-label="${esc(label)}文字高亮"><button type="button" data-highlight="add" aria-controls="${id}">高亮</button><button type="button" data-highlight="remove" aria-controls="${id}">取消高亮</button><span>选中文字后点击高亮。</span></div>${input}${help?`<span class="field-help">${help}</span>`:''}</div><div class="highlight-preview" aria-label="${esc(label)}高亮效果预览" hidden></div></div>`;
}
function refreshHighlightPreview(wrapper){
  const path=wrapper.dataset.highlightField,ranges=draft.highlights[path]||[],preview=wrapper.querySelector('.highlight-preview');
  preview.hidden=!ranges.length;preview.innerHTML=ranges.length?renderHighlightedText(getHighlightText(draft,path)||'',ranges):'';
}
function removeCollectionHighlights(collection,index){
  const next={};
  for(const [path,ranges] of Object.entries(draft.highlights)){
    const parts=path.split('.');
    if(parts[0]===collection){const item=Number(parts[1]);if(item===index)continue;if(item>index)parts[1]=String(item-1);}
    next[parts.join('.')]=ranges;
  }
  draft.highlights=next;
}
function photoField(){return `<section class="photo-editor"><div class="photo-preview">${draft.photo?`<img src="${esc(draft.photo)}" alt="待保存的个人照片">`:'<span>还没有照片</span>'}</div><div><h4>关于我的照片</h4><p>显示在“关于我”详情中。支持 JPG、PNG、WebP，最大 5 MB。</p><label class="secondary-button photo-upload" tabindex="0">${draft.photo?'替换照片':'上传照片'}<input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${draft.photo?'<button type="button" id="remove-photo" class="remove-item">移除照片</button>':''}<p class="field-help">上传后，点击“保存到网站”才会更新详情。</p></div></section>`;}
function profileFields(){return `<h3>让这个空间成为你的。</h3><p>姓名会同步到证件卡和页脚；标题与简介会显示在左侧介绍板。</p>${photoField()}<div class="field-grid">${field('siteTitle','网站名称',draft.siteTitle,{max:20,required:true})}${field('name','你的名字',draft.name,{max:30,required:true})}</div>${field('headline','首页标题',draft.headline,{type:'textarea',max:36,rows:2,required:true,help:'建议两行，最多 36 个字符。'})}${field('blurb','首页简介',draft.blurb,{type:'textarea',max:150,rows:3})}${field('role','身份或一句话介绍',draft.role,{max:100})}${field('about','关于我的详细介绍',draft.about,{type:'textarea',max:6000,rows:7})}${field('tags','个人标签',listText(draft.tags),{max:350,help:'用逗号分隔，最多 12 个标签。'})}<h3>联系方式</h3><p>显示在“05 / 写信给我”中，未填写的联系方式会隐藏。</p>${field('email','联系邮箱',draft.email,{type:'email',max:160,help:'留空时不显示写信入口。'})}<div class="field-grid">${field('phone','联系电话',draft.phone,{type:'tel',max:40,help:'可填写国家代码；留空时隐藏。'})}${field('wechat','微信号',draft.wechat,{max:100,help:'访客可以复制微信号；留空时隐藏。'})}</div>`;}
function projectCoverField(item,i){return `<section class="project-pdf-editor"><div class="pdf-cover-preview">${item.cover?`<img src="${esc(item.cover)}" alt="${esc(item.title)}的封面">`:'<span>封面待上传</span>'}</div><div><h4>项目封面</h4><label class="edit-field" for="project-cover-${i}"><span>${item.cover?'替换封面':'上传封面'}（JPG、PNG、WebP，最大 5 MB）</span><input id="project-cover-${i}" data-project-cover="${i}" type="file" accept="image/jpeg,image/png,image/webp"></label>${item.cover?`<button type="button" class="remove-item" data-remove-cover="${i}">移除封面</button>`:''}<p class="field-help">上传后点击“保存到网站”生效。</p></div></section>`;}
function experienceImageField(item,i){return `<section class="project-pdf-editor experience-image-editor"><div class="experience-edit-preview">${item.image?`<img src="${esc(item.image)}" alt="${esc(item.title)}的经历图片预览">`:'<span>图片待上传</span>'}</div><div><h4>日期下方的图片</h4><label class="edit-field" for="experience-image-${i}"><span>${item.image?'替换图片':'上传图片'}（JPG、PNG、WebP，最大 5 MB）</span><input id="experience-image-${i}" data-experience-image="${i}" type="file" accept="image/jpeg,image/png,image/webp"></label>${item.image?`<button type="button" class="remove-item" data-remove-experience-image="${i}">移除图片</button>`:''}<p class="field-help">按原比例显示在经历日期下方，上传后点击“保存到网站”生效。</p></div></section>`;}
function itemFields(key,item,i){const p=key+'.'+i+'.';
  if(key==='projects')return `<div class="field-grid">${field(p+'title','作品名称',item.title,{max:50,required:true})}${field(p+'categoryId','所属分类',item.categoryId,{type:'select',options:draft.projectCategories.map(c=>[c.id,c.title])})}</div>${field(p+'cardColor','项目卡片颜色',item.cardColor,{type:'color',max:7,help:'文字颜色会随背景自动调整。'})}${projectCoverField(item,i)}`;
  if(key==='experiences')return `${experienceImageField(item,i)}${field(p+'title','经历名称',item.title,{max:100,required:true,help:'例如：毕业设计、设计实习或一次项目实践。'})}${field(p+'period','时间',item.period,{max:60,help:'例如：2024.09 — 2026.06，可按自己的方式填写。'})}<div class="field-grid">${field(p+'organization','学校 / 单位',item.organization,{max:120})}${field(p+'role','专业 / 职位',item.role,{max:100})}</div>${field(p+'description','经历介绍',item.description,{type:'textarea',max:4000,rows:6,help:'写下你做过的事、负责的部分，以及收获或成果。'})}`;
  return `${field(p+'title','日常标题',item.title,{max:80,required:true})}${field(p+'date','日期或编号',item.date,{max:60})}${field(p+'text','正文',item.text,{type:'textarea',max:6000,rows:7})}`;
}
const limits={projects:12,experiences:16,notes:30};
function projectCategoryFields(){return `<section class="category-settings"><h3>三个作品分类</h3><p>修改分类名称、文件夹颜色和封面文字，再为下方每个项目选择所属分类。</p>${draft.projectCategories.map((c,i)=>`<div class="category-setting">${field('projectCategories.'+i+'.title','分类 '+(i+1)+' 名称',c.title,{max:30,required:true})}${field('projectCategories.'+i+'.folderColor','分类 '+(i+1)+' 文件夹颜色',c.folderColor,{type:'color',max:7})}${field('projectCategories.'+i+'.coverText','分类 '+(i+1)+' 封面文字',c.coverText,{type:'textarea',max:24,rows:2,highlight:false,help:'同步显示在首页小封面和文件夹正面；支持换行，建议两行，最多 24 个字符。'})}</div>`).join('')}</section>`;}
function lifeAlbumFields(){return `<h3>四个日常板块</h3><p>为每个板块上传封面和相册照片。相册支持一次选择多张照片，每个板块最多 40 张，保存后更新到网站。</p>${draft.lifeAlbums.map((album,a)=>`<section class="collection-card life-album-editor"><h4>${esc(album.title)}</h4>${field('lifeAlbums.'+a+'.title','板块名称',album.title,{max:30,required:true})}<div class="life-cover-editor"><div class="life-edit-cover">${albumCover(album)?`<img src="${esc(albumCover(album))}" alt="${esc(album.title)}的封面预览">`:'<span>封面待上传</span>'}</div><div><label class="edit-field"><span>上传 / 替换封面</span><input type="file" data-life-upload="cover" data-album="${a}" accept="image/jpeg,image/png,image/webp"></label>${album.cover?`<button type="button" class="remove-item" data-life-action="clear-cover" data-album="${a}">移除指定封面</button>`:''}<p class="field-help">未单独设置封面时，使用相册的第一张照片。</p></div></div><label class="edit-field"><span>添加相册照片（支持多选）</span><input type="file" multiple data-life-upload="photos" data-album="${a}" accept="image/jpeg,image/png,image/webp" ${album.photos.length>=40?'disabled':''}></label><p class="field-help">支持 JPG、PNG、WebP，会自动优化图片大小。已添加 ${album.photos.length} / 40 张。</p><div class="life-photo-editor-list">${album.photos.map((photo,p)=>`<section class="life-photo-editor"><img src="${esc(photo.url)}" alt="第 ${p+1} 张照片预览" loading="lazy"><div>${field('lifeAlbums.'+a+'.photos.'+p+'.caption','照片 '+(p+1)+' 说明',photo.caption,{max:160})}<div class="life-photo-actions"><button type="button" data-life-action="up" data-album="${a}" data-photo="${p}" ${p===0?'disabled':''}>前移</button><button type="button" data-life-action="down" data-album="${a}" data-photo="${p}" ${p===album.photos.length-1?'disabled':''}>后移</button><button type="button" data-life-action="cover" data-album="${a}" data-photo="${p}">设为封面</button><button type="button" class="remove-item" data-life-action="remove" data-album="${a}" data-photo="${p}">移除</button></div></div></section>`).join('')||'<p class="editor-empty">照片先留空，随时可以添加。</p>'}</div></section>`).join('')}<details class="legacy-notes"><summary>原来的文字记录</summary><p class="field-help">这些记录已保留，不再显示在四个图片板块中。</p>${collectionFields('notes')}</details>`;}
function collectionFields(key){const label={projects:'作品',experiences:'经历',notes:'日常'}[key];return `${key==='projects'?projectCategoryFields():''}<h3>${label}记录</h3><p>${key==='projects'?'先选择分类，再查看项目列表与项目详情；洞洞板作品夹展示三个分类。':key==='experiences'?'按希望展示的顺序填写经历，建议把最近的放在前面。保存后同步到网站。':'可以新增或删除记录，保存后才会更新到网站。'}</p>${draft[key].map((item,i)=>`<section class="collection-card"><div class="collection-heading"><h4>${label} ${String(i+1).padStart(2,'0')}</h4><button type="button" class="remove-item" data-remove="${key}" data-index="${i}" aria-label="删除第 ${i+1} 条${label}">移除</button></div>${itemFields(key,item,i)}</section>`).join('')||'<p class="editor-empty">这里还没有内容，可以添加第一条记录。</p>'}<button type="button" class="add-item" data-add="${key}" ${draft[key].length>=limits[key]?'disabled':''}>＋ 添加${label}（${draft[key].length} / ${limits[key]}）</button>`;}
const editorImageSizes=new Map();
function renderEditor({anchor=''}={}){
  const previousForm=editDialog.querySelector('#editor-form'),scrollTop=previousForm?.scrollTop||0;
  const previousAnchor=anchor?previousForm?.querySelector(anchor):null;
  const anchorOffset=previousAnchor?previousAnchor.getBoundingClientRect().top-previousForm.getBoundingClientRect().top:null;
  const expanded=Array.from(previousForm?.querySelectorAll('details')||[],element=>element.open);
  previousForm?.querySelectorAll('img').forEach(image=>{if(image.naturalWidth&&image.naturalHeight)editorImageSizes.set(image.getAttribute('src'),[image.naturalWidth,image.naturalHeight]);});
  editDialog.innerHTML=`<div class="editor-shell"><header class="editor-heading"><div><h2 id="editor-title">编辑我的小天地</h2><p>修改会在保存后同步到网站。长文本框上方可设置文字高亮。</p></div><button class="close-button" id="close-editor" aria-label="关闭编辑器">✕</button></header><div class="editor-tabs" role="tablist" aria-label="编辑内容分类">${tabs.map(([key,title])=>`<button type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${activeTab===key}" tabindex="${activeTab===key?0:-1}" data-tab="${key}">${title}</button>`).join('')}</div><form class="editor-form" id="editor-form">${tabs.map(([key])=>`<section class="editor-section" role="tabpanel" id="panel-${key}" aria-labelledby="tab-${key}" ${activeTab===key?'':'hidden'}>${key==='profile'?profileFields():key==='notes'?lifeAlbumFields():collectionFields(key)}</section>`).join('')}<div class="editor-backup"><button type="button" id="export-draft">下载草稿备份</button><button type="button" id="reload-saved">重新载入网站内容</button></div></form><footer class="editor-actions"><p class="editor-status" id="editor-status" aria-live="polite">${isDirty()?'有未保存的修改':'修改完成后，点击“保存到网站”。'}</p><button type="button" class="secondary-button" id="preview-draft">预览效果</button><button type="submit" form="editor-form" class="primary-button" id="save-content">保存到网站</button></footer></div>`;
  editDialog.querySelectorAll('.highlight-field').forEach(refreshHighlightPreview);
  const form=editDialog.querySelector('#editor-form');
  form.querySelectorAll('details').forEach((element,index)=>element.open=expanded[index]||false);
  form.querySelectorAll('img').forEach(image=>{const size=editorImageSizes.get(image.getAttribute('src'));if(size){image.width=size[0];image.height=size[1];}});
  form.scrollTop=scrollTop;
  const nextAnchor=anchor?form.querySelector(anchor):null;
  if(nextAnchor&&anchorOffset!==null)form.scrollTop+=nextAnchor.getBoundingClientRect().top-form.getBoundingClientRect().top-anchorOffset;
}
function selectTab(key,focus=false){activeTab=key;editDialog.querySelectorAll('[data-tab]').forEach(el=>{const selected=el.dataset.tab===key;el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1;});editDialog.querySelectorAll('[role="tabpanel"]').forEach(el=>el.hidden=el.id!=='panel-'+key);if(focus)editDialog.querySelector('#tab-'+key).focus();}
function setStatus(message,error=false){const el=editDialog.querySelector('#editor-status');if(el){el.textContent=message;el.classList.toggle('error',error);}}
function updateEditLabel(){editButton.textContent=isDirty()?'编辑内容 · 未保存':'编辑内容';}
function openEditor(){if(!canEdit)return;if(!draft)draft=structuredClone(savedContent);if(dialog.open)closeDetail();renderEditor();editDialog.showModal();document.body.style.overflow='hidden';editDialog.querySelector('#close-editor').focus();}
function validForm(){const invalid=editDialog.querySelector('input:invalid,textarea:invalid,select:invalid');if(invalid){const panel=invalid.closest('[role="tabpanel"]');if(panel)selectTab(panel.id.slice(6));invalid.reportValidity();invalid.focus();return false;}return true;}
function closeEditor(){if(!saving)editDialog.close();}
editDialog.addEventListener('close',()=>{document.body.style.overflow='';updateEditLabel();editButton.focus({preventScroll:true});});
editDialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
editDialog.addEventListener('input',e=>{
  const path=e.target.name;if(!path)return;const parts=path.split('.');let target=draft;
  for(const key of parts.slice(0,-1))target=target[key];
  const key=parts.at(-1),previousText=target[key];target[key]=key==='tags'?splitTags(e.target.value):e.target.value;
  const highlightedField=e.target.closest('.highlight-field');
  if(highlightedField){
    const ranges=shiftHighlightRanges(draft.highlights[path]||[],previousText,e.target.value);
    if(ranges.length)draft.highlights[path]=ranges;else delete draft.highlights[path];
    refreshHighlightPreview(highlightedField);
  }
  if(parts[0]==='projectCategories'&&key==='title')editDialog.querySelectorAll('select[name$=".categoryId"] option').forEach(option=>{option.textContent=draft.projectCategories.find(c=>c.id===option.value)?.title||'';});
  setStatus('有未保存的修改');updateEditLabel();
});
editDialog.addEventListener('keydown',e=>{const tab=e.target.closest('[data-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let i=tabs.findIndex(([k])=>k===tab.dataset.tab);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[i][0],true);});
editDialog.addEventListener('click',async e=>{
  if(saving)return;
  const lifeAction=e.target.closest('[data-life-action]');
  if(lifeAction){const album=draft.lifeAlbums[Number(lifeAction.dataset.album)],p=Number(lifeAction.dataset.photo),action=lifeAction.dataset.lifeAction;
    if(action==='clear-cover')album.cover='';
    if(action==='cover')album.cover=album.photos[p].url;
    if(action==='remove'){if(album.cover===album.photos[p].url)album.cover='';album.photos.splice(p,1);}
    if(action==='up'||action==='down'){const next=p+(action==='up'?-1:1);if(next<0||next>=album.photos.length)return;[album.photos[p],album.photos[next]]=[album.photos[next],album.photos[p]];}
    renderEditor();updateEditLabel();setStatus('相册已更新，点击“保存到网站”生效。');return;
  }
  const highlight=e.target.closest('[data-highlight]');
  if(highlight){
    const wrapper=highlight.closest('.highlight-field'),textarea=wrapper.querySelector('textarea'),path=textarea.name,start=textarea.selectionStart,end=textarea.selectionEnd;
    if(start===end){setStatus('请先在文本框里选中需要调整的文字。');textarea.focus();return;}
    let ranges=draft.highlights[path]||[];
    if(highlight.dataset.highlight==='add')ranges=mergeHighlightRanges([...ranges,{start,end}]);
    else ranges=ranges.flatMap(range=>range.end<=start||range.start>=end?[range]:[{start:range.start,end:Math.min(range.end,start)},{start:Math.max(range.start,end),end:range.end}].filter(piece=>piece.start<piece.end));
    if(ranges.length>200){setStatus('这段文字的高亮较多，请先合并或取消部分高亮。',true);return;}
    if(ranges.length)draft.highlights[path]=ranges;else delete draft.highlights[path];
    refreshHighlightPreview(wrapper);setStatus('高亮已更新，点击“保存到网站”后生效。');updateEditLabel();textarea.focus();textarea.setSelectionRange(start,end);return;
  }
  const removeExperienceImage=e.target.closest('[data-remove-experience-image]');if(removeExperienceImage){const index=Number(removeExperienceImage.dataset.removeExperienceImage);draft.experiences[index].image='';renderEditor({anchor:`[data-experience-image="${index}"]`});updateEditLabel();setStatus('图片已从草稿移除，保存后生效。');return;}
  const removeCover=e.target.closest('[data-remove-cover]');if(removeCover){draft.projects[Number(removeCover.dataset.removeCover)].cover='';renderEditor();updateEditLabel();setStatus('封面已从草稿移除，保存后生效。');return;}
  if(e.target.closest('#remove-photo')){draft.photo='';renderEditor();updateEditLabel();setStatus('照片已从草稿移除，保存后生效。');return;}
  const tab=e.target.closest('[data-tab]');if(tab){selectTab(tab.dataset.tab);return;}
  const remove=e.target.closest('[data-remove]');if(remove){const index=Number(remove.dataset.index);draft[remove.dataset.remove].splice(index,1);removeCollectionHighlights(remove.dataset.remove,index);renderEditor();editDialog.querySelector('[data-add="'+activeTab+'"]').focus();updateEditLabel();return;}
  const add=e.target.closest('[data-add]');if(add){const key=add.dataset.add;if(draft[key].length>=limits[key])return;draft[key].push(key==='projects'?{id:crypto.randomUUID(),title:'新作品',categoryId:draft.projectCategories[0].id,category:'',year:String(new Date().getFullYear()),className:'thumb-yellow',cardColor:DEFAULT_PROJECT_CARD_COLORS[draft.projects.filter(project=>project.categoryId===draft.projectCategories[0].id).length%5],art:'NEW\nWORK',intro:'',body:'',tags:[]}:key==='experiences'?{title:'',period:'',organization:'',role:'',description:'',image:''}:{title:'新的日常',date:new Date().toLocaleDateString('zh-CN'),text:''});renderEditor();editDialog.querySelector(`[name="${key}.${draft[key].length-1}.title"]`).focus();updateEditLabel();return;}
  if(e.target.closest('#close-editor')){closeEditor();return;}
  if(e.target.closest('#preview-draft')){if(!validForm())return;applyContent({...draft,customized:true});previewing=true;draftBanner.hidden=false;closeEditor();return;}
  if(e.target.closest('#export-draft')){const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='我的洞洞板-内容备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('已下载草稿备份。');return;}
  if(e.target.closest('#reload-saved')){if(isDirty()&&!confirm('重新载入会替换本次未保存的草稿。建议先下载草稿备份。继续吗？'))return;setStatus('正在读取网站内容…');try{await loadContent(true);if(canEdit){draft=structuredClone(savedContent);previewing=false;draftBanner.hidden=true;applyContent(savedContent);renderEditor();setStatus('已载入网站最新内容。');}}catch(error){setStatus(error.message,true);}return;}
});
// Reveal the relevant tab before the browser reports required-field errors.
editDialog.addEventListener('invalid',e=>{const panel=e.target.closest('[role="tabpanel"]');if(panel)selectTab(panel.id.slice(6));},true);
editDialog.addEventListener('submit',async e=>{
  e.preventDefault();if(saving||!validForm())return;saving=true;editDialog.querySelector('#save-content').disabled=true;editDialog.querySelector('#preview-draft').disabled=true;editDialog.querySelector('#editor-form').inert=true;setStatus('正在保存到网站…');
  try{const response=await fetch('/api/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:draft,revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败，请重试。');revision=result.revision;savedContent=normalizeContent(result.content);draft=normalizeContent(result.content);applyContent(savedContent);previewing=false;draftBanner.hidden=true;editDialog.querySelectorAll('.highlight-field').forEach(wrapper=>{const textarea=wrapper.querySelector('textarea');textarea.value=getHighlightText(draft,textarea.name)||'';refreshHighlightPreview(wrapper);});setStatus('已保存到网站，其他设备也会读取这份内容。');updateEditLabel();}
  catch(error){setStatus(error.message||'网络连接失败，草稿仍然保留，请重试。',true);}
  finally{saving=false;editDialog.querySelector('#save-content').disabled=false;editDialog.querySelector('#preview-draft').disabled=false;editDialog.querySelector('#editor-form').inert=false;}
});
async function loadContent(throwError=false){
  try{const response=await fetch('/api/content',{cache:'no-store'});if(!response.ok)throw Error('暂时无法读取最新内容，请稍后重试。');const result=await response.json();revision=result.revision;canEdit=Boolean(result.canEdit);window.SPACE_CAN_EDIT=canEdit;editButton.hidden=!canEdit;savedContent=normalizeContent(result.content||defaultContent);if(!previewing)applyContent(savedContent);loadBanner.hidden=true;if(!canEdit&&editDialog.open)editDialog.close();}
  catch(error){loadBanner.hidden=false;if(throwError)throw error;}
}
editButton.addEventListener('click',openEditor);
document.querySelector('#resume-edit').addEventListener('click',openEditor);
document.querySelector('#exit-preview').addEventListener('click',()=>{previewing=false;draftBanner.hidden=true;applyContent(savedContent);});
document.querySelector('#retry-content').addEventListener('click',()=>loadContent());
window.addEventListener('beforeunload',e=>{if(isDirty()){e.preventDefault();e.returnValue='';}});
loadContent();

document.addEventListener('click',e=>{if(e.target.closest('[data-edit-life]')){activeTab='notes';openEditor();}});
editDialog.addEventListener('change',async e=>{
  if(!e.target.matches('[data-life-upload]')||saving)return;
  const input=e.target,album=draft.lifeAlbums[Number(input.dataset.album)],mode=input.dataset.lifeUpload,files=Array.from(input.files||[]);if(!files.length)return;
  if(mode==='photos'&&album.photos.length+files.length>40){setStatus('每个相册最多 40 张，请减少本次选择的照片。',true);input.value='';return;}
  if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>30*1024*1024)){setStatus('请选择 JPG、PNG 或 WebP，每张原图最大 30 MB。',true);input.value='';return;}
  saving=true;editDialog.querySelector('#editor-form').inert=true;editDialog.querySelector('#save-content').disabled=true;editDialog.querySelector('#preview-draft').disabled=true;
  let count=0,errorMessage='';
  try{for(const file of files){
    setStatus(`正在上传照片 ${count+1} / ${files.length}…`);
    const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const bytes=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));if(!bytes)throw Error('照片无法读取，请重新选择。');
    const response=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':bytes.type},body:bytes}),result=await response.json();if(!response.ok)throw Error(result.error||'照片上传失败，请重试。');
    editorImageSizes.set(result.url,[canvas.width,canvas.height]);
    if(mode==='cover')album.cover=result.url;else album.photos.push({url:result.url,caption:''});count++;
  }}catch(error){errorMessage=error.message||'上传失败，请重试。';}
  finally{saving=false;renderEditor({anchor:`[data-life-upload="${mode}"][data-album="${input.dataset.album}"]`});updateEditLabel();setStatus(errorMessage?`${errorMessage}${count?' 已上传的 '+count+' 张已保留在草稿中。':''}`:`已上传 ${count} 张照片，点击“保存到网站”生效。`,Boolean(errorMessage));}
});
document.addEventListener('click',e=>{if(e.target.closest('#add-about-photo'))document.querySelector('#about-photo-file')?.click();});
document.addEventListener('change',async e=>{
  if(e.target.id!=='about-photo-file'||!canEdit||saving)return;
  const file=e.target.files?.[0],status=document.querySelector('#about-photo-status'),button=document.querySelector('#add-about-photo');if(!file)return;
  if(isDirty()){status.textContent='请先保存编辑器中的修改，再添加照片。';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){status.textContent='请选择 5 MB 以内的 JPG、PNG 或 WebP 照片。';return;}
  saving=true;button.disabled=true;status.textContent='正在上传照片…';
  try{
    const bitmap=await createImageBitmap(file);bitmap.close();
    const uploaded=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type},body:file});const photo=await uploaded.json();if(!uploaded.ok)throw Error(photo.error||'上传失败，请重试。');
    const latest=await fetch('/api/content',{cache:'no-store'});const current=await latest.json();if(!latest.ok)throw Error(current.error||'读取内容失败，请重试。');
    const response=await fetch('/api/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:{...(current.content||defaultContent),photo:photo.url},revision:current.revision})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败，请重试。');
    revision=result.revision;savedContent=normalizeContent(result.content);draft=null;previewing=false;draftBanner.hidden=true;applyContent(savedContent);updateEditLabel();
    if(dialog.open&&document.querySelector('.about-layout')){body.innerHTML=render('about');}
  }catch(error){status.textContent=error.message||'照片上传失败，请重试。';}
  finally{saving=false;button.disabled=false;e.target.value='';}
});
editDialog.addEventListener('keydown',e=>{if(e.target.classList.contains('photo-upload')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.querySelector('input').click();}});
editDialog.addEventListener('change',async e=>{
  if(!e.target.matches('[data-project-cover],[data-experience-image]')||saving)return;
  const input=e.target,file=input.files?.[0],isExperience=input.hasAttribute('data-experience-image'),index=Number(isExperience?input.dataset.experienceImage:input.dataset.projectCover),label=isExperience?'经历图片':'封面',selector=`[${isExperience?'data-experience-image':'data-project-cover'}="${index}"]`;if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setStatus(`请选择 JPG、PNG 或 WebP ${label}。`,true);input.value='';return;}
  if(!file.size||file.size>5*1024*1024){setStatus(`${label}最大 5 MB。`,true);input.value='';return;}
  saving=true;editDialog.querySelector('#editor-form').inert=true;editDialog.querySelector('#save-content').disabled=true;editDialog.querySelector('#preview-draft').disabled=true;setStatus(`正在上传${label}…`);
  try{
    const bitmap=await createImageBitmap(file),imageSize=[bitmap.width,bitmap.height];bitmap.close();const response=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw Error(result.error||`${label}上传失败。`);if(isExperience)draft.experiences[index].image=result.url;else draft.projects[index].cover=result.url;editorImageSizes.set(result.url,imageSize);
    renderEditor({anchor:selector});updateEditLabel();setStatus(`${label}已上传，点击“保存到网站”生效。`);
  }catch(error){setStatus(error.message||'文件上传失败，请重试。',true);}
  finally{saving=false;editDialog.querySelector('#editor-form').inert=false;editDialog.querySelector('#save-content').disabled=false;editDialog.querySelector('#preview-draft').disabled=false;const current=editDialog.querySelector(selector);if(current)current.value='';}
});
editDialog.addEventListener('change',async e=>{
  if(e.target.id!=='photo-file'||saving)return;
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setStatus('请选择 JPG、PNG 或 WebP 照片。',true);return;}
  if(file.size>5*1024*1024){setStatus('照片不能超过 5 MB，请选择较小的照片。',true);return;}
  saving=true;editDialog.querySelector('#editor-form').inert=true;editDialog.querySelector('#save-content').disabled=true;editDialog.querySelector('#preview-draft').disabled=true;setStatus('正在上传照片…');
  try{
    const bitmap=await createImageBitmap(file);bitmap.close();
    const response=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw Error(result.error||'照片上传失败，请重试。');
    draft.photo=result.url;renderEditor();updateEditLabel();setStatus('照片已上传，点击“保存到网站”即可显示。');
  }catch(error){setStatus(error.message||'照片无法读取或上传，请重新选择。',true);}
  finally{saving=false;editDialog.querySelector('#editor-form').inert=false;editDialog.querySelector('#save-content').disabled=false;editDialog.querySelector('#preview-draft').disabled=false;}
});
