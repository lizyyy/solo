import { LightPoint, CameraState } from '../types';

export const sampleLightPoints: LightPoint[] = [
  {
    id: 'lp-001',
    name: '主舞台面光-01',
    x: -8,
    y: 6,
    z: 8,
    status: 'normal',
    source: '剧场灯位安全网',
    sourceRow: '点位表-第3行',
    remark: '何工 2026-05-31 巡检确认：灯位正常，光束角度正确',
    suggestion: '【正常】无需处理，按计划周期巡检即可',
    createTime: '2026-05-20 10:30:00',
    updateTime: '2026-05-31 14:20:00',
    metadata: {
      modifiedBy: '何工'
    }
  },
  {
    id: 'lp-002',
    name: '侧光架-左-03',
    x: -12,
    y: 2,
    z: 5,
    status: 'pending',
    source: '剧场灯位安全网',
    sourceRow: '现场照片-IMG_0892标注',
    remark: '坐标与原始点位表偏差约0.8米，需现场复核',
    suggestion: '【待确认】请何工携带激光测距仪现场核实该灯位实际安装位置，确认是否存在安全隐患',
    createTime: '2026-05-25 16:45:00',
    updateTime: '2026-05-30 09:15:00',
    metadata: {
      photoUrl: 'IMG_0892.jpg',
      originalX: -11.2,
      originalY: 2,
      originalZ: 5
    }
  },
  {
    id: 'lp-003',
    name: '顶光吊杆-05',
    x: 0,
    y: 0,
    z: 12,
    status: 'abnormal',
    source: 'GIS底图补录',
    sourceRow: '2023版GIS底图-旧口径',
    remark: '从历史GIS底图补录，该位置现有新灯位覆盖',
    suggestion: '【异常-旧口径】该灯位为2023年旧方案点位，2025年改造后已废弃，建议从清单中移除或标记为历史点位',
    createTime: '2023-11-10 08:00:00',
    updateTime: '2026-05-28 11:30:00',
    metadata: {}
  },
  {
    id: 'lp-004',
    name: '逆光架-02',
    x: 5,
    y: -8,
    z: 9,
    status: 'normal',
    source: '点位表导入',
    sourceRow: '2026灯光点位清单-第12行',
    remark: '数据匹配正常，与现场照片一致',
    suggestion: '【正常】位置准确，无异常',
    createTime: '2026-05-15 14:00:00',
    updateTime: '2026-05-28 10:00:00',
    metadata: {}
  },
  {
    id: 'lp-005',
    name: '观众席追光-左',
    x: -15,
    y: 10,
    z: 6,
    status: 'pending',
    source: '手改坐标',
    sourceRow: '同事老王手改版本-第8行',
    remark: '坐标被手动修改，与原始点位表不符，需确认',
    suggestion: '【待确认】请联系老王确认该追光灯位调整原因，核实是否为临时调整方案',
    createTime: '2026-04-20 11:00:00',
    updateTime: '2026-05-29 16:00:00',
    metadata: {
      modifiedBy: '老王',
      originalX: -14,
      originalY: 10,
      originalZ: 6
    }
  },
  {
    id: 'lp-006',
    name: '舞台效果灯-中央',
    x: 0,
    y: -3,
    z: 10,
    status: 'normal',
    source: '方案备注',
    sourceRow: '2026春季演出方案-备注栏',
    remark: '从演出方案备注中提取的补充点位',
    suggestion: '【正常】方案补充点位，位置已确认',
    createTime: '2026-03-01 09:00:00',
    updateTime: '2026-05-20 15:30:00',
    metadata: {}
  },
  {
    id: 'lp-007',
    name: '耳光-右-01',
    x: 10,
    y: 4,
    z: 7,
    status: 'abnormal',
    source: '现场照片',
    sourceRow: '现场照片-IMG_0915',
    remark: '照片显示该位置灯具松动，悬挂方式有安全隐患',
    suggestion: '【异常-安全隐患】请立即安排工程人员检查该灯具悬挂系统，必要时下架检修，确保演出安全',
    createTime: '2026-05-28 17:30:00',
    updateTime: '2026-05-31 08:45:00',
    metadata: {
      photoUrl: 'IMG_0915.jpg'
    }
  },
  {
    id: 'lp-008',
    name: '天排灯-04',
    x: 3,
    y: -12,
    z: 8,
    status: 'normal',
    source: '点位表导入',
    sourceRow: '2026灯光点位清单-第25行',
    remark: '正常点位',
    suggestion: '【正常】无异常',
    createTime: '2026-05-15 14:00:00',
    updateTime: '2026-05-15 14:00:00',
    metadata: {}
  }
];

export const defaultCameraState: CameraState = {
  position: [20, 25, 25],
  target: [0, 0, 5]
};
