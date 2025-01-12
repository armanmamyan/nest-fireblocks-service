export interface TokenGlobalObject {
	holders: string;
	metadata: {
		id: number;
		name: string;
		symbol: string;
		category: string;
		description: string;
		slug: string;
		logo: string;
		subreddit: string;
		notice: string;
		tags: any[]; // Replace with the specific object structure if available
		'tag-names': string[];
		'tag-groups': string[];
		urls: {
			website: string[];
			twitter: string[];
			message_board: string[];
			chat: string[];
			facebook: string[];
			explorer: string[];
			reddit: string[];
			technical_doc: string[];
			source_code: string[];
			announcement: string[];
		};
		platform: {
			id: number;
			name: string;
			symbol: string;
			slug: string;
			token_address: string;
		};
		date_added: string;
		twitter_username: string;
		is_hidden: number;
		date_launched: string | null;
		contract_address: any[]; // Replace with the specific object structure if available
		self_reported_circulating_supply: any | null;
		self_reported_tags: any | null;
		self_reported_market_cap: any | null;
		infinite_supply: boolean;
		num_market_pairs: number;
		max_supply: any | null;
		circulating_supply: number;
		total_supply: number;
		is_active: number;
		cmc_rank: number;
		is_fiat: number;
		tvl_ratio: any | null;
		last_updated: string;
		quote: { USD: any }; // Replace with the specific object structure if available
		quotes: {
			'1d': any;
			'7d': any;
			'30d': any;
			'90d': any;
		};
	};
}
