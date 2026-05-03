export class LevelParser {
    constructor() {
        this.requiredFields = [
            'id',
            'name',
            'grid',
            'maintenanceCars',
            'lastTrains',
            'criticalSegments',
            'winConditions'
        ];
    }

    parse(levelData) {
        this._validateLevelData(levelData);
        return this._parseLevel(levelData);
    }

    _validateLevelData(levelData) {
        const missingFields = this.requiredFields.filter(field => !(field in levelData));
        if (missingFields.length > 0) {
            throw new Error(`关卡数据缺少必要字段: ${missingFields.join(', ')}`);
        }

        if (!Array.isArray(levelData.grid)) {
            throw new Error('grid 必须是数组');
        }

        if (levelData.grid.length === 0 || levelData.grid[0].length === 0) {
            throw new Error('grid 不能为空');
        }

        if (!Array.isArray(levelData.maintenanceCars)) {
            throw new Error('maintenanceCars 必须是数组');
        }

        if (!Array.isArray(levelData.lastTrains)) {
            throw new Error('lastTrains 必须是数组');
        }

        if (!Array.isArray(levelData.criticalSegments)) {
            throw new Error('criticalSegments 必须是数组');
        }

        if (!levelData.winConditions || typeof levelData.winConditions !== 'object') {
            throw new Error('winConditions 必须是对象');
        }
    }

    _parseLevel(levelData) {
        return {
            id: levelData.id,
            name: levelData.name,
            description: levelData.description || '',
            grid: this._parseGrid(levelData.grid),
            maintenanceCars: this._parseMaintenanceCars(levelData.maintenanceCars),
            lastTrains: this._parseLastTrains(levelData.lastTrains),
            criticalSegments: this._parseCriticalSegments(levelData.criticalSegments),
            winConditions: this._parseWinConditions(levelData.winConditions),
            timeLimit: levelData.timeLimit || Infinity,
            startingTurn: levelData.startingTurn || 0
        };
    }

    _parseGrid(gridData) {
        const grid = [];
        for (let y = 0; y < gridData.length; y++) {
            const row = [];
            for (let x = 0; x < gridData[y].length; x++) {
                const cellData = gridData[y][x];
                row.push(this._parseCell(cellData, x, y));
            }
            grid.push(row);
        }
        return grid;
    }

    _parseCell(cellData, x, y) {
        if (typeof cellData === 'string') {
            return {
                type: this._parseCellType(cellData),
                x,
                y,
                connections: this._getConnectionsFromType(cellData),
                isStation: cellData.includes('S'),
                stationName: cellData.includes('S') ? `站${x},${y}` : null
            };
        }
        
        return {
            type: this._parseCellType(cellData.type || cellData),
            x,
            y,
            connections: cellData.connections || this._getConnectionsFromType(cellData.type || cellData),
            isStation: cellData.isStation || false,
            stationName: cellData.stationName || null,
            id: cellData.id
        };
    }

    _parseCellType(type) {
        const validTypes = ['empty', 'track', 'station', 'junction', 'depot', 'terminus'];
        
        if (typeof type === 'string') {
            if (type.includes('T')) return 'track';
            if (type.includes('S')) return 'station';
            if (type.includes('J')) return 'junction';
            if (type.includes('D')) return 'depot';
            if (type.includes('E')) return 'empty';
            if (type.includes('X')) return 'terminus';
        }
        
        return validTypes.includes(type) ? type : 'empty';
    }

    _getConnectionsFromType(type) {
        if (typeof type !== 'string') return [];
        
        const connections = [];
        if (type.includes('N') || type.includes('U')) connections.push('N');
        if (type.includes('S') || type.includes('D')) connections.push('S');
        if (type.includes('E') || type.includes('R')) connections.push('E');
        if (type.includes('W') || type.includes('L')) connections.push('W');
        
        return connections;
    }

    _parseMaintenanceCars(carsData) {
        return carsData.map((car, index) => ({
            id: car.id || `car_${index}`,
            name: car.name || `检修车 ${index + 1}`,
            x: car.x,
            y: car.y,
            battery: car.battery || 100,
            maxBattery: car.maxBattery || 100,
            movementCost: car.movementCost || 10,
            repairCost: car.repairCost || 5,
            status: car.status || 'idle'
        }));
    }

    _parseLastTrains(trainsData) {
        return trainsData.map((train, index) => ({
            id: train.id || `train_${index}`,
            name: train.name || `末班车 ${index + 1}`,
            route: train.route,
            currentPosition: train.currentPosition || 0,
            startTime: train.startTime || 0,
            speed: train.speed || 1,
            status: train.status || 'waiting'
        }));
    }

    _parseCriticalSegments(segmentsData) {
        return segmentsData.map((segment, index) => ({
            id: segment.id || `segment_${index}`,
            x: segment.x,
            y: segment.y,
            repairTime: segment.repairTime || 2,
            remainingTime: segment.remainingTime || segment.repairTime,
            deadline: segment.deadline || Infinity,
            isRepaired: segment.isRepaired || false,
            priority: segment.priority || 'normal'
        }));
    }

    _parseWinConditions(conditions) {
        return {
            repairAllCritical: conditions.repairAllCritical !== false,
            avoidAllConflicts: conditions.avoidAllConflicts !== false,
            maintainBattery: conditions.maintainBattery !== false,
            additionalConditions: conditions.additionalConditions || []
        };
    }

    validateLevel(level) {
        const errors = [];
        const warnings = [];

        if (level.maintenanceCars.length === 0) {
            warnings.push('关卡中没有检修车，玩家无法进行任何操作');
        }

        level.maintenanceCars.forEach((car, index) => {
            if (!this._isValidPosition(car.x, car.y, level.grid)) {
                errors.push(`检修车 ${car.name} 的初始位置 (${car.x}, ${car.y}) 无效`);
            }
        });

        level.lastTrains.forEach((train, index) => {
            if (!train.route || train.route.length === 0) {
                errors.push(`末班车 ${train.name} 没有路线`);
            } else {
                train.route.forEach((point, pointIndex) => {
                    if (!this._isValidPosition(point.x, point.y, level.grid)) {
                        errors.push(`末班车 ${train.name} 的路线点 ${pointIndex} (${point.x}, ${point.y}) 无效`);
                    }
                });
            }
        });

        level.criticalSegments.forEach((segment, index) => {
            if (!this._isValidPosition(segment.x, segment.y, level.grid)) {
                errors.push(`关键轨段 ${segment.id} 的位置 (${segment.x}, ${segment.y}) 无效`);
            }
        });

        if (level.timeLimit !== Infinity && level.timeLimit <= 0) {
            errors.push('时间限制必须大于 0');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    _isValidPosition(x, y, grid) {
        if (x === undefined || y === undefined) return false;
        if (y < 0 || y >= grid.length) return false;
        if (x < 0 || x >= grid[y].length) return false;
        if (grid[y][x].type === 'empty') return false;
        return true;
    }
}
