// Quick test to verify ResponseStream events
import { ResponseStream } from './src/library/ResponseStream.ts';

const stream = new ResponseStream({ silent: true });

let chunkCount = 0;
stream.on('chunk', (buf) => {
    console.log(`Got chunk ${++chunkCount}: ${buf.length} bytes - "${buf.toString().slice(0, 50)}..."`);
});

stream.on('finish', () => {
    console.log(`Stream finished. Total chunks: ${chunkCount}`);
    console.log(`Buffered data length: ${stream.getBufferedData().length}`);
});

// Write some data
stream.write('Hello ');
stream.write('World!');
stream.end();
