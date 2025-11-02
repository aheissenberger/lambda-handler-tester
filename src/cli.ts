import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import eventHttpApi2 from './aws_events/httpapi2.ts';
import { detectFramework, getDefaultHandlerPath } from './library/framework.ts';
import { resolve } from 'node:path';
import { awslambdaSimulator } from './library/awslambda-simulator.ts';
import chalk from 'chalk';
import { Performance } from './library/performanceObserver.ts';
import prettyMs from 'pretty-ms';
import { startWatchServer } from './library/watchServer.ts';
import { urlToApiGatewayV2Event } from './library/urlToApiGatewayV2.ts';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const toolPackageJsonPath = `${__dirname}/../package.json`;

  if (!existsSync(toolPackageJsonPath)) {
    console.error('Error: tool package.json not found!');
    process.exit(1);
  }
  const toolPackageJson = JSON.parse(
    readFileSync(toolPackageJsonPath, 'utf-8')
  );

  const version: string = toolPackageJson.version;

  const packageJsonPath = `package.json`;
  const packageJson = existsSync(packageJsonPath)
    ? JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    : { dependencies: {} };

  const program = new Command();
  const error = chalk.bold.red;
  const warning = chalk.hex('#FFA500'); // Orange color

  function myParseInt(value: string) {
    // parseInt takes a string and a radix
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
      throw 'Not a number.';
    }
    return parsedValue;
  }

  program
    .version(version)
    .name('lambda-handler-tester')
    .option('--handler [PATH]', 'path to request handler')
    .option('-s, --streaming', 'streaming handler', false)
    .option('-e, --event [PATH]', 'path to an json file with a valid event')
    .option('-c, --context [PATH]', 'path to an json file with a valid context')
    .option('-p, --path [PATH]', 'path to request', '/')
    .option('--decode-base64', 'decode base64 body', false)
    .option('--header', 'only show header without body', false)
    .option('-v, --verbose', 'enables verbose logging', false)
    .option('--response-time', 'measure the response time', false)
    .option(
      '--profile-cpu',
      'profile JavaScript CPU usage to "aws-lambda-handler.cpuprofile"',
      false
    )
    .option('--repeat <number>', 'repeat request [n] times', myParseInt, 1)
    .option('--silent', 'no output', false)
    .option('-d, --debug', 'enables verbose logging', false)
    .option(
      '-w, --watch <port>',
      'start HTTP server on port and watch for requests',
      myParseInt
    )
    .option(
      '--fetch <url>',
      'fetch URL and convert to API Gateway V2 GET event'
    )
    .option(
      '--cf-orp <name>',
      'simulate CloudFront Origin Request Policy (supported: AllViewerExceptHostHeader)'
    )
    .option(
      '--api-gateway-v2',
      'add API Gateway V2 host header (use with --cf-orp)',
      false
    )
    .parse(process.argv);

  const options = program.opts();

  // Build CloudFront Origin Request Policy options
  let cfOrpOptions = undefined;
  if (options.cfOrp) {
    if (options.cfOrp !== 'AllViewerExceptHostHeader') {
      console.error(
        chalk.red(
          `Error: Unsupported CloudFront Origin Request Policy: ${options.cfOrp}`
        )
      );
      console.error(
        chalk.yellow('Supported policies: AllViewerExceptHostHeader')
      );
      process.exit(1);
    }
    cfOrpOptions = {
      policy: options.cfOrp,
      addApiGatewayV2Host: options.apiGatewayV2 === true,
    };
  }

  let eventData = null;
  let contextData = null;
  let framework;
  let handlerPath = options.handler;
  let awsLambdaSimulator;

  if (handlerPath) {
    if (!existsSync(handlerPath)) {
      console.error(`Error: handler file not found: ${handlerPath}`);
      process.exit(1);
    }
  } else {
    framework = detectFramework(packageJson);
    if (framework === undefined) {
      console.error('Error: unknown framework! Please provide a handler path');
      process.exit(1);
    }
    handlerPath = getDefaultHandlerPath(framework);
  }
  const queryPath = options.path;

  if (options.event) {
    const eventPath = options.event;
    if (!existsSync(eventPath)) {
      console.error(`Error: event file not found: ${eventPath}`);
      process.exit(1);
    }
    try {
      eventData = JSON.parse(readFileSync(eventPath, { encoding: 'utf-8' }));
    } catch (e) {
      console.error(`Error: invalid JSON: ${eventPath}`);
      process.exit(1);
    }
  } else if (options.fetch) {
    // Convert URL to API Gateway V2 event
    try {
      eventData = urlToApiGatewayV2Event(options.fetch, {
        cfOrp: cfOrpOptions,
      });
      if (options.verbose) {
        console.log(chalk.blue(`Fetching URL: ${options.fetch}`));
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      process.exit(1);
    }
  } else {
    eventData = eventHttpApi2(queryPath);
  }

  if (options.context) {
    const contextPath = options.context;
    if (!existsSync(contextPath)) {
      console.error(`Error: context file not found: ${contextPath}`);
      process.exit(1);
    }
    try {
      contextData = JSON.parse(
        readFileSync(contextPath, { encoding: 'utf-8' })
      );
    } catch (e) {
      console.error(`Error: invalid JSON: ${contextPath}`);
      process.exit(1);
    }
  }

  if (options.debug) {
    console.log('Options:', options);
    console.log('handlerPath:', handlerPath);
    console.log('streaming:', options.streaming);
  }

  if (options.verbose) {
    console.log('Event:', eventData);
    console.log('Context:', contextData);
  }

  if (options.streaming) {
    awsLambdaSimulator = awslambdaSimulator(
      options.silent || options.responseTime
    );
    (globalThis as any).awslambda = awsLambdaSimulator.awslambda;
  }

  const perfObserver = new Performance(options.responseTime);

  // Set NODE_ENV to production for handler execution
  process.env.NODE_ENV = 'production';

  try {
    const { handler: handlerImported } = await import(resolve(handlerPath));

    const handler = options.streaming
      ? awsLambdaSimulator?.streamifyHandler(handlerImported)
      : options.profileCpu
        ? (eventData: any, contextData: any) => {
            console.profile('aws-lambda-handler');
            const result = handlerImported(eventData, contextData);
            console.profileEnd('aws-lambda-handler');
            return result;
          }
        : handlerImported;

    // Watch mode - start HTTP server
    if (options.watch) {
      console.log(
        chalk.blue(`Starting watch mode on port ${options.watch}...`)
      );
      startWatchServer({
        port: options.watch,
        handler,
        verbose: options.verbose || options.debug,
        contextData,
        streaming: options.streaming,
        httpToApiGatewayV2Options: {
          cfOrp: cfOrpOptions,
        },
      });
      // Watch mode runs indefinitely, so we return here
      return;
    }

    const handlerWrapped = perfObserver.timerify(handler);

    let responseData;

    responseData = await handlerWrapped(eventData, contextData);
    if (options.responseTime) {
      await perfObserver.finalize();
      console.log(`\nFirst run:`);
      console.log(perfObserver.getTable());
      perfObserver.reset();
      perfObserver.init();
    }

    if (options.repeat > 1) {
      process.stdout.write(`\nRepeat ${options.repeat - 1} times: `);
      for (let i = 1; i < options.repeat; i++) {
        const progress = Math.floor((i / options.repeat) * 100);
        if (progress % 10 === 0) {
          process.stdout.write(` ${String(progress).padStart(3, ' ')}%`);
          process.stdout.write('\x1b[5D'); // Move cursor 4 characters left
        }
        responseData = await handlerWrapped(eventData, contextData);
      }
      process.stdout.write(` 100%\n`);
    }

    if (options.responseTime) {
      await perfObserver.finalize();
      console.log(perfObserver.getTable());
      console.log('Total running time:', prettyMs(perfObserver.getTotalTime()));
    }
    if (options.silent || options.responseTime) process.exit(0);

    const isBase64Encoded = responseData?.isBase64Encoded === true;

    if (options.header) {
      if (responseData.body) delete responseData.body;
      console.log(responseData);
      process.exit(0);
    }

    if (isBase64Encoded) {
      responseData.isBase64Encoded = false;
      responseData.body = Buffer.from(responseData.body, 'base64').toString();
    }

    if (options.verbose) {
      console.log(responseData);
      if (isBase64Encoded) {
        console.log(
          warning(
            chalk.bold('⚠️ Note:') + 'The original response was base64 encoded!'
          )
        );
      }
    } else {
      console.log(responseData?.body ?? '');
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

// Only run main() when executed directly (not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
