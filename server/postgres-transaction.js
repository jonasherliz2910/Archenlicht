// A Client can emit a late WebSocket error even after COMMIT and end() have
// completed. Handle connection errors throughout its lifetime without turning
// an acknowledged commit into a failed/retried business operation.
export async function postgresTransaction(connection, work) {
  let failure, connected = false, ending = false;
  connection.on('error', error => { if (!ending) failure ||= error; });
  try {
    await connection.connect(); connected = true;
    await connection.query('BEGIN');
    const result = await work();
    if (failure) throw failure;
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    if (connected) await connection.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    ending = true;
    // Query/connect failures already propagate above. A close failure must not
    // mask those errors or invalidate a transaction the database committed.
    await connection.end().catch(() => {});
  }
}
