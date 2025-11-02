import { ResponseStream } from '../../library/ResponseStream.js';

describe('ResponseStream', () => {
  describe('constructor', () => {
    it('should create stream with silent mode disabled by default', () => {
      const stream = new ResponseStream();
      expect(stream['silent']).toBe(false);
      expect(stream.getBufferedData().length).toBe(0);
    });

    it('should create stream with silent mode enabled', () => {
      const stream = new ResponseStream({ silent: true });
      expect(stream['silent']).toBe(true);
      expect(stream.getBufferedData().length).toBe(0);
    });
  });

  describe('_write', () => {
    it('should buffer data when writing', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write('test data');
      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().toString()).toBe('test data');
          resolve();
        });
      });
    });

    it('should concatenate multiple writes', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write('hello ');
      stream.write('world');
      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().toString()).toBe('hello world');
          resolve();
        });
      });
    });

    it('should handle Buffer input', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write(Buffer.from('test'));
      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().toString()).toBe('test');
          resolve();
        });
      });
    });

    it('should handle empty writes', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write('');
      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().toString()).toBe('');
          resolve();
        });
      });
    });

    it('should handle UTF-8 encoding', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write('Hello 世界 🌍', 'utf-8');
      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().toString()).toBe('Hello 世界 🌍');
          resolve();
        });
      });
    });
  });

  describe('getBufferedData', () => {
    it('should return empty buffer for new stream', () => {
      const stream = new ResponseStream({ silent: true });
      const buffer = stream.getBufferedData();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(0);
    });

    it('should return complete buffered data', async () => {
      const stream = new ResponseStream({ silent: true });
      stream.write('part1');
      stream.write('part2');
      stream.write('part3');
      await new Promise<void>(resolve => {
        stream.end(() => {
          const buffer = stream.getBufferedData();
          expect(buffer.toString()).toBe('part1part2part3');
          resolve();
        });
      });
    });
  });

  describe('setContentType', () => {
    it('should set content type', () => {
      const stream = new ResponseStream({ silent: true });
      stream.setContentType('application/json');
      expect(stream._contentType).toBe('application/json');
    });

    it('should update content type', () => {
      const stream = new ResponseStream({ silent: true });
      stream.setContentType('text/plain');
      expect(stream._contentType).toBe('text/plain');
      stream.setContentType('text/html');
      expect(stream._contentType).toBe('text/html');
    });

    it('should handle various content types', () => {
      const stream = new ResponseStream({ silent: true });

      stream.setContentType('application/json');
      expect(stream._contentType).toBe('application/json');

      stream.setContentType('text/html; charset=utf-8');
      expect(stream._contentType).toBe('text/html; charset=utf-8');

      stream.setContentType('image/png');
      expect(stream._contentType).toBe('image/png');
    });
  });

  describe('setIsBase64Encoded', () => {
    it('should set base64 encoded flag to true', () => {
      const stream = new ResponseStream({ silent: true });
      stream.setIsBase64Encoded(true);
      expect(stream._isBase64Encoded).toBe(true);
    });

    it('should set base64 encoded flag to false', () => {
      const stream = new ResponseStream({ silent: true });
      stream.setIsBase64Encoded(false);
      expect(stream._isBase64Encoded).toBe(false);
    });

    it('should toggle base64 encoded flag', () => {
      const stream = new ResponseStream({ silent: true });
      stream.setIsBase64Encoded(true);
      expect(stream._isBase64Encoded).toBe(true);
      stream.setIsBase64Encoded(false);
      expect(stream._isBase64Encoded).toBe(false);
    });
  });

  describe('stream behavior', () => {
    it('should be a writable stream', () => {
      const stream = new ResponseStream({ silent: true });
      expect(stream.writable).toBe(true);
    });

    it('should emit finish event on end', async () => {
      const stream = new ResponseStream({ silent: true });
      await new Promise<void>(resolve => {
        stream.on('finish', () => {
          resolve();
        });
        stream.end('data');
      });
    });

    it('should handle backpressure', async () => {
      const stream = new ResponseStream({ silent: true });
      let canWrite = true;

      for (let i = 0; i < 100; i++) {
        canWrite = stream.write('x'.repeat(1000));
      }

      await new Promise<void>(resolve => {
        stream.end(() => {
          expect(stream.getBufferedData().length).toBe(100000);
          resolve();
        });
      });
    });
  });
});
