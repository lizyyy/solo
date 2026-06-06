import type {
  EvidencePack,
  TrackAlias,
  VerificationOrder,
  OperationLog,
  ConflictItem,
} from '../types';

export const trackAliases: TrackAlias[] = [
  {
    id: 'ta-001',
    oldName: '夏日狂想曲',
    newName: '夏日序曲',
    caliberNote: '2024年Q3起统一更名为"夏日序曲"，旧合同仍可能使用旧名称',
    effectiveDate: '2024-07-01',
  },
  {
    id: 'ta-002',
    oldName: '星空漫步',
    newName: '星际漫游',
    caliberNote: '版权方要求统一口径，新名称从2024年9月启用',
    effectiveDate: '2024-09-15',
  },
];

export const verificationOrders: VerificationOrder[] = [
  {
    id: 'vo-001',
    evidencePackId: 'ep-001',
    trackName: '夏日序曲',
    hours: 12,
    status: 'confirmed',
    sourceNote: '合同口径与别名表一致，正常核销',
    updatedAt: '2026-06-03 16:30:00',
  },
  {
    id: 'vo-002',
    evidencePackId: 'ep-002',
    trackName: '星际漫游',
    hours: 8,
    status: 'draft',
    updatedAt: '2026-06-04 10:00:00',
  },
  {
    id: 'vo-003',
    evidencePackId: 'ep-003',
    trackName: '夏日狂想曲',
    hours: 6,
    status: 'draft',
    updatedAt: '2026-06-05 14:20:00',
  },
];

export const conflictItems: ConflictItem[] = [
  {
    id: 'ci-003',
    evidencePackId: 'ep-003',
    contractContent: '曲目名称：夏日狂想曲',
    aliasContent: '标准名称：夏日序曲（旧名：夏日狂想曲）',
    difference: '合同使用旧名称"夏日狂想曲"，别名表已更新为"夏日序曲"',
    resolved: false,
    resolution: null,
  },
];

export const operationLogs: OperationLog[] = [
  {
    id: 'log-001',
    evidencePackId: 'ep-001',
    operator: '阿梅',
    action: '导入合同页截图',
    detail: '上传了版权授权合同第3页截图，授权地区：北京、上海、广州、深圳',
    createdAt: '2026-06-03 10:00:00',
  },
  {
    id: 'log-002',
    evidencePackId: 'ep-001',
    operator: '系统',
    action: '授权地区校验',
    detail: '检测到授权地区完整（4个城市），无缺失',
    createdAt: '2026-06-03 10:01:00',
  },
  {
    id: 'log-003',
    evidencePackId: 'ep-001',
    operator: '阿梅',
    action: '补看曲目别名表',
    detail: '核对曲目"夏日序曲"，合同口径与别名表一致',
    createdAt: '2026-06-03 14:00:00',
  },
  {
    id: 'log-004',
    evidencePackId: 'ep-001',
    operator: '阿梅',
    action: '更新课时核销单',
    detail: '核销12课时，备注：合同口径与别名表一致，正常核销',
    createdAt: '2026-06-03 16:30:00',
  },
  {
    id: 'log-005',
    evidencePackId: 'ep-002',
    operator: '阿梅',
    action: '导入合同页截图',
    detail: '上传了版权授权合同第5页截图，授权地区：北京、上海、广州',
    createdAt: '2026-06-04 09:30:00',
  },
  {
    id: 'log-006',
    evidencePackId: 'ep-002',
    operator: '系统',
    action: '授权地区校验',
    detail: '检测到授权地区缺少"深圳"，该城市在巡演计划中，需店长复核',
    createdAt: '2026-06-04 09:31:00',
  },
  {
    id: 'log-007',
    evidencePackId: 'ep-003',
    operator: '阿梅',
    action: '导入合同页截图',
    detail: '上传了版权授权合同第2页截图，曲目名称：夏日狂想曲',
    createdAt: '2026-06-05 11:00:00',
  },
  {
    id: 'log-008',
    evidencePackId: 'ep-003',
    operator: '系统',
    action: '授权地区校验',
    detail: '检测到授权地区完整（4个城市），无缺失',
    createdAt: '2026-06-05 11:01:00',
  },
  {
    id: 'log-009',
    evidencePackId: 'ep-003',
    operator: '系统',
    action: '口径冲突检测',
    detail: '合同曲目名称"夏日狂想曲"与别名表标准名"夏日序曲"不一致，请阿梅确认',
    createdAt: '2026-06-05 11:02:00',
  },
];

export const evidencePacks: EvidencePack[] = [
  {
    id: 'ep-001',
    title: '2026夏季巡演-北京站-版权投诉',
    status: 'completed',
    sceneType: 'smooth',
    contractScreenshotUrl:
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=contract%20document%20page%20with%20music%20copyright%20authorization%20cities%20Beijing%20Shanghai%20Guangzhou%20Shenzhen&image_size=landscape_4_3',
    authorizedCities: ['北京', '上海', '广州', '深圳'],
    hasConflict: false,
    currentStep: 3,
    trackAliasId: 'ta-001',
    verificationOrderId: 'vo-001',
    createdAt: '2026-06-03 10:00:00',
  },
  {
    id: 'ep-002',
    title: '2026星际巡演-深圳站-版权投诉',
    status: 'manager_review',
    sceneType: 'missing_city',
    contractScreenshotUrl:
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=contract%20document%20page%20with%20music%20copyright%20authorization%20cities%20Beijing%20Shanghai%20Guangzhou%20missing%20Shenzhen&image_size=landscape_4_3',
    authorizedCities: ['北京', '上海', '广州'],
    missingCity: '深圳',
    hasConflict: false,
    currentStep: 1,
    trackAliasId: 'ta-002',
    verificationOrderId: 'vo-002',
    createdAt: '2026-06-04 09:30:00',
  },
  {
    id: 'ep-003',
    title: '2026夏日音乐会-广州站-版权投诉',
    status: 'processing',
    sceneType: 'old_caliber',
    contractScreenshotUrl:
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=contract%20document%20page%20with%20old%20music%20track%20name%20Summer%20Rhapsody%20Chinese%20characters&image_size=landscape_4_3',
    authorizedCities: ['北京', '上海', '广州', '深圳'],
    hasConflict: true,
    currentStep: 2,
    trackAliasId: 'ta-001',
    verificationOrderId: 'vo-003',
    createdAt: '2026-06-05 11:00:00',
  },
];
