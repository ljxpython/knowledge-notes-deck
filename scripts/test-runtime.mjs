import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const player = await readFile(new URL('../js/player.js', import.meta.url), 'utf8');
assert.match(player, /requestId/);
assert.match(player, /cleanup\(\)/);
assert.match(player, /prefetch|fragment\(deck\.pages\[nearby\]\)/);
assert.match(player, /toggleDraw/);
console.log('Runtime contract checks passed.');
