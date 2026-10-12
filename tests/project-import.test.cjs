const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
test('prepared preview attaches once to the exact first PDF and preserves other saved content',()=>{
  const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(path.join(__dirname,'../drizzle/0000_fantastic_jigsaw.sql'),'utf8'));
  const content={name:'Owner',projects:[{id:'project-0',categoryId:'category-1',title:'业务侧支持',pdf:{url:'/media/projects/deac2eed-dbfe-493a-ad8d-1cba962eb17d.pdf',name:'1美团AI访谈.pdf',pages:11}},{id:'project-1',title:'Other',detailImages:[]}],experiences:[{title:'Keep this'}]};
  db.prepare('INSERT INTO portfolio VALUES (?,?,?,?,?)').run('main',JSON.stringify(content),14,'owner-id','before');
  const sql=fs.readFileSync(path.join(__dirname,'../drizzle/0001_meituan_prepared_preview.sql'),'utf8');
  try{
    db.exec(sql);let row=db.prepare('SELECT * FROM portfolio').get(),saved=JSON.parse(row.data);
    assert.equal(row.revision,15);assert.equal(saved.projects[0].detailImages.length,16);
    const images=saved.projects[0].detailImages;delete saved.projects[0].detailImages;assert.deepEqual(saved,content);
    db.exec(sql);row=db.prepare('SELECT * FROM portfolio').get();assert.equal(row.revision,15);
    assert.deepEqual(JSON.parse(row.data).projects[0].detailImages,images);
    // A user replacement made before publish must not receive this document's preview.
    content.projects[0].pdf.url='/media/projects/00000000-0000-0000-0000-000000000001.pdf';db.prepare('UPDATE portfolio SET data=?').run(JSON.stringify(content));db.exec(sql);
    assert.equal(JSON.parse(db.prepare('SELECT data FROM portfolio').get().data).projects[0].detailImages,undefined);
  }finally{db.close();}
});
