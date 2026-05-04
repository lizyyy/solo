/**
 * 物理引擎模块
 */

(function() {
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;
    const PHYSICS = window.constants.PHYSICS;
    const distance = window.utils.distance;
    const angle = window.utils.angle;

// 物理引擎类
class PhysicsEngine {
    constructor() {
        this.objects = [];
        this.rivers = [];
        this.shallows = [];
    }
    
    // 添加对象
    addObject(obj) {
        this.objects.push(obj);
        
        // 根据类型分类
        if (obj.type === OBJECT_TYPE.RIVER) {
            this.rivers.push(obj);
        } else if (obj.type === OBJECT_TYPE.SHALLOW) {
            this.shallows.push(obj);
        }
    }
    
    // 移除对象
    removeObject(obj) {
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
        
        // 从分类列表中移除
        if (obj.type === OBJECT_TYPE.RIVER) {
            const riverIndex = this.rivers.indexOf(obj);
            if (riverIndex > -1) {
                this.rivers.splice(riverIndex, 1);
            }
        } else if (obj.type === OBJECT_TYPE.SHALLOW) {
            const shallowIndex = this.shallows.indexOf(obj);
            if (shallowIndex > -1) {
                this.shallows.splice(shallowIndex, 1);
            }
        }
    }
    
    // 更新所有对象的物理状态
    update(deltaTime) {
        // 应用水流力
        this.applyWaterFlow(deltaTime);
        
        // 检测浅滩
        this.detectShallows();
        
        // 应用摩擦力
        this.applyFriction();
        
        // 移动对象
        this.moveObjects(deltaTime);
        
        // 检测碰撞
        this.detectCollisions();
        
        // 处理碰撞
        this.handleCollisions();
    }
    
    // 应用水流力
    applyWaterFlow(deltaTime) {
        for (const obj of this.objects) {
            // 只有学员和救援艇会受到水流影响
            if (obj.type !== OBJECT_TYPE.STUDENT && obj.type !== OBJECT_TYPE.BOAT) {
                continue;
            }
            
            // 检查对象是否在河流中
            let inRiver = false;
            let flowForce = { x: 0, y: 0 };
            
            for (const river of this.rivers) {
                if (river.containsPoint(obj.getCenterX(), obj.getCenterY())) {
                    inRiver = true;
                    
                    // 获取水流信息
                    const flow = river.getFlowAtPosition(obj.getCenterX(), obj.getCenterY());
                    if (flow) {
                        // 计算水流力
                        const forceMagnitude = PHYSICS.WATER_FLOW_FORCE * flow.flowSpeed;
                        const flowRad = window.utils.degToRad(flow.flowDirection);
                        
                        flowForce.x = Math.cos(flowRad) * forceMagnitude;
                        flowForce.y = Math.sin(flowRad) * forceMagnitude;
                        
                        // 学员受到的水流力较小
                        if (obj.type === OBJECT_TYPE.STUDENT) {
                            flowForce.x *= obj.driftFactor;
                            flowForce.y *= obj.driftFactor;
                        }
                    }
                    break;
                }
            }
            
            // 如果在河流中，应用水流力
            if (inRiver) {
                obj.applyForce(flowForce.x * deltaTime, flowForce.y * deltaTime);
            }
        }
    }
    
    // 检测浅滩
    detectShallows() {
        for (const obj of this.objects) {
            // 只有救援艇会受到浅滩影响
            if (obj.type !== OBJECT_TYPE.BOAT) {
                continue;
            }
            
            obj.isInShallow = false;
            
            for (const shallow of this.shallows) {
                if (shallow.containsPoint(obj.getCenterX(), obj.getCenterY())) {
                    obj.isInShallow = true;
                    break;
                }
            }
        }
    }
    
    // 应用摩擦力
    applyFriction() {
        for (const obj of this.objects) {
            // 只有学员和救援艇会受到摩擦力
            if (obj.type !== OBJECT_TYPE.STUDENT && obj.type !== OBJECT_TYPE.BOAT) {
                continue;
            }
            
            let friction = PHYSICS.FRICTION;
            
            // 如果在浅滩中，摩擦力更大
            if (obj.type === OBJECT_TYPE.BOAT && obj.isInShallow) {
                friction *= PHYSICS.SHALLOW_SLOW_FACTOR;
            }
            
            obj.applyFriction(friction);
        }
    }
    
    // 移动对象
    moveObjects(deltaTime) {
        for (const obj of this.objects) {
            // 只有学员和救援艇会移动
            if (obj.type !== OBJECT_TYPE.STUDENT && obj.type !== OBJECT_TYPE.BOAT) {
                continue;
            }
            
            // 被救援的学员不移动
            if (obj.type === OBJECT_TYPE.STUDENT && obj.isRescued) {
                continue;
            }
            
            obj.move(deltaTime);
            
            // 限制在画布范围内
            this.clampToBounds(obj);
        }
    }
    
    // 限制对象在画布范围内
    clampToBounds(obj) {
        const canvasWidth = 1200;
        const canvasHeight = 700;
        
        if (obj.x < 0) {
            obj.x = 0;
            obj.velocityX = 0;
        }
        if (obj.x + obj.width > canvasWidth) {
            obj.x = canvasWidth - obj.width;
            obj.velocityX = 0;
        }
        if (obj.y < 0) {
            obj.y = 0;
            obj.velocityY = 0;
        }
        if (obj.y + obj.height > canvasHeight) {
            obj.y = canvasHeight - obj.height;
            obj.velocityY = 0;
        }
    }
    
    // 检测碰撞
    detectCollisions() {
        for (let i = 0; i < this.objects.length; i++) {
            const objA = this.objects[i];
            objA.isColliding = false;
            
            for (let j = i + 1; j < this.objects.length; j++) {
                const objB = this.objects[j];
                
                // 检测碰撞
                if (this.checkCollision(objA, objB)) {
                    objA.isColliding = true;
                    objB.isColliding = true;
                    
                    // 记录碰撞对
                    if (!objA.collisions) objA.collisions = [];
                    if (!objB.collisions) objB.collisions = [];
                    
                    objA.collisions.push(objB);
                    objB.collisions.push(objA);
                }
            }
        }
    }
    
    // 检测两个对象之间的碰撞
    checkCollision(objA, objB) {
        // 学员和浅滩、河流不碰撞
        if ((objA.type === OBJECT_TYPE.STUDENT && 
             (objB.type === OBJECT_TYPE.RIVER || objB.type === OBJECT_TYPE.SHALLOW)) ||
            (objB.type === OBJECT_TYPE.STUDENT && 
             (objA.type === OBJECT_TYPE.RIVER || objA.type === OBJECT_TYPE.SHALLOW))) {
            return false;
        }
        
        // 救援艇和河流不碰撞
        if ((objA.type === OBJECT_TYPE.BOAT && objB.type === OBJECT_TYPE.RIVER) ||
            (objB.type === OBJECT_TYPE.BOAT && objA.type === OBJECT_TYPE.RIVER)) {
            return false;
        }
        
        // 救援绳和其他对象不碰撞
        if (objA.type === OBJECT_TYPE.ROPE || objB.type === OBJECT_TYPE.ROPE) {
            return false;
        }
        
        // 安全区不与其他对象碰撞
        if (objA.type === OBJECT_TYPE.SAFE_ZONE || objB.type === OBJECT_TYPE.SAFE_ZONE) {
            return false;
        }
        
        return objA.collidesWith(objB);
    }
    
    // 处理碰撞
    handleCollisions() {
        for (const obj of this.objects) {
            if (!obj.isColliding || obj.collisionCooldown > 0) {
                continue;
            }
            
            // 处理救援艇和学员的碰撞
            if (obj.type === OBJECT_TYPE.BOAT) {
                for (const other of obj.collisions) {
                    if (other.type === OBJECT_TYPE.STUDENT && !other.isRescued) {
                        // 救援学员
                        if (obj.addPassenger(other.id)) {
                            other.rescue(obj.id, 0); // 时间后续由游戏管理器处理
                        }
                    }
                }
            }
            
            // 处理救援艇和浅滩的碰撞
            if (obj.type === OBJECT_TYPE.BOAT) {
                for (const other of obj.collisions) {
                    if (other.type === OBJECT_TYPE.SHALLOW) {
                        // 减速
                        obj.velocityX *= 0.5;
                        obj.velocityY *= 0.5;
                    }
                }
            }
            
            // 重置碰撞列表
            obj.collisions = [];
        }
    }
    
    // 检查对象是否在浅滩中
    isInShallow(obj) {
        for (const shallow of this.shallows) {
            if (shallow.containsPoint(obj.getCenterX(), obj.getCenterY())) {
                return true;
            }
        }
        return false;
    }
    
    // 检查对象是否在安全区内
    isInSafeZone(obj, safeZones) {
        for (const safeZone of safeZones) {
            if (safeZone.isInside(obj.getCenterX(), obj.getCenterY())) {
                return true;
            }
        }
        return false;
    }
    
    // 重置物理引擎
    reset() {
        this.objects = [];
        this.rivers = [];
        this.shallows = [];
    }
}

// 导出模块
window.physics = {
    PhysicsEngine
};
})();