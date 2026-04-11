import { Connection } from "../bindings/binding.js";

let conn = Connection.openInMemory();

conn.executeBatch(`
    create table users (
      name text not null
    );
  `)

conn.prepare("insert into users (name) values (?) returning *",(statement) => {
  const names = ["john","jane","alex"]
  for(const name of names) {
    statement.query([name])
  }  
})

conn.prepare("select name from users",(statement) => {
  const rows = statement.query([])
  console.log(rows.get(2))
  console.log(Array.from(rows.iterate()))
})

conn.transaction((trx) => {
  const savepoint = trx.savepoint((sp1) => {
    sp1.savepoint(sp2 => {
      
    })
  })
})