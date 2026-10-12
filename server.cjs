const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'dist');
const {openDatabase}=require('./scripts/local-db.cjs');
fs.mkdirSync(path.join(__dirname,'.sites-runtime'),{recursive:true});
const DB=openDatabase(path.join(__dirname,'.sites-runtime/content.sqlite'));
const BUCKET=require('./scripts/local-bucket.cjs').openBucket(path.join(__dirname,'.sites-runtime/photos'));
const worker=import('./server/worker.mjs');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end('Bad request');}
 if(pathname.startsWith('/api/')||pathname.startsWith('/media/')){
   try{const parts=[];let size=0;for await(const part of req){size+=part.length;if(size>33*1024*1024){res.writeHead(413);return res.end('Content too large');}parts.push(part);}const input=Buffer.concat(parts);
   const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-owner');headers.set('oai-authenticated-user-email','chaojikeledajichi@gmail.com');
   const response=await (await worker).default.fetch(new Request('http://127.0.0.1:4317'+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:input}),{DB,BUCKET});
   res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}catch(error){console.error(error);res.writeHead(500);return res.end('Local server error');}
 }
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||pathname.startsWith('/server/')||pathname.startsWith('/.openai/')){res.writeHead(403);return res.end('Forbidden');}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
}).listen(4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4317'));
