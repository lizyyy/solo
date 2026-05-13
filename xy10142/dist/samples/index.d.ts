import type { AuditEvent, EventGroup } from '../types/index.js';
export declare function generateValidSampleEvents(): AuditEvent[];
export declare function generateInvalidSampleEvents(): Array<{
    event: Partial<AuditEvent>;
    reason: string;
}>;
export declare function generateSampleGroups(): EventGroup[];
export declare function generateEdgeCaseEvents(): AuditEvent[];
export declare function generateLargeDataset(count?: number): AuditEvent[];
//# sourceMappingURL=index.d.ts.map