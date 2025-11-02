import {
  detectFramework,
  getDefaultHandlerPath,
} from '../../library/framework.js';

describe('Framework Detection', () => {
  describe('detectFramework', () => {
    it('should detect waku framework', () => {
      const packageJson = {
        dependencies: {
          waku: '^1.0.0',
        },
      };
      expect(detectFramework(packageJson)).toBe('waku');
    });

    it('should detect vike framework', () => {
      const packageJson = {
        dependencies: {
          vike: '^0.4.0',
        },
      };
      expect(detectFramework(packageJson)).toBe('vike');
    });

    it('should detect react-server framework', () => {
      const packageJson = {
        dependencies: {
          '@lazarv/react-server': '^1.0.0',
        },
      };
      expect(detectFramework(packageJson)).toBe('react-server');
    });

    it('should return undefined for unknown framework', () => {
      const packageJson = {
        dependencies: {
          express: '^4.18.0',
          react: '^18.0.0',
        },
      };
      expect(detectFramework(packageJson)).toBeUndefined();
    });

    it('should return undefined when dependencies is empty', () => {
      const packageJson = {
        dependencies: {},
      };
      expect(detectFramework(packageJson)).toBeUndefined();
    });

    it('should prioritize waku over other frameworks', () => {
      const packageJson = {
        dependencies: {
          waku: '^1.0.0',
          vike: '^0.4.0',
        },
      };
      expect(detectFramework(packageJson)).toBe('waku');
    });

    it('should prioritize vike over react-server', () => {
      const packageJson = {
        dependencies: {
          vike: '^0.4.0',
          '@lazarv/react-server': '^1.0.0',
        },
      };
      expect(detectFramework(packageJson)).toBe('vike');
    });
  });

  describe('getDefaultHandlerPath', () => {
    it('should return correct path for waku', () => {
      expect(getDefaultHandlerPath('waku')).toBe('dist/serve-aws-lambda.js');
    });

    it('should return correct path for vike', () => {
      expect(getDefaultHandlerPath('vike')).toBe('entry_aws_lambda.ts');
    });

    it('should return correct path for react-server', () => {
      expect(getDefaultHandlerPath('react-server')).toBe(
        '.aws-lambda/output/functions/index.func/index.mjs'
      );
    });

    it('should return default handler.js for undefined framework', () => {
      expect(getDefaultHandlerPath(undefined)).toBe('handler.js');
    });

    it('should return default handler.js for unknown framework', () => {
      // @ts-expect-error Testing invalid input
      expect(getDefaultHandlerPath('unknown-framework')).toBe('handler.js');
    });
  });
});
