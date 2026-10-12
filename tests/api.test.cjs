const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');
const {openDatabase}=require('../scripts/local-db.cjs');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/content.js'),'utf8'),context);
const fixture={...JSON.parse(JSON.stringify(context.window.SPACE_CONTENT)),siteTitle:'小周的空间',headline:'小小的日常',blurb:'保持好奇'};
const origin='https://portfolio.example';

test('folder and project colors persist, preserve older editors and reject invalid values',async()=>{
 const {normalizePortfolio,DEFAULT_FOLDER_COLORS}=await import('../shared/portfolio.mjs');
 const oldFolders={...structuredClone(fixture),projectCategories:['#ffee80','#ffbbef','#ccff99'].map((folderColor,i)=>({id:'category-'+(i+1),title:'分类',description:'',coverText:['Business\nSide','Visual\nSide','Growth\nSide'][i],folderColor}))};
 const themed=normalizePortfolio(oldFolders);
 assert.deepEqual(themed.projectCategories.map(c=>c.folderColor),DEFAULT_FOLDER_COLORS);
 assert.deepEqual(themed.projectCategories.map(c=>c.coverText),oldFolders.projectCategories.map(c=>c.coverText));
 themed.projectCategories[0].folderColor='#123456';assert.equal(normalizePortfolio(themed).projectCategories[0].folderColor,'#123456');
 const DB=openDatabase(':memory:');const worker=(await import('../server/worker.mjs')).default;
 const call=req=>worker.fetch(req,{DB});
 try{
  let response=await call(request('PUT',{content:fixture,revision:0}));assert.equal(response.status,200);
  let saved=(await response.json()).content;
  assert.deepEqual(saved.projectCategories.map(c=>c.folderColor),['#f2ce42','#bdcbd4','#c4492d']);
  assert.ok(saved.projects.every(p=>/^#[0-9a-f]{6}$/.test(p.cardColor)));
  saved.projectCategories[0].folderColor='#ABCDEF';saved.projects[0].cardColor='#123456';
  response=await call(request('PUT',{content:saved,revision:1}));assert.equal(response.status,200);
  saved=(await response.json()).content;assert.equal(saved.projectCategories[0].folderColor,'#abcdef');assert.equal(saved.projects[0].cardColor,'#123456');
  const legacy=structuredClone(saved);legacy.projectCategories.forEach(c=>delete c.folderColor);legacy.projects.forEach(p=>delete p.cardColor);
  response=await call(request('PUT',{content:legacy,revision:2}));assert.equal(response.status,200);
  assert.deepEqual((await response.json()).content,saved);
  for(const value of ['red','#fff','#000000;display:none',123]){
   for(const target of ['folder','project']){
    const invalid=structuredClone(saved);if(target==='folder')invalid.projectCategories[0].folderColor=value;else invalid.projects[0].cardColor=value;
    assert.equal((await call(request('PUT',{content:invalid,revision:3}))).status,400);
   }
  }
  const read=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(read.projectCategories.map(c=>c.folderColor),saved.projectCategories.map(c=>c.folderColor));
  assert.deepEqual(read.projects.map(p=>p.cardColor),saved.projects.map(p=>p.cardColor));
 }finally{DB.raw.close();}
});

test('four life albums preserve legacy content, validate photos and enforce ownership',async()=>{
 const DB=openDatabase(':memory:'),files=new Map(),BUCKET={async head(key){return files.get(key)||null;}};
 const worker=(await import('../server/worker.mjs')).default,call=req=>worker.fetch(req,{DB,BUCKET});
 try{
  let response=await call(request('PUT',{content:fixture,revision:0}));assert.equal(response.status,200);
  let saved=(await response.json()).content;
  assert.deepEqual(saved.lifeAlbums.map(a=>a.title),['与旅行','与美食','与爱好','与萌宠']);assert.ok(saved.lifeAlbums.every(a=>!a.cover&&!a.photos.length));
  const url='/media/photo/00000000-0000-0000-0000-000000000009.webp';files.set(url.slice(7),{customMetadata:{owner:'owner-id'}});
  saved.lifeAlbums[0].photos=[{url,caption:'第一张照片'}];saved.lifeAlbums[0].cover=url;
  response=await call(request('PUT',{content:saved,revision:1}));assert.equal(response.status,200);saved=(await response.json()).content;
  const legacy=structuredClone(saved);delete legacy.lifeAlbums;response=await call(request('PUT',{content:legacy,revision:2}));assert.equal(response.status,200);assert.deepEqual((await response.json()).content.lifeAlbums,saved.lifeAlbums);
  for(const change of [a=>a.pop(),a=>a[0].id='other',a=>a[0].photos=Array(41).fill({url,caption:''}),a=>a[0].photos=[{url:'https://example.com/a.png',caption:''}],a=>a[0].photos=[{url,caption:'x'.repeat(161)}],a=>a[0].cover='/assets/pegboard.png']){
   const invalid=structuredClone(saved);change(invalid.lifeAlbums);assert.equal((await call(request('PUT',{content:invalid,revision:3}))).status,400);
  }
  files.get(url.slice(7)).customMetadata.owner='other';assert.equal((await call(request('PUT',{content:saved,revision:3}))).status,400);files.get(url.slice(7)).customMetadata.owner='owner-id';
  saved.lifeAlbums[0].cover='';saved.lifeAlbums[0].photos=[];response=await call(request('PUT',{content:saved,revision:3}));assert.equal(response.status,200);
  const read=(await (await call(request('GET'))).json()).content;assert.deepEqual(read.lifeAlbums[0].photos,[]);assert.deepEqual(read.notes,fixture.notes);
 }finally{DB.raw.close();}
});
test('project PDFs validate uploads, persist across edits, and require owned matching files',async()=>{
 const DB=openDatabase(':memory:'),files=new Map();
 const BUCKET={async put(key,body,metadata){files.set(key,{body,...metadata,size:body.byteLength});},async head(key){return files.get(key)||null;},async get(key,options){const file=files.get(key);return file?{...file,body:options?.range?file.body.slice(options.range.offset,options.range.offset+options.range.length):file.body}:null;}};
 const worker=(await import('../server/worker.mjs')).default,call=req=>worker.fetch(req,{DB,BUCKET});
 const pdfBytes=Buffer.from('%PDF-1.7\nPDF fixture\n%%EOF'),coverBytes=Buffer.from('RIFF0000WEBPVP8 ');
 const upload=({owner=true,source=origin,pdf=pdfBytes,mime='application/pdf',pages='2',noCover=false}={})=>{const form=new FormData();form.append('pdf',new Blob([pdf],{type:mime}),'设计项目.pdf');if(!noCover)form.append('cover',new Blob([coverBytes],{type:'image/webp'}),'cover.webp');form.append('pages',pages);return new Request(origin+'/api/project-pdf',{method:'POST',headers:{Origin:source,'oai-authenticated-user-id':owner?'owner-id':'visitor','oai-authenticated-user-email':owner?'chaojikeledajichi@gmail.com':'visitor@example.com'},body:form});};
 try{
  assert.equal((await call(upload({owner:false}))).status,403);
  assert.equal((await call(upload({source:'https://other.example'}))).status,403);
  assert.equal((await call(upload({mime:'text/html'}))).status,415);
  assert.equal((await call(upload({pdf:'invalid'}))).status,400);
  assert.equal((await call(upload({pages:'0'}))).status,400);
  assert.equal((await call(upload({pdf:new Uint8Array(30*1024*1024+1)}))).status,413);
  const limitPdf=new Uint8Array(30*1024*1024);limitPdf.set(pdfBytes);
  assert.equal((await call(upload({pdf:limitPdf,noCover:true}))).status,200);
  let response=await call(upload());assert.equal(response.status,200);const attachment=(await response.json()).pdf;
  const file=await call(new Request(origin+attachment.url));assert.equal(file.headers.get('content-type'),'application/pdf');assert.deepEqual(Buffer.from(await file.arrayBuffer()),pdfBytes);
  const image=await call(new Request(origin+attachment.cover));assert.equal(image.headers.get('content-type'),'image/webp');
  const content=structuredClone(fixture);content.projects[0].pdf=attachment;
  assert.equal((await call(request('PUT',{content,revision:0}))).status,200);
  let saved=(await (await call(request('GET'))).json()).content;assert.deepEqual(saved.projects[0].pdf,attachment);
  const legacy=structuredClone(saved);delete legacy.projects[0].pdf;
  assert.equal((await call(request('PUT',{content:legacy,revision:1}))).status,200);
  saved=(await (await call(request('GET'))).json()).content;assert.deepEqual(saved.projects[0].pdf,attachment);
  const originalCover=saved.projects[0].pdf.cover;saved.projects[0].pdf.cover='/media/projects/00000000-0000-0000-0000-000000000000.webp';
  assert.equal((await call(request('PUT',{content:saved,revision:2}))).status,400);
  saved.projects[0].pdf.cover=originalCover;files.get(attachment.url.slice(7)).customMetadata.owner='another-user';
  assert.equal((await call(request('PUT',{content:saved,revision:2}))).status,400);files.get(attachment.url.slice(7)).customMetadata.owner='owner-id';
  const replacement=(await (await call(upload())).json()).pdf;saved.projects[0].pdf=replacement;
  assert.equal((await call(request('PUT',{content:saved,revision:2}))).status,200);
  assert.deepEqual((await (await call(request('GET'))).json()).content.projects[0].pdf,replacement);
  assert.equal((await call(request('PUT',{content,revision:2}))).status,409);
  saved.projects[0].pdf=null;assert.equal((await call(request('PUT',{content:saved,revision:3}))).status,200);
  assert.equal((await (await call(request('GET'))).json()).content.projects[0].pdf,null);
  // A document no longer needs a generated cover. Separate cover changes must
  // neither replace the PDF nor get lost when an older editor saves.
  const standalone=(await (await call(upload({noCover:true}))).json()).pdf;assert.equal(standalone.cover,undefined);
  const coverResponse=await call(new Request(origin+'/api/photo',{method:'POST',headers:{Origin:origin,'Content-Type':'image/png','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'chaojikeledajichi@gmail.com'},body:fs.readFileSync(path.join(__dirname,'../dist/assets/pegboard.png'))}));
  const coverUrl=(await coverResponse.json()).url;
  saved.projects[0].cover=coverUrl;saved.projects[0].pdf=standalone;
  assert.equal((await call(request('PUT',{content:saved,revision:4}))).status,200);
  let current=(await (await call(request('GET'))).json()).content;assert.equal(current.projects[0].cover,coverUrl);assert.deepEqual(current.projects[0].pdf,standalone);
  delete current.projects[0].cover;
  assert.equal((await call(request('PUT',{content:current,revision:5}))).status,200);
  current=(await (await call(request('GET'))).json()).content;assert.equal(current.projects[0].cover,coverUrl);
  current.projects[0].cover='';assert.equal((await call(request('PUT',{content:current,revision:6}))).status,200);
  current=(await (await call(request('GET'))).json()).content;assert.equal(current.projects[0].cover,'');assert.deepEqual(current.projects[0].pdf,standalone);
 }finally{DB.raw.close();}
});
test('detail images persist with the original PDF, preserve older editors and enforce ownership',async()=>{
 const DB=openDatabase(':memory:'),files=new Map();const BUCKET={async head(key){return files.get(key)||null;}};
 const worker=(await import('../server/worker.mjs')).default,call=req=>worker.fetch(req,{DB,BUCKET});
 const image={url:'/media/photo/00000000-0000-0000-0000-000000000001.webp',width:1600,height:2000};files.set(image.url.slice(7),{customMetadata:{owner:'owner-id'}});
 try{
  const content=structuredClone(fixture);content.projects[0].detailImages=[image];content.projects[0].pdf={url:'/media/projects/00000000-0000-0000-0000-000000000002.pdf',name:'原文件.pdf',pages:2};files.set(content.projects[0].pdf.url.slice(7),{customMetadata:{owner:'owner-id'}});let r=await call(request('PUT',{content,revision:0}));assert.equal(r.status,200);
  let saved=(await r.json()).content;assert.deepEqual(saved.projects[0].detailImages,[image]);assert.deepEqual(saved.projects[0].pdf,content.projects[0].pdf);
  const legacy=structuredClone(saved);delete legacy.projects[0].detailImages;r=await call(request('PUT',{content:legacy,revision:1}));assert.equal(r.status,200);saved=(await r.json()).content;assert.deepEqual(saved.projects[0].detailImages,[image]);
  for(const bad of [{...image,url:'https://other.example/image.webp'},{...image,width:1601},{...image,height:2401}]){const invalid=structuredClone(saved);invalid.projects[0].detailImages=[bad];assert.equal((await call(request('PUT',{content:invalid,revision:2}))).status,400);}
  files.get(image.url.slice(7)).customMetadata.owner='other';assert.equal((await call(request('PUT',{content:saved,revision:2}))).status,400);files.get(image.url.slice(7)).customMetadata.owner='owner-id';
  saved.projects[0].detailImages=[];r=await call(request('PUT',{content:saved,revision:2}));assert.equal(r.status,200);assert.deepEqual((await r.json()).content.projects[0].detailImages,[]);
 }finally{DB.raw.close();}
});
test('three portfolio categories persist, reject invalid groups, and preserve legacy assignments',async()=>{
 const DB=openDatabase(':memory:');const worker=(await import('../server/worker.mjs')).default;
 const call=req=>worker.fetch(req,{DB});
 try{
  assert.equal((await call(request('PUT',{content:fixture,revision:0}))).status,200);
  let saved=(await (await call(request('GET'))).json()).content;
  assert.equal(saved.projectCategories.length,3);
  assert.deepEqual(saved.projects.map(p=>p.categoryId),['category-1','category-2','category-3']);
  saved.projectCategories[0].title='视觉项目';saved.projects[0].categoryId='category-2';
  assert.equal((await call(request('PUT',{content:saved,revision:1}))).status,200);
  const legacy=structuredClone(saved);delete legacy.projectCategories;legacy.projects.forEach(p=>delete p.categoryId);
  assert.equal((await call(request('PUT',{content:legacy,revision:2}))).status,200);
  saved=(await (await call(request('GET'))).json()).content;
  assert.equal(saved.projectCategories[0].title,'视觉项目');assert.equal(saved.projects[0].categoryId,'category-2');
  for(const count of [0,2,4]){
   const categories=Array.from({length:count},(_,i)=>saved.projectCategories[i%3]);
   assert.equal((await call(request('PUT',{content:{...saved,projectCategories:categories},revision:3}))).status,400);
  }
  assert.equal((await call(request('PUT',{content:{...saved,projects:null},revision:3}))).status,400);
  assert.equal((await call(request('PUT',{content:{...saved,projects:[{...saved.projects[0],categoryId:'missing'}]},revision:3}))).status,400);
  assert.deepEqual((await (await call(request('GET'))).json()).content.projects,saved.projects);
 }finally{DB.raw.close();}
});
test('category cover text persists, defaults safely and survives an older editor',async()=>{
 const DB=openDatabase(':memory:');const worker=(await import('../server/worker.mjs')).default;
 const call=req=>worker.fetch(req,{DB});
 try{
  assert.equal((await call(request('PUT',{content:fixture,revision:0}))).status,200);
  let saved=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(saved.projectCategories.map(c=>c.coverText),['01\nWORKS','02\nWORKS','03\nWORKS']);
  const labels=['业务\n作品','视觉\n设计','增长\n案例'];
  saved.projectCategories.forEach((c,i)=>c.coverText=labels[i]);
  assert.equal((await call(request('PUT',{content:saved,revision:1}))).status,200);
  saved=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(saved.projectCategories.map(c=>c.coverText),labels);
  const legacy=structuredClone(saved);legacy.projectCategories.forEach(c=>delete c.coverText);
  assert.equal((await call(request('PUT',{content:legacy,revision:2}))).status,200);
  saved=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(saved.projectCategories.map(c=>c.coverText),labels);
  for(const value of ['x'.repeat(25),123]){
   const invalid=structuredClone(saved);invalid.projectCategories[0].coverText=value;
   assert.equal((await call(request('PUT',{content:invalid,revision:3}))).status,400);
  }
  saved.projectCategories[0].coverText='';
  assert.equal((await call(request('PUT',{content:saved,revision:3}))).status,200);
  assert.equal((await (await call(request('GET'))).json()).content.projectCategories[0].coverText,'');
 }finally{DB.raw.close();}
});

test('experiences persist, validate fields, and survive saves from an older editor',async()=>{
 const DB=openDatabase(':memory:');const worker=(await import('../server/worker.mjs')).default;
 const call=req=>worker.fetch(req,{DB});
 const oldContent=structuredClone(fixture);delete oldContent.experiences;
 const experiences=[{title:'测试经历',period:'2024.09 — 2026.06',organization:'测试单位',role:'测试职位',description:'第一段\n第二段',image:''}];
 try{
  let response=await call(request('PUT',{content:oldContent,revision:0}));assert.equal(response.status,200);
  assert.deepEqual((await (await call(request('GET'))).json()).content.experiences,[]);
  response=await call(request('PUT',{content:{...fixture,experiences},revision:1}));assert.equal(response.status,200);
  let read=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(read.experiences,experiences);assert.deepEqual(read.skills,fixture.skills);
  // A tab opened before this feature must not discard the newly added experience.
  response=await call(request('PUT',{content:{...oldContent,name:'更新姓名'},revision:2}));assert.equal(response.status,200);
  read=(await (await call(request('GET'))).json()).content;
  assert.deepEqual(read.experiences,experiences);assert.equal(read.name,'更新姓名');
  for(const invalid of [null,Array(17).fill(experiences[0]),[{...experiences[0],title:''}],[{...experiences[0],description:'x'.repeat(4001)}]]){
   assert.equal((await call(request('PUT',{content:{...fixture,experiences:invalid},revision:3}))).status,400);
  }
  assert.deepEqual((await (await call(request('GET'))).json()).content.experiences,experiences);
  response=await call(request('PUT',{content:{...fixture,experiences:[]},revision:3}));assert.equal(response.status,200);
  assert.deepEqual((await (await call(request('GET'))).json()).content.experiences,[]);
 }finally{DB.raw.close();}
});
function request(method,payload,{user='owner-id',email='chaojikeledajichi@gmail.com',source=origin}={}){return new Request(origin+'/api/content',{method,headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':email,Origin:source,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(payload)});}
test('owner save persists across connections; stale or unauthorized writes cannot overwrite',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pegboard-test-'));const file=path.join(dir,'test.sqlite');let DB=openDatabase(file);const worker=(await import('../server/worker.mjs')).default;
 const call=(req)=>worker.fetch(req,{DB});
 try{
 let result=await call(request('GET'));let data=await result.json();assert.equal(data.canEdit,true);assert.equal(data.revision,0);
 assert.equal((await call(request('PUT',{content:fixture,revision:0},{user:'visitor',email:'visitor@example.com'}))).status,403);
 assert.equal((await call(request('PUT',{content:fixture,revision:0},{source:'https://other.example'}))).status,403);
 assert.equal((await call(request('PUT',{content:{...fixture,email:'invalid'},revision:0}))).status,400);
 result=await call(request('PUT',{content:fixture,revision:0}));assert.equal(result.status,200);data=await result.json();assert.equal(data.revision,1);
 DB.raw.close();DB=openDatabase(file);
 data=await (await call(request('GET'))).json();assert.equal(data.content.siteTitle,'小周的空间');assert.equal(data.revision,1);
 assert.equal((await call(request('PUT',{content:{...fixture,name:'Stale'},revision:0}))).status,409);
 assert.equal((await call(request('PUT',{content:fixture,revision:1},{user:'different-id'}))).status,403);
 result=await call(request('PUT',{content:{...fixture,name:'新名字'},revision:1}));assert.equal(result.status,200);assert.equal((await result.json()).revision,2);
 assert.equal((await (await call(request('GET',undefined,{user:'visitor',email:'visitor@example.com'}))).json()).canEdit,false);
 assert.equal((await (await call(request('GET'))).json()).content.name,'新名字');
 }finally{DB.raw.close();fs.rmSync(file);fs.rmdirSync(dir);}
});
test('photo upload requires owner, rejects invalid files and saves an owned photo reference',async()=>{
 const DB=openDatabase(':memory:');const files=new Map();const BUCKET={async put(key,body,metadata){files.set(key,{body,...metadata});},async head(key){return files.get(key)||null;},async get(key){return files.get(key)||null;}};
 const worker=(await import('../server/worker.mjs')).default;const call=req=>worker.fetch(req,{DB,BUCKET});
 const bytes=fs.readFileSync(path.join(__dirname,'../dist/assets/pegboard.png'));
 const upload=(body=bytes,mime='image/png',owner=true)=>new Request(origin+'/api/photo',{method:'POST',headers:{Origin:origin,'Content-Type':mime,'oai-authenticated-user-id':owner?'owner-id':'visitor','oai-authenticated-user-email':owner?'chaojikeledajichi@gmail.com':'visitor@example.com'},body});
 try{
 assert.equal((await call(upload(bytes,'image/png',false))).status,403);
 assert.equal((await call(upload('<svg/>','image/svg+xml'))).status,415);
 assert.equal((await call(upload('invalid'))).status,400);
 assert.equal((await call(upload(new Uint8Array(5*1024*1024+1)))).status,413);
 const response=await call(upload());assert.equal(response.status,200);const {url}=await response.json();
 const image=await call(new Request(origin+url));assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
 assert.equal((await call(request('PUT',{content:{...fixture,photo:url},revision:0}))).status,200);
 assert.equal((await (await call(request('GET'))).json()).content.photo,url);
 assert.equal((await call(request('PUT',{content:{...fixture,photo:'/media/photo/00000000-0000-0000-0000-000000000000.png'},revision:1}))).status,400);
 assert.equal((await call(request('PUT',{content:{...fixture,photo:''},revision:1}))).status,200);
 }finally{DB.raw.close();}
});
