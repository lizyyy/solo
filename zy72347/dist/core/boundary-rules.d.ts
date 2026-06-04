import { BoundaryRule, DataRecord } from '../types';
export declare const BOUNDARY_RULES: BoundaryRule[];
export declare function evaluateRules(record: DataRecord): BoundaryRule[];
export declare function getRuleById(id: string): BoundaryRule | undefined;
export declare function getRulesByAction(action: BoundaryRule['action']): BoundaryRule[];
export declare function formatBoundaryRule(rule: BoundaryRule): string;
