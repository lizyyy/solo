import { v4 as uuidv4 } from 'uuid';
import type { ReviewTask, CadLayer, LayerHistory, Screenshot, LayerCategory, LayerStatus } from '../shared/types.js';

interface DataSchema {
  tasks: ReviewTask[];
  layers: CadLayer[];
  histories: LayerHistory[];
  screenshots: Screenshot[];
}

const categories: LayerCategory[] = ['给水', '排水', '暖通', '电气', '消防'];
const colors = ['#2563EB', '#DC2626', '#16A34A', '#CA8A04', '#9333EA'];
const lineTypes = ['CONTINUOUS', 'DASHED', 'CENTER', 'PHANTOM'];
const statuses: LayerStatus[] = ['approved', 'needs_modify', 'rejected'];
const reviewer = '建筑师小赵';

function daysAgo(n: number, hoursOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(d.getHours() - hoursOffset);
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(0, 0);
  return d.toISOString();
}

const standardTagsPool = [
  'GB50015-2019',
  'GB50016-2014',
  'GB50084-2017',
  'GB50736-2012',
  'GB50052-2009',
  'GB50057-2010',
  'GB50116-2013',
  '09S304',
  '06MS201',
  '15K606',
  '14X505-1',
  '04X501',
];

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randTags(min = 1, max = 3): string[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...standardTagsPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function seed(data: DataSchema): void {
  const now = new Date();

  const task1Id = uuidv4();
  const task2Id = uuidv4();

  const tasks: ReviewTask[] = [
    {
      id: task1Id,
      projectName: '滨海新区中心医院扩建工程',
      drawingVersion: 'V2.3',
      cadSource: '中建八局设计院',
      status: 'in_progress',
      createdAt: daysAgo(12),
      updatedAt: daysAgo(2),
      layerCount: 8,
      openIssueCount: 0,
      description: '门诊楼机电专业综合管线深化设计复核，重点关注地下一层管综碰撞及管井布置',
    },
    {
      id: task2Id,
      projectName: '城东科创园A栋办公楼',
      drawingVersion: 'V1.5',
      cadSource: '华建集团上海院',
      status: 'pending',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(5),
      layerCount: 7,
      openIssueCount: 0,
      description: '总部办公楼1-8层标准层机电管线综合图审核，含VRV多联机系统',
    },
  ];

  const layers: CadLayer[] = [];
  const histories: LayerHistory[] = [];
  const screenshots: Screenshot[] = [];

  const layerSpecs: { taskId: string; categories: LayerCategory[] }[] = [
    {
      taskId: task1Id,
      categories: ['给水', '给水', '排水', '排水', '暖通', '电气', '消防', '消防'],
    },
    {
      taskId: task2Id,
      categories: ['给水', '排水', '暖通', '暖通', '电气', '消防', '消防'],
    },
  ];

  const nameByCategory: Record<LayerCategory, string[]> = {
    给水: ['生活给水主管', '生活给水支管', '消火栓给水', '喷淋给水'],
    排水: ['污水排水总管', '废水排水管', '雨水排水系统', '专用通气管'],
    暖通: ['空调送风管', '空调回风管', '排烟风管', '新风管'],
    电气: ['动力配电桥架', '照明配电线路', '消防报警线路', '弱电综合桥架'],
    消防: ['喷淋主管', '消火栓管道', '消防支管', '气体灭火管线'],
  };

  let layerCounter = 0;

  for (const spec of layerSpecs) {
    for (const category of spec.categories) {
      layerCounter++;
      const layerId = uuidv4();
      const colorIndex = categories.indexOf(category);
      const catIdx = categories.indexOf(category);
      const originalName = `${category}-LAYER-${String(layerCounter).padStart(3, '0')}`;
      const displayName = randPick(nameByCategory[category]);
      const finalStatus = layerCounter <= 9 ? randPick(statuses) : 'needs_modify';
      const finalVersion = 2 + Math.floor(Math.random() * 2);
      const opinionsByStatus: Record<LayerStatus, string> = {
        approved: '管线布置合理，满足规范要求，可通过',
        needs_modify: '与暖通主管交叉净距不足300mm，需调整标高',
        rejected: '违反GB50015-2019第3.5.10条，管道穿防火墙无防护措施',
      };

      layers.push({
        id: layerId,
        taskId: spec.taskId,
        originalName,
        displayName,
        category,
        color: colors[colorIndex],
        lineType: lineTypes[catIdx % lineTypes.length],
        currentStatus: finalStatus,
        latestOpinion: opinionsByStatus[finalStatus],
        version: finalVersion,
        createdAt: daysAgo(10 + Math.floor(Math.random() * 5)),
        updatedAt: daysAgo(1 + Math.floor(Math.random() * 4)),
      });

      for (let v = 1; v <= finalVersion; v++) {
        const isLast = v === finalVersion;
        const histStatus: LayerStatus = isLast
          ? finalStatus
          : (randPick(['needs_modify', 'rejected'] as const) as LayerStatus);
        const tags = randTags(1, 4);

        histories.push({
          id: uuidv4(),
          layerId,
          version: v,
          status: histStatus,
          opinion:
            v === 1
              ? '初次审核：发现多处标高冲突，建议与机电各专业协调'
              : v === 2
              ? '调整后复核：部分区域仍需优化净距'
              : '最终复核：符合规范要求',
          note:
            v === 1
              ? '详见截图区域A-3轴线交5-6轴处管井'
              : v === 2
              ? '已协调暖通单位下调风管标高50mm'
              : '各方会签确认',
          reviewer,
          reviewedAt: daysAgo(finalVersion - v + Math.random() * 2),
          standardTags: tags,
          screenshotIds: [],
          changedFields:
            v === 1
              ? ['status', 'opinion', 'note']
              : v === 2
              ? ['status', 'opinion', 'note', 'standardTags']
              : ['status', 'opinion'],
        });
      }
    }
  }

  const screenshotSpecs = [
    { seed: 'shot1', taskIdx: 0, layerRel: 0 },
    { seed: 'shot2', taskIdx: 0, layerRel: 2 },
    { seed: 'shot3', taskIdx: 0, layerRel: 4 },
    { seed: 'shot4', taskIdx: 1, layerRel: 1 },
    { seed: 'shot5', taskIdx: 1, layerRel: 3 },
    { seed: 'shot6', taskIdx: 0, layerRel: 6 },
  ];

  for (let i = 0; i < screenshotSpecs.length; i++) {
    const spec = screenshotSpecs[i];
    const taskId = tasks[spec.taskIdx].id;
    const layerIdx = layers.findIndex((l) => l.taskId === taskId);
    const layerId = layerIdx >= 0 ? layers[layerIdx + spec.layerRel]?.id : undefined;
    const boundLayer = layers.find((l) => l.id === layerId);

    screenshots.push({
      id: uuidv4(),
      taskId,
      layerId,
      fileName: `screenshot_${i + 1}.jpg`,
      storedPath: `https://picsum.photos/seed/${spec.seed}/800/500`,
      fileSize: Math.floor(Math.random() * 800000) + 200000,
      mimeType: 'image/jpeg',
      uploadedAt: daysAgo(Math.floor(Math.random() * 5) + 1),
      caption: `管综交叉区域截图 - ${i + 1}区`,
      standardTags: randTags(2, 4),
      boundVersion: boundLayer?.version,
      isDeleted: false,
    });
  }

  for (const h of histories) {
    const layerScreenshots = screenshots.filter((s) => s.layerId === h.layerId);
    if (layerScreenshots.length > 0 && h.version >= 2) {
      h.screenshotIds = layerScreenshots.slice(0, 1).map((s) => s.id);
    }
  }

  for (const task of tasks) {
    const taskLayers = layers.filter((l) => l.taskId === task.id);
    task.layerCount = taskLayers.length;
    task.openIssueCount = taskLayers.filter(
      (l) => l.currentStatus === 'needs_modify' || l.currentStatus === 'rejected',
    ).length;
  }

  data.tasks = tasks;
  data.layers = layers;
  data.histories = histories;
  data.screenshots = screenshots;
}
