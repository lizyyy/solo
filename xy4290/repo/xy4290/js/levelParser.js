// 关卡解析模块 - 负责解析 JSON 格式的关卡配置

import { CellType, UnitType } from './types.js';

/**
 * 关卡解析器类
 */
export class LevelParser {
    constructor() {
        this.version = '1.0.0';
    }

    /**
     * 解析 JSON 字符串为关卡配置
     * @param {string} jsonString - JSON 字符串
     * @returns {import('./types.js').LevelConfig} 解析后的关卡配置
     * @throws {Error} 如果解析失败或配置无效
     */
    parse(jsonString) {
        try {
            const rawConfig = JSON.parse(jsonString);
            return this.validateAndTransform(rawConfig);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`JSON 语法错误: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * 验证并转换原始配置
     * @param {Object} rawConfig - 原始配置对象
     * @returns {import('./types.js').LevelConfig} 验证后的关卡配置
     * @throws {Error} 如果配置无效
     */
    validateAndTransform(rawConfig) {
        this.validateRequiredFields(rawConfig);
        
        const config = {
            id: rawConfig.id,
            name: rawConfig.name,
            description: rawConfig.description || '',
            timeLimit: rawConfig.timeLimit,
            targetCoverage: rawConfig.targetCoverage || 80,
            grid: this.parseGrid(rawConfig.grid),
            initialUnits: this.parseUnits(rawConfig.initialUnits),
            scoring: this.parseScoring(rawConfig.scoring, rawConfig.timeLimit)
        };

        this.validateConfigConsistency(config);
        
        return config;
    }

    /**
     * 验证必需字段
     * @param {Object} config - 配置对象
     * @throws {Error} 如果缺少必需字段
     */
    validateRequiredFields(config) {
        const requiredFields = ['id', 'name', 'timeLimit', 'grid', 'initialUnits'];
        const missingFields = requiredFields.filter(field => !(field in config));
        
        if (missingFields.length > 0) {
            throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
        }

        if (typeof config.timeLimit !== 'number' || config.timeLimit <= 0) {
            throw new Error('timeLimit 必须是大于 0 的数字');
        }
    }

    /**
     * 解析网格配置
     * @param {Object} gridConfig - 网格配置
     * @returns {Object} 解析后的网格对象
     * @throws {Error} 如果网格配置无效
     */
    parseGrid(gridConfig) {
        if (!gridConfig || !gridConfig.width || !gridConfig.height || !gridConfig.cells) {
            throw new Error('grid 配置必须包含 width, height 和 cells');
        }

        const { width, height, cells } = gridConfig;

        if (!Array.isArray(cells) || cells.length !== height) {
            throw new Error(`cells 必须是长度为 ${height} 的数组`);
        }

        const parsedCells = cells.map((row, y) => {
            if (!Array.isArray(row) || row.length !== width) {
                throw new Error(`第 ${y} 行的长度必须为 ${width}`);
            }
            return row.map(cell => this.parseCell(cell));
        });

        return {
            width,
            height,
            cells: parsedCells
        };
    }

    /**
     * 解析单个格子
     * @param {Object|string} cell - 格子数据（可以是对象或字符串简写）
     * @returns {import('./types.js').Cell} 解析后的格子对象
     */
    parseCell(cell) {
        if (typeof cell === 'string') {
            return this.cellTypeToCell(cell);
        }

        const type = cell.type || CellType.ROAD;
        const baseCell = this.cellTypeToCell(type);

        return {
            ...baseCell,
            ...cell,
            type: type in CellType ? type : CellType.ROAD
        };
    }

    /**
     * 将格子类型字符串转换为格子对象
     * @param {string} type - 格子类型
     * @returns {import('./types.js').Cell} 格子对象
     */
    cellTypeToCell(type) {
        const cellMap = {
            [CellType.ROAD]: {
                type: CellType.ROAD,
                isPassable: true,
                isRepairable: false,
                repairCost: 0,
                hasBroadcast: false,
                isBroadcastActive: false,
                broadcastRange: 0
            },
            [CellType.BUILDING]: {
                type: CellType.BUILDING,
                isPassable: false,
                isRepairable: false,
                repairCost: 0,
                hasBroadcast: false,
                isBroadcastActive: false,
                broadcastRange: 0
            },
            [CellType.WATER]: {
                type: CellType.WATER,
                isPassable: false,
                isRepairable: false,
                repairCost: 0,
                hasBroadcast: false,
                isBroadcastActive: false,
                broadcastRange: 0
            },
            [CellType.BLOCKED]: {
                type: CellType.BLOCKED,
                isPassable: false,
                isRepairable: true,
                repairCost: 30,
                hasBroadcast: false,
                isBroadcastActive: false,
                broadcastRange: 0
            },
            [CellType.BROADCAST_POINT]: {
                type: CellType.BROADCAST_POINT,
                isPassable: true,
                isRepairable: false,
                repairCost: 0,
                hasBroadcast: true,
                isBroadcastActive: false,
                broadcastRange: 2
            },
            [CellType.EMPTY]: {
                type: CellType.EMPTY,
                isPassable: false,
                isRepairable: false,
                repairCost: 0,
                hasBroadcast: false,
                isBroadcastActive: false,
                broadcastRange: 0
            }
        };

        return cellMap[type] || cellMap[CellType.ROAD];
    }

    /**
     * 解析单位配置
     * @param {Object[]} unitsConfig - 单位配置数组
     * @returns {(import('./types.js').RepairVehicle|import('./types.js').Generator)[]} 解析后的单位数组
     * @throws {Error} 如果单位配置无效
     */
    parseUnits(unitsConfig) {
        if (!Array.isArray(unitsConfig)) {
            throw new Error('initialUnits 必须是数组');
        }

        const unitIds = new Set();
        
        return unitsConfig.map(unitConfig => {
            if (!unitConfig.type || !unitConfig.id || !unitConfig.position) {
                throw new Error('每个单位必须包含 type, id 和 position');
            }

            if (unitIds.has(unitConfig.id)) {
                throw new Error(`重复的单位 ID: ${unitConfig.id}`);
            }
            unitIds.add(unitConfig.id);

            return this.parseUnit(unitConfig);
        });
    }

    /**
     * 解析单个单位
     * @param {Object} unitConfig - 单位配置
     * @returns {import('./types.js').RepairVehicle|import('./types.js').Generator} 解析后的单位
     * @throws {Error} 如果单位类型无效
     */
    parseUnit(unitConfig) {
        const baseUnit = {
            id: unitConfig.id,
            position: {
                x: unitConfig.position.x,
                y: unitConfig.position.y
            },
            moveSpeed: unitConfig.moveSpeed || 5
        };

        switch (unitConfig.type) {
            case UnitType.REPAIR_VEHICLE:
                return {
                    ...baseUnit,
                    type: UnitType.REPAIR_VEHICLE,
                    capacity: unitConfig.capacity || 100,
                    currentLoad: unitConfig.currentLoad || 0,
                    repairSpeed: unitConfig.repairSpeed || 1,
                    fuel: unitConfig.fuel !== undefined ? unitConfig.fuel : 100,
                    maxFuel: unitConfig.maxFuel || 100
                };

            case UnitType.GENERATOR:
                return {
                    ...baseUnit,
                    type: UnitType.GENERATOR,
                    fuel: unitConfig.fuel !== undefined ? unitConfig.fuel : 100,
                    maxFuel: unitConfig.maxFuel || 100,
                    powerOutput: unitConfig.powerOutput || 100,
                    isDeployed: unitConfig.isDeployed || false
                };

            default:
                throw new Error(`未知的单位类型: ${unitConfig.type}`);
        }
    }

    /**
     * 解析评分规则
     * @param {Object} scoringConfig - 评分配置
     * @param {number} timeLimit - 时间限制
     * @returns {Object} 解析后的评分规则
     */
    parseScoring(scoringConfig, timeLimit) {
        const defaultScoring = {
            perfectTime: Math.floor(timeLimit * 0.3),
            goodTime: Math.floor(timeLimit * 0.6),
            perfectCoverage: 100,
            goodCoverage: 80
        };

        if (!scoringConfig) {
            return defaultScoring;
        }

        return {
            perfectTime: scoringConfig.perfectTime || defaultScoring.perfectTime,
            goodTime: scoringConfig.goodTime || defaultScoring.goodTime,
            perfectCoverage: scoringConfig.perfectCoverage || defaultScoring.perfectCoverage,
            goodCoverage: scoringConfig.goodCoverage || defaultScoring.goodCoverage
        };
    }

    /**
     * 验证配置的一致性
     * @param {import('./types.js').LevelConfig} config - 关卡配置
     * @throws {Error} 如果配置不一致
     */
    validateConfigConsistency(config) {
        const { grid, initialUnits } = config;

        for (const unit of initialUnits) {
            const { x, y } = unit.position;
            
            if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
                throw new Error(`单位 ${unit.id} 的位置 (${x}, ${y}) 超出网格范围`);
            }

            const cell = grid.cells[y][x];
            if (!cell.isPassable && cell.type !== CellType.BROADCAST_POINT) {
                throw new Error(`单位 ${unit.id} 的位置 (${x}, ${y}) 不可通行`);
            }
        }

        let hasBroadcastPoint = false;
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                if (grid.cells[y][x].hasBroadcast) {
                    hasBroadcastPoint = true;
                    break;
                }
            }
            if (hasBroadcastPoint) break;
        }

        if (!hasBroadcastPoint) {
            throw new Error('关卡中必须至少有一个广播点');
        }
    }

    /**
     * 将关卡配置转换为 JSON 字符串
     * @param {import('./types.js').LevelConfig} config - 关卡配置
     * @returns {string} JSON 字符串
     */
    stringify(config) {
        const simplifiedConfig = {
            ...config,
            version: this.version,
            grid: {
                ...config.grid,
                cells: config.grid.cells.map(row => 
                    row.map(cell => this.cellToSimplified(cell))
                )
            }
        };

        return JSON.stringify(simplifiedConfig, null, 2);
    }

    /**
     * 将格子对象转换为简化形式
     * @param {import('./types.js').Cell} cell - 格子对象
     * @returns {Object|string} 简化形式
     */
    cellToSimplified(cell) {
        const defaults = this.cellTypeToCell(cell.type);
        
        const diff = {};
        for (const [key, value] of Object.entries(cell)) {
            if (key !== 'type' && JSON.stringify(value) !== JSON.stringify(defaults[key])) {
                diff[key] = value;
            }
        }

        if (Object.keys(diff).length === 0) {
            return cell.type;
        }

        return {
            type: cell.type,
            ...diff
        };
    }
}

export default LevelParser;
