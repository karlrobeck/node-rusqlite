import {afterAll, describe, it} from "bun:test"
import { Connection, OpenFlags } from "../bindings/binding"

describe("open", () => {
  afterAll(async () => {
    const file = Bun.file(`/tmp/node-rusqlite-test/path.db`);
    if(await file.exists()) {
      await Bun.file(`/tmp/node-rusqlite-test/path.db`).delete()
    }
  })

  it("should open properly",() => {
    const conn = Connection.open("/tmp/node-rusqlite-test/path.db", {
      flags: OpenFlags.SqliteOpenCreate | OpenFlags.SqliteOpenReadwrite
    });

    const result = conn.queryOne('select sqlite_version',[])
  })
})

describe("openInMemory", () => {

})