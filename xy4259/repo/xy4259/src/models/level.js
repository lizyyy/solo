// 关卡模型 - 定义地图元素和关卡数据结构

export const ElementType = {
    START_POINT: 'start-point',
    RESCUE_POINT: 'rescue-point',
    NO_FLY_ZONE: 'no-fly-zone',
    WIND_ZONE: 'wind-zone',
    MOUNTAIN: 'mountain'
};

export class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    distanceTo(other) {
        return Math.sqrt(Math.pow(other.x - this.x, 2) + Math.pow(other.y - this.y, 2));
    }
    
    clone() {
        return new Point(this.x, this.y);
    }
}

export class MapElement {
    constructor(type, position, options = {}) {
        this.type = type;
        this.position = position; // Point or array of Points for polygons
        this.options = options;
        this.id = Math.random().toString(36).substr(2, 9);
    }
}

export class Level {
    constructor(name = '未命名关卡') {
        this.name = name;
        this.elements = [];
        this.startPoint = null;
        this.rescuePoints = [];
        this.noFlyZones = [];
        this.windZones = [];
        this.mountains = [];
        this.settings = {
            initialBattery: 100,
            baseEnergyConsumption: 0.1,
            mapSize: { width: 1000, height: 800 }
        };
    }
    
    setName(name) {
        this.name = name;
    }
    
    setSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }
    
    addElement(element) {
        this.elements.push(element);
        
        switch (element.type) {
            case ElementType.START_POINT:
                this.startPoint = element;
                break;
            case ElementType.RESCUE_POINT:
                this.rescuePoints.push(element);
                break;
            case ElementType.NO_FLY_ZONE:
                this.noFlyZones.push(element);
                break;
            case ElementType.WIND_ZONE:
                this.windZones.push(element);
                break;
            case ElementType.MOUNTAIN:
                this.mountains.push(element);
                break;
        }
    }
    
    removeElement(elementId) {
        const index = this.elements.findIndex(e => e.id === elementId);
        if (index === -1) return false;
        
        const element = this.elements[index];
        
        switch (element.type) {
            case ElementType.START_POINT:
                this.startPoint = null;
                break;
            case ElementType.RESCUE_POINT:
                this.rescuePoints = this.rescuePoints.filter(p => p.id !== elementId);
                break;
            case ElementType.NO_FLY_ZONE:
                this.noFlyZones = this.noFlyZones.filter(z => z.id !== elementId);
                break;
            case ElementType.WIND_ZONE:
                this.windZones = this.windZones.filter(z => z.id !== elementId);
                break;
            case ElementType.MOUNTAIN:
                this.mountains = this.mountains.filter(m => m.id !== elementId);
                break;
        }
        
        this.elements.splice(index, 1);
        return true;
    }
    
    getElementAtPosition(x, y, tolerance = 10) {
        for (const element of this.elements) {
            if (element.type === ElementType.START_POINT || 
                element.type === ElementType.RESCUE_POINT) {
                const dist = element.position.distanceTo(new Point(x, y));
                if (dist <= tolerance) {
                    return element;
                }
            }
        }
        return null;
    }
    
    validate() {
        const errors = [];
        
        if (!this.startPoint) {
            errors.push('缺少起点/终点');
        }
        
        if (this.rescuePoints.length === 0) {
            errors.push('至少需要一个求救点');
        }
        
        if (this.settings.initialBattery <= 0) {
            errors.push('初始电量必须大于0');
        }
        
        if (this.settings.baseEnergyConsumption <= 0) {
            errors.push('基础能耗必须大于0');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    toJSON() {
        return {
            name: this.name,
            settings: this.settings,
            elements: this.elements.map(e => ({
                type: e.type,
                position: e.position instanceof Point 
                    ? { x: e.position.x, y: e.position.y }
                    : e.position.map(p => ({ x: p.x, y: p.y })),
                options: e.options,
                id: e.id
            }))
        };
    }
    
    static fromJSON(json) {
        const level = new Level(json.name);
        level.setSettings(json.settings);
        
        for (const elemJson of json.elements) {
            let position;
            if (elemJson.type === ElementType.START_POINT || 
                elemJson.type === ElementType.RESCUE_POINT) {
                position = new Point(elemJson.position.x, elemJson.position.y);
            } else {
                position = elemJson.position.map(p => new Point(p.x, p.y));
            }
            
            const element = new MapElement(elemJson.type, position, elemJson.options);
            element.id = elemJson.id;
            level.addElement(element);
        }
        
        return level;
    }
}

export function createDefaultLevel() {
    const level = new Level('初级训练关卡');
    level.setSettings({
        initialBattery: 100,
        baseEnergyConsumption: 0.1
    });
    
    level.addElement(new MapElement(
        ElementType.START_POINT,
        new Point(100, 100)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(400, 200)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(600, 400)
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(300, 150),
            new Point(350, 250),
            new Point(250, 250)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.WIND_ZONE,
        [
            new Point(500, 300),
            new Point(580, 300),
            new Point(580, 380),
            new Point(500, 380)
        ],
        {
            direction: 45,
            speed: 1.5
        }
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(200, 350),
            new Point(280, 450),
            new Point(120, 450)
        ]
    ));
    
    return level;
}

export function createMediumLevel() {
    const level = new Level('中级救援任务');
    level.setSettings({
        initialBattery: 120,
        baseEnergyConsumption: 0.12
    });
    
    level.addElement(new MapElement(
        ElementType.START_POINT,
        new Point(80, 80)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(250, 150)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(500, 100)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(450, 350)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(700, 250)
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(300, 200),
            new Point(380, 200),
            new Point(380, 280),
            new Point(300, 280)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(600, 300),
            new Point(650, 400),
            new Point(550, 400)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.WIND_ZONE,
        [
            new Point(400, 150),
            new Point(480, 150),
            new Point(480, 250),
            new Point(400, 250)
        ],
        {
            direction: 90,
            speed: 1.2
        }
    ));
    
    level.addElement(new MapElement(
        ElementType.WIND_ZONE,
        [
            new Point(600, 150),
            new Point(680, 150),
            new Point(680, 220),
            new Point(600, 220)
        ],
        {
            direction: 180,
            speed: 1.8
        }
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(200, 250),
            new Point(250, 350),
            new Point(150, 350)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(350, 350),
            new Point(400, 450),
            new Point(300, 450)
        ]
    ));
    
    return level;
}

export function createHardLevel() {
    const level = new Level('高级极限挑战');
    level.setSettings({
        initialBattery: 80,
        baseEnergyConsumption: 0.15
    });
    
    level.addElement(new MapElement(
        ElementType.START_POINT,
        new Point(50, 50)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(150, 200)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(350, 100)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(500, 200)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(650, 150)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(750, 300)
    ));
    
    level.addElement(new MapElement(
        ElementType.RESCUE_POINT,
        new Point(550, 400)
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(200, 150),
            new Point(280, 150),
            new Point(280, 250),
            new Point(200, 250)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(400, 250),
            new Point(480, 250),
            new Point(480, 350),
            new Point(400, 350)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.NO_FLY_ZONE,
        [
            new Point(600, 250),
            new Point(680, 250),
            new Point(680, 320),
            new Point(600, 320)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.WIND_ZONE,
        [
            new Point(300, 200),
            new Point(380, 200),
            new Point(380, 300),
            new Point(300, 300)
        ],
        {
            direction: 45,
            speed: 2.0
        }
    ));
    
    level.addElement(new MapElement(
        ElementType.WIND_ZONE,
        [
            new Point(550, 100),
            new Point(630, 100),
            new Point(630, 200),
            new Point(550, 200)
        ],
        {
            direction: 135,
            speed: 1.6
        }
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(150, 300),
            new Point(200, 400),
            new Point(100, 400)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(450, 350),
            new Point(520, 450),
            new Point(380, 450)
        ]
    ));
    
    level.addElement(new MapElement(
        ElementType.MOUNTAIN,
        [
            new Point(700, 350),
            new Point(780, 450),
            new Point(620, 450)
        ]
    ));
    
    return level;
}
