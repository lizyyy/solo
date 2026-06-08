"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplayService = void 0;
const types_1 = require("../types");
const ObstructionModel_1 = require("../models/ObstructionModel");
const BoundaryRules_1 = require("./BoundaryRules");
class DisplayService {
    constructor() {
        this.obstructions = new Map();
        this.routes = new Map();
        this.displayMode = types_1.DisplayMode.LIST;
    }
    setObstructions(obstructions) {
        this.obstructions.clear();
        for (const obs of obstructions) {
            this.obstructions.set(obs.id, obs);
        }
    }
    setRoutes(routes) {
        this.routes.clear();
        for (const route of routes) {
            this.routes.set(route.id, route);
        }
    }
    setDisplayMode(mode) {
        this.displayMode = mode;
    }
    getDisplayMode() {
        return this.displayMode;
    }
    render3D() {
        const items = [];
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
    renderChart() {
        const dataPoints = [];
        let totalHigh = 0, totalMedium = 0, totalLow = 0;
        for (const obs of this.obstructions.values()) {
            if (obs.status === 'duplicate')
                continue;
            const latestCAD = obs.cadLayers[obs.cadLayers.length - 1];
            const latestRF = obs.rangefinderRecords[obs.rangefinderRecords.length - 1];
            const sourceRef = {
                type: latestRF ? 'rangefinder' : latestCAD ? 'cad' : 'manual',
                cadLayerName: latestCAD?.layerName,
                rangefinderId: latestRF?.id
            };
            switch (obs.hazardLevel) {
                case 'high':
                    totalHigh++;
                    break;
                case 'medium':
                    totalMedium++;
                    break;
                case 'low':
                    totalLow++;
                    break;
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
    getSelectionDetail(itemId, itemType) {
        if (itemType === 'obstruction') {
            const obs = this.obstructions.get(itemId);
            if (!obs)
                return null;
            return this.obstructionToSelectionDetail(obs);
        }
        else {
            const route = this.routes.get(itemId);
            if (!route)
                return null;
            return this.routeToSelectionDetail(route);
        }
    }
    getSourceTrace(obstructionId) {
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
    verifyDisplaySource(item) {
        const details = [];
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
    obstructionTo3DItem(obs) {
        const hasConflict = !!obs.conflictInfo;
        const allNames = (0, ObstructionModel_1.getAllNames)(obs);
        return {
            id: obs.id,
            type: 'obstruction',
            position: obs.position,
            label: obs.canonicalName || obs.aliases[0]?.name || '未命名',
            color: hasConflict ? '#ff6b6b' : this.getHazardColor(obs.hazardLevel),
            size: this.calculateSize(obs),
            opacity: hasConflict ? 0.8 : 1.0,
            geometry: obs.geometry,
            sourceRef: {
                type: obs.rangefinderRecords.length > 0 ? 'rangefinder' : 'cad',
                cadLayers: obs.cadLayers,
                rangefinderRecords: obs.rangefinderRecords,
                conflictInfo: obs.conflictInfo ? (0, BoundaryRules_1.explainConflict)(obs.conflictInfo) : undefined
            },
            hasConflict,
            conflictDescription: obs.conflictInfo ? (0, BoundaryRules_1.explainConflict)(obs.conflictInfo) : undefined,
            allNames
        };
    }
    routeTo3DItems(route) {
        const items = [];
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
    obstructionToSelectionDetail(obs) {
        return {
            itemId: obs.id,
            itemType: 'obstruction',
            displayName: obs.canonicalName || obs.aliases[0]?.name || '未命名',
            allNames: (0, ObstructionModel_1.getAllNames)(obs),
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
            conflictDescription: obs.conflictInfo ? (0, BoundaryRules_1.explainConflict)(obs.conflictInfo) : undefined,
            conflictingObstructionIds: obs.conflictInfo?.conflictingObstructionIds,
            canResolve: true
        };
    }
    routeToSelectionDetail(route) {
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
    calculateDangerScore(obs) {
        let score = 0;
        switch (obs.hazardLevel) {
            case 'high':
                score = 100;
                break;
            case 'medium':
                score = 60;
                break;
            case 'low':
                score = 20;
                break;
        }
        if (obs.isOnEvacuationRoute)
            score += 20;
        if (obs.conflictInfo)
            score += 10;
        return Math.min(score, 100);
    }
    getHazardColor(level) {
        switch (level) {
            case 'high': return '#e74c3c';
            case 'medium': return '#f39c12';
            case 'low': return '#27ae60';
        }
    }
    calculateSize(obs) {
        const { boundingBox } = obs;
        const width = boundingBox.maxX - boundingBox.minX;
        const height = boundingBox.maxY - boundingBox.minY;
        return Math.max(width, height, 1);
    }
}
exports.DisplayService = DisplayService;
//# sourceMappingURL=DisplayService.js.map