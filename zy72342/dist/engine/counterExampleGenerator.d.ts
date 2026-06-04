import { FilterResult, BoundaryNote, CounterExample } from '../types';
export interface CounterExampleAnalysis {
    reasonKept: string;
    missingMaterials: string[];
    nextAction: CounterExample['nextAction'];
    nextHandler: string;
}
export declare function analyzeCounterExample(result: FilterResult, boundaryNotes: BoundaryNote[], config?: import("../types").FilterConfig): CounterExampleAnalysis;
export declare function generateCounterExample(result: FilterResult, boundaryNotes: BoundaryNote[]): Omit<CounterExample, 'id'>;
export declare function generateCounterExamplesForRun(runId: string, results: FilterResult[]): CounterExample[];
export declare function regenerateCounterExamplesForNote(noteId: string, actor: string): {
    updated: CounterExample[];
    added: CounterExample[];
};
export declare function updateCounterExampleStatus(counterExampleId: string, status: CounterExample['status'], actor: string, note: string): CounterExample | undefined;
