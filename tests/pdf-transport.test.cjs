const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
function documentBytes(padding=0){
  const stream='BT /F1 24 Tf 40 180 Td (REAL PDF PARSE) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 420] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  if(padding)objects.push('<< /Length '+padding+' >>\nstream\n'+' '.repeat(padding)+'\nendstream');
  let text='%PDF-1.4\n',offsets=[];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
  const xref=Buffer.byteLength(text);text+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Root 1 0 R /Size '+(objects.length+1)+' >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(text);
}
const url='https://site.example/media/projects/00000000-0000-0000-0000-000000000001.pdf';
test('real parser reads the first page of a near-30MB PDF when a proxy drops Range headers',async()=>{
  const engine=await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs'),{openPdfSource}=await import('../dist/pdf-transport.mjs'),worker=(await import('../server/worker.mjs')).default;
  const bytes=documentBytes(29*1024*1024),requests=[];
  const BUCKET={async head(){return {size:bytes.length};},async get(key,{range}={}){requests.push(range);return {body:range?bytes.subarray(range.offset,range.offset+range.length):bytes};}};
  const source=await openPdfSource(engine,url,{fetchImpl:request=>worker.fetch(new Request(request),{BUCKET})});
  const task=engine.getDocument({...source,isEvalSupported:false,standardFontDataUrl:path.resolve(__dirname,'../node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/'});
  try{const pdf=await task.promise;assert.equal(pdf.numPages,1);const page=await pdf.getPage(1);const text=await page.getTextContent();assert.equal(text.items[0].str,'REAL PDF PARSE');assert.ok(requests.length>=2);assert.ok(requests.every(range=>range&&range.length<bytes.length));assert.ok(requests.reduce((n,r)=>n+r.length,0)<1024*1024);}
  finally{await task.destroy();}
});
test('reader handles small PDFs, full-file fallback, invalid responses, timeout and a fresh retry',async()=>{
  const engine=await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs'),{openPdfSource}=await import('../dist/pdf-transport.mjs'),bytes=documentBytes();
  let source=await openPdfSource(engine,url,{fetchImpl:async()=>new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.length)}})});assert.deepEqual(Buffer.from(source.data),bytes);
  for(const response of [new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}),new Response(null,{status:403}),new Response(bytes,{status:206,headers:{'Content-Type':'application/pdf','Content-Range':'bytes 0-99/9999'}})])await assert.rejects(openPdfSource(engine,url,{fetchImpl:async()=>response}));
  await assert.rejects(openPdfSource(engine,url,{timeoutMs:10,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))}),/超时/);
  const stop=new AbortController();stop.abort();await assert.rejects(openPdfSource(engine,url,{signal:stop.signal}),{name:'AbortError'});
  source=await openPdfSource(engine,url,{fetchImpl:async()=>new Response(bytes,{status:206,headers:{'Content-Type':'application/pdf','Content-Range':`bytes 0-${bytes.length-1}/${bytes.length}`}})});assert.deepEqual(Buffer.from(source.data),bytes);
});

test('normalized range responses remain partial and full-download recovery removes range queries',async()=>{
  const engine=await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs'),{openPdfSource}=await import('../dist/pdf-transport.mjs'),bytes=documentBytes(300000);
  const source=await openPdfSource(engine,url,{fetchImpl:async()=>new Response(bytes.subarray(0,262144),{status:200,headers:{'Content-Type':'application/pdf','Content-Range':`bytes 0-262143/${bytes.length}`}})});
  assert.ok(source.range);source.range.abort();
  const full=await openPdfSource(engine,url+'?pdfRange=0-99',{forceFull:true,fetchImpl:async request=>{assert.equal(new URL(request).searchParams.has('pdfRange'),false);return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.length)}});}});
  assert.deepEqual(Buffer.from(full.data),bytes);
});

