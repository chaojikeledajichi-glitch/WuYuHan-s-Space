const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {openDatabase}=require('../scripts/local-db.cjs');
test('phone and WeChat persist, survive older editors, can be cleared and reject invalid writes',async()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('dist/content.js','utf8'),scope);
 const fixture={...JSON.parse(JSON.stringify(scope.window.SPACE_CONTENT)),siteTitle:'个人空间',headline:'作品与日常',blurb:'收集灵感',phone:' +86 138-0000-0000 ',wechat:' example_wechat '};
 const DB=openDatabase(':memory:'),worker=(await import('../server/worker.mjs')).default;
 const call=(method,content,revision,owner=true)=>worker.fetch(new Request('https://portfolio.test/api/content',{method,headers:{Origin:'https://portfolio.test','Content-Type':'application/json','oai-authenticated-user-id':owner?'owner-id':'visitor','oai-authenticated-user-email':owner?'chaojikeledajichi@gmail.com':'visitor@example.com'},body:content?JSON.stringify({content,revision}):undefined}),{DB});
 try{
  const response=await call('PUT',fixture,0),saved=await response.json();assert.equal(response.status,200,JSON.stringify(saved));assert.equal(saved.content.phone,'+86 138-0000-0000');assert.equal(saved.content.wechat,'example_wechat');
  const legacy=structuredClone(saved.content);delete legacy.phone;delete legacy.wechat;legacy.name='更新姓名';
  assert.equal((await call('PUT',legacy,1)).status,200);
  const loaded=(await (await call('GET')).json()).content;assert.equal(loaded.phone,saved.content.phone);assert.equal(loaded.wechat,saved.content.wechat);assert.equal(loaded.email,fixture.email);
  for(const update of [{phone:'javascript:alert(1)'},{phone:'++123'},{phone:'12'},{phone:null},{phone:'1'.repeat(41)},{wechat:'x'.repeat(101)},{wechat:null}])assert.equal((await call('PUT',{...loaded,...update},2)).status,400);
  assert.equal((await call('PUT',loaded,2,false)).status,403);
  assert.equal((await call('PUT',{...loaded,phone:'',wechat:''},2)).status,200);
  const cleared=(await (await call('GET')).json()).content;assert.equal(cleared.phone,'');assert.equal(cleared.wechat,'');assert.equal(cleared.email,fixture.email);
 }finally{DB.raw.close();}
});
