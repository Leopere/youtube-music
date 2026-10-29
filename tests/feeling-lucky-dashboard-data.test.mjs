import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDashboardState } from '../src/plugins/feeling-lucky/dashboard-data.ts';

const renderer = (title, selected = false, extra = {}) => ({
  playlistPanelVideoRenderer: {
    title: { runs: [{ text: title }] },
    shortBylineText: { runs: [{ text: `Artist ${title}` }] },
    videoId: `id-${title}`,
    selected,
    thumbnail: {
      thumbnails: [{ url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg' }],
    },
    ...extra,
  },
});

function fixture({ queue = [], playerResponse, videoData } = {}) {
  const player = {
    getVideoData: () =>
      videoData ?? {
        video_id: 'id-current',
        title: 'Current',
        author: 'Fallback artist',
      },
    getPlayerResponse: () =>
      playerResponse ?? {
        videoDetails: {
          title: 'Current title',
          author: 'Current artist',
          album: 'Current album',
          thumbnail: {
            thumbnails: [
              { url: 'https://i.ytimg.com/vi/current/hqdefault.jpg' },
            ],
          },
        },
      },
    getCurrentTime: () => 35.2,
    getDuration: () => 210,
    getPlayerState: () => 1,
  };
  const queueElement = { queue: { getItems: () => queue } };
  const image = {
    getAttribute: () => 'https://i.ytimg.com/vi/fallback/hqdefault.jpg',
  };
  return {
    querySelector(selector) {
      if (selector === '#movie_player') return player;
      if (selector === '#queue') return queueElement;
      if (selector === 'ytmusic-player-bar img') return image;
      return null;
    },
  };
}

test('reads current track, playback state, and next queue entries from both renderer shapes', () => {
  const data = readDashboardState(
    fixture({
      queue: [
        renderer('previous'),
        {
          playlistPanelVideoWrapperRenderer: {
            primaryRenderer: renderer('now', true),
          },
        },
        renderer('next one'),
        {
          playlistPanelVideoWrapperRenderer: {
            primaryRenderer: renderer('next two'),
          },
        },
        renderer('next three'),
      ],
      playerResponse: {
        videoDetails: {
          title: 'Current title',
          author: 'Current artist',
          album: 'Album',
          thumbnail: {
            thumbnails: [
              { url: 'https://i.ytimg.com/vi/current/hqdefault.jpg' },
            ],
          },
        },
      },
      videoData: { video_id: 'id-now' },
    }),
  );

  assert.deepEqual(data, {
    title: 'Current title',
    artist: 'Current artist',
    album: 'Album',
    imageUrl: 'https://i.ytimg.com/vi/current/hqdefault.jpg',
    elapsed: 35.2,
    duration: 210,
    playing: true,
    queue: [
      {
        title: 'next one',
        artist: 'Artist next one',
        imageUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        index: 2,
      },
      {
        title: 'next two',
        artist: 'Artist next two',
        imageUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        index: 3,
      },
      {
        title: 'next three',
        artist: 'Artist next three',
        imageUrl: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
        index: 4,
      },
    ],
  });
});

test('uses safe player-bar artwork fallback and filters unavailable queue entries', () => {
  const data = readDashboardState(
    fixture({
      playerResponse: { videoDetails: { title: 'Track', author: 'Artist' } },
      queue: [
        renderer('current', true),
        renderer('unavailable', false, { isPlayable: false }),
        renderer('following'),
        renderer('farther'),
        renderer('fifth'),
        renderer('sixth'),
      ],
    }),
  );

  assert.equal(data.imageUrl, 'https://i.ytimg.com/vi/fallback/hqdefault.jpg');
  assert.deepEqual(
    data.queue.map(({ title, index }) => [title, index]),
    [
      ['following', 2],
      ['farther', 3],
      ['fifth', 4],
      ['sixth', 5],
    ],
  );
});

test('rejects unsafe image hosts and returns no state without current track metadata', () => {
  const unsafe = fixture({
    playerResponse: {
      videoDetails: {
        title: 'Track',
        author: 'Artist',
        thumbnail: {
          thumbnails: [{ url: 'https://attacker.example/image.jpg' }],
        },
      },
    },
  });
  unsafe.querySelector = (selector) => {
    if (selector === '#movie_player')
      return {
        getPlayerResponse: () => ({
          videoDetails: {
            title: 'Track',
            author: 'Artist',
            thumbnail: {
              thumbnails: [{ url: 'https://attacker.example/image.jpg' }],
            },
          },
        }),
        getVideoData: () => ({}),
        getCurrentTime: () => -1,
        getDuration: () => Infinity,
        getPlayerState: () => 2,
      };
    if (selector === 'ytmusic-player-bar img')
      return { getAttribute: () => 'javascript:alert(1)' };
    return null;
  };
  const data = readDashboardState(unsafe);
  assert.equal(data.imageUrl, undefined);
  assert.equal(data.elapsed, 0);
  assert.equal(data.duration, 0);
  assert.equal(data.playing, false);

  assert.equal(readDashboardState({ querySelector: () => null }), undefined);
});
