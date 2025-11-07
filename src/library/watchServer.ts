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
  const verboseGlobal = !!options.verbose;
  // Controller used to abort in-flight requests on shutdown without tracking sockets
  const shutdownController = new AbortController();
  let shuttingDown = false;

  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const startTime = Date.now();
      const method = req.method || 'GET';
      const url = req.url || '/';
      const verbose = options.verbose || false;

      // If we're shutting down, make sure clients don't keep the connection alive
      if (shuttingDown) {
        try {
          res.setHeader('Connection', 'close');
          // @ts-ignore
          res.shouldKeepAlive = false;
        } catch {}
      }

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
        // Expose an abort signal to handlers so they can cancel work promptly
        (contextData as any).abortSignal = shutdownController.signal;

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

          // If the handler set metadata before returning the stream, capture it now
          const preStatus = (responseStream as any)._statusCode as
            | number
            | undefined;
          const preHeaders = (responseStream as any)._headers as
            | Record<string, any>
            | undefined;
          if (typeof preStatus === 'number') pendingStatus = preStatus;
          if (preHeaders && typeof preHeaders === 'object') {
            for (const [k, v] of Object.entries(preHeaders)) {
              pendingHeaders[k] = v as any;
            }
          }

          // Abort hook: close the stream/response promptly when shutting down
          const onAbort = () => {
            if (verboseGlobal)
              console.log(
                chalk.yellow('↯ Aborting in-flight streaming response')
              );
            try {
              // Best effort: end HTTP response
              if (!headersSent) {
                try {
                  res.setHeader('Connection', 'close');
                } catch {}
              }
              // Signal to writer to stop
              responseStream.destroy(new Error('Server shutting down'));
              if (!responseEnded) {
                res.end();
                responseEnded = true;
              }
            } catch {}
          };
          shutdownController.signal.addEventListener('abort', onAbort, {
            once: true,
          });

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

          // If the handler wrote synchronously before we attached listeners,
          // flush the buffered data now so nothing is lost.
          const initial = responseStream.getBufferedData?.();
          if (initial && initial.length > 0) {
            if (!headersSent) sendHeadersOnce();
            if (responseStream.getIsBase64Encoded()) {
              res.write(Buffer.from(initial.toString(), 'base64'));
            } else {
              res.write(initial);
            }
          }

          // If the stream already ended synchronously, finalize the response
          if ((responseStream as any).writableEnded) {
            if (!headersSent) sendHeadersOnce();
            if (!responseEnded) {
              res.end();
              responseEnded = true;
            }
            shutdownController.signal.removeEventListener('abort', onAbort);
            return;
          }

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
            shutdownController.signal.removeEventListener('abort', onAbort);
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
            shutdownController.signal.removeEventListener('abort', onAbort);
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

  // Graceful shutdown via AbortController (no socket tracking)
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(
      chalk.yellow(`\n\n⏹  ${signal} received. Shutting down server...`)
    );

    // Abort in-flight requests, handlers can also observe context.abortSignal
    shutdownController.abort(new Error('Server shutdown'));

    // Stop accepting new connections
    try {
      // @ts-ignore (Node >=18)
      server.closeIdleConnections?.();
    } catch {}
    try {
      server.close(() => {
        if (verboseGlobal) console.log(chalk.gray('HTTP server closed'));
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }

    // Failsafe: ensure exit even if callbacks don’t run
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
