import { User } from '../types';
export declare function setCurrentUser(username: string): void;
export declare function getCurrentUser(): User;
export declare function checkPermission(action: string): void;
export declare function runCli(argv: string[]): void;
