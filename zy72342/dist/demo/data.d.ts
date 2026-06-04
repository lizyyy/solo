import { runFilter, decideResult } from '../engine/filterEngine';
import { generateCounterExamplesForRun } from '../engine/counterExampleGenerator';
import { DemoData } from '../types';
export declare function initDemoData(): void;
export declare function runDemoWorkflow(): {
    step1: ReturnType<typeof runFilter>;
    step2: ReturnType<typeof generateCounterExamplesForRun>;
    step3: {
        noteId: string;
        updated: unknown[];
        added: unknown[];
    };
    step4: ReturnType<typeof runFilter>;
    step5: ReturnType<typeof decideResult>;
};
export declare function exportDemoData(): DemoData;
export declare function printDemoSummary(): void;
