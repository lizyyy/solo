import { UserRole, PermissionConfig, SourceType } from '../types';
export declare function getPermission(role: UserRole): PermissionConfig;
export declare function canPerformAction(role: UserRole, action: string): boolean;
export declare function getVisibleFields(role: UserRole, sourceType: SourceType): string[];
