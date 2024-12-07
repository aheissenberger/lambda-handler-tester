export const handler = awslambda.streamifyResponse(
    async (event, responseStream, context) => {
        responseStream.setContentType("text/plain");
        responseStream.write("Hello, world!");
        responseStream.end();
    }
);