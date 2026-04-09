import { RusqliteConnection, RusqliteError } from "../bindings/index";

const db = RusqliteConnection.openInMemory();

const trx = db.transaction()

const result = db.queryOne("select sqlite_version()",new Uint8Array())

const payload = JSON.parse(result.toString())

console.log(payload)