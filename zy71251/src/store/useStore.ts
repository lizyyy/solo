import { create } from 'zustand';
import type { AppState, AppActions, Location, Task, RoutePoint } from '../types';
import { warehouse, shelves, locations, forbiddenZones, tasks, operationLogs } from '../data/mockData';

const pointInPolygon = (point: { x: number; z: number }, polygon: { x: number; z: number }[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    if (((zi > point.z) !== (zj > point.z)) &&
        (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

const lineIntersectsPolygon = (
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  polygon: { x: number; z: number }[]
): boolean => {
  for (let i = 0; i < polygon.length; i++) {
    const p3 = polygon[i];
    const p4 = polygon[(i + 1) % polygon.length];
    
    const d1 = (p4.x - p3.x) * (p1.z - p3.z) - (p4.z - p3.z) * (p1.x - p3.x);
    const d2 = (p4.x - p3.x) * (p2.z - p3.z) - (p4.z - p3.z) * (p2.x - p3.x);
    const d3 = (p2.x - p1.x) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.x - p1.x);
    const d4 = (p2.x - p1.x) * (p4.z - p1.z) - (p2.z - p1.z) * (p4.x - p1.x);
    
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
  }
  return pointInPolygon(p1, polygon) || pointInPolygon(p2, polygon);
};

const useStore = create<AppState & AppActions>((set, get) => ({
  warehouse,
  shelves,
  locations,
  forbiddenZones,
  tasks,
  selectedLocation: null,
  selectedTask: null,
  filters: {
    searchKeyword: '',
    zones: [],
    statuses: [],
    artworkTypes: [],
    tempRange: [15, 30],
    humidityRange: [30, 80],
    showAlertsOnly: false
  },
  viewMode: 'overview',
  showHeatmap: false,
  showRoutes: false,
  operationLogs,

  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSelectedTask: (task) => set({ selectedTask: task }),
  
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),
  toggleRoutes: () => set((state) => ({ showRoutes: !state.showRoutes })),
  
  createTask: (taskData) => {
    const newTask: Task = {
      ...taskData,
      id: `TASK-${Date.now()}`,
      createTime: new Date().toISOString(),
      operationLog: [{
        action: '任务创建',
        time: new Date().toISOString(),
        operator: taskData.operator,
        remark: '新任务'
      }]
    };
    set((state) => ({ tasks: [...state.tasks, newTask] }));
    get().addOperationLog('创建任务', taskData.operator, `任务ID: ${newTask.id}`);
  },
  
  updateTaskStatus: (taskId, status, operator, remark) => {
    set((state) => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            status,
            operationLog: [...t.operationLog, {
              action: `状态更新: ${status}`,
              time: new Date().toISOString(),
              operator,
              remark
            }]
          };
        }
        return t;
      })
    }));
    get().addOperationLog(`更新任务状态`, operator, `任务 ${taskId}: ${status}`);
  },
  
  cancelTask: (taskId, operator, remark) => {
    get().updateTaskStatus(taskId, 'cancelled', operator, remark || '任务取消');
  },
  
  addOperationLog: (action, operator, remark) => {
    set((state) => ({
      operationLogs: [{
        action,
        time: new Date().toISOString(),
        operator,
        remark
      }, ...state.operationLogs.slice(0, 99)]
    }));
  },
  
  getFilteredLocations: () => {
    const { locations, filters } = get();
    return locations.filter(loc => {
      if (filters.searchKeyword) {
        const keyword = filters.searchKeyword.toLowerCase();
        const matchCode = loc.code.toLowerCase().includes(keyword);
        const matchBox = loc.box?.code.toLowerCase().includes(keyword);
        const matchArtwork = loc.box?.artworks.some(a => 
          a.name.toLowerCase().includes(keyword) || 
          a.artist.toLowerCase().includes(keyword) ||
          a.accessionNumber.toLowerCase().includes(keyword)
        );
        if (!matchCode && !matchBox && !matchArtwork) return false;
      }
      
      if (filters.zones.length > 0 && !filters.zones.includes(loc.zone)) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(loc.status)) return false;
      
      if (filters.artworkTypes.length > 0) {
        if (!loc.box?.artworks.some(a => filters.artworkTypes.includes(a.type))) return false;
      }
      
      if (loc.sensor) {
        if (loc.sensor.temperature < filters.tempRange[0] || 
            loc.sensor.temperature > filters.tempRange[1]) return false;
        if (loc.sensor.humidity < filters.humidityRange[0] || 
            loc.sensor.humidity > filters.humidityRange[1]) return false;
      }
      
      if (filters.showAlertsOnly && loc.sensor?.alerts.length === 0) return false;
      
      return true;
    });
  },
  
  planRoute: (fromId, toId) => {
    const { locations } = get();
    const fromLoc = locations.find(l => l.id === fromId);
    const toLoc = locations.find(l => l.id === toId);
    
    if (!fromLoc || !toLoc) return [];
    
    const route: RoutePoint[] = [
      { x: fromLoc.worldPosition.x, y: 0.1, z: fromLoc.worldPosition.z },
      { x: fromLoc.worldPosition.x, y: 0.1, z: fromLoc.worldPosition.z + 2 },
      { x: toLoc.worldPosition.x, y: 0.1, z: fromLoc.worldPosition.z + 2 },
      { x: toLoc.worldPosition.x, y: 0.1, z: toLoc.worldPosition.z },
      { x: toLoc.worldPosition.x, y: toLoc.worldPosition.y, z: toLoc.worldPosition.z }
    ];
    
    return route;
  },
  
  checkForbiddenCrossing: (route) => {
    const { forbiddenZones } = get();
    for (const zone of forbiddenZones) {
      for (let i = 0; i < route.length - 1; i++) {
        if (lineIntersectsPolygon(
          { x: route[i].x, z: route[i].z },
          { x: route[i + 1].x, z: route[i + 1].z },
          zone.points
        )) {
          return true;
        }
      }
    }
    return false;
  },
  
  detectDuplicateLocations: () => {
    const { locations } = get();
    const boxLocationMap = new Map<string, string[]>();
    
    locations.forEach(loc => {
      if (loc.box) {
        const existing = boxLocationMap.get(loc.box.id) || [];
        existing.push(loc.id);
        boxLocationMap.set(loc.box.id, existing);
      }
    });
    
    const duplicates: string[] = [];
    boxLocationMap.forEach((locIds, boxId) => {
      if (locIds.length > 1) {
        duplicates.push(`箱子 ${boxId} 被分配到多个库位: ${locIds.join(', ')}`);
      }
    });
    
    return duplicates;
  },
  
  detectTemperatureAlerts: () => {
    const { locations } = get();
    return locations.filter(loc => 
      loc.sensor?.alerts.some(a => a.type.includes('temp'))
    );
  },
  
  detectHumidityAlerts: () => {
    const { locations } = get();
    return locations.filter(loc => 
      loc.sensor?.alerts.some(a => a.type.includes('humid'))
    );
  }
}));

export default useStore;
