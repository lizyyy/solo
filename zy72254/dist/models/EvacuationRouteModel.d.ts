import { EvacuationRoute, Point3D } from '../types';
export declare function createEvacuationRoute(params: {
    name: string;
    waypoints: Point3D[];
    obstructions: string[];
    width?: number;
    maxCapacity?: number;
    estimatedTime?: number;
}): EvacuationRoute;
export declare function calculateEstimatedTime(waypoints: Point3D[], walkingSpeed?: number): number;
export declare function addObstructionToRoute(route: EvacuationRoute, obstructionId: string): EvacuationRoute;
export declare function toggleRouteActive(route: EvacuationRoute): EvacuationRoute;
