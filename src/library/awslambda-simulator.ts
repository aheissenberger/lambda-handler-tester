import type { APIGatewayProxyEventV2, Callback, Context } from 'aws-lambda';
import { Writable } from 'node:stream';
import { ResponseStream } from './ResponseStream.ts';
export const awslambdaSimulator = (silent: boolean) => {
  let responseStream = new ResponseStream({ silent });

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
          await handler(event, responseStream, context);
          return responseStream;
        },
      HttpResponseStream: {
        from(responseStream: Writable, metadata: any) {
          // Store metadata in the ResponseStream if it's our custom implementation
          if (responseStream instanceof ResponseStream) {
            if (metadata?.headers?.['Content-Type']) {
              responseStream.setContentType(metadata.headers['Content-Type']);
            }
            // Store status code and other headers for potential future use
            (responseStream as any)._statusCode = metadata?.statusCode;
            (responseStream as any)._headers = metadata?.headers;
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
        const responseStreamFinished = new Promise<void>((resolve, reject) => {
          responseStream.on('close', resolve);
          responseStream.on('error', reject);
        });
        await handler(event, responseStream, context);
        await responseStreamFinished;
        return responseStream.getBufferedData().toString('utf-8');
      },
  };
};
