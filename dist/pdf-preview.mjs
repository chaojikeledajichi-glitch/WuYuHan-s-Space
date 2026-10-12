// Render once during upload; saved WebP segments are reused by every visitor.
export async function preparePdfPreview(pdfjs,file,{options={},onProgress=()=>{},createCanvas=()=>document.createElement('canvas'),encodeCanvas=canvas=>new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9))}={}){
  const task=pdfjs.getDocument({...options,data:new Uint8Array(await file.arrayBuffer())});
  task.onPassword=()=>task.destroy();
  const within=(promise,message)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{task.destroy().catch(()=>{});reject(Error(message));},30000);
    Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));
  });
  try{
    const pdf=await within(task.promise,'PDF 读取超时，请重新上传。');
    if(pdf.numPages>1000)throw Error('PDF 最多支持 1000 页。');
    const records=[];let count=0;
    for(let number=1;number<=pdf.numPages;number++){
      onProgress('正在准备快速预览 '+number+' / '+pdf.numPages+'…');
      const page=await within(pdf.getPage(number),'PDF 页面读取超时，请重新上传。'),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:1600/base.width});
      const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
      count+=Math.ceil(height/2400);
      if(count>120)throw Error('快速预览最多支持 120 段，请将作品拆成多个项目。');
      records.push({page,viewport,width,height});
    }
    return {pages:pdf.numPages,count,dispose:()=>task.destroy(),async *segments(){
      let index=0;
      for(const {page,viewport,width,height} of records){
        for(let offset=0;offset<height;offset+=2400){
          const tileHeight=Math.min(2400,height-offset),canvas=createCanvas();canvas.width=width;canvas.height=tileHeight;
          try{
            onProgress('正在生成快速预览 '+(++index)+' / '+count+'…');
            await within(page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[1,0,0,1,0,-offset],background:'#ffffff',annotationMode:pdfjs.AnnotationMode.DISABLE}).promise,'PDF 转换超时，请导出较小的 PDF 后重试。');
            const blob=await encodeCanvas(canvas);
            if(!blob||blob.type!=='image/webp'||!blob.size||blob.size>5*1024*1024)throw Error('快速预览生成失败，请导出较小的 PDF 后重试。');
            yield {blob,width,height:tileHeight};
          }finally{canvas.width=canvas.height=1;}
        }
        page.cleanup();
      }
    }};
  }catch(error){await task.destroy();throw error;}
}
