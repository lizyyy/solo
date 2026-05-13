const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'temp_permissions.json');

let data = {
  permissions: [],
  approvals: [],
  extensions: [],
  auditLogs: [],
  revokeTasks: []
};

const PERMISSION_TYPES = {
  DB_READ_ONLY: {
    name: '数据库只读',
    code: 'DB_READ_ONLY',
    maxValidityDays: 7,
    description: '数据库只读访问权限'
  },
  LOG_QUERY: {
    name: '日志查询',
    code: 'LOG_QUERY',
    maxValidityDays: 14,
    description: '系统日志查询权限'
  },
  DEPLOY_OPERATION: {
    name: '发布操作',
    code: 'DEPLOY_OPERATION',
    maxValidityDays: 3,
    description: '生产环境发布操作权限'
  }
};

const PERMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  AUTHORIZED: 'authorized',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  REVOKE_FAILED: 'revoke_failed'
};

const EXTENSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const rawData = fs.readFileSync(DATA_FILE, 'utf8');
      data = JSON.parse(rawData);
    } catch (error) {
      console.error('读取数据文件失败，使用默认数据:', error.message);
      data = {
        permissions: [],
        approvals: [],
        extensions: [],
        auditLogs: [],
        revokeTasks: []
      };
    }
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('保存数据文件失败:', error.message);
  }
}

function init() {
  loadData();
  console.log('内存数据库初始化完成');
  console.log(`数据文件: ${DATA_FILE}`);
  console.log(`当前数据量: ${data.permissions.length} 个权限`);
}

function getPermissionTypes() {
  return PERMISSION_TYPES;
}

function getPermissionStatus() {
  return PERMISSION_STATUS;
}

function getExtensionStatus() {
  return EXTENSION_STATUS;
}

function getMaxValidityDays(permissionType) {
  const type = PERMISSION_TYPES[permissionType];
  if (!type) {
    throw new Error(`未知的权限类型: ${permissionType}`);
  }
  return type.maxValidityDays;
}

function isValidPermissionType(permissionType) {
  return !!PERMISSION_TYPES[permissionType];
}

function getDb() {
  const db = {};
  
  db.permissions = {
    insert: (item) => {
      data.permissions.push(item);
      saveData();
    },
    update: (id, updates) => {
      const index = data.permissions.findIndex(p => p.id === id);
      if (index !== -1) {
        data.permissions[index] = { ...data.permissions[index], ...updates };
        saveData();
      }
    },
    findById: (id) => {
      return data.permissions.find(p => p.id === id);
    },
    find: (filters = {}) => {
      let results = [...data.permissions];
      
      if (filters.status) {
        results = results.filter(p => p.status === filters.status);
      }
      if (filters.applicant) {
        results = results.filter(p => p.applicant === filters.applicant);
      }
      if (filters.permission_type) {
        results = results.filter(p => p.permission_type === filters.permission_type);
      }
      
      return results;
    },
    findExpired: (now) => {
      return data.permissions.filter(p => 
        p.status === 'authorized' && p.valid_to <= now
      );
    },
    findExpiring: (now, cutoff) => {
      return data.permissions.filter(p => 
        p.status === 'authorized' && 
        p.valid_to <= cutoff && 
        p.valid_to > now
      );
    },
    findRevokedOrFailed: () => {
      return data.permissions.filter(p => 
        p.status === 'revoked' || p.status === 'revoke_failed'
      );
    },
    all: () => {
      return [...data.permissions];
    }
  };
  
  db.approvals = {
    insert: (item) => {
      data.approvals.push(item);
      saveData();
    },
    findById: (id) => {
      return data.approvals.find(a => a.id === id);
    },
    findByPermission: (permissionId) => {
      return data.approvals.filter(a => a.permission_id === permissionId);
    }
  };
  
  db.extensions = {
    insert: (item) => {
      data.extensions.push(item);
      saveData();
    },
    update: (id, updates) => {
      const index = data.extensions.findIndex(e => e.id === id);
      if (index !== -1) {
        data.extensions[index] = { ...data.extensions[index], ...updates };
        saveData();
      }
    },
    findById: (id) => {
      return data.extensions.find(e => e.id === id);
    },
    findByPermission: (permissionId) => {
      return data.extensions.filter(e => e.permission_id === permissionId);
    }
  };
  
  db.auditLogs = {
    insert: (item) => {
      data.auditLogs.push(item);
      saveData();
    },
    find: (filters = {}) => {
      let results = [...data.auditLogs];
      
      if (filters.permission_id) {
        results = results.filter(l => l.permission_id === filters.permission_id);
      }
      if (filters.action) {
        results = results.filter(l => l.action === filters.action);
      }
      
      results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (filters.limit) {
        results = results.slice(0, filters.limit);
      }
      
      return results;
    }
  };
  
  db.revokeTasks = {
    insert: (item) => {
      data.revokeTasks.push(item);
      saveData();
    },
    update: (id, updates) => {
      const index = data.revokeTasks.findIndex(t => t.id === id);
      if (index !== -1) {
        data.revokeTasks[index] = { ...data.revokeTasks[index], ...updates };
        saveData();
      }
    },
    findPending: () => {
      return data.revokeTasks.filter(t => t.status === 'pending');
    },
    findByPermission: (permissionId) => {
      return data.revokeTasks.find(t => t.permission_id === permissionId);
    }
  };
  
  db.transaction = (fn) => {
    return () => {
      try {
        fn();
        saveData();
      } catch (error) {
        throw error;
      }
    };
  };
  
  db.prepare = (sql) => {
    return {
      run: (...params) => {
        const normalized = sql.toUpperCase().trim();
        
        if (normalized.startsWith('INSERT')) {
          if (normalized.includes('PERMISSIONS')) {
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            if (fieldsMatch) {
              const fields = fieldsMatch[1].split(',').map(s => s.trim());
              const item = {};
              fields.forEach((field, idx) => {
                item[field] = params[idx];
              });
              data.permissions.push(item);
              saveData();
            }
          } else if (normalized.includes('APPROVALS')) {
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            if (fieldsMatch) {
              const fields = fieldsMatch[1].split(',').map(s => s.trim());
              const item = {};
              fields.forEach((field, idx) => {
                item[field] = params[idx];
              });
              data.approvals.push(item);
              saveData();
            }
          } else if (normalized.includes('EXTENSIONS')) {
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            if (fieldsMatch) {
              const fields = fieldsMatch[1].split(',').map(s => s.trim());
              const item = {};
              fields.forEach((field, idx) => {
                item[field] = params[idx];
              });
              data.extensions.push(item);
              saveData();
            }
          } else if (normalized.includes('AUDIT_LOGS') || normalized.includes('AUDIT')) {
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            if (fieldsMatch) {
              const fields = fieldsMatch[1].split(',').map(s => s.trim());
              const item = {};
              fields.forEach((field, idx) => {
                item[field] = params[idx];
              });
              data.auditLogs.push(item);
              saveData();
            }
          } else if (normalized.includes('REVOKE_TASKS')) {
            const fieldsMatch = sql.match(/\(([^)]+)\)/);
            if (fieldsMatch) {
              const fields = fieldsMatch[1].split(',').map(s => s.trim());
              const item = {};
              fields.forEach((field, idx) => {
                item[field] = params[idx];
              });
              data.revokeTasks.push(item);
              saveData();
            }
          }
        } else if (normalized.startsWith('UPDATE')) {
          let tableName = null;
          if (normalized.includes('PERMISSIONS')) {
            tableName = 'permissions';
          } else if (normalized.includes('EXTENSIONS')) {
            tableName = 'extensions';
          }
          
          if (tableName) {
            const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
            const whereMatch = sql.match(/WHERE\s+(.+)/i);
            
            if (setMatch && whereMatch) {
              const updates = {};
              const setParts = setMatch[1].split(',');
              let paramIdx = 0;
              
              setParts.forEach(part => {
                const match = part.trim().match(/(\w+)\s*=\s*\?/);
                if (match) {
                  updates[match[1]] = params[paramIdx];
                  paramIdx++;
                }
              });
              
              const wherePart = whereMatch[1];
              const whereIdMatch = wherePart.match(/id\s*=\s*\?/);
              
              if (whereIdMatch) {
                const id = params[paramIdx];
                const items = data[tableName];
                const index = items.findIndex(item => item.id === id);
                if (index !== -1) {
                  items[index] = { ...items[index], ...updates };
                  saveData();
                }
              }
            }
          }
        }
      },
      all: (...params) => {
        const normalized = sql.toUpperCase().trim();
        
        if (normalized.startsWith('SELECT')) {
          let results = [];
          
          if (normalized.includes('AUDIT_LOGS') || normalized.includes('AUDIT')) {
            results = [...data.auditLogs];
          } else if (normalized.includes('REVOKE_TASKS')) {
            results = [...data.revokeTasks];
          } else if (normalized.includes('PERMISSIONS')) {
            results = [...data.permissions];
          } else if (normalized.includes('APPROVALS')) {
            results = [...data.approvals];
          } else if (normalized.includes('EXTENSIONS')) {
            results = [...data.extensions];
          }
          
          const whereMatch = sql.match(/WHERE\s+(.+?)(ORDER|LIMIT|$)/i);
          if (whereMatch) {
            const whereClause = whereMatch[1];
            
            const eqMatches = whereClause.match(/(\w+)\s*=\s*\?/g);
            if (eqMatches && params.length > 0) {
              let paramIdx = 0;
              eqMatches.forEach(eq => {
                const fieldMatch = eq.match(/(\w+)\s*=/);
                if (fieldMatch && params[paramIdx] !== undefined) {
                  const field = fieldMatch[1];
                  const value = params[paramIdx];
                  results = results.filter(item => item[field] === value);
                  paramIdx++;
                }
              });
            }
            
            if (whereClause.includes('IN')) {
              const inMatch = whereClause.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
              if (inMatch) {
                const field = inMatch[1];
                const placeholders = inMatch[2].split(',').filter(s => s.trim() === '?');
                const values = params.slice(0, placeholders.length);
                results = results.filter(item => values.includes(item[field]));
              }
            }
            
            if (whereClause.includes('<=')) {
              const lteMatches = whereClause.match(/(\w+)\s*<=\s*\?/g);
              if (lteMatches && params.length > 0) {
                let paramIdx = 0;
                const eqCount = (whereClause.match(/(\w+)\s*=\s*\?/g) || []).length;
                paramIdx = eqCount;
                
                lteMatches.forEach(lte => {
                  const fieldMatch = lte.match(/(\w+)\s*<=/);
                  if (fieldMatch && params[paramIdx] !== undefined) {
                    const field = fieldMatch[1];
                    const value = params[paramIdx];
                    results = results.filter(item => item[field] <= value);
                    paramIdx++;
                  }
                });
              }
            }
            
            if (whereClause.includes('>') && !whereClause.includes('>=')) {
              const gtMatches = whereClause.match(/(\w+)\s*>\s*\?/g);
              if (gtMatches && params.length > 0) {
                let paramIdx = 0;
                const eqCount = (whereClause.match(/(\w+)\s*=\s*\?/g) || []).length;
                const lteCount = (whereClause.match(/(\w+)\s*<=\s*\?/g) || []).length;
                paramIdx = eqCount + lteCount;
                
                gtMatches.forEach(gt => {
                  const fieldMatch = gt.match(/(\w+)\s*>/);
                  if (fieldMatch && params[paramIdx] !== undefined) {
                    const field = fieldMatch[1];
                    const value = params[paramIdx];
                    results = results.filter(item => item[field] > value);
                    paramIdx++;
                  }
                });
              }
            }
          }
          
          const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(\s+(ASC|DESC))?/i);
          if (orderMatch) {
            const field = orderMatch[1];
            const direction = (orderMatch[3] || 'ASC').toUpperCase();
            results.sort((a, b) => {
              if (a[field] < b[field]) return direction === 'ASC' ? -1 : 1;
              if (a[field] > b[field]) return direction === 'ASC' ? 1 : -1;
              return 0;
            });
          }
          
          const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
          if (limitMatch) {
            results = results.slice(0, parseInt(limitMatch[1]));
          }
          
          if (normalized.includes('JOIN')) {
            if (normalized.includes('REVOKE_TASKS') && normalized.includes('PERMISSIONS')) {
              results = results.map(task => {
                const permission = data.permissions.find(p => p.id === task.permission_id);
                if (permission) {
                  return {
                    ...task,
                    applicant: permission.applicant,
                    permission_type: permission.permission_type,
                    valid_to: permission.valid_to
                  };
                }
                return task;
              });
            } else if (normalized.includes('AUDIT_LOGS') && normalized.includes('PERMISSIONS')) {
              results = results.map(log => {
                const permission = data.permissions.find(p => p.id === log.permission_id);
                if (permission) {
                  return {
                    ...log,
                    applicant: permission.applicant,
                    permission_type: permission.permission_type
                  };
                }
                return log;
              });
            } else if (normalized.includes('PERMISSIONS') && normalized.includes('REVOKE_TASKS')) {
              results = results.map(permission => {
                const task = data.revokeTasks.find(t => t.permission_id === permission.id);
                if (task) {
                  return {
                    ...permission,
                    task_id: task.id,
                    task_reason: task.reason,
                    task_status: task.status
                  };
                }
                return permission;
              });
            }
          }
          
          if (normalized.includes('GROUP BY')) {
            const groupMatch = sql.match(/GROUP\s+BY\s+(\w+)/i);
            if (groupMatch) {
              const groupField = groupMatch[1];
              const grouped = {};
              
              results.forEach(item => {
                const key = item[groupField];
                if (!grouped[key]) {
                  grouped[key] = {
                    [groupField]: key,
                    total: 0,
                    active: 0,
                    revoked: 0,
                    revoke_failed: 0,
                    expiring: 0
                  };
                }
                grouped[key].total++;
                if (item.status === 'authorized') grouped[key].active++;
                if (item.status === 'revoked') grouped[key].revoked++;
                if (item.status === 'revoke_failed') grouped[key].revoke_failed++;
              });
              
              return Object.values(grouped);
            }
          }
          
          return results;
        }
        
        return [];
      },
      get: (...params) => {
        const results = db.prepare(sql).all(...params);
        return results[0];
      }
    };
  };
  
  db.pragma = () => {};
  db.exec = () => {};
  
  return db;
}

module.exports = {
  init,
  getDb,
  getPermissionTypes,
  getPermissionStatus,
  getExtensionStatus,
  getMaxValidityDays,
  isValidPermissionType,
  PERMISSION_TYPES,
  PERMISSION_STATUS,
  EXTENSION_STATUS
};
