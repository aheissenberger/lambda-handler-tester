import { APIGatewayProxyEventV2, Callback, Context } from 'aws-lambda';
import { Writable } from 'node:stream';
export const awslambda = () => {
  let responseStream: Writable;
  responseStream = new Writable({
    write(chunk, encoding, callback) {
      console.log(chunk.toString());
      callback();
    },
  });

  return {
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
  };
};
