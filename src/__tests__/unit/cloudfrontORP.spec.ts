import { applyCloudFrontORP } from '../../library/cloudfrontORP.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('CloudFront Origin Request Policy', () => {
  const baseEvent: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/test',
    rawQueryString: '',
    headers: {
      host: 'example.com',
      origin: 'https://example.com',
      referer: 'https://example.com/page',
      'user-agent': 'test-agent',
      accept: '*/*',
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: '$default',
      stage: '$default',
      time: 'Sun, 02 Nov 2025 11:00:00 GMT',
      timeEpoch: 1762080000000,
    },
    isBase64Encoded: false,
  };

  describe('AllViewerExceptHostHeader policy', () => {
    it('should remove host headers', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result.headers.host).toBeUndefined();
    });

    it('should add via header with CloudFront format', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result.headers.via).toBeDefined();
      expect(result.headers.via).toMatch(
        /^2\.0 [a-f0-9]{16}\.cloudfront\.net \(CloudFront\)$/
      );
    });

    it('should add x-amz-cf-id header', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result.headers['x-amz-cf-id']).toBeDefined();
      expect(result.headers['x-amz-cf-id']).toMatch(/^[A-Za-z0-9_-]{86}==$/);
    });

    it('should preserve other headers', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result.headers['user-agent']).toBe('test-agent');
      expect(result.headers.accept).toBe('*/*');
    });

    it('should add API Gateway V2 host header when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: true,
      });

      expect(result.headers.host).toBe(
        'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com'
      );
    });

    it('should not add host header when addApiGatewayV2Host is false', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: false,
      });

      expect(result.headers.host).toBeUndefined();
    });

    it('should update requestContext.domainName when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: true,
      });

      expect(result.requestContext.domainName).toBe(
        'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com'
      );
    });

    it('should update requestContext.domainPrefix when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: true,
      });

      expect(result.requestContext.domainPrefix).toBe('lj6qvkw6cf');
    });

    it('should preserve original requestContext.domainName when addApiGatewayV2Host is false', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: false,
      });

      expect(result.requestContext.domainName).toBe(
        baseEvent.requestContext.domainName
      );
      expect(result.requestContext.domainPrefix).toBe(
        baseEvent.requestContext.domainPrefix
      );
    });

    it('should set both host header and requestContext properties when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: true,
      });

      const expectedDomain = 'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com';
      const expectedPrefix = 'lj6qvkw6cf';

      expect(result.headers.host).toBe(expectedDomain);
      expect(result.requestContext.domainName).toBe(expectedDomain);
      expect(result.requestContext.domainPrefix).toBe(expectedPrefix);
    });

    it('should preserve all event properties except headers and requestContext when addApiGatewayV2Host is false', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result.version).toBe(baseEvent.version);
      expect(result.routeKey).toBe(baseEvent.routeKey);
      expect(result.rawPath).toBe(baseEvent.rawPath);
      expect(result.rawQueryString).toBe(baseEvent.rawQueryString);
      expect(result.requestContext).toEqual(baseEvent.requestContext);
      expect(result.isBase64Encoded).toBe(baseEvent.isBase64Encoded);
    });

    it('should preserve all requestContext fields except domainName and domainPrefix when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
        addApiGatewayV2Host: true,
      });

      expect(result.requestContext.accountId).toBe(
        baseEvent.requestContext.accountId
      );
      expect(result.requestContext.apiId).toBe(baseEvent.requestContext.apiId);
      expect(result.requestContext.http).toEqual(baseEvent.requestContext.http);
      expect(result.requestContext.requestId).toBe(
        baseEvent.requestContext.requestId
      );
      expect(result.requestContext.routeKey).toBe(
        baseEvent.requestContext.routeKey
      );
      expect(result.requestContext.stage).toBe(baseEvent.requestContext.stage);
      expect(result.requestContext.time).toBe(baseEvent.requestContext.time);
      expect(result.requestContext.timeEpoch).toBe(
        baseEvent.requestContext.timeEpoch
      );
    });
  });

  describe('Unsupported policy', () => {
    it('should throw error for unsupported policy', () => {
      expect(() => {
        applyCloudFrontORP(baseEvent, {
          policy: 'UnsupportedPolicy',
        });
      }).toThrow(
        'Unsupported CloudFront Origin Request Policy: UnsupportedPolicy'
      );
    });
  });

  describe('Multiple calls generate different values', () => {
    it('should generate different via headers on each call', () => {
      const result1 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });
      const result2 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result1.headers.via).not.toBe(result2.headers.via);
    });

    it('should generate different x-amz-cf-id headers on each call', () => {
      const result1 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });
      const result2 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHostHeader',
      });

      expect(result1.headers['x-amz-cf-id']).not.toBe(
        result2.headers['x-amz-cf-id']
      );
    });
  });
});
