import { AirspaceRecord, HistoryEntry, NoFlyZoneIssue, RouteVersion, NoFlyZone } from '../types';
import { generateSampleKML, parseKML, generateKML, modifyKML } from '../utils/kml';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const now = Date.now();
const hours = (h: number) => now - h * 3600 * 1000;

export const mockNoFlyZones: NoFlyZone[] = [
  {
    id: 'nfz-001',
    name: '机场核心区',
    center: { lat: 39.9042, lng: 116.4074, alt: 0 },
    radius: 500,
    minAlt: 0,
    maxAlt: 120,
  },
  {
    id: 'nfz-002',
    name: '体育场空域',
    center: { lat: 39.9142, lng: 116.4174, alt: 0 },
    radius: 300,
    minAlt: 0,
    maxAlt: 80,
  },
  {
    id: 'nfz-003',
    name: '医院上空',
    center: { lat: 39.8942, lng: 116.3974, alt: 0 },
    radius: 200,
    minAlt: 0,
    maxAlt: 100,
  },
];

const kml1_v1 = generateSampleKML('赛事航线A-初赛', 39.9042, 116.4074, 10);
const kml1_v2 = modifyKML(kml1_v1, (coords) =>
  coords.map((c, i) => (i === 3 ? { ...c, alt: c.alt + 20 } : c))
);

const kml2_v1 = generateSampleKML('赛事航线B-半决赛', 39.9142, 116.4174, 8);
const kml2_v2 = modifyKML(kml2_v1, (coords) =>
  coords.map((c, i) => (i >= 2 && i <= 4 ? { ...c, lng: c.lng + 0.002 } : c))
);

const kml3_v1 = generateSampleKML('赛事航线C-决赛', 39.8942, 116.3974, 12);
const kml3_v2 = modifyKML(kml3_v1, (coords) =>
  coords.map((c, i) => (i === 5 || i === 6 ? { ...c, lat: c.lat + 0.0015 } : c))
);

const kml4_v1 = generateSampleKML('训练航线-001', 39.9242, 116.4274, 6);
const kml4_v2 = modifyKML(kml4_v1, (coords) => coords.map((c) => ({ ...c, alt: c.alt - 10 })));

const kml5_v1 = generateSampleKML('表演航线-特别场', 39.8842, 116.3874, 15);
const kml5_v2 = modifyKML(kml5_v1, (coords) =>
  coords.map((c, i) => (i === 7 ? { ...c, lat: c.lat - 0.002, lng: c.lng - 0.002 } : c))
);

export const mockRecords: AirspaceRecord[] = [
  {
    id: 'REC-001',
    source: '飞手张三-KML导入',
    status: 'pending_review',
    batteryCycle: 24,
    pilot: '张三',
    createdAt: new Date(hours(48)).toISOString(),
    updatedAt: new Date(hours(48)).toISOString(),
    currentRouteVersionId: 'RV-001-v2',
  },
  {
    id: 'REC-002',
    source: '外场队长复核导入',
    status: 'reviewed',
    batteryCycle: 18,
    pilot: '李四',
    createdAt: new Date(hours(36)).toISOString(),
    updatedAt: new Date(hours(12)).toISOString(),
    currentRouteVersionId: 'RV-002-v2',
  },
  {
    id: 'REC-003',
    source: 'CSV批量导入-赛事组',
    status: 'pending_processing',
    batteryCycle: 31,
    pilot: '王五',
    createdAt: new Date(hours(24)).toISOString(),
    updatedAt: new Date(hours(6)).toISOString(),
    currentRouteVersionId: 'RV-003-v2',
    pendingReason: '航线擦边禁飞区NFZ-001，需要飞手重新规划第5-6航点',
  },
  {
    id: 'REC-004',
    source: '飞手赵六-KML导入',
    status: 'pending_review',
    batteryCycle: 7,
    pilot: '赵六',
    createdAt: new Date(hours(12)).toISOString(),
    updatedAt: new Date(hours(12)).toISOString(),
    currentRouteVersionId: 'RV-004-v1',
  },
  {
    id: 'REC-005',
    source: '表演赛特别航线',
    status: 'reviewed',
    batteryCycle: 42,
    pilot: '钱七',
    createdAt: new Date(hours(60)).toISOString(),
    updatedAt: new Date(hours(2)).toISOString(),
    currentRouteVersionId: 'RV-005-v2',
  },
];

export const mockRouteVersions: RouteVersion[] = [
  {
    id: 'RV-001-v1',
    recordId: 'REC-001',
    kmlData: kml1_v1,
    routeData: parseKML(kml1_v1),
    createdAt: new Date(hours(48)).toISOString(),
    createdBy: '张三',
    changeDescription: '初始导入',
    version: 1,
  },
  {
    id: 'RV-001-v2',
    recordId: 'REC-001',
    kmlData: kml1_v2,
    routeData: parseKML(kml1_v2),
    createdAt: new Date(hours(47)).toISOString(),
    createdBy: '张三',
    changeDescription: '调整第4点高度，避开障碍物',
    version: 2,
  },
  {
    id: 'RV-002-v1',
    recordId: 'REC-002',
    kmlData: kml2_v1,
    routeData: parseKML(kml2_v1),
    createdAt: new Date(hours(36)).toISOString(),
    createdBy: '李四',
    changeDescription: '初始导入',
    version: 1,
  },
  {
    id: 'RV-002-v2',
    recordId: 'REC-002',
    kmlData: kml2_v2,
    routeData: parseKML(kml2_v2),
    createdAt: new Date(hours(12)).toISOString(),
    createdBy: '外场队长',
    changeDescription: '东移200米避开体育场空域',
    version: 2,
  },
  {
    id: 'RV-003-v1',
    recordId: 'REC-003',
    kmlData: kml3_v1,
    routeData: parseKML(kml3_v1),
    createdAt: new Date(hours(24)).toISOString(),
    createdBy: '王五',
    changeDescription: '初始导入',
    version: 1,
  },
  {
    id: 'RV-003-v2',
    recordId: 'REC-003',
    kmlData: kml3_v2,
    routeData: parseKML(kml3_v2),
    createdAt: new Date(hours(6)).toISOString(),
    createdBy: '王五',
    changeDescription: '尝试修正但仍有擦边风险',
    version: 2,
  },
  {
    id: 'RV-004-v1',
    recordId: 'REC-004',
    kmlData: kml4_v1,
    routeData: parseKML(kml4_v1),
    createdAt: new Date(hours(12)).toISOString(),
    createdBy: '赵六',
    changeDescription: '初始导入',
    version: 1,
  },
  {
    id: 'RV-005-v1',
    recordId: 'REC-005',
    kmlData: kml5_v1,
    routeData: parseKML(kml5_v1),
    createdAt: new Date(hours(60)).toISOString(),
    createdBy: '钱七',
    changeDescription: '初始导入',
    version: 1,
  },
  {
    id: 'RV-005-v2',
    recordId: 'REC-005',
    kmlData: kml5_v2,
    routeData: parseKML(kml5_v2),
    createdAt: new Date(hours(2)).toISOString(),
    createdBy: '外场队长',
    changeDescription: '调整第8点远离医院上空',
    version: 2,
  },
];

export const mockHistory: HistoryEntry[] = [
  {
    id: generateId(),
    recordId: 'REC-001',
    action: 'create',
    operator: '张三',
    timestamp: new Date(hours(48)).toISOString(),
    reason: '导入初赛航线',
  },
  {
    id: generateId(),
    recordId: 'REC-001',
    action: 'route_modify',
    operator: '张三',
    timestamp: new Date(hours(47)).toISOString(),
    reason: '调整第4点高度+20米避开障碍物',
    previousState: '版本1',
    newState: '版本2',
  },
  {
    id: generateId(),
    recordId: 'REC-002',
    action: 'create',
    operator: '李四',
    timestamp: new Date(hours(36)).toISOString(),
    reason: '导入半决赛航线',
  },
  {
    id: generateId(),
    recordId: 'REC-002',
    action: 'status_change',
    operator: '外场队长',
    timestamp: new Date(hours(24)).toISOString(),
    reason: '航线基本没问题，但建议东移',
    previousState: 'pending_review',
    newState: 'pending_processing',
  },
  {
    id: generateId(),
    recordId: 'REC-002',
    action: 'route_modify',
    operator: '外场队长',
    timestamp: new Date(hours(12)).toISOString(),
    reason: '东移200米避开体育场空域NFZ-002',
    previousState: '版本1',
    newState: '版本2',
  },
  {
    id: generateId(),
    recordId: 'REC-002',
    action: 'status_change',
    operator: '外场队长',
    timestamp: new Date(hours(12)).toISOString(),
    reason: '航线修正完成，复核通过',
    previousState: 'pending_processing',
    newState: 'reviewed',
  },
  {
    id: generateId(),
    recordId: 'REC-003',
    action: 'create',
    operator: '赛事组',
    timestamp: new Date(hours(24)).toISOString(),
    reason: 'CSV批量导入决赛航线',
  },
  {
    id: generateId(),
    recordId: 'REC-003',
    action: 'issue_create',
    operator: '外场队长',
    timestamp: new Date(hours(18)).toISOString(),
    reason: '发现航线第5-6点擦边机场核心区NFZ-001',
    metadata: { sourceType: 'inspection_photo', zoneId: 'nfz-001' },
  },
  {
    id: generateId(),
    recordId: 'REC-003',
    action: 'route_modify',
    operator: '王五',
    timestamp: new Date(hours(6)).toISOString(),
    reason: '尝试北移修正，但仍有擦边风险，需要进一步调整',
    previousState: '版本1',
    newState: '版本2',
  },
  {
    id: generateId(),
    recordId: 'REC-003',
    action: 'status_change',
    operator: '外场队长',
    timestamp: new Date(hours(6)).toISOString(),
    reason: '仍有擦边风险，标记待处理，指定王五继续修正',
    previousState: 'pending_review',
    newState: 'pending_processing',
  },
  {
    id: generateId(),
    recordId: 'REC-004',
    action: 'create',
    operator: '赵六',
    timestamp: new Date(hours(12)).toISOString(),
    reason: '导入训练航线',
  },
  {
    id: generateId(),
    recordId: 'REC-005',
    action: 'create',
    operator: '钱七',
    timestamp: new Date(hours(60)).toISOString(),
    reason: '导入表演赛特别航线',
  },
  {
    id: generateId(),
    recordId: 'REC-005',
    action: 'issue_create',
    operator: '外场队长',
    timestamp: new Date(hours(10)).toISOString(),
    reason: '飞手备注第8点接近医院上空，需要调整',
    metadata: { sourceType: 'pilot_note', zoneId: 'nfz-003' },
  },
  {
    id: generateId(),
    recordId: 'REC-005',
    action: 'route_modify',
    operator: '外场队长',
    timestamp: new Date(hours(2)).toISOString(),
    reason: '调整第8点远离医院上空NFZ-003，西南移约280米',
    previousState: '版本1',
    newState: '版本2',
  },
  {
    id: generateId(),
    recordId: 'REC-005',
    action: 'status_change',
    operator: '外场队长',
    timestamp: new Date(hours(2)).toISOString(),
    reason: '修正完成，复核通过',
    previousState: 'pending_review',
    newState: 'reviewed',
  },
];

export const mockIssues: NoFlyZoneIssue[] = [
  {
    id: 'ISSUE-001',
    recordId: 'REC-003',
    sourceType: 'inspection_photo',
    location: { lat: 39.9042, lng: 116.4074, alt: 85 },
    description: '航线第5-6点穿越机场核心区NFZ-001边缘，水平距离仅45米，高度85米处于禁飞高度范围内',
    assignee: '王五',
    status: 'open',
    createdAt: new Date(hours(18)).toISOString(),
  },
  {
    id: 'ISSUE-002',
    recordId: 'REC-002',
    sourceType: 'pilot_note',
    location: { lat: 39.9142, lng: 116.4174, alt: 70 },
    description: '航线接近体育场空域NFZ-002，比赛当天可能有活动，需要保持安全距离',
    assignee: '李四',
    status: 'resolved',
    createdAt: new Date(hours(24)).toISOString(),
    resolvedAt: new Date(hours(12)).toISOString(),
  },
  {
    id: 'ISSUE-003',
    recordId: 'REC-005',
    sourceType: 'pilot_note',
    location: { lat: 39.8942, lng: 116.3974, alt: 95 },
    description: '第8点接近医院上空NFZ-003，表演航线需要保持至少200米水平距离',
    assignee: '钱七',
    status: 'resolved',
    createdAt: new Date(hours(10)).toISOString(),
    resolvedAt: new Date(hours(2)).toISOString(),
  },
];
