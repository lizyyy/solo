import { ShuttleRegistration, DedupKey } from './ShuttleRegistration';
export declare class DedupRuleEngine {
    generateEmployeeIdKey(record: ShuttleRegistration): DedupKey | null;
    generatePhoneKey(record: ShuttleRegistration): DedupKey | null;
    generateNameAndPhoneKey(record: ShuttleRegistration): DedupKey | null;
    generateAllKeys(record: ShuttleRegistration): DedupKey[];
    normalizePhone(phone: string): string;
    isSameRoute(r1: ShuttleRegistration, r2: ShuttleRegistration): boolean;
    isSameBoardingPoint(r1: ShuttleRegistration, r2: ShuttleRegistration): boolean;
    detectTransfer(r1: ShuttleRegistration, r2: ShuttleRegistration): boolean;
    isSameEmployee(r1: ShuttleRegistration, r2: ShuttleRegistration): boolean;
    selectBestRecord(records: ShuttleRegistration[]): ShuttleRegistration;
    private calculateRecordScore;
    groupByKey(records: ShuttleRegistration[]): Map<string, ShuttleRegistration[]>;
}
export declare const dedupEngine: DedupRuleEngine;
