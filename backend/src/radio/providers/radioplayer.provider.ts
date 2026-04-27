import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ProviderRadioResult, RadioProviderConfig, RadioProviderName, RadioProviderSearchParams } from '../types/radio-search.types';
import { BaseRadioProvider } from './base-radio-provider';

/**
 * Radioplayer Partner API Provider
 * Official UK radio directory with global coverage
 * API: https://partner.radioplayer.co.uk/
 */
@Injectable()
export class RadioplayerProvider implements BaseRadioProvider {
	readonly name: RadioProviderName = 'radioplayer';
	private readonly logger = new Logger(RadioplayerProvider.name);
	private config: RadioProviderConfig;
	private client: AxiosInstance;

	constructor() {
		this.client = axios.create({
			baseURL: 'https://partner.radioplayer.co.uk/v2',
			timeout: 10000,
		});
	}

	configure(config: RadioProviderConfig): void {
		this.config = config;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.client.get('/stations', {
				params: { limit: 1 },
				timeout: 5000
			});
			return true;
		} catch (error) {
			this.logger.warn(`Radioplayer provider unavailable: ${error.message}`);
			return false;
		}
	}

	requiresAuthentication(): boolean {
		return false; // Public API
	}

	async search(params: RadioProviderSearchParams): Promise<ProviderRadioResult[]> {
		if (!this.config?.enabled) {
			return [];
		}

		try {
			const results: ProviderRadioResult[] = [];

			// If no search params, get popular stations
			if (!params.name && !params.country && !params.language && !params.tag) {
				const popularResults = await this.searchPopular(params.limit);
				results.push(...popularResults);
			} else {
				// Search by name if provided
				if (params.name) {
					const searchResults = await this.searchByName(params.name, params.limit);
					results.push(...searchResults);
				}

				// Search by country if provided
				if (params.country && results.length < params.limit) {
					const countryResults = await this.searchByCountry(params.country, params.limit - results.length);
					results.push(...countryResults);
				}
			}

			// Apply language filter if provided
			let filtered = results;
			if (params.language) {
				const lang = params.language.toLowerCase();
				filtered = results.filter(s => s.language?.toLowerCase().includes(lang));
			}

			// Apply tag filter if provided
			if (params.tag) {
				const tag = params.tag.toLowerCase();
				filtered = filtered.filter(s =>
					s.tags?.some(t => t.toLowerCase().includes(tag))
				);
			}

			this.logger.log(`Radioplayer provider returned ${filtered.length} stations`);
			return filtered.slice(0, params.limit);
		} catch (error) {
			this.logger.error(`Radioplayer search failed: ${error.message}`);
			return [];
		}
	}

	private async searchPopular(limit: number): Promise<ProviderRadioResult[]> {
		try {
			const response = await this.client.get('/stations', {
				params: {
					limit: Math.min(limit, 100),
					sort: 'popularity',
				},
			});

			const stations = response.data?.data || [];
			return stations.map((s: any) => this.normalize(s));
		} catch (error) {
			this.logger.warn(`Radioplayer popular search failed: ${error.message}`);
			return [];
		}
	}

	private async searchByName(name: string, limit: number): Promise<ProviderRadioResult[]> {
		try {
			const response = await this.client.get('/stations', {
				params: {
					q: name,
					limit: Math.min(limit, 100),
				},
			});

			const stations = response.data?.data || [];
			return stations.map((s: any) => this.normalize(s));
		} catch (error) {
			this.logger.warn(`Radioplayer name search failed: ${error.message}`);
			return [];
		}
	}

	private async searchByCountry(country: string, limit: number): Promise<ProviderRadioResult[]> {
		try {
			const response = await this.client.get('/stations', {
				params: {
					country: country,
					limit: Math.min(limit, 100),
				},
			});

			const stations = response.data?.data || [];
			return stations.map((s: any) => this.normalize(s));
		} catch (error) {
			this.logger.warn(`Radioplayer country search failed: ${error.message}`);
			return [];
		}
	}

	private normalize(raw: any): ProviderRadioResult {
		return {
			id: raw.id || raw.rpuid,
			name: raw.name,
			streamUrl: this.extractStreamUrl(raw),
			country: raw.country,
			countryCode: raw.countryCode || raw.country_code,
			city: raw.city,
			language: raw.language,
			tags: this.extractTags(raw),
			homepage: raw.website || raw.homepage,
			favicon: raw.logo || raw.image || raw.favicon,
			bitrate: raw.bitrate || 128,
			codec: raw.codec || 'mp3',
			source: this.name,
			sourceProviders: [this.name],
		};
	}

	private extractStreamUrl(raw: any): string {
		// Try various possible stream URL fields
		return raw.streamUrl ||
			raw.stream_url ||
			raw.liveStreams?.[0]?.url ||
			raw.url ||
			`https://www.radioplayer.co.uk/live/${raw.rpuid}`;
	}

	private extractTags(raw: any): string[] {
		const tags: string[] = [];

		if (raw.genre) tags.push(raw.genre);
		if (raw.genres) tags.push(...(Array.isArray(raw.genres) ? raw.genres : [raw.genres]));
		if (raw.category) tags.push(raw.category);
		if (raw.categories) tags.push(...(Array.isArray(raw.categories) ? raw.categories : [raw.categories]));

		return tags.filter(Boolean);
	}
}
