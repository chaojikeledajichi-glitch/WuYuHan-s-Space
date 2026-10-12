import { normalizePortfolio, DEFAULT_PROJECT_CATEGORIES, LIFE_ALBUM_IDS } from '../shared/portfolio.mjs';
import { IMPORTED_PROJECT_IMAGES, attachImportedProjectPreviews } from '../shared/project-import.mjs';
import { validateTextHighlights } from '../shared/text-highlights.mjs';
// The platform supplies these identity headers after authentication.
// Pin subsequent writes to the same site-scoped user ID stored with the portfolio.
const OWNER_EMAIL = 'chaojikeledajichi@gmail.com';
const json = (value, status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function identity(request){return {id:request.headers.get('oai-authenticated-user-id')||'',email:(request.headers.get('oai-authenticated-user-email')||'').toLowerCase()};}
function isOwner(user,row){return Boolean(user.id && user.email===OWNER_EMAIL && (!row || row.owner_user_id===user.id));}
function validateContent(data,previous={}){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('内容格式不正确');
  const string=(value,label,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(label+'为空或超过长度限制');return value.trim();};
  const list=(values,label,max,fn)=>{if(!Array.isArray(values)||values.length>max)throw Error(label+'数量超过限制');return values.map(fn);};
  const tags=(values)=>list(values,'标签',12,v=>string(v,'标签',30,true));
  const color=(value)=>{if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw Error('请选择有效的颜色');return value.toLowerCase();};
  if(data.projectCategories!==undefined&&(!Array.isArray(data.projectCategories)||data.projectCategories.length!==3))throw Error('请保留三个作品分类');
  if(!Array.isArray(data.projects))throw Error('作品格式不正确');
  data=normalizePortfolio(data,previous);
  if(!Array.isArray(data.lifeAlbums)||data.lifeAlbums.length!==4)throw Error('请保留四个日常板块');
  const lifeImage=value=>{if(typeof value!=='string'||(value&&!/^\/media\/photo\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value)))throw Error('请通过日常照片上传入口选择图片');return value;};
  const experienceImage=value=>{if(typeof value!=='string'||(value&&!/^\/media\/photo\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value)))throw Error('请通过经历图片上传入口选择图片');return value;};
  const lifeAlbums=data.lifeAlbums.map((album,i)=>{if(album.id!==LIFE_ALBUM_IDS[i])throw Error('日常板块信息不正确');return {id:album.id,title:string(album.title,'板块名称',30,true),cover:lifeImage(album.cover),photos:list(album.photos,'相册照片',40,photo=>{const url=lifeImage(photo.url);if(!url)throw Error('照片不能为空');return {url,caption:string(photo.caption,'照片说明',160)};})};});
  const projectCategories=list(data.projectCategories,'作品分类',3,(c,i)=>{if(c.id!==DEFAULT_PROJECT_CATEGORIES[i].id)throw Error('作品分类信息不正确');return {id:c.id,title:string(c.title,'分类名称',30,true),description:string(c.description,'分类介绍',160),coverText:string(c.coverText,'封面文字',24),folderColor:color(c.folderColor),folderCoverVersion:1};});
  const categoryIds=new Set(projectCategories.map(c=>c.id));
  if(data.projects.some(p=>!categoryIds.has(p.categoryId)))throw Error('请选择有效的作品分类');
  const result={
    projectCategories,
    lifeAlbums,
    name:string(data.name,'姓名',30,true),email:string(data.email,'邮箱',160),role:string(data.role,'个人标签',100),
    phone:string(data.phone===undefined?(previous.phone||''):data.phone,'电话号码',40),wechat:string(data.wechat===undefined?(previous.wechat||''):data.wechat,'微信号',100),
    siteTitle:string(data.siteTitle,'网站名称',20,true),headline:string(data.headline,'首页标题',36,true),blurb:string(data.blurb,'首页简介',150),
    about:string(data.about,'个人介绍',6000),tags:tags(data.tags),photo:string(data.photo??'','照片',120),
    projects:list(data.projects,'作品',12,(p,i)=>({id:'project-'+i,title:string(p.title,'作品名称',50,true),categoryId:p.categoryId,cardColor:color(p.cardColor),category:string(p.category,'作品类别',80),year:string(p.year,'年份',20),className:['thumb-yellow','thumb-blue','thumb-red'].includes(p.className)?p.className:'thumb-yellow',art:string(p.art,'封面文字',40),intro:string(p.intro,'作品简介',500),body:string(p.body,'作品详情',10000),tags:tags(p.tags),cover:validateCover(p.cover),pdf:validatePdf(p.pdf===undefined?previous.projects?.find(saved=>saved.id===p.id)?.pdf:p.pdf),detailImages:validateDetailImages(p.detailImages===undefined?previous.projects?.find(saved=>saved.id===p.id)?.detailImages:p.detailImages)})),
    skills:list(data.skills,'技能',16,s=>({title:string(s.title,'技能名称',50,true),description:string(s.description,'技能说明',1500),tools:string(s.tools,'工具',500)})),
    experiences:list(data.experiences===undefined?(previous.experiences||[]):data.experiences,'过往经历',16,(e,i)=>({title:string(e.title,'经历名称',100,true),period:string(e.period,'时间',60),organization:string(e.organization,'学校或单位',120),role:string(e.role,'专业或职位',100),description:string(e.description,'经历介绍',4000),image:experienceImage(e.image===undefined?(previous.experiences?.[i]?.image??''):e.image)})),
    notes:list(data.notes,'日常',30,n=>({date:string(n.date,'日期',60),title:string(n.title,'日常标题',80,true),text:string(n.text,'日常正文',6000)})),
    customized:true
  };
  result.highlights=validateTextHighlights(data.highlights,result,previous,data);
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error('请输入有效的邮箱地址');
  if(result.phone&&(!/^\+?[\d\s().-]+$/.test(result.phone)||result.phone.replace(/\D/g,'').length<3))throw Error('请输入有效的电话号码，可包含国家代码、空格或短横线。');
  if(result.photo&&!/^\/media\/photo\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(result.photo))throw Error('请通过照片上传入口选择图片');
  return result;
}
async function api(request,env){
  const user=identity(request);
  if(!env.DB)return json({error:'保存服务暂时不可用，请稍后重试。'},503);
  if(request.method==='GET'){
    const row=await env.DB.prepare('SELECT data, revision, owner_user_id, updated_at FROM portfolio WHERE id = ?').bind('main').first();
    const saved=row?attachImportedProjectPreviews(JSON.parse(row.data)):null;
    return json({content:saved?{...normalizePortfolio(saved),experiences:saved.experiences||[]}:null,revision:row?.revision||0,updatedAt:row?.updated_at||null,canEdit:isOwner(user,row)});
  }
  if(request.method!=='PUT')return json({error:'不支持此操作'},405);
  // Check authorization before reading any mutation payload.
  if(!isOwner(user,null))return json({error:'仅网站所有者可以编辑。'},403);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'请求来源不正确。'},403);
  if(!(request.headers.get('content-type')||'').includes('application/json'))return json({error:'请求格式不正确。'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>300000)return json({error:'内容太长，请缩短后重试。'},413);
  let value;try{value=JSON.parse(raw)}catch{return json({error:'内容格式不正确。'},400)}
  if(!Number.isSafeInteger(value.revision)||value.revision<0)return json({error:'版本信息不正确。'},400);
  const row=await env.DB.prepare('SELECT owner_user_id, revision, data FROM portfolio WHERE id = ?').bind('main').first();
  if(!isOwner(user,row))return json({error:'仅网站所有者可以编辑。'},403);
  // An older open editor has no experiences field; preserve saved entries in that case.
  let data;try{data=validateContent(value.content,row?attachImportedProjectPreviews(JSON.parse(row.data)):{})}catch(error){return json({error:error.message},400)}
  if(data.photo){const uploaded=await env.BUCKET?.head(data.photo.slice(7));if(!uploaded||uploaded.customMetadata?.owner!==user.id)return json({error:'照片不存在或不属于当前账户，请重新上传。'},400);}
  for(const experience of data.experiences){if(experience.image){const uploaded=await env.BUCKET?.head(experience.image.slice(7));if(!uploaded||uploaded.customMetadata?.owner!==user.id)return json({error:'经历图片不存在或不属于当前账户，请重新上传。'},400);}}
  for(const album of data.lifeAlbums){for(const path of new Set([album.cover,...album.photos.map(photo=>photo.url)].filter(Boolean))){const uploaded=await env.BUCKET?.head(path.slice(7));if(!uploaded||uploaded.customMetadata?.owner!==user.id)return json({error:'日常照片不存在或不属于当前账户，请重新上传。'},400);}}
  for(const project of data.projects){for(const path of [project.cover,project.pdf?.url,project.pdf?.cover,...project.detailImages.map(image=>image.url)].filter(Boolean)){if(Object.hasOwn(IMPORTED_PROJECT_IMAGES,path))continue;const uploaded=await env.BUCKET?.head(path.slice(7));if(!uploaded||uploaded.customMetadata?.owner!==user.id)return json({error:'项目文件不存在或不属于当前账户，请重新上传。'},400);}}
  const now=new Date().toISOString();let result;
  if(value.revision===0){
    result=await env.DB.prepare('INSERT INTO portfolio (id,data,revision,owner_user_id,updated_at) VALUES (?,?,1,?,?) ON CONFLICT(id) DO NOTHING').bind('main',JSON.stringify(data),user.id,now).run();
  }else{
    result=await env.DB.prepare('UPDATE portfolio SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND owner_user_id = ?').bind(JSON.stringify(data),now,'main',value.revision,user.id).run();
  }
  if(!result.meta?.changes)return json({error:'网站已在其他窗口更新。你的草稿仍保留，请先备份草稿，再重新载入网站内容。',conflict:true},409);
  return json({content:data,revision:value.revision+1,updatedAt:now,canEdit:true});
}
async function photos(request,env){
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/photo'){
    if(request.method!=='POST')return json({error:'不支持此操作'},405);
    const user=identity(request);
    if(!isOwner(user,null)||request.headers.get('origin')!==new URL(request.url).origin)return json({error:'仅网站所有者可以上传照片。'},403);
    if(!env.DB||!env.BUCKET)return json({error:'照片上传暂时不可用，请稍后重试。'},503);
    const row=await env.DB.prepare('SELECT owner_user_id FROM portfolio WHERE id = ?').bind('main').first();
    if(!isOwner(user,row))return json({error:'仅网站所有者可以上传照片。'},403);
    const mime=request.headers.get('content-type');const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    if(!extensions[mime])return json({error:'请选择 JPG、PNG 或 WebP 照片。'},415);
    const max=5*1024*1024;if(Number(request.headers.get('content-length'))>max)return json({error:'照片不能超过 5 MB。'},413);
    const reader=request.body?.getReader();if(!reader)return json({error:'没有收到照片。'},400);
    let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return json({error:'照片不能超过 5 MB。'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    const match= mime==='image/png'?bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):mime==='image/jpeg'?bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!match)return json({error:'照片格式不正确，请重新选择。'},400);
    const key='photo/'+crypto.randomUUID()+'.'+extensions[mime];await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime},customMetadata:{owner:user.id}});
    return json({url:'/media/'+key});
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(!/^\/media\/photo\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(pathname))return new Response('Not found',{status:404});
  if(!env.BUCKET)return new Response('Photo unavailable',{status:503});
  const object=await env.BUCKET.get(pathname.slice(7));if(!object)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
function validateCover(cover){
  if(typeof cover!=='string'||(cover&&!/^\/media\/(photo\/[0-9a-f-]{36}\.(png|jpg|webp)|projects\/[0-9a-f-]{36}\.webp)$/.test(cover)))throw Error('请通过封面上传入口选择图片。');
  return cover;
}
function validateDetailImages(images=[]){
  if(!Array.isArray(images)||images.length>120)throw Error('详情最多支持 120 段图片。');
  return images.map(image=>{if(!image||!/^\/media\/photo\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(image.url)||!Number.isInteger(image.width)||image.width<1||image.width>1600||!Number.isInteger(image.height)||image.height<1||image.height>2400)throw Error('详情图片信息无效，请重新上传。');return {url:image.url,width:image.width,height:image.height};});
}
function validatePdf(pdf){
  if(pdf==null)return null;
  const match=typeof pdf.url==='string'&&pdf.url.match(/^\/media\/projects\/([0-9a-f-]{36})\.pdf$/);
  if(!match||(pdf.cover!==undefined&&pdf.cover!==`/media/projects/${match[1]}.webp`)||typeof pdf.name!=='string'||!pdf.name.trim()||pdf.name.length>180||!Number.isInteger(pdf.pages)||pdf.pages<1||pdf.pages>1000)throw Error('项目 PDF 信息不正确，请重新上传。');
  return {url:pdf.url,...(pdf.cover?{cover:pdf.cover}:{}),name:pdf.name.trim(),pages:pdf.pages};
}
async function projectPdf(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/project-pdf'){
    if(request.method!=='POST')return json({error:'不支持此操作'},405);
    const user=identity(request);
    if(!isOwner(user,null)||request.headers.get('origin')!==url.origin)return json({error:'仅网站所有者可以上传项目 PDF。'},403);
    if(!env.DB||!env.BUCKET)return json({error:'文件上传暂时不可用，请稍后重试。'},503);
    const row=await env.DB.prepare('SELECT owner_user_id FROM portfolio WHERE id = ?').bind('main').first();
    if(!isOwner(user,row))return json({error:'仅网站所有者可以上传项目 PDF。'},403);
    if(!(request.headers.get('content-type')||'').startsWith('multipart/form-data;'))return json({error:'请选择 PDF 文件。'},415);
    const max=33*1024*1024,reader=request.body?.getReader();
    if(!reader)return json({error:'没有收到文件。'},400);
    const parts=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return json({error:'PDF 不能超过 30 MB。'},413);}parts.push(value);}
    let form;try{form=await new Response(new Blob(parts),{headers:{'Content-Type':request.headers.get('content-type')}}).formData();}catch{return json({error:'文件格式不正确。'},400);}
    const file=form.get('pdf'),cover=form.get('cover'),pages=Number(form.get('pages'));
    if(!file||typeof file.arrayBuffer!=='function'||file.type!=='application/pdf'||(cover&&(typeof cover.arrayBuffer!=='function'||cover.type!=='image/webp')))return json({error:'请选择 PDF 文件。'},415);
    if(file.size>30*1024*1024||(cover&&cover.size>2*1024*1024))return json({error:'PDF 最大 30 MB。'},413);
    const pdfBytes=new Uint8Array(await file.arrayBuffer()),coverBytes=cover?new Uint8Array(await cover.arrayBuffer()):null;
    if(new TextDecoder().decode(pdfBytes.slice(0,5))!=='%PDF-'||(coverBytes&&(new TextDecoder().decode(coverBytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(coverBytes.slice(8,12))!=='WEBP')))return json({error:'文件内容无效，请重新导出 PDF。'},400);
    if(!Number.isInteger(pages)||pages<1||pages>1000)return json({error:'PDF 页数须为 1–1000 页。'},400);
    const id=crypto.randomUUID(),name=(file.name||'项目.pdf').slice(0,180);
    await env.BUCKET.put(`projects/${id}.pdf`,pdfBytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{owner:user.id}});
    if(coverBytes)await env.BUCKET.put(`projects/${id}.webp`,coverBytes,{httpMetadata:{contentType:'image/webp'},customMetadata:{owner:user.id}});
    return json({pdf:{url:`/media/projects/${id}.pdf`,...(coverBytes?{cover:`/media/projects/${id}.webp`}:{}),name,pages}});
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(!/^\/media\/projects\/[0-9a-f-]{36}\.(pdf|webp)$/.test(url.pathname))return new Response('Not found',{status:404});
  const isPdf=url.pathname.endsWith('.pdf');
  const key=url.pathname.slice(7),bucket=env.BUCKET;
  if(!bucket)return new Response('File unavailable',{status:503});
  // HEAD and byte ranges use metadata only; never download the whole object
  // into the Worker merely to find its size or to serve a small PDF segment.
  const metadata=await bucket.head(key);if(!metadata)return new Response('Not found',{status:404});
  const headers=new Headers({'Content-Type':isPdf?'application/pdf':'image/webp','Content-Disposition':isPdf?'inline; filename="project.pdf"':'inline','Cache-Control':'private, max-age=3600, no-transform','X-Content-Type-Options':'nosniff','Content-Length':String(metadata.size)});
  if(metadata.httpEtag)headers.set('ETag',metadata.httpEtag);
  if(isPdf)headers.set('Accept-Ranges','bytes');
  if(request.method==='HEAD')return new Response(null,{headers});
  // Some authenticated site proxies drop Range headers. A query range keeps
  // the same private media route and storage lookup, without a full download.
  const queryRange=url.searchParams.get('pdfRange');
  if(queryRange!==null&&(!isPdf||!/^\d+-\d+$/.test(queryRange)))return new Response('Invalid range',{status:400});
  const rangeHeader=queryRange!==null?'bytes='+queryRange:request.headers.get('range'),ifRange=queryRange===null?request.headers.get('if-range'):null;
  const match=isPdf&&(!ifRange||ifRange===metadata.httpEtag)&&rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  let range;
  if(match&&(match[1]||match[2])){
    const start=match[1]?Number(match[1]):Math.max(0,metadata.size-Number(match[2]));
    const end=match[1]?(match[2]?Math.min(Number(match[2]),metadata.size-1):metadata.size-1):metadata.size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=metadata.size||start>end||(!match[1]&&Number(match[2])===0)){
      headers.set('Content-Range','bytes */'+metadata.size);headers.set('Content-Length','0');return new Response(null,{status:416,headers});
    }
    range={offset:start,length:end-start+1};headers.set('Content-Range',`bytes ${start}-${end}/${metadata.size}`);headers.set('Content-Length',String(range.length));
  }
  const object=await bucket.get(key,range?{range}:undefined);if(!object)return new Response('Not found',{status:404});
  return new Response(object.body,{status:range?206:200,headers});
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(Object.hasOwn(IMPORTED_PROJECT_IMAGES,url.pathname)){
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const asset=SITE_ASSETS[url.pathname];if(!asset)return new Response('Not found',{status:404});
    const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
    return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':'image/webp','Content-Length':String(bytes.length),'Cache-Control':'private, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname==='/api/project-pdf'||url.pathname.startsWith('/media/projects/')){try{return await projectPdf(request,env)}catch(error){console.error('Project PDF storage failure',error);return json({error:'项目文件上传或读取失败，请重试。'},503)}}
  if(url.pathname==='/api/photo'||url.pathname.startsWith('/media/photo/')){try{return await photos(request,env)}catch(error){console.error('Photo storage failure',error);return json({error:'照片上传或读取失败，请重试。'},503)}}
  if(url.pathname==='/api/content'){try{return await api(request,env)}catch(error){console.error('Portfolio storage failure',error);return json({error:'读取或保存失败，请稍后重试。你的修改仍保留在编辑器中。'},503)}}
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=SITE_ASSETS[url.pathname==='/'?'/index.html':url.pathname];
  if(!asset)return new Response('Not found',{status:404});
  const bytes=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.includes('/assets/')?'public, max-age=3600':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
