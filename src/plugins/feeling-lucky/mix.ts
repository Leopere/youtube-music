// Use the signed-in site's network manager: no copied credentials or second session.
export type LuckyErrorCode = 'signed-out' | 'unavailable' | 'empty' | 'network';

export class LuckyError extends Error {
  readonly code: LuckyErrorCode;
  constructor(code: LuckyErrorCode) {
    super(code);
    this.code = code;
  }
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

function visit(
  value: unknown,
  callback: (node: Record<string, unknown>) => void,
) {
  if (Array.isArray(value)) {
    for (const child of value) visit(child, callback);
  } else {
    const node = record(value);
    if (!node) return;
    callback(node);
    for (const child of Object.values(node)) visit(child, callback);
  }
}

const videoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]{11}$/.test(value);

// Read only the authenticated Songs library response, never the mixed Home
// feed (which also contains charts, seasonal promotions and trending music).
// Exclude menus, tracking fields and podcast episodes; deduplicate songs.
export function recommendationSeeds(response: unknown): string[] {
  const seeds = new Set<string>();
  visit(record(response)?.contents, (node) => {
    const tile =
      record(node.musicTwoRowItemRenderer) ??
      record(node.musicResponsiveListItemRenderer);
    if (!tile) return;
    const overlay = record(tile.thumbnailOverlay) ?? record(tile.overlay);
    const titleColumn = record(
      Array.isArray(tile.flexColumns) ? tile.flexColumns[0] : undefined,
    );
    const title = record(
      record(titleColumn?.musicResponsiveListItemFlexColumnRenderer)?.text,
    );
    const titleRuns = Array.isArray(title?.runs) ? title.runs : [];
    const endpoints = [
      record(tile.navigationEndpoint),
      record(
        record(record(overlay?.musicItemThumbnailOverlayRenderer)?.content)
          ?.musicPlayButtonRenderer,
      )?.playNavigationEndpoint,
      ...titleRuns.map((run) => record(record(run)?.navigationEndpoint)),
    ];
    for (const endpoint of endpoints) {
      const watch = record(record(endpoint)?.watchEndpoint);
      const config = record(
        record(watch?.watchEndpointMusicSupportedConfigs)
          ?.watchEndpointMusicConfig,
      );
      if (config?.musicVideoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE')
        continue;
      if (videoId(watch?.videoId)) seeds.add(watch.videoId);
    }
  });
  return [...seeds];
}

export function radioTracks(response: unknown): string[] {
  const ids = new Set<string>();
  visit(record(response)?.contents, (node) => {
    const track = record(node.playlistPanelVideoRenderer);
    if (videoId(track?.videoId) && track?.isPlayable !== false)
      ids.add(track.videoId);
  });
  return [...ids];
}

export interface MixPlayer {
  signedIn(): boolean;
  currentVideo(): string | undefined;
  request(path: string, data: Record<string, unknown>): Promise<unknown>;
  navigate(path: string): void;
}

// The only queue-changing operation is native watch navigation after a valid
// radio response. Never clear the queue before recommendation/network checks.
export function createLuckyMix(
  player: MixPlayer,
  random = Math.random,
  timeoutMs = 15000,
) {
  const recent: string[] = [];
  let busy = false;
  let stopped = false;

  async function request(path: string, data: Record<string, unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        player.request(path, data),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new LuckyError('network')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    stop() {
      stopped = true;
    },
    async start(): Promise<boolean> {
      if (busy || stopped) return false;
      busy = true;
      try {
        if (!player.signedIn()) throw new LuckyError('signed-out');
        const library = await request('/browse', {
          browseId: 'FEmusic_liked_videos',
        });
        if (stopped) return false;
        const current = player.currentVideo();
        const seeds = recommendationSeeds(library).filter(
          (id) => id !== current && id !== recent.at(-1),
        );
        const fresh = seeds.filter((id) => !recent.includes(id));
        const choices = fresh.length ? fresh : seeds;
        if (!choices.length) throw new LuckyError('empty');
        const seed = choices[Math.floor(random() * choices.length)];
        const playlistId = `RDAMVM${seed}`;
        const radio = await request('/next', { videoId: seed, playlistId });
        if (!radioTracks(radio).includes(seed)) throw new LuckyError('empty');
        if (stopped) return false;
        if (!player.signedIn()) throw new LuckyError('signed-out');
        player.navigate(
          `/watch?${new URLSearchParams({ v: seed, list: playlistId })}`,
        );
        recent.push(seed);
        if (recent.length > 5) recent.shift();
        return true;
      } catch (error) {
        if (stopped) return false;
        throw error instanceof LuckyError ? error : new LuckyError('network');
      } finally {
        busy = false;
      }
    },
  };
}
