"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceService = void 0;
class ReferenceService {
    constructor() {
        this.departments = new Map([
            ['dept-tech', { id: 'dept-tech', name: '技术部' }],
            ['dept-hr', { id: 'dept-hr', name: '人力资源部' }],
            ['dept-finance', { id: 'dept-finance', name: '财务部' }],
            ['dept-marketing', { id: 'dept-marketing', name: '市场部' }],
            ['dept-ops', { id: 'dept-ops', name: '运营部' }]
        ]);
        this.roles = new Map([
            ['role-admin', { id: 'role-admin', name: '管理员' }],
            ['role-manager', { id: 'role-manager', name: '经理' }],
            ['role-developer', { id: 'role-developer', name: '开发人员' }],
            ['role-hr-admin', { id: 'role-hr-admin', name: 'HR管理员' }],
            ['role-finance', { id: 'role-finance', name: '财务人员' }],
            ['role-marketing', { id: 'role-marketing', name: '市场人员' }],
            ['role-operator', { id: 'role-operator', name: '运营人员' }],
            ['role-intern', { id: 'role-intern', name: '实习生' }]
        ]);
    }
    static getInstance() {
        if (!ReferenceService.instance) {
            ReferenceService.instance = new ReferenceService();
        }
        return ReferenceService.instance;
    }
    getAllDepartments() {
        return Array.from(this.departments.values());
    }
    findDepartmentById(id) {
        return this.departments.get(id);
    }
    findDepartmentByName(name) {
        return Array.from(this.departments.values()).find(d => d.name === name);
    }
    validateDepartmentId(id) {
        return this.departments.has(id);
    }
    getAllRoles() {
        return Array.from(this.roles.values());
    }
    findRoleById(id) {
        return this.roles.get(id);
    }
    findRoleByName(name) {
        return Array.from(this.roles.values()).find(r => r.name === name);
    }
    validateRoleId(id) {
        return this.roles.has(id);
    }
    validateRoleIds(ids) {
        const valid = [];
        const invalid = [];
        ids.forEach(id => {
            if (this.validateRoleId(id)) {
                valid.push(id);
            }
            else {
                invalid.push(id);
            }
        });
        return { valid, invalid };
    }
}
exports.referenceService = ReferenceService.getInstance();
