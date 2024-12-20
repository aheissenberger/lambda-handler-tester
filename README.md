# lambda-handler-tester

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> Test AWS Lambda handler built with javascript on the command line. This tool loads the javascript and call the handler function with the provided event data. Handler which can handler streaming are supported when using the flag `-s`.

## Usage

```bash
Usage: pnpm dlx lambda-handler-tester [options]

Options:
  -V, --version         output the version number
  --handler [PATH]      path to request handler
  -s, --streaming       streaming handler (default: false)
  -e, --event [PATH]    path to an json file with a valid event
  -c, --context [PATH]  path to an json file with a valid context
  -p, --path [PATH]     path to request (default: "/")
  --decode-base64       decode base64 body (default: false)
  --header              only show header without body (default: false)
  -v, --verbose         enables verbose logging (default: false)
  --response-time       measure the response time (default: false)
  --repeat <number>     repeat request [n] times (default: 1)
  --profile-cpu         profile JavaScript CPU usage to "aws-lambda-handler.cpuprofile" (default: false)
  --silent              no output (default: false)
  -d, --debug           enables verbose logging (default: false)
  -h, --help            display help for command

Examples:

  $ pnpm dlx lambda-handler-tester
  0.0.xx-development
```

### Framework detection

These frameworks are detected:

- [@lazarv/react-server](https://react-server.dev)
- [Waku](https://waku.gg)
- [Vike](https://vike.dev)

If your network is not detected you will need to provide the path to the file with the AWS Lambda Handler:
`$ pnpm dlx lambda-handler-tester --handler ./aws-lambda-output/handler.mjs`

### Options

#### Measure Response Time

The option `--response-time` together with the option `--repeat <number>` allows to measure response time for first and repeated calls.

**Report:**

```
First run:
Name  size  min   max   median  sum
----  ----  ----  ----  ------  ----
         1  2.24  2.24    2.24  2.24

Repeat 100 times:  100%
Name  size  min   max   median  sum
----  ----  ----  ----  ------  ----
       100  0.02  0.75    0.02  4.78
Total running time: 5ms
```

#### JavaScript CPU Profile

The option `--profile-cpu` allows to profile the CPU usage of the handler to the file `aws-lambda-handler.cpuprofile`. The handler needs to be [called from NodeJS](https://nodejs.org/api/console.html#inspector-only-methods) with the `--inspect` flag to generate the file or at least run in a VS Code JavaScript Debug Terminal.

> **Streaming** handlers are not supported!

[build-img]: https://github.com/ryansonshine/typescript-npm-cli-template/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/ryansonshine/typescript-npm-cli-template/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/typescript-npm-cli-template
[downloads-url]: https://www.npmtrends.com/typescript-npm-cli-template
[npm-img]: https://img.shields.io/npm/v/typescript-npm-cli-template
[npm-url]: https://www.npmjs.com/package/typescript-npm-cli-template
[issues-img]: https://img.shields.io/github/issues/ryansonshine/typescript-npm-cli-template
[issues-url]: https://github.com/ryansonshine/typescript-npm-cli-template/issues
[codecov-img]: https://codecov.io/gh/ryansonshine/typescript-npm-cli-template/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/ryansonshine/typescript-npm-cli-template
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
