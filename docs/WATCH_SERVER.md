# Watch Server Feature

## Overview

The `--watch <port>` feature starts a local HTTP server that converts all incoming HTTP requests to AWS API Gateway V2 events and forwards them to your Lambda handler. This enables local development and testing of Lambda handlers without deploying to AWS.

**Supports both standard and streaming Lambda handlers!**

## Usage

```bash
# Basic usage
lambda-handler-tester --watch 3000

# With a specific handler
lambda-handler-tester --handler ./my-handler.mjs --watch 3000

# With streaming support
lambda-handler-tester --handler ./streaming-handler.mjs --streaming --watch 3000

# With verbose logging
lambda-handler-tester --watch 3000 --verbose

# With a context file
lambda-handler-tester --watch 3000 --context ./context.json
```

## Features

### HTTP to API Gateway V2 Conversion

The watch server automatically converts HTTP requests to the AWS API Gateway HTTP API payload format version 2.0. This includes:

- **Headers**: All HTTP headers are converted to lowercase (API Gateway behavior)
- **Cookies**: Automatically extracted from the `Cookie` header and provided as an array
- **Query Parameters**: Parsed from the URL query string
- **Request Body**: Supports both text and binary content
- **Base64 Encoding**: Automatically detects and base64 encodes binary content
- **Source IP**: Extracted from `X-Forwarded-For` header or socket remote address
- **Request Metadata**: Includes method, path, protocol, user agent, and timestamps

### Event Structure

The generated API Gateway V2 event includes:

```javascript
{
  version: '2.0',
  routeKey: '$default',
  rawPath: '/api/users',
  rawQueryString: 'name=john&age=30',
  cookies: ['session=abc123', 'user=john'],
  headers: {
    'host': 'localhost:3000',
    'user-agent': 'curl/8.7.1',
    'content-type': 'application/json'
  },
  queryStringParameters: {
    'name': 'john',
    'age': '30'
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'local-api-id',
    domainName: 'localhost:3000',
    domainPrefix: 'localhost',
    http: {
      method: 'POST',
      path: '/api/users',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'curl/8.7.1'
    },
    requestId: 'unique-request-id',
    routeKey: '$default',
    stage: '$default',
    time: 'Sat, 01 Nov 2025 14:44:51 GMT',
    timeEpoch: 1762008291360
  },
  body: '{"test":"data"}',
  isBase64Encoded: false
}
```

### Response Handling

The watch server supports three response formats:

1. **String Response**: Returns as plain text with 200 status code
2. **API Gateway V2 Response**: Full response object with status code, headers, cookies, and body
3. **Streaming Response**: AWS Lambda streaming response using `awslambda.streamifyResponse` (requires `--streaming` flag)

```javascript
// Simple string response
export const handler = async event => {
  return 'Hello, World!';
};

// API Gateway V2 response format
export const handler = async event => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    cookies: ['session=abc123; Path=/; HttpOnly'],
    body: JSON.stringify({ message: 'Success' }),
    isBase64Encoded: false,
  };
};

// Streaming response (requires --streaming flag)
export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const metadata = {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
    };
    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    responseStream.write('<html><body>');
    responseStream.write('<h1>Streaming Response</h1>');
    // Stream data in chunks
    for (let i = 1; i <= 5; i++) {
      responseStream.write(`<p>Chunk ${i}</p>`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    responseStream.write('</body></html>');
    responseStream.end();
  }
);
```

### Logging

The watch server provides color-coded request/response logging:

```
→ GET /api/users
← 200 GET /api/users (15ms)

→ POST /api/data
← 201 POST /api/data (23ms)

→ GET /not-found
← 404 GET /not-found (2ms)
```

Status codes are color-coded:

- **Green**: 2xx Success
- **Cyan**: 3xx Redirection
- **Yellow**: 4xx Client Error
- **Red**: 5xx Server Error

### Verbose Mode

With `--verbose` flag, the server logs complete event details:

```bash
lambda-handler-tester --watch 3000 --verbose
```

This shows:

- Full request headers
- Complete API Gateway V2 event object
- Detailed error stack traces

## Examples

### Simple REST API

```javascript
// handler.mjs
export const handler = async event => {
  const { rawPath, requestContext } = event;
  const method = requestContext.http.method;

  if (rawPath === '/users' && method === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ]),
    };
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not Found' }),
  };
};
```

### Handling Query Parameters

```javascript
export const handler = async event => {
  const { queryStringParameters } = event;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      received: queryStringParameters,
    }),
  };
};
```

### Processing POST Data

```javascript
export const handler = async event => {
  const { body, isBase64Encoded, headers } = event;

  let data = body;
  if (isBase64Encoded) {
    data = Buffer.from(body, 'base64').toString('utf-8');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Data received',
      contentType: headers['content-type'],
      data: JSON.parse(data),
    }),
  };
};
```

### Cookie Handling

```javascript
export const handler = async event => {
  const { cookies } = event;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    cookies: ['new-cookie=value; Path=/; HttpOnly'],
    body: JSON.stringify({
      receivedCookies: cookies,
    }),
  };
};
```

### Streaming Examples

The watch server supports AWS Lambda streaming responses when used with the `--streaming` flag.

#### Streaming HTML

```javascript
export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    responseStream.write('<!DOCTYPE html><html><body>');
    responseStream.write('<h1>Streaming Response</h1>');

    // Stream data progressively
    for (let i = 1; i <= 5; i++) {
      responseStream.write(`<p>Chunk ${i} - ${new Date().toISOString()}</p>`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    responseStream.write('</body></html>');
    responseStream.end();
  }
);
```

#### Streaming JSON Array

```javascript
export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const metadata = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
    };
    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    responseStream.write('[\n');
    for (let i = 1; i <= 10; i++) {
      const item = {
        id: i,
        name: `Item ${i}`,
        timestamp: new Date().toISOString(),
      };
      responseStream.write(JSON.stringify(item));
      if (i < 10) responseStream.write(',\n');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    responseStream.write('\n]');
    responseStream.end();
  }
);
```

#### Server-Sent Events (SSE)

```javascript
export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    };
    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    for (let i = 1; i <= 5; i++) {
      const eventData = {
        id: i,
        message: `Event ${i}`,
        timestamp: new Date().toISOString(),
      };
      responseStream.write(`event: message\n`);
      responseStream.write(`id: ${i}\n`);
      responseStream.write(`data: ${JSON.stringify(eventData)}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    responseStream.write('event: done\ndata: {"message": "Complete"}\n\n');
    responseStream.end();
  }
);
```

**Usage:**

```bash
lambda-handler-tester --handler ./streaming-handler.mjs --streaming --watch 3000
```

See `examples/watch_server_streaming_handler.mjs` for more streaming examples.

## Testing

You can test the watch server using:

- **curl**: `curl http://localhost:3000/api/test`
- **Browser**: Navigate to `http://localhost:3000`
- **Postman** or any HTTP client
- **Automated tests**: Use fetch, axios, etc.

## Graceful Shutdown

Press `Ctrl+C` to gracefully shutdown the server:

```
⏹  Shutting down server...
Server stopped
```

## References

- [AWS API Gateway HTTP API payload format 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [AWS Lambda Handler Signature](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)

## See Also

- `examples/watch_server_handler.mjs` - Complete example handler
- `src/library/httpToApiGatewayV2.ts` - Conversion implementation
- `src/library/watchServer.ts` - Server implementation
