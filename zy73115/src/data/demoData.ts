import { CADLayer, ReviewSession } from '../types';
import { importLayersWithDeduplication } from '../core/collisionEngine';

export const demoLayers: Omit<CADLayer, 'id' | 'importedAt' | 'importBatchId'>[] = [
  {
    name: '承重结构-L-03',
    source: '建筑专业_20240315_初版.dwg',
    originalNote: '300x700预应力混凝土梁，跨度8.4m，配筋图见结施-12',
    color: '#c0392b',
    visible: true,
  },
  {
    name: '给排水-W-12',
    source: '水暖专业_20240318_修改版.dwg',
    originalNote: 'DN150给水干管，坡度0.003，管中心标高3.300',
    color: '#2980b9',
    visible: true,
  },
  {
    name: '给排水-W-12',
    source: '水暖专业_20240318_修改版.dwg',
    originalNote: '现场复核后补充：与L-03交叉处实际净距不足50mm，需结构复核',
    color: '#2980b9',
    visible: true,
  },
  {
    name: '剪力墙-Q-07',
    source: '建筑专业_20240315_初版.dwg',
    originalNote: '250厚C30混凝土墙，配筋见结施-08，约束边缘构件YBZ-12',
    color: '#8e44ad',
    visible: true,
  },
  {
    name: '门窗-M-09',
    source: '建筑专业_20240317_调整版.dwg',
    originalNote: '1500x2100甲级防火门，门洞顶标高2.400，后移300mm',
    color: '#16a085',
    visible: true,
  },
  {
    name: '暖通-K-05',
    source: '暖通专业_20240316_版.dwg',
    originalNote: '800x400通风风管，风速6m/s，吊顶内敷设',
    color: '#d35400',
    visible: true,
  },
  {
    name: '电气-CT-02',
    source: '电气专业_20240319_终版.dwg',
    originalNote: '400x100强电桥架，内敷NH-YJV电缆3x185+2x95',
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
    demoLayers.slice(0, 4),
    '第一批图纸_建筑+结构_20240315.dwg'
  );
  session = result1.updatedSession;

  const result2 = importLayersWithDeduplication(
    session,
    demoLayers.slice(2),
    '第二批图纸_水暖电_20240319.dwg'
  );
  session = result2.updatedSession;

  if (session.collisions.length > 0) {
    const firstCollision = session.collisions[0];
    session.collisions = session.collisions.map((c, idx) => {
      if (idx === 0) {
        return {
          ...c,
          manualNote: '已与结构工张工确认，此处需做加固处理，方案待出。现场照片已存档。',
          noteUpdatedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'pending' as const,
        };
      }
      if (c.isBoundary && c.boundaryReason?.includes('容差边界')) {
        return {
          ...c,
          manualNote: '此为同一碰撞点的施工队二次标注，已与原始记录合并，无需重复处理。',
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
