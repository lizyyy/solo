import type { Station } from '../types';

export const stations: Station[] = [
  {
    id: 'st-001',
    name: '青龙湾潮汐站',
    lat: 30.25,
    lng: 120.15,
    status: 'active',
    hasAnomaly: true,
  },
  {
    id: 'st-002',
    name: '黑石礁观测站',
    lat: 31.23,
    lng: 121.47,
    status: 'active',
    hasAnomaly: false,
  },
  {
    id: 'st-003',
    name: '金沙滩海洋站',
    lat: 29.87,
    lng: 122.21,
    status: 'active',
    hasAnomaly: true,
  },
  {
    id: 'st-004',
    name: '银滩验潮站',
    lat: 30.58,
    lng: 119.73,
    status: 'maintenance',
    hasAnomaly: false,
  },
  {
    id: 'st-005',
    name: '东极岛潮位站',
    lat: 30.32,
    lng: 122.75,
    status: 'active',
    hasAnomaly: false,
  },
];
