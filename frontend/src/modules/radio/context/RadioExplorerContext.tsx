import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { apiService } from '@/services/api.service';
import type { Country, RadioStation } from '../types/radio.types';

interface RadioExplorerContextType {
  allStations: RadioStation[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  isNetworkError: boolean;
  countries: Country[];
  loadStations: () => Promise<void>;
}

const RadioExplorerContext = createContext<RadioExplorerContextType | undefined>(undefined);

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const RadioExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allStations, setAllStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const retryWithBackoff = useCallback(async <T,>(fn: () => Promise<T>, attempt = 0): Promise<T> => {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt < MAX_RETRIES && (err.response?.status >= 500 || !navigator.onLine)) {
        setIsNetworkError(!navigator.onLine);
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return retryWithBackoff(fn, attempt + 1);
      }
      throw err;
    }
  }, []);

  const loadStations = useCallback(async () => {
    if (isFetchingRef.current || hasLoadedRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    setIsNetworkError(false);

    try {
      const firstBatch = await retryWithBackoff(() => apiService.getStations(1, 100));
      const stations: RadioStation[] = firstBatch.data || [];
      setAllStations(stations);
      hasLoadedRef.current = true;
      setLoading(false);

      void retryWithBackoff(() => apiService.getCountries())
        .then((countriesData) => setCountries(countriesData))
        .catch((err) => {
          console.warn('Failed to fetch radio filter options:', err);
        });

      const hasMore =
        (firstBatch.meta?.page ?? 1) < (firstBatch.meta?.totalPages ?? 1) &&
        (firstBatch.data?.length || 0) > 0;

      if (hasMore) {
        setLoadingMore(true);
        let page = 2;
        let continueLoading = true;

        while (continueLoading) {
          try {
            const stationsData = await retryWithBackoff(() => apiService.getStations(page, 100));

            if (stationsData.data && stationsData.data.length > 0) {
              setAllStations((prev) => [...prev, ...stationsData.data]);
              const currentPageMeta = stationsData.meta?.page ?? page;
              const totalPagesMeta = stationsData.meta?.totalPages ?? page;
              continueLoading = currentPageMeta < totalPagesMeta;
              page += 1;
            } else {
              continueLoading = false;
            }
          } catch (err) {
            console.warn(`Failed to fetch radio stations page ${page}:`, err);
            continueLoading = false;
          }
        }

        setLoadingMore(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load radio stations';
      setError(message);
      console.error('Error fetching radio stations:', err);
      setIsNetworkError(!navigator.onLine);
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [retryWithBackoff]);

  const value = useMemo(
    () => ({
      allStations,
      loading,
      loadingMore,
      error,
      isNetworkError,
      countries,
      loadStations,
    }),
    [allStations, loading, loadingMore, error, isNetworkError, countries, loadStations]
  );

  return <RadioExplorerContext.Provider value={value}>{children}</RadioExplorerContext.Provider>;
};

export const useRadioExplorer = () => {
  const context = useContext(RadioExplorerContext);

  if (!context) {
    throw new Error('useRadioExplorer must be used within a RadioExplorerProvider');
  }

  return context;
};
