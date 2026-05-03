import { Utils } from './utils.js';

const STORAGE_KEYS = {
    TEMPLATES: 'table_inspector_templates',
    CURRENT_DRAFT: 'table_inspector_draft',
    SETTINGS: 'table_inspector_settings'
};

export const Storage = {
    available() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return JSON.parse(value);
        } catch (e) {
            console.warn('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('Storage remove error:', e);
            return false;
        }
    },

    getTemplates() {
        return this.get(STORAGE_KEYS.TEMPLATES, []);
    },

    getTemplate(id) {
        const templates = this.getTemplates();
        return templates.find(t => t.id === id) || null;
    },

    saveTemplate(template) {
        const templates = this.getTemplates();
        const existingIndex = templates.findIndex(t => t.id === template.id);
        
        const templateToSave = {
            ...template,
            updatedAt: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            templates[existingIndex] = templateToSave;
        } else {
            templateToSave.id = template.id || Utils.generateId();
            templateToSave.createdAt = new Date().toISOString();
            templates.push(templateToSave);
        }
        
        this.set(STORAGE_KEYS.TEMPLATES, templates);
        return templateToSave;
    },

    deleteTemplate(id) {
        const templates = this.getTemplates();
        const filtered = templates.filter(t => t.id !== id);
        this.set(STORAGE_KEYS.TEMPLATES, filtered);
    },

    getDefaultTemplate() {
        const templates = this.getTemplates();
        return templates.find(t => t.isDefault) || templates[0] || null;
    },

    saveDraft(draft) {
        const draftToSave = {
            ...draft,
            savedAt: new Date().toISOString()
        };
        this.set(STORAGE_KEYS.CURRENT_DRAFT, draftToSave);
    },

    getDraft() {
        return this.get(STORAGE_KEYS.CURRENT_DRAFT, null);
    },

    clearDraft() {
        this.remove(STORAGE_KEYS.CURRENT_DRAFT);
    },

    getSettings() {
        return this.get(STORAGE_KEYS.SETTINGS, {
            lastTemplateId: null,
            theme: 'light',
            autoSave: true
        });
    },

    saveSettings(settings) {
        this.set(STORAGE_KEYS.SETTINGS, {
            ...this.getSettings(),
            ...settings
        });
    },

    exportAll() {
        return {
            templates: this.getTemplates(),
            settings: this.getSettings(),
            exportTime: new Date().toISOString()
        };
    },

    importAll(data) {
        if (data.templates) {
            this.set(STORAGE_KEYS.TEMPLATES, data.templates);
        }
        if (data.settings) {
            this.set(STORAGE_KEYS.SETTINGS, data.settings);
        }
        return true;
    },

    clearAll() {
        this.remove(STORAGE_KEYS.TEMPLATES);
        this.remove(STORAGE_KEYS.CURRENT_DRAFT);
        this.remove(STORAGE_KEYS.SETTINGS);
    },

    getStorageInfo() {
        const templates = this.getTemplates();
        const draft = this.getDraft();
        const settings = this.getSettings();
        
        return {
            available: this.available(),
            templatesCount: templates.length,
            hasDraft: !!draft,
            draftSize: draft ? JSON.stringify(draft).length : 0,
            settings
        };
    }
};

export const DEFAULT_TEMPLATES = [
    {
        id: 'default_order',
        name: '订单导入模板',
        description: '标准订单数据导入模板',
        isDefault: true,
        fields: [
            {
                id: 'order_no',
                name: '订单编号',
                aliases: ['订单号', 'order_id', 'orderNo', '单号'],
                type: 'string',
                required: true,
                unique: true,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'customer_name',
                name: '客户名称',
                aliases: ['客户', '客户姓名', 'customer', 'name'],
                type: 'string',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'order_date',
                name: '下单日期',
                aliases: ['日期', '订单时间', 'date', 'create_time', '创建时间'],
                type: 'date',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'YYYY-MM-DD',
                amountUnit: 'auto'
            },
            {
                id: 'amount',
                name: '订单金额',
                aliases: ['金额', '总金额', 'total', 'price', '订单总价'],
                type: 'amount',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'unit_price',
                name: '单价',
                aliases: ['单价', 'price_per_unit', 'unitPrice'],
                type: 'amount',
                required: false,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'quantity',
                name: '数量',
                aliases: ['数量', 'qty', 'count', '件数'],
                type: 'number',
                required: false,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'status',
                name: '订单状态',
                aliases: ['状态', 'state', 'order_status'],
                type: 'string',
                required: false,
                unique: false,
                enums: ['待支付', '已支付', '已发货', '已完成', '已取消', '待处理', '处理中'],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'is_urgent',
                name: '是否加急',
                aliases: ['加急', '紧急', 'urgent', 'is_urgent'],
                type: 'boolean',
                required: false,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            }
        ],
        crossFieldRules: [
            {
                id: 'rule_1',
                type: 'amount_check',
                name: '金额校验',
                description: '订单金额 = 单价 × 数量',
                totalField: 'amount',
                priceField: 'unit_price',
                quantityField: 'quantity',
                errorMessage: '订单金额与单价×数量不一致'
            }
        ]
    },
    {
        id: 'default_employee',
        name: '员工信息模板',
        description: '员工入职信息导入模板',
        isDefault: false,
        fields: [
            {
                id: 'employee_id',
                name: '员工编号',
                aliases: ['工号', '编号', 'emp_id', 'employeeNo'],
                type: 'string',
                required: true,
                unique: true,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'name',
                name: '姓名',
                aliases: ['员工姓名', '姓名', 'employee_name'],
                type: 'string',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'department',
                name: '部门',
                aliases: ['所属部门', '部门', 'dept'],
                type: 'string',
                required: true,
                unique: false,
                enums: ['技术部', '产品部', '运营部', '市场部', '人力资源部', '财务部'],
                dateFormat: 'auto',
                amountUnit: 'auto'
            },
            {
                id: 'join_date',
                name: '入职日期',
                aliases: ['入职时间', '到岗日期', 'start_date'],
                type: 'date',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'YYYY-MM-DD',
                amountUnit: 'auto'
            },
            {
                id: 'salary',
                name: '薪资',
                aliases: ['月薪', '工资', '薪酬', 'monthly_salary'],
                type: 'amount',
                required: true,
                unique: false,
                enums: [],
                dateFormat: 'auto',
                amountUnit: 'yuan'
            }
        ],
        crossFieldRules: []
    }
];

export function initializeDefaultTemplates() {
    const existing = Storage.getTemplates();
    if (existing.length === 0) {
        DEFAULT_TEMPLATES.forEach(template => {
            Storage.saveTemplate({
                ...template,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        });
    }
}

export default Storage;
