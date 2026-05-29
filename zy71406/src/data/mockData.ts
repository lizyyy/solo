import { fakerZH_CN as faker } from '@faker-js/faker';
import type {
  BondPosition,
  RedemptionAnnouncement,
  ExerciseApplication,
  ConflictRecord,
  StatusChangeLog,
  RedemptionListItem,
  OperationLog,
  ExportRecord,
  ApplicationStatus,
  AnnouncementVersion,
  FilterConditions,
} from '@/types';
import { generateId } from '@/utils/format';
import { detectConflicts, createConflictRecords } from '@/utils/validation';

const BOND_NAMES = [
  { code: '019547', name: '24国债05' },
  { code: '019652', name: '24国债10' },
  { code: '110087', name: '国投转债' },
  { code: '113050', name: '浦发转债' },
  { code: '127003', name: '海印转债' },
  { code: '128010', name: '顺昌转债' },
  { code: '113548', name: '石英转债' },
  { code: '128136', name: '立讯转债' },
  { code: '110088', name: '广汽转债' },
  { code: '127016', name: '鲁泰转债' },
  { code: '128052', name: '凯龙转债' },
  { code: '113505', name: '鼎胜转债' },
  { code: '128098', name: '康泰转债' },
  { code: '113596', name: '顾家转债' },
  { code: '128114', name: '正邦转债' },
  { code: '018003', name: '21国债03' },
  { code: '018018', name: '21国债18' },
  { code: '019413', name: '23国债13' },
  { code: '019643', name: '24国债01' },
  { code: '019712', name: '24贴现国债05' },
];

const CUSTOMERS = [
  { id: 'C001', name: '中国人寿保险股份有限公司' },
  { id: 'C002', name: '中国太平洋人寿保险股份有限公司' },
  { id: 'C003', name: '新华人寿保险股份有限公司' },
  { id: 'C004', name: '泰康人寿保险有限责任公司' },
  { id: 'C005', name: '中国人民人寿保险股份有限公司' },
  { id: 'C006', name: '阳光人寿保险股份有限公司' },
  { id: 'C007', name: '中国人民财产保险股份有限公司' },
  { id: 'C008', name: '中国平安财产保险股份有限公司' },
  { id: 'C009', name: '工银安盛人寿保险有限公司' },
  { id: 'C010', name: '中信保诚人寿保险有限公司' },
  { id: 'C011', name: '招商基金管理有限公司' },
  { id: 'C012', name: '易方达基金管理有限公司' },
  { id: 'C013', name: '华夏基金管理有限公司' },
  { id: 'C014', name: '嘉实基金管理有限公司' },
  { id: 'C015', name: '南方基金管理股份有限公司' },
];

const OPERATORS = ['张运营', '李经理', '王主管', '赵专员', '刘运营', '陈经理'];

const generateBondPosition = (bond: { code: string; name: string }): BondPosition => {
  const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  const baseQuantity = Math.floor(Math.random() * 500000 + 10000);
  return {
    bondCode: bond.code,
    bondName: bond.name,
    customerId: customer.id,
    customerName: customer.name,
    positionQuantity: Math.floor(baseQuantity / 100) * 100,
    positionDate: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
    positionSource: ['集中交易系统', '场外交易', '转托管'].sort(() => Math.random() - 0.5)[0],
  };
};

const generateAnnouncementVersions = (bondCode: string): AnnouncementVersion[] => {
  const versionCount = Math.random() > 0.3 ? 1 : Math.floor(Math.random() * 2) + 1;
  const versions: AnnouncementVersion[] = [];
  const baseDate = faker.date.recent({ days: 60 });

  for (let i = 0; i < versionCount; i++) {
    const versionNo = `V${i + 1}.0`;
    const contentDiff: Record<string, { old: unknown; new: unknown }> = {};

    if (i > 0) {
      const fields = ['exerciseDate', 'exercisePrice'];
      const field = fields[Math.floor(Math.random() * fields.length)];
      if (field === 'exerciseDate') {
        contentDiff[field] = {
          old: faker.date.recent({ days: 30, refDate: baseDate }).toISOString().split('T')[0],
          new: faker.date.soon({ days: 30, refDate: baseDate }).toISOString().split('T')[0],
        };
      } else {
        contentDiff[field] = {
          old: Number((Math.random() * 5 + 95).toFixed(2)),
          new: Number((Math.random() * 5 + 95).toFixed(2)),
        };
      }
    }

    versions.push({
      versionId: generateId('ver_'),
      versionNo,
      publishDate: faker.date.soon({ days: Math.max(1, i * 7), refDate: baseDate }).toISOString().split('T')[0],
      contentDiff,
      operator: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
    });
  }

  return versions.sort((a, b) => a.publishDate.localeCompare(b.publishDate));
};

const generateRedemptionAnnouncement = (bond: { code: string; name: string }): RedemptionAnnouncement => {
  const versions = generateAnnouncementVersions(bond.code);
  const latestVersion = versions[versions.length - 1];
  const exerciseDate = faker.date.soon({ days: 90 }).toISOString().split('T')[0];

  return {
    announcementId: generateId('ann_'),
    bondCode: bond.code,
    bondName: bond.name,
    exerciseDate,
    exercisePrice: Number((Math.random() * 5 + 95).toFixed(2)),
    announcementDate: latestVersion.publishDate,
    versionNo: latestVersion.versionNo,
    versions,
  };
};

const generateExerciseApplication = (
  bond: { code: string; name: string },
  position: BondPosition,
  announcement: RedemptionAnnouncement
): ExerciseApplication => {
  const statuses: ApplicationStatus[] = ['pending', 'confirmed', 'exercised', 'withdrawn'];
  const weights = [0.3, 0.4, 0.2, 0.1];
  let random = Math.random();
  let statusIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      statusIndex = i;
      break;
    }
    random -= weights[i];
  }
  const status = statuses[statusIndex];
  const isWithdrawn = status === 'withdrawn';

  const baseApplyQuantity = Math.min(
    position.positionQuantity,
    Math.floor(Math.random() * (position.positionQuantity * 1.2 - 1000) + 1000)
  );
  const applyQuantity = Math.floor(baseApplyQuantity / 100) * 100;

  const dateOffset = Math.random() > 0.7 ? Math.floor(Math.random() * 14 - 7) : 0;
  const applyExerciseDate = new Date(announcement.exerciseDate);
  applyExerciseDate.setDate(applyExerciseDate.getDate() + dateOffset);

  const createTime = faker.date.recent({ days: 60 });
  const updateTime = faker.date.recent({ days: 7, refDate: createTime });

  return {
    applicationId: generateId('app_'),
    bondCode: bond.code,
    customerId: position.customerId,
    customerName: position.customerName,
    applyQuantity,
    applyExerciseDate: applyExerciseDate.toISOString().split('T')[0],
    applicationStatus: status,
    isWithdrawn,
    withdrawDate: isWithdrawn ? faker.date.recent({ days: 7, refDate: updateTime }).toISOString().split('T')[0] : undefined,
    createTime: createTime.toISOString(),
    updateTime: updateTime.toISOString(),
  };
};

const generateStatusChangeLogs = (application: ExerciseApplication): StatusChangeLog[] => {
  const logs: StatusChangeLog[] = [];
  const statusSequence: ApplicationStatus[] = ['pending'];

  if (application.applicationStatus === 'confirmed' || application.applicationStatus === 'exercised' || application.applicationStatus === 'withdrawn') {
    statusSequence.push('confirmed');
  }
  if (application.applicationStatus === 'exercised') {
    statusSequence.push('exercised');
  }
  if (application.applicationStatus === 'withdrawn') {
    statusSequence.push('withdrawn');
  }

  let currentTime = new Date(application.createTime);

  for (let i = 0; i < statusSequence.length; i++) {
    logs.push({
      logId: generateId('log_'),
      applicationId: application.applicationId,
      fromStatus: i === 0 ? null : statusSequence[i - 1],
      toStatus: statusSequence[i],
      changeTime: currentTime.toISOString(),
      operator: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
      remark: i === 0 ? '提交行权申请' : undefined,
    });
    currentTime = new Date(currentTime.getTime() + Math.random() * 86400000 * 3);
  }

  return logs;
};

const generateOperationLogs = (count: number): OperationLog[] => {
  const types: OperationLog['operationType'][] = ['filter', 'export', 'status_change', 'manual_judgment', 'announcement_update'];
  const descriptions: Record<string, string[]> = {
    filter: ['筛选行权名单', '设置筛选条件', '清除筛选条件'],
    export: ['导出行权名单', '导出异常报告', '批量导出数据'],
    status_change: ['更新申请状态', '标记为已确认', '标记为已行权', '撤回行权申请'],
    manual_judgment: ['人工判断异常', '确认异常处理', '复核异常记录'],
    announcement_update: ['更新回售公告', '导入公告版本', '对比公告版本'],
  };

  return Array.from({ length: count }, () => {
    const type = types[Math.floor(Math.random() * types.length)];
    const descList = descriptions[type];
    return {
      logId: generateId('op_'),
      operationType: type,
      operator: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
      operationTime: faker.date.recent({ days: 30 }).toISOString(),
      description: descList[Math.floor(Math.random() * descList.length)],
      detail: Math.random() > 0.5 ? { bondCount: Math.floor(Math.random() * 100) } : undefined,
    };
  }).sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());
};

const generateExportRecords = (count: number): ExportRecord[] => {
  return Array.from({ length: count }, (_, i) => {
    const filterConditions: FilterConditions = {
      bondCode: Math.random() > 0.5 ? BOND_NAMES[Math.floor(Math.random() * BOND_NAMES.length)].code : undefined,
      applicationStatus: Math.random() > 0.5 ? ['pending', 'confirmed'] as ApplicationStatus[] : undefined,
    };
    return {
      recordId: generateId('exp_'),
      exportTime: faker.date.recent({ days: 30 }).toISOString(),
      operator: OPERATORS[Math.floor(Math.random() * OPERATORS.length)],
      filterConditions,
      recordCount: Math.floor(Math.random() * 50) + 10,
      fileName: `债券回售行权名单_${faker.date.recent({ days: 30 }).toISOString().split('T')[0]}_${i + 1}.xlsx`,
    };
  }).sort((a, b) => new Date(b.exportTime).getTime() - new Date(a.exportTime).getTime());
};

export interface MockDataset {
  positions: BondPosition[];
  announcements: RedemptionAnnouncement[];
  applications: ExerciseApplication[];
  conflictRecords: ConflictRecord[];
  statusChangeLogs: StatusChangeLog[];
  listItems: RedemptionListItem[];
  operationLogs: OperationLog[];
  exportRecords: ExportRecord[];
}

export const generateMockData = (): MockDataset => {
  const positions: BondPosition[] = [];
  const announcements: RedemptionAnnouncement[] = [];
  const applications: ExerciseApplication[] = [];
  const conflictRecords: ConflictRecord[] = [];
  const statusChangeLogs: StatusChangeLog[] = [];
  const listItems: RedemptionListItem[] = [];

  const selectedBonds = BOND_NAMES.slice(0, 15);

  selectedBonds.forEach((bond) => {
    const customerCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < customerCount; i++) {
      const position = generateBondPosition(bond);
      positions.push(position);

      const announcement = generateRedemptionAnnouncement(bond);
      announcements.push(announcement);

      const application = generateExerciseApplication(bond, position, announcement);
      applications.push(application);

      const conflicts = detectConflicts(position, announcement, application);
      const records = createConflictRecords(
        application.applicationId,
        conflicts,
        position,
        announcement,
        application
      );
      conflictRecords.push(...records);

      const logs = generateStatusChangeLogs(application);
      statusChangeLogs.push(...logs);

      listItems.push({
        applicationId: application.applicationId,
        bondCode: bond.code,
        bondName: bond.name,
        customerId: position.customerId,
        customerName: position.customerName,
        positionQuantity: position.positionQuantity,
        applyQuantity: application.applyQuantity,
        announcementExerciseDate: announcement.exerciseDate,
        applyExerciseDate: application.applyExerciseDate,
        applicationStatus: application.applicationStatus,
        isWithdrawn: application.isWithdrawn,
        conflicts,
        latestAnnouncementVersion: announcement.versionNo,
        lastUpdateTime: application.updateTime,
      });
    }
  });

  return {
    positions,
    announcements,
    applications,
    conflictRecords,
    statusChangeLogs,
    listItems,
    operationLogs: generateOperationLogs(50),
    exportRecords: generateExportRecords(20),
  };
};

export const mockData = generateMockData();
