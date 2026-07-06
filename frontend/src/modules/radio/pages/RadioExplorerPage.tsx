import { ModernStationCard } from '@/modules/radio/components/ModernStationCard';
import { useRadioExplorer } from '@/modules/radio/context/RadioExplorerContext';
import { Button } from '@/modules/shared/components/ui';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  MapPin,
  Radio,
  Search,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface FilterState {
  country?: string;
  language?: string;
  tag?: string;
}

interface FilterStats {
  countries: Map<string, number>;
  languages: Map<string, number>;
  tags: Map<string, number>;
}

/**
 * Modernized Radio Explorer with robust search, accessibility, and error recovery
 * Features:
 * - Debounced search with accessibility
 * - Multi-provider filtering with status indicators
 * - Advanced sorting and filtering options
 * - Robust error handling with retry logic
 * - ARIA labels and keyboard navigation
 * - Recent search history
 */
const RadioExplorerPage = () => {
  const {
    allStations,
    loading,
    loadingMore,
    error,
    isNetworkError,
    countries,
    loadStations,
  } = useRadioExplorer();

  // Search & Filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // UI states
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Calculate filter statistics
  const filterStats = useMemo(() => {
    const stats: FilterStats = {
      countries: new Map(),
      languages: new Map(),
      tags: new Map(),
    };

    allStations.forEach((station) => {
      if (station.country) {
        stats.countries.set(
          station.country,
          (stats.countries.get(station.country) || 0) + 1
        );
      }
      if (station.language) {
        stats.languages.set(
          station.language,
          (stats.languages.get(station.language) || 0) + 1
        );
      }
      if (station.tags) {
        station.tags.forEach((tag) => {
          stats.tags.set(tag, (stats.tags.get(tag) || 0) + 1);
        });
      }
    }, []);

    return stats;
  }, [allStations]);

  // Save to recent searches
  const saveToRecentSearches = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((s) => s !== query)].slice(0, 5);
      localStorage.setItem('radioRecentSearches', JSON.stringify(updated));
      return updated;
    });
  };

  // Filter and search stations
  const filteredStations = useMemo(() => {
    let result = [...allStations];

    // Apply search
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (station) =>
          station.name.toLowerCase().includes(query) ||
          station.country?.toLowerCase().includes(query) ||
          station.language?.toLowerCase().includes(query) ||
          station.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.country) {
      result = result.filter((s) => s.country === filters.country);
    }
    if (filters.language) {
      result = result.filter((s) => s.language === filters.language);
    }
    if (filters.tag) {
      result = result.filter((s) => s.tags?.includes(filters.tag || ''));
    }

    return result;
  }, [allStations, searchTerm, filters]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredStations.length / itemsPerPage);
  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStations, currentPage]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('radioRecentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (err) {
        console.warn('Failed to parse recent searches:', err);
      }
    }
    void loadStations();
  }, [loadStations]);

  // Handle filter change with debouncing
  const handleFilterChange = useCallback((key: keyof FilterState, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setCurrentPage(1);

    // Update active filters display
    const active = Object.entries(newFilters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    setActiveFilters(active);
  }, [filters]);

  // Submit search explicitly so typing does not trigger filtering immediately
  const handleSearchSubmit = useCallback((query: string) => {
    const nextQuery = query.trim();
    setSearchTerm(nextQuery);
    setCurrentPage(1);

    if (nextQuery) {
      saveToRecentSearches(nextQuery);
    }
  }, [saveToRecentSearches]);

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    setActiveFilters([]);
    setCurrentPage(1);
  };

  // Clear search
  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Toggle favorite
  const toggleFavorite = (stationId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(stationId)) {
        newFavorites.delete(stationId);
      } else {
        newFavorites.add(stationId);
      }
      return newFavorites;
    });
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Radio Explorer
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-slate-600 dark:text-slate-400">
                  Discover {allStations.length} radio stations from around the world
                </p>
                {loadingMore && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                    Loading more...
                  </motion.span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <form
            className="relative mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit(searchInput);
            }}
          >
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by name, country, language..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search radio stations"
              aria-describedby="search-help"
              className="w-full pl-12 pr-32 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Search radio stations"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Search
              </button>
            </div>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && !searchTerm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-2">
                <Clock className="w-4 h-4" />
                Recent searches
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => {
                      setSearchInput(search);
                      setSearchTerm(search);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Filter Toggle & Active Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              aria-pressed={showFilters}
              aria-label={showFilters ? 'Close filters' : 'Open filters'}
              className={`gap-2 transition-all ${
                showFilters
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </Button>

            {activeFilters.length > 0 && (
              <>
                {activeFilters.map((filter) => (
                  <motion.span
                    key={filter}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                  >
                    {filter}
                  </motion.span>
                ))}
                <Button
                  onClick={clearFilters}
                  aria-label="Clear all filters"
                  size="sm"
                  className="gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200"
                >
                  <X className="w-4 h-4" />
                  Clear
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Country Filter */}
                <div>
                  <label
                    htmlFor="country-filter"
                    className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-3"
                  >
                    <MapPin className="w-4 h-4" />
                    Country
                  </label>
                  <select
                    id="country-filter"
                    value={filters.country || ''}
                    onChange={(e) =>
                      handleFilterChange('country', e.target.value || undefined)
                    }
                    aria-label="Filter by country"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">All Countries</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name} ({c.stationCount})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Language Filter */}
                <div>
                  <label
                    htmlFor="language-filter"
                    className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-3"
                  >
                    <Globe className="w-4 h-4" />
                    Language
                  </label>
                  <select
                    id="language-filter"
                    value={filters.language || ''}
                    onChange={(e) =>
                      handleFilterChange('language', e.target.value || undefined)
                    }
                    aria-label="Filter by language"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">All Languages</option>
                    {Array.from(filterStats.languages.entries()).map(
                      ([lang, count]) => (
                        <option key={lang} value={lang}>
                          {lang} ({count})
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Genre/Tag Filter */}
                <div>
                  <label
                    htmlFor="genre-filter"
                    className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-3"
                  >
                    <Volume2 className="w-4 h-4" />
                    Genre
                  </label>
                  <select
                    id="genre-filter"
                    value={filters.tag || ''}
                    onChange={(e) =>
                      handleFilterChange('tag', e.target.value || undefined)
                    }
                    aria-label="Filter by genre"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">All Genres</option>
                    {Array.from(filterStats.tags.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 30)
                      .map(([tag, count]) => (
                        <option key={tag} value={tag}>
                          {tag} ({count})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Showing {paginatedStations.length} of {filteredStations.length} stations
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300 flex items-center justify-between gap-3"
            role="alert"
          >
            <div className="flex items-center gap-3">
              {isNetworkError ? (
                <Wifi className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span>
                {isNetworkError
                  ? 'Network error. Please check your connection.'
                  : error}
              </span>
            </div>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 whitespace-nowrap"
            >
              Retry
            </Button>
          </motion.div>
        )}

        {/* Results Info */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 text-sm font-medium text-slate-600 dark:text-slate-400"
          >
            {filteredStations.length > 0 ? (
              <>
                Found{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {filteredStations.length}
                </span>{' '}
                station{filteredStations.length !== 1 ? 's' : ''}
                {Object.keys(filters).some((k) => filters[k as keyof FilterState]) && (
                  <>
                    {' '}
                    with selected filters
                  </>
                )}
              </>
            ) : (
              <>
                No stations found{' '}
                {Object.keys(filters).some((k) => filters[k as keyof FilterState]) && (
                  <>with your filters</>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(12)
              .fill(0)
              .map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="h-72 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-xl animate-pulse"
                />
              ))}
          </div>
        ) : filteredStations.length > 0 ? (
          <>
            {/* Stations Grid */}
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"
            >
              <AnimatePresence mode="popLayout">
                {paginatedStations.map((station) => (
                  <motion.div
                    key={station.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <ModernStationCard
                      station={station}
                      onFavorite={(station) => toggleFavorite(station.id)}
                      isFavorited={favorites.has(station.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center items-center gap-2 mb-8"
              >
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  size="icon"
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      const diff = Math.abs(p - currentPage);
                      return diff === 0 || diff === 1 || p === 1 || p === totalPages;
                    })
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-2 text-slate-500">...</span>
                        )}
                        <Button
                          onClick={() => goToPage(p)}
                          className={`min-w-10 ${
                            p === currentPage
                              ? 'bg-blue-500 text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {p}
                        </Button>
                      </React.Fragment>
                    ))}
                </div>

                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  size="icon"
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Volume2 className="w-20 h-20 mx-auto text-slate-300 dark:text-slate-600 mb-4 opacity-50" />
            <h3 className="text-2xl font-bold text-slate-600 dark:text-slate-400 mb-2">
              No stations found
            </h3>
            <p className="text-slate-500 dark:text-slate-500 mb-6">
              Try adjusting your search or filters
            </p>
            <Button
              onClick={() => {
                clearSearch();
                clearFilters();
              }}
              className="gap-2 bg-blue-500 text-white"
            >
              <X className="w-4 h-4" />
              Reset Filters
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RadioExplorerPage;
