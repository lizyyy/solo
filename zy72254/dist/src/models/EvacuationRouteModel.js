"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvacuationRoute = createEvacuationRoute;
exports.calculateEstimatedTime = calculateEstimatedTime;
exports.addObstructionToRoute = addObstructionToRoute;
exports.toggleRouteActive = toggleRouteActive;
const idGenerator_1 = require("../utils/idGenerator");
function createEvacuationRoute(params) {
    const now = Date.now();
    return {
        id: (0, idGenerator_1.generateRouteId)(),
        name: params.name,
        waypoints: params.waypoints,
        obstructions: params.obstructions,
        isActive: true,
        width: params.width ?? 1.5,
        maxCapacity: params.maxCapacity ?? 50,
        estimatedTime: params.estimatedTime ?? calculateEstimatedTime(params.waypoints)
    };
}
function calculateEstimatedTime(waypoints, walkingSpeed = 1.2) {
    if (waypoints.length < 2)
        return 0;
    let totalDistance = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const dx = waypoints[i].x - waypoints[i - 1].x;
        const dy = waypoints[i].y - waypoints[i - 1].y;
        const dz = waypoints[i].z - waypoints[i - 1].z;
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return Math.ceil(totalDistance / walkingSpeed);
}
function addObstructionToRoute(route, obstructionId) {
    if (route.obstructions.includes(obstructionId)) {
        return route;
    }
    return {
        ...route,
        obstructions: [...route.obstructions, obstructionId]
    };
}
function toggleRouteActive(route) {
    return {
        ...route,
        isActive: !route.isActive
    };
}
//# sourceMappingURL=EvacuationRouteModel.js.map