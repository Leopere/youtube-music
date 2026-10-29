import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createListeningView } from '../src/plugins/feeling-lucky/view.ts';

function fixture(actions) {
  const window = new Window();
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  document.body.innerHTML =
    '<nav></nav><main><ytmusic-browse-response><h2 class="native-shelf">Throwbacks</h2></ytmusic-browse-response></main><aside id="queue">Queue</aside>';
  const navigation = document.querySelector('nav');
  const control = document.createElement('div');
  control.id = 'feeling-lucky';
  const button = document.createElement('button');
  button.textContent = 'I’m Feeling Lucky';
  control.append(button);
  navigation.append(control);
  return {
    window,
    control,
    navigation,
    response: document.querySelector('ytmusic-browse-response'),
    view: createListeningView(navigation, control, (key) => key, actions),
  };
}

test('focused Home replaces carousels with one prominent control and leaves the queue intact', async () => {
  const f = fixture();
  f.view.update(true, '/');
  assert.equal(f.response.querySelector('.native-shelf').hidden, true);
  assert.equal(
    document.querySelector('#feeling-lucky-home').contains(f.control),
    true,
  );
  assert.equal(document.querySelectorAll('#feeling-lucky button').length, 1);
  assert.equal(document.querySelector('#queue').textContent, 'Queue');
  f.view.update(true, '/');
  assert.equal(document.querySelectorAll('#feeling-lucky-home').length, 1);
  f.view.stop();
  assert.equal(f.response.hidden, false);
  assert.equal(f.control.parentElement, f.navigation);
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('search and library routes restore native content and keep the control in navigation', async () => {
  const f = fixture();
  for (const route of ['/search', '/library', '/browse/FEmusic_liked_videos']) {
    f.view.update(true, '/');
    f.view.update(true, route);
    assert.equal(f.response.hidden, false);
    assert.equal(f.control.parentElement, f.navigation);
    assert.equal(document.querySelector('#feeling-lucky-home'), null);
  }
  f.view.update(true, '/');
  f.view.update(false, '/');
  assert.equal(f.response.hidden, false);
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('mounting waits for native browse content and preserves an initially hidden response on stop', async () => {
  const f = fixture();
  f.response.remove();
  f.view.update(true, '/');
  assert.equal(f.control.parentElement, f.navigation);
  document.querySelector('main').append(f.response);
  f.response.hidden = true;
  f.view.update(true, '/');
  assert.equal(f.response.hidden, false);
  assert.equal(
    document.querySelector('#feeling-lucky-home').parentElement,
    f.response,
  );
  f.view.stop();
  assert.equal(f.response.hidden, true);
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('watch navigation retains focused listening without hiding the player', async () => {
  const f = fixture();
  const player = document.createElement('ytmusic-player');
  document.body.append(player);
  f.view.update(true, '/watch');
  assert.equal(f.response.querySelector('.native-shelf').hidden, true);
  assert.equal(player.hidden, false);
  assert.equal(
    document.querySelector('#feeling-lucky-home').contains(f.control),
    true,
  );
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('playback card reflects track data, safe artwork, time and transport actions', async () => {
  const called = [];
  const f = fixture({
    previous: () => called.push('previous'),
    playPause: () => called.push('toggle'),
    next: () => called.push('next'),
  });
  f.view.update(true, '/');
  const state = {
    title: '<b>Real song</b>',
    artist: 'Artist',
    album: 'Album',
    imageUrl: 'https://example.com/cover.jpg',
    elapsed: 65,
    duration: 180,
    playing: true,
    queue: [],
  };
  f.view.setPlayback(state);
  assert.equal(
    document.querySelector('.lucky-track-title').textContent,
    '<b>Real song</b>',
  );
  assert.equal(document.querySelector('.lucky-track-title b'), null);
  assert.equal(
    document.querySelector('.lucky-track-artist').textContent,
    'Artist',
  );
  assert.equal(
    document.querySelector('.lucky-cover').getAttribute('src'),
    state.imageUrl,
  );
  assert.equal(document.querySelector('.lucky-timing').textContent, '1:053:00');
  assert.equal(document.querySelector('progress').value, 65);
  const buttons = [...document.querySelectorAll('.lucky-transport')];
  assert.equal(buttons[1].getAttribute('aria-label'), 'pause');
  buttons.forEach((button) => button.click());
  assert.deepEqual(called, ['previous', 'toggle', 'next']);
  f.view.setPlayback({
    ...state,
    imageUrl: 'javascript:alert(1)',
    playing: false,
  });
  assert.equal(
    document.querySelector('.lucky-cover').hasAttribute('src'),
    false,
  );
  assert.equal(document.querySelector('.lucky-cover').hidden, true);
  assert.equal(buttons[1].getAttribute('aria-label'), 'play');
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('Up Next limits real rows, uses original queue indexes, and retains rows during time updates', async () => {
  const called = [];
  const f = fixture({
    playQueueItem: (index) => called.push(index),
    openLibrary: () => called.push('library'),
    openSearch: () => called.push('search'),
  });
  f.view.update(true, '/');
  const state = {
    title: 'Current',
    artist: 'Artist',
    elapsed: 0,
    duration: 20,
    playing: false,
    queue: Array.from({ length: 6 }, (_, index) => ({
      title: `Song ${index}`,
      artist: 'Next artist',
      index: index + 10,
    })),
  };
  f.view.setPlayback(state);
  const row = document.querySelector('.lucky-queue-song');
  assert.equal(document.querySelectorAll('.lucky-queue-song').length, 4);
  row.click();
  f.view.setPlayback({ ...state, elapsed: 3 });
  assert.equal(document.querySelector('.lucky-queue-song'), row);
  document
    .querySelectorAll('.lucky-shortcut')
    .forEach((button) => button.click());
  assert.deepEqual(called, [10, 'library', 'search']);
  f.view.stop();
  const title = document.querySelector('.lucky-track-title');
  f.view.setPlayback({ ...state, title: 'Late change' });
  assert.equal(document.querySelector('.lucky-track-title'), title);
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('idle state avoids invented metadata and disables playback controls', async () => {
  const f = fixture({ playPause() {} });
  f.view.update(true, '/');
  assert.equal(
    document.querySelector('.lucky-track-title').textContent,
    'idle-title',
  );
  assert.equal(document.querySelector('.lucky-queue-empty').hidden, false);
  assert.equal(document.querySelector('.lucky-play-pause').disabled, true);
  f.view.setPlayback({
    title: '',
    artist: '',
    elapsed: NaN,
    duration: Infinity,
    playing: false,
    queue: [],
  });
  assert.equal(document.querySelector('.lucky-timing').textContent, '0:000:00');
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});

test('failed artwork stays on the fallback when playback time refreshes', async () => {
  const f = fixture();
  f.view.update(true, '/');
  const state = {
    title: 'Song',
    artist: 'Artist',
    imageUrl: 'https://example.com/missing.jpg',
    elapsed: 0,
    duration: 60,
    playing: true,
    queue: [],
  };
  f.view.setPlayback(state);
  const image = document.querySelector('.lucky-cover');
  image.dispatchEvent(new f.window.Event('error'));
  f.view.setPlayback({ ...state, elapsed: 1 });
  assert.equal(image.hidden, true);
  assert.equal(
    document.querySelector('.lucky-artwork-placeholder').hidden,
    false,
  );
  f.view.setPlayback({ ...state, imageUrl: 'https://example.com/new.jpg' });
  assert.equal(image.hidden, false);
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});
