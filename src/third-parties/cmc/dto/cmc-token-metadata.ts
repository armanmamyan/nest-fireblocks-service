interface Platform {
	id: string;
	name: string;
	slug: string;
	symbol: string;
	token_address: string;
}

interface ContractAddress {
	contract_address: string;
	platform: Platform;
}

interface Urls {
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
}

export interface tokenMetadata {
	id: number;
	name: string;
	symbol: string;
	category: string;
	description: string;
	slug: string;
	logo: string;
	subreddit: string;
	notice: string;
	tags: string[];
	'tag-names': string[];
	'tag-groups': string[];
	urls: Urls;
	platform: Platform;
	date_added: string;
	twitter_username: string;
	is_hidden: number;
	date_launched: null | string;
	contract_address: ContractAddress[];
}
