import { DiffDetail, EnvironmentName, DefaultValue, ChangeRecord } from './types';
interface CompareOptions {
    ignoreArrayOrder?: boolean;
    detectSecrets?: boolean;
    checkDefaults?: boolean;
    knownChanges?: ChangeRecord[];
    defaults?: DefaultValue[];
}
export declare class DiffEngine {
    compare(baseline: Record<string, unknown>, target: Record<string, unknown>, baselineEnv: EnvironmentName, targetEnv: EnvironmentName, options?: CompareOptions): DiffDetail[];
    private detectPlaintextSecrets;
    private compareObjects;
    private comparePlainObjects;
    private compareArrays;
    private checkDefaultValue;
    private checkKnownChange;
    private getValueMismatchSeverity;
    private createDiff;
}
export declare const diffEngine: DiffEngine;
export {};
