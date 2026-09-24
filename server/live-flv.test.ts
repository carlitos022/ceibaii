import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CeibaLiveFlv } from './live-flv';

const header = Buffer.from('464c5601050000000900000000', 'hex');
function tag(type: number, timestamp: number, payload: string) {
  const data = Buffer.from(payload, 'hex');
  const out = Buffer.alloc(data.length + 15);
  out[0] = type;
  out.writeUIntBE(data.length, 1, 3);
  out.writeUIntBE(timestamp & 0xffffff, 4, 3);
  out[7] = timestamp >>> 24;
  data.copy(out, 11);
  out.writeUInt32BE(data.length + 11, data.length + 11);
  return out;
}
async function normalize(data: Buffer, chunkSize: number) {
  const stream = new CeibaLiveFlv();
  const result: Buffer[] = [];
  const output = (async () => { for await (const chunk of stream) result.push(chunk); })();
  for (let i = 0; i < data.length; i += chunkSize) stream.write(data.subarray(i, i + chunkSize));
  stream.end();
  await output;
  return Buffer.concat(result);
}

test('repairs observed CMS AVC mislabel and zero AAC clock across arbitrary TCP boundaries', async () => {
  const avc = '17000000000142e014ffe100046742e01401000268ce';
  const input = Buffer.concat([header, tag(8, 0, avc), tag(8, 0, 'af01016053a028160a098481'), tag(8, 0, 'af01016053a028160a098481')]);
  const expected = Buffer.concat([header, tag(9, 0, avc), tag(8, 0, 'af001588'), tag(8, 0, 'af01016053a028160a098481'), tag(8, 128, 'af01016053a028160a098481')]);
  for (const size of [1, 3, 9, 13, 17, 128, 65536]) assert.deepEqual(await normalize(input, size), expected);
});

test('preserves valid FLV and original AAC/video payloads, including extended timestamps', async () => {
  const input = Buffer.concat([header, tag(8, 0, 'af001208'), tag(9, 0x1000001, '27010000000000000161'), tag(8, 0x1000001, 'af01016053a028160a098481')]);
  assert.deepEqual(await normalize(input, 7), input);
});

test('uses a supplied AAC sample rate rather than replacing valid codec configuration', async () => {
  const audio = 'af01016053a028160a098481';
  const input = Buffer.concat([header, tag(8, 0, 'af001208'), tag(8, 0, audio), tag(8, 0, audio)]);
  const expected = Buffer.concat([header, tag(8, 0, 'af001208'), tag(8, 0, audio), tag(8, Math.round(1024000 / 44100), audio)]);
  assert.deepEqual(await normalize(input, 5), expected);
});

test('rejects malformed CMS responses instead of feeding corrupted bytes to MSE', async () => {
  await assert.rejects(normalize(Buffer.from('HTTP error response'), 100), /contenedor FLV/);
  const corrupt = tag(9, 0, '17010000000000000165');
  corrupt[corrupt.length - 1] = 0;
  await assert.rejects(normalize(Buffer.concat([header, corrupt]), 100), /inconsistente/);
});
