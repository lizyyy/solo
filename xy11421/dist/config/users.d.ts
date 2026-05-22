import { User } from '../types';
export declare const defaultUsers: User[];
export declare function findUserByUsername(username: string): User | undefined;
export declare function findUserById(id: string): User | undefined;
