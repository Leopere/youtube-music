import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { mountLuckyButton } from './button';
import { createLuckyMix, LuckyError } from './mix';
import { startSelectedSong } from './playback';
import { scheduleLaunchMix } from './startup';
import style from './style.css?inline';
import { createListeningView } from './view';

import type { MusicPlayer } from '@/types/music-player';
import type { MusicPlayerAppElement } from '@/types/music-player-app-element';

// Once per renderer lifetime, including disable/re-enable of the plugin.
let launchAttempted = false;

export default createPlugin({
  name: () => t('plugins.feeling-lucky.name'),
  description: () => t('plugins.feeling-lucky.description'),
  restartNeeded: false,
  config: { enabled: true, playOnLaunch: true, focusHome: true },
  menu: async ({ getConfig, setConfig }) => [
    {
      label: t('plugins.feeling-lucky.play-on-launch'),
      type: 'checkbox',
      checked: (await getConfig()).playOnLaunch,
      click: (item) => setConfig({ playOnLaunch: item.checked }),
    },
    {
      label: t('plugins.feeling-lucky.focus-home'),
      type: 'checkbox',
      checked: (await getConfig()).focusHome,
      click: (item) => setConfig({ focusHome: item.checked }),
    },
  ],
  stylesheets: [style],
  renderer: {
    cleanup: undefined as (() => void) | undefined,
    observer: undefined as MutationObserver | undefined,
    cancelStartup: undefined as (() => void) | undefined,
    playOnLaunch: true,
    focusHome: true,
    updateView: undefined as (() => void) | undefined,
    generation: 0,
    async start({ getConfig }) {
      const generation = ++this.generation;
      const config = await getConfig();
      if (generation !== this.generation) return;
      this.playOnLaunch = config.playOnLaunch;
      this.focusHome = config.focusHome;
      const attemptLaunch = !launchAttempted;
      launchAttempted = true;
      const attach = () => {
        const container = document.querySelector<HTMLElement>(
          'ytmusic-nav-bar #right-content',
        );
        if (!container || this.cleanup) return;
        const app = () =>
          document.querySelector<MusicPlayerAppElement>('ytmusic-app');
        let stopped = false;
        const mix = createLuckyMix({
          signedIn: () =>
            !!(
              window as unknown as {
                yt?: { config_?: { LOGGED_IN?: boolean } };
              }
            ).yt?.config_?.LOGGED_IN,
          currentVideo: () =>
            document
              .querySelector<HTMLElement & MusicPlayer>('#movie_player')
              ?.getVideoData?.().video_id ??
            new URL(location.href).searchParams.get('v') ??
            undefined,
          request: (path, data) => {
            const site = app();
            if (!site?.networkManager) throw new LuckyError('unavailable');
            return site.networkManager.fetch(path, data);
          },
          navigate: async (path) => {
            const site = app();
            if (!site?.navigate) throw new LuckyError('unavailable');
            site.navigate(path);
            const expected = new URL(path, location.origin).searchParams.get(
              'v',
            )!;
            const started = await startSelectedSong(
              () =>
                document.querySelector<HTMLElement & MusicPlayer>(
                  '#movie_player',
                ),
              expected,
              () => stopped,
            );
            if (!started && !stopped) throw new LuckyError('playback');
          },
        });
        const control = mountLuckyButton(
          container,
          mix,
          (key) => t(`plugins.feeling-lucky.${key}`),
          () => this.cancelStartup?.(),
        );
        const view = createListeningView(container, control.element, (key) =>
          t(`plugins.feeling-lucky.${key}`),
        );
        this.updateView = () => view.update(this.focusHome, location.pathname);
        const viewObserver = new MutationObserver(this.updateView);
        viewObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
        document.addEventListener('yt-navigate-finish', this.updateView);
        window.addEventListener('popstate', this.updateView);
        this.updateView();
        this.cleanup = () => {
          stopped = true;
          viewObserver.disconnect();
          document.removeEventListener('yt-navigate-finish', this.updateView!);
          window.removeEventListener('popstate', this.updateView!);
          view.stop();
          control.stop();
          this.updateView = undefined;
        };
        if (attemptLaunch && this.playOnLaunch) {
          this.cancelStartup = scheduleLaunchMix(
            () => {
              if (
                !this.playOnLaunch ||
                window.mainConfig.plugins.getPlugins()['disable-autoplay']
                  ?.enabled
              )
                return 'skip';
              const player = document.querySelector<HTMLElement & MusicPlayer>(
                '#movie_player',
              );
              const playerState = player?.getPlayerState?.();
              if (playerState === 1 || playerState === 3) return 'skip';
              const signedIn = (
                window as unknown as {
                  yt?: { config_?: { LOGGED_IN?: boolean } };
                }
              ).yt?.config_?.LOGGED_IN;
              return app()?.networkManager &&
                typeof playerState === 'number' &&
                signedIn === true
                ? 'start'
                : 'wait';
            },
            () => {
              control.start();
            },
          );
        }
        this.observer?.disconnect();
      };
      this.observer = new MutationObserver(attach);
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      attach();
    },
    onConfigChange(config) {
      this.playOnLaunch = config.playOnLaunch;
      this.focusHome = config.focusHome;
      this.updateView?.();
      if (!config.playOnLaunch) this.cancelStartup?.();
    },
    stop() {
      this.generation++;
      this.cancelStartup?.();
      this.cancelStartup = undefined;
      this.observer?.disconnect();
      this.observer = undefined;
      this.cleanup?.();
      this.cleanup = undefined;
    },
  },
});
