/**
 * 空间模型模块
 * 负责管理展厅、展品、通道等空间数据
 */

const SpaceModel = {
    floorplan: null,
    exhibits: [],
    timeSlots: [],
    accessibilityRules: null,

    /**
     * 初始化空间模型
     */
    init() {
        this.floorplan = null;
        this.exhibits = [];
        this.timeSlots = [];
        this.accessibilityRules = this.getDefaultAccessibilityRules();
    },

    /**
     * 获取默认无障碍规则
     */
    getDefaultAccessibilityRules() {
        return {
            maxDetourDistance: 50,
            preferredPathWidth: 1.5,
            maxSlope: 0.083,
            requiredClearZone: 1.5,
            priorityZones: [],
            avoidZones: []
        };
    },

    /**
     * 设置展厅平面图
     */
    setFloorplan(floorplan) {
        this.floorplan = floorplan;
        return this;
    },

    /**
     * 获取展厅平面图
     */
    getFloorplan() {
        return this.floorplan;
    },

    /**
     * 设置展品列表
     */
    setExhibits(exhibits) {
        this.exhibits = exhibits.map(exhibit => this.normalizeExhibit(exhibit));
        return this;
    },

    /**
     * 标准化展品数据格式
     */
    normalizeExhibit(exhibit) {
        const normalized = {
            id: exhibit.id || `exhibit_${Date.now()}_${Math.random()}`,
            name: exhibit.name || '未命名展品',
            position: { x: 0, y: 0 },
            dimensions: { width: 1, depth: 1, height: 2 },
            popularity: Math.max(0, Math.min(1, exhibit.popularity || 0.5)),
            viewingTime: Math.max(1, exhibit.viewingTime || 30),
            category: exhibit.category || 'default',
            description: exhibit.description || ''
        };

        if (exhibit.position) {
            normalized.position.x = exhibit.position.x;
            normalized.position.y = exhibit.position.y;
        } else if (typeof exhibit.x === 'number' && typeof exhibit.y === 'number') {
            normalized.position.x = exhibit.x;
            normalized.position.y = exhibit.y;
        }

        if (exhibit.dimensions) {
            normalized.dimensions.width = exhibit.dimensions.width || 1;
            normalized.dimensions.depth = exhibit.dimensions.depth || 1;
            normalized.dimensions.height = exhibit.dimensions.height || 2;
        } else {
            if (typeof exhibit.width === 'number') normalized.dimensions.width = exhibit.width;
            if (typeof exhibit.depth === 'number') normalized.dimensions.depth = exhibit.depth;
            if (typeof exhibit.height === 'number') normalized.dimensions.height = exhibit.height;
        }

        return normalized;
    },

    /**
     * 获取展品列表
     */
    getExhibits() {
        return this.exhibits;
    },

    /**
     * 添加单个展品
     */
    addExhibit(exhibit) {
        const normalized = this.normalizeExhibit(exhibit);
        this.exhibits.push(normalized);
        return this;
    },

    /**
     * 移除展品
     */
    removeExhibit(exhibitId) {
        const index = this.exhibits.findIndex(e => e.id === exhibitId);
        if (index !== -1) {
            this.exhibits.splice(index, 1);
        }
        return this;
    },

    /**
     * 更新展品
     */
    updateExhibit(exhibitId, updates) {
        const exhibit = this.exhibits.find(e => e.id === exhibitId);
        if (exhibit) {
            Object.assign(exhibit, updates);
        }
        return this;
    },

    /**
     * 设置时段列表
     */
    setTimeSlots(timeSlots) {
        this.timeSlots = timeSlots;
        return this;
    },

    /**
     * 获取时段列表
     */
    getTimeSlots() {
        return this.timeSlots;
    },

    /**
     * 设置无障碍规则
     */
    setAccessibilityRules(rules) {
        this.accessibilityRules = { ...this.getDefaultAccessibilityRules(), ...rules };
        return this;
    },

    /**
     * 获取无障碍规则
     */
    getAccessibilityRules() {
        return this.accessibilityRules;
    },

    /**
     * 获取所有入口
     */
    getEntrances() {
        return this.floorplan ? this.floorplan.entrances : [];
    },

    /**
     * 获取所有出口
     */
    getExits() {
        return this.floorplan ? this.floorplan.exits : [];
    },

    /**
     * 获取所有墙体
     */
    getWalls() {
        return this.floorplan ? this.floorplan.walls : [];
    },

    /**
     * 获取所有消防通道
     */
    getFireExits() {
        return this.floorplan ? (this.floorplan.fireExits || []) : [];
    },

    /**
     * 获取所有无障碍路径
     */
    getAccessibilityPaths() {
        return this.floorplan ? (this.floorplan.accessibilityPaths || []) : [];
    },

    /**
     * 获取展厅尺寸
     */
    getDimensions() {
        if (!this.floorplan) {
            return { width: 0, height: 0 };
        }
        return {
            width: this.floorplan.width,
            height: this.floorplan.height
        };
    },

    /**
     * 检查点是否在展厅内
     */
    isPointInside(x, y) {
        if (!this.floorplan) return false;
        
        const halfW = this.floorplan.width / 2;
        const halfH = this.floorplan.height / 2;
        
        return x >= -halfW && x <= halfW && y >= -halfH && y <= halfH;
    },

    /**
     * 检查线段是否与墙体相交
     */
    doesLineIntersectWall(x1, y1, x2, y2) {
        const walls = this.getWalls();
        
        for (const wall of walls) {
            if (this.lineIntersectsLine(
                x1, y1, x2, y2,
                wall.start.x, wall.start.y, wall.end.x, wall.end.y
            )) {
                return true;
            }
        }
        return false;
    },

    /**
     * 检查两条线段是否相交
     */
    lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        
        if (denominator === 0) {
            return false;
        }
        
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;
        
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    },

    /**
     * 获取两点之间的距离
     */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * 计算两点之间的角度
     */
    getAngle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * 检查点是否靠近展品
     */
    isPointNearExhibit(x, y, distance = 1) {
        for (const exhibit of this.exhibits) {
            const ex = exhibit.position.x;
            const ey = exhibit.position.y;
            const halfW = exhibit.dimensions.width / 2;
            const halfD = exhibit.dimensions.depth / 2;
            
            const closestX = Math.max(ex - halfW, Math.min(x, ex + halfW));
            const closestY = Math.max(ey - halfD, Math.min(y, ey + halfD));
            
            const dist = this.getDistance(x, y, closestX, closestY);
            
            if (dist <= distance) {
                return exhibit;
            }
        }
        return null;
    },

    /**
     * 检查点是否在消防通道区域内
     */
    isPointInFireExitZone(x, y) {
        const fireExits = this.getFireExits();
        
        for (const fireExit of fireExits) {
            const dist = this.getDistance(
                x, y,
                fireExit.position.x, fireExit.position.y
            );
            if (dist <= fireExit.clearZone) {
                return fireExit;
            }
        }
        return null;
    },

    /**
     * 序列化空间模型数据
     */
    serialize() {
        return {
            floorplan: this.floorplan,
            exhibits: this.exhibits,
            timeSlots: this.timeSlots,
            accessibilityRules: this.accessibilityRules
        };
    },

    /**
     * 反序列化空间模型数据
     */
    deserialize(data) {
        if (data.floorplan) {
            this.floorplan = data.floorplan;
        }
        if (data.exhibits) {
            this.exhibits = data.exhibits;
        }
        if (data.timeSlots) {
            this.timeSlots = data.timeSlots;
        }
        if (data.accessibilityRules) {
            this.accessibilityRules = data.accessibilityRules;
        }
        return this;
    },

    /**
     * 检查模型是否完整
     */
    isComplete() {
        return this.floorplan !== null && this.exhibits.length > 0;
    }
};

// 导出为全局变量
window.SpaceModel = SpaceModel;
