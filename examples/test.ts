import { Connection } from "../bindings/binding.js";

let conn = Connection.openInMemory();

conn.prepare("select ? as name",(statement) => {
  const result = statement.query(["john doe"])
  console.log("array result -> ", Array.from(result))
  console.log("json.stringify result ->", JSON.stringify(result))
  console.log("toJSON result -> ", result.toJSON())
})
