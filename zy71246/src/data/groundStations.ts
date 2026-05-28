import type { GroundStation } from '../types/mission';

export const GROUND_STATIONS: GroundStation[] = [
  {
    id: 'station-beijing',
    name: '北京测控站',
    location: { lat: 39.9042, lng: 116.4074 },
    latitude: 39.9042,
    longitude: 116.4074,
    bandwidth: 150,
    bands: ['S', 'X'],
    antennaSlewTime: 30,
    antennaDiameter: 18,
    status: 'idle',
  },
  {
    id: 'station-sanya',
    name: '三亚测控站',
    location: { lat: 18.2528, lng: 109.5119 },
    latitude: 18.2528,
    longitude: 109.5119,
    bandwidth: 200,
    bands: ['S', 'X', 'Ka'],
    antennaSlewTime: 25,
    antennaDiameter: 25,
    status: 'idle',
  },
  {
    id: 'station-kashi',
    name: '喀什测控站',
    location: { lat: 39.4704, lng: 75.9898 },
    latitude: 39.4704,
    longitude: 75.9898,
    bandwidth: 180,
    bands: ['S', 'X'],
    antennaSlewTime: 28,
    antennaDiameter: 20,
    status: 'idle',
  },
  {
    id: 'station-argentina',
    name: '阿根廷测控站',
    location: { lat: -31.4201, lng: -64.1888 },
    latitude: -31.4201,
    longitude: -64.1888,
    bandwidth: 160,
    bands: ['S', 'X', 'Ka'],
    antennaSlewTime: 32,
    antennaDiameter: 22,
    status: 'idle',
  },
];

export function getGroundStation(id: string): GroundStation | undefined {
  return GROUND_STATIONS.find(s => s.id === id);
}
