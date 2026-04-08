import {it} from 'bun:test'

import { RusqliteConnection } from '../index'

it('sync function from native code', () => {
  const connection = RusqliteConnection.openInMemory();

  const stmt = connection.prepare("select 1 as test");

  const rows = stmt.query()

  for(const rowString of rows) {
    console.log(JSON.parse(rowString))
  }

})
