import { execa } from 'execa';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bin = resolve(__dirname, './bin.js');

describe('my-command', () => {
  it('should display the help contents', async () => {
    const { stdout } = await execa(bin, ['--help'], {
      env: { TS_NODE_FILES: 'true' },
    });

    expect(stdout).toContain('Usage: my-command [options]');
  });
});
