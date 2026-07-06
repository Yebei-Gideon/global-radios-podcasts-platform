import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Globe,
  Play,
  Search,
  Shield,
  Tv,
  Wifi,
  X,
} from 'lucide-react';
import { apiService } from '@/services/api.service';
import { Button, Card, Input, Select } from '@/modules/shared/components/ui';
import type { LiveTvChannel, LiveTvProviderStatus } from '../types/live-tv.types';

const DEFAULT_LIMIT = 24;

const LiveTvPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [channels, setChannels] = useState<LiveTvChannel[]>([]);
  const [providerStats, setProviderStats] = useState<Record<string, LiveTvProviderStatus>>({});
  const [selectedChannel, setSelectedChannel] = useState<LiveTvChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const activeProviders = useMemo(
    () => Object.values(providerStats).filter((provider) => provider.enabled).map((provider) => provider.name),
    [providerStats],
  );

  const metaTitle = useMemo(() => {
    if (searchTerm) return `Search results for "${searchTerm}"`;
    if (country || language || category) return 'Filtered channels';
    return 'Live TV discovery';
  }, [searchTerm, country, language, category]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);

      const hasFilters = Boolean(searchTerm || country || language || category);
      const response = hasFilters
        ? await apiService.searchLiveTv({
          query: searchTerm || undefined,
          country: country || undefined,
          language: language || undefined,
          tag: category || undefined,
          page,
          limit: DEFAULT_LIMIT,
          providers: activeProviders.length ? activeProviders : undefined,
        })
        : await apiService.getLiveTvChannels(page, DEFAULT_LIMIT);

      setChannels(response.data || []);
    } catch (err) {
      console.error('[LiveTvPage] Failed to load channels:', err);
      setError('Failed to load live TV channels. Please try again.');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProviderStats = async () => {
    try {
      setLoadingProviders(true);
      const stats = await apiService.getLiveTvProviders();
      setProviderStats(stats);
    } catch (err) {
      console.error('[LiveTvPage] Failed to load provider stats:', err);
      setProviderStats({});
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    void loadProviderStats();
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [page, searchTerm, country, language, category, activeProviders]);

  const handleSearch = () => {
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setCountry('');
    setLanguage('');
    setCategory('');
    setPage(1);
  };

  const derivedCountries = useMemo(() => {
    return Array.from(new Set(channels.map((channel) => channel.country).filter(Boolean))) as string[];
  }, [channels]);

  const derivedLanguages = useMemo(() => {
    return Array.from(new Set(channels.map((channel) => channel.language).filter(Boolean))) as string[];
  }, [channels]);

  const derivedCategories = useMemo(() => {
    return Array.from(new Set(channels.map((channel) => channel.category).filter(Boolean))) as string[];
  }, [channels]);

  const totalPages = useMemo(() => {
    if (!channels.length) return page;
    return page + (channels.length === DEFAULT_LIMIT ? 1 : 0);
  }, [channels.length, page]);

  return (
    <div className="min-h-screen pb-24 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_42%,#111827_100%)] text-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-25 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[64px_64px]" />

      <div className="relative z-10 container mx-auto px-4 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
            <Tv className="h-4 w-4" />
            Multi-provider live television
          </div>

          <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight">
            Live television from around the globe.
          </h1>
          <p className="mt-4 max-w-3xl text-base md:text-xl text-slate-300 leading-relaxed">
            Discover broadcast channels across countries, languages, and categories from the enabled IPTV providers.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.8fr))_auto] items-end">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</label>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="Search channels, countries, networks, or categories"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Country</label>
              <Select
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setPage(1);
                }}
                className="bg-white/5 border-white/10 text-white"
              >
                <option value="">All countries</option>
                {derivedCountries.map((value) => (
                  <option key={value} value={value} className="text-slate-950">
                    {value}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Language</label>
              <Select
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setPage(1);
                }}
                className="bg-white/5 border-white/10 text-white"
              >
                <option value="">All languages</option>
                {derivedLanguages.map((value) => (
                  <option key={value} value={value} className="text-slate-950">
                    {value}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Category</label>
              <Select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
                className="bg-white/5 border-white/10 text-white"
              >
                <option value="">All categories</option>
                {derivedCategories.map((value) => (
                  <option key={value} value={value} className="text-slate-950">
                    {value}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSearch} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button onClick={clearFilters} variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              {loadingProviders ? 'Loading providers...' : `${Object.keys(providerStats).length} providers online`}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Showing page {page} of {totalPages}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              {metaTitle}
            </div>
          </div>

          {Object.keys(providerStats).length > 0 && (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.values(providerStats).map((provider) => (
                <div
                  key={provider.name}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{provider.name.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-slate-400">
                        {provider.enabled ? 'Enabled' : 'Disabled'} {provider.available ? '• available' : '• offline'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${provider.available ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                      {provider.priority}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <Shield className="h-4 w-4" />
                    {provider.rateLimit ? `Rate limit ${provider.rateLimit}` : 'No rate limit reported'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="relative z-10 container mx-auto px-4 pb-12">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
            <Button onClick={() => void loadChannels()} variant="outline" className="border-amber-300/30 bg-amber-50/10 text-amber-50 hover:bg-amber-50/20">
              Retry
            </Button>
          </motion.div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">{metaTitle}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Explore live channels and open any stream in the preview player.
            </p>
          </div>
          {(searchTerm || country || language || category) && (
            <Button onClick={clearFilters} variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Clear filters
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: DEFAULT_LIMIT }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="h-44 rounded-2xl bg-white/10" />
                <div className="mt-4 h-4 w-3/4 rounded-full bg-white/10" />
                <div className="mt-3 h-3 w-1/2 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        ) : channels.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {channels.map((channel, index) => (
                <motion.article
                  key={channel.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                >
                  <Card className="group h-full overflow-hidden border-white/10 bg-slate-950/70 text-white shadow-2xl shadow-cyan-950/20 backdrop-blur-sm">
                    <div className="relative h-56 overflow-hidden bg-linear-to-br from-slate-900 via-cyan-950 to-slate-800">
                      {channel.logoUrl ? (
                        <img
                          src={channel.logoUrl}
                          alt={channel.name}
                          className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Tv className="h-20 w-20 text-cyan-200/30" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/30 to-transparent" />
                      <div className="absolute left-4 top-4 flex gap-2">
                        <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg">
                          Live
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          {channel.source.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <div className="absolute inset-x-4 bottom-4">
                        <h3 className="text-xl font-bold leading-tight text-white line-clamp-2">
                          {channel.name}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
                          {channel.country && (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">{channel.country}</span>
                          )}
                          {channel.language && (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">{channel.language}</span>
                          )}
                          {channel.category && (
                            <span className="rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">{channel.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Source</p>
                          <p className="mt-1 font-semibold text-white">{channel.sourceProviders?.length ? channel.sourceProviders.join(', ') : channel.source}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Quality</p>
                          <p className="mt-1 font-semibold text-white">{channel.quality || 'Adaptive'}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            setSelectedChannel(channel);
                            setPlayerError(null);
                          }}
                          className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Watch
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => window.open(channel.websiteUrl || channel.streamUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <Globe className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.article>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 backdrop-blur-sm">
              <p>
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={channels.length < DEFAULT_LIMIT}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-sm">
            <Tv className="mx-auto h-12 w-12 text-cyan-200" />
            <h3 className="mt-4 text-2xl font-bold text-white">No channels found</h3>
            <p className="mt-2 text-slate-400">
              Try broadening your filters or searching by channel name, country, or category.
            </p>
            <Button onClick={clearFilters} className="mt-6 bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold">
              Reset filters
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedChannel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-xl"
            onClick={() => setSelectedChannel(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              className="w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Now watching</p>
                  <h3 className="text-lg font-bold text-white">{selectedChannel.name}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedChannel(null)} className="text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
                <div className="bg-black">
                  <video
                    key={selectedChannel.id}
                    className="aspect-video w-full bg-black"
                    controls
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    poster={selectedChannel.logoUrl}
                    onError={() => setPlayerError('This stream could not be played in the browser preview. Try opening the direct stream instead.')}
                    src={selectedChannel.streamUrl}
                  />
                </div>

                <div className="space-y-4 p-4 md:p-6 text-slate-200">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      <Wifi className="h-4 w-4" />
                      Stream details
                    </div>
                    <p className="mt-2 text-xl font-bold text-white">{selectedChannel.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {selectedChannel.country || 'Global'}
                      {selectedChannel.language ? ` • ${selectedChannel.language}` : ''}
                      {selectedChannel.category ? ` • ${selectedChannel.category}` : ''}
                    </p>
                  </div>

                  {playerError && (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {playerError}
                    </div>
                  )}

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Source</span>
                      <span className="font-semibold text-white">{selectedChannel.source.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Quality</span>
                      <span className="font-semibold text-white">{selectedChannel.quality || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">Updated</span>
                      <span className="font-semibold text-white">{selectedChannel.lastUpdated || 'Recently'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold"
                      onClick={() => window.open(selectedChannel.streamUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open stream
                    </Button>
                    {selectedChannel.websiteUrl && (
                      <Button
                        variant="outline"
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => window.open(selectedChannel.websiteUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Channel website
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveTvPage;
