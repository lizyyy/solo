import { Obstruction, DisplayMode, CADLayerInfo, RangefinderRecord, Point3D, EvacuationRoute } from '../types';
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
export declare class DisplayService {
    private obstructions;
    private routes;
    private displayMode;
    setObstructions(obstructions: Obstruction[]): void;
    setRoutes(routes: EvacuationRoute[]): void;
    setDisplayMode(mode: DisplayMode): void;
    getDisplayMode(): DisplayMode;
    render3D(): DisplayItem3D[];
    renderChart(): ChartData;
    getSelectionDetail(itemId: string, itemType: 'obstruction' | 'route'): SelectionDetail | null;
    getSourceTrace(obstructionId: string): {
        cadLayers: CADLayerInfo[];
        rangefinderRecords: RangefinderRecord[];
        nameHistory: Array<{
            name: string;
            source: string;
            timestamp: number;
            operator: string;
        }>;
    };
    verifyDisplaySource(item: DisplayItem3D | ChartDataPoint): {
        valid: boolean;
        sourceType: string;
        sourceDetails: string[];
    };
    private obstructionTo3DItem;
    private routeTo3DItems;
    private obstructionToSelectionDetail;
    private routeToSelectionDetail;
    private calculateDangerScore;
    private getHazardColor;
    private calculateSize;
}
