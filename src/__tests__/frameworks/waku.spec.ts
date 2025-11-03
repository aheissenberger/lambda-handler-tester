import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  detectFramework,
  getFrameworkConfig,
} from '../../library/framework.ts';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const rootDir = 'src/__tests__/frameworks/waku';
describe('Waku Framework Tests', () => {
  describe('Unit Tests', () => {
    it('detect framework', () => {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = existsSync(packageJsonPath)
        ? JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        : { dependencies: {} };
      const framework = detectFramework(packageJson);
      expect(framework).toBe('waku');
    });
    it('get framework config', async () => {
      const config = await getFrameworkConfig('waku');
      expect(config.handler).toBe('dist/serve-aws-lambda.js');
    });
  });
});
