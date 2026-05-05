import { v4 as uuidv4 } from 'uuid';
import {
  Node,
  Pipe,
  Valve,
  PumpCurve,
  TemperatureData,
  Project,
} from '../models/types.js';

export function createSampleProject(): Project {
  const nodes: Node[] = [
    { id: 'n1', name: '供热站出口', type: 'branch', x: 100, y: 200 },
    { id: 'n2', name: '1号楼分支', type: 'branch', parentId: 'n1', x: 300, y: 100 },
    { id: 'n3', name: '2号楼分支', type: 'branch', parentId: 'n1', x: 300, y: 300 },
    { id: 'n4', name: '1号楼1单元', type: 'unit', parentId: 'n2', x: 500, y: 50 },
    { id: 'n5', name: '1号楼2单元', type: 'unit', parentId: 'n2', x: 500, y: 150 },
    { id: 'n6', name: '2号楼1单元', type: 'unit', parentId: 'n3', x: 500, y: 250 },
    { id: 'n7', name: '2号楼2单元', type: 'unit', parentId: 'n3', x: 500, y: 350 },
  ];

  const pipes: Pipe[] = [
    { id: 'p1', name: '主管网-1号楼', fromNodeId: 'n1', toNodeId: 'n2', diameter: 150, length: 80, roughness: 0.15 },
    { id: 'p2', name: '主管网-2号楼', fromNodeId: 'n1', toNodeId: 'n3', diameter: 150, length: 80, roughness: 0.15 },
    { id: 'p3', name: '1号楼-1单元', fromNodeId: 'n2', toNodeId: 'n4', diameter: 80, length: 30, roughness: 0.15 },
    { id: 'p4', name: '1号楼-2单元', fromNodeId: 'n2', toNodeId: 'n5', diameter: 80, length: 30, roughness: 0.15 },
    { id: 'p5', name: '2号楼-1单元', fromNodeId: 'n3', toNodeId: 'n6', diameter: 80, length: 30, roughness: 0.15 },
    { id: 'p6', name: '2号楼-2单元', fromNodeId: 'n3', toNodeId: 'n7', diameter: 80, length: 30, roughness: 0.15 },
  ];

  const valves: Valve[] = [
    { id: 'v1', name: '1号楼总阀', pipeId: 'p1', opening: 60, kvValue: 200, notes: '检修后调整' },
    { id: 'v2', name: '2号楼总阀', pipeId: 'p2', opening: 95, kvValue: 200, notes: '开度太大，需要调整' },
    { id: 'v3', name: '1号楼1单元阀', pipeId: 'p3', opening: 45, kvValue: 80 },
    { id: 'v4', name: '1号楼2单元阀', pipeId: 'p4', opening: 55, kvValue: 80 },
    { id: 'v5', name: '2号楼1单元阀', pipeId: 'p5', opening: 5, kvValue: 80, notes: '开度太小，需要检查' },
    { id: 'v6', name: '2号楼2单元阀', pipeId: 'p6', opening: 50, kvValue: 80 },
  ];

  const pumpCurve: PumpCurve = {
    id: 'pump-1',
    name: '循环水泵-型号ISG150-315',
    maxFlowRate: 200,
    maxHead: 32,
    efficiency: 82,
    points: [
      { flowRate: 0, head: 32 },
      { flowRate: 50, head: 30 },
      { flowRate: 100, head: 26 },
      { flowRate: 150, head: 20 },
      { flowRate: 200, head: 12 },
    ],
  };

  const temperatureData: TemperatureData[] = [
    { nodeId: 'n4', supplyTemp: 62, returnTemp: 48, timestamp: new Date().toISOString() },
    { nodeId: 'n5', supplyTemp: 61, returnTemp: 52, timestamp: new Date().toISOString() },
    { nodeId: 'n6', supplyTemp: 58, returnTemp: 35, timestamp: new Date().toISOString() },
    { nodeId: 'n7', supplyTemp: 60, returnTemp: 47, timestamp: new Date().toISOString() },
  ];

  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    name: '阳光小区供热站检修示例',
    description: '2026年春季检修后的水力平衡试算示例数据',
    createdAt: now,
    updatedAt: now,
    nodes,
    pipes,
    valves,
    pumpCurve,
    temperatureData,
    userNotes: '',
  };
}

export function createExcelTemplateData(): {
  nodes: any[];
  pipes: any[];
  valves: any[];
  pumpInfo: any[];
  pumpCurve: any[];
  temperature: any[];
} {
  return {
    nodes: [
      { id: 'n1', name: '供热站出口', type: 'branch', parentId: '', x: 100, y: 200 },
      { id: 'n2', name: '1号楼分支', type: 'branch', parentId: 'n1', x: 300, y: 100 },
      { id: 'n3', name: '2号楼分支', type: 'branch', parentId: 'n1', x: 300, y: 300 },
      { id: 'n4', name: '1号楼1单元', type: 'unit', parentId: 'n2', x: 500, y: 50 },
      { id: 'n5', name: '1号楼2单元', type: 'unit', parentId: 'n2', x: 500, y: 150 },
    ],
    pipes: [
      { id: 'p1', name: '主管网-1号楼', fromNodeId: 'n1', toNodeId: 'n2', diameter: 150, length: 80, roughness: 0.15 },
      { id: 'p2', name: '主管网-2号楼', fromNodeId: 'n1', toNodeId: 'n3', diameter: 150, length: 80, roughness: 0.15 },
      { id: 'p3', name: '1号楼-1单元', fromNodeId: 'n2', toNodeId: 'n4', diameter: 80, length: 30, roughness: 0.15 },
    ],
    valves: [
      { id: 'v1', name: '1号楼总阀', pipeId: 'p1', opening: 60, kvValue: 200, notes: '检修后调整' },
      { id: 'v2', name: '2号楼总阀', pipeId: 'p2', opening: 50, kvValue: 200, notes: '' },
    ],
    pumpInfo: [
      { id: 'pump-1', name: '循环水泵-型号ISG150-315', maxFlowRate: 200, maxHead: 32, efficiency: 82 },
    ],
    pumpCurve: [
      { flowRate: 0, head: 32 },
      { flowRate: 50, head: 30 },
      { flowRate: 100, head: 26 },
      { flowRate: 150, head: 20 },
      { flowRate: 200, head: 12 },
    ],
    temperature: [
      { nodeId: 'n4', supplyTemp: 62, returnTemp: 48, timestamp: new Date().toISOString() },
      { nodeId: 'n5', supplyTemp: 61, returnTemp: 52, timestamp: new Date().toISOString() },
    ],
  };
}
