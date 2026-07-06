import { LiveTvProviderSearchParams } from '../types/live-tv-search.types';

export interface BaseLiveTvProvider {
  name: string;
  search(params: LiveTvProviderSearchParams): Promise<any[]>;
}
