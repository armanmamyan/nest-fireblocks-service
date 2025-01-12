export interface QuotesResponse {
	'1d': TimeRange;
	'7d': TimeRange;
	'30d': TimeRange;
	'90d': TimeRange;
}

export interface TimeRange {
	quotes: Quotes[];
	id: number;
	name: string;
	symbol: string;
	is_active: number;
	is_fiat: number;
}

export interface Quotes {
	timestamp: string;
	quote: Quote;
}

export interface Quote {
	USD: Usd;
}

export interface Usd {
	price: number;
	volume_24h: number;
	market_cap: number;
	total_supply: number;
	circulating_supply: number;
	timestamp: string;
}
