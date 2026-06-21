import { CADLayer, ReviewSession } from '../types';
import { importLayersWithDeduplication } from '../core/collisionEngine';

export const demoLayersBatch1: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[] = [
  {
    name: '承重结构-L-03',
    source: '结施-12_3号楼结构梁图_20240315.dwg',
    originalNote: '300x700预应力混凝土梁，跨度8.4m，上部3Φ25+2Φ22，下部8Φ25 4/4，箍筋Φ10@100/200(4)',
    color: '#c0392b',
    visible: true,
  },
  {
    name: '给排水-W-12',
    source: '水施-07_3号楼给水系统图_20240318.dwg',
    originalNote: 'DN150衬塑钢管给水干管，坡度0.003，管中心标高3.300，支架间距≤4m',
    color: '#2980b9',
    visible: true,
  },
  {
    name: '给排水-W-12_现场复核',
    source: '现场测绘记录_20240322_施工队王某.dwg',
    originalNote: '现场复核后补：W-12与结构梁L-03交叉处实测净距仅15mm，原图纸标注50mm有误，需结构专业复核并出具加固方案，监理已签字确认',
    color: '#2980b9',
    visible: true,
  },
  {
    name: '剪力墙-Q-07',
    source: '结施-08_3号楼剪力墙布置图_20240315.dwg',
    originalNote: '250厚C30钢筋混凝土剪力墙，约束边缘构件YBZ-12，配筋见详图3/12，纵筋16Φ20，箍筋Φ10@100',
    color: '#8e44ad',
    visible: true,
  },
];

export const demoLayersBatch2: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[] = [
  {
    name: '门窗-M-09',
    source: '建施-05_3号楼门窗表及大样_20240317.dwg',
    originalNote: 'M-09为甲级防火门FM甲1521，洞口尺寸1500x2100，门洞顶标高2.400，后移300mm，钢质，耐火极限1.5h',
    color: '#16a085',
    visible: true,
  },
  {
    name: '暖通-K-05',
    source: '暖施-03_3号楼通风空调图_20240316.dwg',
    originalNote: 'K-05为排风兼排烟风管，800x400mm镀锌钢板，壁厚0.75mm，风速6m/s，吊顶内敷设，支吊架间距≤3m',
    color: '#d35400',
    visible: true,
  },
  {
    name: '电气-CT-02',
    source: '电施-09_3号楼强电桥架布置图_20240319.dwg',
    originalNote: 'CT-02为强电桥架400x100mm，水平敷设，内敷NH-YJV-0.6/1kV电缆，3x185+2x95共6根，防火隔板分隔',
    color: '#f1c40f',
    visible: true,
  },
];

export const demoLayersAll = [...demoLayersBatch1, ...demoLayersBatch2];

export const demoLayersReimport: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[] = [
  {
    name: '承重结构-L-03_施工版',
    source: '施工队重绘_结构梁图_20240325_v2.dwg',
    originalNote: '300x700预应力混凝土梁，跨度8.4m，配筋同结施-12，已核对，现场实际坐标与图纸一致',
    color: '#c0392b',
    visible: true,
  },
  {
    name: '给排水-W-12_竣工版',
    source: '竣工图_给水系统_施工版_v2.dwg',
    originalNote: 'DN150衬塑钢管给水干管，坡度0.003，管中心标高3.300，同原设计',
    color: '#2980b9',
    visible: true,
  },
  {
    name: '门窗-M-09_施工确认',
    source: '分包单位提交_门窗深化图_确认版.dwg',
    originalNote: 'M-09为甲级防火门FM甲1521，洞口尺寸1500x2100，后移300mm，供应商已现场复测',
    color: '#16a085',
    visible: true,
  },
  {
    name: '暖通-K-05_现场放样',
    source: '现场放样图_风管走向_20240328.dwg',
    originalNote: 'K-05排风兼排烟风管，800x400mm，走向同原设计，避让结构梁，现场放样确认',
    color: '#d35400',
    visible: true,
  },
  {
    name: '电气-CT-02_现场放样',
    source: '现场放样图_桥架走向_20240328.dwg',
    originalNote: 'CT-02强电桥架400x100mm，走向同原设计，与暖通风管净距200mm，满足规范',
    color: '#f1c40f',
    visible: true,
  },
];

const createEmptySession = (): ReviewSession => ({
  id: `session-${Date.now()}`,
  name: '旧楼测绘图纸复核 - 3号楼改造项目',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  layers: [],
  collisions: [],
  importHistory: [],
  supplementaryNote: '本项目为1998年建成的旧楼改造，原始图纸不全，现场测绘与CAD图层存在多处偏差。碰撞点复核需结合现场实际情况，标注"边界"的为临界或重复标注，需人工确认。',
});

export const createDemoSession = (): ReviewSession => {
  let session = createEmptySession();

  const result1 = importLayersWithDeduplication(
    session,
    demoLayersBatch1,
    '第一批_结施+水施+现场测绘_20240322.dwg'
  );
  session = result1.updatedSession;

  const result2 = importLayersWithDeduplication(
    session,
    demoLayersBatch2,
    '第二批_建施门窗+暖施+电施_20240319.dwg'
  );
  session = result2.updatedSession;

  if (session.collisions.length > 0) {
    session.collisions = session.collisions.map((c) => {
      if (c.severity === 'critical') {
        return {
          ...c,
          manualNote: '已与结构工张工确认，此处需做加固处理，方案待出。现场照片已存档（见2024-03-25现场记录）。',
          noteUpdatedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'pending' as const,
        };
      }
      if (c.isBoundary && c.boundaryReason?.includes('容差边界')) {
        return {
          ...c,
          manualNote: '此为同一碰撞点的施工队二次标注，已与原始记录合并，无需重复处理。监理李工确认。',
          noteUpdatedAt: new Date(Date.now() - 43200000).toISOString(),
        };
      }
      return c;
    });
  }

  return session;
};

export const getBoundarySamples = (session: ReviewSession) => {
  return session.collisions.filter(c => c.isBoundary);
};

export const getDuplicateCollisions = (session: ReviewSession) => {
  return session.collisions.filter(c => c.duplicateOf);
};

export const getCADSourceForCollision = (session: ReviewSession, collisionId: string) => {
  const collision = session.collisions.find(c => c.id === collisionId);
  if (!collision) return null;

  const layerA = session.layers.find(l => l.id === collision.layerIdA);
  const layerB = session.layers.find(l => l.id === collision.layerIdB);

  return {
    collision,
    layerA,
    layerB,
    originalCADStatements: [
      layerA?.originalNote,
      layerB?.originalNote,
    ].filter(Boolean),
  };
};
