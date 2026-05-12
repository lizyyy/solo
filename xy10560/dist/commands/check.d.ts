import { Environment } from '../types';
export interface CheckOptions {
    storePath?: string;
    environment?: Environment;
    certificateId?: string;
    verbose?: boolean;
    operator: string;
}
export declare function checkCommand(options: CheckOptions): void;
