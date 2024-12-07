import { APIGatewayProxyEventV2, Callback, Context } from 'aws-lambda';
import { Writable } from 'node:stream';
import { ResponseStream } from './ResponseStream.js';
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
          //TODOD: implement writing metadata to responseStream
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
        await handler(event, responseStream, context);
        await new Promise<void>(resolve => responseStream.on('close', resolve));
        return responseStream.getBufferedData().toString('utf-8');
      },
  };
};
