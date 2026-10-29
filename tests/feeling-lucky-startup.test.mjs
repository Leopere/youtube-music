import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleLaunchMix } from '../src/plugins/feeling-lucky/startup.ts';

test('launch waits for player and sign-in readiness then starts exactly once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let state = 'wait';
  let starts = 0;
  scheduleLaunchMix(
    () => state,
    () => starts++,
  );
  t.mock.timers.tick(1000);
  assert.equal(starts, 0);
  state = 'start';
  t.mock.timers.tick(250);
  assert.equal(starts, 1);
  t.mock.timers.tick(1000);
  assert.equal(starts, 1);
});

test('playing audio or disabled autoplay ends the startup attempt', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let state = 'skip';
  let starts = 0;
  scheduleLaunchMix(
    () => state,
    () => starts++,
  );
  t.mock.timers.tick(1);
  state = 'start';
  t.mock.timers.tick(1000);
  assert.equal(starts, 0);
});

test('manual playback or plugin shutdown cancels pending startup', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let state = 'wait';
  let starts = 0;
  const cancel = scheduleLaunchMix(
    () => state,
    () => starts++,
  );
  cancel();
  state = 'start';
  t.mock.timers.tick(1000);
  assert.equal(starts, 0);
});

test('signed-out or unavailable players stop waiting after the deadline', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let checks = 0;
  let starts = 0;
  scheduleLaunchMix(
    () => {
      checks++;
      return 'wait';
    },
    () => starts++,
    500,
  );
  t.mock.timers.tick(500);
  const previous = checks;
  t.mock.timers.tick(1000);
  assert.equal(checks, previous);
  assert.equal(starts, 0);
});
