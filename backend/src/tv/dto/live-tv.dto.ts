export class LiveTvChannelDto {
  id: string;
  name: string;
  streamUrl: string;
  country?: string;
  countryCode?: string;
  language?: string;
  category?: string;
  logoUrl?: string;
  websiteUrl?: string;
  groupTitle?: string;
  referrer?: string;
  userAgent?: string;
  quality?: string;
  source: string;
  sourceProviders?: string[];
  lastUpdated?: string;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
