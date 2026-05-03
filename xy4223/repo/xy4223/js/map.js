// 地图系统模块
var GameMap = (function() {
    'use strict';
    
    var tileSize = Config.GAME.TILE_SIZE;
    var mapData = null;
    var entities = [];
    
    // 瓦片类型
    var TILE_TYPES = {
        EMPTY: 0,
        WALL: 1,
        DOOR: 2,
        EXHIBIT: 3,
        LIGHT: 4,
        SIGN: 5
    };
    
    function isWalkable(tileType) {
        return tileType === TILE_TYPES.EMPTY || 
               tileType === TILE_TYPES.DOOR;
    }
    
    function getTileTypeColor(tileType) {
        switch (tileType) {
            case TILE_TYPES.WALL:
                return '#4a4a6a';
            case TILE_TYPES.DOOR:
                return '#74b9ff';
            case TILE_TYPES.EXHIBIT:
                return '#a29bfe';
            case TILE_TYPES.LIGHT:
                return '#fdcb6e';
            case TILE_TYPES.SIGN:
                return '#e17055';
            default:
                return '#2a2a4a';
        }
    }
    
    return {
        // 初始化地图
        init: function(levelMapData) {
            mapData = levelMapData;
            entities = [];
            this._parseMapEntities();
        },
        
        // 解析地图实体
        _parseMapEntities: function() {
            if (!mapData || !mapData.tiles) return;
            
            entities = [];
            
            for (var y = 0; y < mapData.height; y++) {
                for (var x = 0; x < mapData.width; x++) {
                    var tileType = mapData.tiles[y][x];
                    if (tileType !== TILE_TYPES.EMPTY) {
                        entities.push({
                            type: this._getEntityType(tileType),
                            x: x * tileSize + tileSize / 2,
                            y: y * tileSize + tileSize / 2,
                            tileX: x,
                            tileY: y,
                            tileType: tileType
                        });
                    }
                }
            }
        },
        
        // 获取实体类型
        _getEntityType: function(tileType) {
            switch (tileType) {
                case TILE_TYPES.WALL:
                    return Config.ENTITY_TYPES.WALL;
                case TILE_TYPES.DOOR:
                    return Config.ENTITY_TYPES.DOOR;
                case TILE_TYPES.EXHIBIT:
                    return Config.ENTITY_TYPES.EXHIBIT;
                case TILE_TYPES.LIGHT:
                    return Config.ENTITY_TYPES.LIGHT;
                case TILE_TYPES.SIGN:
                    return 'sign';
                default:
                    return 'unknown';
            }
        },
        
        // 获取瓦片类型
        getTileAt: function(x, y) {
            if (!mapData || !mapData.tiles) return TILE_TYPES.EMPTY;
            
            var tileX = Math.floor(x / tileSize);
            var tileY = Math.floor(y / tileSize);
            
            if (tileX < 0 || tileX >= mapData.width || 
                tileY < 0 || tileY >= mapData.height) {
                return TILE_TYPES.WALL;
            }
            
            return mapData.tiles[tileY][tileX];
        },
        
        // 检查位置是否可行走
        canWalkTo: function(x, y, width, height) {
            if (width === undefined) width = 1;
            if (height === undefined) height = 1;
            
            // 检查四个角和中心点
            var points = [
                {x: x - width/2, y: y - height/2},
                {x: x + width/2, y: y - height/2},
                {x: x - width/2, y: y + height/2},
                {x: x + width/2, y: y + height/2},
                {x: x, y: y}
            ];
            
            for (var i = 0; i < points.length; i++) {
                var tileType = this.getTileAt(points[i].x, points[i].y);
                if (!isWalkable(tileType)) {
                    return false;
                }
            }
            
            return true;
        },
        
        // 获取所有实体
        getEntities: function() {
            return entities;
        },
        
        // 获取特定类型的实体
        getEntitiesByType: function(type) {
            return entities.filter(function(entity) {
                return entity.type === type;
            });
        },
        
        // 获取附近的展品
        getNearbyExhibits: function(x, y, range) {
            range = range || Config.PLAYER.INTERACTION_RANGE;
            var exhibits = this.getEntitiesByType(Config.ENTITY_TYPES.EXHIBIT);
            
            return exhibits.filter(function(exhibit) {
                var dist = Utils.distance(x, y, exhibit.x, exhibit.y);
                return dist <= range;
            });
        },
        
        // 获取附近的灯
        getNearbyLights: function(x, y, range) {
            range = range || Config.PLAYER.INTERACTION_RANGE;
            var lights = this.getEntitiesByType(Config.ENTITY_TYPES.LIGHT);
            
            return lights.filter(function(light) {
                var dist = Utils.distance(x, y, light.x, light.y);
                return dist <= range;
            });
        },
        
        // 获取可用的生成点
        getSpawnPoints: function() {
            if (mapData && mapData.spawnPoints) {
                return mapData.spawnPoints;
            }
            return [];
        },
        
        // 获取随机生成点
        getRandomSpawnPoint: function(excludePoints) {
            var spawnPoints = this.getSpawnPoints();
            if (spawnPoints.length === 0) return null;
            
            // 如果有排除点，过滤掉这些点
            if (excludePoints && excludePoints.length > 0) {
                var availablePoints = spawnPoints.filter(function(point) {
                    for (var i = 0; i < excludePoints.length; i++) {
                        var dist = Utils.distance(point.x, point.y, excludePoints[i].x, excludePoints[i].y);
                        if (dist < 50) return false;
                    }
                    return true;
                });
                
                if (availablePoints.length > 0) {
                    return Utils.randomChoice(availablePoints);
                }
            }
            
            return Utils.randomChoice(spawnPoints);
        },
        
        // 获取地图尺寸
        getSize: function() {
            if (!mapData) return {width: 0, height: 0};
            return {
                width: mapData.width * tileSize,
                height: mapData.height * tileSize,
                tileWidth: mapData.width,
                tileHeight: mapData.height
            };
        },
        
        // 获取瓦片大小
        getTileSize: function() {
            return tileSize;
        },
        
        // 渲染地图
        render: function(ctx) {
            if (!mapData || !mapData.tiles) return;
            
            // 渲染瓦片
            for (var y = 0; y < mapData.height; y++) {
                for (var x = 0; x < mapData.width; x++) {
                    var tileType = mapData.tiles[y][x];
                    var color = getTileTypeColor(tileType);
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        x * tileSize,
                        y * tileSize,
                        tileSize,
                        tileSize
                    );
                    
                    // 绘制网格线
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        x * tileSize,
                        y * tileSize,
                        tileSize,
                        tileSize
                    );
                    
                    // 为特殊瓦片绘制图标
                    if (tileType === TILE_TYPES.EXHIBIT) {
                        this._renderExhibitIcon(ctx, x, y);
                    } else if (tileType === TILE_TYPES.LIGHT) {
                        this._renderLightIcon(ctx, x, y);
                    } else if (tileType === TILE_TYPES.DOOR) {
                        this._renderDoorIcon(ctx, x, y);
                    }
                }
            }
        },
        
        _renderExhibitIcon: function(ctx, tileX, tileY) {
            var centerX = tileX * tileSize + tileSize / 2;
            var centerY = tileY * tileSize + tileSize / 2;
            
            ctx.fillStyle = '#dfe6e9';
            ctx.fillRect(centerX - 12, centerY - 8, 24, 16);
            
            ctx.strokeStyle = '#b2bec3';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX - 12, centerY - 8, 24, 16);
        },
        
        _renderLightIcon: function(ctx, tileX, tileY) {
            var centerX = tileX * tileSize + tileSize / 2;
            var centerY = tileY * tileSize + tileSize / 2;
            
            ctx.fillStyle = '#ffeaa7';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#fdcb6e';
            ctx.lineWidth = 2;
            ctx.stroke();
        },
        
        _renderDoorIcon: function(ctx, tileX, tileY) {
            var centerX = tileX * tileSize + tileSize / 2;
            var centerY = tileY * tileSize + tileSize / 2;
            
            ctx.fillStyle = '#74b9ff';
            ctx.fillRect(centerX - 8, centerY - 15, 16, 30);
            
            ctx.fillStyle = '#0984e3';
            ctx.beginPath();
            ctx.arc(centerX + 4, centerY, 3, 0, Math.PI * 2);
            ctx.fill();
        },
        
        // 重置地图
        reset: function() {
            mapData = null;
            entities = [];
        }
    };
})();
