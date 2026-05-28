import { Hall, Corner } from '../game/types';

export const MOCK_HALLS: Hall[] = [
  {
    id: 'hall_1',
    name: '一号展厅 - 古典油画',
    position: { x: 50, y: 50, width: 200, height: 150 },
    corners: ['corner_1_1', 'corner_1_2', 'corner_1_3', 'corner_1_4'],
    isPatrolled: false,
    patrolTime: null,
  },
  {
    id: 'hall_2',
    name: '二号展厅 - 现代雕塑',
    position: { x: 280, y: 50, width: 180, height: 150 },
    corners: ['corner_2_1', 'corner_2_2', 'corner_2_3', 'corner_2_4'],
    isPatrolled: false,
    patrolTime: null,
  },
  {
    id: 'hall_3',
    name: '三号展厅 - 当代艺术',
    position: { x: 50, y: 230, width: 180, height: 140 },
    corners: ['corner_3_1', 'corner_3_2', 'corner_3_3', 'corner_3_4'],
    isPatrolled: false,
    patrolTime: null,
  },
  {
    id: 'hall_4',
    name: '四号展厅 - 珍贵文物',
    position: { x: 260, y: 230, width: 200, height: 140 },
    corners: ['corner_4_1', 'corner_4_2', 'corner_4_3', 'corner_4_4'],
    isPatrolled: false,
    patrolTime: null,
  },
  {
    id: 'hall_5',
    name: '五号展厅 - 摄影艺术',
    position: { x: 490, y: 50, width: 160, height: 320 },
    corners: ['corner_5_1', 'corner_5_2', 'corner_5_3', 'corner_5_4'],
    isPatrolled: false,
    patrolTime: null,
  },
];

export const MOCK_CORNERS: Corner[] = [
  { id: 'corner_1_1', hallId: 'hall_1', name: '一号厅-西北角', position: { x: 60, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_1_2', hallId: 'hall_1', name: '一号厅-东北角', position: { x: 230, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_1_3', hallId: 'hall_1', name: '一号厅-西南角', position: { x: 60, y: 180 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_1_4', hallId: 'hall_1', name: '一号厅-东南角', position: { x: 230, y: 180 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_2_1', hallId: 'hall_2', name: '二号厅-西北角', position: { x: 290, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_2_2', hallId: 'hall_2', name: '二号厅-东北角', position: { x: 440, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_2_3', hallId: 'hall_2', name: '二号厅-西南角', position: { x: 290, y: 180 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_2_4', hallId: 'hall_2', name: '二号厅-东南角', position: { x: 440, y: 180 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_3_1', hallId: 'hall_3', name: '三号厅-西北角', position: { x: 60, y: 240 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_3_2', hallId: 'hall_3', name: '三号厅-东北角', position: { x: 210, y: 240 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_3_3', hallId: 'hall_3', name: '三号厅-西南角', position: { x: 60, y: 350 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_3_4', hallId: 'hall_3', name: '三号厅-东南角', position: { x: 210, y: 350 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_4_1', hallId: 'hall_4', name: '四号厅-西北角', position: { x: 270, y: 240 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_4_2', hallId: 'hall_4', name: '四号厅-东北角', position: { x: 440, y: 240 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_4_3', hallId: 'hall_4', name: '四号厅-西南角', position: { x: 270, y: 350 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_4_4', hallId: 'hall_4', name: '四号厅-东南角', position: { x: 440, y: 350 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_5_1', hallId: 'hall_5', name: '五号厅-西北角', position: { x: 500, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_5_2', hallId: 'hall_5', name: '五号厅-东北角', position: { x: 630, y: 60 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_5_3', hallId: 'hall_5', name: '五号厅-西南角', position: { x: 500, y: 350 }, isPatrolled: false, patrolTime: null },
  { id: 'corner_5_4', hallId: 'hall_5', name: '五号厅-东南角', position: { x: 630, y: 350 }, isPatrolled: false, patrolTime: null },
];

export const MAP_BOUNDS = { width: 700, height: 420 };
export const START_POSITION = { x: 350, y: 390 };
