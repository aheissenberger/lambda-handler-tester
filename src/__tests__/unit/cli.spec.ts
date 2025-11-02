import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('cli', () => {
  it('should export main function', async () => {
    const cli = await import(resolve(__dirname, '../../cli'));

    expect(cli.main).toBeDefined();
    expect(typeof cli.main).toBe('function');
  });
});
