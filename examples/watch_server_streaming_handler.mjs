/**
 * Example streaming Lambda handler for testing the watch server
 * This handler demonstrates AWS Lambda streaming response using awslambda.streamifyResponse
 */

export const handler = awslambda.streamifyResponse(
    async (event, responseStream, _context) => {
        console.log('Received streaming event:', JSON.stringify(event, null, 2));

        const { rawPath, requestContext, queryStringParameters } = event;
        const method = requestContext.http.method;

        // Example: Simple HTML streaming
        if (rawPath === '/' && method === 'GET') {
            responseStream.write('<!DOCTYPE html>\n');
            responseStream.write('<html>\n');
            responseStream.write('<head><title>Streaming Lambda Handler</title></head>\n');
            responseStream.write('<body>\n');
            responseStream.write('<h1>Lambda Streaming Response</h1>\n');
            responseStream.write('<p>This content is streamed chunk by chunk!</p>\n');

            // Simulate streaming data
            for (let i = 1; i <= 5; i++) {
                responseStream.write(`<p>Chunk ${i} - Time: ${new Date().toISOString()}</p>\n`);
                // In a real scenario, you might have async operations here
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            responseStream.write('<h2>Test endpoints:</h2>\n');
            responseStream.write('<ul>\n');
            responseStream.write('  <li><a href="/stream/json">Stream JSON data</a></li>\n');
            responseStream.write('  <li><a href="/stream/text">Stream text data</a></li>\n');
            responseStream.write('  <li><a href="/stream/sse">Server-Sent Events</a></li>\n');
            responseStream.write('</ul>\n');
            responseStream.write('</body>\n');
            responseStream.write('</html>\n');
            responseStream.end();
            return;
        }

        // Example: Streaming JSON array
        if (rawPath === '/stream/json') {
            const metadata = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

            responseStream.write('[\n');
            for (let i = 1; i <= 10; i++) {
                const item = {
                    id: i,
                    name: `Item ${i}`,
                    timestamp: new Date().toISOString(),
                };
                responseStream.write(JSON.stringify(item));
                if (i < 10) {
                    responseStream.write(',\n');
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            responseStream.write('\n]');
            responseStream.end();
            return;
        }

        // Example: Streaming plain text
        if (rawPath === '/stream/text') {
            const metadata = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/plain',
                },
            };
            responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

            const lines = [
                'This is a streaming text response.\n',
                'Each line is sent as it becomes available.\n',
                '\n',
                'Processing data...\n',
            ];

            for (const line of lines) {
                responseStream.write(line);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            for (let i = 1; i <= 5; i++) {
                responseStream.write(`Progress: ${i * 20}%\n`);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            responseStream.write('\nDone!\n');
            responseStream.end();
            return;
        }

        // Example: Server-Sent Events (SSE)
        if (rawPath === '/stream/sse') {
            const metadata = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            };
            responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

            // Send SSE messages
            for (let i = 1; i <= 5; i++) {
                const eventData = {
                    id: i,
                    message: `Event ${i}`,
                    timestamp: new Date().toISOString(),
                };
                responseStream.write(`event: message\n`);
                responseStream.write(`id: ${i}\n`);
                responseStream.write(`data: ${JSON.stringify(eventData)}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            responseStream.write('event: done\n');
            responseStream.write('data: {"message": "Stream complete"}\n\n');
            responseStream.end();
            return;
        }

        // Example: Echo with query parameters
        if (rawPath === '/stream/echo') {
            const metadata = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

            const response = {
                path: rawPath,
                method,
                queryStringParameters,
                message: 'This is a streaming echo response',
            };

            responseStream.write(JSON.stringify(response, null, 2));
            responseStream.end();
            return;
        }

        // Default 404 response
        const metadata = {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
        responseStream.write(JSON.stringify({
            error: 'Not Found',
            path: rawPath,
            method,
        }));
        responseStream.end();
    }
);
