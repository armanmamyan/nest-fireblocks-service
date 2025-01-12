import { TimeRange } from './cmc-quotes';

export interface HistoricalQuotes {
	status: Status;
	data: Data;
}

export interface Status {
	timestamp: string;
	error_code: number;
	error_message: any;
	elapsed: number;
	credit_count: number;
	notice: any;
}

export interface Data {
	[key: string]: TimeRange;
}
