import { Stream } from 'stream';

export class ResponseStream extends Stream.Writable {
  private response: Buffer;
  private silent: boolean;
  _contentType?: string;
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
    if (!this.silent) {
      const data = Buffer.from(chunk, encoding).toString('utf-8');
      process.stdout.write(data);
    }
    if (!this.response) {
      this.response = Buffer.from(chunk, encoding);
    } else {
      this.response = Buffer.concat([
        this.response,
        Buffer.from(chunk, encoding),
      ]);
    }
    callback();
  }

  getBufferedData(): Buffer {
    //process.stdout.write(':' + this.response.toString() + ':' + '\n');
    return this.response;
  }

  setContentType(contentType: string) {
    this._contentType = contentType;
  }

  setIsBase64Encoded(isBase64Encoded: boolean) {
    this._isBase64Encoded = isBase64Encoded;
  }
}
