// Navigation fills the queue but may leave the embedded player unstarted.
// Start only the requested song, after the new player data has arrived.
export async function startSelectedSong(
  player: () => {
    getVideoData(): { video_id: string };
    playVideo(): void;
  } | null,
  expected: string,
  cancelled: () => boolean,
  timeoutMs = 10000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!cancelled()) {
    const current = player();
    if (current?.getVideoData().video_id === expected) {
      current.playVideo();
      return true;
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
