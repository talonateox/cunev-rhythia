export interface BeatmapData {
  id: number;
  title?: string | null;
  ownerUsername?: string | null;
  albumArt?: string;
  difficulty?: number | null;
  status?: string | null;
  length?: number | null;
  playcount?: number | null;
  created_at?: string | null;
  noteCount?: number | null;
  ranked?: boolean | null;
  beatmapFile?: string | null;
  image?: string | null;
  starRating?: number | null;
  owner?: number | null;
  ownerAvatar?: string | null;
  tags?: string | null;
}

export type TabType = "all" | "ranked" | "legacy" | "downloaded";

export interface TabConfig {
  id: TabType;
  label: string;
  loadData: () => Promise<BeatmapData[]>;
  searchData: (data: BeatmapData[], query: string) => Promise<BeatmapData[]>;
  supportsInfiniteScroll?: boolean;
}

export interface MenuState {
  currentTab: TabType;
  isTabLoading: boolean;
  globalScrollY: number;
  isDragging: boolean;
  searchQuery: string;

  allMaps: BeatmapData[];
  rankedMaps: BeatmapData[];
  legacyMaps: BeatmapData[];
  downloadedMaps: BeatmapData[];

  currentOnlinePage: number;
  isLoadingMoreMaps: boolean;
  hasMoreMaps: boolean;

  enabledDifficulties: Set<number>;

  selectedMapId: number | null;
}

export interface ScrollState {
  globalScrollY: number;
  isDragging: boolean;
  dragStartY: number;
  dragStartScrollY: number;
  lastDragY: number;
  dragVelocity: number;
  lastDragTime: number;
  minScrollY: number;
  maxScrollY: number;
  currentTween: any;
}

export interface MenuEventHandlers {
  onTabSwitch: (newTab: TabType) => Promise<void>;
  onSearch: (query: string) => Promise<void>;
  onScroll: (deltaY: number) => void;
  onLoadMore: () => Promise<void>;
}
