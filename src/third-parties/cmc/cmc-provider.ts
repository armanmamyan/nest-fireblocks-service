import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

const RATE_LIMIT = 30; // per minute

interface ApiKey {
	key: string;
	limitRemaining: number;
}

export class CMCProvider {
	@ApiProperty()
	@IsNotEmpty()
	apiKeys: ApiKey[];

	constructor(private configService: ConfigService) {
		this.apiKeys = this.configService.get<string>('CMC_API_KEY')?.split(' ').map(key => ({
			key,
			limitRemaining: RATE_LIMIT
		}));

		// reset remaining limit on a per minute basis
		setInterval(() => {
			this.apiKeys = this.apiKeys.map(keyObject => ({ ...keyObject, limitRemaining: RATE_LIMIT }));
		}, 60000);
	}

	// get key with available rate limit
	#getApiKey() {
		const availableKeyIndex = this.apiKeys.findIndex(({ limitRemaining }) => limitRemaining > 0);
		if (this.apiKeys[availableKeyIndex]) {
			this.apiKeys[availableKeyIndex].limitRemaining -= 1;
		}
		return this.apiKeys[availableKeyIndex]?.key;
	}

	#fetchFactory(route: string): Promise<Response> {
		const key = this.#getApiKey();
		return fetch(route, {
			method: 'GET',
			headers: {
				'X-CMC_PRO_API_KEY': key,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			}
		}).then(response => response.json());
	}

	getIdMap(): Promise<Response> {
		return this.#fetchFactory('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map');
	}

	getTokenMetadata(address: string): Promise<Response> {
		return this.#fetchFactory(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?address=${address}`);
	}

	getTokenMetadataBatch(idList: string[]): Promise<Response> {
		return this.#fetchFactory(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?id=${idList.join(',')}`);
	}

	getTokenLatestQuotes(id: string): Promise<Response> {
		return this.#fetchFactory(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${id}`);
	}

	getTokenHistoricalQuotes(query: Record<string, string>): Promise<Response> {
		return this.#fetchFactory(
			`https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/historical?${new URLSearchParams(query)}`
		);
	}

	getTokenOhlcvData(id: string, count = 20): Promise<Response> {
		return this.#fetchFactory(
			`https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical?id=${id}&count=${count}`
		);
	}
}
