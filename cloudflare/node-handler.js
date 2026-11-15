// Reuse the existing HTTP routes, raw webhook bytes and session/CSRF rules.
// No listening socket or external proxy is needed for a Fetch API request.
export async function nodeHandlerResponse(handler, request, remoteAddress = '127.0.0.1') {
  const url = new URL(request.url), headers = new Headers(), chunks = [];
  const req = {
    url: url.pathname + url.search,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      if (!request.body) return;
      const reader = request.body.getReader(); let complete = false;
      try { while (true) { const part = await reader.read(); if (part.done) { complete = true; break; } yield Buffer.from(part.value); } }
      finally { if (!complete) await reader.cancel(); reader.releaseLock(); }
    }
  };
  let status = 200, ended = false;
  const res = {
    headersSent: false,
    setHeader(name, value) {
      headers.delete(name);
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item));
      return this;
    },
    writeHead(code, values = {}) { status = code; for (const [name, value] of Object.entries(values)) this.setHeader(name, value); this.headersSent = true; return this; },
    end(body) { if (!ended && body !== undefined) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body)); this.headersSent = true; ended = true; }
  };
  await handler(req, res);
  if (!ended) throw new Error('HTTP handler did not end the response.');
  const bodyless = request.method === 'HEAD' || [204, 205, 304].includes(status);
  return new Response(bodyless ? null : Buffer.concat(chunks), { status, headers });
}
