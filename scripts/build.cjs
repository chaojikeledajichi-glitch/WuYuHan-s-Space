const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const assets={};
const imported=fs.readFileSync(path.join(root,'shared/project-import.mjs'),'utf8').replace(/^export /gm,'');
const importedImages=require('node:vm').runInNewContext(imported+'\nIMPORTED_PROJECT_IMAGES');
for(const [url,file] of Object.entries(importedImages)){assets[url]={type:'image/webp',binary:true,body:fs.readFileSync(path.join(dist,file),'base64')};}
const vendor=path.join(dist,'vendor/pdfjs');fs.mkdirSync(vendor,{recursive:true});
// The compatibility build also supports embedded browsers and their workers.
for(const name of ['pdf.min.mjs','pdf.worker.min.mjs'])fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/legacy/build',name),path.join(vendor,name));
for(const name of ['cmaps','standard_fonts','wasm'])fs.cpSync(path.join(root,'node_modules/pdfjs-dist',name),path.join(vendor,name),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/pdfjs-dist/LICENSE'),path.join(vendor,'LICENSE'));
function embedVendor(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory()){embedVendor(file);continue;}const ext=path.extname(file),type=ext==='.mjs'||ext==='.js'?'text/javascript; charset=utf-8':ext==='.wasm'?'application/wasm':'application/octet-stream';assets['/'+path.relative(dist,file).replaceAll('\\','/')]={type,binary:true,body:fs.readFileSync(file,'base64')};}}
embedVendor(vendor);
const portfolio=fs.readFileSync(path.join(root,'shared/portfolio.mjs'),'utf8').replace(/^export /gm,'');
fs.writeFileSync(path.join(dist,'portfolio.js'),'// Generated from shared/portfolio.mjs\n'+portfolio);
const highlights=fs.readFileSync(path.join(root,'shared/text-highlights.mjs'),'utf8').replace(/^export /gm,'');
fs.writeFileSync(path.join(dist,'text-highlights.js'),'// Generated from shared/text-highlights.mjs\n'+highlights);
// Changed scripts and styles receive new URLs, including in authenticated tabs.
const crypto=require('node:crypto'),indexPath=path.join(dist,'index.html');
const index=fs.readFileSync(indexPath,'utf8').replace(/(src|href)="([\w.-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"/g,(_,attribute,file)=>{
  const version=crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,file))).digest('hex').slice(0,12);
  return `${attribute}="${file}?v=${version}"`;
});
fs.writeFileSync(indexPath,index);
const masks=fs.readdirSync(path.join(dist,'assets/masks')).filter(file=>file.endsWith('.svg')).map(file=>'assets/masks/'+file);
for(const file of ['index.html','pdf-viewer.html','styles.css','app.js','content.js','portfolio.js','text-highlights.js','project-pdf.js','pdf-transport.mjs','pdf-preview.mjs','detail-images.js','editor.js','editor.css','motion.js','motion.css','assets/pegboard.png','assets/pegboard-clean.png','assets/instant-camera.png','assets/wechat-qr.png',...masks]){const binary=file.endsWith('.png');assets['/'+file]={type:types[path.extname(file)],binary,body:fs.readFileSync(path.join(dist,file),binary?'base64':'utf8')};}
fs.mkdirSync(path.join(dist,'server'),{recursive:true});
const worker=fs.readFileSync(path.join(root,'server/worker.mjs'),'utf8').replace("import { normalizePortfolio, DEFAULT_PROJECT_CATEGORIES, LIFE_ALBUM_IDS } from '../shared/portfolio.mjs';",'').replace("import { IMPORTED_PROJECT_IMAGES, attachImportedProjectPreviews } from '../shared/project-import.mjs';",'').replace("import { validateTextHighlights } from '../shared/text-highlights.mjs';",'');
fs.writeFileSync(path.join(dist,'server/index.js'),'const SITE_ASSETS = '+JSON.stringify(assets)+';\n'+portfolio+'\n'+imported+'\n'+highlights+'\n'+worker);
fs.mkdirSync(path.join(dist,'.openai/drizzle'),{recursive:true});
fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));
fs.cpSync(path.join(root,'drizzle'),path.join(dist,'.openai/drizzle'),{recursive:true});
console.log('Built self-contained Worker, assets and database migrations.');
