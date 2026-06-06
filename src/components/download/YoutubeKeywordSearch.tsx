import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CheckSquare,
  ListPlus,
  Loader2,
  Plus,
  Search,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extractBackendError, localizeBackendError } from '@/lib/backend-error';
import type {
  YoutubeSearchQueueResult,
  YoutubeSearchResponse,
  YoutubeSearchVideo,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const STORAGE_KEY = 'youwee-youtube-keyword-search-state';

interface YoutubeKeywordSearchProps {
  disabled?: boolean;
  onBack: () => void;
  onAddResults: (results: YoutubeSearchVideo[]) => Promise<YoutubeSearchQueueResult>;
  queuedVideoIds: Set<string>;
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.round(value)));
}

function mergeVideos(
  current: YoutubeSearchVideo[],
  incoming: YoutubeSearchVideo[],
): YoutubeSearchVideo[] {
  const seen = new Set(current.map((video) => video.id));
  const merged = [...current];
  for (const video of incoming) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    merged.push(video);
  }
  return merged;
}

interface StoredYoutubeKeywordSearchState {
  query?: string;
  limit?: number;
  videos?: YoutubeSearchVideo[];
  selectedIds?: string[];
  continuation?: string | null;
}

function loadStoredState(): StoredYoutubeKeywordSearchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredYoutubeKeywordSearchState;
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      limit: clampLimit(Number(parsed.limit)),
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [],
      continuation: typeof parsed.continuation === 'string' ? parsed.continuation : null,
    };
  } catch {
    return {};
  }
}

function SearchResultGridItem({
  video,
  selected,
  isAdded,
  onToggle,
  disabled,
}: {
  video: YoutubeSearchVideo;
  selected: boolean;
  isAdded: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation('download');

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isAdded}
      className={cn(
        'group relative flex flex-col text-left transition-all duration-300 rounded-xl focus:outline-none',
        isAdded ? 'cursor-not-allowed opacity-70 grayscale-[0.4]' : 'cursor-pointer',
      )}
    >
      {/* Thumbnail Area */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            className={cn(
              'w-full h-full object-cover transition-transform duration-500',
              !isAdded && 'group-hover:scale-105',
            )}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Video className="w-8 h-8" />
          </div>
        )}

        {/* Selected Border & Tint Overlay */}
        {selected && !isAdded && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-primary bg-primary/10 z-10 pointer-events-none transition-all duration-300" />
        )}

        {/* Checkbox Icon (Hover & Selected) */}
        {!isAdded && (
          <div
            className={cn(
              'absolute top-2 left-2 z-20 transition-opacity duration-200',
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            {selected ? (
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-2 ring-background">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-white/80 bg-black/20 backdrop-blur-sm flex items-center justify-center shadow-sm transition-colors hover:bg-black/40" />
            )}
          </div>
        )}

        {/* Subtle top gradient for hover checkbox visibility */}
        {!isAdded && !selected && (
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
        )}

        {/* Added Overlay */}
        {isAdded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px]" />
            <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold">{t('urlInput.keyword.added')}</span>
            </div>
          </div>
        )}

        {/* Duration */}
        {video.duration && !isAdded && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[12px] font-medium text-white bg-black/80 tracking-wide backdrop-blur-md">
            {video.duration}
          </span>
        )}
      </div>

      {/* Info Area */}
      <div className="flex gap-3 items-start mt-3 px-1">
        <div className="flex-1 min-w-0 flex flex-col">
          <p
            className="text-sm font-medium leading-tight line-clamp-2 text-foreground"
            title={video.title}
          >
            {video.title}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-[13px] text-muted-foreground/80">
            {video.channel && (
              <span className="truncate hover:text-foreground transition-colors">
                {video.channel}
              </span>
            )}
            <div className="flex items-center gap-1.5 truncate">
              {video.view_count_text && <span>{video.view_count_text}</span>}
              {video.view_count_text && video.published_time_text && <span>•</span>}
              {video.published_time_text && <span>{video.published_time_text}</span>}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function YoutubeKeywordSearch({
  disabled,
  onBack,
  onAddResults,
  queuedVideoIds,
}: YoutubeKeywordSearchProps) {
  const { t } = useTranslation('download');
  const [storedState] = useState(loadStoredState);
  const [query, setQuery] = useState(storedState.query || '');
  const [limit, setLimit] = useState(clampLimit(storedState.limit || DEFAULT_LIMIT));
  const [videos, setVideos] = useState<YoutubeSearchVideo[]>(storedState.videos || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(storedState.selectedIds || []),
  );
  const [continuation, setContinuation] = useState<string | null>(storedState.continuation || null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVideos = useMemo(
    () => videos.filter((video) => selectedIds.has(video.id) && !queuedVideoIds.has(video.id)),
    [queuedVideoIds, selectedIds, videos],
  );

  useEffect(() => {
    try {
      const state: StoredYoutubeKeywordSearchState = {
        query,
        limit,
        videos,
        selectedIds: Array.from(selectedIds),
        continuation,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage failures
    }
  }, [continuation, limit, query, selectedIds, videos]);

  const runSearch = useCallback(
    async (nextContinuation?: string | null) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      const loadingMore = Boolean(nextContinuation);
      if (loadingMore) {
        setIsLoadingMore(true);
      } else {
        setIsSearching(true);
        setVideos([]);
        setSelectedIds(new Set());
        setContinuation(null);
      }
      setError(null);

      try {
        const response = await invoke<YoutubeSearchResponse>('search_youtube_videos', {
          query: trimmedQuery,
          limit: clampLimit(limit),
          continuation: nextContinuation || null,
        });

        setVideos((current) =>
          loadingMore ? mergeVideos(current, response.videos) : response.videos,
        );
        setContinuation(response.continuation || null);
      } catch (searchError) {
        const payload = extractBackendError(searchError);
        setError(localizeBackendError(payload));
      } finally {
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    },
    [limit, query],
  );

  const toggleSelected = useCallback(
    (id: string) => {
      if (queuedVideoIds.has(id)) return;
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [queuedVideoIds],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(
      new Set(videos.filter((video) => !queuedVideoIds.has(video.id)).map((video) => video.id)),
    );
  }, [queuedVideoIds, videos]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const addSelected = useCallback(async () => {
    if (selectedVideos.length === 0) return;
    setIsAdding(true);
    try {
      const result = await onAddResults(selectedVideos);
      if (result.queuedIds.length > 0) {
        setSelectedIds((current) => {
          const next = new Set(current);
          for (const id of result.queuedIds) {
            next.delete(id);
          }
          return next;
        });
      }
    } finally {
      setIsAdding(false);
    }
  }, [onAddResults, selectedVideos]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch();
  };

  const hasResults = videos.length > 0;
  const busy = disabled || isSearching || isLoadingMore || isAdding;

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border border-border/50 overflow-hidden shadow-sm relative">
      {/* Header & Search Form */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/20">
        <div className="p-4 sm:p-6 sm:pb-5 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={t('urlInput.keyword.back')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-semibold leading-none text-foreground tracking-tight">
                {t('urlInput.keyword.pageTitle')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                {t('urlInput.keyword.pageDescription')}
              </p>
            </div>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={disabled || isSearching}
                placeholder={t('urlInput.keyword.placeholder')}
                className="pl-10 h-12 rounded-xl bg-background border-border/60 focus:bg-background text-base sm:text-sm shadow-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={String(limit)}
                onValueChange={(val) => setLimit(Number(val))}
                disabled={disabled || isSearching}
              >
                <SelectTrigger
                  className="w-[85px] h-12 rounded-xl bg-background border-border/60 shadow-sm"
                  aria-label={t('urlInput.keyword.limitLabel')}
                >
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                disabled={disabled || isSearching || !query.trim()}
                className="h-12 px-6 rounded-xl font-medium shadow-sm transition-all"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{t('urlInput.keyword.search')}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-[300px] relative bg-muted/20">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {t('urlInput.keyword.errorTitle')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
        ) : isSearching ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary/40" />
            <p className="text-sm font-medium animate-pulse">{t('urlInput.keyword.searching')}</p>
          </div>
        ) : !hasResults ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-background flex items-center justify-center mb-5 border border-border/50 shadow-sm">
              <Video className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1.5">
              {t('urlInput.keyword.emptyTitle')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t('urlInput.keyword.emptyDescription')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pb-24 sm:pb-28">
              {videos.map((video) => (
                <SearchResultGridItem
                  key={video.id}
                  video={video}
                  selected={selectedIds.has(video.id)}
                  isAdded={queuedVideoIds.has(video.id)}
                  onToggle={() => toggleSelected(video.id)}
                  disabled={busy}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Action Bar (Floating Pill Style) */}
      {hasResults && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-fit px-4 pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-background/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60 border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-full p-1.5 flex items-center gap-1 sm:gap-2 pointer-events-auto ring-1 ring-white/10 transition-all">
            {/* Selection Status */}
            <div className="hidden sm:flex items-center pl-4 pr-2 py-1.5">
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                {t('urlInput.keyword.selectedCount', {
                  selected: selectedVideos.length,
                  total: videos.length,
                })}
              </span>
            </div>

            {/* Mobile Selection Status */}
            <div className="sm:hidden flex items-center pl-3 pr-1 py-1.5">
              <span className="text-sm font-bold text-foreground whitespace-nowrap">
                {selectedVideos.length}/{videos.length}
              </span>
            </div>

            <div className="w-px h-5 bg-border/60 mx-1" />

            {/* Controls */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={selectAll}
                disabled={busy || videos.every((v) => queuedVideoIds.has(v.id))}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                title={t('urlInput.keyword.selectAll')}
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearSelection}
                disabled={busy || selectedVideos.length === 0}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={t('urlInput.keyword.clearSelection')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="w-px h-5 bg-border/60 mx-1" />

            {/* Load More & Add */}
            <div className="flex items-center gap-1.5 pr-0.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runSearch(continuation)}
                disabled={busy || !continuation}
                className="h-9 px-4 rounded-full text-sm font-medium bg-secondary/60 hover:bg-secondary/80 transition-colors"
              >
                {isLoadingMore ? (
                  <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
                ) : (
                  <ListPlus className="w-4 h-4 sm:mr-1.5" />
                )}
                <span className="hidden sm:inline">{t('urlInput.keyword.loadMore')}</span>
              </Button>
              <Button
                type="button"
                onClick={() => void addSelected()}
                disabled={busy || selectedVideos.length === 0}
                className="h-9 px-5 rounded-full text-sm font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-95"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 sm:mr-1.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 sm:mr-1.5" />
                )}
                <span className="hidden sm:inline">{t('urlInput.keyword.addSelected')}</span>
                <span className="sm:hidden">{t('urlInput.keyword.addSelected').split(' ')[0]}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
