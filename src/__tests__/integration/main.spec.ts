import { execa } from 'execa';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const binPath = resolve(__dirname, '../../../bin/index.js');

describe('CLI integration', () => {
  it('should display help when --help flag is passed', async () => {
    const { stdout } = await execa('node', [binPath, '--help']);

    expect(stdout).toContain('Usage: lambda-handler-tester');
    expect(stdout).toContain('--handler');
    expect(stdout).toContain('--watch');
    expect(stdout).toContain('--fetch');
  });

  it('should display version when --version flag is passed', async () => {
    const { stdout } = await execa('node', [binPath, '--version']);

    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});
