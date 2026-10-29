import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createInstance } from 'i18next';

const english = JSON.parse(
  await readFile(
    new URL('../src/i18n/resources/en.json', import.meta.url),
    'utf8',
  ),
);
const i18n = createInstance();
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: english } },
});
const message = (key) => i18n.t(`plugins.feeling-lucky.${key}`);

// Match the extensionless TS import used by the app's Vite build.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === './mix' &&
      context.parentURL?.endsWith('/feeling-lucky/button.ts')
    ) {
      return nextResolve('./mix.ts', context);
    }
    return nextResolve(specifier, context);
  },
});
const { mountLuckyButton } =
  await import('../src/plugins/feeling-lucky/button.ts');
const { LuckyError } = await import('../src/plugins/feeling-lucky/mix.ts');

test('visible native button has a live status, prevents double activation, and recovers after error', async () => {
  const window = new Window();
  globalThis.document = window.document;
  let reject;
  let calls = 0;
  let stops = 0;
  const cleanup = mountLuckyButton(
    document.body,
    {
      start: () => {
        calls++;
        return new Promise((_, fail) => {
          reject = fail;
        });
      },
      stop: () => stops++,
    },
    message,
  );
  const button = document.querySelector('button');
  assert.equal(button.textContent, 'I’m Feeling Lucky');
  const pending = button.onclick();
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(
    document.querySelector('[role=status]').textContent,
    'Finding your mix…',
  );
  button.click();
  assert.equal(calls, 1);
  reject(new LuckyError('signed-out'));
  await pending;
  assert.equal(button.disabled, false);
  assert.equal(button.hasAttribute('aria-busy'), false);
  assert.equal(
    document.querySelector('[aria-live=polite]').textContent,
    message('signed-out'),
  );
  cleanup.stop();
  assert.equal(stops, 1);
  assert.equal(document.body.children.length, 0);
  await window.happyDOM.close();
  delete globalThis.document;
});

test('successful start announces opening, and disabling removes the pending button', async () => {
  const window = new Window();
  globalThis.document = window.document;
  let resolve;
  const cleanup = mountLuckyButton(
    document.body,
    {
      start: () =>
        new Promise((done) => {
          resolve = done;
        }),
      stop() {},
    },
    message,
  );
  const button = document.querySelector('button');
  let pending = button.onclick();
  resolve(true);
  await pending;
  assert.equal(
    document.querySelector('[role=status]').textContent,
    'Your mix is ready.',
  );
  pending = button.onclick();
  cleanup.stop();
  resolve(true);
  await pending;
  assert.equal(document.body.children.length, 0);
  await window.happyDOM.close();
  delete globalThis.document;
});

test('automatic start shares button state while manual press cancels startup', async () => {
  const window = new Window();
  globalThis.document = window.document;
  let starts = 0;
  let manual = 0;
  const control = mountLuckyButton(
    document.body,
    {
      start: async () => {
        starts++;
        return true;
      },
      stop() {},
    },
    message,
    () => {
      manual++;
    },
  );
  await control.start();
  assert.equal(starts, 1);
  assert.equal(manual, 0);
  await document.querySelector('button').onclick();
  assert.equal(starts, 2);
  assert.equal(manual, 1);
  control.stop();
  await control.start();
  assert.equal(starts, 2);
  await window.happyDOM.close();
  delete globalThis.document;
});
