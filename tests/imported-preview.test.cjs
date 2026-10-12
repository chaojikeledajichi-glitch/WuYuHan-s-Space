const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {openDatabase}=require('../scripts/local-db.cjs');
test('Hi Translate preview is delivered from the packaged Site and survives an older editor save',async()=>{
 const {HI_TRANSLATE_PREVIEW,PROJECT_COVERS,IMPORTED_PROJECT_IMAGES,attachImportedProjectPreviews}=await import('../shared/project-import.mjs');
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('dist/content.js','utf8'),scope);
 const content=JSON.parse(JSON.stringify(scope.window.SPACE_CONTENT));
 Object.assign(content,{siteTitle:'个人空间',headline:'生活的碎片',blurb:'收集作品和日常'});
 content.projects[0].categoryId='category-1';content.projects[0].detailImages=[];
 content.projects[1].categoryId='category-1';content.projects[1].title='Hi translate项目重构升级 ';content.projects[1].detailImages=[];
 content.projects[2].categoryId='category-2';
 const DB=openDatabase(':memory:');
 DB.raw.prepare('INSERT INTO portfolio(id,data,revision,owner_user_id,updated_at) VALUES(?,?,?,?,?)').run('main',JSON.stringify(content),1,'owner-id',new Date().toISOString());
 const context={URL,Response,Request,Headers,Uint8Array,atob,structuredClone,TextEncoder,TextDecoder,console};
 vm.runInNewContext(fs.readFileSync('dist/server/index.js','utf8').replace('export default','globalThis.WORKER ='),context);
 const worker=context.WORKER;
 const request=(method,body)=>new Request('https://portfolio.example/api/content',{method,headers:{Origin:'https://portfolio.example','Content-Type':'application/json','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'chaojikeledajichi@gmail.com'},body:body?JSON.stringify(body):undefined});
 try{
  const loaded=await (await worker.fetch(request('GET'),{DB})).json();
  assert.equal(loaded.revision,1);assert.equal(loaded.content.projects[1].detailImages.length,16);
  assert.deepEqual(loaded.content.projects[1].detailImages,HI_TRANSLATE_PREVIEW);
  assert.equal(loaded.content.projects[1].cover,PROJECT_COVERS[2]);
  assert.deepEqual(loaded.content.projects[0].detailImages,[]);
  assert.deepEqual(JSON.parse(DB.raw.prepare('SELECT data FROM portfolio').get().data),content);
  for(const image of HI_TRANSLATE_PREVIEW){
   const response=await worker.fetch(new Request('https://portfolio.example'+image.url),{});
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync('dist/'+IMPORTED_PROJECT_IMAGES[image.url]));
  }
  const legacy=structuredClone(loaded.content);delete legacy.projects[1].detailImages;
  const saved=await worker.fetch(request('PUT',{content:legacy,revision:1}),{DB});
  const savedData=await saved.json();assert.equal(saved.status,200,JSON.stringify(savedData));assert.equal(savedData.content.projects[1].detailImages.length,16);
  assert.equal(JSON.parse(DB.raw.prepare('SELECT data FROM portfolio').get().data).projects[1].detailImages.length,16);
  const custom=structuredClone(content);custom.projects[1].cover='/media/photo/00000000-0000-0000-0000-000000000000.webp';custom.projects[1].detailImages=[{url:'/media/photo/00000000-0000-0000-0000-000000000000.webp',width:100,height:100}];
  assert.deepEqual(attachImportedProjectPreviews(custom),custom);
  const unrelated=structuredClone(content);unrelated.projects[1].title='另一个项目';assert.deepEqual(attachImportedProjectPreviews(unrelated),unrelated);
 }finally{DB.raw.close();}
});

test('three visual PDFs bind to the selected records, add one project and retain the association after saving',async()=>{
 const {VISUAL_PROJECT_PREVIEWS,GROWTH_PROJECT_PREVIEW,HI_TRANSLATE_PREVIEW,PROJECT_COVERS,REPLACED_PROJECT_COVERS,IMPORTED_PROJECT_IMAGES,attachImportedProjectPreviews}=await import('../shared/project-import.mjs');
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('dist/content.js','utf8'),scope);
 const content=JSON.parse(JSON.stringify(scope.window.SPACE_CONTENT));
 Object.assign(content,{siteTitle:'个人空间',headline:'生活的碎片',blurb:'收集作品和日常'});
 const template=content.projects[0];
 content.projects=Array.from({length:7},(_,i)=>({...structuredClone(template),id:'project-'+i,title:i===5?'项目 02（待补充）':i===6?'项目 03（待补充）':'已有项目 '+i,categoryId:i>=5?'category-2':i===2?'category-3':'category-1',cover:'',pdf:null,detailImages:[]}));
 content.projects[0].title='美团-AI访谈项目打造';content.projects[1].title='Hi translate项目重构升级';
 content.projects[5].cover=REPLACED_PROJECT_COVERS[4][0];
 const DB=openDatabase(':memory:');
 DB.raw.prepare('INSERT INTO portfolio(id,data,revision,owner_user_id,updated_at) VALUES(?,?,?,?,?)').run('main',JSON.stringify(content),1,'owner-id',new Date().toISOString());
 const context={URL,Response,Request,Headers,Uint8Array,atob,structuredClone,TextEncoder,TextDecoder,console};
 vm.runInNewContext(fs.readFileSync('dist/server/index.js','utf8').replace('export default','globalThis.WORKER ='),context);
 const worker=context.WORKER;
 const request=(method,body)=>new Request('https://portfolio.example/api/content',{method,headers:{Origin:'https://portfolio.example','Content-Type':'application/json','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'chaojikeledajichi@gmail.com'},body:body?JSON.stringify(body):undefined});
 try{
  const loaded=await (await worker.fetch(request('GET'),{DB})).json();
  assert.equal(loaded.content.projects.length,8);
  const visual=loaded.content.projects.filter(project=>project.categoryId==='category-2');
  assert.deepEqual(visual.map(project=>project.id),['project-5','project-6','project-7']);
  assert.deepEqual(visual.map(project=>project.detailImages.length),[25,11,11]);
  assert.deepEqual(loaded.content.projects.slice(0,5).map(project=>project.detailImages),[[],HI_TRANSLATE_PREVIEW,GROWTH_PROJECT_PREVIEW,[],[]]);
  const expectedCovers=[PROJECT_COVERS[1],PROJECT_COVERS[2],PROJECT_COVERS[7],'','',PROJECT_COVERS[4],PROJECT_COVERS[5],PROJECT_COVERS[6]];
  assert.deepEqual(loaded.content.projects.map(project=>project.cover),expectedCovers);
  for(const url of Object.values(PROJECT_COVERS)){
   const response=await worker.fetch(new Request('https://portfolio.example'+url),{});
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync('dist/'+IMPORTED_PROJECT_IMAGES[url]));
  }
  const custom=structuredClone(loaded.content);for(const project of custom.projects)project.cover='/media/photo/00000000-0000-0000-0000-000000000000.webp';
  assert.deepEqual(attachImportedProjectPreviews(custom),custom);
  const generated=structuredClone(content);generated.projects[0].pdf={cover:'/media/projects/00000000-0000-0000-0000-000000000000.webp'};generated.projects[0].cover=generated.projects[0].pdf.cover;
  assert.equal(attachImportedProjectPreviews(generated).projects[0].cover,PROJECT_COVERS[1]);
  assert.equal(loaded.content.projects[2].detailImages.length,11);
  for(const image of GROWTH_PROJECT_PREVIEW){
   const response=await worker.fetch(new Request('https://portfolio.example'+image.url),{});
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync('dist/'+IMPORTED_PROJECT_IMAGES[image.url]));
  }
  for(let i=0;i<3;i++){
   assert.deepEqual(visual[i].detailImages,VISUAL_PROJECT_PREVIEWS[i].images);
   for(const image of visual[i].detailImages){
    const response=await worker.fetch(new Request('https://portfolio.example'+image.url),{});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync('dist/'+IMPORTED_PROJECT_IMAGES[image.url]));
   }
  }
  const response=await worker.fetch(request('PUT',{content:loaded.content,revision:1}),{DB});
  const saved=await response.json();assert.equal(response.status,200,JSON.stringify(saved));
  assert.equal(JSON.parse(DB.raw.prepare('SELECT data FROM portfolio').get().data).projects.length,8);
  assert.equal(JSON.parse(DB.raw.prepare('SELECT data FROM portfolio').get().data).projects[5].cover,PROJECT_COVERS[4]);
  const reloaded=await (await worker.fetch(request('GET'),{DB})).json();
  assert.equal(reloaded.content.projects.length,8);assert.deepEqual(reloaded.content.projects,saved.content.projects);
  const legacy=structuredClone(saved.content);for(const project of legacy.projects)delete project.detailImages;
  const legacyResponse=await worker.fetch(request('PUT',{content:legacy,revision:2}),{DB});assert.equal(legacyResponse.status,200);
  const legacySaved=(await legacyResponse.json()).content;
  assert.deepEqual(legacySaved.projects.slice(5).map(project=>project.detailImages.length),[25,11,11]);
  assert.deepEqual(legacySaved.projects[2].detailImages,GROWTH_PROJECT_PREVIEW);
  assert.deepEqual(legacySaved.projects.map(project=>project.cover),expectedCovers);
 }finally{DB.raw.close();}
});
