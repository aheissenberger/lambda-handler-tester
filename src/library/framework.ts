import fs from 'fs';
import path, { join } from 'path';

type framework = 'waku' | 'vike' | 'react-server' | undefined;

type packageJson = {
  dependencies: {
    [key: string]: string;
  };
};

export function detectFramework(packageJson: packageJson): framework {
  if (packageJson.dependencies) {
    if (packageJson.dependencies['waku']) {
      return 'waku';
    }
    if (packageJson.dependencies['vike']) {
      return 'vike';
    }
    if (packageJson.dependencies['@lazarv/react-server-adapter-aws-lambda']) {
      return 'react-server';
    }
  }
  return undefined;
}

export function getDefaultHandlerPath(framework: framework): string {
  switch (framework) {
    case 'waku':
      return 'dist/serve-aws-lambda.js';
    case 'vike':
      return 'entry_aws_lambda.ts';
    case 'react-server':
      return '.aws-lambda/output/functions/index.func/index.mjs';
    default:
      return 'handler.js';
  }
}

export type CliConfig = {
  handler: string;
  apiGatewayV2?: boolean;
  cfOrp?: string;
};
export async function getFrameworkConfig(
  framework: framework,
  handlerPath?: string
): Promise<CliConfig> {
  switch (framework) {
    case 'waku':
      return { handler: 'dist/serve-aws-lambda.js' };
    case 'vike':
      return { handler: 'entry_aws_lambda.ts' };
    case 'react-server':
      let configDir = '.aws-lambda/output/functions/index.func/';
      if (typeof handlerPath === 'string' && handlerPath.length > 0) {
        if (fs.existsSync(handlerPath)) {
          configDir = path.dirname(handlerPath);
        } else {
          console.warn('Warning: Provided handler path does not exist!');
          return { handler: handlerPath };
        }
      }
      let cliOptions = {
        handler:
          handlerPath ?? '.aws-lambda/output/functions/index.func/index.mjs',
        apiGatewayV2: true,
        cfOrp: 'AllViewerExceptHostHeader',
        streaming: false,
      };
      try {
        const configPath = join(configDir, 'adapter.config.mjs');
        if (fs.existsSync(configPath)) {
          const adapterConfig = await import(path.resolve(configPath));
          if (adapterConfig && adapterConfig.streaming === true) {
            cliOptions.apiGatewayV2 = false;
            cliOptions.streaming = true;
          }
        }
      } catch (e) {
        console.warn(
          'Warning: Failed to read adapter.config.mjs for react-server: ' +
            (e instanceof Error ? e.message : String(e))
        );
      }
      return cliOptions;
    default:
      return { handler: 'handler.js' };
  }
}
