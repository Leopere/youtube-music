import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startSelectedSong } from '../src/plugins/feeling-lucky/playback.ts';

test('starts the selected song only after navigation loads its player data', async () => {
  let reads = 0;
  let starts = 0;
  const player = {
    getVideoData: () => ({ video_id: ++reads > 1 ? 'new-song' : 'old-song' }),
    playVideo: () => starts++,
  };
  assert.equal(
    await startSelectedSong(
      () => player,
      'new-song',
      () => false,
    ),
    true,
  );
  assert.equal(starts, 1);
});

test('never starts the previous song on a navigation timeout', async () => {
  let starts = 0;
  const player = {
    getVideoData: () => ({ video_id: 'old-song' }),
    playVideo: () => starts++,
  };
  assert.equal(
    await startSelectedSong(
      () => player,
      'new-song',
      () => false,
      0,
    ),
    false,
  );
  assert.equal(starts, 0);
});

test('plugin shutdown prevents pending playback', async () => {
  let starts = 0;
  const player = {
    getVideoData: () => ({ video_id: 'new-song' }),
    playVideo: () => starts++,
  };
  assert.equal(
    await startSelectedSong(
      () => player,
      'new-song',
      () => true,
    ),
    false,
  );
  assert.equal(starts, 0);
});
