/**
 * Example Lambda handler for testing the watch server
 * This handler demonstrates how to work with API Gateway V2 events
 */

export const handler = async (event, _context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const { rawPath, requestContext, queryStringParameters, body, headers, cookies } = event;
    const method = requestContext.http.method;

    // Example: Simple routing based on path and method
    if (rawPath === '/' && method === 'GET') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
            },
            body: `
        <!DOCTYPE html>
        <html>
          <head><title>Lambda Handler Test</title></head>
          <body>
            <h1>Lambda Handler Test Server</h1>
            <p>This is running via the watch server!</p>
            <h2>Test endpoints:</h2>
            <ul>
              <li><a href="/hello">GET /hello</a></li>
              <li><a href="/api/data">GET /api/data</a></li>
              <li><a href="/echo?message=test">GET /echo?message=test</a></li>
            </ul>
            <h2>Test POST:</h2>
            <form method="POST" action="/api/submit">
              <input name="data" placeholder="Enter data" />
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>
      `,
        };
    }

    if (rawPath === '/hello') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Hello from Lambda!',
                timestamp: new Date().toISOString(),
            }),
        };
    }

    if (rawPath === '/api/data') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: [1, 2, 3, 4, 5],
                message: 'Sample data',
            }),
        };
    }

    if (rawPath === '/echo') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                method,
                path: rawPath,
                queryStringParameters,
                cookies,
                headers,
            }),
        };
    }

    if (rawPath === '/api/submit' && method === 'POST') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Data received!',
                receivedBody: body,
                contentType: headers['content-type'],
            }),
        };
    }

    // Default 404 response
    return {
        statusCode: 404,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            error: 'Not Found',
            path: rawPath,
            method,
        }),
    };
};
