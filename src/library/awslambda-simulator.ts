import { APIGatewayProxyEventV2, Callback, Context } from 'aws-lambda';
import { Writable } from 'node:stream';
export const awslambdaSimulator = () => {
  let responseStream: Writable;
  let responseResult: Buffer;
  responseStream = new Writable({
    write(chunk, encoding, callback) {
      //console.log(chunk.toString());
      if (!responseResult) {
        responseResult = chunk;
      } else {
        responseResult = Buffer.concat([responseResult, chunk]);
      }
      callback();
    },
  });

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
        return responseResult.toString('utf-8');
      },
  };
};
