import { LockfileEntry, AnomalySample } from '../types.js';
export declare function scanLockfile(rootPath: string): Promise<{
    entries: LockfileEntry[];
    anomalies: AnomalySample[];
}>;
