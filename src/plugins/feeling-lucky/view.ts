export interface ListeningPlayback {
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  elapsed: number;
  duration: number;
  playing: boolean;
  queue: { title: string; artist: string; imageUrl?: string; index: number }[];
}

export interface ListeningActions {
  previous?: () => void;
  playPause?: () => void;
  next?: () => void;
  openLibrary?: () => void;
  openSearch?: () => void;
  playQueueItem?: (index: number) => void;
}

const text = (element: HTMLElement, value: string) => {
  if (element.textContent !== value) element.textContent = value;
};
const clock = (seconds: number) => {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
};
const imageSource = (image: HTMLImageElement, value?: string) => {
  const safe = value?.startsWith('https://') ? value : undefined;
  if (safe) {
    if (image.getAttribute('src') !== safe) {
      image.src = safe;
      image.hidden = false;
    }
  } else if (image.hasAttribute('src')) image.removeAttribute('src');
  if (!safe) image.hidden = true;
};

// Keep Home focused on listening. Other routes retain the site's native UI.
export function createListeningView(
  navigation: HTMLElement,
  control: HTMLElement,
  message: (key: string) => string,
  actions: ListeningActions = {},
) {
  const element = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    value?: string,
  ) => {
    const node = document.createElement(tag);
    node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const actionButton = (label: string, symbol: string, action?: () => void) => {
    const button = element('button', 'lucky-transport');
    button.type = 'button';
    button.setAttribute('aria-label', message(label));
    button.title = message(label);
    button.textContent = symbol;
    button.disabled = !action;
    button.onclick = () => action?.();
    return button;
  };
  const panel = element('section', 'lucky-dashboard');
  panel.id = 'feeling-lucky-home';
  panel.setAttribute('aria-labelledby', 'feeling-lucky-home-title');
  const header = element('header', 'lucky-heading');
  const heading = element('h1', '', message('home-title'));
  heading.id = 'feeling-lucky-home-title';
  header.append(
    element('span', 'lucky-eyebrow', message('home-eyebrow')),
    heading,
    element('p', 'lucky-intro', message('home-description')),
  );
  const launch = element('div', 'lucky-launch');
  header.append(launch);

  const grid = element('div', 'lucky-grid');
  const now = element('article', 'lucky-now');
  now.setAttribute('aria-labelledby', 'lucky-now-label');
  const label = element('h2', 'lucky-eyebrow', message('now-playing'));
  label.id = 'lucky-now-label';
  const record = element('div', 'lucky-record');
  const artwork = element('div', 'lucky-artwork');
  const placeholder = element('span', 'lucky-artwork-placeholder', '♪');
  placeholder.setAttribute('aria-hidden', 'true');
  const cover = element('img', 'lucky-cover');
  cover.alt = '';
  cover.hidden = true;
  cover.onerror = () => {
    cover.hidden = true;
    placeholder.hidden = false;
  };
  artwork.append(placeholder, cover);
  const info = element('div', 'lucky-track');
  const title = element('h3', 'lucky-track-title', message('idle-title'));
  const artist = element(
    'p',
    'lucky-track-artist',
    message('idle-description'),
  );
  const album = element('p', 'lucky-track-album');
  info.append(title, artist, album);
  record.append(artwork, info);

  const transport = element('div', 'lucky-transports');
  const previous = actionButton('previous', '‹', actions.previous);
  const playPause = actionButton('play', '▶', actions.playPause);
  playPause.classList.add('lucky-play-pause');
  const next = actionButton('next', '›', actions.next);
  transport.append(previous, playPause, next);
  const progress = element('progress', 'lucky-progress');
  progress.setAttribute('aria-label', message('track-progress'));
  progress.max = 1;
  progress.value = 0;
  const timing = element('div', 'lucky-timing');
  const elapsed = element('span', '', '0:00');
  const duration = element('span', '', '0:00');
  timing.append(elapsed, duration);
  now.append(label, record, transport, progress, timing);

  const upcoming = element('aside', 'lucky-upcoming');
  const upcomingTitle = element('h2', 'lucky-eyebrow', message('up-next'));
  upcomingTitle.id = 'lucky-up-next-label';
  upcoming.setAttribute('aria-labelledby', upcomingTitle.id);
  const queue = element('ol', 'lucky-queue');
  const empty = element('p', 'lucky-queue-empty', message('queue-empty'));
  upcoming.append(upcomingTitle, queue, empty);
  grid.append(now, upcoming);
  const shortcuts = element('div', 'lucky-shortcuts');
  const shortcut = (key: string, symbol: string, action?: () => void) => {
    const button = element('button', 'lucky-shortcut');
    button.type = 'button';
    button.disabled = !action;
    button.onclick = () => action?.();
    const icon = element('span', 'lucky-shortcut-icon', symbol);
    icon.setAttribute('aria-hidden', 'true');
    const copy = element('span', 'lucky-shortcut-copy');
    copy.append(
      element('strong', '', message(key)),
      element('span', '', message(`${key}-description`)),
    );
    const arrow = element('span', 'lucky-shortcut-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(icon, copy, arrow);
    return button;
  };
  shortcuts.append(
    shortcut('saved-songs', '♡', actions.openLibrary),
    shortcut('search-music', '⌕', actions.openSearch),
  );
  panel.append(header, grid, shortcuts);
  const hidden = new Map<HTMLElement, HTMLElement['hidden']>();
  let nativeResponse: HTMLElement | undefined;
  let responseWasHidden: HTMLElement['hidden'] = false;
  let queueKey = '';
  let stopped = false;

  const setPlayback = (state: ListeningPlayback) => {
    if (stopped) return;
    const active = !!state.title;
    text(title, state.title || message('idle-title'));
    text(artist, active ? state.artist : message('idle-description'));
    text(album, state.album || '');
    album.hidden = !state.album;
    imageSource(cover, state.imageUrl);
    placeholder.hidden = !cover.hidden;
    const playLabel = message(state.playing ? 'pause' : 'play');
    playPause.setAttribute('aria-label', playLabel);
    playPause.title = playLabel;
    text(playPause, state.playing ? 'Ⅱ' : '▶');
    playPause.disabled = !active || !actions.playPause;
    previous.disabled = !active || !actions.previous;
    next.disabled = !active || !actions.next;
    const total = Number.isFinite(state.duration)
      ? Math.max(0, state.duration)
      : 0;
    progress.max = total || 1;
    progress.value = Number.isFinite(state.elapsed)
      ? Math.max(0, Math.min(state.elapsed, total))
      : 0;
    text(elapsed, clock(state.elapsed));
    text(duration, clock(total));
    const items = state.queue.slice(0, 4);
    const key = JSON.stringify(items);
    if (key !== queueKey) {
      queueKey = key;
      queue.replaceChildren(
        ...items.map((item) => {
          const row = element('li', 'lucky-queue-row');
          const button = element('button', 'lucky-queue-song');
          button.type = 'button';
          button.disabled = !actions.playQueueItem;
          button.setAttribute(
            'aria-label',
            `${message('play-queued-track')}: ${item.title}`,
          );
          button.onclick = () => actions.playQueueItem?.(item.index);
          const image = element('img', 'lucky-queue-cover');
          image.alt = '';
          image.onerror = () => {
            image.hidden = true;
          };
          imageSource(image, item.imageUrl);
          const copy = element('span', 'lucky-queue-copy');
          copy.append(
            element('strong', '', item.title),
            element('span', '', item.artist),
          );
          button.append(image, copy);
          row.append(button);
          return row;
        }),
      );
    }
    empty.hidden = items.length > 0;
  };
  setPlayback({
    title: '',
    artist: '',
    elapsed: 0,
    duration: 0,
    playing: false,
    queue: [],
  });
  const restore = () => {
    for (const [node, wasHidden] of hidden) {
      node.hidden = wasHidden;
      node.removeAttribute('data-lucky-suppressed');
    }
    hidden.clear();
    if (nativeResponse) nativeResponse.hidden = responseWasHidden;
    nativeResponse = undefined;
    if (control.parentElement !== navigation) navigation.prepend(control);
    panel.remove();
  };

  return {
    setPlayback,
    update(enabled: boolean, pathname: string) {
      if (stopped) return;
      if (!enabled || (pathname !== '/' && pathname !== '/watch')) {
        restore();
        return;
      }
      const response = document.querySelector<HTMLElement>(
        'ytmusic-browse-response',
      );
      if (!response?.parentElement) return;
      if (nativeResponse !== response) {
        if (nativeResponse) nativeResponse.hidden = responseWasHidden;
        nativeResponse = response;
        responseWasHidden = response.hidden;
      }
      // Keep the native page container, which owns the guide offset and scroll
      // area. Replace only its contents so the dashboard cannot sit under chrome.
      if (response.hidden) response.hidden = false;
      if (panel.parentElement !== response) response.prepend(panel);
      if (control.parentElement !== launch) launch.append(control);
      for (const child of Array.from(response.children)) {
        if (!(child instanceof HTMLElement) || child === panel) continue;
        if (!hidden.has(child)) hidden.set(child, child.hidden);
        if (!child.hidden) child.hidden = true;
        if (!child.hasAttribute('data-lucky-suppressed'))
          child.setAttribute('data-lucky-suppressed', '');
      }
    },
    stop() {
      stopped = true;
      restore();
    },
  };
}
