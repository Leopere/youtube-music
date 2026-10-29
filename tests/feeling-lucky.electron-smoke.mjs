// Run against the built checkout, never /Applications/YouTube Music.app.
// No account responses, video IDs, cookies, or screenshots are persisted.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const playback = process.argv.includes('--playback');
const app = await electron.launch({
  cwd: root,
  args: [root, '--no-sandbox', '--disable-gpu'],
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  const profile = await app.evaluate(({ app }) => ({
    userData: app.getPath('userData'),
    sessionData: app.getPath('sessionData'),
    appData: app.getPath('appData'),
    packaged: app.isPackaged,
  }));
  assert.equal(profile.packaged, false);
  assert.equal(
    profile.userData,
    path.join(profile.appData, 'YouTube Music Development'),
  );
  assert.equal(
    profile.sessionData,
    path.join(profile.appData, 'YouTube Music Development'),
  );
  const button = page.getByRole('button', {
    name: 'I’m Feeling Lucky',
    exact: true,
  });
  await button.waitFor({ state: 'visible', timeout: 45000 });
  await expect(page.locator('#feeling-lucky-home')).toBeVisible();
  await expect(page.locator('#feeling-lucky-home h1')).toHaveText(
    'Your music. One press.',
  );
  await expect
    .poll(() => app.evaluate(({ app }) => app.dock?.isVisible() ?? false))
    .toBe(false);

  const windowLifecycle = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().startsWith('devtools:'),
    );
    window.close();
    const result = {
      destroyed: window.isDestroyed(),
      visible: window.isVisible(),
    };
    window.show();
    return result;
  });
  assert.deepEqual(windowLifecycle, { destroyed: false, visible: false });
  const signedIn = await page.evaluate(() => !!window.yt?.config_?.LOGGED_IN);
  if (!playback) {
    assert.equal(
      signedIn,
      false,
      'Use --playback for a signed-in development profile',
    );
    await button.click();
    await expect(page.locator('#feeling-lucky [role=status]')).toHaveText(
      'Sign in to YouTube Music to use your recommendations.',
    );
    await expect(button).toBeEnabled();
    console.log(
      'PASS: isolated development profile, visible button, signed-out feedback',
    );
  } else {
    assert.equal(
      signedIn,
      true,
      'Sign in manually in the separate development profile first',
    );
    const state = () =>
      page.evaluate(() => ({
        video: document.querySelector('#movie_player')?.getVideoData?.()
          .video_id,
        playing:
          document.querySelector('#movie_player')?.getPlayerState?.() === 1,
        queue:
          document.querySelector('#queue')?.queue?.getItems?.().length ?? 0,
        time: document.querySelector('video')?.currentTime ?? 0,
      }));
    let previous = (await state()).video;
    for (let press = 0; press < 2; press++) {
      await button.click();
      await expect
        .poll(
          async () => {
            const current = await state();
            return (
              !!current.video &&
              current.video !== previous &&
              current.playing &&
              current.queue > 1 &&
              current.time > 0
            );
          },
          {
            timeout: 45000,
            message:
              'New starting song, populated queue and advancing playback',
          },
        )
        .toBe(true);
      const started = await state();
      await expect
        .poll(
          async () => {
            const current = await state();
            return (
              current.video === started.video &&
              current.playing &&
              current.time > started.time + 0.2
            );
          },
          {
            timeout: 15000,
            message: 'Playback time advances for the new starting song',
          },
        )
        .toBe(true);
      previous = started.video;
      await expect(button).toBeEnabled();
    }
    console.log(
      'PASS: two fresh personalized starts with populated queues and advancing playback',
    );
  }
} finally {
  await app.close();
}
