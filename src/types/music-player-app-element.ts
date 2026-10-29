export interface MusicPlayerAppElement extends HTMLElement {
  // navigate accepts a browse ID, not a watch URL.
  navigate(page: string): void;
  handleNavigationEndpoint(endpoint: {
    watchEndpoint: { videoId: string; playlistId: string };
  }): void;
  networkManager: {
    fetch: <ReturnType, Data>(url: string, data: Data) => Promise<ReturnType>;
  };
}
