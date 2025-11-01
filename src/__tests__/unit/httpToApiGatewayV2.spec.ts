import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { httpToApiGatewayV2 } from '../../library/httpToApiGatewayV2.ts';

describe('httpToApiGatewayV2', () => {
  function createMockRequest(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[]>;
    httpVersion?: string;
    remoteAddress?: string;
  }): IncomingMessage {
    const socket = new Socket();
    Object.defineProperty(socket, 'remoteAddress', {
      value: options.remoteAddress || '127.0.0.1',
      writable: true,
    });

    const req = new IncomingMessage(socket);
    req.method = options.method || 'GET';
    req.url = options.url || '/';
    req.httpVersion = options.httpVersion || '1.1';

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req.headers[key.toLowerCase()] = value;
      });
    }

    return req;
  }

  it('should convert a simple GET request', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/test',
      headers: {
        host: 'example.com',
        'user-agent': 'test-agent',
      },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.version).toBe('2.0');
    expect(event.routeKey).toBe('$default');
    expect(event.rawPath).toBe('/test');
    expect(event.rawQueryString).toBe('');
    expect(event.requestContext.http.method).toBe('GET');
    expect(event.requestContext.http.path).toBe('/test');
    expect(event.headers['host']).toBe('example.com');
    expect(event.headers['user-agent']).toBe('test-agent');
  });

  it('should handle query parameters correctly', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/api/users?name=john&age=30',
      headers: { host: 'example.com' },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.rawPath).toBe('/api/users');
    expect(event.rawQueryString).toBe('name=john&age=30');
    expect(event.queryStringParameters).toEqual({
      name: 'john',
      age: '30',
    });
  });

  it('should handle cookies correctly', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: {
        host: 'example.com',
        cookie: 'session=abc123; user=john; token=xyz',
      },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.cookies).toEqual(['session=abc123', 'user=john', 'token=xyz']);
  });

  it('should handle request body as text', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: '/api/data',
      headers: {
        host: 'example.com',
        'content-type': 'application/json',
      },
    });

    const body = Buffer.from('{"test":"data"}');
    const event = await httpToApiGatewayV2(req, body);

    expect(event.body).toBe('{"test":"data"}');
    expect(event.isBase64Encoded).toBe(false);
  });

  it('should base64 encode binary content', async () => {
    const req = createMockRequest({
      method: 'POST',
      url: '/upload',
      headers: {
        host: 'example.com',
        'content-type': 'image/png',
      },
    });

    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const event = await httpToApiGatewayV2(req, body);

    expect(event.isBase64Encoded).toBe(true);
    expect(event.body).toBe(body.toString('base64'));
  });

  it('should extract source IP from X-Forwarded-For header', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: {
        host: 'example.com',
        'x-forwarded-for': '192.168.1.100, 10.0.0.1',
      },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.requestContext.http.sourceIp).toBe('192.168.1.100');
  });

  it('should use socket remote address if X-Forwarded-For is not present', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: { host: 'example.com' },
      remoteAddress: '203.0.113.42',
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.requestContext.http.sourceIp).toBe('203.0.113.42');
  });

  it('should handle multiple headers with same key', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: {
        host: 'example.com',
        accept: ['text/html', 'application/json'],
      },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.headers['accept']).toBe('text/html,application/json');
  });

  it('should set correct domain prefix', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: { host: 'api.example.com' },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.requestContext.domainName).toBe('api.example.com');
    expect(event.requestContext.domainPrefix).toBe('api');
  });

  it('should generate unique request IDs', async () => {
    const req1 = createMockRequest({ url: '/' });
    const req2 = createMockRequest({ url: '/' });

    const event1 = await httpToApiGatewayV2(req1);
    const event2 = await httpToApiGatewayV2(req2);

    expect(event1.requestContext.requestId).toBeDefined();
    expect(event2.requestContext.requestId).toBeDefined();
    expect(event1.requestContext.requestId).not.toBe(
      event2.requestContext.requestId
    );
  });

  it('should handle empty body', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/',
      headers: { host: 'example.com' },
    });

    const event = await httpToApiGatewayV2(req);

    expect(event.body).toBeUndefined();
  });

  it('should set timeEpoch correctly', async () => {
    const before = Date.now();
    const req = createMockRequest({ url: '/' });
    const event = await httpToApiGatewayV2(req);
    const after = Date.now();

    expect(event.requestContext.timeEpoch).toBeGreaterThanOrEqual(before);
    expect(event.requestContext.timeEpoch).toBeLessThanOrEqual(after);
  });
});
