// Generated from shared/portfolio.mjs
const DEFAULT_PROJECT_CATEGORIES = [
  {id:'category-1',title:'品牌与视觉',description:'品牌识别、平面与视觉设计',coverText:'01\nWORKS'},
  {id:'category-2',title:'数字体验',description:'界面、网站与交互设计',coverText:'02\nWORKS'},
  {id:'category-3',title:'自由创作',description:'个人创作与设计实验',coverText:'03\nWORKS'}
];
const DEFAULT_FOLDER_COLORS=['#f2ce42','#bdcbd4','#c4492d'];
const DEFAULT_PROJECT_CARD_COLORS=['#7957c9','#eebc2b','#e88637','#408793','#b85b6e'];

const LIFE_ALBUM_IDS=['travel','food','hobbies','pets'];
const DEFAULT_LIFE_ALBUMS=['与旅行','与美食','与爱好','与萌宠'].map((title,i)=>({id:LIFE_ALBUM_IDS[i],title,cover:'',photos:[]}));

// Missing fields come from saved content so an older editor cannot erase grouping.
function normalizePortfolio(value,previous={}) {
  const categories=value.projectCategories??previous.projectCategories??DEFAULT_PROJECT_CATEGORIES;
  const projects=(value.projects||[]).map(project=>{
    const saved=(previous.projects||[]).find(p=>p.id===project.id);
    const colorIndex=['thumb-yellow','thumb-blue','thumb-red'].indexOf(project.className);
    const categoryId=project.categoryId??saved?.categoryId??DEFAULT_PROJECT_CATEGORIES[Math.max(0,colorIndex)].id;
    return {...project,categoryId,cover:project.cover??saved?.cover??project.pdf?.cover??'',art:typeof project.art==='string'?project.art.replace(/<br\s*\/?\s*>/gi,'\n'):project.art};
  });
  const categoryPositions=new Map();
  projects.forEach(project=>{const index=categoryPositions.get(project.categoryId)||0;categoryPositions.set(project.categoryId,index+1);project.cardColor=project.cardColor??previous.projects?.find(saved=>saved.id===project.id)?.cardColor??DEFAULT_PROJECT_CARD_COLORS[index%5];});
  const projectCategories=categories.map((category,i)=>{
    const saved=previous.projectCategories?.find(saved=>saved.id===category.id);
    // Apply the requested cover palette once, then retain later editor choices.
    const currentCover=(category.folderCoverVersion??saved?.folderCoverVersion)===1;
    return {...category,folderCoverVersion:1,folderColor:currentCover?(category.folderColor??saved?.folderColor??DEFAULT_FOLDER_COLORS[i]):DEFAULT_FOLDER_COLORS[i],coverText:category.coverText??saved?.coverText??DEFAULT_PROJECT_CATEGORIES[i]?.coverText??''};
  });
  const lifeAlbums=value.lifeAlbums===undefined?(previous.lifeAlbums??DEFAULT_LIFE_ALBUMS):value.lifeAlbums;
  return {...value,projectCategories:structuredClone(projectCategories),projects,lifeAlbums:structuredClone(lifeAlbums)};
}
