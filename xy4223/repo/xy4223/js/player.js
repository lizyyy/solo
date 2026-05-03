// 玩家模块
var Player = (function() {
    'use strict';
    
    var player = {
        x: Config.PLAYER.START_X,
        y: Config.PLAYER.START_Y,
        width: 30,
        height: 30,
        speed: Config.PLAYER.SPEED,
        direction: { x: 0, y: 0 },
        lastDirection: { x: 0, y: -1 },
        color: Config.PLAYER.COLOR,
        interactionRange: Config.PLAYER.INTERACTION_RANGE
    };
    
    var velocity = { x: 0, y: 0 };
    
    return {
        // 初始化玩家
        init: function(x, y) {
            player.x = x !== undefined ? x : Config.PLAYER.START_X;
            player.y = y !== undefined ? y : Config.PLAYER.START_Y;
            player.direction = { x: 0, y: 0 };
            player.lastDirection = { x: 0, y: -1 };
            velocity = { x: 0, y: 0 };
        },
        
        // 更新玩家位置
        update: function(inputState, deltaTime) {
            // 计算方向
            var dx = 0;
            var dy = 0;
            
            if (inputState.up) dy -= 1;
            if (inputState.down) dy += 1;
            if (inputState.left) dx -= 1;
            if (inputState.right) dx += 1;
            
            // 标准化对角线移动
            var magnitude = Math.sqrt(dx * dx + dy * dy);
            if (magnitude > 0) {
                dx /= magnitude;
                dy /= magnitude;
                player.direction.x = dx;
                player.direction.y = dy;
                player.lastDirection.x = dx;
                player.lastDirection.y = dy;
            } else {
                player.direction.x = 0;
                player.direction.y = 0;
            }
            
            // 计算速度
            velocity.x = dx * player.speed;
            velocity.y = dy * player.speed;
            
            // 尝试移动，检查碰撞
            var newX = player.x + velocity.x;
            var newY = player.y + velocity.y;
            
            // 分别检查X和Y方向的碰撞，允许单方向移动
            if (this.canMoveTo(newX, player.y)) {
                player.x = newX;
            }
            if (this.canMoveTo(player.x, newY)) {
                player.y = newY;
            }
            
            // 限制在地图边界内
            var mapSize = GameMap.getSize();
            player.x = Utils.clamp(player.x, player.width / 2, mapSize.width - player.width / 2);
            player.y = Utils.clamp(player.y, player.height / 2, mapSize.height - player.height / 2);
        },
        
        // 检查是否可以移动到指定位置
        canMoveTo: function(x, y) {
            return GameMap.canWalkTo(x, y, player.width - 4, player.height - 4);
        },
        
        // 获取玩家位置
        getPosition: function() {
            return {
                x: player.x,
                y: player.y
            };
        },
        
        // 设置玩家位置
        setPosition: function(x, y) {
            player.x = x;
            player.y = y;
        },
        
        // 获取玩家方向
        getDirection: function() {
            return player.direction;
        },
        
        // 获取玩家最后方向
        getLastDirection: function() {
            return player.lastDirection;
        },
        
        // 获取玩家碰撞边界
        getBounds: function() {
            return {
                x: player.x - player.width / 2,
                y: player.y - player.height / 2,
                width: player.width,
                height: player.height
            };
        },
        
        // 获取互动范围内的实体
        getInteractableEntities: function() {
            var nearbyExhibits = GameMap.getNearbyExhibits(player.x, player.y, player.interactionRange);
            var nearbyLights = GameMap.getNearbyLights(player.x, player.y, player.interactionRange);
            
            return {
                exhibits: nearbyExhibits,
                lights: nearbyLights
            };
        },
        
        // 获取互动范围内最近的事件
        getNearestEventInRange: function(events) {
            if (!events || events.length === 0) return null;
            
            var nearestEvent = null;
            var nearestDistance = Infinity;
            
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var dist = Utils.distance(player.x, player.y, event.x, event.y);
                
                if (dist <= player.interactionRange && dist < nearestDistance) {
                    nearestDistance = dist;
                    nearestEvent = event;
                }
            }
            
            return nearestEvent;
        },
        
        // 检查是否在互动范围内
        isInInteractionRange: function(x, y) {
            var dist = Utils.distance(player.x, player.y, x, y);
            return dist <= player.interactionRange;
        },
        
        // 获取互动范围
        getInteractionRange: function() {
            return player.interactionRange;
        },
        
        // 渲染玩家
        render: function(ctx) {
            // 绘制互动范围指示器
            ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.interactionRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 绘制玩家身体
            ctx.fillStyle = player.color;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.width / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制玩家边界
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 绘制方向指示器
            var dirLength = 15;
            var dirX = player.x + player.lastDirection.x * dirLength;
            var dirY = player.y + player.lastDirection.y * dirLength;
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(dirX, dirY);
            ctx.stroke();
            
            // 绘制中心点
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
            ctx.fill();
        },
        
        // 重置玩家
        reset: function() {
            this.init();
        }
    };
})();
