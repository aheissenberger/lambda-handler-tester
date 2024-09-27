const awslambda = {
    streamifyResponse: handler => async (event, context) => {
        const responseStream = new ResponseStream();
        await handler(event, responseStream, context);
        return responseStream;
    }
};
class ResponseStream {
    constructor() {
        this.contentType = "application/json";
        this.body = "";
    }
    setContentType(contentType) {
        this.contentType = contentType;
    }
    write(chunk) {
        this.body += chunk;
    }
    end() {
        console.log(this.body);
    }
}


const handler = awslambda.streamifyResponse(
    async (event, responseStream, context) => {
        responseStream.setContentType("text/plain");
        responseStream.write("Hello, world!");
        responseStream.end();
    }
);

await handler({}, {});
