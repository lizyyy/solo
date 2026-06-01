import type { CrackRecord, CameraState } from '../types';

export const defaultCameraState: CameraState = {
  position: { x: 8, y: 3, z: 8 },
  target: { x: 0, y: 2.5, z: 0 },
  fov: 50
};

export const mockRecords: CrackRecord[] = [
  {
    id: '1',
    code: 'YP-2024-001',
    location: 'middle',
    position3D: { x: 0, y: 2.5, z: 0 },
    crackType: 'transverse',
    riskLevel: 'medium',
    status: 'completed',
    source: 'tablet',
    description: '叶中部位发现横向裂纹，长约15cm，宽度0.3mm',
    suggestion: '建议下次定检时打磨修补，表面涂覆保护涂层，记录在册持续跟踪6个月。每次巡检重点拍照对比，确认无扩展趋势。',
    remark: '巡检平板拍摄，编号TAB-2024-156，现场已做临时标记，位置在迎风面距叶根23米处',
    isOldCaliber: false,
    sourceInfo: {
      id: 's1',
      sourceType: 'tablet',
      sourceRef: '平板记录第3行，照片IMG_20240615_1423',
      originalData: '{"position":"叶中","length":"15cm","width":"0.3mm","photo":"IMG_20240615_1423","operator":"张巡检"}'
    },
    history: [
      {
        id: 'h1',
        operator: '何工',
        action: 'create',
        detail: '导入巡检平板数据，创建标注记录',
        timestamp: '2024-06-15 14:30:00'
      },
      {
        id: 'h2',
        operator: '何工',
        action: 'status_change',
        detail: '状态从待处理改为已处理，处理方案已确认',
        timestamp: '2024-06-15 15:10:00',
        diff: [{ field: 'status', oldValue: 'pending', newValue: 'completed' }]
      }
    ],
    createdAt: '2024-06-15 14:30:00',
    updatedAt: '2024-06-15 15:10:00'
  },
  {
    id: '2',
    code: 'YP-2024-002',
    location: 'tip',
    position3D: { x: 0, y: 4.8, z: 0.2 },
    crackType: 'suspected',
    riskLevel: 'high',
    status: 'pending',
    source: 'gis',
    description: '叶尖部位GIS扫描发现异常反射信号，疑似表面裂纹或涂层剥落，信号强度超出阈值2.3倍',
    suggestion: '建议安排无人机近距航拍确认，重点拍摄叶尖迎风面和背风面。必要时搭架人工检查，用裂纹测宽仪精确测量。确认前降低该风机运行负荷15%，避免叶尖载荷过大。',
    remark: 'GIS数据编号GIS-2024-W03-078，位置与上月巡检记录有偏差约15cm，需确认是否为同一处缺陷。叶尖部位风载大，建议优先处理。',
    isOldCaliber: false,
    sourceInfo: {
      id: 's2',
      sourceType: 'gis',
      sourceRef: 'GIS扫描报告第7页，异常点编号A-078',
      originalData: '{"grid":"W03","point":"A-078","signalStrength":"2.3x","deviation":"15cm","depth":"未知"}'
    },
    history: [
      {
        id: 'h3',
        operator: '何工',
        action: 'create',
        detail: '导入GIS扫描数据，创建疑似记录',
        timestamp: '2024-06-16 09:15:00'
      },
      {
        id: 'h4',
        operator: '何工',
        action: 'remark',
        detail: '补充备注：与上月记录位置偏差15cm，需确认是否为同一处，建议无人机复检',
        timestamp: '2024-06-16 09:45:00',
        diff: [{ field: 'remark', oldValue: '', newValue: '与上月记录位置偏差15cm，需确认是否为同一处，建议无人机复检' }]
      }
    ],
    createdAt: '2024-06-16 09:15:00',
    updatedAt: '2024-06-16 09:45:00'
  },
  {
    id: '3',
    code: 'YP-2023-156',
    location: 'root',
    position3D: { x: 0, y: 0.5, z: -0.1 },
    crackType: 'longitudinal',
    riskLevel: 'low',
    status: 'confirmed',
    source: 'screenshot',
    description: '叶根部位纵向微裂纹，旧口径记录，长约8cm，已跟踪12个月无明显扩展，位于叶根法兰连接区域',
    suggestion: '按旧口径标准属"观察类"，按新标准需重新评估是否需要修补。建议下次定检时重点复核，测量裂纹长度和宽度变化，确认无扩展可维持观察。如确认有扩展趋势，需做超声波探伤检查内部是否有分层。',
    remark: '从周会截图补录，原记录日期2023-06-01，旧口径分类为"一般缺陷"，新口径可能升级为"需处理"。原处理人：李工，备注：叶根应力集中区，需持续关注。',
    isOldCaliber: true,
    sourceInfo: {
      id: 's3',
      sourceType: 'screenshot',
      sourceRef: '周会截图2024-06-10，第5页第3行旧记录',
      originalData: '{"oldCode":"DEF-2023-156","oldCategory":"一般缺陷","oldStatus":"观察中","date":"2023-06-01","operator":"李工"}'
    },
    history: [
      {
        id: 'h5',
        operator: '何工',
        action: 'import',
        detail: '从周会截图补录旧口径记录，原记录2023-06-01',
        timestamp: '2024-06-16 11:20:00'
      },
      {
        id: 'h6',
        operator: '系统',
        action: 'remark',
        detail: '新旧口径对比：旧口径"观察类" vs 新口径"需重新评估"，风险等级由"无"调整为"低"',
        timestamp: '2024-06-16 11:20:01'
      }
    ],
    createdAt: '2023-06-01 00:00:00',
    updatedAt: '2024-06-16 11:20:01'
  }
];

export const getOldVersionRecord3 = (): CrackRecord => {
  const original = mockRecords[2];
  return {
    ...original,
    riskLevel: 'low' as const,
    suggestion: '按旧口径标准属"观察类"，建议每季度巡检观察，无明显变化可不处理。',
    remark: '原记录日期2023-06-01，旧口径分类为"一般缺陷"，处理人：李工',
    history: [
      {
        id: 'h5-old',
        operator: '李工',
        action: 'create',
        detail: '创建记录，分类为一般缺陷',
        timestamp: '2023-06-01 10:00:00'
      }
    ],
    updatedAt: '2023-06-01 10:00:00'
  };
};
