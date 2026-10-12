const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {openDatabase}=require('../scripts/local-db.cjs');
test('highlighted plain text stays safe, preserves emoji and follows edits',async()=>{
 const {renderHighlightedText,shiftHighlightRanges,validateTextHighlights}=await import('../shared/text-highlights.mjs');
 const text='前言\n关键成果😀 <img src=x onerror=alert(1)>';
 const html=renderHighlightedText(text,[{start:3,end:9}]);
 assert.match(html,/<mark class="text-highlight">关键成果😀<\/mark>/);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.deepEqual(shiftHighlightRanges([{start:3,end:7}],text,'新增'+text),[{start:5,end:9}]);
 assert.deepEqual(shiftHighlightRanges([{start:0,end:4}],'关键成果','关键新成果'),[{start:0,end:5}]);
 assert.deepEqual(shiftHighlightRanges([{start:0,end:4}],'关键成果',''),[]);
 assert.throws(()=>validateTextHighlights({about:[{start:8,end:9}]},{about:text}),/高亮范围无效/);
});
test('saved highlights persist, follow older editors and reject invalid or unauthorized changes',async()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('dist/content.js','utf8'),scope);
 const fixture={...JSON.parse(JSON.stringify(scope.window.SPACE_CONTENT)),siteTitle:'个人空间',headline:'生活的碎片',blurb:'收集作品和日常',about:'  背景\n关键成果😀  ',experiences:[{title:'设计实习',period:'2025',organization:'设计团队',role:'设计师',description:'负责界面设计'}],notes:[{title:'日常',date:'2026',text:'第一行\n值得记录的时刻'}]};
 fixture.highlights={about:[{start:5,end:11}],blurb:[{start:2,end:4}],'experiences.0.description':[{start:2,end:6}],'notes.0.text':[{start:4,end:11}]};
 const DB=openDatabase(':memory:'),worker=(await import('../server/worker.mjs')).default;
 const request=(method,body,owner=true)=>new Request('https://portfolio.test/api/content',{method,headers:{Origin:'https://portfolio.test','Content-Type':'application/json','oai-authenticated-user-id':owner?'owner-id':'visitor','oai-authenticated-user-email':owner?'chaojikeledajichi@gmail.com':'visitor@example.com'},body:body?JSON.stringify(body):undefined});
 const call=(method,content,revision,owner=true)=>worker.fetch(request(method,content?{content,revision}:undefined,owner),{DB});
 try{
  const first=await call('PUT',fixture,0);const saved=await first.json();assert.equal(first.status,200,JSON.stringify(saved));
  assert.deepEqual(saved.content.highlights.about,[{start:3,end:9}]);assert.equal(saved.content.about,'背景\n关键成果😀');
  const loaded=(await (await call('GET')).json()).content;assert.deepEqual(loaded.highlights,saved.content.highlights);
  const legacy=structuredClone(loaded);delete legacy.highlights;legacy.about='新增'+legacy.about;
  const second=await call('PUT',legacy,1);const updated=await second.json();assert.equal(second.status,200,JSON.stringify(updated));assert.deepEqual(updated.content.highlights.about,[{start:5,end:11}]);
  assert.deepEqual(updated.content.highlights['notes.0.text'],fixture.highlights['notes.0.text']);
  for(const invalid of [null,[],{name:[{start:0,end:1}]},{about:[{start:-1,end:1}]},{about:[{start:0,end:9999}]},{about:[{start:1.5,end:2}]},{about:[{start:0,end:0}]},{about:'<mark>text</mark>'}]){
   assert.equal((await call('PUT',{...updated.content,highlights:invalid},2)).status,400);
  }
  assert.equal((await call('PUT',updated.content,2,false)).status,403);
  const removed=await call('PUT',{...updated.content,highlights:{}},2);assert.equal(removed.status,200);
  assert.deepEqual((await (await call('GET')).json()).content.highlights,{});
 }finally{DB.raw.close();}
});
