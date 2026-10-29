import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLuckyMix,
  LuckyError,
  recommendationSeeds,
  radioTracks,
} from '../src/plugins/feeling-lucky/mix.ts';

// Synthetic protocol fixtures only; never record account responses or cookies.
const A = 'aaaaaaaaaaa';
const B = 'bbbbbbbbbbb';
const C = 'ccccccccccc';
const home = (...ids) => ({
  contents: {
    sectionListRenderer: {
      contents: ids.map((videoId) => ({
        musicTwoRowItemRenderer: {
          navigationEndpoint: { watchEndpoint: { videoId } },
        },
      })),
    },
  },
});
const radio = (...ids) => ({
  contents: {
    playlistPanelRenderer: {
      contents: ids.map((videoId) => ({
        playlistPanelVideoRenderer: { videoId, isPlayable: true },
      })),
    },
  },
});
function fixture(overrides = {}) {
  const requests = [];
  const navigations = [];
  const player = {
    signedIn: () => true,
    currentVideo: () => undefined,
    request: async (path, data) => {
      requests.push({ path, data });
      return path === '/browse' ? home(A, B, C) : radio(data.videoId, C);
    },
    navigate: (path) => navigations.push(path),
    ...overrides,
  };
  return {
    player,
    requests,
    navigations,
    mix: createLuckyMix(player, () => 0, 20),
  };
}
const rejectsCode = (promise, code) =>
  assert.rejects(promise, (e) => e instanceof LuckyError && e.code === code);

test('only playable library tiles become unique seeds; menus, tracking and podcasts do not', () => {
  const response = home(A, A, 'invalid');
  response.contents.other = { menuRenderer: { watchEndpoint: { videoId: B } } };
  response.contents.podcast = {
    musicTwoRowItemRenderer: {
      navigationEndpoint: {
        watchEndpoint: {
          videoId: C,
          watchEndpointMusicSupportedConfigs: {
            watchEndpointMusicConfig: {
              musicVideoType: 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE',
            },
          },
        },
      },
    },
  };
  assert.deepEqual(recommendationSeeds(response), [A]);
  assert.deepEqual(recommendationSeeds(null), []);
});

test('supports library overlay play endpoints', () => {
  const response = {
    contents: {
      musicTwoRowItemRenderer: {
        thumbnailOverlay: {
          musicItemThumbnailOverlayRenderer: {
            content: {
              musicPlayButtonRenderer: {
                playNavigationEndpoint: { watchEndpoint: { videoId: B } },
              },
            },
          },
        },
      },
    },
  };
  assert.deepEqual(recommendationSeeds(response), [B]);
});

test('one press checks personalized library and a fresh radio before watch navigation', async () => {
  const f = fixture();
  assert.equal(await f.mix.start(), true);
  assert.deepEqual(f.requests, [
    { path: '/browse', data: { browseId: 'FEmusic_liked_videos' } },
    { path: '/next', data: { videoId: A, playlistId: `RDAMVM${A}` } },
  ]);
  assert.deepEqual(f.navigations, [`/watch?v=${A}&list=RDAMVM${A}`]);
});

test('repeated presses vary starts even with identical random values and cached library', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) await f.mix.start();
  assert.deepEqual(
    f.navigations.map((p) =>
      new URL(p, 'https://music.youtube.com').searchParams.get('v'),
    ),
    [A, B, C, A],
  );
});

test('excludes the currently playing song', async () => {
  const f = fixture({ currentVideo: () => A });
  await f.mix.start();
  assert.match(f.navigations[0], new RegExp(`v=${B}`));
});

test('signed-out requests do not fetch or mutate the queue', async () => {
  const f = fixture({ signedIn: () => false });
  await rejectsCode(f.mix.start(), 'signed-out');
  assert.equal(f.requests.length, 0);
  assert.equal(f.navigations.length, 0);
});

test('empty library and unavailable radio preserve the existing queue', async () => {
  for (const response of [null, {}, { contents: [] }]) {
    const f = fixture({ request: async () => response });
    await rejectsCode(f.mix.start(), 'empty');
    assert.equal(f.navigations.length, 0);
  }
  const f = fixture({
    request: async (path) => (path === '/browse' ? home(A) : radio(B)),
  });
  await rejectsCode(f.mix.start(), 'empty');
  assert.equal(f.navigations.length, 0);
});

test('network failures allow retry without consuming the seed or clearing the queue', async () => {
  let fail = true;
  const f = fixture({
    request: async (path) => {
      if (fail) throw new Error('offline');
      return path === '/browse' ? home(A) : radio(A);
    },
  });
  await rejectsCode(f.mix.start(), 'network');
  assert.equal(f.navigations.length, 0);
  fail = false;
  await f.mix.start();
  assert.match(f.navigations[0], new RegExp(`v=${A}`));
  await rejectsCode(f.mix.start(), 'empty'); // No different start exists.
  assert.equal(f.navigations.length, 1);
});

test('a double press starts only one request; stopping prevents late navigation', async () => {
  let resolve;
  const f = fixture({
    request: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  const first = f.mix.start();
  assert.equal(await f.mix.start(), false);
  f.mix.stop();
  resolve(home(A));
  // Disabling before library resolves prevents even the radio request.
  assert.equal(await first, false);
  assert.deepEqual(f.navigations, []);
});

test('hung requests time out without late navigation', async () => {
  let resolve;
  const f = fixture({
    request: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  await rejectsCode(f.mix.start(), 'network');
  resolve(home(A));
  await Promise.resolve();
  assert.deepEqual(f.navigations, []);
});

test('unplayable radio entries do not pass preflight', () => {
  const response = radio(A);
  response.contents.playlistPanelRenderer.contents[0].playlistPanelVideoRenderer.isPlayable = false;
  assert.deepEqual(radioTracks(response), []);
});

test('supports song title endpoints in responsive rows without choosing artist links', () => {
  const response = {
    contents: {
      musicResponsiveListItemRenderer: {
        flexColumns: [
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: {
                runs: [
                  { navigationEndpoint: { watchEndpoint: { videoId: A } } },
                ],
              },
            },
          },
          {
            musicResponsiveListItemFlexColumnRenderer: {
              text: {
                runs: [
                  { navigationEndpoint: { watchEndpoint: { videoId: B } } },
                ],
              },
            },
          },
        ],
      },
    },
  };
  assert.deepEqual(recommendationSeeds(response), [A]);
});

test('empty personal library does not fall back to Trending or Home', async () => {
  const calls = [];
  const f = fixture({
    request: async (path, data) => {
      calls.push(data.browseId);
      return { contents: [] };
    },
  });
  await rejectsCode(f.mix.start(), 'empty');
  assert.deepEqual(calls, ['FEmusic_liked_videos']);
  assert.equal(f.navigations.length, 0);
});
