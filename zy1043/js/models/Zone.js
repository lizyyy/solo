/**
 * 货区模型
 * 用于定义仓库中的功能区域
 */

class Zone extends WarehouseObject {
    constructor(options = {}) {
        super({
            ...options,
            type: Constants.OBJECT_TYPES.ZONE,
            color: options.color || Constants.COLORS.ZONE
        });
        
        this.zoneType = options.zoneType || 'storage';
        this.description = options.description || '';
        
        this.shelves = options.shelves || [];
    }
    
    addShelf(shelfId) {
        if (!this.shelves.includes(shelfId)) {
            this.shelves.push(shelfId);
        }
    }
    
    removeShelf(shelfId) {
        const index = this.shelves.indexOf(shelfId);
        if (index >= 0) {
            this.shelves.splice(index, 1);
            return true;
        }
        return false;
    }
    
    toJSON() {
        const json = super.toJSON();
        json.zoneType = this.zoneType;
        json.description = this.description;
        json.shelves = [...this.shelves];
        return json;
    }
    
    static fromJSON(json) {
        return new Zone(json);
    }
}
