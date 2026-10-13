import assert from 'node:assert/strict';
import { canAttemptUpdate, findUpdate, UPDATE_RETRY_MS } from '../app/www/update-check.mjs';

const current = '1'.repeat(40);
const next = '2'.repeat(40);
const url = 'https://github.com/v1-byte/Miko-Ai/releases/download/latest/Miko-AI-main.apk';
const release = (commit, assetUrl = url) => ({
  body: `Build otomatis dari commit \`${commit}\` pada branch main.`,
  assets: [{ name: 'Miko-AI-main.apk', browser_download_url: assetUrl }],
});

assert.deepEqual(findUpdate({ commit: current }, release(next)), { commit: next, url });
assert.equal(findUpdate({ commit: next }, release(next)), null, 'tidak mengunduh jika build sudah sama');
assert.equal(findUpdate({ commit: current }, { ...release(next), body: 'catatan tanpa SHA commit' }), null);
assert.equal(findUpdate({ commit: current }, release(next, 'https://example.invalid/fake.apk')), null);
assert.equal(findUpdate({}, release(next)), null);

const recent = JSON.stringify({ commit: next, at: 10_000 });
assert.equal(canAttemptUpdate(recent, next, 10_000 + UPDATE_RETRY_MS - 1), false);
assert.equal(canAttemptUpdate(recent, next, 10_000 + UPDATE_RETRY_MS), true);
assert.equal(canAttemptUpdate(recent, current, 10_001), true, 'commit baru dapat dicoba segera');
assert.equal(canAttemptUpdate('invalid-json', next, 10_001), true);

console.log('Semua tes pemeriksaan update lulus.');
