
import { SceneData, SampleType } from '../types';

const normalSample: SceneData = {
  blocks: [
    {
      id: 'block-1',
      name: '船首分段',
      position: { x: -15, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 12, height: 8, depth: 10 },
      color: '#4A90D9',
      startPosition: { x: -15, y: 0, z: 0 },
      endPosition: { x: -15, y: 5, z: 20 },
      liftingPoints: [
        { id: 'lp-1-1', position: { x: -4, y: 8, z: -3 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-1-2', position: { x: 4, y: 8, z: -3 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-1-3', position: { x: -4, y: 8, z: 3 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-1-4', position: { x: 4, y: 8, z: 3 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
      ],
    },
    {
      id: 'block-2',
      name: '船中分段',
      position: { x: 0, y: 0, z: -10 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 15, height: 10, depth: 15 },
      color: '#5BA3C6',
      startPosition: { x: 0, y: 0, z: -10 },
      endPosition: { x: 0, y: 5, z: 15 },
      liftingPoints: [
        { id: 'lp-2-1', position: { x: -5, y: 10, z: -5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-2', position: { x: 5, y: 10, z: -5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-3', position: { x: -5, y: 10, z: 5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-4', position: { x: 5, y: 10, z: 5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
      ],
    },
  ],
  piers: [
    { id: 'pier-1', name: '支墩A', position: { x: -15, y: 0, z: 20 }, dimensions: { width: 3, height: 3, depth: 3 } },
    { id: 'pier-2', name: '支墩B', position: { x: 0, y: 0, z: 15 }, dimensions: { width: 3, height: 3, depth: 3 } },
    { id: 'pier-3', name: '支墩C', position: { x: 15, y: 0, z: 18 }, dimensions: { width: 3, height: 3, depth: 3 } },
  ],
  rails: [
    { id: 'rail-1', start: { x: -30, y: 0.1, z: -25 }, end: { x: 30, y: 0.1, z: -25 }, width: 2 },
    { id: 'rail-2', start: { x: -30, y: 0.1, z: 35 }, end: { x: 30, y: 0.1, z: 35 }, width: 2 },
  ],
  liftingPaths: [
    {
      id: 'path-1',
      blockId: 'block-1',
      waypoints: [
        { x: -15, y: 0, z: 0 },
        { x: -15, y: 15, z: 0 },
        { x: -15, y: 15, z: 20 },
        { x: -15, y: 5, z: 20 },
      ],
      duration: 10,
    },
    {
      id: 'path-2',
      blockId: 'block-2',
      waypoints: [
        { x: 0, y: 0, z: -10 },
        { x: 0, y: 18, z: -10 },
        { x: 0, y: 18, z: 15 },
        { x: 0, y: 5, z: 15 },
      ],
      duration: 12,
    },
  ],
};

const conflictSample: SceneData = {
  blocks: [
    {
      id: 'block-1',
      name: '船尾分段',
      position: { x: -20, y: 0, z: 5 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 10, height: 9, depth: 12 },
      color: '#D9534F',
      startPosition: { x: -20, y: 0, z: 5 },
      endPosition: { x: -10, y: 5, z: 25 },
      liftingPoints: [
        { id: 'lp-1-1', position: { x: -3, y: 9, z: -4 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-1-2', position: { x: 3, y: 9, z: -4 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-1-3', position: { x: -3, y: 9, z: 4 }, direction: { x: 1, y: 0, z: 0 }, isValid: false },
        { id: 'lp-1-4', position: { x: 3, y: 9, z: 4 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
      ],
    },
    {
      id: 'block-2',
      name: '上层建筑',
      position: { x: 5, y: 0, z: -5 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 8, height: 12, depth: 8 },
      color: '#F0AD4E',
      startPosition: { x: 5, y: 0, z: -5 },
      endPosition: { x: 5, y: 5, z: 10 },
      liftingPoints: [
        { id: 'lp-2-1', position: { x: -2, y: 12, z: -2 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-2', position: { x: 2, y: 12, z: -2 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-3', position: { x: -2, y: 12, z: 2 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-2-4', position: { x: 2, y: 12, z: 2 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
      ],
    },
    {
      id: 'block-3',
      name: '船舷分段',
      position: { x: 35, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 6, height: 7, depth: 14 },
      color: '#5CB85C',
      startPosition: { x: 35, y: 0, z: 0 },
      endPosition: { x: 20, y: 5, z: 22 },
      liftingPoints: [
        { id: 'lp-3-1', position: { x: -2, y: 7, z: -5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-3-2', position: { x: 2, y: 7, z: -5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-3-3', position: { x: -2, y: 7, z: 5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
        { id: 'lp-3-4', position: { x: 2, y: 7, z: 5 }, direction: { x: 0, y: 1, z: 0 }, isValid: true },
      ],
    },
  ],
  piers: [
    { id: 'pier-1', name: '支墩A', position: { x: -10, y: 0, z: 25 }, dimensions: { width: 3, height: 3, depth: 3 } },
    { id: 'pier-2', name: '支墩B', position: { x: 5, y: 0, z: 10 }, dimensions: { width: 3, height: 3, depth: 3 } },
    { id: 'pier-3', name: '支墩C', position: { x: 20, y: 0, z: 22 }, dimensions: { width: 3, height: 3, depth: 3 } },
    { id: 'pier-4', name: '支墩D', position: { x: 5, y: 0, z: 3 }, dimensions: { width: 4, height: 3, depth: 4 } },
  ],
  rails: [
    { id: 'rail-1', start: { x: -25, y: 0.1, z: -20 }, end: { x: 25, y: 0.1, z: -20 }, width: 2 },
    { id: 'rail-2', start: { x: -25, y: 0.1, z: 30 }, end: { x: 25, y: 0.1, z: 30 }, width: 2 },
  ],
  liftingPaths: [
    {
      id: 'path-1',
      blockId: 'block-1',
      waypoints: [
        { x: -20, y: 0, z: 5 },
        { x: -20, y: 12, z: 5 },
        { x: -10, y: 12, z: 25 },
        { x: -10, y: 5, z: 25 },
      ],
      duration: 10,
    },
    {
      id: 'path-2',
      blockId: 'block-2',
      waypoints: [
        { x: 5, y: 0, z: -5 },
        { x: 5, y: 8, z: -5 },
        { x: 5, y: 8, z: 10 },
        { x: 5, y: 5, z: 10 },
      ],
      duration: 8,
    },
    {
      id: 'path-3',
      blockId: 'block-3',
      waypoints: [
        { x: 35, y: 0, z: 0 },
        { x: 35, y: 10, z: 0 },
        { x: 20, y: 10, z: 22 },
        { x: 20, y: 5, z: 22 },
      ],
      duration: 10,
    },
  ],
};

const emptySample: SceneData = {
  blocks: [],
  piers: [],
  rails: [
    { id: 'rail-1', start: { x: -30, y: 0.1, z: -25 }, end: { x: 30, y: 0.1, z: -25 }, width: 2 },
    { id: 'rail-2', start: { x: -30, y: 0.1, z: 35 }, end: { x: 30, y: 0.1, z: 35 }, width: 2 },
  ],
  liftingPaths: [],
};

export const samples: Record<SampleType, SceneData> = {
  normal: normalSample,
  conflict: conflictSample,
  empty: emptySample,
};

export const sampleNames: Record<SampleType, string> = {
  normal: '正常吊装样例',
  conflict: '冲突吊装样例',
  empty: '空场景样例',
};

