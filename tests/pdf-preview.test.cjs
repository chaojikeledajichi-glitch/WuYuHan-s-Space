const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('long PDF becomes ordered, complete WebP strips for persistent previews',async()=>{
  const pdfjs=await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs'),{preparePdfPreview}=await import('../dist/pdf-preview.mjs'),{createCanvas,loadImage}=require('@napi-rs/canvas');
  const file=new Blob([fs.readFileSync(path.join(__dirname,'fixtures/long-preview.pdf'))]);
  const preview=await preparePdfPreview(pdfjs,file,{options:{isEvalSupported:false,standardFontDataUrl:path.resolve(__dirname,'../node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/'},createCanvas:()=>createCanvas(1,1),encodeCanvas:canvas=>new Blob([canvas.toBuffer('image/webp')],{type:'image/webp'})});
  try{
    assert.equal(preview.pages,2);assert.equal(preview.count,10);let count=0,totalHeight=0;
    for await(const tile of preview.segments()){
      assert.equal(tile.width,1600);assert.ok(tile.height>0&&tile.height<=2400);assert.ok(tile.blob.size>0&&tile.blob.size<5*1024*1024);
      const image=await loadImage(Buffer.from(await tile.blob.arrayBuffer()));assert.equal(image.width,tile.width);assert.equal(image.height,tile.height);
      const canvas=createCanvas(1,1),context=canvas.getContext('2d');context.drawImage(image,-100,-100);const pixel=context.getImageData(0,0,1,1).data;
      // First page is yellow; second is blue. This detects reversed/missing strips.
      assert.ok(count<5?pixel[0]>200&&pixel[2]<100:pixel[0]<150&&pixel[2]>180);
      totalHeight+=tile.height;count++;
    }
    assert.equal(count,10);assert.equal(totalHeight,21000);
  }finally{await preview.dispose();}
});
