class EventRecorder {
    constructor() {
        this.events = [];
        this.maxEvents = 1000;
    }

    record(type, description, time, data = {}) {
        const event = {
            id: Helpers.generateId(),
            type,
            description,
            shortDesc: this.getShortDescription(type, data),
            time,
            data,
            timestamp: Date.now()
        };
        
        this.events.push(event);
        
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }
        
        return event;
    }

    getShortDescription(type, data) {
        switch (type) {
            case CONSTANTS.EVENT_TYPES.PASSENGER_SPAWN:
                return `生成 ${Helpers.getColorName(data.color)} 乘客`;
            case CONSTANTS.EVENT_TYPES.PASSENGER_EXIT:
                return `${Helpers.getColorName(data.color)} 乘客到达正确出口`;
            case CONSTANTS.EVENT_TYPES.PASSENGER_WRONG_EXIT:
                return `乘客走错出口`;
            case CONSTANTS.EVENT_TYPES.PASSENGER_PATIENCE_ZERO:
                return `乘客耐心耗尽`;
            case CONSTANTS.EVENT_TYPES.CONGESTION_START:
                return `${data.location} 开始拥堵`;
            case CONSTANTS.EVENT_TYPES.CONGESTION_END:
                return `拥堵缓解`;
            case CONSTANTS.EVENT_TYPES.TOOL_USED:
                return `放置${data.tool === 'fence' ? '围栏' : '工作人员'}`;
            case CONSTANTS.EVENT_TYPES.TOOL_REMOVED:
                return `移除${data.tool === 'fence' ? '围栏' : '工作人员'}`;
            case CONSTANTS.EVENT_TYPES.GATE_TOGGLE:
                return `闸机${data.open ? '开启' : '关闭'}`;
            case CONSTANTS.EVENT_TYPES.VICTORY:
                return `关卡胜利！`;
            case CONSTANTS.EVENT_TYPES.DEFEAT:
                return `关卡失败`;
            default:
                return data.description || '';
        }
    }

    getEvents() {
        return [...this.events];
    }

    getKeyEvents() {
        return this.events.filter(e => 
            e.type === CONSTANTS.EVENT_TYPES.PASSENGER_EXIT ||
            e.type === CONSTANTS.EVENT_TYPES.PASSENGER_WRONG_EXIT ||
            e.type === CONSTANTS.EVENT_TYPES.PASSENGER_PATIENCE_ZERO ||
            e.type === CONSTANTS.EVENT_TYPES.CONGESTION_START ||
            e.type === CONSTANTS.EVENT_TYPES.TOOL_USED ||
            e.type === CONSTANTS.EVENT_TYPES.GATE_TOGGLE ||
            e.type === CONSTANTS.EVENT_TYPES.VICTORY ||
            e.type === CONSTANTS.EVENT_TYPES.DEFEAT
        );
    }

    getRecentEvents(count = 10) {
        return this.events.slice(-count);
    }

    clear() {
        this.events = [];
    }

    export() {
        return JSON.stringify(this.events, null, 2);
    }

    import(jsonStr) {
        try {
            this.events = JSON.parse(jsonStr);
            return true;
        } catch (e) {
            console.error('Failed to import events:', e);
            return false;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = EventRecorder;
}
