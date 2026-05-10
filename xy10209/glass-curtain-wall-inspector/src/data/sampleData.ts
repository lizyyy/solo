import { DefectType, DefectStatus } from '../types';
import type { Building, Defect } from '../types';

export const sampleBuildings: Building[] = [
  {
    id: 'building-1',
    name: '金融中心A座',
    floors: 8,
    columns: 10,
    description: '主要商业办公楼，南向玻璃幕墙'
  },
  {
    id: 'building-2',
    name: '科技园B栋',
    floors: 6,
    columns: 8,
    description: '研发中心，东北向立面'
  }
];

export const sampleDefects: Defect[] = [
  {
    id: 'defect-001',
    buildingId: 'building-1',
    floor: 5,
    column: 3,
    type: DefectType.CRACK,
    status: DefectStatus.PENDING,
    description: '右侧下角发现明显裂纹，长度约15cm，宽度约2mm',
    photos: [
      {
        id: 'photo-001',
        url: '/icons.svg',
        name: '裂纹照片1.jpg',
        uploadedAt: Date.now() - 86400000
      }
    ],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    inspectionNote: '初次巡检发现'
  },
  {
    id: 'defect-002',
    buildingId: 'building-1',
    floor: 3,
    column: 7,
    type: DefectType.LOOSENESS,
    status: DefectStatus.IN_PROGRESS,
    description: '框架结构松动，有轻微晃动，密封条老化',
    photos: [
      {
        id: 'photo-002',
        url: '/icons.svg',
        name: '松动照片1.jpg',
        uploadedAt: Date.now() - 172800000
      }
    ],
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 43200000,
    inspectionNote: '已通知维修队'
  },
  {
    id: 'defect-003',
    buildingId: 'building-1',
    floor: 7,
    column: 5,
    type: DefectType.CRACK,
    status: DefectStatus.REINSPECTED,
    description: '玻璃表面蜘蛛网状裂纹，已进行临时加固',
    photos: [
      {
        id: 'photo-003',
        url: '/icons.svg',
        name: '裂纹加固后.jpg',
        uploadedAt: Date.now() - 259200000
      }
    ],
    createdAt: Date.now() - 604800000,
    updatedAt: Date.now() - 86400000,
    inspectionNote: '严重隐患，需要更换',
    reinspectionNote: '临时加固有效，待更换'
  },
  {
    id: 'defect-004',
    buildingId: 'building-2',
    floor: 4,
    column: 2,
    type: DefectType.CRACK,
    status: DefectStatus.CLOSED,
    description: '玻璃边角微小裂纹，已更换新玻璃',
    photos: [],
    createdAt: Date.now() - 2592000000,
    updatedAt: Date.now() - 604800000,
    inspectionNote: '历史记录，已修复',
    reinspectionNote: '验收合格'
  },
  {
    id: 'defect-005',
    buildingId: 'building-2',
    floor: 2,
    column: 6,
    type: DefectType.LOOSENESS,
    status: DefectStatus.PENDING,
    description: '开窗处框架松动，开关有异响',
    photos: [],
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
    inspectionNote: '需紧固处理'
  }
];
