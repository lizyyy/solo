import { MealPoint, AuditRecord } from '../types';
import { generateId } from '../utils/storage';

function createAuditRecord(
  action: AuditRecord['action'],
  remark: string,
  operator: string = '系统'
): AuditRecord {
  return {
    id: generateId(),
    action,
    operator,
    remark,
    timestamp: new Date(),
  };
}

export const sampleMealPoints: MealPoint[] = [
  {
    id: 'gis-001',
    name: '幸福街道社区助餐点',
    address: '幸福路123号幸福社区服务中心1楼',
    lat: 31.2304,
    lng: 121.4737,
    source: 'GIS',
    status: 'pending',
    type: 'smooth',
    mergeHistory: [],
    notes: '',
    auditTrail: [createAuditRecord('import', '从GIS点位导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'gis-002',
    name: '幸福街道社区食堂',
    address: '幸福路123号',
    lat: 31.2305,
    lng: 121.4738,
    source: 'GIS',
    status: 'pending',
    type: 'duplicate',
    mergeHistory: [],
    notes: '',
    auditTrail: [createAuditRecord('import', '从GIS点位导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'feedback-001',
    name: '阳光社区老年助餐服务点',
    address: '阳光花园23栋',
    lat: 31.235,
    lng: 121.48,
    source: 'feedback',
    status: 'pending',
    type: 'review',
    mergeHistory: [],
    notes: '',
    auditTrail: [createAuditRecord('import', '从居民反馈导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'street-001',
    name: '阳光社区助餐点',
    address: '阳光花园内23栋1单元',
    lat: 31.2351,
    lng: 121.4801,
    source: 'street',
    status: 'pending',
    type: 'review',
    mergeHistory: [],
    notes: '街道手改：本点位为新增，服务时间为周一至周五11:00-13:00',
    auditTrail: [createAuditRecord('import', '从街道手改备注导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'legacy-001',
    name: '和平街道老年人助餐中心（旧）',
    address: '和平路456号（2023年前使用）',
    lat: 31.24,
    lng: 121.468,
    source: 'GIS',
    status: 'pending',
    type: 'legacy',
    mergeHistory: [],
    notes: '旧口径数据，需确认是否仍在使用',
    auditTrail: [createAuditRecord('import', '从GIS点位导入（旧口径）')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'empty-001',
    name: '',
    address: '南京路789号',
    lat: 31.238,
    lng: 121.475,
    source: 'GIS',
    status: 'pending',
    type: 'empty',
    mergeHistory: [],
    notes: '名称为空，需补充',
    auditTrail: [createAuditRecord('import', '从GIS点位导入（名称空值）')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'boundary-001',
    name: '河滨社区助餐点A',
    address: '河滨路1号（与江湾街道交界处）',
    lat: 31.233,
    lng: 121.485,
    source: 'inspection',
    status: 'pending',
    type: 'boundary',
    mergeHistory: [],
    notes: '边界记录：位于两街道交界处，需确认归属',
    auditTrail: [createAuditRecord('import', '从巡检记录导入（边界点位）')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'boundary-002',
    name: '河滨社区助餐点B',
    address: '河滨路3号（与江湾街道交界处）',
    lat: 31.2332,
    lng: 121.4852,
    source: 'street',
    status: 'pending',
    type: 'boundary',
    mergeHistory: [],
    notes: '相邻点位：与A点距离约50米，需确认是否合并',
    auditTrail: [createAuditRecord('import', '从街道手改备注导入（相邻点位）')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'gis-003',
    name: '康乐街道助餐服务中心',
    address: '康乐路88号',
    lat: 31.228,
    lng: 121.465,
    source: 'GIS',
    status: 'pending',
    type: 'smooth',
    mergeHistory: [],
    notes: '',
    auditTrail: [createAuditRecord('import', '从GIS点位导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'feedback-002',
    name: '康乐社区食堂',
    address: '康乐路88号康乐街道办事处旁',
    lat: 31.2281,
    lng: 121.4651,
    source: 'feedback',
    status: 'pending',
    type: 'smooth',
    mergeHistory: [],
    notes: '居民反馈：饭菜质量好，服务态度佳',
    auditTrail: [createAuditRecord('import', '从居民反馈导入')],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const sampleDataDescription = `
## 样例数据说明

本样例数据模拟了"社区养老助餐配送"的真实场景，包含以下类型：

### 1. 顺利记录（可自动归并）
- **幸福街道社区助餐点**（GIS）与**幸福街道社区食堂**（GIS）：同一地点不同写法，地址高度相似
- **康乐街道助餐服务中心**（GIS）与**康乐社区食堂**（反馈）：同一地点不同来源

### 2. 需人工确认记录
- **阳光社区老年助餐服务点**（居民反馈）与**阳光社区助餐点**（街道备注）：名称和地址有差异，需人工确认

### 3. 旧口径记录
- **和平街道老年人助餐中心（旧）**：标注为旧口径数据，需人工确认有效性

### 4. 空值记录
- **（名称为空）南京路789号**：名称字段为空，需人工补充

### 5. 边界记录（相邻点位）
- **河滨社区助餐点A**与**河滨社区助餐点B**：相距约50米，位于街道交界处，需人工判断是否合并
`;
