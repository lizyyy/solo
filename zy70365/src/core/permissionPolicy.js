const path = require('path');

const POLICY_TYPES = {
  READ_ONLY: 'read_only',
  WRITE_RESTRICTED: 'write_restricted',
  NO_FILESYSTEM: 'no_filesystem',
  NO_NETWORK: 'no_network',
  LIMITED: 'limited',
  FULL: 'full'
};

const DEFAULT_POLICIES = {
  [POLICY_TYPES.READ_ONLY]: {
    name: '只读策略',
    description: '只允许读取特定目录的文件，禁止写入和网络访问',
    fileAccess: {
      read: true,
      write: false,
      allowedReadPaths: ['/tmp/sandbox', './workspace'],
      forbiddenPaths: ['/etc', '/var', '/home', '/root']
    },
    networkAccess: false,
    processAccess: false
  },
  [POLICY_TYPES.WRITE_RESTRICTED]: {
    name: '受限写策略',
    description: '允许读取和写入工作目录，但禁止访问敏感路径',
    fileAccess: {
      read: true,
      write: true,
      allowedReadPaths: ['/tmp/sandbox', './workspace'],
      allowedWritePaths: ['./workspace/output', '/tmp/sandbox'],
      forbiddenPaths: ['/etc', '/var', '/home', '/root']
    },
    networkAccess: false,
    processAccess: false
  },
  [POLICY_TYPES.NO_FILESYSTEM]: {
    name: '无文件系统策略',
    description: '完全禁止文件系统访问',
    fileAccess: {
      read: false,
      write: false,
      allowedReadPaths: [],
      allowedWritePaths: [],
      forbiddenPaths: []
    },
    networkAccess: false,
    processAccess: false
  },
  [POLICY_TYPES.NO_NETWORK]: {
    name: '无网络策略',
    description: '允许文件访问，但禁止网络操作',
    fileAccess: {
      read: true,
      write: true,
      allowedReadPaths: ['/tmp/sandbox', './workspace'],
      allowedWritePaths: ['./workspace/output', '/tmp/sandbox'],
      forbiddenPaths: ['/etc', '/var', '/home', '/root']
    },
    networkAccess: false,
    processAccess: false
  },
  [POLICY_TYPES.LIMITED]: {
    name: '受限策略（默认）',
    description: '默认策略，限制文件访问和禁止网络',
    fileAccess: {
      read: true,
      write: true,
      allowedReadPaths: ['./workspace', '/tmp'],
      allowedWritePaths: ['./workspace/output'],
      forbiddenPaths: ['/etc', '/var', '/home', '/root', '/usr']
    },
    networkAccess: false,
    processAccess: false
  },
  [POLICY_TYPES.FULL]: {
    name: '完全策略',
    description: '完全访问权限（仅管理员使用）',
    fileAccess: {
      read: true,
      write: true,
      allowedReadPaths: null,
      allowedWritePaths: null,
      forbiddenPaths: []
    },
    networkAccess: true,
    processAccess: true
  }
};

class PermissionPolicy {
  constructor(policyType = POLICY_TYPES.LIMITED, customPolicy = null) {
    if (customPolicy) {
      this.policy = this._mergePolicy(DEFAULT_POLICIES[POLICY_TYPES.LIMITED], customPolicy);
      this.policyType = 'custom';
    } else if (DEFAULT_POLICIES[policyType]) {
      this.policy = JSON.parse(JSON.stringify(DEFAULT_POLICIES[policyType]));
      this.policyType = policyType;
    } else {
      this.policy = JSON.parse(JSON.stringify(DEFAULT_POLICIES[POLICY_TYPES.LIMITED]));
      this.policyType = POLICY_TYPES.LIMITED;
    }
  }

  _mergePolicy(base, custom) {
    const merged = JSON.parse(JSON.stringify(base));
    if (custom.fileAccess) {
      merged.fileAccess = { ...merged.fileAccess, ...custom.fileAccess };
    }
    if (typeof custom.networkAccess !== 'undefined') {
      merged.networkAccess = custom.networkAccess;
    }
    if (typeof custom.processAccess !== 'undefined') {
      merged.processAccess = custom.processAccess;
    }
    return merged;
  }

  canReadFile(filePath) {
    if (!this.policy.fileAccess.read) {
      return {
        allowed: false,
        reason: '文件读取权限被禁用',
        policy: this.policyType
      };
    }

    const forbidden = this._isPathInList(filePath, this.policy.fileAccess.forbiddenPaths);
    if (forbidden) {
      return {
        allowed: false,
        reason: `路径 '${filePath}' 在禁止访问列表中`,
        policy: this.policyType
      };
    }

    if (this.policy.fileAccess.allowedReadPaths && this.policy.fileAccess.allowedReadPaths.length > 0) {
      const allowed = this._isPathInList(filePath, this.policy.fileAccess.allowedReadPaths);
      if (!allowed) {
        return {
          allowed: false,
          reason: `路径 '${filePath}' 不在允许读取的目录列表中`,
          policy: this.policyType
        };
      }
    }

    return {
      allowed: true,
      reason: null,
      policy: this.policyType
    };
  }

  canWriteFile(filePath) {
    if (!this.policy.fileAccess.write) {
      return {
        allowed: false,
        reason: '文件写入权限被禁用',
        policy: this.policyType
      };
    }

    const forbidden = this._isPathInList(filePath, this.policy.fileAccess.forbiddenPaths);
    if (forbidden) {
      return {
        allowed: false,
        reason: `路径 '${filePath}' 在禁止访问列表中`,
        policy: this.policyType
      };
    }

    if (this.policy.fileAccess.allowedWritePaths && this.policy.fileAccess.allowedWritePaths.length > 0) {
      const allowed = this._isPathInList(filePath, this.policy.fileAccess.allowedWritePaths);
      if (!allowed) {
        return {
          allowed: false,
          reason: `路径 '${filePath}' 不在允许写入的目录列表中`,
          policy: this.policyType
        };
      }
    }

    return {
      allowed: true,
      reason: null,
      policy: this.policyType
    };
  }

  canAccessNetwork() {
    return {
      allowed: this.policy.networkAccess,
      reason: this.policy.networkAccess ? null : '网络访问权限被禁用',
      policy: this.policyType
    };
  }

  canAccessProcess() {
    return {
      allowed: this.policy.processAccess,
      reason: this.policy.processAccess ? null : '进程操作权限被禁用',
      policy: this.policyType
    };
  }

  _isPathInList(filePath, pathList) {
    if (!pathList || pathList.length === 0) return false;
    
    const normalizedTarget = path.resolve(filePath);
    
    for (const listPath of pathList) {
      const normalizedList = path.resolve(listPath);
      
      if (normalizedTarget === normalizedList) {
        return true;
      }
      
      if (normalizedTarget.startsWith(normalizedList + path.sep)) {
        return true;
      }
    }
    
    return false;
  }

  getPolicy() {
    return JSON.parse(JSON.stringify(this.policy));
  }

  getPolicyType() {
    return this.policyType;
  }

  static getPolicyTypes() {
    return POLICY_TYPES;
  }

  static getDefaultPolicies() {
    return JSON.parse(JSON.stringify(DEFAULT_POLICIES));
  }
}

module.exports = {
  PermissionPolicy,
  POLICY_TYPES,
  DEFAULT_POLICIES
};
