import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import eventHttpApi2 from './aws_events/httpapi2.js';
import { detectFramework, getDefaultHandlerPath } from './library/framework.js';
import { resolve } from 'node:path';
import { awslambdaSimulator } from './library/awslambda-simulator.js';
import chalk from 'chalk';
import { Performance } from './library/performanceObserver.js';
import prettyMs from 'pretty-ms';

if (!existsSync('package.json')) {
  console.error('Error: package.json not found!');
  process.exit(1);
}
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));

const version: string = packageJson.version;

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
  .option('--repeat <number>', 'repeat request [n] times', myParseInt, 1)
  .option('--silent', 'no output', false)
  .option('-d, --debug', 'enables verbose logging', false)
  .parse(process.argv);

const options = program.opts();

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
    contextData = JSON.parse(readFileSync(contextPath, { encoding: 'utf-8' }));
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

try {
  const { handler: handlerImported } = await import(resolve(handlerPath));

  const handler = options.streaming
    ? awsLambdaSimulator?.streamifyHandler(handlerImported)
    : handlerImported;

  const handlerWrapped = perfObserver.timerify(handler);

  let responseData;

  responseData = await handlerWrapped(eventData, contextData);
  for (let i = 1; i < options.repeat; i++) {
    responseData = await handlerWrapped(eventData, contextData);
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
