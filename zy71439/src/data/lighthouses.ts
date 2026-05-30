import { Lighthouse } from '../types';

export const LIGHTHOUSES: Lighthouse[] = [
  {
    id: 'lh-001',
    name: '东望洋灯塔',
    position: { lat: 22.1987, lng: 113.5432 },
    signal: '闪白 6秒',
    color: '#E74C3C',
    range: 18520
  },
  {
    id: 'lh-002',
    name: '青洲灯塔',
    position: { lat: 22.2134, lng: 113.5123 },
    signal: '定红',
    color: '#3498DB',
    range: 18520
  },
  {
    id: 'lh-003',
    name: '鹤咀灯塔',
    position: { lat: 22.2056, lng: 113.5789 },
    signal: '闪白 10秒',
    color: '#2ECC71',
    range: 18520
  },
  {
    id: 'lh-004',
    name: '横澜灯塔',
    position: { lat: 22.1876, lng: 113.5654 },
    signal: '联闪白 15秒',
    color: '#F39C12',
    range: 18520
  },
  {
    id: 'lh-005',
    name: '汲水门灯塔',
    position: { lat: 22.2345, lng: 113.5234 },
    signal: '闪绿 5秒',
    color: '#9B59B6',
    range: 18520
  }
];

export const LIGHTHOUSES_WITH_RANGE = LIGHTHOUSES.map(lh => ({
  ...lh,
  range: 18520
}));

export function getLighthouseById(id: string): Lighthouse | undefined {
  return LIGHTHOUSES.find(lh => lh.id === id);
}

export function getLighthousesByScenario(ids: string[]): Lighthouse[] {
  return ids.map(id => LIGHTHOUSES.find(lh => lh.id === id)).filter(Boolean) as Lighthouse[];
}

export { LIGHTHOUSES as lighthouses };
