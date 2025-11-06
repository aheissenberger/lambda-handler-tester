import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { Writable } from 'node:stream';
import { ResponseStream } from './ResponseStream';

export const awslambdaSimulator = (silent: boolean) => {
  return {
    awslambda: {
      streamifyResponse:
        (
          handler: (
            event: APIGatewayProxyEventV2,
            responseStream: Writable,
            context: Context
          ) => Promise<void>
        ) =>
        async (event: APIGatewayProxyEventV2, context: Context) => {
          // Create a fresh ResponseStream per invocation
          const responseStream = new ResponseStream({ silent });

          // Wait for writes to flush
          const finished = new Promise<void>((resolve, reject) => {
            responseStream.once('finish', resolve);
            responseStream.once('error', reject);
          });

          await handler(event, responseStream, context);
          await finished;

          return responseStream;
        },
      HttpResponseStream: {
        from(responseStream: Writable, metadata: any) {
          // Attach metadata to our custom stream instance
          if (responseStream instanceof ResponseStream) {
            const headers = (metadata?.headers ?? {}) as Record<string, any>;

            // Case-insensitive content-type detection
            const contentTypeKey = Object.keys(headers).find(
              k => k.toLowerCase() === 'content-type'
            );
            if (contentTypeKey && headers[contentTypeKey]) {
              responseStream.setContentType(headers[contentTypeKey]);
            }

            // Store status code and headers for later propagation
            (responseStream as any)._statusCode =
              metadata?.statusCode ??
              (responseStream as any)._statusCode ??
              200;
            (responseStream as any)._headers = headers;
          }
          return responseStream;
        },
      },
    },
    streamifyHandler:
      (
        handler: (
          event: APIGatewayProxyEventV2,
          responseStream: Writable,
          context: Context
        ) => any
      ) =>
      async (event: APIGatewayProxyEventV2, context: Context) => {
        // Create a fresh ResponseStream per invocation
        const responseStream = new ResponseStream({ silent });

        const finished = new Promise<void>((resolve, reject) => {
          responseStream.once('finish', resolve);
          responseStream.once('error', reject);
        });

        await handler(event, responseStream, context);
        await finished;

        return responseStream.getBufferedData().toString('utf-8');
      },
  };
};
