import { randomUUID } from 'crypto';
import { ResidentComplaint, AuditLog } from '../../shared/types.js';
import { dataSource } from './dataSource.js';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

function genReportNote(c: Partial<ResidentComplaint>): string {
  const parts: string[] = [];
  if (c.source) parts.push(`来源：${c.source}`);
  if (c.duplicateType === 'this_batch') parts.push('本次导入重复记录');
  if (c.duplicateType === 'historical') parts.push('与历史数据重复');
  if (c.status === 'missing_opinion') {
    parts.push('卡点：居民意见只剩汇总无原文，待社区书记复核');
  } else if (c.status === 'pending_photo') {
    parts.push('待补看路口照片');
  } else if (c.status === 'pending_review') {
    parts.push('待复核');
  } else if (c.status === 'resolved') {
    parts.push(c.reviewConclusion === 'approved' ? '复核通过，已结案' : '复核记录完成');
  }
  if (c.residentOpinion?.hasOriginal) {
    parts.push('居民意见原文完整');
  } else {
    parts.push('居民意见仅含汇总（缺原文）');
  }
  return parts.join(' | ');
}

export async function seedInitialData(forceReset = false): Promise<void> {
  const existing = await dataSource.getComplaints();
  if (existing.length > 0 && !forceReset) {
    return;
  }

  const complaints: ResidentComplaint[] = [];

  const TS001: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-001',
    originalRowNo: 1,
    importTime: hoursAgo(72),
    importBy: '阿宁',
    currentStep: 3,
    status: 'resolved',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
    reviewConclusion: 'approved',
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(48),
  };
  TS001.reportNote = genReportNote(TS001);
  complaints.push(TS001);

  const TS002: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-002',
    originalRowNo: 2,
    importTime: hoursAgo(60),
    importBy: '阿宁',
    currentStep: 2,
    status: 'pending_review',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
  };
  TS002.reportNote = genReportNote(TS002);
  complaints.push(TS002);

  const TS003: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-003',
    originalRowNo: 3,
    importTime: hoursAgo(48),
    importBy: '阿宁',
    currentStep: 2,
    status: 'missing_opinion',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
  };
  TS003.reportNote = genReportNote(TS003);
  complaints.push(TS003);

  const TS004: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-004',
    originalRowNo: 4,
    importTime: hoursAgo(36),
    importBy: '阿宁',
    currentStep: 1,
    status: 'pending_photo',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
  };
  TS004.reportNote = genReportNote(TS004);
  complaints.push(TS004);

  const TS005: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-005',
    originalRowNo: 5,
    importTime: hoursAgo(24),
    importBy: '阿宁',
    currentStep: 2,
    status: 'missing_opinion',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
  };
  TS005.reportNote = genReportNote(TS005);
  complaints.push(TS005);

  const TS006: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-006',
    originalRowNo: 6,
    importTime: hoursAgo(12),
    importBy: '阿宁',
    currentStep: 1,
    status: 'pending_photo',
    duplicateType: 'none',
    source: '居民投诉编号第一次导入',
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
  };
  TS006.reportNote = genReportNote(TS006);
  complaints.push(TS006);

  const TS002_dup_historical: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-002',
    originalRowNo: 7,
    importTime: hoursAgo(6),
    importBy: '阿宁',
    currentStep: 2,
    status: 'pending_review',
    isDuplicate: true,
    duplicateOf: TS002.id,
    duplicateType: 'historical',
    source: '居民投诉编号第一次导入',
    intersectionPhoto: {
      hasPhoto: true,
      photoUrl: '/images/intersection-002-dup.jpg',
      reviewedBy: '阿宁',
      reviewTime: hoursAgo(5),
    },
    residentOpinion: {
      hasOriginal: true,
      summary: '早市噪音扰民，凌晨5点就开始吵闹（历史重复）',
      originalText: '重复导入的同一份投诉，内容同前。',
    },
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(5),
  };
  TS002_dup_historical.reportNote = genReportNote(TS002_dup_historical);
  complaints.push(TS002_dup_historical);

  const TS005_dup_missing: ResidentComplaint = {
    id: randomUUID(),
    complaintNo: 'TS-2026-005',
    originalRowNo: 8,
    importTime: hoursAgo(3),
    importBy: '阿宁',
    currentStep: 2,
    status: 'missing_opinion',
    isDuplicate: true,
    duplicateOf: TS005.id,
    duplicateType: 'historical',
    source: '居民投诉编号第一次导入',
    intersectionPhoto: {
      hasPhoto: true,
      photoUrl: '/images/intersection-005-dup.jpg',
      reviewedBy: '阿宁',
      reviewTime: hoursAgo(2),
    },
    residentOpinion: {
      hasOriginal: false,
      summary: '污水横流，路面打滑容易摔跤（历史重复·缺原文）',
    },
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(2),
  };
  TS005_dup_missing.reportNote = genReportNote(TS005_dup_missing);
  complaints.push(TS005_dup_missing);

  const auditLogs: AuditLog[] = [];
  complaints.forEach(c => {
    const action = c.duplicateType === 'this_batch' ? '批次内重复导入'
      : c.duplicateType === 'historical' ? '历史重复导入'
      : '数据导入';
    auditLogs.push({
      id: randomUUID(),
      complaintId: c.id,
      action,
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
  await dataSource.saveExportSnapshot([] as any);
}
