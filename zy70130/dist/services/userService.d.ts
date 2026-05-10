import { User } from '../types';
export declare class UserService {
    createUser(name: string, isVerified?: boolean): User;
    getUser(id: string): User | null;
    updateVerification(userId: string, isVerified: boolean): User;
    freezeUser(userId: string): User;
    unfreezeUser(userId: string): User;
}
export declare const userService: UserService;
