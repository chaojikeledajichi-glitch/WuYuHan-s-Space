const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openBucket}=require('../scripts/local-bucket.cjs');
test('PDF media serves exact byte ranges, HEAD metadata and full-file fallback',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pegboard-pdf-range-')),bucket=openBucket(root),key='projects/00000000-0000-0000-0000-000000000001.pdf',bytes=Buffer.from('%PDF-1.7\n0123456789\n%%EOF');
 await bucket.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 const calls=[],get=bucket.get.bind(bucket);bucket.get=async(...args)=>{calls.push(args[1]);return get(...args);};
 const worker=(await import('../server/worker.mjs')).default;
 const call=(headers={},method='GET')=>worker.fetch(new Request('https://site.example/media/'+key,{method,headers}),{BUCKET:bucket});
 try{
  let r=await call();assert.equal(r.status,200);assert.equal(r.headers.get('accept-ranges'),'bytes');assert.equal(Number(r.headers.get('content-length')),bytes.length);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);
  calls.length=0;r=await call({},'HEAD');assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,0);assert.equal(calls.length,0);
  for(const [range,start,end] of [['bytes=0-4',0,4],['bytes=5-',5,bytes.length-1],['bytes=-5',bytes.length-5,bytes.length-1],['bytes=2-999',2,bytes.length-1]]){
   r=await call({Range:range});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(start,end+1));assert.deepEqual(calls.at(-1),{range:{offset:start,length:end-start+1}});
  }
  r=await worker.fetch(new Request('https://site.example/media/'+key+'?pdfRange=0-4'),{BUCKET:bucket});assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(0,5));
  for(const query of ['bad','1-2-3','-1-5'])assert.equal((await worker.fetch(new Request('https://site.example/media/'+key+'?pdfRange='+query),{BUCKET:bucket})).status,400);
  for(const range of ['bytes=999-','bytes=5-2','bytes=-0']){r=await call({Range:range});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */'+bytes.length);assert.equal((await r.arrayBuffer()).byteLength,0);}
  for(const headers of [{Range:'bytes=0-1,3-5'},{Range:'nonsense'},{Range:'bytes=0-4','If-Range':'"outdated"'}]){r=await call(headers);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);}
  r=await call({Range:'bytes=0-4'},'HEAD');assert.equal(r.status,200);assert.equal(Number(r.headers.get('content-length')),bytes.length);
  assert.equal((await worker.fetch(new Request('https://site.example/media/projects/00000000-0000-0000-0000-000000000002.pdf'),{BUCKET:bucket})).status,404);
 }finally{for(const name of fs.readdirSync(root))fs.unlinkSync(path.join(root,name));fs.rmdirSync(root);}
});
