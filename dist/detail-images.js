window.DetailImages={async upload(files,onProgress=()=>{}){
  const ordered=[...files].sort((a,b)=>a.name.localeCompare(b.name,'zh',{numeric:true}));
  if(!ordered.length||ordered.length>40)throw Error('一次请选择 1–40 张详情图片。');
  if(ordered.some(file=>!['image/webp','image/jpeg','image/png'].includes(file.type)||!file.size||file.size>5*1024*1024))throw Error('支持 WebP、JPG、PNG，每张最大 5 MB。');
  if(ordered.reduce((sum,file)=>sum+file.size,0)>50*1024*1024)throw Error('本次图片总大小不能超过 50 MB。');
  const images=[];
  for(let index=0;index<ordered.length;index++){
    onProgress('正在处理详情图片 '+(index+1)+' / '+ordered.length+'…');
    const file=ordered[index],bitmap=await createImageBitmap(file);
    try{
      const width=Math.min(1600,bitmap.width),scale=width/bitmap.width,height=Math.max(1,Math.round(bitmap.height*scale));
      if(images.length+Math.ceil(height/2400)>120)throw Error('详情最多支持 120 段，请减少图片数量或高度。');
      for(let top=0;top<height;top+=2400){
        const tileHeight=Math.min(2400,height-top);let blob;
        if(file.type==='image/webp'&&width===bitmap.width&&height<=2400)blob=file;
        else{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=tileHeight;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,tileHeight);context.drawImage(bitmap,0,-top,width,height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));canvas.width=canvas.height=1;}
        if(!blob||blob.type!=='image/webp'||blob.size>5*1024*1024)throw Error('图片无法压缩，请导出较小的 WebP 后重试。');
        const response=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':'image/webp'},body:blob});const result=await response.json();if(!response.ok)throw Error(result.error||'详情图片上传失败。');
        images.push({url:result.url,width,height:tileHeight});
      }
    }finally{bitmap.close();}
  }
  return images;
},async uploadPdfPreview(prepared,onProgress=()=>{}){
  const images=[];
  for await(const {blob,width,height} of prepared.segments()){
    onProgress('正在保存快速预览 '+(images.length+1)+' / '+prepared.count+'…');
    const response=await fetch('/api/photo',{method:'POST',headers:{'Content-Type':'image/webp'},body:blob,signal:AbortSignal.timeout(45000)});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('预览上传未完成，请刷新网站并确认已登录。');
    const result=await response.json();if(!response.ok)throw Error(result.error||'快速预览上传失败。');
    images.push({url:result.url,width,height});
  }
  return images;
}};
