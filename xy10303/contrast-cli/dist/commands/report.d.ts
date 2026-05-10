import { DataStore } from '../services/dataStore';
interface ReportOptions {
    output?: string;
    format?: 'json' | 'text';
}
export declare function handleReport(date: string, options: ReportOptions, store: DataStore): void;
export {};
