/**
 * 禁放区模型
 * 定义仓库中不能放置货架的区域
 */

class ForbiddenZone extends WarehouseObject {
    constructor(options = {}) {
        super({
            ...options,
            type: Constants.OBJECT_TYPES.FORBIDDEN,
            color: options.color || Constants.COLORS.FORBIDDEN,
            height: options.height || 0.2
        });
        
        this.reason = options.reason || '';
        this.restrictionLevel = options.restrictionLevel || 'strict';
    }
    
    canPlaceObject(obj) {
        if (this.restrictionLevel === 'none') return true;
        if (this.restrictionLevel === 'warning') return true;
        return !this.overlapsWith(obj);
    }
    
    toJSON() {
        const json = super.toJSON();
        json.reason = this.reason;
        json.restrictionLevel = this.restrictionLevel;
        return json;
    }
    
    static fromJSON(json) {
        return new ForbiddenZone(json);
    }
}
