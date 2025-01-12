import { Injectable, Logger } from '@nestjs/common';
import lunr from 'lunr';

import { CMCProvider } from './cmc-provider';
import { QuotesResponse } from './dto/cmc-quotes';
import { TokenLatestQuotes } from './dto/cmc-token-latest-quotes';
import { tokenMetadata } from './dto/cmc-token-metadata';
import { ConfigService } from '@nestjs/config';
import { CMCTokenIDs } from '@/utils/fireblocks.assets.supported';

const ID_MAP_TIMESTAMP_AGE_THRESHOLD = 3600000; // 1h
const SEARCH_LIMIT = 10;

@Injectable()
export class CMCService {
	private readonly logger = new Logger(CMCService.name);
	private static provider: CMCProvider;
	private idMap?: Record<string, any>;
	private idMapTimestamp?: Date;
	private searchIndex: any;

	constructor(private configService: ConfigService) {
		CMCService.provider = new CMCProvider(configService);
		this.getIdMap();
	}

	getIdMap(): Promise<any> {
		return new Promise(async (resolve, reject) => {
			// id map is defined and up to date
			if (this.idMap && new Date().getTime() - this.idMapTimestamp?.getTime() < ID_MAP_TIMESTAMP_AGE_THRESHOLD) {
				resolve(this.idMap);
				return;
			}

			try {

				const { data, status }: any = await CMCService.provider.getIdMap();

				if (!data) {
					this.logger.error('Error fetching CMC ID map', status);
					throw new Error(status);
				}

				this.idMap = data;
				this.idMapTimestamp = new Date();

				// create lunr index
				this.searchIndex = lunr(function () {
					this.ref('id');
					this.field('symbol');
					this.field('slug');
					this.field('name');

					data.forEach(function (doc) {
						this.add(doc);
					}, this);
				});

				this.logger.log(`data size CMC : `, data.length);
				resolve(data);
			} catch (err) {
				reject(err);
			}
		});
	}

	searchToken(query: string): Promise<any> {
		return new Promise(async (resolve, reject) => {
			try {
				await this.getIdMap();

				const searchResults = this.searchIndex
					.search(query)
					.map(result =>
						this.idMap.find(token => {
							return token.id === Number(result.ref);
						})
					);

				resolve(searchResults);
			} catch (err) {
				reject(err);
			}
		});
	}

	getTokenMetadata(address: string): Promise<tokenMetadata | any> {
		return new Promise(async (resolve, reject) => {
			try {
				const response: any = await CMCService.provider.getTokenMetadata(address);
				if (!response?.data) {
					this.logger.error(`Invalid CMC metadata for ${address}`, response);

					resolve(response?.status || null);
					return;
				}

				resolve(Object.values(response.data)?.[0] as tokenMetadata);
			} catch (err) {
				this.logger.error(err);
				reject(err);
			}
		});
	}

	getTokenMetadataBatch(idList: string[]): Promise<any> {
		return new Promise(async (resolve, reject) => {
			try {
				const response: any = await CMCService.provider.getTokenMetadataBatch(idList);

				if (!response?.data) {
					this.logger.error(`Invalid CMC metadata for ${idList}`, response);

					resolve(response?.status || null);
					return;
				}

				resolve(response.data);
			} catch (err) {
				reject(err);
			}
		});
	}

	getTokenLatestQuotes(id: string): Promise<TokenLatestQuotes> {
		return new Promise(async (resolve, reject) => {
			try {
				const quotesData: any = await CMCService.provider.getTokenLatestQuotes(id);
				const data = Object.values(quotesData.data)?.[0];
				if (data) {
					resolve(data as TokenLatestQuotes);
				} else {
					reject(new Error('Data not found'));
				}
			} catch (err) {
				this.logger.error(err);
				reject(err);
			}
		});
	}

	getTokenGroupedQuotes(id: string): Promise<QuotesResponse> {
		return new Promise(async (resolve, reject) => {
			try {
				const now = Math.round(Date.now() / 1000);
				const intervals = [
					{ key: '1d', time_start: now - 84600, time_end: now, interval: '5m', count: 288 },
					{ key: '7d', time_start: now - 84600 * 7, time_end: now, interval: '1h', count: 168 },
					{ key: '30d', time_start: now - 84600 * 30, time_end: now, interval: '6h', count: 120 },
					{ key: '90d', time_start: now - 84600 * 90, time_end: now, interval: '1d', count: 90 }
				];
				const aggregatedQuotes = {};

				for (const { interval, count, key, time_end, time_start } of intervals) {
					const response: any = await CMCService.provider.getTokenHistoricalQuotes({
						id,
						interval,
						time_start: time_start.toString(),
						time_end: time_end.toString(),
						count: String(count)
					});

					const extractedData: any = Object.values(response.data)?.[0];

					aggregatedQuotes[key] = extractedData;
				}

				resolve(aggregatedQuotes as QuotesResponse);
			} catch (err) {
				this.logger.error(err);
				reject(err);
			}
		});
	}

	getTokenOhlcvData(id: string): Promise<any> {
		return new Promise(async resolve => {
			try {
				const quotesData: any = await CMCService.provider.getTokenOhlcvData(id);
				resolve(quotesData.data);
			} catch (err) {
				this.logger.error(err);
				resolve({});
			}
		});
	}

	async formatTokensMetadata(tokenMetadata: any) {
		tokenMetadata = await this.getTokenMetadataBatch(tokenMetadata.map(({ id }) => String(id)));

		return Object.values(tokenMetadata)
		.map((token: any) => {
			return { ...token, contract: token?.platform?.token_address }
		});
	}

	async fetchCMCTokens(query: string): Promise<any> {
		const tokenMetadata = await this.searchToken(query);
		if (!Array.isArray(tokenMetadata) || !tokenMetadata.length) return [];
		const tokensData = await this.formatTokensMetadata(tokenMetadata);
		return tokensData;
	}

	async getCMCTokenInfo(tokenAddress: string): Promise<any> {
		try {
			let data = await this.getTokenMetadata(tokenAddress);
			this.logger.log('data getTokenCMCInfo');
			if (data?.id) {
				this.logger.log(`Fetching historical quotes for ${tokenAddress}, CMC id: ${data.id}`);
				const quotes = await this.getTokenGroupedQuotes(data.id);
				this.logger.log(`Fetching latest quote for ${tokenAddress}`);
				const latestQuote = await this.getTokenLatestQuotes(data.id);
				data = { ...data, ...latestQuote, quotes };
				const ohlcvData = await this.getTokenOhlcvData(data.id);
				if (ohlcvData) {
					data = { ...data, ohlcv: ohlcvData };
				}
			}
			return data;
		} catch (err) {
			console.log(err);
			return {};
		}
	}
}
