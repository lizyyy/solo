export interface TimeWindow {
  start: string;
  end: string;
}

export interface BlockSection {
  id: string;
  line: string;
  startStation: string;
  endStation: string;
  direction?: 'up' | 'down' | 'both';
}

export interface Resource {
  id: string;
  name: string;
  type: 'people' | 'machine' | 'material';
  quantity: number;
  workZoneId: string;
}

export interface WorkZone {
  id: string;
  name: string;
  responsiblePerson: string;
}

export interface MaintenanceWindow {
  id: string;
  date: string;
  windowType: 'day' | 'night';
  time: TimeWindow;
  blockSections: string[];
  priority: number;
}

export interface WorkTask {
  id: string;
  workZoneId: string;
  title: string;
  description: string;
  requiredResources: {
    resourceId: string;
    quantity: number;
  }[];
  requiredBlockSections: string[];
  estimatedDuration: number;
}

export interface ScheduledTask {
  id: string;
  taskId: string;
  windowId: string;
  workZoneId: string;
  assignedTime: TimeWindow;
  assignedResources: {
    resourceId: string;
    quantity: number;
  }[];
  assignedBlockSections: string[];
  status: 'pending' | 'scheduled' | 'completed' | 'failed';
}

export interface ResourceOccupancy {
  resourceId: string;
  windowId: string;
  time: TimeWindow;
  assignedQuantity: number;
  scheduledTaskId: string;
}

export interface Conflict {
  type: 'time' | 'resource' | 'block' | 'workzone';
  description: string;
  severity: 'warning' | 'error';
  affectedTasks: string[];
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface RunState {
  runId: string;
  timestamp: string;
  status: 'running' | 'completed' | 'failed';
  stats: {
    totalWindows: number;
    totalTasks: number;
    scheduledTasks: number;
    conflicts: number;
  };
}

export interface Database {
  maintenanceWindows: Map<string, MaintenanceWindow>;
  workZones: Map<string, WorkZone>;
  resources: Map<string, Resource>;
  workTasks: Map<string, WorkTask>;
  blockSections: Map<string, BlockSection>;
  scheduledTasks: Map<string, ScheduledTask>;
  resourceOccupancies: Map<string, ResourceOccupancy>;
  conflicts: Conflict[];
  runStates: RunState[];
}
