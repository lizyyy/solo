import { RuleVersion } from './types';
export declare class RuleVersionDAO {
    static create(rule: Omit<RuleVersion, 'id' | 'createdAt'>): RuleVersion;
    static getById(id: string): RuleVersion | null;
    static getActiveRule(): RuleVersion | null;
    static getAll(): RuleVersion[];
    static getByDate(date: Date): RuleVersion | null;
    static deactivateOldVersions(newEffectiveFrom: Date): void;
    private static mapRow;
}
