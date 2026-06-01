import { GaitFrame, SkeletonPoint, BoneGroup, DataSource } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const POINT_CONFIGS: { name: string; nameCn: string; boneGroup: BoneGroup; basePos: [number, number, number] }[] = [
  { name: 'head_top', nameCn: '头顶', boneGroup: 'head', basePos: [0, 1.75, 0] },
  { name: 'neck', nameCn: '颈部', boneGroup: 'head', basePos: [0, 1.55, 0] },
  { name: 'left_shoulder', nameCn: '左肩', boneGroup: 'leftArm', basePos: [-0.22, 1.5, 0] },
  { name: 'right_shoulder', nameCn: '右肩', boneGroup: 'rightArm', basePos: [0.22, 1.5, 0] },
  { name: 'left_elbow', nameCn: '左肘', boneGroup: 'leftArm', basePos: [-0.4, 1.2, 0] },
  { name: 'right_elbow', nameCn: '右肘', boneGroup: 'rightArm', basePos: [0.4, 1.2, 0] },
  { name: 'left_wrist', nameCn: '左腕', boneGroup: 'leftArm', basePos: [-0.55, 0.9, 0] },
  { name: 'right_wrist', nameCn: '右腕', boneGroup: 'rightArm', basePos: [0.55, 0.9, 0] },
  { name: 'left_hand', nameCn: '左手', boneGroup: 'leftArm', basePos: [-0.62, 0.82, 0] },
  { name: 'right_hand', nameCn: '右手', boneGroup: 'rightArm', basePos: [0.62, 0.82, 0] },
  { name: 'spine_top', nameCn: '胸椎', boneGroup: 'spine', basePos: [0, 1.35, 0] },
  { name: 'spine_mid', nameCn: '腰椎', boneGroup: 'spine', basePos: [0, 1.0, 0] },
  { name: 'spine_bottom', nameCn: '骨盆', boneGroup: 'spine', basePos: [0, 0.7, 0] },
  { name: 'left_hip', nameCn: '左髋', boneGroup: 'leftLeg', basePos: [-0.15, 0.68, 0] },
  { name: 'right_hip', nameCn: '右髋', boneGroup: 'rightLeg', basePos: [0.15, 0.68, 0] },
  { name: 'left_knee', nameCn: '左膝', boneGroup: 'leftLeg', basePos: [-0.15, 0.35, 0] },
  { name: 'right_knee', nameCn: '右膝', boneGroup: 'rightLeg', basePos: [0.15, 0.35, 0] },
  { name: 'left_ankle', nameCn: '左踝', boneGroup: 'leftLeg', basePos: [-0.15, 0.05, 0] },
  { name: 'right_ankle', nameCn: '右踝', boneGroup: 'rightLeg', basePos: [0.15, 0.05, 0] },
  { name: 'left_foot', nameCn: '左脚', boneGroup: 'leftLeg', basePos: [-0.15, 0, 0.1] },
  { name: 'right_foot', nameCn: '右脚', boneGroup: 'rightLeg', basePos: [0.15, 0, 0.1] },
];

const getGaitOffset = (frameIndex: number, pointName: string): [number, number, number] => {
  const phase = (frameIndex / 10) * Math.PI * 2;
  const isLeft = pointName.includes('left_');
  const isLeg = pointName.includes('_hip') || pointName.includes('_knee') || pointName.includes('_ankle') || pointName.includes('_foot');
  const isArm = pointName.includes('_shoulder') || pointName.includes('_elbow') || pointName.includes('_wrist') || pointName.includes('_hand');

  if (isLeg) {
    const legPhase = isLeft ? phase : phase + Math.PI;
    const swingAmount = pointName.includes('_foot') ? 0.15 : pointName.includes('_ankle') ? 0.12 : pointName.includes('_knee') ? 0.08 : 0.02;
    const liftAmount = pointName.includes('_foot') ? 0.08 : pointName.includes('_ankle') ? 0.06 : 0.02;
    return [
      Math.sin(legPhase) * swingAmount * 0.5,
      Math.max(0, Math.sin(legPhase)) * liftAmount,
      Math.sin(legPhase) * swingAmount,
    ];
  }

  if (isArm) {
    const armPhase = isLeft ? phase + Math.PI : phase;
    const swingAmount = pointName.includes('_hand') ? 0.12 : pointName.includes('_wrist') ? 0.1 : 0.04;
    return [
      Math.sin(armPhase) * swingAmount * 0.3,
      0,
      Math.sin(armPhase) * swingAmount,
    ];
  }

  return [0, Math.sin(phase) * 0.01, 0];
};

const getDataSources = (): Record<string, DataSource> => {
  const sources: Record<string, DataSource> = {};
  POINT_CONFIGS.forEach((p) => {
    const rand = Math.random();
    if (rand < 0.7) {
      sources[p.name] = 'cad_export';
    } else if (rand < 0.9) {
      sources[p.name] = 'manual_edit';
    } else {
      sources[p.name] = 'photo_estimate';
    }
  });
  return sources;
};

const getAnomalyInfo = (pointName: string): { isAnomaly: boolean; anomalyType?: 'coordinate_error' | 'missing_data' | 'outlier' | 'suspicious'; anomalyNote?: string } => {
  const anomalies: Record<string, { type: 'coordinate_error' | 'missing_data' | 'outlier' | 'suspicious'; note: string }> = {
    left_wrist: { type: 'coordinate_error', note: '与CAD导出坐标系不一致，疑似Y轴方向翻转' },
    right_knee: { type: 'outlier', note: '第5-8帧数据与前后帧偏差超过3倍标准差' },
    head_top: { type: 'suspicious', note: '数据格式与其他点位不同，需确认采集设备' },
  };
  if (anomalies[pointName]) {
    return {
      isAnomaly: true,
      anomalyType: anomalies[pointName].type,
      anomalyNote: anomalies[pointName].note,
    };
  }
  return { isAnomaly: false };
};

const getInitialNotes = (pointName: string) => {
  const notesMap: Record<string, { content: string; author: string }[]> = {
    left_wrist: [
      { content: '2024-06-15 阿乔：已核对CAD原始文件第23行，确认坐标系问题', author: '阿乔' },
      { content: '2024-06-15 阿乔：已手动修正Y轴方向，翻转后数据正常', author: '阿乔' },
    ],
    right_knee: [
      { content: '2024-06-14 阿乔：第5帧数据异常，已标记待核实', author: '阿乔' },
    ],
  };
  return notesMap[pointName]?.map((n) => ({
    id: generateId(),
    pointId: pointName,
    content: n.content,
    author: n.author,
    createdAt: new Date().toISOString(),
  })) || [];
};

export const generateMockFrames = (frameCount: number = 10): GaitFrame[] => {
  const dataSources = getDataSources();

  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const points: SkeletonPoint[] = POINT_CONFIGS.map((config) => {
      const offset = getGaitOffset(frameIndex, config.name);
      const anomalyInfo = getAnomalyInfo(config.name);
      const sourceRow = Math.floor(Math.random() * 50) + 1;

      return {
        id: `${config.name}_frame${frameIndex}`,
        name: config.name,
        nameCn: config.nameCn,
        boneGroup: config.boneGroup,
        x: config.basePos[0] + offset[0],
        y: config.basePos[1] + offset[1],
        z: config.basePos[2] + offset[2],
        source: dataSources[config.name],
        sourceRow,
        sourceFile: 'gait_2024_06_15.csv',
        ...anomalyInfo,
        notes: getInitialNotes(config.name),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processedBy: '阿乔',
      };
    });

    return {
      frameId: `frame_${frameIndex}`,
      frameNumber: frameIndex,
      timestamp: frameIndex * 0.1,
      points,
      source: 'mock_data',
    };
  });
};

export const MOCK_FRAMES = generateMockFrames(10);

export const getSampleCSVContent = (): string => {
  const headers = ['point_id', 'point_name', 'x', 'y', 'z', 'source', 'source_row', 'is_anomaly', 'anomaly_type'];
  const rows = MOCK_FRAMES[0].points.map((p) => [
    p.id,
    p.name,
    p.x.toFixed(4),
    p.y.toFixed(4),
    p.z.toFixed(4),
    p.source,
    p.sourceRow?.toString() || '',
    p.isAnomaly ? '1' : '0',
    p.anomalyType || '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};
