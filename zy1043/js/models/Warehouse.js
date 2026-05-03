/**
 * 仓库模型
 * 管理整个仓库的数据和对象
 */

class Warehouse {
    constructor(options = {}) {
        this.id = options.id || Utils.generateId('warehouse');
        this.name = options.name || '我的仓库';
        
        this.length = options.length || Constants.DEFAULT_SIZES.WAREHOUSE_LENGTH;
        this.width = options.width || Constants.DEFAULT_SIZES.WAREHOUSE_WIDTH;
        this.height = options.height || Constants.DEFAULT_SIZES.WAREHOUSE_HEIGHT;
        
        this.gridSize = options.gridSize || Constants.DEFAULT_SIZES.GRID_SIZE;
        this.showGrid = options.showGrid !== false;
        this.groundColor = options.groundColor || Constants.COLORS.FLOOR;
        
        this.minAisleWidth = options.minAisleWidth || Constants.DEFAULT_SIZES.AISLE_MIN_WIDTH;
        
        this.objects = [];
        this.objectMap = new Map();
        
        if (options.objects) {
            options.objects.forEach(obj => this.addObject(obj));
        }
        
        this.conflicts = [];
    }
    
    get bounds() {
        return {
            minX: -this.length / 2,
            maxX: this.length / 2,
            minZ: -this.width / 2,
            maxZ: this.width / 2,
            centerX: 0,
            centerZ: 0
        };
    }
    
    addObject(obj) {
        let warehouseObj;
        
        if (obj instanceof WarehouseObject) {
            warehouseObj = obj;
        } else {
            warehouseObj = WarehouseObject.fromJSON(obj);
        }
        
        this.objects.push(warehouseObj);
        this.objectMap.set(warehouseObj.id, warehouseObj);
        
        eventBus.emit(Constants.EVENTS.OBJECT_ADDED, warehouseObj);
        
        return warehouseObj;
    }
    
    removeObject(id) {
        const index = this.objects.findIndex(obj => obj.id === id);
        if (index >= 0) {
            const obj = this.objects[index];
            this.objects.splice(index, 1);
            this.objectMap.delete(id);
            eventBus.emit(Constants.EVENTS.OBJECT_REMOVED, obj);
            return true;
        }
        return false;
    }
    
    getObjectById(id) {
        return this.objectMap.get(id) || null;
    }
    
    getObjectsByType(type) {
        return this.objects.filter(obj => obj.type === type);
    }
    
    getShelves() {
        return this.getObjectsByType(Constants.OBJECT_TYPES.SHELF);
    }
    
    getZones() {
        return this.getObjectsByType(Constants.OBJECT_TYPES.ZONE);
    }
    
    getEntrances() {
        return this.getObjectsByType(Constants.OBJECT_TYPES.ENTRANCE);
    }
    
    getForbiddenZones() {
        return this.getObjectsByType(Constants.OBJECT_TYPES.FORBIDDEN);
    }
    
    findShelfBySlot(slotName) {
        const shelves = this.getShelves();
        for (const shelf of shelves) {
            if (shelf.getSlotInfo(slotName)) {
                return shelf;
            }
        }
        return null;
    }
    
    findObjectBySku(sku) {
        const shelves = this.getShelves();
        for (const shelf of shelves) {
            if (shelf.hasSku(sku)) {
                return shelf;
            }
        }
        return null;
    }
    
    getSkuMap() {
        const map = {};
        const shelves = this.getShelves();
        
        shelves.forEach(shelf => {
            const shelfMap = shelf.skuMap;
            for (const sku in shelfMap) {
                map[sku] = shelfMap[sku];
            }
        });
        
        return map;
    }
    
    getDefaultEntrance() {
        const entrances = this.getEntrances();
        const defaultStart = entrances.find(e => e.isDefaultStart);
        if (defaultStart) return defaultStart;
        return entrances[0] || null;
    }
    
    getDefaultExit() {
        const entrances = this.getEntrances();
        const defaultEnd = entrances.find(e => e.isDefaultEnd);
        if (defaultEnd) return defaultEnd;
        return entrances[entrances.length - 1] || this.getDefaultEntrance();
    }
    
    isPointInBounds(x, z) {
        const bounds = this.bounds;
        return x >= bounds.minX && x <= bounds.maxX &&
               z >= bounds.minZ && z <= bounds.maxZ;
    }
    
    isObjectInBounds(obj) {
        const bbox = obj.getBoundingBox();
        const bounds = this.bounds;
        
        return bbox.minX >= bounds.minX &&
               bbox.maxX <= bounds.maxX &&
               bbox.minZ >= bounds.minZ &&
               bbox.maxZ <= bounds.maxZ;
    }
    
    updateConflicts(conflicts) {
        this.conflicts = conflicts;
        
        this.objects.forEach(obj => obj.clearConflicts());
        
        conflicts.forEach(conflict => {
            if (conflict.objectA) {
                const objA = this.getObjectById(conflict.objectA);
                if (objA) objA.addConflict(conflict);
            }
            if (conflict.objectB) {
                const objB = this.getObjectById(conflict.objectB);
                if (objB) objB.addConflict(conflict);
            }
        });
        
        eventBus.emit(Constants.EVENTS.CONFLICTS_UPDATED, conflicts);
    }
    
    getConflicts() {
        return this.conflicts;
    }
    
    hasConflicts() {
        return this.conflicts.length > 0;
    }
    
    getConflictsForObject(objectId) {
        return this.conflicts.filter(c => 
            c.objectA === objectId || c.objectB === objectId
        );
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            length: this.length,
            width: this.width,
            height: this.height,
            gridSize: this.gridSize,
            showGrid: this.showGrid,
            groundColor: this.groundColor,
            minAisleWidth: this.minAisleWidth,
            objects: this.objects.map(obj => obj.toJSON())
        };
    }
    
    static fromJSON(json) {
        const warehouse = new Warehouse({
            id: json.id,
            name: json.name,
            length: json.length,
            width: json.width,
            height: json.height,
            gridSize: json.gridSize,
            showGrid: json.showGrid,
            groundColor: json.groundColor,
            minAisleWidth: json.minAisleWidth
        });
        
        if (json.objects) {
            json.objects.forEach(obj => warehouse.addObject(obj));
        }
        
        return warehouse;
    }
    
    clone() {
        return Warehouse.fromJSON(this.toJSON());
    }
}
