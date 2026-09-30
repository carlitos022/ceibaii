import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let revision = 'local';
try { revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
const version = `${new Date().toISOString().replace(/[:.]/g, '-')}-${revision}`;
writeFileSync('public/build-version.json', JSON.stringify({ version }) + '\n');
writeFileSync('src/build-version.ts', `export const BUILD_VERSION = ${JSON.stringify(version)};\n`);
console.log('Build version:', version);
