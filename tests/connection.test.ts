import {afterAll, beforeAll, describe, it} from "bun:test"
import { Connection, OpenFlags } from "../bindings/binding"
import {mkdirSync,rmdirSync} from "node:fs";

describe("open", () => {

  beforeAll(() => {
    mkdirSync("/tmp/node-rusqlite-test/connection",{recursive: true})
  })

  afterAll(async () => {
    rmdirSync("/tmp/node-rusqlite-test/connection")
  })

  it("should open properly",() => {
    const conn = Connection.open("/tmp/node-rusqlite-test/path.db", {
      flags: OpenFlags.SqliteOpenCreate | OpenFlags.SqliteOpenReadwrite
    });

    const result = conn.queryOne('select sqlite_version()',[])

    console.log(result)
  })
})

describe("openInMemory", () => {

})