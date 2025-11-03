import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  detectFramework,
  getFrameworkConfig,
} from '../../library/framework.ts';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { main } from '../../cli.ts';

const rootDir = 'src/__tests__/frameworks/react-server';
describe('React Server Framework Tests', () => {
  describe('Unit Tests', () => {
    it('detect framework', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = existsSync(packageJsonPath)
        ? JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        : { dependencies: {} };
      const framework = detectFramework(packageJson);
      expect(framework).toBe('react-server');
    });
    it('get framework real config', async () => {
      const config = await getFrameworkConfig('react-server');
      expect(config.handler).toBe(
        '.aws-lambda/output/functions/index.func/index.mjs'
      );
      expect(config.apiGatewayV2).toBe(true);
      expect(config.cfOrp).toBe('AllViewerExceptHostHeader');
    });
    it('get framework config with streaming', async () => {
      const ports = {
        fs: {
          existsSync: vi.fn().mockReturnValue(true),
          readFileSync: vi.fn(),
        },
        path: {
          join: vi.fn(),
          resolve: vi.fn(),
          dirname: vi.fn(),
          basename: vi.fn(),
          extname: vi.fn(),
          relative: vi.fn(),
          normalize: vi.fn(),
          isAbsolute: vi.fn(),
          sep: '/',
          delimiter: ':',
        },
        import: vi.fn().mockResolvedValue({
          streaming: true,
        }),
      };

      const config = await getFrameworkConfig('react-server', undefined, ports);
      expect(config.handler).toBe(
        '.aws-lambda/output/functions/index.func/index.mjs'
      );
      expect(config.streaming).toBe(true);
      expect(config.apiGatewayV2).toBe(false);
      expect(config.cfOrp).toBe('AllViewerExceptHostHeader');
    });
  });
  describe('cli config merge', () => {
    beforeAll(() => {
      process.chdir(rootDir);
    });

    afterAll(() => {
      process.chdir('../../../..');
    });
    it('should detect react-server framework', async () => {
      const cmdLineArgs = [...process.argv, '--cfg-print'];
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(' '));
      try {
        await main(cmdLineArgs);
      } catch (error) {
        //console.error('Error occurred:', error);
      }
      console.log = originalLog;
      // Now you can assert on logs array
      const logsStr = logs.join('\n');
      expect(logsStr).toContain('Detected framework: react-server');
      expect(logsStr).toContain('Configuration:');
      const config = logsStr.substring(logsStr.indexOf('{'));

      const parsedConfig = JSON.parse(config);
      expect(parsedConfig.handler).toBe(
        '.aws-lambda/output/functions/index.func/index.mjs'
      );
      expect(parsedConfig.apiGatewayV2).toBe(true);
      expect(parsedConfig.cfOrp).toBe('AllViewerExceptHostHeader');
    });

    it('should overwrite handler path', async () => {
      const handlerPath = 'new/handler/path.js';
      const cmdLineArgs = [
        ...process.argv,
        '--cfg-print',
        '--handler',
        handlerPath,
      ];
      const originalLog = console;
      const logs: { log: string[]; warn: string[]; error: string[] } = {
        log: [],
        warn: [],
        error: [],
      };
      console.log = (...args) => logs.log.push(args.join(' '));
      console.warn = (...args) => logs.warn.push(args.join(' '));
      console.error = (...args) => logs.error.push(args.join(' '));
      try {
        await main(cmdLineArgs);
      } catch (error) {
        //console.error('Error occurred:', error);
      }
      console = originalLog;
      // Now you can assert on logs array
      const logsStr = logs.log.join('\n');
      expect(logsStr).toContain('Detected framework: react-server');
      expect(logsStr).toContain('Configuration:');
      const config = logsStr.substring(logsStr.indexOf('{'));

      const parsedConfig = JSON.parse(config);
      expect(parsedConfig.handler).toBe(handlerPath);
      expect(parsedConfig.apiGatewayV2).toBeUndefined();
      expect(parsedConfig.cfOrp).toBeUndefined();

      expect(logs.warn.join(' ')).toContain(
        'Warning: Provided handler path does not exist'
      );
    });
  });
});
