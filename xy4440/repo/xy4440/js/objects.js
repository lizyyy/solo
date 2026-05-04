/**
 * 游戏对象模块
 */

(function() {
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;
    const PHYSICS = window.constants.PHYSICS;
    const GAME = window.constants.GAME;
    const EventEmitter = window.utils.EventEmitter;

// 基础游戏对象类
class GameObject extends EventEmitter {
    constructor(id, type, x, y, width, height) {
        super();
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.rotation = 0;
        this.isSelected = false;
        this.isColliding = false;
        this.collisionCooldown = 0;
    }
    
    // 更新对象状态
    update(deltaTime) {
        if (this.collisionCooldown > 0) {
            this.collisionCooldown -= deltaTime;
        }
    }
    
    // 应用力
    applyForce(forceX, forceY) {
        this.velocityX += forceX;
        this.velocityY += forceY;
    }
    
    // 应用摩擦力
    applyFriction(friction = PHYSICS.FRICTION) {
        this.velocityX *= friction;
        this.velocityY *= friction;
    }
    
    // 移动对象
    move(deltaTime) {
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;
    }
    
    // 检测与另一个对象的碰撞
    collidesWith(other) {
        return this.x < other.x + other.width &&
               this.x + this.width > other.x &&
               this.y < other.y + other.height &&
               this.y + this.height > other.y;
    }
    
    // 检测点是否在对象内
    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }
    
    // 获取中心点
    getCenterX() {
        return this.x + this.width / 2;
    }
    
    getCenterY() {
        return this.y + this.height / 2;
    }
    
    // 设置位置
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    // 重置速度
    resetVelocity() {
        this.velocityX = 0;
        this.velocityY = 0;
    }
    
    // 序列化为JSON
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
            rotation: this.rotation
        };
    }
}

// 河流类
class River extends GameObject {
    constructor(id, x, y, width, height, flowDirection, flowSpeed) {
        super(id, OBJECT_TYPE.RIVER, x, y, width, height);
        this.flowDirection = flowDirection; // 0-360 度
        this.flowSpeed = flowSpeed;
        this.tileMap = []; // 用于存储河流的瓦片地图
        this.generateTileMap();
    }
    
    // 生成瓦片地图
    generateTileMap() {
        const { TILE_SIZE } = window.constants.RENDER;
        const tilesX = Math.ceil(this.width / TILE_SIZE);
        const tilesY = Math.ceil(this.height / TILE_SIZE);
        
        this.tileMap = [];
        for (let y = 0; y < tilesY; y++) {
            const row = [];
            for (let x = 0; x < tilesX; x++) {
                row.push({
                    isRiver: true,
                    flowDirection: this.flowDirection,
                    flowSpeed: this.flowSpeed
                });
            }
            this.tileMap.push(row);
        }
    }
    
    // 获取指定位置的水流信息
    getFlowAtPosition(x, y) {
        const { TILE_SIZE } = window.constants.RENDER;
        const tileX = Math.floor((x - this.x) / TILE_SIZE);
        const tileY = Math.floor((y - this.y) / TILE_SIZE);
        
        if (tileX >= 0 && tileX < this.tileMap[0]?.length &&
            tileY >= 0 && tileY < this.tileMap.length) {
            return this.tileMap[tileY][tileX];
        }
        
        return null;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            flowDirection: this.flowDirection,
            flowSpeed: this.flowSpeed
        };
    }
}

// 浅滩类
class Shallow extends GameObject {
    constructor(id, x, y, width, height) {
        super(id, OBJECT_TYPE.SHALLOW, x, y, width, height);
        this.slowFactor = PHYSICS.SHALLOW_SLOW_FACTOR;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            slowFactor: this.slowFactor
        };
    }
}

// 落水学员类
class Student extends GameObject {
    constructor(id, x, y, name) {
        super(id, OBJECT_TYPE.STUDENT, x, y, 30, 30);
        this.name = name;
        this.isRescued = false;
        this.isInDanger = false;
        this.health = 100;
        this.maxHealth = 100;
        this.driftFactor = PHYSICS.STUDENT_DRIFT_FACTOR;
        this.rescuedBy = null;
        this.rescueTime = 0;
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // 如果未被救援，持续受到伤害
        if (!this.isRescued) {
            this.health -= 0.1 * deltaTime;
            if (this.health < 30) {
                this.isInDanger = true;
            }
        }
    }
    
    // 被救援
    rescue(rescuerId, time) {
        this.isRescued = true;
        this.rescuedBy = rescuerId;
        this.rescueTime = time;
        this.velocityX = 0;
        this.velocityY = 0;
        this.emit('rescued', this);
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            isRescued: this.isRescued,
            isInDanger: this.isInDanger,
            health: this.health,
            maxHealth: this.maxHealth,
            rescuedBy: this.rescuedBy,
            rescueTime: this.rescueTime
        };
    }
}

// 救援艇类
class Boat extends GameObject {
    constructor(id, x, y, name) {
        super(id, OBJECT_TYPE.BOAT, x, y, 50, 20);
        this.name = name;
        this.energy = 100;
        this.maxEnergy = 100;
        this.passengers = []; // 救援的学员
        this.maxPassengers = 3;
        this.acceleration = PHYSICS.BOAT_ACCELERATION;
        this.maxSpeed = PHYSICS.BOAT_MAX_SPEED;
        this.isInShallow = false;
        this.path = []; // 规划的路径
        this.currentPathIndex = 0;
    }
    
    update(deltaTime) {
        super.update(deltaTime);
        
        // 消耗能量
        if (Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1) {
            this.energy -= PHYSICS.ENERGY_CONSUMPTION_RATE * deltaTime;
        }
        
        // 限制速度
        const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
        if (speed > this.maxSpeed) {
            const scale = this.maxSpeed / speed;
            this.velocityX *= scale;
            this.velocityY *= scale;
        }
    }
    
    // 添加乘客
    addPassenger(studentId) {
        if (this.passengers.length < this.maxPassengers) {
            this.passengers.push(studentId);
            return true;
        }
        return false;
    }
    
    // 移除乘客
    removePassenger(studentId) {
        const index = this.passengers.indexOf(studentId);
        if (index > -1) {
            this.passengers.splice(index, 1);
            return true;
        }
        return false;
    }
    
    // 设置路径
    setPath(path) {
        this.path = path;
        this.currentPathIndex = 0;
    }
    
    // 移动到路径点
    moveToPathPoint(deltaTime) {
        if (this.path.length === 0 || this.currentPathIndex >= this.path.length) {
            return false;
        }
        
        const target = this.path[this.currentPathIndex];
        const dx = target.x - this.getCenterX();
        const dy = target.y - this.getCenterY();
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) {
            this.currentPathIndex++;
            return false;
        }
        
        const moveX = (dx / distance) * this.maxSpeed * deltaTime;
        const moveY = (dy / distance) * this.maxSpeed * deltaTime;
        
        this.x += moveX;
        this.y += moveY;
        
        return true;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            energy: this.energy,
            maxEnergy: this.maxEnergy,
            passengers: [...this.passengers],
            maxPassengers: this.maxPassengers,
            path: [...this.path]
        };
    }
}

// 救援绳类
class Rope extends GameObject {
    constructor(id, startX, startY, endX, endY) {
        super(id, OBJECT_TYPE.ROPE, 
            Math.min(startX, endX), Math.min(startY, endY),
            Math.abs(endX - startX), Math.abs(endY - startY));
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        this.isActive = false;
        this.attachedTo = null;
    }
    
    // 计算点到绳子的距离
    distanceToPoint(px, py) {
        const dx = this.endX - this.startX;
        const dy = this.endY - this.startY;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            return Math.sqrt((px - this.startX) ** 2 + (py - this.startY) ** 2);
        }
        
        let t = ((px - this.startX) * dx + (py - this.startY) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        
        const closestX = this.startX + t * dx;
        const closestY = this.startY + t * dy;
        
        return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            startX: this.startX,
            startY: this.startY,
            endX: this.endX,
            endY: this.endY,
            length: this.length,
            isActive: this.isActive
        };
    }
}

// 安全区类
class SafeZone extends GameObject {
    constructor(id, x, y) {
        super(id, OBJECT_TYPE.SAFE_ZONE, 
            x - GAME.SAFE_ZONE_RADIUS, y - GAME.SAFE_ZONE_RADIUS,
            GAME.SAFE_ZONE_RADIUS * 2, GAME.SAFE_ZONE_RADIUS * 2);
        this.centerX = x;
        this.centerY = y;
        this.radius = GAME.SAFE_ZONE_RADIUS;
    }
    
    // 检测点是否在安全区内
    isInside(px, py) {
        const dx = px - this.centerX;
        const dy = py - this.centerY;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            centerX: this.centerX,
            centerY: this.centerY,
            radius: this.radius
        };
    }
}

// 导出模块
window.objects = {
    GameObject,
    River,
    Shallow,
    Student,
    Boat,
    Rope,
    SafeZone
};
})();