export type NodeType = 'junction' | 'source' | 'reservoir';
export type ValveStatus = 'open' | 'closed' | 'failed';
export type ValveType = 'gate' | 'butterfly' | 'ball';
export type ZoneType = 'residential' | 'commercial' | 'industrial';
export type Priority = 'high' | 'medium' | 'low';
export type FlowDirection = 'forward' | 'reverse' | 'none';
export type ScenarioType = 'normal' | 'conflict' | 'empty';
export type ViewMode = '3d' | '2d-top' | '2d-front';

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  type: NodeType;
  pressure: number;
}

export interface Pipe {
  id: string;
  fromNode: string;
  toNode: string;
  diameter: number;
  length: number;
  flowDirection: FlowDirection;
}

export interface Valve {
  id: string;
  pipeId: string;
  position: number;
  status: ValveStatus;
  type: ValveType;
}

export interface CustomerZone {
  id: string;
  name: string;
  nodeIds: string[];
  customerCount: number;
  type: ZoneType;
  color: string;
}

export interface RepairPoint {
  id: string;
  pipeId: string;
  position: number;
  description: string;
  priority: Priority;
}

export interface Network {
  nodes: Node[];
  pipes: Pipe[];
  valves: Valve[];
  customerZones: CustomerZone[];
  repairPoints: RepairPoint[];
}

export interface ValveAction {
  valveId: string;
  fromStatus: 'open' | 'closed';
  toStatus: 'open' | 'closed';
  timestamp: number;
}

export interface ImpactAnalysis {
  affectedZoneIds: string[];
  affectedCustomerCount: number;
  isolatedPipes: string[];
  isolatedNodes: string[];
  hasConflict: boolean;
  conflictDetails: string[];
}

export interface Solution {
  id: string;
  name: string;
  createdAt: number;
  valveActions: ValveAction[];
  impactAnalysis: ImpactAnalysis;
  networkState: Network;
}

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  initialNetwork: Network;
}

export interface TimelineState {
  currentStep: number;
  isPlaying: boolean;
  speed: number;
}

export interface CameraState {
  viewMode: ViewMode;
  position: [number, number, number];
  target: [number, number, number];
}
