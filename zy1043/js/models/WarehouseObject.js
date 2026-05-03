/**
 * 仓库对象基类
 * 所有仓库对象（货架、货区、出入口、禁放区）的基类
 */

class WarehouseObject {
    constructor(options = {}) {
        this.id = options.id || Utils.generateId('obj');
        this.type = options.type || Constants.OBJECT_TYPES.SHELF;
        this.name = options.name || Constants.OBJECT_TYPE_NAMES[this.type];
        
        this.x = options.x || 0;
        this.z = options.z || 0;
        this.y = options.y || 0;
        
        this.length = options.length || Constants.DEFAULT_SIZES.SHELF_LENGTH;
        this.width = options.width || Constants.DEFAULT_SIZES.SHELF_WIDTH;
        this.height = options.height || Constants.DEFAULT_SIZES.SHELF_HEIGHT;
        
        this.rotation = Utils.normalizeAngle(options.rotation || 0);
        
        this.color = options.color || Constants.COLORS.SHELF;
        this.visible = options.visible !== false;
        this.locked = options.locked || false;
        
        this.userData = options.userData || {};
        
        this.conflicts = [];
        this.mesh = null;
    }
    
    get position() {
        return { x: this.x, y: this.y, z: this.z };
    }
    
    set position(pos) {
        if (pos.x !== undefined) this.x = pos.x;
        if (pos.y !== undefined) this.y = pos.y;
        if (pos.z !== undefined) this.z = pos.z;
    }
    
    get size() {
        return { length: this.length, width: this.width, height: this.height };
    }
    
    set size(s) {
        if (s.length !== undefined) this.length = s.length;
        if (s.width !== undefined) this.width = s.width;
        if (s.height !== undefined) this.height = s.height;
    }
    
    getBoundingBox() {
        return Utils.getBoundingBox(
            this.x, this.z,
            this.length, this.width,
            this.rotation
        );
    }
    
    getCorners() {
        return Utils.getRectCorners(
            this.x, this.z,
            this.length, this.width,
            this.rotation
        );
    }
    
    distanceTo(other) {
        if (other instanceof WarehouseObject) {
            return Utils.distance(this.x, this.z, other.x, other.z);
        }
        if (other.x !== undefined && other.z !== undefined) {
            return Utils.distance(this.x, this.z, other.x, other.z);
        }
        return Infinity;
    }
    
    containsPoint(x, z) {
        const corners = this.getCorners();
        let inside = false;
        
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            const xi = corners[i].x, zi = corners[i].z;
            const xj = corners[j].x, zj = corners[j].z;
            
            if (((zi > z) !== (zj > z)) && 
                (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    overlapsWith(other) {
        if (!(other instanceof WarehouseObject)) return false;
        
        return Utils.checkRotatedRectOverlap(
            { x: this.x, z: this.z, length: this.length, width: this.width, rotation: this.rotation },
            { x: other.x, z: other.z, length: other.length, width: other.width, rotation: other.rotation }
        );
    }
    
    addConflict(conflict) {
        this.conflicts.push(conflict);
    }
    
    clearConflicts() {
        this.conflicts = [];
    }
    
    hasConflicts() {
        return this.conflicts.length > 0;
    }
    
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            z: this.z,
            length: this.length,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            color: this.color,
            visible: this.visible,
            locked: this.locked,
            userData: Utils.deepClone(this.userData)
        };
    }
    
    static fromJSON(json) {
        const type = json.type;
        let obj;
        
        switch (type) {
            case Constants.OBJECT_TYPES.SHELF:
                obj = new Shelf(json);
                break;
            case Constants.OBJECT_TYPES.ZONE:
                obj = new Zone(json);
                break;
            case Constants.OBJECT_TYPES.ENTRANCE:
                obj = new Entrance(json);
                break;
            case Constants.OBJECT_TYPES.FORBIDDEN:
                obj = new ForbiddenZone(json);
                break;
            default:
                obj = new WarehouseObject(json);
        }
        
        return obj;
    }
    
    clone() {
        return WarehouseObject.fromJSON(this.toJSON());
    }
    
    update(options) {
        const keys = ['name', 'x', 'y', 'z', 'length', 'width', 'height', 'rotation', 'color', 'visible', 'locked'];
        
        keys.forEach(key => {
            if (options[key] !== undefined) {
                this[key] = options[key];
            }
        });
        
        if (options.userData) {
            this.userData = { ...this.userData, ...options.userData };
        }
        
        if (options.rotation !== undefined) {
            this.rotation = Utils.normalizeAngle(this.rotation);
        }
    }
}
