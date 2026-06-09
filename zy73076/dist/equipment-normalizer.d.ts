import { EquipmentIdMapping, NormalizedEquipmentId } from './types';
export declare class EquipmentNormalizer {
    private mappings;
    private aliasIndex;
    constructor(initialMappings?: EquipmentIdMapping[]);
    loadMappings(mappings: EquipmentIdMapping[]): void;
    addMapping(mapping: EquipmentIdMapping): void;
    getAllMappings(): EquipmentIdMapping[];
    normalize(rawId: string): NormalizedEquipmentId;
    bulkNormalize(rawIds: string[]): {
        results: Map<string, NormalizedEquipmentId>;
        duplicateGroups: Array<{
            canonicalId: string;
            rawVariants: string[];
            pendingConfirmation: boolean;
        }>;
    };
    private softNormalize;
    private normalizeForLookup;
    private prefixMismatchPenalty;
    private extractPrefix;
    private similarity;
}
