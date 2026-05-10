import { User } from '../types';
declare class UserService {
    getOrCreateUser(userId: string, options?: {
        name?: string;
        avatar?: string;
    }, clientId?: string, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<User>;
    createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & {
        id?: string;
    }, clientId: string, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<User>;
    private findUserByCorrelationId;
    updateUser(userId: string, updates: Partial<User>, clientId: string, expectedVersion: number, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<User>;
    getUserById(userId: string): User | null;
    getAllUsers(): User[];
    private persistUser;
    private updatePersistedUser;
    private deserializeUser;
}
export declare const userService: UserService;
export {};
