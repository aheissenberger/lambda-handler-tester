import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import eventHttpApi2 from './aws_events/httpapi2.js';
import { detectFramework, getDefaultHandlerPath } from './library/framework.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));

const version: string = packageJson.version;

const program = new Command();

program
  .version(version)
  .name('lambda-handler-tester')
  .option('-h, --handler [PATH]', 'path to request handler')
  .option('-e, --event [PATH]', 'path to an json file with a valid event')
  .option('-c, --context [PATH]', 'path to an json file with a valid context')
  .option('-p, --path [PATH]', 'path to request', '/')
  .option('-d, --debug', 'enables verbose logging', false)
  .parse(process.argv);

const options = program.opts();

let eventData = null;
let contextData = null;
let framework;
let handlerPath = options.handler;

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

const { handler } = await import(handlerPath);

const response = await handler(eventData, contextData);

console.log(response);
console.log('-'.repeat(80));
if (response?.isBase64Encoded === true) {
  console.log(Buffer.from(response.body, 'base64').toString());
}
process.exit(0);
