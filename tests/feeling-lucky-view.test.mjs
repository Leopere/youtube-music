import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createListeningView } from '../src/plugins/feeling-lucky/view.ts';

function fixture() {
  const window = new Window();
  globalThis.document = window.document;
  document.body.innerHTML =
    '<nav></nav><main><ytmusic-browse-response><h2>Throwbacks</h2></ytmusic-browse-response></main><aside id="queue">Queue</aside>';
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
    view: createListeningView(navigation, control, (key) => key),
  };
}

test('focused Home replaces carousels with one prominent control and leaves the queue intact', async () => {
  const f = fixture();
  f.view.update(true, '/');
  assert.equal(f.response.hidden, true);
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
  assert.equal(f.response.hidden, true);
  assert.equal(player.hidden, false);
  assert.equal(
    document.querySelector('#feeling-lucky-home').contains(f.control),
    true,
  );
  f.view.stop();
  await f.window.happyDOM.close();
  delete globalThis.document;
});
