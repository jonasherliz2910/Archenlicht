import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { postgresTransaction } from '../server/postgres-transaction.js';

function client() {
  return Object.assign(new EventEmitter(), {
    commands: [], closed: false,
    async connect() {},
    async query(sql) { this.commands.push(sql); },
    async end() { this.closed = true; }
  });
}
test('An acknowledged commit survives late socket-close errors without becoming retryable', async () => {
  const c = client();
  c.end = async () => { c.closed = true; c.emit('error', new Error('socket closed')); };
  assert.equal(await postgresTransaction(c, async () => 'committed'), 'committed');
  assert.deepEqual(c.commands, ['BEGIN', 'COMMIT']); assert.equal(c.closed, true);
  assert.doesNotThrow(() => c.emit('error', new Error('late socket close')));
});
test('A connection error during business work rolls back and propagates', async () => {
  const c = client(), failure = new Error('connection interrupted');
  await assert.rejects(() => postgresTransaction(c, async () => { c.emit('error', failure); return 'not committed'; }), error => error === failure);
  assert.deepEqual(c.commands, ['BEGIN', 'ROLLBACK']); assert.equal(c.closed, true);
});
test('A rejected COMMIT is propagated; cleanup failures cannot replace it', async () => {
  const c = client(), failure = new Error('commit rejected');
  c.query = async sql => { c.commands.push(sql); if (sql === 'COMMIT') throw failure; };
  c.end = async () => { throw new Error('cleanup failed'); };
  await assert.rejects(() => postgresTransaction(c, async () => true), error => error === failure);
  assert.deepEqual(c.commands, ['BEGIN', 'COMMIT', 'ROLLBACK']);
});
test('A failed connection is cleaned up without executing transaction queries', async () => {
  const c = client(), failure = new Error('connect failed');
  c.connect = async () => { throw failure; };
  await assert.rejects(() => postgresTransaction(c, async () => assert.fail()), error => error === failure);
  assert.deepEqual(c.commands, []); assert.equal(c.closed, true);
});
