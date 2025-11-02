import { urlToApiGatewayV2Event } from '../../library/urlToApiGatewayV2.ts';

describe('urlToApiGatewayV2Event', () => {
  it('should convert a simple HTTPS URL', () => {
    const url = 'https://example.com/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.version).toBe('2.0');
    expect(event.routeKey).toBe('$default');
    expect(event.rawPath).toBe('/test');
    expect(event.rawQueryString).toBe('');
    expect(event.headers.host).toBe('example.com');
    expect(event.headers['x-forwarded-proto']).toBe('https');
    expect(event.headers['x-forwarded-port']).toBe('443');
    expect(event.requestContext.http.method).toBe('GET');
    expect(event.requestContext.domainName).toBe('example.com');
    expect(event.isBase64Encoded).toBe(false);
  });

  it('should convert an HTTP URL with custom port', () => {
    const url = 'http://localhost:8080/api/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/api/test');
    expect(event.headers.host).toBe('localhost:8080');
    expect(event.headers['x-forwarded-proto']).toBe('http');
    expect(event.headers['x-forwarded-port']).toBe('8080');
    expect(event.requestContext.domainName).toBe('localhost:8080');
    expect(event.requestContext.domainPrefix).toBe('localhost');
  });

  it('should parse query parameters correctly', () => {
    const url = 'https://api.example.com/users?name=john&age=30&active=true';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/users');
    expect(event.rawQueryString).toBe('name=john&age=30&active=true');
    expect(event.queryStringParameters).toEqual({
      name: 'john',
      age: '30',
      active: 'true',
    });
  });

  it('should handle URL without query parameters', () => {
    const url = 'https://example.com/api/data';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/api/data');
    expect(event.rawQueryString).toBe('');
    expect(event.queryStringParameters).toBeUndefined();
  });

  it('should handle root path', () => {
    const url = 'https://example.com/';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/');
    expect(event.rawQueryString).toBe('');
  });

  it('should handle URL without trailing slash', () => {
    const url = 'https://example.com';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/');
  });

  it('should set correct domain prefix for subdomains', () => {
    const url = 'https://api.github.com/users';
    const event = urlToApiGatewayV2Event(url);

    expect(event.requestContext.domainName).toBe('api.github.com');
    expect(event.requestContext.domainPrefix).toBe('api');
  });

  it('should include standard headers', () => {
    const url = 'https://example.com/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.headers['user-agent']).toBe('lambda-handler-tester/1.0');
    expect(event.headers.accept).toContain('text/html');
    expect(event.headers['accept-encoding']).toContain('gzip');
    expect(event.headers.connection).toBe('keep-alive');
  });

  it('should set correct request context', () => {
    const url = 'https://example.com/api/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.requestContext.accountId).toBe('123456789012');
    expect(event.requestContext.apiId).toBe('fetch-api-id');
    expect(event.requestContext.http.protocol).toBe('HTTP/1.1');
    expect(event.requestContext.http.sourceIp).toBe('127.0.0.1');
    expect(event.requestContext.stage).toBe('$default');
    expect(event.requestContext.requestId).toBeDefined();
    expect(event.requestContext.time).toBeDefined();
    expect(event.requestContext.timeEpoch).toBeGreaterThan(0);
  });

  it('should generate unique request IDs', () => {
    const url = 'https://example.com/test';
    const event1 = urlToApiGatewayV2Event(url);
    const event2 = urlToApiGatewayV2Event(url);

    expect(event1.requestContext.requestId).toBeDefined();
    expect(event2.requestContext.requestId).toBeDefined();
    expect(event1.requestContext.requestId).not.toBe(
      event2.requestContext.requestId
    );
  });

  it('should handle complex paths', () => {
    const url = 'https://example.com/api/v2/users/123/posts/456';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/api/v2/users/123/posts/456');
  });

  it('should handle URLs with encoded characters', () => {
    const url = 'https://example.com/search?q=hello%20world&lang=en';
    const event = urlToApiGatewayV2Event(url);

    expect(event.rawPath).toBe('/search');
    expect(event.rawQueryString).toBe('q=hello%20world&lang=en');
    expect(event.queryStringParameters?.q).toBe('hello world');
    expect(event.queryStringParameters?.lang).toBe('en');
  });

  it('should throw error for invalid URL', () => {
    expect(() => {
      urlToApiGatewayV2Event('not-a-valid-url');
    }).toThrow('Invalid URL: not-a-valid-url');
  });

  it('should throw error for empty string', () => {
    expect(() => {
      urlToApiGatewayV2Event('');
    }).toThrow('Invalid URL:');
  });

  it('should handle HTTPS default port', () => {
    const url = 'https://example.com:443/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.headers['x-forwarded-port']).toBe('443');
  });

  it('should handle HTTP default port', () => {
    const url = 'http://example.com:80/test';
    const event = urlToApiGatewayV2Event(url);

    expect(event.headers['x-forwarded-port']).toBe('80');
  });

  it('should handle query parameters with special characters', () => {
    const url = 'https://example.com/api?filter[name]=john&sort=-created';
    const event = urlToApiGatewayV2Event(url);

    expect(event.queryStringParameters?.['filter[name]']).toBe('john');
    expect(event.queryStringParameters?.sort).toBe('-created');
  });

  describe('CloudFront Origin Request Policy integration', () => {
    it('should apply CloudFront ORP when cfOrp option is provided', () => {
      const url = 'https://example.com/test';
      const event = urlToApiGatewayV2Event(url, {
        cfOrp: {
          policy: 'AllViewerExceptHostHeader',
        },
      });

      // Host header should be removed by CloudFront ORP
      expect(event.headers.host).toBeUndefined();
      // CloudFront headers should be present
      expect(event.headers.via).toBeDefined();
      expect(event.headers['x-amz-cf-id']).toBeDefined();
      expect(event.headers['cloudfront-viewer-country']).toBe('DE');
    });

    it('should add API Gateway V2 host header when addApiGatewayV2Host is true', () => {
      const url = 'https://example.com/test';
      const event = urlToApiGatewayV2Event(url, {
        cfOrp: {
          policy: 'AllViewerExceptHostHeader',
          addApiGatewayV2Host: true,
        },
      });

      expect(event.headers.host).toBe(
        'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com'
      );
    });

    it('should update requestContext when addApiGatewayV2Host is true', () => {
      const url = 'https://example.com/test';
      const event = urlToApiGatewayV2Event(url, {
        cfOrp: {
          policy: 'AllViewerExceptHostHeader',
          addApiGatewayV2Host: true,
        },
      });

      expect(event.requestContext.domainName).toBe(
        'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com'
      );
      expect(event.requestContext.domainPrefix).toBe('lj6qvkw6cf');
    });

    it('should preserve original domain in requestContext when addApiGatewayV2Host is false', () => {
      const url = 'https://api.example.com/test';
      const event = urlToApiGatewayV2Event(url, {
        cfOrp: {
          policy: 'AllViewerExceptHostHeader',
          addApiGatewayV2Host: false,
        },
      });

      expect(event.requestContext.domainName).toBe('api.example.com');
      expect(event.requestContext.domainPrefix).toBe('api');
    });

    it('should preserve original domain when cfOrp is not provided', () => {
      const url = 'https://subdomain.example.com/test';
      const event = urlToApiGatewayV2Event(url);

      expect(event.headers.host).toBe('subdomain.example.com');
      expect(event.requestContext.domainName).toBe('subdomain.example.com');
      expect(event.requestContext.domainPrefix).toBe('subdomain');
    });
  });
});
