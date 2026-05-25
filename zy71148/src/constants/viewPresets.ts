import { ViewPreset } from '../types';

export const viewPresets: ViewPreset[] = [
  {
    id: 'top',
    name: '俯视图',
    position: [30, 80, 15],
    target: [30, 0, 15],
  },
  {
    id: 'perspective',
    name: '斜视图',
    position: [80, 50, 60],
    target: [30, 2, 15],
  },
  {
    id: 'side',
    name: '侧视图',
    position: [30, 20, 80],
    target: [30, 2, 15],
  },
  {
    id: 'front',
    name: '正视图',
    position: [-60, 20, 15],
    target: [30, 2, 15],
  },
  {
    id: 'section',
    name: '剖面图',
    position: [30, 15, 15],
    target: [30, 2, 15],
  },
];
