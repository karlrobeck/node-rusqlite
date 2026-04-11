import {afterAll, describe, it} from "bun:test"
import { Connection } from "../bindings/binding"

describe("open", () => {
  afterAll(async () => {
    await Bun.file(`/tmp/node-rusqlite-test/path.db`).delete()
  })

  it("should open properly",() => {
    const conn = Connection.open("/tmp/node-rusqlite-test/path.db");
  })
})

describe("openInMemory", () => {

})