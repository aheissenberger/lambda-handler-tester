import { Writable } from 'stream';

export class ResponseStream extends Writable {
  private response: Buffer;
  private silent: boolean;
  _contentType: string = 'text/html; charset=utf-8';
  _isBase64Encoded?: boolean;

  constructor({ silent } = { silent: false }) {
    super();
    this.response = Buffer.from('');
    this.silent = silent;
  }

  // @param chunk Chunk of data to unshift onto the read queue. For streams not operating in object mode, `chunk` must be a string, `Buffer`, `Uint8Array` or `null`. For object mode
  // streams, `chunk` may be any JavaScript value.
  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    const buf = Buffer.from(chunk, encoding);
    if (!this.silent) {
      process.stdout.write(buf.toString('utf-8'));
    }
    if (!this.response) {
      this.response = Buffer.from(buf);
    } else {
      this.response = Buffer.concat([this.response, buf]);
    }
    // Emit custom 'chunk' event for streaming consumers (watchServer)
    this.emit('chunk', buf);
    callback();
  }

  getBufferedData(): Buffer {
    //process.stdout.write(':' + this.response.toString() + ':' + '\n');
    return this.response;
  }

  setContentType(contentType: string) {
    this._contentType = contentType;
  }

  getContentType(): string {
    return this._contentType;
  }

  setIsBase64Encoded(isBase64Encoded: boolean) {
    this._isBase64Encoded = isBase64Encoded;
  }

  getIsBase64Encoded(): boolean {
    return this._isBase64Encoded || false;
  }
}
