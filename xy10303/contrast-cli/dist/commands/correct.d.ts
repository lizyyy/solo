import { DataStore } from '../services/dataStore';
interface CorrectOptions {
    type: string;
    appointmentId?: string;
    batchNumber?: string;
    reason: string;
    operator: string;
    original?: string;
    corrected?: string;
}
export declare function handleCorrect(date: string, options: CorrectOptions, store: DataStore): void;
export {};
