import { Obstruction, CADLayerInfo, ImportSummary, Coordinate, Point3D } from '../types';
export interface RawCADLayer {
    layerName: string;
    originalName: string;
    color?: string;
    lineType?: string;
    geometry: Coordinate[];
    position?: Point3D;
    isOnEvacuationRoute?: boolean;
    hazardLevel?: 'low' | 'medium' | 'high';
    notes?: string;
}
export interface ImportSession {
    id: string;
    source: string;
    importTimestamp: number;
    operator: string;
    processedLayers: Set<string>;
    existingObstructions: Map<string, Obstruction>;
}
export declare function createImportSession(source: string, operator: string, existingObstructions?: Obstruction[]): ImportSession;
export declare function findMatchingObstruction(rawLayer: RawCADLayer, existingObstructions: Obstruction[]): Obstruction | null;
export declare function importCADLayer(rawLayer: RawCADLayer, session: ImportSession, autoMerge?: boolean): {
    obstruction: Obstruction;
    action: 'created' | 'updated' | 'skipped';
    reason?: string;
};
export declare function batchImportCADLayers(rawLayers: RawCADLayer[], session: ImportSession, autoMerge?: boolean): {
    obstructions: Obstruction[];
    summary: ImportSummary;
    actions: Array<{
        layerName: string;
        action: string;
        reason?: string;
        obstructionId: string;
    }>;
};
export declare function reimportSameLayers(rawLayers: RawCADLayer[], existingObstructions: Obstruction[], operator: string, source: string): {
    obstructions: Obstruction[];
    summary: ImportSummary;
    message: string;
};
export declare function getImportSourceIdentifier(source: string, timestamp: number): string;
export declare function isLayerFromImport(cadLayer: CADLayerInfo, source: string, importTimestamp?: number): boolean;
