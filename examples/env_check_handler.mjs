/**
 * Test handler to verify NODE_ENV is set correctly
 */

export const handler = async (_event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Environment check',
            NODE_ENV: process.env.NODE_ENV,
            environment: {
                isProduction: process.env.NODE_ENV === 'production',
                allEnvVars: Object.keys(process.env).length,
            }
        }, null, 2),
    };
};
