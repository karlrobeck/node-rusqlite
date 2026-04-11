import { Connection } from "../bindings/binding.js";

let conn = Connection.openInMemory();

conn.executeBatch(`
    create table users (
      name text not null
    );
  `)

conn.prepare("insert into users (name) values (?)",(statement) => {
  const names = ["john","jane","alex"]
  for(const name of names) {
    statement.insert([name])
  }  
})

conn.prepare("select name from users",(statement) => {
  const rows = statement.query([])
  console.log(rows.get(2))
  console.log(Array.from(rows.iterate()))
})