import { EmployeePermission, RuleConfig, ProcessingError } from './types';

export function validateInput(
  inputData: EmployeePermission[],
  rules: RuleConfig
): ProcessingError[] {
  const errors: ProcessingError[] = [];
  const timestamp = new Date().toISOString();

  if (!Array.isArray(inputData)) {
    errors.push({
      errorType: 'validation',
      message: '输入数据格式错误：必须是数组格式',
      severity: 'fatal',
      timestamp
    });
    return errors;
  }

  if (inputData.length === 0) {
    errors.push({
      errorType: 'validation',
      message: '输入数据为空：没有员工权限数据',
      severity: 'warning',
      timestamp
    });
  }

  inputData.forEach((employee, index) => {
    if (!employee.employeeId || employee.employeeId.trim() === '') {
      errors.push({
        employeeId: employee.employeeId || `index_${index}`,
        errorType: 'validation',
        message: `员工ID不能为空 (索引: ${index})`,
        severity: 'error',
        timestamp
      });
    }

    if (!employee.employeeName || employee.employeeName.trim() === '') {
      errors.push({
        employeeId: employee.employeeId || `index_${index}`,
        errorType: 'validation',
        message: `员工姓名不能为空 (员工ID: ${employee.employeeId})`,
        severity: 'warning',
        timestamp
      });
    }

    if (!employee.originalDepartment || employee.originalDepartment.trim() === '') {
      errors.push({
        employeeId: employee.employeeId,
        errorType: 'validation',
        message: `原部门信息不能为空 (员工: ${employee.employeeName})`,
        severity: 'error',
        timestamp
      });
    }

    if (!employee.newDepartment || employee.newDepartment.trim() === '') {
      errors.push({
        employeeId: employee.employeeId,
        errorType: 'validation',
        message: `新部门信息不能为空 (员工: ${employee.employeeName})`,
        severity: 'error',
        timestamp
      });
    }

    if (!Array.isArray(employee.originalPermissions)) {
      errors.push({
        employeeId: employee.employeeId,
        errorType: 'validation',
        message: `原权限数据必须是数组格式 (员工: ${employee.employeeName})`,
        severity: 'error',
        timestamp
      });
    }

    if (!Array.isArray(employee.newPermissions)) {
      errors.push({
        employeeId: employee.employeeId,
        errorType: 'validation',
        message: `新权限数据必须是数组格式 (员工: ${employee.employeeName})`,
        severity: 'error',
        timestamp
      });
    }

    if (rules.rules.partTimeHandling.enabled && employee.partTimeDepartments) {
      if (!Array.isArray(employee.partTimeDepartments)) {
        errors.push({
          employeeId: employee.employeeId,
          errorType: 'validation',
          message: `兼职部门数据必须是数组格式 (员工: ${employee.employeeName})`,
          severity: 'error',
          timestamp
        });
      } else {
        employee.partTimeDepartments.forEach((dept, deptIndex) => {
          if (!dept.departmentId || !dept.departmentName) {
            errors.push({
              employeeId: employee.employeeId,
              errorType: 'validation',
              message: `兼职部门 ${deptIndex + 1} 信息不完整 (员工: ${employee.employeeName})`,
              severity: 'warning',
              timestamp
            });
          }
        });
      }
    }

    if (rules.rules.temporaryAuthorization.enabled && employee.temporaryAuthorizations) {
      if (!Array.isArray(employee.temporaryAuthorizations)) {
        errors.push({
          employeeId: employee.employeeId,
          errorType: 'validation',
          message: `临时授权数据必须是数组格式 (员工: ${employee.employeeName})`,
          severity: 'error',
          timestamp
        });
      } else {
        employee.temporaryAuthorizations.forEach((auth, authIndex) => {
          if (!auth.expiryDate) {
            errors.push({
              employeeId: employee.employeeId,
              errorType: 'validation',
              message: `临时授权 ${authIndex + 1} 缺少过期日期 (员工: ${employee.employeeName})`,
              severity: 'warning',
              timestamp
            });
          }
        });
      }
    }

    if (rules.rules.inheritance.enabled && employee.inheritedPermissions) {
      if (!Array.isArray(employee.inheritedPermissions)) {
        errors.push({
          employeeId: employee.employeeId,
          errorType: 'validation',
          message: `继承权限数据必须是数组格式 (员工: ${employee.employeeName})`,
          severity: 'error',
          timestamp
        });
      }
    }
  });

  if (!rules.version) {
    errors.push({
      errorType: 'rule',
      message: '规则配置缺少版本号',
      severity: 'warning',
      timestamp
    });
  }

  if (!rules.effectiveDate) {
    errors.push({
      errorType: 'rule',
      message: '规则配置缺少生效日期',
      severity: 'warning',
      timestamp
    });
  }

  return errors;
}
