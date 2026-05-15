import { DependencyChange } from './types';
export declare class DependencyChangeDAO {
    static create(change: Omit<DependencyChange, 'id' | 'requestedAt' | 'bothConfirmed'>): DependencyChange;
    static getById(id: string): DependencyChange | null;
    static getAll(status?: string): DependencyChange[];
    static approve(id: string, approver: string): DependencyChange | null;
    static reject(id: string, approver: string): DependencyChange | null;
    private static mapRow;
}
