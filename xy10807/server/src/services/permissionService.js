const db = require('../database');
const { v4: uuidv4 } = require('uuid');

class PermissionService {
  static logRequest(tenantId, departmentId, roleId, apiResourceId, requester, input, result, status, responsibleNode, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const logId = uuidv4();
      db.run(
        `INSERT INTO request_logs (id, tenant_id, department_id, role_id, api_resource_id, requester, request_input, request_result, status, responsible_node, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, tenantId, departmentId, roleId, apiResourceId, requester, JSON.stringify(input), JSON.stringify(result), status, responsibleNode, errorMessage],
        (err) => {
          if (err) reject(err);
          else resolve(logId);
        }
      );
    });
  }

  static getDepartmentHierarchy(departmentId, tenantId) {
    return new Promise((resolve, reject) => {
      const hierarchy = [];
      const getParent = (deptId) => {
        db.get(`SELECT * FROM departments WHERE id = ? AND tenant_id = ?`, [deptId, tenantId], (err, dept) => {
          if (err) reject(err);
          else if (dept) {
            hierarchy.push(dept);
            if (dept.parent_id) {
              getParent(dept.parent_id);
            } else {
              resolve(hierarchy);
            }
          } else {
            resolve(hierarchy);
          }
        });
      };
      getParent(departmentId);
    });
  }

  static async getRolePermissionsWithInheritance(roleId, departmentId, tenantId) {
    const permissions = new Map();
    
    const deptHierarchy = await this.getDepartmentHierarchy(departmentId, tenantId);
    
    for (const dept of deptHierarchy) {
      const deptRoles = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM roles WHERE department_id = ?`, [dept.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      for (const role of deptRoles) {
        const rolePackages = await new Promise((resolve, reject) => {
          db.all(
            `SELECT pp.* FROM role_permissions rp
             JOIN permission_packages pp ON rp.package_id = pp.id
             WHERE rp.role_id = ?`,
            [role.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });

        for (const pkg of rolePackages) {
          if (!pkg.is_inheritable && role.id !== roleId) continue;
          
          const packagePermissions = await new Promise((resolve, reject) => {
            db.all(
              `SELECT ar.*, pp.access_level FROM package_permissions pp
               JOIN api_resources ar ON pp.api_resource_id = ar.id
               WHERE pp.package_id = ?`,
              [pkg.id],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              }
            );
          });

          for (const perm of packagePermissions) {
            if (!permissions.has(perm.id) || this.isHigherAccessLevel(perm.access_level, permissions.get(perm.id)?.access_level)) {
              permissions.set(perm.id, { ...perm, packageId: pkg.id, packageName: pkg.name, inherited: role.id !== roleId });
            }
          }
        }
      }
    }

    return Array.from(permissions.values());
  }

  static isHigherAccessLevel(newLevel, existingLevel) {
    const levels = { 'read': 1, 'write': 2, 'admin': 3 };
    return !existingLevel || (levels[newLevel] || 0) > (levels[existingLevel] || 0);
  }

  static async checkPermission(tenantId, departmentId, roleId, apiResourceId, requiredAccessLevel = 'read') {
    const permissions = await this.getRolePermissionsWithInheritance(roleId, departmentId, tenantId);
    const perm = permissions.find(p => p.id === apiResourceId);
    
    if (!perm) {
      return { granted: false, reason: 'NO_PERMISSION', message: '未找到对应的权限配置' };
    }

    if (!this.isHigherAccessLevel(perm.access_level, requiredAccessLevel) && perm.access_level !== requiredAccessLevel) {
      return { granted: false, reason: 'INSUFFICIENT_ACCESS', message: `需要 ${requiredAccessLevel} 权限，当前只有 ${perm.access_level} 权限` };
    }

    return { granted: true, permission: perm };
  }

  static async callApi(tenantId, departmentId, roleId, apiResourceId, requester, requestInput) {
    const apiResource = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM api_resources WHERE id = ?`, [apiResourceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!apiResource) {
      await this.logRequest(tenantId, departmentId, roleId, apiResourceId, requester, requestInput, null, 'ERROR', 'API_VALIDATION', 'API资源不存在');
      return { success: false, error: 'API资源不存在' };
    }

    const checkResult = await this.checkPermission(tenantId, departmentId, roleId, apiResourceId, 'read');
    
    if (!checkResult.granted) {
      const rejectionId = uuidv4();
      db.run(
        `INSERT INTO call_rejections (id, tenant_id, department_id, role_id, api_resource_id, requester, reason, rejection_type, request_input)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rejectionId, tenantId, departmentId, roleId, apiResourceId, requester, checkResult.message, 'PERMISSION_DENIED', JSON.stringify(requestInput)]
      );

      await this.logRequest(tenantId, departmentId, roleId, apiResourceId, requester, requestInput, null, 'REJECTED', 'PERMISSION_CHECK', checkResult.message);
      return { success: false, error: checkResult.message, rejectionId };
    }

    const result = {
      api: apiResource.name,
      data: { message: 'API调用成功', timestamp: new Date().toISOString(), input: requestInput },
      permission: checkResult.permission
    };

    await this.logRequest(tenantId, departmentId, roleId, apiResourceId, requester, requestInput, result, 'SUCCESS', 'API_EXECUTION');
    return { success: true, data: result };
  }

  static createApproval(tenantId, departmentId, roleId, packageId, requester, requestType, requestData) {
    return new Promise((resolve, reject) => {
      const approvalId = uuidv4();
      db.run(
        `INSERT INTO approval_records (id, tenant_id, department_id, role_id, package_id, requester, request_type, request_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [approvalId, tenantId, departmentId, roleId, packageId, requester, requestType, JSON.stringify(requestData)],
        (err) => {
          if (err) reject(err);
          else resolve(approvalId);
        }
      );
    });
  }

  static approveApproval(approvalId, approver, comment) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE approval_records SET status = 'approved', approver = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approver, comment, approvalId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static rejectApproval(approvalId, approver, comment) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE approval_records SET status = 'rejected', approver = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approver, comment, approvalId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static resolveRejection(rejectionId, resolvedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE call_rejections SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [resolvedBy, rejectionId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getPermissionMatrix(tenantId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          t.name as tenant_name,
          d.name as department_name,
          r.name as role_name,
          ar.name as api_name,
          ar.path as api_path,
          ar.method as api_method,
          pp.access_level,
          ppkg.name as package_name,
          ppkg.is_inheritable
        FROM tenants t
        JOIN departments d ON t.id = d.tenant_id
        JOIN roles r ON d.id = r.department_id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permission_packages ppkg ON rp.package_id = ppkg.id
        JOIN package_permissions pp ON ppkg.id = pp.package_id
        JOIN api_resources ar ON pp.api_resource_id = ar.id
        WHERE t.id = ?
        ORDER BY d.name, r.name, ar.name`,
        [tenantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = PermissionService;
