import type {
  Task,
  StatusHistory,
  Artwork,
  WallLayout,
  OperationLog,
  User,
} from '@/types';
import { generateId, generateHash } from '@/utils';

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: '张明策展人',
    role: 'curator',
  },
  {
    id: 'user-2',
    name: '李助理',
    role: 'assistant',
  },
];

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    source: '邮件-20240520',
    sourceHash: generateHash('邮件-20240520-数字艺术展春季展'),
    title: '数字艺术春季展',
    curatorNote: `【策展备注】

展览主题：数字艺术春季展
展览时间：2024.06.01 - 2024.06.30
策展人：张明

一、展览理念
探索数字媒介与传统艺术的融合，展示新一代数字艺术家的创作成果。

二、空间规划
- 主展厅：大型投影装置
- A墙：架上数字绘画
- B墙：互动媒体作品

三、作品要求
1. 尺寸限制：最大 200x300cm
2. 装裱要求：无酸卡纸，铝合金框
3. 布光要求：重点作品配备聚光灯`,
    status: 'completed',
    createdBy: 'user-1',
    createdAt: twoDaysAgo.toISOString(),
    updatedAt: oneHourAgo.toISOString(),
    updatedBy: 'user-2',
    executionCount: 3,
  },
  {
    id: 'task-002',
    source: '微信-策展群',
    sourceHash: generateHash('微信-策展群-新媒体艺术邀请展'),
    title: '新媒体艺术邀请展',
    curatorNote: `【策展备注】

展览主题：新媒体艺术邀请展
展览时间：2024.07.15 - 2024.08.15

一、展览理念
聚焦沉浸式新媒体艺术，打造多感官艺术体验空间。

二、空间规划
全馆采用黑暗空间设计，作品自带光源。`,
    status: 'reviewing',
    createdBy: 'user-1',
    createdAt: oneDayAgo.toISOString(),
    updatedAt: twoHoursAgo.toISOString(),
    updatedBy: 'user-2',
    executionCount: 1,
  },
  {
    id: 'task-003',
    source: '邮件-20240528',
    sourceHash: generateHash('邮件-20240528-青年艺术家联展'),
    title: '青年艺术家联展',
    curatorNote: `【策展备注】

展览主题：青年艺术家联展
展览时间：2024.08.01 - 2024.08.31

待作品清单确认后进行布展规划。`,
    status: 'pending',
    createdBy: 'user-1',
    createdAt: oneDayAgo.toISOString(),
    updatedAt: oneHourAgo.toISOString(),
    updatedBy: 'user-1',
    pendingReason: '作品清单中第5件作品尺寸与展墙规划冲突，需要策展人确认调整方案。',
    executionCount: 1,
  },
  {
    id: 'task-004',
    source: '系统导入',
    sourceHash: generateHash('系统导入-数字版画收藏展'),
    title: '数字版画收藏展',
    curatorNote: `【策展备注】

展览主题：数字版画收藏展
正在等待作品清单上传...`,
    status: 'waiting_artworks',
    createdBy: 'user-1',
    createdAt: twoHoursAgo.toISOString(),
    updatedAt: twoHoursAgo.toISOString(),
    updatedBy: 'user-1',
    executionCount: 0,
  },
];

export const mockStatusHistories: StatusHistory[] = [
  {
    id: generateId(),
    taskId: 'task-001',
    fromStatus: null,
    toStatus: 'waiting_artworks',
    operator: '张明策展人',
    operatedAt: twoDaysAgo.toISOString(),
    remark: '创建投屏任务',
  },
  {
    id: generateId(),
    taskId: 'task-001',
    fromStatus: 'waiting_artworks',
    toStatus: 'reviewing',
    operator: '李助理',
    operatedAt: oneDayAgo.toISOString(),
    remark: '上传作品清单，共8件作品',
  },
  {
    id: generateId(),
    taskId: 'task-001',
    fromStatus: 'reviewing',
    toStatus: 'completed',
    operator: '李助理',
    operatedAt: oneHourAgo.toISOString(),
    remark: '复核通过，导出布展清单',
  },
  {
    id: generateId(),
    taskId: 'task-002',
    fromStatus: null,
    toStatus: 'waiting_artworks',
    operator: '张明策展人',
    operatedAt: oneDayAgo.toISOString(),
    remark: '创建投屏任务',
  },
  {
    id: generateId(),
    taskId: 'task-002',
    fromStatus: 'waiting_artworks',
    toStatus: 'reviewing',
    operator: '李助理',
    operatedAt: twoHoursAgo.toISOString(),
    remark: '上传作品清单，共12件作品',
  },
  {
    id: generateId(),
    taskId: 'task-003',
    fromStatus: null,
    toStatus: 'waiting_artworks',
    operator: '张明策展人',
    operatedAt: oneDayAgo.toISOString(),
    remark: '创建投屏任务',
  },
  {
    id: generateId(),
    taskId: 'task-003',
    fromStatus: 'waiting_artworks',
    toStatus: 'pending',
    operator: '李助理',
    operatedAt: oneHourAgo.toISOString(),
    remark: '作品尺寸冲突，进入待处理',
  },
  {
    id: generateId(),
    taskId: 'task-004',
    fromStatus: null,
    toStatus: 'waiting_artworks',
    operator: '张明策展人',
    operatedAt: twoHoursAgo.toISOString(),
    remark: '创建投屏任务',
  },
];

export const mockArtworks: Artwork[] = [
  {
    id: 'art-001',
    taskId: 'task-001',
    title: '数据流 #01',
    artist: '陈艺',
    size: '120x180cm',
    positionX: 50,
    positionY: 100,
    wallId: 'wall-a',
    version: 1,
    createdAt: oneDayAgo.toISOString(),
  },
  {
    id: 'art-002',
    taskId: 'task-001',
    title: '虚拟风景',
    artist: '王林',
    size: '80x120cm',
    positionX: 200,
    positionY: 100,
    wallId: 'wall-a',
    version: 1,
    createdAt: oneDayAgo.toISOString(),
  },
  {
    id: 'art-003',
    taskId: 'task-001',
    title: '数字肖像',
    artist: '刘芳',
    size: '60x80cm',
    positionX: 320,
    positionY: 100,
    wallId: 'wall-a',
    version: 1,
    createdAt: oneDayAgo.toISOString(),
  },
  {
    id: 'art-004',
    taskId: 'task-001',
    title: '生成之境',
    artist: '赵伟',
    size: '150x200cm',
    positionX: 50,
    positionY: 100,
    wallId: 'wall-b',
    version: 2,
    createdAt: oneDayAgo.toISOString(),
  },
  {
    id: 'art-005',
    taskId: 'task-002',
    title: '光之粒子',
    artist: '孙明',
    size: '200x300cm',
    positionX: 0,
    positionY: 0,
    wallId: 'main',
    version: 1,
    createdAt: twoHoursAgo.toISOString(),
  },
  {
    id: 'art-006',
    taskId: 'task-003',
    title: '无题 #5',
    artist: '周洋',
    size: '250x400cm',
    positionX: 50,
    positionY: 50,
    wallId: 'wall-1',
    version: 1,
    createdAt: oneHourAgo.toISOString(),
  },
];

export const mockWallLayouts: WallLayout[] = [
  {
    id: 'layout-001',
    taskId: 'task-001',
    version: 1,
    layoutData: {
      walls: [
        {
          id: 'wall-a',
          name: 'A墙',
          width: 800,
          height: 300,
          artworks: [
            { artworkId: 'art-001', x: 50, y: 60, width: 120, height: 180 },
            { artworkId: 'art-002', x: 220, y: 90, width: 80, height: 120 },
          ],
        },
        {
          id: 'wall-b',
          name: 'B墙',
          width: 600,
          height: 300,
          artworks: [
            { artworkId: 'art-004', x: 100, y: 50, width: 150, height: 200 },
          ],
        },
      ],
    },
    modifiedBy: '李助理',
    modifiedAt: oneDayAgo.toISOString(),
    changeNote: '初始布局',
  },
  {
    id: 'layout-002',
    taskId: 'task-001',
    version: 2,
    layoutData: {
      walls: [
        {
          id: 'wall-a',
          name: 'A墙',
          width: 800,
          height: 300,
          artworks: [
            { artworkId: 'art-001', x: 50, y: 60, width: 120, height: 180 },
            { artworkId: 'art-002', x: 220, y: 90, width: 80, height: 120 },
            { artworkId: 'art-003', x: 350, y: 110, width: 60, height: 80 },
          ],
        },
        {
          id: 'wall-b',
          name: 'B墙',
          width: 600,
          height: 300,
          artworks: [
            { artworkId: 'art-004', x: 80, y: 50, width: 150, height: 200 },
          ],
        },
      ],
    },
    modifiedBy: '李助理',
    modifiedAt: twoHoursAgo.toISOString(),
    changeNote: '新增作品《数字肖像》，调整B墙作品位置',
  },
  {
    id: 'layout-003',
    taskId: 'task-002',
    version: 1,
    layoutData: {
      walls: [
        {
          id: 'main',
          name: '主展厅',
          width: 1000,
          height: 400,
          artworks: [
            { artworkId: 'art-005', x: 100, y: 50, width: 200, height: 300 },
          ],
        },
      ],
    },
    modifiedBy: '李助理',
    modifiedAt: twoHoursAgo.toISOString(),
    changeNote: '初始布局',
  },
];

export const mockOperationLogs: OperationLog[] = [
  {
    id: generateId(),
    taskId: 'task-001',
    operator: '张明策展人',
    action: 'create',
    fieldName: 'task',
    newValue: '创建投屏任务',
    operatedAt: twoDaysAgo.toISOString(),
  },
  {
    id: generateId(),
    taskId: 'task-001',
    operator: '李助理',
    action: 'update',
    fieldName: 'status',
    oldValue: 'waiting_artworks',
    newValue: 'reviewing',
    operatedAt: oneDayAgo.toISOString(),
  },
  {
    id: generateId(),
    taskId: 'task-001',
    operator: '李助理',
    action: 'update',
    fieldName: 'wall_layout',
    oldValue: '版本 1',
    newValue: '版本 2',
    operatedAt: twoHoursAgo.toISOString(),
  },
  {
    id: generateId(),
    taskId: 'task-001',
    operator: '李助理',
    action: 'update',
    fieldName: 'status',
    oldValue: 'reviewing',
    newValue: 'completed',
    operatedAt: oneHourAgo.toISOString(),
  },
  {
    id: generateId(),
    taskId: 'task-003',
    operator: '李助理',
    action: 'update',
    fieldName: 'status',
    oldValue: 'waiting_artworks',
    newValue: 'pending',
    operatedAt: oneHourAgo.toISOString(),
  },
];
