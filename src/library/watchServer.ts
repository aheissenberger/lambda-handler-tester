import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import {
  httpToApiGatewayV2,
  readBody,
  type HttpToApiGatewayV2Options,
} from './httpToApiGatewayV2.ts';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import chalk from 'chalk';
import { ResponseStream } from './ResponseStream.ts';

export interface WatchServerOptions {
  port: number;
  handler: (
    event: APIGatewayProxyEventV2,
    context?: Context
  ) => Promise<APIGatewayProxyResultV2 | string | ResponseStream>;
  verbose?: boolean;
  contextData?: Context;
  streaming?: boolean;
  httpToApiGatewayV2Options?: HttpToApiGatewayV2Options;
}

/**
 * Starts an HTTP server that converts incoming requests to API Gateway V2 events
 * and forwards them to the Lambda handler
 */
export function startWatchServer(options: WatchServerOptions): void {
  const {
    port,
    handler,
    verbose = false,
    contextData,
    httpToApiGatewayV2Options,
  } = options;

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const startTime = Date.now();
      const method = req.method || 'GET';
      const url = req.url || '/';

      try {
        // Log incoming request
        if (verbose) {
          console.log(chalk.cyan(`\n→ ${method} ${url}`));
          console.log(
            chalk.gray(`  Headers: ${JSON.stringify(req.headers, null, 2)}`)
          );
        } else {
          console.log(chalk.cyan(`→ ${method} ${url}`));
        }

        // Read the request body
        const rawBody = await readBody(req);

        // Convert to API Gateway V2 event
        const event = await httpToApiGatewayV2(
          req,
          rawBody,
          httpToApiGatewayV2Options
        );

        if (verbose) {
          console.log(chalk.gray(`  Event: ${JSON.stringify(event, null, 2)}`));
        }

        // Call the Lambda handler
        const result = await handler(event, contextData);

        // Handle the response
        if (typeof result === 'string') {
          // Simple string response
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(result);
        } else if (result instanceof ResponseStream) {
          // Streaming response
          const bufferedData = result.getBufferedData();
          const contentType = result._contentType || 'text/html';
          const isBase64Encoded = result._isBase64Encoded || false;
          const statusCode = (result as any)._statusCode || 200;
          const headers = (result as any)._headers || {};

          res.statusCode = statusCode;

          // Set all headers from metadata
          for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined) {
              res.setHeader(key, String(value));
            }
          }

          // Set Content-Type from ResponseStream if not already set in headers
          // Check case-insensitively for Content-Type header
          const hasContentType = Object.keys(headers).some(
            key => key.toLowerCase() === 'content-type'
          );
          if (!hasContentType && contentType) {
            res.setHeader('Content-Type', contentType);
          }

          if (isBase64Encoded) {
            res.end(Buffer.from(bufferedData.toString(), 'base64'));
          } else {
            res.end(bufferedData);
          }
        } else {
          // API Gateway V2 response format
          const statusCode = result.statusCode || 200;
          const headers = result.headers || {};
          const body = result.body || '';
          const isBase64Encoded = result.isBase64Encoded || false;

          // Set status code
          res.statusCode = statusCode;

          // Set headers
          for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined) {
              res.setHeader(key, String(value));
            }
          }

          // Set cookies if present
          if (result.cookies && result.cookies.length > 0) {
            res.setHeader('Set-Cookie', result.cookies);
          }

          // Send body
          if (isBase64Encoded) {
            res.end(Buffer.from(body, 'base64'));
          } else {
            res.end(body);
          }
        }

        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const statusColor =
          statusCode >= 500
            ? chalk.red
            : statusCode >= 400
              ? chalk.yellow
              : statusCode >= 300
                ? chalk.cyan
                : chalk.green;

        console.log(
          statusColor(
            `← ${statusCode} ${method} ${url} ${chalk.gray(`(${duration}ms)`)}`
          )
        );
      } catch (error) {
        console.error(chalk.red(`✗ Error processing request: ${error}`));
        if (verbose && error instanceof Error) {
          console.error(chalk.red(error.stack));
        }

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : String(error),
          })
        );

        const duration = Date.now() - startTime;
        console.log(
          chalk.red(`← 500 ${method} ${url} ${chalk.gray(`(${duration}ms)`)}`)
        );
      }
    }
  );

  server.listen(port, () => {
    (globalThis as any).__lambdaWatchServer = server;
    (globalThis as any).__lambdaWatchServerPort = port;
    (globalThis as any).__lambdaWatchServerReady = true;
    console.log(
      chalk.green.bold(
        `\n🚀 Lambda handler server listening on http://localhost:${port}`
      )
    );
    console.log(chalk.gray(`   Press Ctrl+C to stop\n`));
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⏹  Shutting down server...'));
    server.close(() => {
      console.log(chalk.gray('Server stopped'));
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n\n⏹  Shutting down server...'));
    server.close(() => {
      console.log(chalk.gray('Server stopped'));
      process.exit(0);
    });
  });
}
