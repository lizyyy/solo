import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalLog,
  ApprovalTicket,
  ApprovalStatus,
  LogSource,
  LogEventType
} from './types';

export function generateSampleLogs(): ApprovalLog[] {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  return [
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.WORKFLOW_SYSTEM,
      eventType: LogEventType.SUBMIT,
      timestamp: eightHoursAgo,
      operatorId: 'EMP-001',
      operatorName: '张三',
      operatorRole: '研发工程师',
      metadata: { department: '技术部', ip: '192.168.1.100' },
      rawContent: '用户张三提交了生产数据库临时权限申请，有效期7天，访问范围为订单表和用户表'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.ASSIGN,
      timestamp: new Date(eightHoursAgo.getTime() + 5 * 60 * 1000),
      operatorId: 'SYSTEM-001',
      operatorName: '工作流系统',
      operatorRole: '系统',
      targetApproverId: 'EMP-002',
      targetApproverName: '李四',
      metadata: { approvalLevel: 1 },
      rawContent: '系统自动分配给部门经理李四审批'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.EMAIL_SYSTEM,
      eventType: LogEventType.REMIND,
      timestamp: new Date(eightHoursAgo.getTime() + 30 * 60 * 1000),
      operatorId: 'SYSTEM-002',
      operatorName: '邮件系统',
      operatorRole: '系统',
      targetApproverId: 'EMP-002',
      targetApproverName: '李四',
      metadata: { emailId: 'MAIL-12345' },
      rawContent: '发送待审批提醒邮件给李四'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.APPROVE,
      timestamp: sixHoursAgo,
      operatorId: 'EMP-002',
      operatorName: '李四',
      operatorRole: '技术部经理',
      approvalComment: '该申请为项目紧急需求，同意开通临时权限，请安全部门后续审计',
      metadata: { approvalTime: '2分30秒' },
      rawContent: '李四审批通过，填写了审批意见'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.ASSIGN,
      timestamp: new Date(sixHoursAgo.getTime() + 1 * 60 * 1000),
      operatorId: 'SYSTEM-001',
      operatorName: '工作流系统',
      operatorRole: '系统',
      targetApproverId: 'EMP-003',
      targetApproverName: '王五',
      metadata: { approvalLevel: 2 },
      rawContent: '流转到安全管理员王五进行二级审批'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-001',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.APPROVE,
      timestamp: fourHoursAgo,
      operatorId: 'EMP-003',
      operatorName: '王五',
      operatorRole: '安全管理员',
      metadata: { approvalTime: '1分15秒' },
      rawContent: '王五点击审批通过，但未填写审批意见'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-002',
      source: LogSource.WORKFLOW_SYSTEM,
      eventType: LogEventType.SUBMIT,
      timestamp: new Date(now.getTime() - 30 * 60 * 1000),
      operatorId: 'EMP-004',
      operatorName: '赵六',
      operatorRole: '运维工程师',
      metadata: { department: '运维部', ip: '192.168.1.101' },
      rawContent: '赵六提交了服务器登录临时权限申请'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-002',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.ASSIGN,
      timestamp: new Date(now.getTime() - 25 * 60 * 1000),
      operatorId: 'SYSTEM-001',
      operatorName: '工作流系统',
      operatorRole: '系统',
      targetApproverId: 'EMP-005',
      targetApproverName: '孙七',
      metadata: { approvalLevel: 1 },
      rawContent: '分配给运维主管孙七审批'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-002',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.APPROVE,
      timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      operatorId: 'EMP-005',
      operatorName: '孙七',
      operatorRole: '运维主管',
      approvalComment: '同意，该服务器用于生产环境监控',
      metadata: { approvalTime: '45秒' },
      rawContent: '孙七审批通过'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-003',
      source: LogSource.WORKFLOW_SYSTEM,
      eventType: LogEventType.SUBMIT,
      timestamp: new Date('2024-01-10T09:00:00'),
      operatorId: 'EMP-006',
      operatorName: '周八',
      operatorRole: '数据分析师',
      metadata: { department: '数据部' },
      rawContent: '周八提交了数据报表访问权限申请'
    },
    {
      id: uuidv4(),
      batchId: 'BATCH-2024-003',
      source: LogSource.APPROVAL_PORTAL,
      eventType: LogEventType.APPROVE,
      timestamp: new Date('2024-01-10T10:30:00'),
      operatorId: 'EMP-007',
      operatorName: '吴九',
      operatorRole: '数据部经理',
      metadata: {} as any,
      rawContent: '吴九审批通过，未填写意见（旧系统不强制要求）'
    }
  ];
}

export function generateSampleTickets(): ApprovalTicket[] {
  return [
    {
      ticketId: 'TICKET-2024-001',
      batchId: 'BATCH-2024-001',
      requestId: 'REQ-2024-1001',
      requestType: '临时权限',
      requesterId: 'EMP-001',
      requesterName: '张三',
      requesterDepartment: '技术部',
      requestTitle: '生产数据库查询权限申请',
      requestDescription: '因项目紧急排查线上问题，需要申请生产数据库订单表和用户表的只读查询权限，有效期7天',
      requestedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      expectedCompletionAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
      currentStatus: ApprovalStatus.IN_PROGRESS,
      currentApprover: '王五',
      approvalChain: ['李四', '王五', '郑十'],
      completedApprovals: ['李四', '王五'],
      attachedDocuments: ['权限申请说明书.pdf', '项目审批单.docx'],
      escalationLevel: 2,
      relatedTicketIds: ['CS-2024-0567', 'AUDIT-2024-089']
    },
    {
      ticketId: 'TICKET-2024-002',
      batchId: 'BATCH-2024-002',
      requestId: 'REQ-2024-1002',
      requestType: '临时权限',
      requesterId: 'EMP-004',
      requesterName: '赵六',
      requesterDepartment: '运维部',
      requestTitle: '生产服务器SSH登录权限',
      requestDescription: '需要登录生产服务器进行日志收集和性能调优，权限有效期24小时',
      requestedAt: new Date(Date.now() - 30 * 60 * 1000),
      currentStatus: ApprovalStatus.IN_PROGRESS,
      currentApprover: '孙七',
      approvalChain: ['孙七', '郑十'],
      completedApprovals: ['孙七'],
      attachedDocuments: ['运维操作方案.pdf'],
      escalationLevel: 1,
      relatedTicketIds: ['CS-2024-0568']
    },
    {
      ticketId: 'TICKET-2024-003',
      batchId: 'BATCH-2024-003',
      requestId: 'REQ-2024-0999',
      requestType: '数据访问',
      requesterId: 'EMP-006',
      requesterName: '周八',
      requesterDepartment: '数据部',
      requestTitle: 'BI报表数据访问权限',
      requestDescription: '日常数据分析工作需要访问BI报表系统的销售数据',
      requestedAt: new Date('2024-01-10T09:00:00'),
      currentStatus: ApprovalStatus.APPROVED,
      approvalChain: ['吴九'],
      completedApprovals: ['吴九'],
      attachedDocuments: [],
      escalationLevel: 0,
      relatedTicketIds: []
    }
  ];
}

export function generateSampleTicketForDuplicate(): ApprovalTicket {
  return {
    ticketId: 'TICKET-2024-001',
    batchId: 'BATCH-2024-001-RESUBMIT',
    requestId: 'REQ-2024-1001',
    requestType: '临时权限',
    requesterId: 'EMP-001',
    requesterName: '张三',
    requesterDepartment: '技术部',
    requestTitle: '生产数据库查询权限申请（重新提交）',
    requestDescription: '因项目紧急排查线上问题，需要申请生产数据库订单表和用户表的只读查询权限，有效期7天',
    requestedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    currentStatus: ApprovalStatus.IN_PROGRESS,
    currentApprover: '王五',
    approvalChain: ['李四', '王五', '郑十'],
    completedApprovals: ['李四', '王五'],
    attachedDocuments: ['权限申请说明书.pdf', '项目审批单.docx'],
    escalationLevel: 2,
    relatedTicketIds: ['CS-2024-0567', 'AUDIT-2024-089']
  };
}
