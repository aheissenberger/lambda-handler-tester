import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomBytes } from 'node:crypto';

export interface CloudFrontORPOptions {
  policy: string;
  addApiGatewayV2Host?: boolean;
  sourceIp?: string;
  // Optional device flags (used in watch mode when available)
  isAndroidViewer?: boolean;
  isDesktopViewer?: boolean;
  isIOSViewer?: boolean;
  isMobileViewer?: boolean;
  isSmartTVViewer?: boolean;
  isTabletViewer?: boolean;
  // Optional forwarded protocol (http/https) used for cloudfront-forwarded-proto
  forwardedProto?: string;
}

/**
 * Applies CloudFront Origin Request Policy transformations to an API Gateway V2 event
 * Currently supports: AllViewerExceptHost
 */
export function applyCloudFrontORP(
  event: APIGatewayProxyEventV2,
  options: CloudFrontORPOptions
): APIGatewayProxyEventV2 {
  if (options.policy === 'AllViewerExceptHost') {
    return applyAllViewerExceptHost(event, options);
  }

  throw new Error(
    `Unsupported CloudFront Origin Request Policy: ${options.policy}`
  );
}

/**
 * Applies AllViewerExceptHost CloudFront Origin Request Policy
 * - Removes: host, origin, referer headers
 * - Adds: via, x-amz-cf-id headers
 * - Adds CloudFront viewer headers (device type, geo-location, protocol info)
 * - Adds x-forwarded-* headers for CloudFront forwarding
 * - Optionally adds API Gateway V2 host header
 */
function applyAllViewerExceptHost(
  event: APIGatewayProxyEventV2,
  opts: CloudFrontORPOptions
): APIGatewayProxyEventV2 {
  const addApiGatewayV2Host = opts.addApiGatewayV2Host === true;
  const sourceIp = opts.sourceIp || '127.0.0.1';
  const headers = { ...event.headers };

  // Remove headers per AllViewerExceptHost policy
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  // Add CloudFront headers
  headers.via =
    '2.0 ' + randomBytes(8).toString('hex') + '.cloudfront.net (CloudFront)';
  headers['x-amz-cf-id'] =
    randomBytes(64)
      .toString('base64')
      .replace(/[+/=]/g, c => (c === '+' ? '-' : c === '/' ? '_' : '')) + '==';

  // Generate a random port number for the viewer address
  const viewerPort = Math.floor(Math.random() * (65535 - 10000) + 10000);

  // Add CloudFront viewer and forwarding headers
  headers['cloudfront-forwarded-proto'] = opts.forwardedProto || 'https';
  // Device flags: use provided flags when available (watch mode), otherwise defaults (fetch mode)
  headers['cloudfront-is-android-viewer'] = String(
    opts.isAndroidViewer ?? false
  );
  headers['cloudfront-is-desktop-viewer'] = String(
    opts.isDesktopViewer ?? true
  );
  headers['cloudfront-is-ios-viewer'] = String(opts.isIOSViewer ?? false);
  headers['cloudfront-is-mobile-viewer'] = String(opts.isMobileViewer ?? false);
  headers['cloudfront-is-smarttv-viewer'] = String(
    opts.isSmartTVViewer ?? false
  );
  headers['cloudfront-is-tablet-viewer'] = String(opts.isTabletViewer ?? false);
  headers['cloudfront-viewer-address'] = `${sourceIp}:${viewerPort}`;
  headers['cloudfront-viewer-asn'] = '3209'; // Request Origin Network: Example Vodafone Germany ASN
  headers['cloudfront-viewer-city'] = 'Berlin';
  headers['cloudfront-viewer-country'] = 'DE';
  headers['cloudfront-viewer-country-name'] = 'Germany';
  headers['cloudfront-viewer-country-region'] = '16';
  headers['cloudfront-viewer-country-region-name'] = 'Berlin';
  headers['cloudfront-viewer-http-version'] = '2.0';
  headers['cloudfront-viewer-latitude'] = '52.52000';
  headers['cloudfront-viewer-longitude'] = '13.40495';
  headers['cloudfront-viewer-postal-code'] = '10115';
  headers['cloudfront-viewer-time-zone'] = 'Europe/Berlin';
  headers['cloudfront-viewer-tls'] =
    'TLSv1.3:TLS_AES_128_GCM_SHA256:sessionResumed';

  // Add X-Amzn-Trace-Id header
  headers['x-amzn-trace-id'] = 'Root=1-69073438-7b4d8432348ee55c06a8dbb0';

  // Override X-Forwarded headers with real source IP
  headers['x-forwarded-for'] = `${sourceIp}, 130.176.219.142`;
  // Make x-forwarded-proto and x-forwarded-port dynamic in watch mode
  const proto = opts.forwardedProto || 'https';
  headers['x-forwarded-proto'] = proto;
  headers['x-forwarded-port'] = proto === 'https' ? '443' : '80';

  // Add API Gateway V2 host header if requested
  if (addApiGatewayV2Host) {
    headers.host = 'lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com';
  }

  return {
    ...event,
    headers,
  };
}
