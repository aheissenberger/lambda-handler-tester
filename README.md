# lambda-handler-tester

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> My awesome command-line tool

## Install

```bash
npm install lambda-handler-tester
```

## Usage

```bash
Usage: lambda-handler-tester [options]

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
  --silent              no output (default: false)
  -d, --debug           enables verbose logging (default: false)
  -h, --help            display help for command

Examples:

  $ my-command --version
  1.0.0
```

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
