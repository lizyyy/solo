/**
 * 货架模型
 * 继承自 WarehouseObject，添加货架特有的属性和方法
 */

class Shelf extends WarehouseObject {
    constructor(options = {}) {
        super({
            ...options,
            type: Constants.OBJECT_TYPES.SHELF,
            color: options.color || Constants.COLORS.SHELF
        });
        
        this.levelCount = options.levelCount || 5;
        this.levelHeight = options.levelHeight || 0.5;
        
        this.slots = options.slots || [];
        
        this.aisleSide = options.aisleSide || 'both';
    }
    
    get skuMap() {
        const map = {};
        this.slots.forEach(slot => {
            if (slot.sku) {
                map[slot.sku] = {
                    slot: slot.slot,
                    shelfId: this.id,
                    shelfName: this.name,
                    position: slot.position || { x: this.x, z: this.z }
                };
            }
        });
        return map;
    }
    
    getSlotInfo(slotName) {
        return this.slots.find(s => s.slot === slotName) || null;
    }
    
    getSkuPosition(sku) {
        const slot = this.slots.find(s => s.sku === sku);
        if (!slot) return null;
        
        return {
            x: this.x,
            z: this.z,
            slot: slot.slot,
            sku: slot.sku
        };
    }
    
    addSlot(slotName, sku = null, position = null) {
        const existing = this.slots.find(s => s.slot === slotName);
        if (existing) {
            existing.sku = sku;
            existing.position = position || existing.position;
        } else {
            this.slots.push({
                slot: slotName,
                sku: sku,
                position: position || { x: this.x, z: this.z }
            });
        }
    }
    
    removeSlot(slotName) {
        const index = this.slots.findIndex(s => s.slot === slotName);
        if (index >= 0) {
            this.slots.splice(index, 1);
            return true;
        }
        return false;
    }
    
    hasSku(sku) {
        return this.slots.some(s => s.sku === sku);
    }
    
    toJSON() {
        const json = super.toJSON();
        json.levelCount = this.levelCount;
        json.levelHeight = this.levelHeight;
        json.slots = Utils.deepClone(this.slots);
        json.aisleSide = this.aisleSide;
        return json;
    }
    
    static fromJSON(json) {
        return new Shelf(json);
    }
}
