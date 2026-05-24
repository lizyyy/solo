import { Cassette, DiffConfig, DiffResult } from '../types';
export declare class DiffEngine {
    private config;
    private signer;
    private maskingEngine;
    constructor(config: DiffConfig);
    compare(expected: Cassette, actual: Cassette): DiffResult;
    private matchInteractions;
    private calculateSimilarity;
    private createMissingDiff;
    private createAddedDiff;
    private compareInteraction;
    private compareQuery;
    private compareHeaders;
    private compareBodies;
    private compareObjects;
    private sortArray;
    private deepEqual;
    private shouldIgnoreField;
    private matchPattern;
}
export declare function createDiffEngine(config: DiffConfig): DiffEngine;
