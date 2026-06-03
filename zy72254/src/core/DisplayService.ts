import {
  Obstruction,
  DisplayMode,
  CADLayerInfo,
  RangefinderRecord,
  Point3D,
  EvacuationRoute
} from '../types';
import { getAllNames } from '../models/ObstructionModel';
import { explainConflict } from './BoundaryRules';

export interface DisplayItem3D {
  id: string;
  type: 'obstruction' | 'route' | 'waypoint';
  position: Point3D;
  label: string;
  color: string;
  size: number;
  opacity: number;
  geometry?: Point3D[];
  sourceRef: {
    type: 'cad' | 'rangefinder' | 'manual';
    cadLayers?: CADLayerInfo[];
    rangefinderRecords?: RangefinderRecord[];
    conflictInfo?: string;
  };
  hasConflict: boolean;
  conflictDescription?: string;
  allNames: string[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color: string;
  sourceRef: {
    type: 'cad' | 'rangefinder' | 'manual';
    cadLayerName?: string;
    rangefinderId?: string;
  };
}

export interface ChartData {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  dataPoints: ChartDataPoint[];
  dataSource: string;
}

export interface SelectionDetail {
  itemId: string;
  itemType: 'obstruction' | 'route';
  displayName: string;
  allNames: string[];
  sourceCADLayers: Array<{
    layerName: string;
    originalName: string;
    importSource: string;
    importTimestamp: number;
  }>;
  sourceRangefinderRecords: Array<{
    id: string;
    distance: number;
    measuredAt: number;
    measuredBy: string;
    notes?: string;
  }>;
  hasConflict: boolean;
  conflictType?: string;
  conflictDescription?: string;
  conflictingObstructionIds?: string[];
  canResolve: boolean;
}

export class DisplayService {
  private obstructions: Map<string, Obstruction> = new Map();
  private routes: Map<string, EvacuationRoute> = new Map();
  private displayMode: DisplayMode = DisplayMode.LIST;

  setObstructions(obstructions: Obstruction[]): void {
    this.obstructions.clear();
    for (const obs of obstructions) {
      this.obstructions.set(obs.id, obs);
    }
  }

  setRoutes(routes: EvacuationRoute[]): void {
    this.routes.clear();
    for (const route of routes) {
      this.routes.set(route.id, route);
    }
  }

  setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
  }

  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  render3D(): DisplayItem3D[] {
    const items: DisplayItem3D[] = [];

    for (const obs of this.obstructions.values()) {
      items.push(this.obstructionTo3DItem(obs));
    }

    for (const route of this.routes.values()) {
      if (route.isActive) {
        items.push(...this.routeTo3DItems(route));
      }
    }

    return items;
  }

  renderChart(): ChartData {
    const dataPoints: ChartDataPoint[] = [];
    let totalHigh = 0, totalMedium = 0, totalLow = 0;

    for (const obs of this.obstructions.values()) {
      if (obs.status === 'duplicate') continue;

      const latestCAD = obs.cadLayers[obs.cadLayers.length - 1];
      const latestRF = obs.rangefinderRecords[obs.rangefinderRecords.length - 1];

      const sourceRef: ChartDataPoint['sourceRef'] = {
        type: latestRF ? 'rangefinder' : latestCAD ? 'cad' : 'manual',
        cadLayerName: latestCAD?.layerName,
        rangefinderId: latestRF?.id
      };

      switch (obs.hazardLevel) {
        case 'high': totalHigh++; break;
        case 'medium': totalMedium++; break;
        case 'low': totalLow++; break;
      }

      dataPoints.push({
        label: obs.canonicalName || obs.aliases[0]?.name || '未命名',
        value: this.calculateDangerScore(obs),
        color: this.getHazardColor(obs.hazardLevel),
        sourceRef
      });
    }

    return {
      title: '障碍物危险等级分布',
      xAxisLabel: '障碍物',
      yAxisLabel: '危险评分',
      dataPoints,
      dataSource: `共${this.obstructions.size}个障碍物，其中高危${totalHigh}个、中危${totalMedium}个、低危${totalLow}个`
    };
  }

  getSelectionDetail(itemId: string, itemType: 'obstruction' | 'route'): SelectionDetail | null {
    if (itemType === 'obstruction') {
      const obs = this.obstructions.get(itemId);
      if (!obs) return null;
      return this.obstructionToSelectionDetail(obs);
    } else {
      const route = this.routes.get(itemId);
      if (!route) return null;
      return this.routeToSelectionDetail(route);
    }
  }

  getSourceTrace(obstructionId: string): {
    cadLayers: CADLayerInfo[];
    rangefinderRecords: RangefinderRecord[];
    nameHistory: Array<{ name: string; source: string; timestamp: number; operator: string }>;
  } {
    const obs = this.obstructions.get(obstructionId);
    if (!obs) {
      return { cadLayers: [], rangefinderRecords: [], nameHistory: [] };
    }

    return {
      cadLayers: [...obs.cadLayers],
      rangefinderRecords: [...obs.rangefinderRecords],
      nameHistory: obs.aliases.map(a => ({
        name: a.name,
        source: a.source,
        timestamp: a.timestamp,
        operator: a.operator
      }))
    };
  }

  verifyDisplaySource(item: DisplayItem3D | ChartDataPoint): {
    valid: boolean;
    sourceType: string;
    sourceDetails: string[];
  } {
    const details: string[] = [];

    if ('cadLayers' in item.sourceRef && item.sourceRef.cadLayers) {
      for (const layer of item.sourceRef.cadLayers) {
        details.push(`CAD图层: ${layer.layerName} (原始: ${layer.originalName})`);
      }
    }

    if ('rangefinderRecords' in item.sourceRef && item.sourceRef.rangefinderRecords) {
      for (const record of item.sourceRef.rangefinderRecords) {
        details.push(`测距仪记录: ${record.distance}m (测量人: ${record.measuredBy})`);
      }
    }

    if ('cadLayerName' in item.sourceRef && item.sourceRef.cadLayerName) {
      details.push(`CAD图层: ${item.sourceRef.cadLayerName}`);
    }

    if ('rangefinderId' in item.sourceRef && item.sourceRef.rangefinderId) {
      details.push(`测距仪记录ID: ${item.sourceRef.rangefinderId}`);
    }

    return {
      valid: details.length > 0,
      sourceType: item.sourceRef.type,
      sourceDetails: details
    };
  }

  private obstructionTo3DItem(obs: Obstruction): DisplayItem3D {
    const hasConflict = !!obs.conflictInfo;
    const allNames = getAllNames(obs);

    return {
      id: obs.id,
      type: 'obstruction',
      position: obs.position,
      label: obs.canonicalName || obs.aliases[0]?.name || '未命名',
      color: hasConflict ? '#ff6b6b' : this.getHazardColor(obs.hazardLevel),
      size: this.calculateSize(obs),
      opacity: hasConflict ? 0.8 : 1.0,
      geometry: obs.geometry as Point3D[],
      sourceRef: {
        type: obs.rangefinderRecords.length > 0 ? 'rangefinder' : 'cad',
        cadLayers: obs.cadLayers,
        rangefinderRecords: obs.rangefinderRecords,
        conflictInfo: obs.conflictInfo ? explainConflict(obs.conflictInfo) : undefined
      },
      hasConflict,
      conflictDescription: obs.conflictInfo ? explainConflict(obs.conflictInfo) : undefined,
      allNames
    };
  }

  private routeTo3DItems(route: EvacuationRoute): DisplayItem3D[] {
    const items: DisplayItem3D[] = [];

    route.waypoints.forEach((wp, index) => {
      items.push({
        id: `${route.id}_wp_${index}`,
        type: 'waypoint',
        position: wp,
        label: `${route.name} - 点位${index + 1}`,
        color: '#4ecdc4',
        size: 0.5,
        opacity: 0.9,
        sourceRef: {
          type: 'manual'
        },
        hasConflict: false,
        allNames: [route.name]
      });
    });

    return items;
  }

  private obstructionToSelectionDetail(obs: Obstruction): SelectionDetail {
    return {
      itemId: obs.id,
      itemType: 'obstruction',
      displayName: obs.canonicalName || obs.aliases[0]?.name || '未命名',
      allNames: getAllNames(obs),
      sourceCADLayers: obs.cadLayers.map(l => ({
        layerName: l.layerName,
        originalName: l.originalName,
        importSource: l.importSource,
        importTimestamp: l.importTimestamp
      })),
      sourceRangefinderRecords: obs.rangefinderRecords.map(r => ({
        id: r.id,
        distance: r.distance,
        measuredAt: r.measuredAt,
        measuredBy: r.measuredBy,
        notes: r.notes
      })),
      hasConflict: !!obs.conflictInfo,
      conflictType: obs.conflictInfo?.conflictType,
      conflictDescription: obs.conflictInfo ? explainConflict(obs.conflictInfo) : undefined,
      conflictingObstructionIds: obs.conflictInfo?.conflictingObstructionIds,
      canResolve: true
    };
  }

  private routeToSelectionDetail(route: EvacuationRoute): SelectionDetail {
    return {
      itemId: route.id,
      itemType: 'route',
      displayName: route.name,
      allNames: [route.name],
      sourceCADLayers: [],
      sourceRangefinderRecords: [],
      hasConflict: false,
      canResolve: false
    };
  }

  private calculateDangerScore(obs: Obstruction): number {
    let score = 0;
    switch (obs.hazardLevel) {
      case 'high': score = 100; break;
      case 'medium': score = 60; break;
      case 'low': score = 20; break;
    }
    if (obs.isOnEvacuationRoute) score += 20;
    if (obs.conflictInfo) score += 10;
    return Math.min(score, 100);
  }

  private getHazardColor(level: 'low' | 'medium' | 'high'): string {
    switch (level) {
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      case 'low': return '#27ae60';
    }
  }

  private calculateSize(obs: Obstruction): number {
    const { boundingBox } = obs;
    const width = boundingBox.maxX - boundingBox.minX;
    const height = boundingBox.maxY - boundingBox.minY;
    return Math.max(width, height, 1);
  }
}
