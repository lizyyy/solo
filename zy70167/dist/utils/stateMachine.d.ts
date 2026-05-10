import { RuleVersionStatus, StateTransitionError } from '../types';
export declare function canTransitionRuleVersion(fromStatus: RuleVersionStatus, toStatus: RuleVersionStatus): boolean;
export declare function getValidTransitions(status: RuleVersionStatus): RuleVersionStatus[];
export declare function validateRuleVersionTransition(fromStatus: RuleVersionStatus, toStatus: RuleVersionStatus): StateTransitionError | null;
export declare function getStatusDescription(status: RuleVersionStatus): string;
export declare function getBatchStatusDescription(status: string): string;
//# sourceMappingURL=stateMachine.d.ts.map