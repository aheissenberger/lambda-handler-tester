import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import {
  httpToApiGatewayV2,
  type HttpToApiGatewayV2Options,
} from './httpToApiGatewayV2.ts';
import type { APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { ResponseStream } from './ResponseStream.ts';
import chalk from 'chalk';
import { randomBytes } from 'crypto';

// Helper function to create a default Lambda context
function createDefaultContext(): Context {
  const requestId = randomBytes(16).toString('hex');
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'lambda-handler-tester',
    functionVersion: '$LATEST',
    invokedFunctionArn:
      'arn:aws:lambda:us-east-1:123456789012:function:lambda-handler-tester',
    memoryLimitInMB: '128',
    awsRequestId: requestId,
    logGroupName: '/aws/lambda/lambda-handler-tester',
    logStreamName: `2025/01/01/[$LATEST]${requestId}`,
    identity: undefined,
    clientContext: undefined,
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

export interface WatchServerOptions {
  port: number;
  handler: (
    ...args: any[]
  ) => Promise<APIGatewayProxyResultV2 | string | ResponseStream | void>;
  verbose?: boolean;
  contextData?: Context;
  streaming?: boolean;
  silent?: boolean;
  httpToApiGatewayV2Options?: HttpToApiGatewayV2Options;
}

/**
 * Starts an HTTP server that converts incoming requests to API Gateway V2 events
 * and forwards them to the Lambda handler
 */
export function startWatchServer(options: WatchServerOptions): void {
  const { port } = options;

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const startTime = Date.now();
      const method = req.method || 'GET';
      const url = req.url || '/';
      const verbose = options.verbose || false;

      if (verbose) {
        console.log(chalk.blue(`\n→ ${method} ${url}`));
      } else {
        console.log(`→ ${method} ${url}`);
      }

      try {
        // Collect request body
        const bodyChunks: Buffer[] = [];
        for await (const chunk of req) {
          bodyChunks.push(chunk);
        }
        const body = Buffer.concat(bodyChunks);

        // Convert HTTP request to API Gateway V2 event
        const eventData = await httpToApiGatewayV2(
          req,
          body,
          options.httpToApiGatewayV2Options
        );

        if (verbose) {
          console.log(chalk.gray('Event:'), JSON.stringify(eventData, null, 2));
        }

        // Use provided context or create default
        const contextData = options.contextData || createDefaultContext();

        // If streaming mode, stream chunks to HTTP response as they arrive
        if (options.streaming) {
          if (verbose) {
            console.log(chalk.cyan('Starting streaming response...'));
          }

          let headersSent = false;
          let pendingStatus: number = 200;
          let pendingHeaders: Record<
            string,
            string | number | readonly string[]
          > = {};
          let responseEnded = false;

          // Call handler with (event, context) - wrapped handlers return ResponseStream
          const result = await options.handler(
            eventData as any,
            contextData as any
          );

          // Handler should return a ResponseStream
          if (!(result instanceof ResponseStream)) {
            console.error(
              chalk.red('✗ Streaming handler must return a ResponseStream')
            );
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid streaming handler' }));
            return;
          }

          const responseStream = result;

          const sendHeadersOnce = () => {
            if (headersSent) return;

            if (verbose) {
              console.log(chalk.cyan('Sending headers...'), {
                status: pendingStatus,
                headers: pendingHeaders,
              });
            }

            // Prefer headers from metadata; fallback to ResponseStream content type
            const hdrsLower = Object.fromEntries(
              Object.keys(pendingHeaders).map(k => [k.toLowerCase(), k])
            );
            const hasCt = 'content-type' in hdrsLower;
            const ct = responseStream.getContentType();
            if (!hasCt && ct) {
              pendingHeaders['Content-Type'] = ct;
            }

            // Write status and headers
            res.statusCode = pendingStatus;
            for (const [k, v] of Object.entries(pendingHeaders)) {
              if (v !== undefined) res.setHeader(k, v as any);
            }
            headersSent = true;
          };

          // Apply metadata when available, before first byte
          responseStream.once(
            'metadata',
            (m: { statusCode?: number; headers?: Record<string, any> }) => {
              if (verbose) {
                console.log(chalk.cyan('Received metadata:'), m);
              }
              if (typeof m?.statusCode === 'number')
                pendingStatus = m.statusCode;
              if (m?.headers && typeof m.headers === 'object') {
                for (const [k, v] of Object.entries(m.headers)) {
                  pendingHeaders[k] = v as any;
                }
              }
            }
          );

          // Stream chunks to client as they're written
          responseStream.on('chunk', (buf: Buffer) => {
            if (verbose) {
              console.log(chalk.cyan(`Streaming chunk: ${buf.length} bytes`));
            }
            if (!headersSent) sendHeadersOnce();

            if (responseStream.getIsBase64Encoded()) {
              res.write(Buffer.from(buf.toString(), 'base64'));
            } else {
              res.write(buf);
            }
          });

          responseStream.once('finish', () => {
            if (verbose) {
              console.log(chalk.cyan('Stream finished'));
            }
            if (!headersSent) sendHeadersOnce();
            if (!responseEnded) {
              res.end();
              responseEnded = true;
            }
          });

          responseStream.once('error', err => {
            console.error(
              chalk.red(
                `✗ Stream error: ${err instanceof Error ? err.message : String(err)}`
              )
            );
            if (verbose && err instanceof Error)
              console.error(chalk.red(err.stack));
            if (!headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              headersSent = true;
            }
            if (!responseEnded) {
              res.end(JSON.stringify({ error: 'Stream Error' }));
              responseEnded = true;
            }
          });
        } else {
          // Non-streaming path
          const result = await options.handler(
            eventData as any,
            contextData as any
          );

          if (!result) {
            // Handler returned void - send empty 200 response
            res.statusCode = 200;
            res.end();
          } else if (typeof result === 'string') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end(result);
          } else if (result instanceof ResponseStream) {
            const bufferedData = result.getBufferedData();
            const contentType = result.getContentType() || 'text/html';
            const isBase64Encoded = result.getIsBase64Encoded() || false;
            const statusCode = (result as any)._statusCode || 200;
            const headers = (result as any)._headers || {};

            res.statusCode = statusCode;

            for (const [key, value] of Object.entries(headers)) {
              if (value !== undefined) {
                res.setHeader(key, String(value));
              }
            }

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

            res.statusCode = statusCode;

            for (const [key, value] of Object.entries(headers)) {
              if (value !== undefined) {
                res.setHeader(key, String(value));
              }
            }

            if (result.cookies && result.cookies.length > 0) {
              res.setHeader('Set-Cookie', result.cookies);
            }

            if (isBase64Encoded) {
              res.end(Buffer.from(body, 'base64'));
            } else {
              res.end(body);
            }
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
        console.error(
          chalk.red(
            `✗ Error processing request: ${error instanceof Error ? error.message : String(error)}`
          )
        );
        if (verbose && error instanceof Error) {
          console.error(chalk.red(error.stack));
        }

        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        if (!res.writableEnded) {
          res.end(
            JSON.stringify({
              error: 'Internal Server Error',
              message: error instanceof Error ? error.message : String(error),
            })
          );
        }

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
