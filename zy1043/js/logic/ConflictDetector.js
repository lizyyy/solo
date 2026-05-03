/**
 * 冲突检测引擎
 * 检测仓库布局中的各种问题：对象重叠、越界、通道宽度不足、出入口被挡、禁放区冲突
 */

class ConflictDetector {
    constructor(warehouse) {
        this.warehouse = warehouse;
        this.conflicts = [];
    }
    
    detectAll() {
        this.conflicts = [];
        
        this.detectOutOfBounds();
        this.detectOverlaps();
        this.detectForbiddenZoneViolations();
        this.detectAisleWidthIssues();
        this.detectEntranceBlocked();
        
        return this.conflicts;
    }
    
    detectOutOfBounds() {
        const bounds = this.warehouse.bounds;
        
        this.warehouse.objects.forEach(obj => {
            if (obj.type === Constants.OBJECT_TYPES.ENTRANCE) return;
            
            const bbox = obj.getBoundingBox();
            
            if (bbox.minX < bounds.minX || bbox.maxX > bounds.maxX ||
                bbox.minZ < bounds.minZ || bbox.maxZ > bounds.maxZ) {
                
                this.addConflict({
                    type: Constants.CONFLICT_TYPES.OUT_OF_BOUNDS,
                    objectA: obj.id,
                    objectNameA: obj.name,
                    description: `对象 "${obj.name}" 超出仓库边界`,
                    details: `边界范围: X[${bounds.minX}, ${bounds.maxX}], Z[${bounds.minZ}, ${bounds.maxZ}]; 对象范围: X[${bbox.minX.toFixed(2)}, ${bbox.maxX.toFixed(2)}], Z[${bbox.minZ.toFixed(2)}, ${bbox.maxZ.toFixed(2)}]`
                });
            }
        });
    }
    
    detectOverlaps() {
        const objects = this.warehouse.objects;
        
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const objA = objects[i];
                const objB = objects[j];
                
                if (this.canOverlap(objA, objB)) continue;
                
                if (objA.overlapsWith(objB)) {
                    this.addConflict({
                        type: Constants.CONFLICT_TYPES.OVERLAP,
                        objectA: objA.id,
                        objectB: objB.id,
                        objectNameA: objA.name,
                        objectNameB: objB.name,
                        description: `"${objA.name}" 与 "${objB.name}" 发生重叠`,
                        details: `两个对象的边界框相交，距离: ${objA.distanceTo(objB).toFixed(2)}m`
                    });
                }
            }
        }
    }
    
    canOverlap(objA, objB) {
        if (objA.type === Constants.OBJECT_TYPES.ZONE || 
            objB.type === Constants.OBJECT_TYPES.ZONE) {
            return true;
        }
        
        if (objA.type === Constants.OBJECT_TYPES.FORBIDDEN || 
            objB.type === Constants.OBJECT_TYPES.FORBIDDEN) {
            return false;
        }
        
        return false;
    }
    
    detectForbiddenZoneViolations() {
        const forbiddenZones = this.warehouse.getForbiddenZones();
        const otherObjects = this.warehouse.objects.filter(obj => 
            obj.type !== Constants.OBJECT_TYPES.FORBIDDEN
        );
        
        forbiddenZones.forEach(forbidden => {
            otherObjects.forEach(obj => {
                if (forbidden.overlapsWith(obj)) {
                    this.addConflict({
                        type: Constants.CONFLICT_TYPES.FORBIDDEN_ZONE,
                        objectA: obj.id,
                        objectB: forbidden.id,
                        objectNameA: obj.name,
                        objectNameB: forbidden.name,
                        description: `"${obj.name}" 位于禁放区 "${forbidden.name}" 内`,
                        details: forbidden.reason || '该区域禁止放置任何对象'
                    });
                }
            });
        });
    }
    
    detectAisleWidthIssues() {
        const minWidth = this.warehouse.minAisleWidth;
        const shelves = this.warehouse.getShelves();
        
        for (let i = 0; i < shelves.length; i++) {
            for (let j = i + 1; j < shelves.length; j++) {
                const shelfA = shelves[i];
                const shelfB = shelves[j];
                
                const distance = this.calculateClearDistance(shelfA, shelfB);
                
                if (distance < minWidth && distance >= 0) {
                    this.addConflict({
                        type: Constants.CONFLICT_TYPES.AISLE_TOO_NARROW,
                        objectA: shelfA.id,
                        objectB: shelfB.id,
                        objectNameA: shelfA.name,
                        objectNameB: shelfB.name,
                        description: `通道宽度不足: "${shelfA.name}" 与 "${shelfB.name}" 之间仅 ${distance.toFixed(2)}m`,
                        details: `最小通道宽度要求: ${minWidth}m，实际: ${distance.toFixed(2)}m，缺口: ${(minWidth - distance).toFixed(2)}m`
                    });
                }
            }
        }
    }
    
    calculateClearDistance(objA, objB) {
        const cornersA = objA.getCorners();
        const cornersB = objB.getCorners();
        
        let minDistance = Infinity;
        
        for (let i = 0; i < 4; i++) {
            const a1 = cornersA[i];
            const a2 = cornersA[(i + 1) % 4];
            
            for (let j = 0; j < 4; j++) {
                const b1 = cornersB[j];
                const b2 = cornersB[(j + 1) % 4];
                
                const dist = this.distanceBetweenLineSegments(
                    a1.x, a1.z, a2.x, a2.z,
                    b1.x, b1.z, b2.x, b2.z
                );
                
                if (dist < minDistance) {
                    minDistance = dist;
                }
            }
        }
        
        return minDistance;
    }
    
    distanceBetweenLineSegments(x1, z1, x2, z2, x3, z3, x4, z4) {
        const p1 = { x: x1, z: z1 };
        const p2 = { x: x2, z: z2 };
        const p3 = { x: x3, z: z3 };
        const p4 = { x: x4, z: z4 };
        
        const v1 = { x: p2.x - p1.x, z: p2.z - p1.z };
        const v2 = { x: p4.x - p3.x, z: p4.z - p3.z };
        const w = { x: p1.x - p3.x, z: p1.z - p3.z };
        
        const a = v1.x * v1.x + v1.z * v1.z;
        const b = v1.x * v2.x + v1.z * v2.z;
        const c = v2.x * v2.x + v2.z * v2.z;
        const d = v1.x * w.x + v1.z * w.z;
        const e = v2.x * w.x + v2.z * w.z;
        
        const denom = a * c - b * b;
        let s, t;
        
        if (denom !== 0) {
            s = (b * e - c * d) / denom;
            t = (a * e - b * d) / denom;
            s = Math.max(0, Math.min(1, s));
            t = Math.max(0, Math.min(1, t));
        } else {
            s = 0;
            t = (b > c) ? d / b : e / c;
            t = Math.max(0, Math.min(1, t));
        }
        
        const proj1 = {
            x: p1.x + s * v1.x,
            z: p1.z + s * v1.z
        };
        const proj2 = {
            x: p3.x + t * v2.x,
            z: p3.z + t * v2.z
        };
        
        const dx = proj1.x - proj2.x;
        const dz = proj1.z - proj2.z;
        
        return Math.sqrt(dx * dx + dz * dz);
    }
    
    detectEntranceBlocked() {
        const entrances = this.warehouse.getEntrances();
        const blockingObjects = this.warehouse.objects.filter(obj =>
            obj.type === Constants.OBJECT_TYPES.SHELF
        );
        
        entrances.forEach(entrance => {
            blockingObjects.forEach(obj => {
                if (entrance.overlapsWith(obj)) {
                    this.addConflict({
                        type: Constants.CONFLICT_TYPES.ENTRANCE_BLOCKED,
                        objectA: obj.id,
                        objectB: entrance.id,
                        objectNameA: obj.name,
                        objectNameB: entrance.name,
                        description: `"${obj.name}" 阻挡了出入口 "${entrance.name}"`,
                        details: `货架位于出入口区域内，会影响货物进出`
                    });
                }
            });
        });
    }
    
    addConflict(conflict) {
        this.conflicts.push({
            id: Utils.generateId('conflict'),
            ...conflict,
            timestamp: Date.now()
        });
    }
    
    getConflictsByType(type) {
        return this.conflicts.filter(c => c.type === type);
    }
    
    getConflictsForObject(objectId) {
        return this.conflicts.filter(c =>
            c.objectA === objectId || c.objectB === objectId
        );
    }
    
    static detect(warehouse) {
        const detector = new ConflictDetector(warehouse);
        const conflicts = detector.detectAll();
        warehouse.updateConflicts(conflicts);
        return conflicts;
    }
}
