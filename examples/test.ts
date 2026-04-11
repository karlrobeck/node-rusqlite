import { executeBatch, RusqliteConnection } from "../bindings/index";

let conn = RusqliteConnection.openInMemory();

executeBatch(conn,'select sqlite_version()');

console.log('freed')