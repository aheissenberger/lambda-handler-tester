/**
 * Example Lambda handler that demonstrates CloudFront Origin Request Policy header handling
 * 
 * Test with:
 * node bin/index.js --handler examples/cloudfront_orp_handler.mjs --fetch "https://example.com/path?query=value" --cf-orp AllViewerExceptHostHeader --verbose
 * node bin/index.js --handler examples/cloudfront_orp_handler.mjs --fetch "https://example.com/path?query=value" --cf-orp AllViewerExceptHostHeader --api-gateway-v2 --verbose
 * 
 * Or with watch mode:
 * node bin/index.js --handler examples/cloudfront_orp_handler.mjs --watch 3000 --cf-orp AllViewerExceptHostHeader --verbose
 * node bin/index.js --handler examples/cloudfront_orp_handler.mjs --watch 3000 --cf-orp AllViewerExceptHostHeader --api-gateway-v2 --verbose
 * 
 * Then test with curl:
 * curl -H "Host: original.example.com" -H "Origin: https://example.com" -H "Referer: https://example.com/page" http://localhost:3000/
 */

export async function handler(event) {
    console.log('CloudFront ORP Handler - Received event');

    // Check which headers are present/absent
    const headerChecks = {
        hasHost: !!event.headers.host,
        hasOrigin: !!event.headers.origin,
        hasReferer: !!event.headers.referer,
        hasVia: !!event.headers.via,
        hasXAmzCfId: !!event.headers['x-amz-cf-id'],
    };

    // Extract CloudFront-specific headers
    const cfHeaders = {
        via: event.headers.via,
        'x-amz-cf-id': event.headers['x-amz-cf-id'],
        host: event.headers.host,
    };

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'CloudFront Origin Request Policy Demo',
            headerChecks,
            cloudFrontHeaders: cfHeaders,
            allHeaders: event.headers,
            requestContext: {
                domainName: event.requestContext.domainName,
                domainPrefix: event.requestContext.domainPrefix,
            },
        }, null, 2),
    };
}
