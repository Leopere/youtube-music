import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { mountLuckyButton } from './button';
import { createLuckyMix, LuckyError } from './mix';
import style from './style.css?inline';

import type { MusicPlayer } from '@/types/music-player';
import type { MusicPlayerAppElement } from '@/types/music-player-app-element';

export default createPlugin({
  name: () => t('plugins.feeling-lucky.name'),
  description: () => t('plugins.feeling-lucky.description'),
  restartNeeded: false,
  config: { enabled: true },
  stylesheets: [style],
  renderer: {
    cleanup: undefined as (() => void) | undefined,
    observer: undefined as MutationObserver | undefined,
    start() {
      const attach = () => {
        const container = document.querySelector<HTMLElement>(
          'ytmusic-nav-bar #right-content',
        );
        if (!container || this.cleanup) return;
        const app = () =>
          document.querySelector<MusicPlayerAppElement>('ytmusic-app');
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
          navigate: (path) => {
            const site = app();
            if (!site?.navigate) throw new LuckyError('unavailable');
            site.navigate(path);
          },
        });
        this.cleanup = mountLuckyButton(container, mix, (key) =>
          t(`plugins.feeling-lucky.${key}`),
        );
        this.observer?.disconnect();
      };
      this.observer = new MutationObserver(attach);
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      attach();
    },
    stop() {
      this.observer?.disconnect();
      this.observer = undefined;
      this.cleanup?.();
      this.cleanup = undefined;
    },
  },
});
