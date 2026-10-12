// Generated from shared/text-highlights.mjs
// Offsets refer to the unchanged plain text, using the browser's UTF-16 indices.
function getHighlightText(content,path){
  if(path==='about'||path==='blurb')return typeof content?.[path]==='string'?content[path]:undefined;
  const match=/^(experiences|notes)\.(0|[1-9]\d*)\.(description|text)$/.exec(path);
  if(!match||match[3]!==({experiences:'description',notes:'text'})[match[1]])return undefined;
  const value=content?.[match[1]]?.[Number(match[2])]?.[match[3]];
  return typeof value==='string'?value:undefined;
}
function mergeHighlightRanges(ranges){
  const merged=[];
  for(const range of ranges.map(({start,end})=>({start,end})).sort((a,b)=>a.start-b.start||a.end-b.end)){
    const previous=merged.at(-1);
    if(previous&&range.start<=previous.end)previous.end=Math.max(previous.end,range.end);
    else merged.push(range);
  }
  return merged;
}
function shiftHighlightRanges(ranges,before,after){
  if(before===after)return ranges.map(range=>({...range}));
  let start=0,oldEnd=before.length,newEnd=after.length;
  while(start<oldEnd&&start<newEnd&&before[start]===after[start])start++;
  while(oldEnd>start&&newEnd>start&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
  const delta=newEnd-oldEnd;
  return mergeHighlightRanges(ranges.map(range=>{
    if(range.end<=start)return {...range};
    if(range.start>=oldEnd)return {start:range.start+delta,end:range.end+delta};
    return {start:range.start<=start?range.start:start,end:range.end>=oldEnd?range.end+delta:newEnd};
  }).filter(range=>range.start<range.end));
}
function validHighlightBoundary(text,index){
  return !(index>0&&index<text.length&&/[\uD800-\uDBFF]/.test(text[index-1])&&/[\uDC00-\uDFFF]/.test(text[index]));
}
function renderHighlightedText(text,ranges=[]){
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const valid=Array.isArray(ranges)?ranges.filter(range=>range&&Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.start<range.end&&range.end<=text.length&&validHighlightBoundary(text,range.start)&&validHighlightBoundary(text,range.end)):[];
  let end=0,html='';
  for(const range of mergeHighlightRanges(valid)){html+=escape(text.slice(end,range.start))+'<mark class="text-highlight">'+escape(text.slice(range.start,range.end))+'</mark>';end=range.end;}
  return html+escape(text.slice(end));
}
function validateTextHighlights(value,content,previous={},raw=content){
  const inherited=value===undefined;
  const input=inherited?(previous.highlights||{}):value;
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>48)throw Error('高亮信息格式不正确。');
  const result={};
  for(const [path,ranges] of Object.entries(input)){
    const text=getHighlightText(content,path),original=getHighlightText(inherited?previous:raw,path);
    if(text===undefined||original===undefined){if(inherited)continue;throw Error('请选择有效的长文本设置高亮。');}
    if(!Array.isArray(ranges)||ranges.length>200||ranges.some(range=>!range||!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<0||range.start>=range.end||range.end>original.length||!validHighlightBoundary(original,range.start)||!validHighlightBoundary(original,range.end)))throw Error('高亮范围无效，请重新选择文字。');
    let updated;
    if(inherited)updated=shiftHighlightRanges(ranges,original,text);
    else{
      const leading=original.length-original.trimStart().length;
      updated=mergeHighlightRanges(ranges.map(range=>({start:Math.max(0,range.start-leading),end:Math.min(text.length,range.end-leading)})).filter(range=>range.start<range.end));
    }
    if(updated.length)result[path]=updated;
  }
  return result;
}
