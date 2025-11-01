import type { IncomingMessage } from 'node:http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { URL } from 'node:url';

/**
 * Converts an HTTP IncomingMessage to an AWS API Gateway V2 event
 * Based on the official AWS API Gateway HTTP API payload format version 2.0
 * Reference: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
export async function httpToApiGatewayV2(
  req: IncomingMessage,
  rawBody?: Buffer
): Promise<APIGatewayProxyEventV2> {
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`
  );
  const method = req.method || 'GET';
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};

  // Process headers - API Gateway sends all headers as lowercase
  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (Array.isArray(value)) {
      // Store multi-value headers
      multiValueHeaders[lowerKey] = value;
      // For the main headers object, join with comma (API Gateway behavior)
      headers[lowerKey] = value.join(',');
    } else if (value !== undefined) {
      headers[lowerKey] = value;
    }
  }

  // Extract cookies from the Cookie header
  const cookies: string[] = [];
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    // Split cookies by semicolon and trim whitespace
    const cookiePairs = cookieHeader.split(';').map(c => c.trim());
    cookies.push(...cookiePairs);
  }

  // Extract query string parameters
  const queryStringParameters: Record<string, string> = {};
  const rawQueryString = url.search.slice(1); // Remove the leading '?'

  url.searchParams.forEach((value, key) => {
    // If there are multiple values for the same key, the last one wins (API Gateway behavior)
    queryStringParameters[key] = value;
  });

  // Get the path without query string
  const rawPath = url.pathname;

  // Determine if body should be base64 encoded
  const contentType = headers['content-type'] || '';
  const isBase64Encoded =
    !contentType.startsWith('text/') &&
    !contentType.includes('application/json') &&
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('application/xml');

  // Process body
  let body: string | undefined;
  if (rawBody && rawBody.length > 0) {
    body = isBase64Encoded
      ? rawBody.toString('base64')
      : rawBody.toString('utf-8');
  }

  // Get client IP (check for X-Forwarded-For first, common in proxies)
  const sourceIp =
    headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // Build the API Gateway V2 event
  const event: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString,
    cookies: cookies.length > 0 ? cookies : undefined,
    headers,
    queryStringParameters:
      Object.keys(queryStringParameters).length > 0
        ? queryStringParameters
        : undefined,
    requestContext: {
      accountId: '123456789012',
      apiId: 'local-api-id',
      domainName: headers.host || 'localhost',
      domainPrefix: (headers.host || 'localhost').split('.')[0],
      http: {
        method,
        path: rawPath,
        protocol: `HTTP/${req.httpVersion}`,
        sourceIp,
        userAgent: headers['user-agent'] || 'unknown',
      },
      requestId: generateRequestId(),
      routeKey: '$default',
      stage: '$default',
      time: new Date().toUTCString(),
      timeEpoch: Date.now(),
    },
    body,
    isBase64Encoded,
  };

  // Add path parameters if they exist (placeholder for future routing support)
  // pathParameters: undefined,

  // Add stage variables if needed (usually not used in local development)
  // stageVariables: undefined,

  return event;
}

/**
 * Generates a unique request ID similar to AWS API Gateway format
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
}

/**
 * Helper function to read the body from an IncomingMessage
 */
export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', err => {
      reject(err);
    });
  });
}
