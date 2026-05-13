const { v4: uuidv4 } = require('uuid');

const store = {
  departments: [],
  departmentHistory: [],
  employees: [],
  roles: [],
  employeeRoles: [],
  syncBatches: [],
  syncRecords: [],
  permissionRevocationLogs: [],
  syncConflicts: []
};

let recordIdCounter = 1;

function getTimestamp() {
  return new Date().toISOString();
}

function initSeedData() {
  if (store.roles.length === 0) {
    store.roles = [
      { id: 'r1', name: '普通员工', code: 'employee', is_sensitive: 0, description: null },
      { id: 'r2', name: '部门经理', code: 'manager', is_sensitive: 0, description: null },
      { id: 'r3', name: '财务审批', code: 'finance_approver', is_sensitive: 1, description: null },
      { id: 'r4', name: '系统管理员', code: 'admin', is_sensitive: 1, description: null }
    ];
  }
  
  if (store.departments.length === 0) {
    store.departments = [
      { id: 'dept_root', name: '总公司', parent_id: null, code: 'ROOT', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() },
      { id: 'dept_tech', name: '技术部', parent_id: 'dept_root', code: 'TECH', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() },
      { id: 'dept_ops', name: '运维部', parent_id: 'dept_root', code: 'OPS', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() },
      { id: 'dept_hr', name: '人力资源部', parent_id: 'dept_root', code: 'HR', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() }
    ];
  }
  
  if (store.employees.length === 0) {
    store.employees = [
      { id: 'emp_1001', name: '张三', emp_no: 'E1001', department_id: 'dept_tech', position: '工程师', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() },
      { id: 'emp_1002', name: '李四', emp_no: 'E1002', department_id: 'dept_ops', position: '运维主管', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() },
      { id: 'emp_1003', name: '王五', emp_no: 'E1003', department_id: 'dept_hr', position: 'HR经理', status: 'active', created_at: getTimestamp(), updated_at: getTimestamp() }
    ];
    
    store.employeeRoles = [
      { id: 1, employee_id: 'emp_1001', role_id: 'r1', granted_at: getTimestamp(), revoked_at: null },
      { id: 2, employee_id: 'emp_1002', role_id: 'r2', granted_at: getTimestamp(), revoked_at: null },
      { id: 3, employee_id: 'emp_1003', role_id: 'r3', granted_at: getTimestamp(), revoked_at: null },
      { id: 4, employee_id: 'emp_1003', role_id: 'r4', granted_at: getTimestamp(), revoked_at: null }
    ];
  }
}

initSeedData();

class Statement {
  constructor(sql) {
    this.sql = sql;
  }
  
  all(...params) {
    return this._execute('all', params);
  }
  
  get(...params) {
    const result = this._execute('get', params);
    return result.length > 0 ? result[0] : undefined;
  }
  
  run(...params) {
    this._execute('run', params);
    return { lastInsertRowid: recordIdCounter - 1 };
  }
  
  _execute(mode, params) {
    const sql = this.sql.trim().toUpperCase();
    
    if (sql.startsWith('INSERT')) {
      return this._handleInsert(params);
    } else if (sql.startsWith('UPDATE')) {
      return this._handleUpdate(params);
    } else if (sql.startsWith('SELECT')) {
      return this._handleSelect(mode, params);
    } else if (sql.startsWith('DELETE')) {
      return this._handleDelete(params);
    }
    return [];
  }
  
  _handleInsert(params) {
    const lowerSql = this.sql.toLowerCase();
    
    if (lowerSql.includes('sync_batches')) {
      const batch = {
        id: params[0],
        source: params[1],
        status: params[2] || 'pending',
        total_changes: 0,
        success_count: 0,
        failed_count: 0,
        created_at: getTimestamp(),
        completed_at: null,
        retry_count: 0
      };
      store.syncBatches.push(batch);
      return { lastInsertRowid: batch.id };
    }
    
    if (lowerSql.includes('sync_records')) {
      const rec = {
        id: recordIdCounter++,
        batch_id: params[0],
        record_type: params[1],
        action: params[2],
        entity_type: params[3],
        entity_id: params[4] || null,
        status: params[5] || 'pending',
        error_message: null,
        created_at: getTimestamp()
      };
      store.syncRecords.push(rec);
      return { lastInsertRowid: rec.id };
    }
    
    if (lowerSql.includes('permission_revocation_logs')) {
      const log = {
        id: recordIdCounter++,
        batch_id: params[0],
        employee_id: params[1],
        role_id: params[2],
        role_name: params[3] || null,
        reason: params[4],
        revoked_at: getTimestamp()
      };
      store.permissionRevocationLogs.push(log);
      return { lastInsertRowid: log.id };
    }
    
    if (lowerSql.includes('sync_conflicts')) {
      const conflict = {
        id: recordIdCounter++,
        batch_id: params[0],
        record_id: params[1],
        conflict_type: params[2],
        description: params[3],
        requires_manual_review: 1,
        resolved_at: null
      };
      store.syncConflicts.push(conflict);
      return { lastInsertRowid: conflict.id };
    }
    
    if (lowerSql.includes('departments')) {
      if (lowerSql.includes('or replace') || lowerSql.includes('insert or replace')) {
        const idx = store.departments.findIndex(d => d.id === params[0]);
        const dept = {
          id: params[0],
          name: params[1],
          parent_id: params[2] || null,
          code: params[3],
          status: params[4] || 'active',
          created_at: idx >= 0 ? store.departments[idx].created_at : getTimestamp(),
          updated_at: getTimestamp()
        };
        if (idx >= 0) {
          store.departments[idx] = dept;
        } else {
          store.departments.push(dept);
        }
        return { lastInsertRowid: dept.id };
      }
      const existing = store.departments.find(d => d.id === params[0]);
      if (existing) return { lastInsertRowid: params[0] };
      const dept = {
        id: params[0],
        name: params[1],
        parent_id: params[2] || null,
        code: params[3],
        status: params[4] || 'active',
        created_at: getTimestamp(),
        updated_at: getTimestamp()
      };
      store.departments.push(dept);
      return { lastInsertRowid: dept.id };
    }
    
    if (lowerSql.includes('department_history')) {
      const hist = {
        id: recordIdCounter++,
        dept_id: params[0],
        employee_id: params[1],
        start_date: getTimestamp(),
        end_date: null
      };
      store.departmentHistory.push(hist);
      return { lastInsertRowid: hist.id };
    }
    
    if (lowerSql.includes('employees')) {
      const existing = store.employees.find(e => e.id === params[0]);
      if (existing) return { lastInsertRowid: params[0] };
      const emp = {
        id: params[0],
        name: params[1],
        emp_no: params[2],
        department_id: params[3] || null,
        position: params[4] || null,
        status: params[5] || 'active',
        created_at: getTimestamp(),
        updated_at: getTimestamp()
      };
      store.employees.push(emp);
      return { lastInsertRowid: emp.id };
    }
    
    if (lowerSql.includes('employee_roles')) {
      const existing = store.employeeRoles.find(r => r.employee_id === params[0] && r.role_id === params[1] && r.revoked_at === null);
      if (existing) return { lastInsertRowid: existing.id };
      const role = {
        id: recordIdCounter++,
        employee_id: params[0],
        role_id: params[1],
        granted_at: getTimestamp(),
        revoked_at: null
      };
      store.employeeRoles.push(role);
      return { lastInsertRowid: role.id };
    }
    
    if (lowerSql.includes('roles')) {
      const existing = store.roles.find(r => r.id === params[0]);
      if (existing) return { lastInsertRowid: params[0] };
      const role = {
        id: params[0],
        name: params[1],
        code: params[2],
        is_sensitive: params[3] || 0,
        description: params[4] || null
      };
      store.roles.push(role);
      return { lastInsertRowid: role.id };
    }
    
    return { lastInsertRowid: recordIdCounter++ };
  }
  
  _handleUpdate(params) {
    const lowerSql = this.sql.toLowerCase();
    
    if (lowerSql.includes('sync_records') && lowerSql.includes('set status')) {
      if (params.length === 2) {
        const rec = store.syncRecords.find(r => r.id === params[1]);
        if (rec) { rec.status = params[0]; }
      } else if (params.length === 3) {
        const rec = store.syncRecords.find(r => r.id === params[2]);
        if (rec) { rec.status = params[0]; rec.error_message = params[1]; }
      }
      return [];
    }
    
    if (lowerSql.includes('sync_batches') && lowerSql.includes('set status')) {
      const batch = store.syncBatches.find(b => b.id === params[params.length - 1]);
      if (batch) {
        if (this.sql.toLowerCase().includes('retry_count')) {
          batch.status = params[0];
          batch.retry_count = (batch.retry_count || 0) + 1;
        } else if (lowerSql.includes('success_count')) {
          batch.status = params[0];
          batch.success_count = params[1];
          batch.failed_count = params[2];
          batch.completed_at = getTimestamp();
        } else {
          batch.status = params[0];
        }
      }
      return [];
    }
    
    if (lowerSql.includes('department_history') && lowerSql.includes('end_date')) {
      const hist = store.departmentHistory.find(h => h.id === params[params.length - 1]);
      if (hist) { hist.end_date = getTimestamp(); }
      return [];
    }
    
    if (lowerSql.includes('employees') && lowerSql.includes('set')) {
      const emp = store.employees.find(e => e.id === params[params.length - 1]);
      if (emp) {
        const setClauses = this.sql.toLowerCase().split('set')[1].split('where')[0];
        if (setClauses.includes('department_id')) {
          emp.department_id = params[0];
          if (params.length >= 3) emp.position = params[1];
        } else if (setClauses.includes('position')) {
          emp.position = params[0];
        } else if (setClauses.includes('status')) {
          if (setClauses.includes("'terminated'")) {
            emp.status = 'terminated';
          } else {
            emp.status = params[0];
          }
        } else if (setClauses.includes('name')) {
          if (params[0]) emp.name = params[0];
          if (params[1]) emp.position = params[1];
          if (params[2]) emp.status = params[2];
        }
        emp.updated_at = getTimestamp();
      }
      return [];
    }
    
    if (lowerSql.includes('departments') && lowerSql.includes('set')) {
      const whereMatch = this.sql.match(/where\s+id\s*=\s*\?/i);
      const deptId = whereMatch ? params[params.length - 1] : null;
      const dept = store.departments.find(d => d.id === deptId);
      if (dept) {
        if (lowerSql.includes('merged')) {
          dept.status = 'merged';
          dept.parent_id = params[0];
        } else if (lowerSql.includes('status')) {
          dept.status = params[3] || 'active';
          dept.name = params[0];
          dept.parent_id = params[1] || null;
          dept.code = params[2];
        }
        dept.updated_at = getTimestamp();
      }
      return [];
    }
    
    if (lowerSql.includes('employee_roles') && lowerSql.includes('revoked_at')) {
      const er = store.employeeRoles.find(r => r.id === params[params.length - 1]);
      if (er) { er.revoked_at = getTimestamp(); }
      return [];
    }
    
    return [];
  }
  
  _handleSelect(mode, params) {
    const lowerSql = this.sql.toLowerCase();
    
    if (lowerSql.includes('select count(*)') && lowerSql.includes('roles')) {
      return [{ count: store.roles.length }];
    }
    if (lowerSql.includes('select count(*)') && lowerSql.includes('departments')) {
      return [{ count: store.departments.length }];
    }
    if (lowerSql.includes('select count(*)') && lowerSql.includes('employees')) {
      return [{ count: store.employees.length }];
    }
    
    if (lowerSql.includes('from sync_batches') && lowerSql.includes('where id')) {
      const batch = store.syncBatches.find(b => b.id === params[0]);
      return batch ? [batch] : [];
    }
    
    if (lowerSql.includes('from sync_batches') && lowerSql.includes('order by')) {
      const limit = params[0] || 20;
      const offset = params[1] || 0;
      return [...store.syncBatches].reverse().slice(offset, offset + limit);
    }
    
    if (lowerSql.includes('from sync_records') && lowerSql.includes('batch_id')) {
      return store.syncRecords.filter(r => r.batch_id === params[0]);
    }
    
    if (lowerSql.includes('from sync_records') && lowerSql.includes('status in')) {
      return store.syncRecords.filter(r => 
        r.batch_id === params[0] && ['pending', 'failed'].includes(r.status)
      );
    }
    
    if (lowerSql.includes('from departments') && lowerSql.includes('where id')) {
      const dept = store.departments.find(d => d.id === params[0]);
      return dept ? [dept] : [];
    }
    
    if (lowerSql.includes('from departments') && lowerSql.includes('order by')) {
      return [...store.departments];
    }
    
    if (lowerSql.includes('from employees') && lowerSql.includes('where id')) {
      const emp = store.employees.find(e => e.id === params[0]);
      return emp ? [emp] : [];
    }
    
    if (lowerSql.includes('from employees') && lowerSql.includes('order by')) {
      return [...store.employees];
    }
    
    if (lowerSql.includes('from employees') && lowerSql.includes('department_id')) {
      return store.employees.filter(e => e.department_id === params[0]);
    }
    
    if (lowerSql.includes('from roles') && lowerSql.includes('where code')) {
      const role = store.roles.find(r => r.code === params[0]);
      return role ? [role] : [];
    }
    
    if (lowerSql.includes('from employee_roles') && lowerSql.includes('employee_id')) {
      if (lowerSql.includes('join roles')) {
        const er = store.employeeRoles.filter(r => r.employee_id === params[0] && r.revoked_at === null);
        return er.map(r => {
          const role = store.roles.find(rl => rl.id === r.role_id);
          return {
            id: r.id,
            role_id: r.role_id,
            name: role ? role.name : null,
            is_sensitive: role ? role.is_sensitive : 0
          };
        });
      }
      if (lowerSql.includes('revoked_at is null')) {
        return store.employeeRoles.filter(r => r.employee_id === params[0] && r.revoked_at === null);
      }
      const empRoles = store.employeeRoles.filter(r => r.employee_id === params[0]);
      return empRoles.map(er => {
        const role = store.roles.find(rl => rl.id === er.role_id);
        return {
          id: er.id,
          name: role ? role.name : null,
          code: role ? role.code : null,
          granted_at: er.granted_at,
          revoked_at: er.revoked_at
        };
      });
    }
    
    if (lowerSql.includes('from department_history') && lowerSql.includes('where employee_id')) {
      if (lowerSql.includes('join departments')) {
        const history = store.departmentHistory
          .filter(h => h.employee_id === params[0])
          .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
        return history.map(h => {
          const dept = store.departments.find(d => d.id === h.dept_id);
          return {
            ...h,
            dept_name: dept ? dept.name : null,
            dept_code: dept ? dept.code : null
          };
        });
      }
      if (lowerSql.includes('and end_date is null')) {
        const hist = store.departmentHistory.find(h => 
          h.employee_id === params[0] && h.dept_id === params[1] && h.end_date === null
        );
        return hist ? [hist] : [];
      }
      const hist = store.departmentHistory.find(h => 
        h.employee_id === params[0] && h.end_date === null
      );
      return hist ? [hist] : [];
    }
    
    if (lowerSql.includes('from permission_revocation_logs') && lowerSql.includes('select 1')) {
      const log = store.permissionRevocationLogs.find(l => 
        l.batch_id === params[0] && l.employee_id === params[1] && l.role_id === params[2]
      );
      return log ? [{ '1': 1 }] : [];
    }
    
    if (lowerSql.includes('from permission_revocation_logs') && lowerSql.includes('left join')) {
      const logs = store.permissionRevocationLogs.filter(l => l.batch_id === params[0]);
      return logs.map(l => {
        const emp = store.employees.find(e => e.id === l.employee_id);
        return { ...l, employee_name: emp ? emp.name : null };
      });
    }
    
    if (lowerSql.includes('from sync_conflicts')) {
      return store.syncConflicts.filter(c => c.batch_id === params[0]);
    }
    
    if (lowerSql.includes('select 1 from employee_roles')) {
      const er = store.employeeRoles.find(r => 
        r.employee_id === params[0] && r.role_id === params[1] &&
        new Date(r.granted_at) >= new Date(store.syncBatches.find(b => b.id === params[2])?.created_at || 0)
      );
      return er ? [{ '1': 1 }] : [];
    }
    
    return [];
  }
  
  _handleDelete(params) {
    return [];
  }
}

const db = {
  prepare(sql) {
    return new Statement(sql);
  },
  exec(sql) {
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim().startsWith('CREATE')) continue;
    }
  },
  pragma() {}
};

module.exports = db;
