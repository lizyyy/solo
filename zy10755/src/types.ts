export interface EmployeePermission {
  employeeId: string;
  employeeName: string;
  originalDepartment: string;
  originalDepartmentId: string;
  newDepartment: string;
  newDepartmentId: string;
  originalPermissions: Permission[];
  newPermissions: Permission[];
  partTimeDepartments?: PartTimeDepartment[];
  temporaryAuthorizations?: TemporaryAuthorization[];
  inheritedPermissions?: InheritedPermission[];
}

export interface Permission {
  permissionId: string;
  permissionName: string;
  permissionType: 'read' | 'write' | 'admin' | 'execute';
  resource: string;
  scope: string;
  grantedBy: string;
  grantedAt: string;
}

export interface PartTimeDepartment {
  departmentId: string;
  departmentName: string;
  permissions: Permission[];
  effectiveDate: string;
  expiryDate?: string;
}

export interface TemporaryAuthorization {
  authId: string;
  authName: string;
  permissions: Permission[];
  grantedBy: string;
  grantedAt: string;
  expiryDate: string;
  reason: string;
}

export interface InheritedPermission {
  permissionId: string;
  permissionName: string;
  inheritedFrom: 'role' | 'group' | 'department';
  sourceId: string;
  sourceName: string;
  resource: string;
}

export interface PermissionDiff {
  employeeId: string;
  employeeName: string;
  diffType: 'added' | 'removed' | 'changed' | 'unchanged';
  permissionId: string;
  permissionName: string;
  originalValue?: string;
  newValue?: string;
  changeReason: string;
  category: 'standard' | 'part-time' | 'temporary' | 'inherited';
}

export interface DiffResult {
  summary: {
    totalEmployees: number;
    totalPermissionsChanged: number;
    addedPermissions: number;
    removedPermissions: number;
    partTimeDiffs: number;
    temporaryDiffs: number;
    inheritedDiffs: number;
  };
  standardDiffs: PermissionDiff[];
  partTimeDiffs: PermissionDiff[];
  temporaryDiffs: PermissionDiff[];
  inheritedDiffs: PermissionDiff[];
  unchangedPermissions: PermissionDiff[];
  errors: ProcessingError[];
}

export interface ProcessingError {
  employeeId?: string;
  errorType: 'validation' | 'calculation' | 'io' | 'rule';
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  timestamp: string;
}

export interface RuleConfig {
  version: string;
  effectiveDate: string;
  rules: {
    partTimeHandling: {
      enabled: boolean;
      retainOnTransfer: boolean;
      autoExpireDays: number;
    };
    temporaryAuthorization: {
      enabled: boolean;
      carryOverOnTransfer: boolean;
      requireReapproval: boolean;
    };
    inheritance: {
      enabled: boolean;
      recalculateOnDepartmentChange: boolean;
      roleInheritance: boolean;
      groupInheritance: boolean;
      departmentInheritance: boolean;
    };
    permissionMatching: {
      matchById: boolean;
      matchByName: boolean;
      ignoreScope: boolean;
    };
    output: {
      includeUnchanged: boolean;
      splitByCategory: boolean;
      generateSummary: boolean;
    };
  };
}

export interface CLIOptions {
  input: string;
  rules: string;
  output: string;
  dryRun: boolean;
  overwrite: boolean;
}
