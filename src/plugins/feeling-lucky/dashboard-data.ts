type Value = Record<string, unknown>;

export interface DashboardTrack {
  title: string;
  artist: string;
  imageUrl?: string;
  index: number;
}

export interface DashboardState {
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  elapsed: number;
  duration: number;
  playing: boolean;
  queue: DashboardTrack[];
}

const record = (value: unknown): Value | undefined =>
  value !== null && typeof value === 'object' ? (value as Value) : undefined;

const text = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  const obj = record(value);
  if (!obj) return undefined;
  if (typeof obj.text === 'string') return obj.text.trim() || undefined;
  if (Array.isArray(obj.runs)) {
    const result = obj.runs
      .map((run) => record(run)?.text)
      .filter((part): part is string => typeof part === 'string')
      .join('')
      .trim();
    return result || undefined;
  }
  return undefined;
};

const safeImage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'yt3.ggpht.com' ||
        url.hostname === 'i.ytimg.com' ||
        url.hostname.endsWith('.googleusercontent.com'))
    ) {
      return url.href;
    }
  } catch {
    // Ignore malformed image URLs from page data.
  }
  return undefined;
};

const imageFrom = (value: unknown): string | undefined => {
  const obj = record(value);
  const images = record(obj?.thumbnail);
  const list = images?.thumbnails ?? obj?.thumbnails;
  if (!Array.isArray(list)) return undefined;
  for (const candidate of [...list].reverse()) {
    const url = safeImage(record(candidate)?.url);
    if (url) return url;
  }
  return undefined;
};

const numberFrom = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

const rendererOf = (item: unknown): Value | undefined => {
  const obj = record(item);
  const direct = record(obj?.playlistPanelVideoRenderer);
  if (direct) return direct;
  const wrapped = record(obj?.playlistPanelVideoWrapperRenderer);
  return record(record(wrapped?.primaryRenderer)?.playlistPanelVideoRenderer);
};

const queueTrack = (
  renderer: Value | undefined,
  index: number,
): DashboardTrack | undefined => {
  if (!renderer || renderer.isPlayable === false || renderer.unplayableText)
    return undefined;
  const title = text(renderer.title);
  const artist =
    text(renderer.shortBylineText) ?? text(renderer.longBylineText);
  if (
    !title ||
    !artist ||
    typeof renderer.videoId !== 'string' ||
    !renderer.videoId
  ) {
    return undefined;
  }
  const imageUrl = imageFrom(renderer.thumbnail);
  return { title, artist, ...(imageUrl ? { imageUrl } : {}), index };
};

/** Reads transient player and queue data for the focused listening dashboard. */
export function readDashboardState(
  document: Document,
): DashboardState | undefined {
  const player = document.querySelector('#movie_player') as
    | (Element & {
        getVideoData?: () => unknown;
        getPlayerResponse?: () => unknown;
        getCurrentTime?: () => number;
        getDuration?: () => number;
        getPlayerState?: () => number;
      })
    | null;
  if (!player) return undefined;

  let videoData: Value | undefined;
  let response: Value | undefined;
  try {
    videoData = record(player.getVideoData?.());
  } catch {
    videoData = undefined;
  }
  try {
    response = record(player.getPlayerResponse?.());
  } catch {
    response = undefined;
  }
  const details = record(response?.videoDetails);
  const title = text(details?.title) ?? text(videoData?.title);
  const artist = text(details?.author) ?? text(videoData?.author);
  if (!title || !artist) return undefined;

  let elapsed = 0;
  let duration = 0;
  let playing = false;
  try {
    elapsed = numberFrom(player.getCurrentTime?.());
    duration = numberFrom(player.getDuration?.());
    playing = player.getPlayerState?.() === 1;
  } catch {
    // Keep the track metadata available if a player getter is temporarily unavailable.
  }

  let imageUrl = imageFrom(details);
  if (!imageUrl) {
    const barImage = document.querySelector('ytmusic-player-bar img');
    imageUrl = safeImage(barImage?.getAttribute('src') ?? undefined);
  }

  const queueElement = document.querySelector('#queue') as
    | (Element & { queue?: { getItems?: () => unknown[] } })
    | null;
  let items: unknown[] = [];
  try {
    const result = queueElement?.queue?.getItems?.();
    if (Array.isArray(result)) items = result;
  } catch {
    items = [];
  }
  let selectedIndex = items.findIndex(
    (item) => rendererOf(item)?.selected === true,
  );
  if (selectedIndex < 0 && typeof videoData?.video_id === 'string') {
    selectedIndex = items.findIndex(
      (item) => rendererOf(item)?.videoId === videoData?.video_id,
    );
  }
  const queue: DashboardTrack[] = [];
  if (selectedIndex >= 0) {
    for (
      let index = selectedIndex + 1;
      index < items.length && queue.length < 4;
      index++
    ) {
      const track = queueTrack(rendererOf(items[index]), index);
      if (track) queue.push(track);
    }
  }

  const album = text(details?.album);
  return {
    title,
    artist,
    ...(album ? { album } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    elapsed,
    duration,
    playing,
    queue,
  };
}
