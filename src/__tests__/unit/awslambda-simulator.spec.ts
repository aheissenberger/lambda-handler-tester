import { awslambdaSimulator } from '../../library/awslambda-simulator.js';
import { ResponseStream } from '../../library/ResponseStream.js';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

describe('AWS Lambda Simulator', () => {
  const mockEvent: APIGatewayProxyEventV2 = {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/test',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/test',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-id',
      routeKey: '$default',
      stage: '$default',
      time: 'test-time',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
  };

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: 'log-group',
    logStreamName: 'log-stream',
    getRemainingTimeInMillis: () => 3000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  describe('streamifyResponse', () => {
    it('should create streamifyResponse function', () => {
      const sim = awslambdaSimulator(true);
      expect(sim.awslambda.streamifyResponse).toBeDefined();
      expect(typeof sim.awslambda.streamifyResponse).toBe('function');
    });

    it('should wrap handler and return response stream', async () => {
      const sim = awslambdaSimulator(true);

      const handler = async (
        event: APIGatewayProxyEventV2,
        responseStream: any,
        context: Context
      ) => {
        responseStream.write('test response');
        responseStream.end();
      };

      const wrappedHandler = sim.awslambda.streamifyResponse(handler);
      const result = await wrappedHandler(mockEvent, mockContext);

      expect(result).toBeInstanceOf(ResponseStream);
    });

    it('should pass event and context to handler', async () => {
      const sim = awslambdaSimulator(true);
      let receivedEvent: any;
      let receivedContext: any;

      const handler = async (
        event: APIGatewayProxyEventV2,
        responseStream: any,
        context: Context
      ) => {
        receivedEvent = event;
        receivedContext = context;
        responseStream.end();
      };

      const wrappedHandler = sim.awslambda.streamifyResponse(handler);
      await wrappedHandler(mockEvent, mockContext);

      expect(receivedEvent).toBe(mockEvent);
      expect(receivedContext).toBe(mockContext);
    });
  });

  describe('HttpResponseStream', () => {
    it('should provide HttpResponseStream.from method', () => {
      const sim = awslambdaSimulator(true);
      expect(sim.awslambda.HttpResponseStream).toBeDefined();
      expect(sim.awslambda.HttpResponseStream.from).toBeDefined();
      expect(typeof sim.awslambda.HttpResponseStream.from).toBe('function');
    });

    it('should set content type from metadata', () => {
      const sim = awslambdaSimulator(true);
      const stream = new ResponseStream({ silent: true });
      const metadata = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      sim.awslambda.HttpResponseStream.from(stream, metadata);

      expect(stream._contentType).toBe('application/json');
    });

    it('should store status code in stream', () => {
      const sim = awslambdaSimulator(true);
      const stream = new ResponseStream({ silent: true });
      const metadata = {
        statusCode: 404,
        headers: {},
      };

      sim.awslambda.HttpResponseStream.from(stream, metadata);

      expect((stream as any)._statusCode).toBe(404);
    });

    it('should store all headers in stream', () => {
      const sim = awslambdaSimulator(true);
      const stream = new ResponseStream({ silent: true });
      const metadata = {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Custom-Header': 'value',
        },
      };

      sim.awslambda.HttpResponseStream.from(stream, metadata);

      expect((stream as any)._headers).toEqual(metadata.headers);
    });

    it('should return the stream', () => {
      const sim = awslambdaSimulator(true);
      const stream = new ResponseStream({ silent: true });
      const metadata = { statusCode: 200, headers: {} };

      const result = sim.awslambda.HttpResponseStream.from(stream, metadata);

      expect(result).toBe(stream);
    });
  });

  describe('streamifyHandler', () => {
    it('should create streamifyHandler function', () => {
      const sim = awslambdaSimulator(true);
      expect(sim.streamifyHandler).toBeDefined();
      expect(typeof sim.streamifyHandler).toBe('function');
    });

    it('should wrap handler and return buffered string', async () => {
      const sim = awslambdaSimulator(true);

      const handler = async (
        event: APIGatewayProxyEventV2,
        responseStream: any,
        context: Context
      ) => {
        responseStream.write('Hello ');
        responseStream.write('World');
        responseStream.end();
      };

      const wrappedHandler = sim.streamifyHandler(handler);
      const result = await wrappedHandler(mockEvent, mockContext);

      expect(result).toBe('Hello World');
    });

    it('should wait for stream to finish', async () => {
      const sim = awslambdaSimulator(true);
      let streamFinished = false;

      const handler = async (
        event: APIGatewayProxyEventV2,
        responseStream: any,
        context: Context
      ) => {
        responseStream.write('data');
        setTimeout(() => {
          streamFinished = true;
          responseStream.end();
        }, 10);
      };

      const wrappedHandler = sim.streamifyHandler(handler);
      await wrappedHandler(mockEvent, mockContext);

      expect(streamFinished).toBe(true);
    });

    it('should handle empty response', async () => {
      const sim = awslambdaSimulator(true);

      const handler = async (
        event: APIGatewayProxyEventV2,
        responseStream: any,
        context: Context
      ) => {
        responseStream.end();
      };

      const wrappedHandler = sim.streamifyHandler(handler);
      const result = await wrappedHandler(mockEvent, mockContext);

      expect(result).toBe('');
    });
  });

  describe('silent mode', () => {
    it('should create simulator in silent mode', () => {
      const sim = awslambdaSimulator(true);
      expect(sim).toBeDefined();
      expect(sim.awslambda).toBeDefined();
    });

    it('should create simulator in non-silent mode', () => {
      const sim = awslambdaSimulator(false);
      expect(sim).toBeDefined();
      expect(sim.awslambda).toBeDefined();
    });
  });
});
