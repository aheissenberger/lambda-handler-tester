# lambda-handler-tester

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> Test AWS Lambda handler built with javascript on the command line. This tool loads the javascript and call the handler function with the provided event data. Handler which can handler streaming are supported when using the flag `-s`.

## Usage

```bash
Usage: pnpm dlx lambda-handler-tester [options]

Options:
  -V, --version         output the version number
  --handler [PATH]      path to request handler
  -s, --streaming       streaming handler (default: false)
  -e, --event [PATH]    path to an json file with a valid event
  -c, --context [PATH]  path to an json file with a valid context
  -p, --path [PATH]     path to request (default: "/")
  --decode-base64       decode base64 body (default: false)
  --header              only show header without body (default: false)
  -v, --verbose         enables verbose logging (default: false)
  --response-time       measure the response time (default: false)
  --repeat <number>     repeat request [n] times (default: 1)
  --profile-cpu         profile JavaScript CPU usage to "aws-lambda-handler.cpuprofile" (default: false)
  --silent              no output (default: false)
  -d, --debug           enables verbose logging (default: false)
  -w, --watch <port>    start HTTP server on port and watch for requests
  --fetch <url>         fetch URL and convert to API Gateway V2 GET event
  --cf-orp <name>       simulate CloudFront Origin Request Policy (supported: AllViewerExceptHost)
  --api-gateway-v2      add API Gateway V2 host header (use with --cf-orp) (default: false)
  -h, --help            display help for command

Examples:

  $ pnpm dlx lambda-handler-tester
  0.0.xx-development

  $ pnpm dlx lambda-handler-tester --watch 3000
  🚀 Lambda handler server listening on http://localhost:3000

  $ pnpm dlx lambda-handler-tester --fetch "https://example.com/api/users?id=123"
  # Converts the URL to an API Gateway V2 GET event and passes it to your handler

  $ pnpm dlx lambda-handler-tester --fetch "https://example.com" --cf-orp AllViewerExceptHost --api-gateway-v2
  # Simulates CloudFront Origin Request Policy with API Gateway V2 host header
```

### Framework detection

These frameworks are detected:

- [@lazarv/react-server](https://react-server.dev)
- [Waku](https://waku.gg)
- [Vike](https://vike.dev)

If your network is not detected you will need to provide the path to the file with the AWS Lambda Handler:
`$ pnpm dlx lambda-handler-tester --handler ./aws-lambda-output/handler.mjs`

### Options

#### Measure Response Time

The option `--response-time` together with the option `--repeat <number>` allows to measure response time for first and repeated calls.

**Report:**

```
First run:
Name  size  min   max   median  sum
----  ----  ----  ----  ------  ----
         1  2.24  2.24    2.24  2.24

Repeat 100 times:  100%
Name  size  min   max   median  sum
----  ----  ----  ----  ------  ----
       100  0.02  0.75    0.02  4.78
Total running time: 5ms
```

#### JavaScript CPU Profile

The option `--profile-cpu` allows to profile the CPU usage of the handler to the file `aws-lambda-handler.cpuprofile`. The handler needs to be [called from NodeJS](https://nodejs.org/api/console.html#inspector-only-methods) with the `--inspect` flag to generate the file or at least run in a VS Code JavaScript Debug Terminal.

> **Streaming** handlers are not supported!

#### Fetch URL Mode

The `--fetch <url>` option converts any URL into an AWS API Gateway V2 GET event. This is useful for testing how your handler would process requests to specific URLs.

**Features:**

- Converts URL to proper API Gateway V2 event format
- Extracts path, query parameters, and host information
- Sets appropriate headers including protocol (http/https)
- Supports custom ports
- Perfect for testing web scraping or proxy handlers

**Usage:**

```bash
# Fetch a simple URL
$ pnpm dlx lambda-handler-tester --fetch "https://example.com/api/data"

# Fetch with query parameters
$ pnpm dlx lambda-handler-tester --fetch "https://api.github.com/users/octocat?tab=repos"

# Fetch with custom port
$ pnpm dlx lambda-handler-tester --fetch "http://localhost:8080/test"

# With verbose logging to see the generated event
$ pnpm dlx lambda-handler-tester --fetch "https://example.com" --verbose
```

The generated event includes:

- `rawPath`: The URL pathname
- `rawQueryString`: URL-encoded query string
- `queryStringParameters`: Parsed query parameters
- `headers`: Standard HTTP headers including host, user-agent, accept, etc.
- `requestContext.http.method`: Always "GET"
- `x-forwarded-proto`: Protocol (http or https)
- `x-forwarded-port`: Port number

See `examples/fetch_handler.mjs` for an example handler that processes fetch events.

#### CloudFront Origin Request Policy Simulation

The `--cf-orp <name>` option simulates CloudFront Origin Request Policies by modifying request headers before they reach your Lambda handler. This is useful for testing how your handler behaves when deployed behind CloudFront.

**Supported Policies:**

- `AllViewerExceptHost`: Forwards all viewer headers except Host, Origin, and Referer

**Features:**

- **Removes headers**: `host`, `origin`, `referer` (per policy)
- **Adds CloudFront headers**:
  - `via`: CloudFront edge server identifier (e.g., `2.0 abc123def456.cloudfront.net (CloudFront)`)
  - `x-amz-cf-id`: CloudFront request ID (88-character base64 string)
  - `x-amzn-trace-id`: AWS X-Ray trace ID
- **Adds CloudFront viewer headers** (device type, geo-location, protocol info):
  - `cloudfront-forwarded-proto`: Request protocol (http/https in watch mode; https in fetch mode)
  - `cloudfront-is-*-viewer`: Device type flags (desktop, mobile, tablet, etc.)
  - `cloudfront-viewer-address`: Client IP and random port (uses actual client IP from request)
  - `cloudfront-viewer-asn`: Autonomous System Number [global network owner identifyer](https://www.arin.net/resources/guide/asn/)
  - `cloudfront-viewer-city`, `cloudfront-viewer-country`, etc.: Geographic information
  - `cloudfront-viewer-latitude`, `cloudfront-viewer-longitude`: GPS coordinates
  - `cloudfront-viewer-http-version`: HTTP version
  - `cloudfront-viewer-tls`: TLS connection details
- **Overrides X-Forwarded headers**:
  - `x-forwarded-for`: Client IP with CloudFront edge IP (uses actual client IP from request)
  - `x-forwarded-port`: 80/443 in watch mode (mirrors protocol), 443 in fetch mode
  - `x-forwarded-proto`: http/https in watch mode (mirrors incoming), https in fetch mode
- **Optional API Gateway V2 host**: Use with `--api-gateway-v2` flag to add API Gateway host header
- Works with both `--fetch` and `--watch` modes

**Usage:**

```bash
# With fetch mode - simulate CloudFront ORP
$ pnpm dlx lambda-handler-tester --fetch "https://example.com/api" --cf-orp AllViewerExceptHost

# With fetch mode - add API Gateway V2 host header
$ pnpm dlx lambda-handler-tester --fetch "https://example.com/api" --cf-orp AllViewerExceptHost --api-gateway-v2

# With watch mode
$ pnpm dlx lambda-handler-tester --watch 3000 --cf-orp AllViewerExceptHost --api-gateway-v2

# Test with curl (headers will be transformed)
$ curl -H "Host: original.com" -H "Origin: https://example.com" http://localhost:3000/
```

**Header Transformations:**

**Before** (Original Request):

```json
{
  "headers": {
    "host": "example.com",
    "origin": "https://example.com",
    "referer": "https://example.com/page",
    "user-agent": "Mozilla/5.0"
  }
}
```

**After** (With `--cf-orp AllViewerExceptHost`):

```json
{
  "headers": {
    "user-agent": "Mozilla/5.0",
    "accept": "*/*",
    "via": "2.0 c5724b0f344b863f.cloudfront.net (CloudFront)",
    "x-amz-cf-id": "5a_4fJMlUgshVedY7hw_a95Fjrcvo_ZUTyAYXm1MqIPHu2ey__pzSO8Z6vfc8_DdxnmSecb4tBs==",
    "cloudfront-forwarded-proto": "http",
    "cloudfront-is-android-viewer": "false",
    "cloudfront-is-desktop-viewer": "true",
    "cloudfront-is-ios-viewer": "false",
    "cloudfront-is-mobile-viewer": "false",
    "cloudfront-is-smarttv-viewer": "false",
    "cloudfront-is-tablet-viewer": "false",
    "cloudfront-viewer-address": "::1:15104",
    "cloudfront-viewer-asn": "3209",
    "cloudfront-viewer-city": "Berlin",
    "cloudfront-viewer-country": "DE",
    "cloudfront-viewer-country-name": "Germany",
    "cloudfront-viewer-country-region": "16",
    "cloudfront-viewer-country-region-name": "Berlin",
    "cloudfront-viewer-http-version": "2.0",
    "cloudfront-viewer-latitude": "52.52000",
    "cloudfront-viewer-longitude": "13.40495",
    "cloudfront-viewer-postal-code": "10115",
    "cloudfront-viewer-time-zone": "Europe/Berlin",
    "cloudfront-viewer-tls": "TLSv1.3:TLS_AES_128_GCM_SHA256:sessionResumed",
    "x-amzn-trace-id": "Root=1-69073438-7b4d8432348ee55c06a8dbb0",
    "x-forwarded-for": "::1, 130.176.219.142",
    "x-forwarded-port": "80",
    "x-forwarded-proto": "http"
  }
}
```

> **Note**: The IP address in `cloudfront-viewer-address` and `x-forwarded-for` is dynamically set based on the actual client IP (from `X-Forwarded-For` header or socket remote address). The port in `cloudfront-viewer-address` is randomly generated for each request.
>
> In watch mode, `x-forwarded-proto` and `cloudfront-forwarded-proto` reflect the incoming request's protocol (typically `http` for local servers), and `x-forwarded-port` mirrors it (80 for http, 443 for https). In fetch mode, they default to `https` and port `443`.

**After** (With `--cf-orp AllViewerExceptHost --api-gateway-v2`):

```json
{
  "headers": {
    "host": "lj6qvkw6cf.execute-api.eu-west-1.amazonaws.com",
    "user-agent": "Mozilla/5.0",
    "via": "2.0 abc123def456.cloudfront.net (CloudFront)",
    "x-amz-cf-id": "PXYbxeBvE3cEsOYBSlF_S4Gcd..."
  }
}
```

See `examples/cloudfront_orp_handler.mjs` for an example handler that demonstrates CloudFront ORP header handling.

**Real-World Use Case:**

This feature is particularly useful when your Lambda@Edge or Lambda function is deployed behind CloudFront with an Origin Request Policy. It allows you to test locally with the same header transformations that CloudFront applies in production, ensuring your handler works correctly with the modified headers.

#### Watch Server Mode

The `--watch <port>` option starts a local HTTP server that converts all incoming HTTP requests to AWS API Gateway V2 events and forwards them to your Lambda handler. This is useful for local development and testing.

**Features:**

- Converts HTTP requests to API Gateway V2 event format
- Handles all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Properly processes headers, cookies, query parameters, and request body
- Supports base64 encoding for binary content
- **Supports streaming handlers** with `--streaming` flag
- Real-time request/response logging
- Graceful shutdown with Ctrl+C

**Usage:**

```bash
# Start server on port 3000
$ pnpm dlx lambda-handler-tester --watch 3000

# With verbose logging
$ pnpm dlx lambda-handler-tester --watch 3000 --verbose

# With a specific handler
$ pnpm dlx lambda-handler-tester --handler ./my-handler.mjs --watch 8080

# With streaming support
$ pnpm dlx lambda-handler-tester --handler ./streaming-handler.mjs --streaming --watch 3000
```

**Example output:**

```
🚀 Lambda handler server listening on http://localhost:3000
   Press Ctrl+C to stop

→ GET /
← 200 GET / (23ms)
→ POST /api/data
← 200 POST /api/data (15ms)
```

See `examples/watch_server_handler.mjs` for a complete example handler.
See `examples/watch_server_streaming_handler.mjs` for a streaming handler example.

**API Gateway V2 Event Format:**

The watch server converts HTTP requests to the AWS API Gateway HTTP API payload format version 2.0, which includes:

- `version`: Always "2.0"
- `routeKey`: Route identifier (default: "$default")
- `rawPath`: The request path
- `rawQueryString`: URL-encoded query string
- `cookies`: Array of cookie strings
- `headers`: All request headers (lowercase keys)
- `queryStringParameters`: Parsed query parameters
- `requestContext`: Metadata about the request (method, sourceIp, userAgent, etc.)
- `body`: Request body (base64 encoded for binary content)
- `isBase64Encoded`: Boolean indicating if body is base64 encoded

Reference: [AWS API Gateway HTTP API payload format](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)

[build-img]: https://github.com/ryansonshine/typescript-npm-cli-template/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/ryansonshine/typescript-npm-cli-template/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/typescript-npm-cli-template
[downloads-url]: https://www.npmtrends.com/typescript-npm-cli-template
[npm-img]: https://img.shields.io/npm/v/typescript-npm-cli-template
[npm-url]: https://www.npmjs.com/package/typescript-npm-cli-template
[issues-img]: https://img.shields.io/github/issues/ryansonshine/typescript-npm-cli-template
[issues-url]: https://github.com/ryansonshine/typescript-npm-cli-template/issues
[codecov-img]: https://codecov.io/gh/ryansonshine/typescript-npm-cli-template/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/ryansonshine/typescript-npm-cli-template
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
