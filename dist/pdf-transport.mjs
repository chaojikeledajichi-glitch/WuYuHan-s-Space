// Request explicit ranges without starting and cancelling a full-file GET.
const CHUNK_SIZE=262144,MAX_BYTES=30*1024*1024;
export async function openPdfSource(pdfjs,url,{signal,onProgress=()=>{},onError=()=>{},fetchImpl=fetch,timeoutMs=20000,forceFull=false}={}){
  const source=new URL(url),controllers=new Set();let aborted=false,loaded=0;
  const abort=()=>{aborted=true;for(const controller of controllers)controller.abort();};
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  async function read(begin,end){
    if(aborted)throw new DOMException('Cancelled','AbortError');
    const requestUrl=new URL(source);requestUrl.searchParams.set('reader','4');
    if(forceFull)requestUrl.searchParams.delete('pdfRange');else requestUrl.searchParams.set('pdfRange',begin+'-'+(end-1));
    const controller=new AbortController();controllers.add(controller);
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
    try{
      const response=await fetchImpl(requestUrl.href,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response.ok){const error=Error(response.status===404?'PDF 文件不存在，请重新上传。':[401,403].includes(response.status)?'登录已失效，请刷新网站后重试。':'PDF 读取失败，请重试。');error.status=response.status;throw error;}
      if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf'))throw Error('未收到 PDF 文件，请刷新网站并确认已登录。');
      const declared=Number(response.headers.get('content-length'));
      if(declared>MAX_BYTES)throw Error('PDF 超过 30 MB，请重新上传。');
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(aborted)throw new DOMException('Cancelled','AbortError');
      if(bytes.length>MAX_BYTES)throw Error('PDF 超过 30 MB，请重新上传。');
      const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
      // Some intermediaries normalize 206 to 200 but preserve Content-Range.
      if(response.status===206||(response.status===200&&range)){
        if(forceFull)throw Error('PDF 下载不完整，请重试。');
        if(!range||Number(range[1])!==begin||Number(range[2])+1!==Math.min(end,Number(range[3]))||bytes.length!==Number(range[2])-begin+1||Number(range[3])>MAX_BYTES)throw Error('PDF 分段数据不完整，请重试。');
        return {bytes,total:Number(range[3]),partial:true};
      }
      if(response.status!==200||!bytes.length||(declared&&declared!==bytes.length))throw Error('PDF 下载不完整，请重试。');
      return {bytes,total:bytes.length,partial:false};
    }catch(error){if(timedOut)throw Error('PDF 读取超时，请重新加载。');throw error;}
    finally{clearTimeout(timer);controllers.delete(controller);}
  }
  try{
    const first=await read(0,CHUNK_SIZE);
    if(!new TextDecoder().decode(first.bytes.subarray(0,1024)).includes('%PDF-'))throw Error('PDF 内容无效，请重新上传。');
    loaded=first.bytes.length;onProgress(loaded,first.total);
    if(forceFull||!first.partial||first.bytes.length===first.total){signal?.removeEventListener('abort',abort);return {data:first.bytes};}
    class RangeSource extends pdfjs.PDFDataRangeTransport{
      constructor(){super(first.total,first.bytes,true);}
      requestDataRange(begin,end){
        read(begin,end).then(result=>{
          if(aborted)return;
          if(!result.partial||result.total!==first.total)throw Error('PDF 文件已变化，请重新加载。');
          loaded+=result.bytes.length;onProgress(Math.min(loaded,first.total),first.total);this.onDataRange(begin,result.bytes);
        }).catch(error=>{if(!aborted){abort();onError(error);}});
      }
      abort(){abort();signal?.removeEventListener('abort',abort);}
    }
    return {range:new RangeSource(),rangeChunkSize:CHUNK_SIZE,disableAutoFetch:true,disableStream:true};
  }catch(error){abort();signal?.removeEventListener('abort',abort);throw error;}
}
