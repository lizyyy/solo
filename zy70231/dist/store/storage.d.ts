import { Database } from '../types/models';
import type * as models from '../types/models';
export declare class Storage {
    private dbPath;
    private static instance;
    private database;
    constructor(dbPath: string);
    static getInstance(dbPath?: string): Storage;
    private createEmptyDatabase;
    load(): void;
    save(): void;
    get db(): Database;
    clearRunData(runId: string): void;
    addRunState(state: Omit<models.RunState, 'runId' | 'timestamp'>): models.RunState;
    updateRunState(runId: string, updates: Partial<models.RunState>): void;
    getLastRunState(): models.RunState | undefined;
}
