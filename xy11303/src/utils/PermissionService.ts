import { UserRole } from '../types';

export interface PermissionContext {
  userId: string;
  userRole: UserRole;
  resourceType: string;
  resourceId?: string;
  action: string;
  ownerId?: string;
}

export const PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  [UserRole.ADMIN]: {
    orders: ['create', 'read', 'update', 'delete', 'export'],
    tasks: ['create', 'read', 'update', 'delete', 'assign', 'approve', 'reject', 'export'],
    reworks: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    deductions: ['create', 'read', 'update', 'delete', 'confirm', 'appeal', 'export'],
    settlements: ['create', 'read', 'update', 'delete', 'confirm', 'pay', 'export'],
    complaints: ['create', 'read', 'update', 'delete', 'resolve', 'export'],
    photos: ['create', 'read', 'update', 'delete', 'approve', 'export'],
    users: ['create', 'read', 'update', 'delete', 'export'],
    audit: ['read', 'export'],
    reports: ['generate', 'read', 'export']
  },
  [UserRole.MANAGER]: {
    orders: ['create', 'read', 'update', 'export'],
    tasks: ['create', 'read', 'update', 'assign', 'approve', 'reject', 'export'],
    reworks: ['create', 'read', 'update', 'approve', 'export'],
    deductions: ['create', 'read', 'update', 'confirm', 'export'],
    settlements: ['create', 'read', 'update', 'confirm', 'export'],
    complaints: ['create', 'read', 'update', 'resolve', 'export'],
    photos: ['create', 'read', 'update', 'approve', 'export'],
    users: ['read'],
    audit: ['read'],
    reports: ['generate', 'read', 'export']
  },
  [UserRole.OPERATOR]: {
    orders: ['read'],
    tasks: ['read', 'update', 'export'],
    reworks: ['create', 'read', 'update'],
    deductions: ['create', 'read', 'appeal'],
    settlements: ['read'],
    complaints: ['create', 'read'],
    photos: ['create', 'read'],
    users: ['read'],
    audit: [],
    reports: ['read']
  },
  [UserRole.CLEANER]: {
    orders: [],
    tasks: ['read', 'start', 'submit'],
    reworks: ['read', 'start', 'submit'],
    deductions: ['read', 'appeal'],
    settlements: ['read'],
    complaints: ['read'],
    photos: ['create', 'read'],
    users: ['read'],
    audit: [],
    reports: []
  },
  [UserRole.FINANCE]: {
    orders: ['read', 'export'],
    tasks: ['read', 'export'],
    reworks: ['read', 'export'],
    deductions: ['read', 'confirm', 'export'],
    settlements: ['read', 'update', 'confirm', 'pay', 'export'],
    complaints: ['read', 'export'],
    photos: ['read'],
    users: ['read'],
    audit: ['read', 'export'],
    reports: ['generate', 'read', 'export']
  }
};

export class PermissionService {
  static checkPermission(context: PermissionContext): boolean {
    const { userRole, resourceType, action, ownerId, userId } = context;

    const rolePermissions = PERMISSIONS[userRole];
    if (!rolePermissions) {
      return false;
    }

    const resourcePermissions = rolePermissions[resourceType];
    if (!resourcePermissions || !resourcePermissions.includes(action)) {
      return false;
    }

    if (userRole === UserRole.CLEANER && ownerId && ownerId !== userId) {
      return false;
    }

    return true;
  }

  static hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
    return allowedRoles.includes(userRole);
  }

  static canAccessSensitiveFields(userRole: UserRole): boolean {
    return this.hasRole(userRole, [UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCE]);
  }

  static getAccessibleActions(userRole: UserRole, resourceType: string): string[] {
    return PERMISSIONS[userRole]?.[resourceType] || [];
  }
}
