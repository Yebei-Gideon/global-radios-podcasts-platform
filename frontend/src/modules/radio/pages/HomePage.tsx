import { Button, Card } from '@/modules/shared/components/ui';
import { apiService } from '@/services/api.service';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle, MapPin, Radio as RadioIcon, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModernStationCard } from '../components/ModernStationCard';
import type { RadioStation } from '../types/radio.types';

interface LocationState {
  country: string | null;
  countryCode: string | null;
  isLoading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

/**
 * Home Page
 * Displays radio stations based on user's current location
 */
export const HomePage: React.FC = () => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [popularStations, setPopularStations] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({
    country: null,
    countryCode: null,
    isLoading: false,
    error: null,
    permissionGranted: false,
  });

  const requestLocation = async () => {
    setLocation(prev => ({ ...prev, isLoading: true, error: null }));

    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        isLoading: false,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Use reverse geocoding to get country
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=3`
          );
          const data = await response.json();

          const countryCode = data.address?.country_code?.toUpperCase() || null;
          const country = data.address?.country || null;

          setLocation({
            country,
            countryCode,
            isLoading: false,
            error: null,
            permissionGranted: true,
          });
        } catch (err) {
          console.error('Geocoding error:', err);
          setLocation(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to determine your location',
            permissionGranted: true,
          }));
        }
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Showing popular stations instead.';
        }
        setLocation({
          country: null,
          countryCode: null,
          isLoading: false,
          error: errorMessage,
          permissionGranted: false,
        });
      }
    );
  };

  const loadLocalStations = async (countryName: string, countryCode?: string | null) => {
    try {
      console.log('[HomePage] Loading local stations for country:', countryName);
      setIsLoading(true);
      setError(null);

      const collectedStations: RadioStation[] = [];
      const seenStationIds = new Set<string>();
      const pageSize = 200;
      const maxPages = 50;

      const fetchCountryPage = async (country: string, page: number) =>
        apiService.searchStations({ country, page, limit: pageSize });

      let currentCountry = countryName;
      let page = 1;
      let shouldRetryWithCode = !!countryCode;

      while (page <= maxPages) {
        const response = await fetchCountryPage(currentCountry, page);
        const batch = response.data || [];

        if (batch.length === 0) {
          if (!collectedStations.length && shouldRetryWithCode && countryCode && currentCountry !== countryCode) {
            currentCountry = countryCode;
            page = 1;
            shouldRetryWithCode = false;
            continue;
          }
          break;
        }

        for (const station of batch) {
          if (!seenStationIds.has(station.id)) {
            seenStationIds.add(station.id);
            collectedStations.push(station);
          }
        }

        if (batch.length < pageSize) {
          break;
        }

        page += 1;
      }

      console.log('[HomePage] Local stations collected:', collectedStations.length);
      setStations(collectedStations);
    } catch (err) {
      console.error('[HomePage] Error loading local stations:', err);
      setError('Failed to load local stations. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPopularStations = async () => {
    try {
      console.log('[HomePage] Loading popular stations');
      setIsLoading(true);
      setError(null);
      const response = await apiService.getStations(1, 8);
      console.log('[HomePage] Popular stations response:', response);
      console.log('[HomePage] response.data type:', typeof response.data, 'Array?', Array.isArray(response.data));
      setPopularStations(response.data || []);
      console.log('[HomePage] State updated, popularStations should have', response.data?.length || 0, 'items');
    } catch (err) {
      console.error('[HomePage] Error loading popular stations:', err);
      setError('Failed to load stations. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const viewMode = location.country ? 'local' : 'popular';
  const displayStations = location.country ? stations : popularStations;

  useEffect(() => {
    // Mount-time location lookup seeds the initial station view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestLocation();
  }, []);

  useEffect(() => {
    if (location.country) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLocalStations(location.country, location.countryCode);
    } else {
      loadPopularStations();
    }
  }, [location.country, location.countryCode]);

  console.log('[HomePage] Current render state:', {
    isLoading,
    viewMode,
    stationsCount: stations.length,
    popularStationsCount: popularStations.length,
    displayStationsCount: displayStations.length,
  });

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 relative z-0">{/* Add relative z-0 */}
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white py-20">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <RadioIcon className="w-8 h-8" />
              <span className="text-sm font-semibold uppercase tracking-wider">Live Broadcasting</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              Radio From Your Location
            </h1>
            <p className="text-xl text-indigo-100 mb-8">
              Discover and listen to radio stations broadcasting in your area and around the world
            </p>
          </motion.div>
        </div>
      </div>

      {/* Location Status Card */}
      <div className="container mx-auto px-4 -mt-8 relative z-20">
        <AnimatePresence mode="wait">
          {location.isLoading ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6 bg-white dark:bg-slate-800 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Detecting your location...</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Please allow location access to see local stations
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : location.permissionGranted && location.country ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                      Broadcasting from {location.country}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Showing {displayStations.length} local radio stations
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : location.error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-100">
                      {location.error}
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Showing popular stations from around the world
                    </p>
                  </div>
                  <Button
                    onClick={requestLocation}
                    variant="outline"
                    className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Stations Section */}
      <div className="container mx-auto px-4 py-12">
        {(() => {
          console.log('[HomePage RENDER] isLoading:', isLoading, 'displayStations.length:', displayStations.length, 'viewMode:', viewMode);
          return null;
        })()}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
              {viewMode === 'local' && location.countryCode ? (
                <>
                  <MapPin className="w-8 h-8 text-indigo-600" />
                  Local Stations
                </>
              ) : (
                <>
                  <TrendingUp className="w-8 h-8 text-indigo-600" />
                  Popular Stations
                </>
              )}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {viewMode === 'local' && location.country
                ? `Radio stations broadcasting in ${location.country}`
                : 'Most popular radio stations worldwide'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <Button
              onClick={() => {
                if (location.country) {
                  loadLocalStations(location.country);
                } else {
                  loadPopularStations();
                }
              }}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="w-full h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : displayStations.length === 0 ? (
          <Card className="p-12 text-center">
            <RadioIcon className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-xl font-semibold mb-2">No stations found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
                {viewMode === 'local' && location.country
                ? `No radio stations available for ${location.country} at the moment.`
                : 'Unable to load stations. Please try again later.'}
            </p>
              {viewMode === 'local' && location.country && (
              <Button onClick={loadPopularStations}>
                View Popular Stations
              </Button>
            )}
          </Card>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
          >
            {displayStations.map((station) => (
                <motion.div
                  key={station.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <ModernStationCard station={station} />
                </motion.div>
              ))}
          </motion.div>
        )}
      </div>

    </div>
  );
};
