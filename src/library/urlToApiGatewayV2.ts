import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * Converts a URL to an AWS API Gateway V2 event for a GET request
 * This is useful for testing handlers with real webpage URLs
 */
export function urlToApiGatewayV2Event(
  urlString: string
): APIGatewayProxyEventV2 {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  // Extract path and query string
  const rawPath = url.pathname || '/';
  const rawQueryString = url.search.slice(1); // Remove the leading '?'

  // Parse query parameters
  const queryStringParameters: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value;
  });

  // Extract host and determine domain prefix
  const domainName = url.host;
  const domainPrefix = url.hostname.split('.')[0];

  // Determine protocol (http or https)
  const protocol = url.protocol === 'https:' ? 'https' : 'http';
  const port = url.port || (protocol === 'https' ? '443' : '80');

  // Build standard headers for a GET request
  const headers: Record<string, string> = {
    host: url.host,
    'user-agent': 'lambda-handler-tester/1.0',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.5',
    'accept-encoding': 'gzip, deflate, br',
    connection: 'keep-alive',
    'upgrade-insecure-requests': '1',
    'x-forwarded-for': '127.0.0.1',
    'x-forwarded-port': port,
    'x-forwarded-proto': protocol,
  };

  // Generate request ID
  const requestId = generateRequestId();

  // Get current timestamp
  const now = new Date();
  const timeEpoch = now.getTime();
  const time = now.toUTCString();

  // Build the API Gateway V2 event
  const event: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey: '$default',
    rawPath,
    rawQueryString,
    headers,
    queryStringParameters:
      Object.keys(queryStringParameters).length > 0
        ? queryStringParameters
        : undefined,
    requestContext: {
      accountId: '123456789012',
      apiId: 'fetch-api-id',
      domainName,
      domainPrefix,
      http: {
        method: 'GET',
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'lambda-handler-tester/1.0',
      },
      requestId,
      routeKey: '$default',
      stage: '$default',
      time,
      timeEpoch,
    },
    isBase64Encoded: false,
  };

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
