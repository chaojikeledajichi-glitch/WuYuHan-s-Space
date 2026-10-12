const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
function openDatabase(filename){
 const db=new DatabaseSync(filename);db.exec('CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)');
 const folder=path.resolve(__dirname,'../drizzle');
 for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM _local_migrations WHERE name = ?').get(name)){db.exec(fs.readFileSync(path.join(folder,name),'utf8'));db.prepare('INSERT INTO _local_migrations(name) VALUES (?)').run(name);}
 return {
   raw:db,
   prepare(sql){return {
     bind(...args){return {
       async first(){return db.prepare(sql).get(...args)||null;},
       async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}
     };}
   };}
 };
}
module.exports={openDatabase};
