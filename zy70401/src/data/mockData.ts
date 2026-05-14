import { v4 as uuidv4 } from 'uuid';
import { WorkOrder, Attachment, AuditLog, IndexSuggestion } from '../types';

const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const expiredDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

export const mockWorkOrders: WorkOrder[] = [
  {
    id: uuidv4(),
    orderNo: 'WO-2024-001',
    title: '客服系统升级 - 用户模块优化',
    content: '升级用户认证模块，支持多因素认证',
    sourceSystem: 'customer_service',
    status: 'completed',
    createdBy: 'admin',
    createdAt: yesterday,
    updatedAt: now,
    attachments: [
      {
        id: uuidv4(),
        workOrderId: '',
        fileName: 'upgrade-plan.pdf',
        fileType: 'application/pdf',
        fileSize: 1024000,
        uploadedBy: 'admin',
        uploadedAt: yesterday,
        expireAt: null,
        status: 'valid'
      }
    ]
  },
  {
    id: uuidv4(),
    orderNo: 'WO-2024-002',
    title: '客服系统升级 - 工单流程改造',
    content: '优化工单分配和流转机制',
    sourceSystem: 'customer_service',
    status: 'processing',
    createdBy: 'operator1',
    createdAt: yesterday,
    updatedAt: now,
    attachments: [
      {
        id: uuidv4(),
        workOrderId: '',
        fileName: 'flow-design.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 512000,
        uploadedBy: 'operator1',
        uploadedAt: lastMonth,
        expireAt: expiredDate,
        status: 'expired'
      }
    ]
  },
  {
    id: uuidv4(),
    orderNo: 'WO-2024-003',
    title: '云资源申请单 - 数据库扩容',
    content: '申请RDS实例扩容，从4核8G升级到8核16G',
    sourceSystem: 'cloud_resource',
    status: 'pending',
    createdBy: 'devops',
    createdAt: yesterday,
    updatedAt: now,
    attachments: []
  },
  {
    id: uuidv4(),
    orderNo: 'WO-2024-004',
    title: '客服系统升级 - 报表功能增强',
    content: '新增多维度数据分析报表',
    sourceSystem: 'customer_service',
    status: 'failed',
    createdBy: 'analyst',
    createdAt: lastMonth,
    updatedAt: lastMonth,
    attachments: [
      {
        id: uuidv4(),
        workOrderId: '',
        fileName: 'report-spec.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 2048000,
        uploadedBy: 'analyst',
        uploadedAt: lastMonth,
        expireAt: expiredDate,
        status: 'expired'
      }
    ]
  }
];

mockWorkOrders.forEach(wo => {
  wo.attachments.forEach(att => {
    att.workOrderId = wo.id;
  });
});

export const mockAuditLogs: AuditLog[] = [
  {
    id: uuidv4(),
    workOrderId: mockWorkOrders[2].id,
    sourceSystem: 'cloud_resource',
    action: 'update',
    operator: 'devops-manager',
    reason: '根据业务增长预估，需要额外的存储容量',
    beforeData: { content: '申请RDS实例扩容，从4核8G升级到8核16G' },
    afterData: { content: '申请RDS实例扩容，从4核8G升级到8核16G，存储从500G升级到1T' },
    createdAt: now
  }
];

export const mockIndexSuggestions: IndexSuggestion[] = [
  {
    id: uuidv4(),
    tableName: 'work_orders',
    columnName: 'source_system, status',
    indexType: 'BTREE',
    suggestionType: 'create',
    reason: '按来源系统和状态查询频率高，当前无联合索引',
    estimatedBenefit: 75,
    confidence: 'high',
    createdAt: now
  },
  {
    id: uuidv4(),
    tableName: 'attachments',
    columnName: 'expire_at',
    indexType: 'BTREE',
    suggestionType: 'create',
    reason: '过期附件清理任务频繁查询此字段',
    estimatedBenefit: 60,
    confidence: 'high',
    createdAt: now
  }
];
