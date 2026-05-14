import type { Customer, Project, InvoiceApplication } from '../types';
import { createOperationLog } from '../utils';

export const sampleCustomers: Customer[] = [
  {
    id: 'cust001',
    name: '北京科技创新有限公司',
    taxId: '91110108MA01234567',
    address: '北京市海淀区中关村大街1号',
    phone: '010-12345678',
    bankName: '中国建设银行北京中关村支行',
    bankAccount: '11001088500055551234',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 'cust002',
    name: '上海国际贸易集团',
    taxId: '91310000MA56789012',
    address: '上海市浦东新区陆家嘴金融中心88号',
    phone: '021-87654321',
    bankName: '招商银行上海陆家嘴支行',
    bankAccount: '31006677889900112233',
    createdAt: '2024-02-20T14:30:00Z',
    updatedAt: '2024-03-10T09:15:00Z'
  },
  {
    id: 'cust003',
    name: '广州电子科技有限公司',
    taxId: '91440106MA34567890',
    address: '广州市天河区珠江新城华夏路66号',
    phone: '020-66778899',
    bankName: '工商银行广州天河支行',
    bankAccount: '36020011223344556677',
    createdAt: '2024-03-05T11:20:00Z',
    updatedAt: '2024-03-05T11:20:00Z'
  },
  {
    id: 'cust004',
    name: '深圳智能制造股份有限公司',
    taxId: '91440300MA12345678',
    address: '深圳市南山区科技园南区深南大道9999号',
    phone: '0755-99887766',
    bankName: '中国银行深圳南山支行',
    bankAccount: '77001122334455667788',
    createdAt: '2024-04-12T16:45:00Z',
    updatedAt: '2024-04-12T16:45:00Z'
  }
];

export const sampleProjects: Project[] = [
  {
    id: 'proj001',
    name: '企业管理系统开发项目',
    code: 'PROJ-2024-001',
    description: '为客户开发定制化企业管理信息系统',
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
    id: 'proj002',
    name: '电商平台升级项目',
    code: 'PROJ-2024-002',
    description: '现有电商平台功能升级和性能优化',
    createdAt: '2024-02-15T10:30:00Z'
  },
  {
    id: 'proj003',
    name: '数据分析平台建设',
    code: 'PROJ-2024-003',
    description: '大数据分析和可视化平台建设',
    createdAt: '2024-03-20T14:00:00Z'
  },
  {
    id: 'proj004',
    name: '移动端APP开发',
    code: 'PROJ-2024-004',
    description: 'iOS和Android双平台移动应用开发',
    createdAt: '2024-04-08T11:15:00Z'
  },
  {
    id: 'proj005',
    name: '云服务迁移项目',
    code: 'PROJ-2024-005',
    description: '本地系统迁移至公有云平台',
    createdAt: '2024-05-01T08:30:00Z'
  }
];

export const sampleInvoices: InvoiceApplication[] = [
  {
    id: 'inv001',
    customerId: 'cust001',
    customerName: '北京科技创新有限公司',
    taxId: '91110108MA01234567',
    address: '北京市海淀区中关村大街1号',
    phone: '010-12345678',
    bankName: '中国建设银行北京中关村支行',
    bankAccount: '11001088500055551234',
    projectId: 'proj001',
    projectName: '企业管理系统开发项目',
    projectCode: 'PROJ-2024-001',
    amount: 285000.00,
    invoiceType: 'special',
    status: 'pending',
    applicant: '张三',
    applyTime: '2024-05-10T09:30:00Z',
    isRedFlush: false,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv001', '张三', '提交申请', '首次提交开票申请')
    ]
  },
  {
    id: 'inv002',
    customerId: 'cust002',
    customerName: '上海国际贸易集团',
    taxId: '91310000MA56789012',
    address: '上海市浦东新区陆家嘴金融中心88号',
    phone: '021-87654321',
    bankName: '招商银行上海陆家嘴支行',
    bankAccount: '31006677889900112233',
    projectId: 'proj002',
    projectName: '电商平台升级项目',
    projectCode: 'PROJ-2024-002',
    amount: 156000.00,
    invoiceType: 'special',
    status: 'approved',
    applicant: '李四',
    applyTime: '2024-05-08T14:20:00Z',
    reviewer: '财务王经理',
    reviewTime: '2024-05-09T10:15:00Z',
    isRedFlush: false,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv002', '李四', '提交申请', '项目结项申请开票'),
      createOperationLog('inv002', '财务王经理', '审核通过', '信息核实无误，同意开票')
    ]
  },
  {
    id: 'inv003',
    customerId: 'cust003',
    customerName: '广州电子科技有限公司',
    taxId: '91440106MA34567890',
    address: '广州市天河区珠江新城华夏路66号',
    phone: '020-66778899',
    bankName: '工商银行广州天河支行',
    bankAccount: '36020011223344556677',
    projectId: 'proj003',
    projectName: '数据分析平台建设',
    projectCode: 'PROJ-2024-003',
    amount: 420000.00,
    invoiceType: 'special',
    status: 'invoiced',
    applicant: '王五',
    applyTime: '2024-05-05T10:00:00Z',
    reviewer: '财务王经理',
    reviewTime: '2024-05-06T09:30:00Z',
    invoiceNumber: 'ZZS-2024-001234',
    invoiceTime: '2024-05-06T14:00:00Z',
    isRedFlush: false,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv003', '王五', '提交申请', '项目验收完成申请开票'),
      createOperationLog('inv003', '财务王经理', '审核通过', '资料齐全，同意开票'),
      createOperationLog('inv003', '财务李专员', '已开票', '发票号：ZZS-2024-001234')
    ]
  },
  {
    id: 'inv004',
    customerId: 'cust004',
    customerName: '深圳智能制造股份有限公司',
    taxId: '91440300MA12345678',
    address: '深圳市南山区科技园南区深南大道9999号',
    phone: '0755-99887766',
    bankName: '中国银行深圳南山支行',
    bankAccount: '77001122334455667788',
    projectId: 'proj004',
    projectName: '移动端APP开发',
    projectCode: 'PROJ-2024-004',
    amount: 198000.00,
    invoiceType: 'normal',
    status: 'rejected',
    applicant: '赵六',
    applyTime: '2024-05-11T16:40:00Z',
    reviewer: '财务王经理',
    reviewTime: '2024-05-12T08:50:00Z',
    isRedFlush: false,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv004', '赵六', '提交申请', 'APP开发完成申请开票'),
      createOperationLog('inv004', '财务王经理', '驳回申请', '银行账号信息有误，请核实后重新提交')
    ]
  },
  {
    id: 'inv005',
    customerId: 'cust001',
    customerName: '北京科技创新有限公司',
    taxId: '91110108MA01234567',
    address: '北京市海淀区中关村大街1号',
    phone: '010-12345678',
    bankName: '中国建设银行北京中关村支行',
    bankAccount: '11001088500055551234',
    projectId: 'proj005',
    projectName: '云服务迁移项目',
    projectCode: 'PROJ-2024-005',
    amount: 320000.00,
    invoiceType: 'special',
    status: 'red_flush',
    applicant: '张三',
    applyTime: '2024-04-20T11:00:00Z',
    reviewer: '财务王经理',
    reviewTime: '2024-04-21T09:30:00Z',
    invoiceNumber: 'ZZS-2024-000987',
    invoiceTime: '2024-04-21T15:00:00Z',
    redFlushTime: '2024-05-08T10:30:00Z',
    isRedFlush: true,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv005', '张三', '提交申请', '云迁移项目申请开票'),
      createOperationLog('inv005', '财务王经理', '审核通过', '同意开票'),
      createOperationLog('inv005', '财务李专员', '已开票', '发票号：ZZS-2024-000987'),
      createOperationLog('inv005', '财务王经理', '红冲发票', '客户名称变更，需红冲重开')
    ]
  },
  {
    id: 'inv006',
    customerId: 'cust002',
    customerName: '上海国际贸易集团',
    taxId: 'INVALID-TAX-ID',
    address: '上海市浦东新区陆家嘴金融中心88号',
    phone: '021-87654321',
    bankName: '招商银行上海陆家嘴支行',
    bankAccount: '31006677889900112233',
    projectId: 'proj001',
    projectName: '企业管理系统开发项目',
    projectCode: 'PROJ-2024-001',
    amount: 85000.00,
    invoiceType: 'normal',
    status: 'blocked',
    blockReason: 'tax_id_invalid',
    blockMessage: '税号格式异常，请检查税号是否正确（15-20位字母数字）',
    applicant: '李四',
    applyTime: '2024-05-12T13:20:00Z',
    isRedFlush: false,
    isReopened: false,
    operationLogs: [
      createOperationLog('inv006', '李四', '提交申请', '补充服务申请开票'),
      createOperationLog('inv006', '系统', '拦截', '税号格式验证不通过')
    ]
  }
];
