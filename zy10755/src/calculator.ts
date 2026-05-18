import {
  EmployeePermission,
  Permission,
  PermissionDiff,
  DiffResult,
  RuleConfig,
  ProcessingError
} from './types';

export function calculatePermissionDiff(
  employees: EmployeePermission[],
  rules: RuleConfig
): DiffResult {
  const result: DiffResult = {
    summary: {
      totalEmployees: employees.length,
      totalPermissionsChanged: 0,
      addedPermissions: 0,
      removedPermissions: 0,
      partTimeDiffs: 0,
      temporaryDiffs: 0,
      inheritedDiffs: 0
    },
    standardDiffs: [],
    partTimeDiffs: [],
    temporaryDiffs: [],
    inheritedDiffs: [],
    unchangedPermissions: [],
    errors: []
  };

  const timestamp = new Date().toISOString();

  employees.forEach(employee => {
    try {
      processEmployeePermissions(employee, rules, result, timestamp);
    } catch (error) {
      result.errors.push({
        employeeId: employee.employeeId,
        errorType: 'calculation',
        message: `处理员工 ${employee.employeeName} 时出错: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
        timestamp
      });
    }
  });

  result.summary.totalPermissionsChanged =
    result.summary.addedPermissions + result.summary.removedPermissions;

  return result;
}

function processEmployeePermissions(
  employee: EmployeePermission,
  rules: RuleConfig,
  result: DiffResult,
  timestamp: string
): void {
  const originalPermMap = new Map(
    employee.originalPermissions.map(p => [p.permissionId, p])
  );
  const newPermMap = new Map(
    employee.newPermissions.map(p => [p.permissionId, p])
  );

  const allPermIds = new Set([
    ...originalPermMap.keys(),
    ...newPermMap.keys()
  ]);

  allPermIds.forEach(permId => {
    const originalPerm = originalPermMap.get(permId);
    const newPerm = newPermMap.get(permId);

    if (originalPerm && !newPerm) {
      result.standardDiffs.push(createDiff(
        employee,
        originalPerm,
        null,
        'removed',
        'standard',
        '调岗后权限被移除'
      ));
      result.summary.removedPermissions++;
    } else if (!originalPerm && newPerm) {
      result.standardDiffs.push(createDiff(
        employee,
        null,
        newPerm,
        'added',
        'standard',
        '调岗后获得新权限'
      ));
      result.summary.addedPermissions++;
    } else if (originalPerm && newPerm) {
      if (hasPermissionChanged(originalPerm, newPerm, rules)) {
        result.standardDiffs.push(createDiff(
          employee,
          originalPerm,
          newPerm,
          'changed',
          'standard',
          '权限属性发生变更'
        ));
        result.summary.addedPermissions++;
      } else if (rules.rules.output.includeUnchanged) {
        result.unchangedPermissions.push(createDiff(
          employee,
          originalPerm,
          newPerm,
          'unchanged',
          'standard',
          '权限未发生变化'
        ));
      }
    }
  });

  if (rules.rules.partTimeHandling.enabled && employee.partTimeDepartments) {
    processPartTimeDepartments(employee, rules, result);
  }

  if (rules.rules.temporaryAuthorization.enabled && employee.temporaryAuthorizations) {
    processTemporaryAuthorizations(employee, rules, result);
  }

  if (rules.rules.inheritance.enabled) {
    processInheritedPermissions(employee, rules, result);
  }
}

function processPartTimeDepartments(
  employee: EmployeePermission,
  rules: RuleConfig,
  result: DiffResult
): void {
  employee.partTimeDepartments!.forEach(dept => {
    dept.permissions.forEach(perm => {
      let reason = '';
      let diffType: 'added' | 'removed' | 'changed' | 'unchanged' = 'unchanged';

      if (rules.rules.partTimeHandling.retainOnTransfer) {
        reason = '兼职部门权限：调岗后保留';
        diffType = 'unchanged';
      } else {
        reason = '兼职部门权限：调岗后需重新申请';
        diffType = 'removed';
        result.summary.removedPermissions++;
      }

      result.partTimeDiffs.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        diffType,
        permissionId: perm.permissionId,
        permissionName: perm.permissionName,
        originalValue: `${dept.departmentName} (兼职)`,
        changeReason: reason,
        category: 'part-time'
      });
      result.summary.partTimeDiffs++;
    });
  });
}

function processTemporaryAuthorizations(
  employee: EmployeePermission,
  rules: RuleConfig,
  result: DiffResult
): void {
  employee.temporaryAuthorizations!.forEach(auth => {
    auth.permissions.forEach(perm => {
      let reason = '';
      let diffType: 'added' | 'removed' | 'changed' | 'unchanged' = 'unchanged';

      if (rules.rules.temporaryAuthorization.requireReapproval) {
        reason = `临时授权：调岗后需重新审批 (${auth.reason}, 过期: ${auth.expiryDate})`;
        diffType = 'changed';
        result.summary.addedPermissions++;
      } else if (rules.rules.temporaryAuthorization.carryOverOnTransfer) {
        reason = `临时授权：调岗后自动延续至 ${auth.expiryDate}`;
        diffType = 'unchanged';
      } else {
        reason = `临时授权：调岗后取消 (${auth.reason})`;
        diffType = 'removed';
        result.summary.removedPermissions++;
      }

      result.temporaryDiffs.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        diffType,
        permissionId: perm.permissionId,
        permissionName: perm.permissionName,
        originalValue: auth.authName,
        newValue: rules.rules.temporaryAuthorization.requireReapproval ? '待重新审批' : undefined,
        changeReason: reason,
        category: 'temporary'
      });
      result.summary.temporaryDiffs++;
    });
  });
}

function processInheritedPermissions(
  employee: EmployeePermission,
  rules: RuleConfig,
  result: DiffResult
): void {
  if (employee.inheritedPermissions) {
    employee.inheritedPermissions.forEach(perm => {
      let reason = '';
      let diffType: 'added' | 'removed' | 'changed' | 'unchanged' = 'unchanged';

      if (rules.rules.inheritance.recalculateOnDepartmentChange) {
        if (perm.inheritedFrom === 'department') {
          reason = `继承权限：部门变更需重新计算 (来源: ${perm.sourceName})`;
          diffType = 'changed';
          result.summary.addedPermissions++;
        } else if (perm.inheritedFrom === 'role' && rules.rules.inheritance.roleInheritance) {
          reason = `继承权限：角色继承保留 (来源: ${perm.sourceName})`;
          diffType = 'unchanged';
        } else if (perm.inheritedFrom === 'group' && rules.rules.inheritance.groupInheritance) {
          reason = `继承权限：用户组继承保留 (来源: ${perm.sourceName})`;
          diffType = 'unchanged';
        } else {
          reason = `继承权限：调岗后失效 (来源: ${perm.sourceName})`;
          diffType = 'removed';
          result.summary.removedPermissions++;
        }
      } else {
        reason = `继承权限：不随部门变更重算 (来源: ${perm.sourceName})`;
        diffType = 'unchanged';
      }

      result.inheritedDiffs.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        diffType,
        permissionId: perm.permissionId,
        permissionName: perm.permissionName,
        originalValue: `${perm.inheritedFrom === 'role' ? '角色' : perm.inheritedFrom === 'group' ? '用户组' : '部门'}: ${perm.sourceName}`,
        changeReason: reason,
        category: 'inherited'
      });
      result.summary.inheritedDiffs++;
    });
  }

  if (rules.rules.inheritance.recalculateOnDepartmentChange &&
      employee.originalDepartment !== employee.newDepartment) {
    result.inheritedDiffs.push({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      diffType: 'changed',
      permissionId: 'DEPT_INHERITANCE_CHECK',
      permissionName: '部门继承权限检查',
      originalValue: employee.originalDepartment,
      newValue: employee.newDepartment,
      changeReason: `部门变更：从 [${employee.originalDepartment}] 调至 [${employee.newDepartment}]，需重新计算部门继承权限`,
      category: 'inherited'
    });
    result.summary.inheritedDiffs++;
  }
}

function hasPermissionChanged(
  original: Permission,
  newPerm: Permission,
  rules: RuleConfig
): boolean {
  if (original.permissionType !== newPerm.permissionType) return true;
  if (original.resource !== newPerm.resource) return true;
  if (!rules.rules.permissionMatching.ignoreScope &&
      original.scope !== newPerm.scope) return true;
  return false;
}

function createDiff(
  employee: EmployeePermission,
  originalPerm: Permission | null,
  newPerm: Permission | null,
  diffType: 'added' | 'removed' | 'changed' | 'unchanged',
  category: 'standard' | 'part-time' | 'temporary' | 'inherited',
  reason: string
): PermissionDiff {
  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    diffType,
    permissionId: originalPerm?.permissionId || newPerm?.permissionId || '',
    permissionName: originalPerm?.permissionName || newPerm?.permissionName || '',
    originalValue: originalPerm ? `${originalPerm.permissionType}:${originalPerm.resource}` : undefined,
    newValue: newPerm ? `${newPerm.permissionType}:${newPerm.resource}` : undefined,
    changeReason: reason,
    category
  };
}
