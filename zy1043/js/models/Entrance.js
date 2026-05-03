/**
 * 出入口模型
 * 定义仓库的入口和出口位置
 */

class Entrance extends WarehouseObject {
    constructor(options = {}) {
        super({
            ...options,
            type: Constants.OBJECT_TYPES.ENTRANCE,
            color: options.color || Constants.COLORS.ENTRANCE,
            height: options.height || 0.1
        });
        
        this.entranceType = options.entranceType || 'both';
        this.connectedArea = options.connectedArea || null;
        
        this.isDefaultStart = options.isDefaultStart || false;
        this.isDefaultEnd = options.isDefaultEnd || false;
    }
    
    get isEntrance() {
        return this.entranceType === 'entrance' || this.entranceType === 'both';
    }
    
    get isExit() {
        return this.entranceType === 'exit' || this.entranceType === 'both';
    }
    
    toJSON() {
        const json = super.toJSON();
        json.entranceType = this.entranceType;
        json.connectedArea = this.connectedArea;
        json.isDefaultStart = this.isDefaultStart;
        json.isDefaultEnd = this.isDefaultEnd;
        return json;
    }
    
    static fromJSON(json) {
        return new Entrance(json);
    }
}
