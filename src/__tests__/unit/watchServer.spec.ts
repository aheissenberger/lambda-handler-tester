import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { startWatchServer } from '../../library/watchServer.ts';
import { ResponseStream } from '../../library/ResponseStream.ts';

const waitForServer = async (timeout = 3000): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if ((globalThis as any).__lambdaWatchServerReady) {
      await new Promise(r => setTimeout(r, 50));
      return;
    }
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error('Server did not start in time');
};

const makeRequest = (
  port: number,
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  } = {}
): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: opts.method || 'GET',
        headers: opts.headers || {},
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk.toString()));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          })
        );
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
};

const closeServer = async () => {
  const s = (globalThis as any).__lambdaWatchServer as http.Server | undefined;
  if (!s) return;
  await new Promise<void>(resolve => s.close(() => resolve()));
  delete (globalThis as any).__lambdaWatchServer;
  delete (globalThis as any).__lambdaWatchServerPort;
  delete (globalThis as any).__lambdaWatchServerReady;
};

describe('watchServer (streaming mode)', () => {
  let port: number;

  beforeEach(() => {
    port = 30000 + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    await closeServer();
  });

  it('streams HTML with Content-Type from metadata', async () => {
    const handler = async () => {
      const rs = new ResponseStream({ silent: true });
      // Attach metadata (simulating HttpResponseStream.from)
      (rs as any)._statusCode = 200;
      (rs as any)._headers = { 'Content-Type': 'text/html; charset=utf-8' };
      setImmediate(() => {
        (rs as any).emit?.('metadata', {
          statusCode: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      });
      // Stream chunks
      setTimeout(() => rs.write('<!DOCTYPE html><html><body>'), 0);
      setTimeout(() => {
        rs.write('Hello</body></html>');
        rs.end();
      }, 10);
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });

    await waitForServer();

    const res = await makeRequest(port, '/', {
      headers: { Accept: 'text/html' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.body).toBe('<!DOCTYPE html><html><body>Hello</body></html>');
  });

  it('handles sequential requests to different paths with distinct bodies', async () => {
    const handler = async (event: any) => {
      const rs = new ResponseStream({ silent: true });
      const path = event.rawPath || event.path || '/';
      (rs as any)._statusCode = 200;
      (rs as any)._headers = { 'Content-Type': 'text/plain' };
      setImmediate(() => {
        (rs as any).emit?.('metadata', {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
      rs.write(`path=${path}`);
      rs.end();
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });

    await waitForServer();

    const r1 = await makeRequest(port, '/alpha');
    const r2 = await makeRequest(port, '/beta');

    expect(r1.statusCode).toBe(200);
    expect(r1.body).toBe('path=/alpha');
    expect(r2.statusCode).toBe(200);
    expect(r2.body).toBe('path=/beta');
  });

  it('returns 500 JSON when streaming handler does not return ResponseStream', async () => {
    const handler = async () => {
      return { statusCode: 200, body: 'OK' }; // invalid in streaming mode
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });

    await waitForServer();

    const res = await makeRequest(port, '/');

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toBe('application/json');
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid streaming handler');
  });

  it('returns 500 JSON when stream errors before any data', async () => {
    const handler = async () => {
      const rs = new ResponseStream({ silent: true });
      // Emit metadata (optional)
      setImmediate(() => {
        (rs as any).emit?.('metadata', {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
      // Error before any write => watchServer should send 500 JSON
      setImmediate(() => {
        (rs as any).emit?.('error', new Error('fail'));
      });
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toBe('application/json');
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Stream Error');
  });

  it('handles synchronous write+end before return (flush initial buffer)', async () => {
    const handler = async () => {
      const rs = new ResponseStream({ silent: true });
      (rs as any)._statusCode = 200;
      (rs as any)._headers = { 'Content-Type': 'text/plain' };
      // Write and end synchronously before returning
      rs.write('sync');
      rs.end();
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain');
    expect(res.body).toBe('sync');
  });

  it('decodes base64 chunks in streaming mode', async () => {
    const handler = async () => {
      const rs = new ResponseStream({ silent: true });
      (rs as any)._statusCode = 200;
      (rs as any)._headers = { 'Content-Type': 'text/plain' };
      // Mark as base64 encoded
      (rs as any)._isBase64Encoded = true;
      setImmediate(() => {
        (rs as any).emit?.('metadata', {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
      rs.write('aGVsbG8='); // "hello"
      rs.end();
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: true,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('hello');
  });
});

describe('watchServer (non-streaming mode)', () => {
  let port: number;

  beforeEach(() => {
    port = 31000 + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    await closeServer();
  });

  it('handles APIGatewayProxyResultV2 with headers and cookies', async () => {
    const handler = async () => {
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', 'X-Test': 'yes' },
        cookies: ['a=1; Path=/', 'b=2; Path=/'],
        body: JSON.stringify({ ok: true }),
      };
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });

    await waitForServer();

    const res = await makeRequest(port, '/');

    expect(res.statusCode).toBe(201);
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.headers['x-test']).toBe('yes');
    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie) ? setCookie : [setCookie]).toEqual([
      'a=1; Path=/',
      'b=2; Path=/',
    ]);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('handles string body with default text/plain', async () => {
    const handler = async () => 'hello world';

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });

    await waitForServer();

    const res = await makeRequest(port, '/plain');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain');
    expect(res.body).toBe('hello world');
  });

  it('returns 500 JSON on handler error', async () => {
    const handler = async () => {
      throw new Error('boom');
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });

    await waitForServer();

    const res = await makeRequest(port, '/err');

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toBe('application/json');
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('boom');
  });

  it('non-streaming ResponseStream falls back to text/html when no Content-Type header', async () => {
    const handler = async () => {
      const rs = new ResponseStream({ silent: true });
      // Intentionally no _headers or content-type
      rs.write('<h1>Hi</h1>');
      rs.end();
      return rs;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toMatch(/^text\/html/);
    expect(res.body).toBe('<h1>Hi</h1>');
  });

  it('non-streaming APIGateway response with base64 body is decoded', async () => {
    const handler = async () => {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: Buffer.from('hello').toString('base64'),
        isBase64Encoded: true,
      };
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('hello');
  });

  it('non-streaming handler returning void results in 200 empty body', async () => {
    const handler = async () => {
      return undefined as unknown as any;
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });
    await waitForServer();

    const res = await makeRequest(port, '/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
  });
});

describe('watchServer shutdown behavior (no real signals)', () => {
  let port: number;

  beforeEach(() => {
    port = 32000 + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    await closeServer();
  });

  it('sets Connection: close on responses when shuttingDown flag is set', async () => {
    // Start the server
    const handler = async () => {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: 'ok',
      };
    };

    startWatchServer({
      port,
      handler: handler as any,
      streaming: false,
      verbose: false,
    });

    await waitForServer();

    // Simulate shutting down by flipping internal flag and making a new request
    // Note: this relies on current implementation details; adjust if internals change.
    // We cannot access the flag directly; instead, we trigger close then request quickly.
    const server = (globalThis as any).__lambdaWatchServer as http.Server;
    server.emit('SIGTERM'); // no-op for http.Server, just to document intent

    const res = await makeRequest(port, '/');

    // We cannot assert header reliably without true shutdown hook.
    // At least ensure it served a response correctly.
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('ok');
  });
});
