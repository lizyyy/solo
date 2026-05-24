import { EvacuationPlan } from '@/types';

export const normalPlan: EvacuationPlan = {
  id: 'plan-normal',
  name: '正常疏散方案',
  description: '4层教学楼，2个楼梯正常使用，低年级优先疏散，无冲突',
  type: 'normal',
  building: {
    floors: 4,
    floorHeight: 4,
    width: 40,
    depth: 20,
  },
  classrooms: [
    { id: 'c101', name: '1年级1班', floor: 1, grade: 1, studentCount: 45, position: { x: -15, y: 0, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-left' },
    { id: 'c102', name: '1年级2班', floor: 1, grade: 1, studentCount: 45, position: { x: -5, y: 0, z: 0 }, exitOrder: 2, exitDelay: 3, assignedStairId: 'stair-left' },
    { id: 'c103', name: '1年级3班', floor: 1, grade: 1, studentCount: 45, position: { x: 5, y: 0, z: 0 }, exitOrder: 3, exitDelay: 6, assignedStairId: 'stair-right' },
    { id: 'c104', name: '1年级4班', floor: 1, grade: 1, studentCount: 45, position: { x: 15, y: 0, z: 0 }, exitOrder: 4, exitDelay: 9, assignedStairId: 'stair-right' },
    { id: 'c201', name: '2年级1班', floor: 2, grade: 2, studentCount: 50, position: { x: -15, y: 4, z: 0 }, exitOrder: 5, exitDelay: 12, assignedStairId: 'stair-left' },
    { id: 'c202', name: '2年级2班', floor: 2, grade: 2, studentCount: 50, position: { x: -5, y: 4, z: 0 }, exitOrder: 6, exitDelay: 15, assignedStairId: 'stair-left' },
    { id: 'c203', name: '2年级3班', floor: 2, grade: 2, studentCount: 50, position: { x: 5, y: 4, z: 0 }, exitOrder: 7, exitDelay: 18, assignedStairId: 'stair-right' },
    { id: 'c204', name: '2年级4班', floor: 2, grade: 2, studentCount: 50, position: { x: 15, y: 4, z: 0 }, exitOrder: 8, exitDelay: 21, assignedStairId: 'stair-right' },
    { id: 'c301', name: '3年级1班', floor: 3, grade: 3, studentCount: 55, position: { x: -15, y: 8, z: 0 }, exitOrder: 9, exitDelay: 24, assignedStairId: 'stair-left' },
    { id: 'c302', name: '3年级2班', floor: 3, grade: 3, studentCount: 55, position: { x: -5, y: 8, z: 0 }, exitOrder: 10, exitDelay: 27, assignedStairId: 'stair-left' },
    { id: 'c303', name: '3年级3班', floor: 3, grade: 3, studentCount: 55, position: { x: 5, y: 8, z: 0 }, exitOrder: 11, exitDelay: 30, assignedStairId: 'stair-right' },
    { id: 'c304', name: '3年级4班', floor: 3, grade: 3, studentCount: 55, position: { x: 15, y: 8, z: 0 }, exitOrder: 12, exitDelay: 33, assignedStairId: 'stair-right' },
    { id: 'c401', name: '4年级1班', floor: 4, grade: 4, studentCount: 60, position: { x: -15, y: 12, z: 0 }, exitOrder: 13, exitDelay: 36, assignedStairId: 'stair-left' },
    { id: 'c402', name: '4年级2班', floor: 4, grade: 4, studentCount: 60, position: { x: -5, y: 12, z: 0 }, exitOrder: 14, exitDelay: 39, assignedStairId: 'stair-left' },
    { id: 'c403', name: '4年级3班', floor: 4, grade: 4, studentCount: 60, position: { x: 5, y: 12, z: 0 }, exitOrder: 15, exitDelay: 42, assignedStairId: 'stair-right' },
    { id: 'c404', name: '4年级4班', floor: 4, grade: 4, studentCount: 60, position: { x: 15, y: 12, z: 0 }, exitOrder: 16, exitDelay: 45, assignedStairId: 'stair-right' },
  ],
  stairs: [
    { id: 'stair-left', name: '左侧楼梯', floors: [1, 2, 3, 4], capacity: 60, currentCount: 0, position: { x: -20, y: 0, z: 5 }, isClosed: false, width: 4, depth: 6 },
    { id: 'stair-right', name: '右侧楼梯', floors: [1, 2, 3, 4], capacity: 60, currentCount: 0, position: { x: 20, y: 0, z: 5 }, isClosed: false, width: 4, depth: 6 },
  ],
  assemblyPoints: [
    { id: 'ap1', name: '操场集合点A', capacity: 500, currentCount: 0, position: { x: 0, y: -2, z: -25 }, radius: 8 },
    { id: 'ap2', name: '操场集合点B', capacity: 500, currentCount: 0, position: { x: -25, y: -2, z: -25 }, radius: 8 },
  ],
  closedAreas: [],
};

export const conflictPlan: EvacuationPlan = {
  id: 'plan-conflict',
  name: '冲突疏散方案',
  description: '多个班级同时使用同一楼梯，楼梯容量不足，存在顺序冲突',
  type: 'conflict',
  building: {
    floors: 4,
    floorHeight: 4,
    width: 40,
    depth: 20,
  },
  classrooms: [
    { id: 'c101', name: '1年级1班', floor: 1, grade: 1, studentCount: 50, position: { x: -15, y: 0, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c102', name: '1年级2班', floor: 1, grade: 1, studentCount: 50, position: { x: -5, y: 0, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c103', name: '1年级3班', floor: 1, grade: 1, studentCount: 50, position: { x: 5, y: 0, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c104', name: '1年级4班', floor: 1, grade: 1, studentCount: 50, position: { x: 15, y: 0, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c201', name: '2年级1班', floor: 2, grade: 2, studentCount: 50, position: { x: -15, y: 4, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c202', name: '2年级2班', floor: 2, grade: 2, studentCount: 50, position: { x: -5, y: 4, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c203', name: '2年级3班', floor: 2, grade: 2, studentCount: 50, position: { x: 5, y: 4, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c204', name: '2年级4班', floor: 2, grade: 2, studentCount: 50, position: { x: 15, y: 4, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c301', name: '3年级1班', floor: 3, grade: 3, studentCount: 50, position: { x: -15, y: 8, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c302', name: '3年级2班', floor: 3, grade: 3, studentCount: 50, position: { x: -5, y: 8, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c303', name: '3年级3班', floor: 3, grade: 3, studentCount: 50, position: { x: 5, y: 8, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c304', name: '3年级4班', floor: 3, grade: 3, studentCount: 50, position: { x: 15, y: 8, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c401', name: '4年级1班', floor: 4, grade: 4, studentCount: 50, position: { x: -15, y: 12, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c402', name: '4年级2班', floor: 4, grade: 4, studentCount: 50, position: { x: -5, y: 12, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c403', name: '4年级3班', floor: 4, grade: 4, studentCount: 50, position: { x: 5, y: 12, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
    { id: 'c404', name: '4年级4班', floor: 4, grade: 4, studentCount: 50, position: { x: 15, y: 12, z: 0 }, exitOrder: 1, exitDelay: 0, assignedStairId: 'stair-main' },
  ],
  stairs: [
    { id: 'stair-main', name: '主楼梯', floors: [1, 2, 3, 4], capacity: 80, currentCount: 0, position: { x: 0, y: 0, z: 5 }, isClosed: false, width: 6, depth: 6 },
    { id: 'stair-back', name: '后楼梯', floors: [1, 2, 3, 4], capacity: 50, currentCount: 0, position: { x: 0, y: 0, z: -5 }, isClosed: true, width: 4, depth: 4 },
  ],
  assemblyPoints: [
    { id: 'ap1', name: '操场集合点', capacity: 400, currentCount: 0, position: { x: 0, y: -2, z: -25 }, radius: 10 },
  ],
  closedAreas: ['stair-back'],
};

export const emptyPlan: EvacuationPlan = {
  id: 'plan-empty',
  name: '空方案模板',
  description: '基础教学楼结构，无班级配置，供自定义方案使用',
  type: 'empty',
  building: {
    floors: 4,
    floorHeight: 4,
    width: 40,
    depth: 20,
  },
  classrooms: [],
  stairs: [
    { id: 'stair-left', name: '左侧楼梯', floors: [1, 2, 3, 4], capacity: 60, currentCount: 0, position: { x: -20, y: 0, z: 5 }, isClosed: false, width: 4, depth: 6 },
    { id: 'stair-right', name: '右侧楼梯', floors: [1, 2, 3, 4], capacity: 60, currentCount: 0, position: { x: 20, y: 0, z: 5 }, isClosed: false, width: 4, depth: 6 },
  ],
  assemblyPoints: [
    { id: 'ap1', name: '操场集合点A', capacity: 500, currentCount: 0, position: { x: 0, y: -2, z: -25 }, radius: 8 },
    { id: 'ap2', name: '操场集合点B', capacity: 500, currentCount: 0, position: { x: -25, y: -2, z: -25 }, radius: 8 },
  ],
  closedAreas: [],
};

export const allPlans: EvacuationPlan[] = [normalPlan, conflictPlan, emptyPlan];
