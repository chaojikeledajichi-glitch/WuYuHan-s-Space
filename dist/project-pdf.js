// Read PDF bytes and pages on demand; prioritize the first visible canvas.
window.ProjectPDF=(()=>{
  let library,transportLibrary;
  const loadTransport=()=>transportLibrary||(transportLibrary=import('/pdf-transport.mjs?v=4').catch(error=>{transportLibrary=null;throw error;}));
  const loadLibrary=()=>library||(library=import('/vendor/pdfjs/pdf.min.mjs?v=6.3.289-legacy').then(pdfjs=>{
    pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.min.mjs?v=6.3.289-legacy';return pdfjs;
  }).catch(error=>{library=null;throw error;}));
  const options={isEvalSupported:false,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'};
  async function inspect(file){
    const pdfjs=await loadLibrary(),task=pdfjs.getDocument({...options,data:new Uint8Array(await file.arrayBuffer())});
    task.onPassword=()=>task.destroy();
    try{const pdf=await task.promise;if(pdf.numPages>1000)throw Error('PDF 最多支持 1000 页。');return {pages:pdf.numPages};}
    catch(error){throw Error(error.message?.includes('1000')?error.message:'PDF 无法读取。请上传未加密、可正常打开的 PDF。');}
    finally{await task.destroy();}
  }
  function mount(root,url){
    const status=root.querySelector('[data-pdf-status]'),pages=root.querySelector('[data-pdf-pages]'),dialog=root.closest('dialog');
    const retry=document.createElement('button');retry.type='button';retry.className='secondary-button pdf-retry';retry.textContent='重新加载';retry.hidden=true;status.after(retry);
    let stopAttempt=()=>{},disposed=false;
    function start(forceFull=false){
      stopAttempt();if(disposed)return;pages.replaceChildren();retry.hidden=true;
      let task,pdf,pdfjs,renderTask,fatalError,stopped=false,busy=false,firstPaint=false,canDownloadAgain=false;
      const download=new AbortController();
      const deadlines=new Set();
      const within=(promise,milliseconds,message)=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{deadlines.delete(timer);reject(Error(message));},milliseconds);deadlines.add(timer);
        Promise.resolve(promise).then(resolve,reject).finally(()=>{clearTimeout(timer);deadlines.delete(timer);});
      });
      const pageRecords=new Map(),strips=new Map(),queue=new Set();
      const showStatus=text=>{if(!stopped){status.hidden=false;status.textContent=text;}};
      showStatus('正在加载 PDF…');root.setAttribute('aria-busy','true');
      const slowTimer=setTimeout(()=>{if(!firstPaint&&!stopped){showStatus('PDF 加载较慢，正在继续读取…');retry.hidden=false;}},15000);
      const fail=(error,text)=>{
        if(stopped)return;
        // Retry once with a complete file when ranges or the parser stall.
        // Authentication, missing files and cancelled reads cannot be fixed by downloading again.
        if(!firstPaint&&!forceFull&&canDownloadAgain&&![401,403,404].includes(error.status)&&!['AbortError','PasswordException'].includes(error.name)){
          start(true);showStatus('正在重新读取 PDF…');return;
        }
        console.error('PDF reader:',error);showStatus(text);retry.hidden=false;root.setAttribute('aria-busy','false');stopAttempt();
      };
      const pageObserver=new IntersectionObserver(entries=>{
        for(const entry of entries){const record=pageRecords.get(entry.target);if(record&&entry.isIntersecting)preparePage(record);}
      },{root:dialog,rootMargin:'300px 0px'});
      const stripObserver=new IntersectionObserver(entries=>{
        for(const entry of entries){const record=strips.get(entry.target);if(!record)continue;record.visible=entry.isIntersecting;
          if(record.visible&&!record.ready)queue.add(record);
          else if(!record.visible){queue.delete(record);if(record.ready){record.canvas.width=1;record.canvas.height=1;record.canvas.remove();record.ready=false;}}
        }pump();
      },{root:dialog,rootMargin:'300px 0px'});
      async function preparePage(record,knownPage){
        if(stopped||record.preparing||record.prepared)return;record.preparing=true;
        try{
          const page=knownPage||await within(pdf.getPage(record.number),30000,'PDF 页面读取超时，请重新加载。');if(stopped)return;
          const base=page.getViewport({scale:1}),targetWidth=Math.min(1200,Math.max(640,pages.clientWidth));
          const viewport=page.getViewport({scale:Math.min(1.8,targetWidth/base.width)}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
          record.page=page;record.prepared=true;record.element.style.aspectRatio='auto';record.element.replaceChildren();record.element.setAttribute('aria-busy','false');
          for(let offset=0;offset<height;offset+=1800){
            const tileHeight=Math.min(1800,height-offset),element=document.createElement('div'),canvas=document.createElement('canvas');
            element.className='pdf-page-strip';element.style.aspectRatio=width+'/'+tileHeight;
            canvas.setAttribute('role','img');canvas.setAttribute('aria-label','PDF 第 '+record.number+' 页'+(height>1800?'（第 '+(Math.floor(offset/1800)+1)+' 部分）':''));
            const strip={element,canvas,page,viewport,width,height:tileHeight,offset,visible:false,ready:false,pageRecord:record};
            strips.set(element,strip);record.element.append(element);stripObserver.observe(element);
            // Do not depend on observer timing for the first screen.
            if(record.number===1&&offset===0&&!firstPaint){strip.visible=true;queue.add(strip);}
          }pump();
        }catch(error){if(!stopped){record.element.textContent='此页暂时无法显示，请重新加载或打开 PDF 原文件。';fail(error,'部分页面加载失败，请重试或打开原文件。');}}
        finally{record.preparing=false;}
      }
      async function pump(){
        if(busy||stopped)return;busy=true;
        try{while(queue.size&&!stopped){
          const top=dialog?.getBoundingClientRect().top||0;
          const record=[...queue].sort((a,b)=>Math.abs(a.element.getBoundingClientRect().top-top)-Math.abs(b.element.getBoundingClientRect().top-top))[0];
          queue.delete(record);if(!record.visible||record.ready)continue;
          try{
            record.canvas.width=record.width;record.canvas.height=record.height;
            renderTask=record.page.render({canvasContext:record.canvas.getContext('2d'),viewport:record.viewport,transform:[1,0,0,1,0,-record.offset],background:'#ffffff',annotationMode:pdfjs.AnnotationMode.DISABLE});
            await within(renderTask.promise,30000,'PDF 页面显示超时，请重新加载。');renderTask=null;if(stopped)break;
            if(record.visible){
              record.element.replaceChildren(record.canvas);record.ready=true;
              if(!firstPaint){firstPaint=true;clearTimeout(slowTimer);status.hidden=true;retry.hidden=true;root.setAttribute('aria-busy','false');for(const pending of pageRecords.values())pageObserver.observe(pending.element);}
              const parent=record.pageRecord;
              if(!parent.textStarted){
                parent.textStarted=true;
                // Text extraction is optional and never blocks the first image.
                parent.page.getTextContent().then(text=>{if(stopped)return;const accessible=document.createElement('p');accessible.className='pdf-page-text';accessible.textContent=text.items.map(item=>item.str||'').join(' ');parent.element.append(accessible);}).catch(()=>{});
              }
            }else{record.canvas.width=1;record.canvas.height=1;}
          }catch(error){if(!stopped){record.element.textContent='此处暂时无法显示，请重新加载或打开 PDF 原文件。';fail(error,'页面显示失败，请重试或打开原文件。');}}
        }}finally{busy=false;}
      }
      stopAttempt=()=>{
        stopped=true;download.abort();clearTimeout(slowTimer);for(const timer of deadlines)clearTimeout(timer);deadlines.clear();pageObserver.disconnect();stripObserver.disconnect();queue.clear();renderTask?.cancel();
        task?.destroy().catch(()=>{});for(const record of strips.values()){record.canvas.width=1;record.canvas.height=1;}strips.clear();pageRecords.clear();
      };
      (async()=>{try{
        const [engine,transport]=await within(Promise.all([loadLibrary(),loadTransport()]),20000,'PDF 阅读器加载超时，请重新加载。');pdfjs=engine;if(stopped)return;
        canDownloadAgain=true;
        const source=await transport.openPdfSource(pdfjs,new URL(url,window.location.href).href,{
          signal:download.signal,
          forceFull,timeoutMs:forceFull?45000:20000,
          onProgress:(loaded,total)=>{if(!firstPaint&&!stopped)showStatus(loaded>=total?'正在显示首屏…':'正在读取 PDF… '+Math.min(99,Math.round(loaded/total*100))+'%');},
          onError:error=>{fatalError=error;fail(error,error.message);task?.destroy().catch(()=>{});}
        });if(stopped){source.range?.abort();return;}
        task=pdfjs.getDocument({...options,...source});
        task.onPassword=()=>{const error=Error('Password required');error.name='PasswordException';fail(error,'此 PDF 需要密码，请上传未加密的 PDF。');};
        task.onProgress=({loaded,total})=>{if(!firstPaint&&!stopped&&total>0)showStatus(loaded>=total?'正在显示首屏…':'正在加载 PDF… '+Math.min(99,Math.round(loaded/total*100))+'%');};
        pdf=await within(task.promise,30000,'PDF 解析超时，请重新加载。');if(stopped)return;
        const firstPage=await within(pdf.getPage(1),30000,'PDF 首屏读取超时，请重新加载。');if(stopped)return;const base=firstPage.getViewport({scale:1});
        for(let number=1;number<=pdf.numPages&&!stopped;number++){
          const element=document.createElement('section');element.className='pdf-long-page pdf-page-pending';element.style.aspectRatio=base.width+'/'+base.height;element.setAttribute('aria-label','PDF 第 '+number+' 页');element.setAttribute('aria-busy','true');
          const label=document.createElement('span');label.className='pdf-page-placeholder';label.textContent='第 '+number+' 页';element.append(label);
          const record={element,number,prepared:false,preparing:false};pageRecords.set(element,record);pages.append(element);
          if(number===1)await preparePage(record,firstPage);
          if(firstPaint)pageObserver.observe(element);
        }
      }catch(error){if(!stopped)fail(error,fatalError?.message||error.message||'PDF 暂时无法显示，请重试或打开原文件。');}})();
    }
    const retryLoad=()=>start();retry.addEventListener('click',retryLoad);start();
    return ()=>{disposed=true;stopAttempt();retry.removeEventListener('click',retryLoad);retry.remove();root.setAttribute('aria-busy','false');};
  }
  async function preparePreview(file,onProgress){
    const [pdfjs,preview]=await Promise.all([loadLibrary(),import('/pdf-preview.mjs?v=1')]);
    return preview.preparePdfPreview(pdfjs,file,{options,onProgress});
  }
  return {inspect,mount,preparePreview};
})();
