import { randomUUID } from 'crypto';
import { ResidentComplaint, AuditLog } from '../../shared/types.js';
import { dataSource } from './dataSource.js';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

export async function seedInitialData(): Promise<void> {
  const existing = await dataSource.getComplaints();
  if (existing.length > 0) {
    return;
  }

  const complaints: ResidentComplaint[] = [
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-001',
      originalRowNo: 1,
      importTime: hoursAgo(72),
      importBy: '阿宁',
      currentStep: 3,
      status: 'resolved',
      intersectionPhoto: {
        hasPhoto: true,
        photoUrl: '/images/intersection-001.jpg',
        reviewedBy: '阿宁',
        reviewTime: hoursAgo(60),
      },
      residentOpinion: {
        hasOriginal: true,
        summary: '菜市场门口摊位外溢，影响通行',
        originalText: '我们小区门口的菜市场每天早上都有摊位摆到人行道上，老人小孩走路都不方便，还有电动车乱停乱放，希望能管一管。',
      },
      reviewBy: '王书记',
      reviewTime: hoursAgo(48),
      reviewComment: '已安排城管分队整治，情况已改善。',
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(48),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-002',
      originalRowNo: 2,
      importTime: hoursAgo(60),
      importBy: '阿宁',
      currentStep: 2,
      status: 'pending_review',
      intersectionPhoto: {
        hasPhoto: true,
        photoUrl: '/images/intersection-002.jpg',
        reviewedBy: '阿宁',
        reviewTime: hoursAgo(50),
      },
      residentOpinion: {
        hasOriginal: true,
        summary: '早市噪音扰民，凌晨5点就开始吵闹',
        originalText: '菜市场每天凌晨5点就开始卸货、吆喝，家里有老人孩子根本没法休息，夏天开窗更吵，希望能调整开市时间。',
      },
      createdAt: hoursAgo(60),
      updatedAt: hoursAgo(50),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-003',
      originalRowNo: 3,
      importTime: hoursAgo(48),
      importBy: '阿宁',
      currentStep: 2,
      status: 'missing_opinion',
      intersectionPhoto: {
        hasPhoto: true,
        photoUrl: '/images/intersection-003.jpg',
        reviewedBy: '阿宁',
        reviewTime: hoursAgo(40),
      },
      residentOpinion: {
        hasOriginal: false,
        summary: '垃圾清运不及时，夏天味道大',
      },
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(40),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-004',
      originalRowNo: 4,
      importTime: hoursAgo(36),
      importBy: '阿宁',
      currentStep: 1,
      status: 'pending_photo',
      intersectionPhoto: {
        hasPhoto: false,
      },
      residentOpinion: {
        hasOriginal: true,
        summary: '消防通道被摊位占用，有安全隐患',
        originalText: '菜市场西边的消防通道常年被卖菜的摊位堵着，万一着火消防车都进不来，这可是人命关天的大事！',
      },
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(36),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-005',
      originalRowNo: 5,
      importTime: hoursAgo(24),
      importBy: '阿宁',
      currentStep: 2,
      status: 'missing_opinion',
      intersectionPhoto: {
        hasPhoto: true,
        photoUrl: '/images/intersection-005.jpg',
        reviewedBy: '阿宁',
        reviewTime: hoursAgo(18),
      },
      residentOpinion: {
        hasOriginal: false,
        summary: '污水横流，路面打滑容易摔跤',
      },
      createdAt: hoursAgo(24),
      updatedAt: hoursAgo(18),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-006',
      originalRowNo: 6,
      importTime: hoursAgo(12),
      importBy: '阿宁',
      currentStep: 1,
      status: 'pending_photo',
      intersectionPhoto: {
        hasPhoto: false,
      },
      residentOpinion: {
        hasOriginal: true,
        summary: '流动摊贩太多，影响周边商户生意',
        originalText: '我们是菜市场周边的正规商户，现在外面流动摊贩越来越多，都不用交租金管理费，我们这些正规经营的反而没生意了，希望能管管。',
      },
      createdAt: hoursAgo(12),
      updatedAt: hoursAgo(12),
    },
    {
      id: randomUUID(),
      complaintNo: 'TS-2026-002',
      originalRowNo: 7,
      importTime: hoursAgo(6),
      importBy: '阿宁',
      currentStep: 1,
      status: 'pending_photo',
      isDuplicate: true,
      duplicateOf: '',
      intersectionPhoto: {
        hasPhoto: false,
      },
      residentOpinion: {
        hasOriginal: true,
        summary: '早市噪音扰民，凌晨5点就开始吵闹（重复导入）',
        originalText: '重复导入的同一份投诉，内容同前。',
      },
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    },
  ];

  const dupIndex = complaints.findIndex(c => c.complaintNo === 'TS-2026-002' && c.isDuplicate);
  const originalIndex = complaints.findIndex(c => c.complaintNo === 'TS-2026-002' && !c.isDuplicate);
  if (dupIndex >= 0 && originalIndex >= 0) {
    complaints[dupIndex].duplicateOf = complaints[originalIndex].id;
  }

  const auditLogs: AuditLog[] = [];
  complaints.forEach(c => {
    auditLogs.push({
      id: randomUUID(),
      complaintId: c.id,
      action: '数据导入',
      operator: c.importBy,
      operatorRole: 'manager',
      beforeChange: null,
      afterChange: JSON.parse(JSON.stringify(c)),
      timestamp: c.createdAt,
    });
  });

  await dataSource.saveComplaints(complaints);
  await dataSource.saveAuditLogs(auditLogs);
  await dataSource.saveSelfCheckResults([]);
  await dataSource.saveOperationRecords([]);
}
