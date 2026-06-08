export interface Point3D {
    x: number;
    y: number;
    z: number;
}
export interface Point2D {
    x: number;
    y: number;
}
export type Coordinate = Point2D | Point3D;
export interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
}
export declare enum ObstructionStatus {
    PENDING_REVIEW = "pending_review",
    CONFIRMED = "confirmed",
    MERGED = "merged",
    RESOLVED = "resolved",
    DUPLICATE = "duplicate"
}
export declare enum ConflictResolution {
    KEEP_FIRST = "keep_first",
    KEEP_SECOND = "keep_second",
    MERGE = "merge",
    MANUAL = "manual"
}
export declare enum DisplayMode {
    VIEW_3D = "3d",
    CHART = "chart",
    LIST = "list"
}
export declare enum ProcessStage {
    CAD_IMPORT = "cad_import",
    RANGEFINDER_SUPPLEMENT = "rangefinder_supplement",
    VIEW_3D_UPDATE = "view_3d_update",
    COMPLETED = "completed"
}
export interface CADLayerInfo {
    layerName: string;
    originalName: string;
    color?: string;
    lineType?: string;
    importTimestamp: number;
    importSource: string;
}
export interface RangefinderRecord {
    id: string;
    obstructionId: string;
    measuredAt: number;
    measuredBy: string;
    distance: number;
    fromPoint: Point3D;
    toPoint: Point3D;
    notes?: string;
    accuracy?: number;
}
export interface ObstructionAlias {
    name: string;
    source: 'cad' | 'rangefinder' | 'manual';
    timestamp: number;
    operator: string;
}
export interface Obstruction {
    id: string;
    canonicalName: string | null;
    aliases: ObstructionAlias[];
    position: Point3D;
    boundingBox: BoundingBox;
    geometry: Coordinate[];
    cadLayers: CADLayerInfo[];
    rangefinderRecords: RangefinderRecord[];
    status: ObstructionStatus;
    createdAt: number;
    updatedAt: number;
    isOnEvacuationRoute: boolean;
    hazardLevel: 'low' | 'medium' | 'high';
    notes?: string;
    conflictInfo?: ConflictInfo;
}
export interface ConflictInfo {
    conflictType: 'duplicate_name' | 'overlapping_geometry' | 'inconsistent_attributes';
    conflictingObstructionIds: string[];
    detectedAt: number;
    detectedBy: string;
    resolution?: ConflictResolution;
    resolvedAt?: number;
    resolvedBy?: string;
    resolutionNotes?: string;
}
export interface EvacuationRoute {
    id: string;
    name: string;
    waypoints: Point3D[];
    obstructions: string[];
    isActive: boolean;
    width: number;
    maxCapacity: number;
    estimatedTime: number;
}
export interface HistoryRecord<T = unknown> {
    id: string;
    entityType: 'obstruction' | 'cad_layer' | 'rangefinder' | 'route';
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'merge' | 'import';
    fieldName?: string;
    oldValue: T;
    newValue: T;
    operator: string;
    timestamp: number;
    notes?: string;
    rollbackAvailable: boolean;
}
export interface ImportSummary {
    imported: number;
    updated: number;
    skipped: number;
    conflicts: number;
    totalProcessed: number;
}
export interface UserFriendlyError {
    code: string;
    message: string;
    suggestion: string;
    details?: Record<string, unknown>;
    timestamp: number;
}
