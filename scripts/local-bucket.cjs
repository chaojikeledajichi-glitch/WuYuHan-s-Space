const fs=require('node:fs'),path=require('node:path');
function openBucket(root){fs.mkdirSync(root,{recursive:true});const location=key=>{if(!/^(photo\/[0-9a-f-]{36}\.(png|jpg|webp)|projects\/[0-9a-f-]{36}\.(pdf|webp))$/.test(key))throw Error('Invalid media key');return path.join(root,key.startsWith('photo/')?key.slice(6):key.replace('/','-'));};return {
 async put(key,bytes,metadata){const file=location(key);fs.writeFileSync(file,bytes);fs.writeFileSync(file+'.json',JSON.stringify(metadata));},
 async head(key){const file=location(key);return fs.existsSync(file)?{...JSON.parse(fs.readFileSync(file+'.json','utf8')),size:fs.statSync(file).size}:null;},
 async get(key,options){const file=location(key);if(!fs.existsSync(file))return null;const size=fs.statSync(file).size,range=options?.range;let body;
  if(range){body=Buffer.alloc(range.length);const descriptor=fs.openSync(file,'r');try{fs.readSync(descriptor,body,0,range.length,range.offset);}finally{fs.closeSync(descriptor);}}
  else body=fs.readFileSync(file);
  return {...JSON.parse(fs.readFileSync(file+'.json','utf8')),size,body:new Uint8Array(body),...(range?{range}:{})};}
};}
module.exports={openBucket};
