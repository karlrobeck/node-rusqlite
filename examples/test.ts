import { Connection } from "../bindings/binding.js";

let conn = Connection.openInMemory();

conn.prepare("select ? as name",(statement) => {
  const result = statement.query(["john doe"])
  console.log(Array.from(result))
  console.log(result.toJSON())
})
