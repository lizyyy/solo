import { store } from '../store/memoryStore';

export interface Department {
  id: string;
  name: string;
}

export interface Role {
  id: string;
  name: string;
}

class ReferenceService {
  private departments: Map<string, Department> = new Map([
    ['dept-tech', { id: 'dept-tech', name: '技术部' }],
    ['dept-hr', { id: 'dept-hr', name: '人力资源部' }],
    ['dept-finance', { id: 'dept-finance', name: '财务部' }],
    ['dept-marketing', { id: 'dept-marketing', name: '市场部' }],
    ['dept-ops', { id: 'dept-ops', name: '运营部' }]
  ]);
  
  private roles: Map<string, Role> = new Map([
    ['role-admin', { id: 'role-admin', name: '管理员' }],
    ['role-manager', { id: 'role-manager', name: '经理' }],
    ['role-developer', { id: 'role-developer', name: '开发人员' }],
    ['role-hr-admin', { id: 'role-hr-admin', name: 'HR管理员' }],
    ['role-finance', { id: 'role-finance', name: '财务人员' }],
    ['role-marketing', { id: 'role-marketing', name: '市场人员' }],
    ['role-operator', { id: 'role-operator', name: '运营人员' }],
    ['role-intern', { id: 'role-intern', name: '实习生' }]
  ]);
  
  private static instance: ReferenceService;
  
  private constructor() {}
  
  static getInstance(): ReferenceService {
    if (!ReferenceService.instance) {
      ReferenceService.instance = new ReferenceService();
    }
    return ReferenceService.instance;
  }
  
  getAllDepartments(): Department[] {
    return Array.from(this.departments.values());
  }
  
  findDepartmentById(id: string): Department | undefined {
    return this.departments.get(id);
  }
  
  findDepartmentByName(name: string): Department | undefined {
    return Array.from(this.departments.values()).find(
      d => d.name === name
    );
  }
  
  validateDepartmentId(id: string): boolean {
    return this.departments.has(id);
  }
  
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }
  
  findRoleById(id: string): Role | undefined {
    return this.roles.get(id);
  }
  
  findRoleByName(name: string): Role | undefined {
    return Array.from(this.roles.values()).find(
      r => r.name === name
    );
  }
  
  validateRoleId(id: string): boolean {
    return this.roles.has(id);
  }
  
  validateRoleIds(ids: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    ids.forEach(id => {
      if (this.validateRoleId(id)) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    });
    
    return { valid, invalid };
  }
}

export const referenceService = ReferenceService.getInstance();
