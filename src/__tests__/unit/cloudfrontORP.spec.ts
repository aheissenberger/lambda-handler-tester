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

  describe('AllViewerExceptHost policy', () => {
    it('should remove host, origin, and referer headers', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result.headers.host).toBeUndefined();
      expect(result.headers.origin).toBeUndefined();
      expect(result.headers.referer).toBeUndefined();
    });

    it('should add via header with CloudFront format', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result.headers.via).toBeDefined();
      expect(result.headers.via).toMatch(
        /^2\.0 [a-f0-9]{16}\.cloudfront\.net \(CloudFront\)$/
      );
    });

    it('should add x-amz-cf-id header', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result.headers['x-amz-cf-id']).toBeDefined();
      expect(result.headers['x-amz-cf-id']).toMatch(/^[A-Za-z0-9_-]{86}==$/);
    });

    it('should preserve other headers', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result.headers['user-agent']).toBe('test-agent');
      expect(result.headers.accept).toBe('*/*');
    });

    it('should add API Gateway V2 host header when addApiGatewayV2Host is true', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
        addApiGatewayV2Host: true,
      });

      expect(result.headers.host).toBe(
        'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com'
      );
    });

    it('should not add host header when addApiGatewayV2Host is false', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
        addApiGatewayV2Host: false,
      });

      expect(result.headers.host).toBeUndefined();
    });

    it('should preserve all event properties except headers', () => {
      const result = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result.version).toBe(baseEvent.version);
      expect(result.routeKey).toBe(baseEvent.routeKey);
      expect(result.rawPath).toBe(baseEvent.rawPath);
      expect(result.rawQueryString).toBe(baseEvent.rawQueryString);
      expect(result.requestContext).toEqual(baseEvent.requestContext);
      expect(result.isBase64Encoded).toBe(baseEvent.isBase64Encoded);
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
        policy: 'AllViewerExceptHost',
      });
      const result2 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result1.headers.via).not.toBe(result2.headers.via);
    });

    it('should generate different x-amz-cf-id headers on each call', () => {
      const result1 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });
      const result2 = applyCloudFrontORP(baseEvent, {
        policy: 'AllViewerExceptHost',
      });

      expect(result1.headers['x-amz-cf-id']).not.toBe(
        result2.headers['x-amz-cf-id']
      );
    });
  });
});
