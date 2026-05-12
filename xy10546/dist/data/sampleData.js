"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleReimbursements = exports.sampleInvoices = exports.sampleEmployees = exports.sampleDepartments = exports.sampleCompanyHeaders = void 0;
exports.getLinkedSampleData = getLinkedSampleData;
const uuid_1 = require("uuid");
const now = new Date();
exports.sampleCompanyHeaders = [
    {
        id: 'comp-001',
        name: '创新科技（北京）有限公司',
        taxId: '91110108MA00C1234X',
        groupId: 'group-cxkj',
        companyType: 'parent',
        allowedDepartments: ['dept-001', 'dept-002', 'dept-003'],
        status: 'active'
    },
    {
        id: 'comp-002',
        name: '创新科技（上海）有限公司',
        taxId: '91310115MA1234567X',
        groupId: 'group-cxkj',
        companyType: 'subsidiary',
        allowedDepartments: ['dept-004'],
        status: 'active'
    },
    {
        id: 'comp-003',
        name: '远景贸易有限公司',
        taxId: '91110105MA00B7654X',
        groupId: 'group-yjmy',
        companyType: 'parent',
        allowedDepartments: ['dept-005'],
        status: 'active'
    },
    {
        id: 'comp-004',
        name: '创新科技北京有限公司',
        taxId: '91110108MA00C1234X',
        groupId: 'group-cxkj',
        companyType: 'parent',
        allowedDepartments: ['dept-001'],
        status: 'inactive'
    }
];
exports.sampleDepartments = [
    {
        id: 'dept-001',
        name: '研发中心',
        manager: '张经理',
        allowedCompanyHeaders: ['comp-001']
    },
    {
        id: 'dept-002',
        name: '销售部',
        manager: '李经理',
        allowedCompanyHeaders: ['comp-001']
    },
    {
        id: 'dept-003',
        name: '财务部',
        manager: '王经理',
        allowedCompanyHeaders: ['comp-001']
    },
    {
        id: 'dept-004',
        name: '上海分公司-市场部',
        manager: '赵经理',
        allowedCompanyHeaders: ['comp-002']
    },
    {
        id: 'dept-005',
        name: '贸易事业部',
        manager: '刘经理',
        allowedCompanyHeaders: ['comp-003']
    }
];
exports.sampleEmployees = [
    {
        id: 'emp-001',
        name: '张三',
        employeeId: 'R001',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        email: 'zhangsan@example.com'
    },
    {
        id: 'emp-002',
        name: '李四',
        employeeId: 'S001',
        departmentId: 'dept-002',
        departmentName: '销售部',
        email: 'lisi@example.com'
    },
    {
        id: 'emp-003',
        name: '王五',
        employeeId: 'F001',
        departmentId: 'dept-003',
        departmentName: '财务部',
        email: 'wangwu@example.com'
    },
    {
        id: 'emp-004',
        name: '赵六',
        employeeId: 'M001',
        departmentId: 'dept-004',
        departmentName: '上海分公司-市场部',
        email: 'zhaoliu@example.com'
    }
];
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const dateStr = `${yyyy}-${mm}-${dd}`;
exports.sampleInvoices = [
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201001',
        invoiceCode: '011002400311',
        headerName: '创新科技（北京）有限公司',
        taxId: '91110108MA00C1234X',
        amount: 500,
        taxAmount: 30,
        totalAmount: 530,
        invoiceDate: dateStr,
        sellerName: '全聚德烤鸭店',
        sellerTaxId: '91110101MA00ABC12X',
        invoiceType: 'food',
        items: [
            { name: '餐饮服务费', quantity: 1, unitPrice: 500, amount: 500 }
        ],
        submitterId: 'emp-001',
        submitterName: '张三',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201002',
        invoiceCode: '011002400311',
        headerName: '创新科技北京有限公司',
        taxId: '91110108MA00C1234X',
        amount: 2500,
        taxAmount: 75,
        totalAmount: 2575,
        invoiceDate: dateStr,
        sellerName: '中国国际航空股份有限公司',
        sellerTaxId: '91110000MA00DEF34X',
        invoiceType: 'travel',
        items: [
            { name: '北京-上海 经济舱', quantity: 1, unitPrice: 2500, amount: 2500 }
        ],
        submitterId: 'emp-001',
        submitterName: '张三',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201003',
        invoiceCode: '011002400311',
        headerName: '创新科技（北京）有限公司',
        taxId: '91110108MA00C1235X',
        amount: 8000,
        taxAmount: 1040,
        totalAmount: 9040,
        invoiceDate: dateStr,
        sellerName: '京东自营',
        sellerTaxId: '91110108MA00XYZ98X',
        invoiceType: 'purchase',
        items: [
            { name: 'MacBook Pro', quantity: 1, unitPrice: 8000, amount: 8000 }
        ],
        submitterId: 'emp-002',
        submitterName: '李四',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201001',
        invoiceCode: '011002400311',
        headerName: '创新科技（北京）有限公司',
        taxId: '91110108MA00C1234X',
        amount: 500,
        taxAmount: 30,
        totalAmount: 530,
        invoiceDate: dateStr,
        sellerName: '全聚德烤鸭店',
        sellerTaxId: '91110101MA00ABC12X',
        invoiceType: 'food',
        items: [
            { name: '餐饮服务费', quantity: 1, unitPrice: 500, amount: 500 }
        ],
        submitterId: 'emp-002',
        submitterName: '李四',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201004',
        invoiceCode: '011002400311',
        headerName: '远景贸易有限公司',
        taxId: '91110105MA00B7654X',
        amount: 1800,
        taxAmount: 108,
        totalAmount: 1908,
        invoiceDate: dateStr,
        sellerName: '上海希尔顿酒店',
        sellerTaxId: '91310115MA00HIL12X',
        invoiceType: 'travel',
        items: [
            { name: '住宿费', quantity: 2, unitPrice: 900, amount: 1800 }
        ],
        submitterId: 'emp-001',
        submitterName: '张三',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        invoiceNumber: '20241201005',
        invoiceCode: '011002400311',
        headerName: '创新科技（北京）有限公司',
        taxId: '91110108MA00C1234X',
        amount: 10000,
        taxAmount: 1300,
        totalAmount: 11300,
        invoiceDate: dateStr,
        sellerName: '联想集团供应商',
        sellerTaxId: '91110108MA00LXQ45X',
        invoiceType: 'purchase',
        items: [
            { name: '服务器设备', quantity: 1, unitPrice: 10000, amount: 10000 }
        ],
        submitterId: 'emp-001',
        submitterName: '张三',
        status: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    }
];
exports.sampleReimbursements = [
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-001',
        applicantId: 'emp-001',
        applicantName: '张三',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 530,
        invoiceIds: [],
        description: '部门聚餐餐饮费用',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-002',
        applicantId: 'emp-001',
        applicantName: '张三',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 2575,
        invoiceIds: [],
        description: '上海出差机票费用',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-003',
        applicantId: 'emp-002',
        applicantName: '李四',
        departmentId: 'dept-002',
        departmentName: '销售部',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 9040,
        invoiceIds: [],
        description: '采购办公电脑设备',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-004',
        applicantId: 'emp-001',
        applicantName: '张三',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 300,
        invoiceIds: [],
        description: '部分报销-餐饮费用拆分',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-005',
        applicantId: 'emp-001',
        applicantName: '张三',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 5000,
        invoiceIds: [],
        description: '服务器采购预付款',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    },
    {
        id: (0, uuid_1.v4)(),
        formNumber: 'BX-2024-006',
        applicantId: 'emp-001',
        applicantName: '张三',
        departmentId: 'dept-001',
        departmentName: '研发中心',
        expectedHeaderName: '创新科技（北京）有限公司',
        expectedTaxId: '91110108MA00C1234X',
        totalAmount: 5000,
        invoiceIds: [],
        description: '服务器采购尾款',
        status: 'submitted',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    }
];
function getLinkedSampleData() {
    const invs = JSON.parse(JSON.stringify(exports.sampleInvoices));
    const reims = JSON.parse(JSON.stringify(exports.sampleReimbursements));
    reims[0].invoiceIds = [invs[0].id];
    reims[1].invoiceIds = [invs[1].id];
    reims[2].invoiceIds = [invs[2].id];
    reims[3].invoiceIds = [invs[0].id];
    reims[4].invoiceIds = [invs[5].id];
    reims[5].invoiceIds = [invs[5].id];
    return { invoices: invs, reimbursements: reims };
}
