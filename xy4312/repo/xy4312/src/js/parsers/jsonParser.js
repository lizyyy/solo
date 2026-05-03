/**
 * JSON地图解析模块
 * 负责解析库区地图JSON数据，包括边界、货架、通道、禁行区等
 */

export class JSONMapParser {
    constructor(options = {}) {
        this.options = {
            validateBounds: options.validateBounds !== false,
            ...options
        };
    }

    parse(jsonText) {
        const result = {
            valid: false,
            mapData: null,
            errors: [],
            warnings: []
        };

        try {
            const mapData = JSON.parse(jsonText);
            return this.validateAndNormalize(mapData);
        } catch (error) {
            result.errors.push(`JSON parse error: ${error.message}`);
            return result;
        }
    }

    validateAndNormalize(mapData) {
        const result = {
            valid: true,
            mapData: {
                id: mapData.id || 'warehouse_map',
                name: mapData.name || 'Unnamed Warehouse',
                version: mapData.version || '1.0',
                description: mapData.description || '',
                bounds: null,
                zones: [],
                aisles: [],
                racks: [],
                obstacles: [],
                restrictedAreas: [],
                metadata: mapData.metadata || {}
            },
            errors: [],
            warnings: []
        };

        if (!mapData.bounds && !mapData.zones && !mapData.aisles) {
            result.errors.push('Map must contain at least bounds, zones, or aisles');
            result.valid = false;
            return result;
        }

        if (mapData.bounds) {
            const boundsValidation = this.validateBounds(mapData.bounds);
            if (boundsValidation.valid) {
                result.mapData.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors);
            }
        }

        if (mapData.zones && Array.isArray(mapData.zones)) {
            mapData.zones.forEach((zone, index) => {
                const zoneValidation = this.validateZone(zone, index);
                if (zoneValidation.valid) {
                    result.mapData.zones.push(zoneValidation.zone);
                } else {
                    result.errors.push(...zoneValidation.errors);
                }
            });
        }

        if (mapData.aisles && Array.isArray(mapData.aisles)) {
            mapData.aisles.forEach((aisle, index) => {
                const aisleValidation = this.validateAisle(aisle, index);
                if (aisleValidation.valid) {
                    result.mapData.aisles.push(aisleValidation.aisle);
                } else {
                    result.errors.push(...aisleValidation.errors);
                }
            });
        }

        if (mapData.racks && Array.isArray(mapData.racks)) {
            mapData.racks.forEach((rack, index) => {
                const rackValidation = this.validateRack(rack, index);
                if (rackValidation.valid) {
                    result.mapData.racks.push(rackValidation.rack);
                } else {
                    result.errors.push(...rackValidation.errors);
                }
            });
        }

        if (mapData.obstacles && Array.isArray(mapData.obstacles)) {
            mapData.obstacles.forEach((obstacle, index) => {
                const obstacleValidation = this.validateObstacle(obstacle, index);
                if (obstacleValidation.valid) {
                    result.mapData.obstacles.push(obstacleValidation.obstacle);
                } else {
                    result.errors.push(...obstacleValidation.errors);
                }
            });
        }

        if (mapData.restrictedAreas && Array.isArray(mapData.restrictedAreas)) {
            mapData.restrictedAreas.forEach((area, index) => {
                const areaValidation = this.validateRestrictedArea(area, index);
                if (areaValidation.valid) {
                    result.mapData.restrictedAreas.push(areaValidation.area);
                } else {
                    result.errors.push(...areaValidation.errors);
                }
            });
        }

        if (!result.mapData.bounds && result.mapData.zones.length > 0) {
            result.mapData.bounds = this.calculateBoundsFromZones(result.mapData.zones);
            result.warnings.push('Map bounds calculated from zones');
        }

        if (!result.mapData.bounds && result.mapData.aisles.length > 0) {
            result.mapData.bounds = this.calculateBoundsFromAisles(result.mapData.aisles);
            result.warnings.push('Map bounds calculated from aisles');
        }

        if (this.options.validateBounds && result.mapData.bounds) {
            result = this.validateElementsAgainstBounds(result);
        }

        result.valid = result.errors.length === 0;

        return result;
    }

    validateBounds(bounds) {
        const result = {
            valid: true,
            bounds: {},
            errors: []
        };

        const requiredFields = ['minX', 'maxX', 'minY', 'maxY'];
        const missingFields = requiredFields.filter(field => !(field in bounds));

        if (missingFields.length > 0) {
            result.errors.push(`Bounds missing required fields: ${missingFields.join(', ')}`);
            result.valid = false;
            return result;
        }

        const minX = parseFloat(bounds.minX);
        const maxX = parseFloat(bounds.maxX);
        const minY = parseFloat(bounds.minY);
        const maxY = parseFloat(bounds.maxY);
        const minZ = bounds.minZ !== undefined ? parseFloat(bounds.minZ) : 0;
        const maxZ = bounds.maxZ !== undefined ? parseFloat(bounds.maxZ) : 5;

        if (isNaN(minX) || isNaN(maxX) || isNaN(minY) || isNaN(maxY)) {
            result.errors.push('Bounds contain non-numeric values');
            result.valid = false;
            return result;
        }

        if (minX >= maxX) {
            result.errors.push('Bounds minX must be less than maxX');
            result.valid = false;
        }

        if (minY >= maxY) {
            result.errors.push('Bounds minY must be less than maxY');
            result.valid = false;
        }

        if (minZ >= maxZ) {
            result.errors.push('Bounds minZ must be less than maxZ');
            result.valid = false;
        }

        result.bounds = {
            minX, maxX, minY, maxY, minZ, maxZ
        };

        return result;
    }

    validateZone(zone, index) {
        const result = {
            valid: true,
            zone: {},
            errors: []
        };

        if (!zone.id && !zone.name) {
            result.errors.push(`Zone ${index} must have id or name`);
            result.valid = false;
            return result;
        }

        if (!zone.polygon && !zone.bounds) {
            result.errors.push(`Zone ${index} must have polygon or bounds`);
            result.valid = false;
            return result;
        }

        result.zone = {
            id: zone.id || `zone_${index}`,
            name: zone.name || `Zone ${index}`,
            type: zone.type || 'general',
            color: zone.color || this.getZoneColor(zone.type),
            description: zone.description || '',
            properties: zone.properties || {}
        };

        if (zone.polygon) {
            const polygonValidation = this.validatePolygon(zone.polygon);
            if (polygonValidation.valid) {
                result.zone.polygon = polygonValidation.polygon;
                result.zone.bounds = this.calculateBoundsFromPolygon(polygonValidation.polygon);
            } else {
                result.errors.push(...polygonValidation.errors.map(e => `Zone ${index}: ${e}`));
                result.valid = false;
            }
        } else if (zone.bounds) {
            const boundsValidation = this.validateBounds(zone.bounds);
            if (boundsValidation.valid) {
                result.zone.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors.map(e => `Zone ${index}: ${e}`));
                result.valid = false;
            }
        }

        return result;
    }

    validateAisle(aisle, index) {
        const result = {
            valid: true,
            aisle: {},
            errors: []
        };

        if (!aisle.id && !aisle.name) {
            result.errors.push(`Aisle ${index} must have id or name`);
            result.valid = false;
            return result;
        }

        result.aisle = {
            id: aisle.id || `aisle_${index}`,
            name: aisle.name || `Aisle ${index}`,
            type: aisle.type || 'main',
            width: aisle.width || 3,
            direction: aisle.direction || 'horizontal',
            color: aisle.color || '#4a90d9',
            description: aisle.description || '',
            properties: aisle.properties || {}
        };

        if (aisle.bounds) {
            const boundsValidation = this.validateBounds(aisle.bounds);
            if (boundsValidation.valid) {
                result.aisle.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors.map(e => `Aisle ${index}: ${e}`));
                result.valid = false;
            }
        } else if (aisle.polygon) {
            const polygonValidation = this.validatePolygon(aisle.polygon);
            if (polygonValidation.valid) {
                result.aisle.polygon = polygonValidation.polygon;
                result.aisle.bounds = this.calculateBoundsFromPolygon(polygonValidation.polygon);
            } else {
                result.errors.push(...polygonValidation.errors.map(e => `Aisle ${index}: ${e}`));
                result.valid = false;
            }
        } else if (aisle.start && aisle.end) {
            const lineValidation = this.validateLine(aisle.start, aisle.end);
            if (lineValidation.valid) {
                result.aisle.start = lineValidation.start;
                result.aisle.end = lineValidation.end;
                result.aisle.bounds = this.calculateBoundsFromLine(lineValidation.start, lineValidation.end, result.aisle.width);
            } else {
                result.errors.push(...lineValidation.errors.map(e => `Aisle ${index}: ${e}`));
                result.valid = false;
            }
        } else {
            result.errors.push(`Aisle ${index} must have bounds, polygon, or start/end points`);
            result.valid = false;
        }

        return result;
    }

    validateRack(rack, index) {
        const result = {
            valid: true,
            rack: {},
            errors: []
        };

        if (!rack.id && !rack.name) {
            result.errors.push(`Rack ${index} must have id or name`);
            result.valid = false;
            return result;
        }

        result.rack = {
            id: rack.id || `rack_${index}`,
            name: rack.name || `Rack ${index}`,
            type: rack.type || 'standard',
            levels: rack.levels || 5,
            height: rack.height || 5,
            color: rack.color || '#8b7355',
            description: rack.description || '',
            properties: rack.properties || {}
        };

        if (rack.bounds) {
            const boundsValidation = this.validateBounds(rack.bounds);
            if (boundsValidation.valid) {
                result.rack.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors.map(e => `Rack ${index}: ${e}`));
                result.valid = false;
            }
        } else if (rack.position) {
            const positionValidation = this.validatePosition(rack.position);
            if (positionValidation.valid) {
                result.rack.position = positionValidation.position;
                result.rack.bounds = {
                    minX: positionValidation.position.x - 0.5,
                    maxX: positionValidation.position.x + 0.5,
                    minY: positionValidation.position.y - 2,
                    maxY: positionValidation.position.y + 2,
                    minZ: 0,
                    maxZ: result.rack.height
                };
            } else {
                result.errors.push(...positionValidation.errors.map(e => `Rack ${index}: ${e}`));
                result.valid = false;
            }
        } else {
            result.errors.push(`Rack ${index} must have bounds or position`);
            result.valid = false;
        }

        return result;
    }

    validateObstacle(obstacle, index) {
        const result = {
            valid: true,
            obstacle: {},
            errors: []
        };

        if (!obstacle.id && !obstacle.name) {
            result.errors.push(`Obstacle ${index} must have id or name`);
            result.valid = false;
            return result;
        }

        result.obstacle = {
            id: obstacle.id || `obstacle_${index}`,
            name: obstacle.name || `Obstacle ${index}`,
            type: obstacle.type || 'temporary',
            color: obstacle.color || '#ff6b6b',
            description: obstacle.description || '',
            properties: obstacle.properties || {}
        };

        if (obstacle.bounds) {
            const boundsValidation = this.validateBounds(obstacle.bounds);
            if (boundsValidation.valid) {
                result.obstacle.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors.map(e => `Obstacle ${index}: ${e}`));
                result.valid = false;
            }
        } else if (obstacle.position) {
            const positionValidation = this.validatePosition(obstacle.position);
            if (positionValidation.valid) {
                result.obstacle.position = positionValidation.position;
                result.obstacle.bounds = {
                    minX: positionValidation.position.x - 0.5,
                    maxX: positionValidation.position.x + 0.5,
                    minY: positionValidation.position.y - 0.5,
                    maxY: positionValidation.position.y + 0.5,
                    minZ: 0,
                    maxZ: positionValidation.position.z || 2
                };
            } else {
                result.errors.push(...positionValidation.errors.map(e => `Obstacle ${index}: ${e}`));
                result.valid = false;
            }
        } else {
            result.errors.push(`Obstacle ${index} must have bounds or position`);
            result.valid = false;
        }

        return result;
    }

    validateRestrictedArea(area, index) {
        const result = {
            valid: true,
            area: {},
            errors: []
        };

        if (!area.id && !area.name) {
            result.errors.push(`Restricted area ${index} must have id or name`);
            result.valid = false;
            return result;
        }

        result.area = {
            id: area.id || `restricted_${index}`,
            name: area.name || `Restricted Area ${index}`,
            type: area.type || 'no_entry',
            restriction: area.restriction || 'no_vehicle',
            color: area.color || '#ff4444',
            description: area.description || '',
            properties: area.properties || {}
        };

        if (area.polygon) {
            const polygonValidation = this.validatePolygon(area.polygon);
            if (polygonValidation.valid) {
                result.area.polygon = polygonValidation.polygon;
                result.area.bounds = this.calculateBoundsFromPolygon(polygonValidation.polygon);
            } else {
                result.errors.push(...polygonValidation.errors.map(e => `Restricted area ${index}: ${e}`));
                result.valid = false;
            }
        } else if (area.bounds) {
            const boundsValidation = this.validateBounds(area.bounds);
            if (boundsValidation.valid) {
                result.area.bounds = boundsValidation.bounds;
            } else {
                result.errors.push(...boundsValidation.errors.map(e => `Restricted area ${index}: ${e}`));
                result.valid = false;
            }
        } else {
            result.errors.push(`Restricted area ${index} must have polygon or bounds`);
            result.valid = false;
        }

        return result;
    }

    validatePolygon(polygon) {
        const result = {
            valid: true,
            polygon: [],
            errors: []
        };

        if (!Array.isArray(polygon) || polygon.length < 3) {
            result.errors.push('Polygon must be an array with at least 3 points');
            result.valid = false;
            return result;
        }

        for (let i = 0; i < polygon.length; i++) {
            const point = polygon[i];
            if (Array.isArray(point) && point.length >= 2) {
                const x = parseFloat(point[0]);
                const y = parseFloat(point[1]);
                const z = point[2] !== undefined ? parseFloat(point[2]) : 0;

                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    result.errors.push(`Polygon point ${i} contains non-numeric values`);
                    result.valid = false;
                } else {
                    result.polygon.push({ x, y, z });
                }
            } else if (typeof point === 'object' && point !== null) {
                const x = parseFloat(point.x);
                const y = parseFloat(point.y);
                const z = point.z !== undefined ? parseFloat(point.z) : 0;

                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    result.errors.push(`Polygon point ${i} contains non-numeric values`);
                    result.valid = false;
                } else {
                    result.polygon.push({ x, y, z });
                }
            } else {
                result.errors.push(`Polygon point ${i} must be an array or object with x, y coordinates`);
                result.valid = false;
            }
        }

        return result;
    }

    validateLine(start, end) {
        const result = {
            valid: true,
            start: null,
            end: null,
            errors: []
        };

        const startValidation = this.validatePosition(start);
        const endValidation = this.validatePosition(end);

        if (!startValidation.valid) {
            result.errors.push(...startValidation.errors.map(e => `Start point: ${e}`));
        }

        if (!endValidation.valid) {
            result.errors.push(...endValidation.errors.map(e => `End point: ${e}`));
        }

        if (startValidation.valid && endValidation.valid) {
            result.start = startValidation.position;
            result.end = endValidation.position;
        }

        result.valid = startValidation.valid && endValidation.valid;

        return result;
    }

    validatePosition(position) {
        const result = {
            valid: true,
            position: {},
            errors: []
        };

        if (Array.isArray(position) && position.length >= 2) {
            const x = parseFloat(position[0]);
            const y = parseFloat(position[1]);
            const z = position[2] !== undefined ? parseFloat(position[2]) : 0;

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                result.errors.push('Position contains non-numeric values');
                result.valid = false;
            } else {
                result.position = { x, y, z };
            }
        } else if (typeof position === 'object' && position !== null) {
            const x = parseFloat(position.x);
            const y = parseFloat(position.y);
            const z = position.z !== undefined ? parseFloat(position.z) : 0;

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                result.errors.push('Position contains non-numeric values');
                result.valid = false;
            } else {
                result.position = { x, y, z };
            }
        } else {
            result.errors.push('Position must be an array or object with x, y coordinates');
            result.valid = false;
        }

        return result;
    }

    calculateBoundsFromPolygon(polygon) {
        if (!polygon || polygon.length === 0) return null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        polygon.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
        });

        return { minX, maxX, minY, maxY, minZ, maxZ };
    }

    calculateBoundsFromLine(start, end, width = 3) {
        const halfWidth = width / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        let minX, maxX, minY, maxY;

        if (length === 0) {
            minX = start.x - halfWidth;
            maxX = start.x + halfWidth;
            minY = start.y - halfWidth;
            maxY = start.y + halfWidth;
        } else {
            const perpX = -dy / length * halfWidth;
            const perpY = dx / length * halfWidth;

            const x1 = start.x + perpX;
            const y1 = start.y + perpY;
            const x2 = start.x - perpX;
            const y2 = start.y - perpY;
            const x3 = end.x + perpX;
            const y3 = end.y + perpY;
            const x4 = end.x - perpX;
            const y4 = end.y - perpY;

            minX = Math.min(x1, x2, x3, x4);
            maxX = Math.max(x1, x2, x3, x4);
            minY = Math.min(y1, y2, y3, y4);
            maxY = Math.max(y1, y2, y3, y4);
        }

        return {
            minX, maxX, minY, maxY, minZ: 0, maxZ: 5
        };
    }

    calculateBoundsFromZones(zones) {
        if (!zones || zones.length === 0) return null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        zones.forEach(zone => {
            if (zone.bounds) {
                minX = Math.min(minX, zone.bounds.minX);
                maxX = Math.max(maxX, zone.bounds.maxX);
                minY = Math.min(minY, zone.bounds.minY);
                maxY = Math.max(maxY, zone.bounds.maxY);
                minZ = Math.min(minZ, zone.bounds.minZ);
                maxZ = Math.max(maxZ, zone.bounds.maxZ);
            }
        });

        return { minX, maxX, minY, maxY, minZ, maxZ };
    }

    calculateBoundsFromAisles(aisles) {
        if (!aisles || aisles.length === 0) return null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        aisles.forEach(aisle => {
            if (aisle.bounds) {
                minX = Math.min(minX, aisle.bounds.minX);
                maxX = Math.max(maxX, aisle.bounds.maxX);
                minY = Math.min(minY, aisle.bounds.minY);
                maxY = Math.max(maxY, aisle.bounds.maxY);
                minZ = Math.min(minZ, aisle.bounds.minZ);
                maxZ = Math.max(maxZ, aisle.bounds.maxZ);
            }
        });

        return { minX, maxX, minY, maxY, minZ, maxZ };
    }

    validateElementsAgainstBounds(result) {
        const bounds = result.mapData.bounds;
        if (!bounds) return result;

        const isInBounds = (elementBounds) => {
            if (!elementBounds) return true;
            return elementBounds.minX >= bounds.minX &&
                   elementBounds.maxX <= bounds.maxX &&
                   elementBounds.minY >= bounds.minY &&
                   elementBounds.maxY <= bounds.maxY;
        };

        result.mapData.zones.forEach((zone, index) => {
            if (!isInBounds(zone.bounds)) {
                result.warnings.push(`Zone ${zone.id} may be partially outside map bounds`);
            }
        });

        result.mapData.aisles.forEach((aisle, index) => {
            if (!isInBounds(aisle.bounds)) {
                result.warnings.push(`Aisle ${aisle.id} may be partially outside map bounds`);
            }
        });

        result.mapData.racks.forEach((rack, index) => {
            if (!isInBounds(rack.bounds)) {
                result.warnings.push(`Rack ${rack.id} may be partially outside map bounds`);
            }
        });

        result.mapData.obstacles.forEach((obstacle, index) => {
            if (!isInBounds(obstacle.bounds)) {
                result.warnings.push(`Obstacle ${obstacle.id} may be partially outside map bounds`);
            }
        });

        result.mapData.restrictedAreas.forEach((area, index) => {
            if (!isInBounds(area.bounds)) {
                result.warnings.push(`Restricted area ${area.id} may be partially outside map bounds`);
            }
        });

        return result;
    }

    getZoneColor(type) {
        const colorMap = {
            'storage': '#66bb6a',
            'receiving': '#42a5f5',
            'shipping': '#ffa726',
            'pickup': '#ab47bc',
            'staging': '#26c6da',
            'office': '#8d6e63',
            'general': '#78909c'
        };
        return colorMap[type] || '#78909c';
    }

    getMapBounds(mapData) {
        if (!mapData) return null;
        return mapData.bounds;
    }

    getRestrictedAreas(mapData) {
        if (!mapData || !mapData.restrictedAreas) return [];
        return mapData.restrictedAreas;
    }

    getAisles(mapData) {
        if (!mapData || !mapData.aisles) return [];
        return mapData.aisles;
    }

    isPointInBounds(point, bounds) {
        if (!point || !bounds) return false;
        return point.x >= bounds.minX && point.x <= bounds.maxX &&
               point.y >= bounds.minY && point.y <= bounds.maxY &&
               (point.z === undefined || (point.z >= bounds.minZ && point.z <= bounds.maxZ));
    }

    isPointInPolygon(point, polygon) {
        if (!point || !polygon || polygon.length < 3) return false;

        let inside = false;
        const x = point.x;
        const y = point.y;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }

        return inside;
    }

    isPointInZone(point, zone) {
        if (!point || !zone) return false;

        if (zone.polygon) {
            return this.isPointInPolygon(point, zone.polygon);
        }

        if (zone.bounds) {
            return this.isPointInBounds(point, zone.bounds);
        }

        return false;
    }
}

export default JSONMapParser;
