import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Search, X, Filter, RotateCcw, AlertCircle, Wifi, CheckCircle2 } from 'lucide-react';
import { apiService } from '@/services/api.service';
import type { Podcast } from '../types/podcast.types';
import { ModernPodcastCard } from '../components/ModernPodcastCard';
import { EpisodeList } from '../components/EpisodeList';
import { Button, Input, Card } from '@/modules/shared/components/ui';

/**
 * Podcasts Discovery Page (Multi-Provider)
 * Search and discover podcasts from Apple iTunes, Podcast Index, and Taddy
 * Browse and play podcasts with full episode list and player
 *
 * Features:
 * - Debounced search with accessibility
 * - Multi-provider filtering with status indicators
 * - Advanced sorting and filtering options
 * - Robust error handling with retry logic
 * - ARIA labels and keyboard navigation
 * - Recent search history
 */
export const PodcastsPage: React.FC = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'popularity' | 'recent'>('relevance');
  const [selectedProviders] = useState<string[]>(['apple', 'podcast_index', 'taddy']);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [providerStats, setProviderStats] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const itemsPerPage = 24;
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('podcastRecentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (err) {
        console.warn('Failed to parse recent searches:', err);
      }
    }

    // Initialize on mount
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await loadTrendingPodcasts(itemsPerPage);

        if (data && data.length > 0) {
          setPodcasts(data);
          setHasMore(data.length >= itemsPerPage);
        } else {
          const fallbackData = await loadTrendingPodcasts(itemsPerPage);
          setPodcasts(fallbackData || []);
          setHasMore((fallbackData?.length || 0) >= itemsPerPage);
        }
      } catch (err) {
        console.error('Failed to load podcasts:', err);
        setError('Failed to load podcasts. Please try again.');
        setPodcasts([]);
      } finally {
        setIsLoading(false);
      }

      // Load provider stats
      try {
        const stats = await retryWithBackoff(async () => apiService.getPodcastProviderStatus());
        setProviderStats(stats);
      } catch (err) {
        console.warn('Failed to load provider stats:', err);
      }
    })();
  }, []);

  // Debounced search with memoization
  const debouncedSearch = useCallback((_query: string, debounceMs: number = 500) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Will be called through handleSearchChange effect
    }, debounceMs);
  }, []);

  // Save to recent searches
  const saveToRecentSearches = useCallback((query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('podcastRecentSearches', JSON.stringify(updated));
  }, [recentSearches]);

  // Retry logic with exponential backoff
  const retryWithBackoff = useCallback(async (fn: () => Promise<any>, attempt: number = 0): Promise<any> => {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt < MAX_RETRIES && (err.response?.status >= 500 || !navigator.onLine)) {
        setIsNetworkError(!navigator.onLine);
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retryWithBackoff(fn, attempt + 1);
      }
      throw err;
    }
  }, [MAX_RETRIES, RETRY_DELAY]);

  const loadTrendingPodcasts = useCallback(
    (limit: number) => retryWithBackoff(() => apiService.getPopularPodcasts(limit)),
    [retryWithBackoff],
  );

  const handleSearch = async (resetPage = true) => {
    const query = searchQuery.trim();

    try {
      setIsLoading(resetPage);
      setError(null);
      if (resetPage) setCurrentPage(1);

      // Save to recent searches if user initiated the search
      if (searchQuery.trim()) {
        saveToRecentSearches(query);
      }

      const data = query || selectedLanguage
        ? await retryWithBackoff(async () =>
            apiService.searchPodcasts({
              query: query || 'podcast',
              providers: selectedProviders,
              language: selectedLanguage || undefined,
              limit: itemsPerPage,
            })
          )
        : await loadTrendingPodcasts(itemsPerPage);

      console.log('[PodcastsPage] Loaded podcasts for:', query || 'trending');

      if (resetPage) {
        setPodcasts(data || []);
      } else {
        const existingIds = new Set(podcasts.map((p: Podcast) => p.id || p.title));
        const newPodcasts = (data || []).filter((p: Podcast) => !existingIds.has(p.id || p.title));
        setPodcasts([...podcasts, ...newPodcasts]);
      }
      setHasMore((data?.length || 0) >= itemsPerPage);
      setIsNetworkError(false);
    } catch (err: any) {
      console.error('Failed to search podcasts:', err);
      if (!navigator.onLine) {
        setError('No internet connection. Please check your network.');
        setIsNetworkError(true);
      } else {
        setError('Failed to search podcasts. Please try again.');
      }
      if (resetPage) setPodcasts([]);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Only auto-search if user has typed enough characters
    if (value.trim().length > 0) {
      debouncedSearch(value);
    }
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query, 0); // Search immediately for quick searches
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    handleSearch(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLanguage('');
    setSortBy('relevance');
    setShowFilters(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    handleSearch(true);
  };

  const sortedPodcasts = useMemo(() => {
    const sorted = [...podcasts];
    switch (sortBy) {
      case 'popularity':
        return sorted.sort((a: Podcast, b: Podcast) => (b.popularity || 0) - (a.popularity || 0));
      case 'recent':
        return sorted.sort((a: Podcast, b: Podcast) =>
          new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()
        );
      case 'relevance':
      default:
        return sorted;
    }
  }, [podcasts, sortBy]);

  const handlePodcastSelect = (podcast: Podcast) => {
    setSelectedPodcast(podcast);
  };

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setCurrentPage(prev => prev + 1);

    try {
      const newLimit = (currentPage + 1) * itemsPerPage;
      const query = searchQuery.trim();

      const data = query || selectedLanguage
        ? await retryWithBackoff(async () =>
            apiService.searchPodcasts({
              query: query || 'podcast',
              providers: selectedProviders,
              language: selectedLanguage || undefined,
              limit: newLimit,
            })
          )
        : await loadTrendingPodcasts(newLimit);

      const existingIds = new Set(podcasts.map(p => p.id || p.title));
      const newPodcasts = (data || [])
        .slice(podcasts.length)
        .filter((p: Podcast) => !existingIds.has(p.id || p.title));

      if (newPodcasts.length > 0) {
        setPodcasts([...podcasts, ...newPodcasts]);
      }
      setHasMore((newPodcasts.length > 0 && (data?.length || 0) >= newLimit));
      setIsNetworkError(false);
    } catch (err: any) {
      console.error('Failed to load more:', err);
      if (!navigator.onLine) {
        setError('No internet connection. Cannot load more.');
        setIsNetworkError(true);
      }
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getProviderBadges = (podcast: Podcast) => {
    const providers = podcast.sourceProviders || (podcast.source ? [podcast.source] : []);
    const providerColors: Record<string, string> = {
      apple: 'bg-gray-500',
      podcast_index: 'bg-blue-500',
      taddy: 'bg-purple-500',
      local: 'bg-green-500',
    };

    return providers.map((provider: string) => (
      <span
        key={provider}
        className={`${providerColors[provider] || 'bg-slate-500'} text-white text-xs px-2 py-1 rounded-full`}
      >
        {provider.replace('_', ' ')}
      </span>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 text-white py-20">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-8 h-8" />
              <span className="text-sm font-semibold uppercase tracking-wider">Multi-Provider</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              Discover Podcasts
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Search across Apple iTunes, Podcast Index, and more
            </p>

            {/* Search Bar */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative group">
                  <label htmlFor="podcast-search" className="sr-only">Search podcasts by title, host, or topic</label>
                  <Search className="absolute left-4 top-3.5 w-5 h-5 text-white/50 pointer-events-none" />
                  <Input
                    id="podcast-search"
                    placeholder="Search podcasts by title, host, or topic..."
                    className="pl-12 bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:bg-white/25 transition-colors"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch(true)}
                    aria-label="Search podcasts"
                    aria-describedby="search-status"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-4 top-3.5 p-1 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-5 h-5 text-white/70 hover:text-white" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-white/20 border border-white/30 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                  aria-label="Filter by language"
                >
                  <option value="">All Languages</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>

                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`transition-all ${showFilters ? 'bg-white text-purple-600' : 'bg-white/20 text-white hover:bg-white/30'}`}
                  aria-label="Toggle advanced filters"
                  aria-expanded={showFilters}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>

                <Button
                  onClick={() => handleSearch(true)}
                  className="bg-white text-purple-600 hover:bg-white/90 font-semibold transition-all"
                  aria-label="Search podcasts"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>

              {/* Advanced Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sort-select" className="block text-sm font-semibold mb-2">Sort By</label>
                        <select
                          id="sort-select"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'relevance' | 'popularity' | 'recent')}
                          className="w-full bg-white/20 border border-white/30 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                          aria-label="Sort podcasts by"
                        >
                          <option value="relevance">Relevance</option>
                          <option value="popularity">Popularity</option>
                          <option value="recent">Recently Updated</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={clearFilters}
                        variant="ghost"
                        className="bg-white/10 text-white hover:bg-white/20 text-sm"
                      >
                        <RotateCcw className="w-3 h-3 mr-2" />
                        Reset All
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent Searches */}
              {recentSearches.length > 0 && !searchQuery && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10"
                >
                  <p className="text-xs font-semibold text-white/70 mb-2">Recent Searches:</p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        onClick={() => handleQuickSearch(search)}
                        className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-full transition-colors"
                        aria-label={`Search for ${search}`}
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Network Status & Provider Status */}
            <div className="mt-6 space-y-3">
              {isNetworkError && (
                <div className="p-3 bg-red-500/20 border border-red-400/50 rounded-lg flex items-center gap-2 text-red-200">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Connection issues detected. Retrying automatically...</span>
                </div>
              )}

              {Object.keys(providerStats).length > 0 && (
                <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
                  <p className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Provider Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(providerStats).map(([provider, stats]: [string, any]) => (
                      <span key={provider} className="text-xs bg-white/20 px-2.5 py-1.5 rounded-full">
                        <span className="font-medium capitalize">{provider.replace('_', ' ')}</span>
                        {stats.remaining !== null && (
                          <span className="text-white/70"> {stats.remaining}/{stats.limit}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Error State with Retry */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg border flex items-center justify-between ${
              isNetworkError
                ? 'bg-amber-900/20 border-amber-700'
                : 'bg-red-900/20 border-red-700'
            }`}
          >
            <div className="flex items-center gap-3">
              {isNetworkError ? (
                <Wifi className="w-5 h-5 text-amber-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <p className={isNetworkError ? 'text-amber-300' : 'text-red-300'}>{error}</p>
            </div>
            <Button
              onClick={() => handleSearch(true)}
              size="sm"
              className="ml-4 text-xs"
              variant="outline"
            >
              Retry
            </Button>
          </motion.div>
        )}

        {/* Podcasts List */}
        <div className="pb-24">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <Mic className="w-8 h-8 text-purple-600" />
                  {searchQuery ? 'Search Results' : 'Discover Podcasts'}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  {searchQuery
                    ? `${podcasts.length} results found for "${searchQuery}"`
                    : `Popular and trending podcasts (${podcasts.length})`}
                  {selectedLanguage && ` in ${selectedLanguage.toUpperCase()}`}
                </p>
              </div>
              {(searchQuery || selectedLanguage || sortBy !== 'relevance') && (
                <Button
                  onClick={clearFilters}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                  aria-label="Clear all filters"
                >
                  <X className="w-3 h-3" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="space-y-3">
                      <div className="w-full h-48 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : sortedPodcasts.length > 0 ? (
              <>
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.05 },
                    },
                  }}
                >
                  {sortedPodcasts.map((podcast) => (
                    <motion.div
                      key={podcast.id || `${podcast.title}-${podcast.source}`}
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: { opacity: 1, y: 0 },
                      }}
                    >
                      <ModernPodcastCard
                        podcast={podcast}
                        onSelect={handlePodcastSelect}
                        isFavorited={false}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Provider Attribution */}
                <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
                  <p className="mb-2 font-semibold">Results from:</p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(podcasts.flatMap((p) => p.sourceProviders || (p.source ? [p.source] : [])))].map(
                      (provider: string) => (
                        <span key={provider} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
                          {provider.replace('_', ' ')}
                        </span>
                      ),
                    )}
                  </div>
                  <p className="mt-2 text-xs">
                    Showing <span className="font-semibold">{sortedPodcasts.length}</span> podcasts
                    {recentSearches.length > 0 ? ' (deduplicated)' : ' from all providers'}
                  </p>
                </div>

                {/* Load More Button */}
                {hasMore && (
                  <div className="mt-8 text-center">
                    <Button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 transition-all"
                      aria-busy={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Loading more...
                        </>
                      ) : (
                        `Load More Podcasts`
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-12 text-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                <Mic className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-700" />
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery ? 'No results found' : 'No podcasts available'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {searchQuery
                    ? `We couldn't find any podcasts matching "${searchQuery}".`
                    : 'Try adjusting your search or filters.'}
                </p>
                <Button
                  onClick={clearFilters}
                  className="gap-2"
                  aria-label="Clear filters and try again"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Different Filters
                </Button>
              </Card>
            )}
        </div>

        {/* Slide-in Episodes Overlay */}
        <AnimatePresence>
          {selectedPodcast && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPodcast(null)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              />
              {/* Sidebar */}
              <motion.div
                key={selectedPodcast.id || selectedPodcast.title}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed top-16 right-0 bottom-0 w-full md:w-[460px] lg:w-[500px] bg-slate-900 text-white border-l border-slate-800 shadow-2xl z-[70] overflow-y-auto"
              >
                <div className="p-6 space-y-4">
<div className="flex items-center gap-3">
                  {selectedPodcast.imageUrl && (
                    <img
                      src={selectedPodcast.imageUrl}
                      alt={selectedPodcast.title}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Episodes</p>
                    <h3 className="text-lg font-bold line-clamp-2">{selectedPodcast.title}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getProviderBadges(selectedPodcast)}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60">
                  <EpisodeList podcast={selectedPodcast} />
                </div>
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
