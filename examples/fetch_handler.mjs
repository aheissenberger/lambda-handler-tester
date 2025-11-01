/**
 * Example handler for testing the --fetch feature
 * This handler extracts information from the API Gateway V2 event
 */

export const handler = async (event) => {
    const { rawPath, rawQueryString, queryStringParameters, headers, requestContext } = event;

    // Build the full URL from the event
    const protocol = headers['x-forwarded-proto'] || 'http';
    const host = headers.host;
    const fullUrl = `${protocol}://${host}${rawPath}${rawQueryString ? '?' + rawQueryString : ''}`;

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'URL Fetch Handler',
            url: fullUrl,
            method: requestContext.http.method,
            path: rawPath,
            queryString: rawQueryString,
            queryParameters: queryStringParameters,
            host: host,
            userAgent: requestContext.http.userAgent,
            extractedData: {
                hostname: host.split(':')[0],
                pathname: rawPath,
                search: rawQueryString ? '?' + rawQueryString : '',
            }
        }, null, 2),
    };
};
