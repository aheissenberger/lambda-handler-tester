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
    if (packageJson.dependencies['@lazarv/react-server']) {
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
