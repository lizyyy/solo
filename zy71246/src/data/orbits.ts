import type { Probe } from '../types/mission';

export const PROBES: Probe[] = [
  {
    id: 'probe-tianwen',
    name: '天问一号探测器',
    orbitParams: {
      semiMajorAxis: 26554,
      eccentricity: 0.001,
      inclination: 42.0,
      raan: 0,
    },
    dataStorage: 5000,
    commandBufferSize: 100,
    currentDataUsage: 3200,
  },
  {
    id: 'probe-chang-e',
    name: '嫦娥五号探测器',
    orbitParams: {
      semiMajorAxis: 384400,
      eccentricity: 0.055,
      inclination: 18.3,
      raan: 90,
    },
    dataStorage: 8000,
    commandBufferSize: 150,
    currentDataUsage: 5500,
  },
];

export function getProbe(id: string): Probe | undefined {
  return PROBES.find(p => p.id === id);
}
