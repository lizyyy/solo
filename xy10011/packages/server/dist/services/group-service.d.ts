import { Group } from '../types';
declare class GroupService {
    createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'version'>, userId: string, clientId: string, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<Group>;
    updateGroup(groupId: string, updates: Partial<Group>, userId: string, clientId: string, expectedVersion: number, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<Group>;
    getGroupById(groupId: string): Group | null;
    getGroupsForUser(userId: string): Group[];
    private persistGroup;
    private updatePersistedGroup;
    private deserializeGroup;
}
export declare const groupService: GroupService;
export {};
