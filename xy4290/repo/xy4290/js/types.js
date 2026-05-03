// 类型定义模块 - 定义游戏中使用的所有类型

/**
 * 坐标类型
 * @typedef {Object} Position
 * @property {number} x - X 坐标
 * @property {number} y - Y 坐标
 */

/**
 * 格子类型枚举
 * @readonly
 * @enum {string}
 */
export const CellType = {
    ROAD: 'road',
    BUILDING: 'building',
    WATER: 'water',
    BLOCKED: 'blocked',
    BROADCAST_POINT: 'broadcast_point',
    EMPTY: 'empty'
};

/**
 * 单位类型枚举
 * @readonly
 * @enum {string}
 */
export const UnitType = {
    REPAIR_VEHICLE: 'repair_vehicle',
    GENERATOR: 'generator'
};

/**
 * 指令类型枚举
 * @readonly
 * @enum {string}
 */
export const CommandType = {
    MOVE: 'move',
    REPAIR: 'repair',
    SUPPLY: 'supply',
    DEPLOY: 'deploy'
};

/**
 * 游戏状态枚举
 * @readonly
 * @enum {string}
 */
export const GameState = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    WON: 'won',
    LOST: 'lost'
};

/**
 * 格子数据
 * @typedef {Object} Cell
 * @property {CellType} type - 格子类型
 * @property {boolean} isPassable - 是否可通行
 * @property {boolean} isRepairable - 是否可修复
 * @property {number} repairCost - 修复成本（时间）
 * @property {boolean} hasBroadcast - 是否有广播点
 * @property {boolean} isBroadcastActive - 广播点是否激活
 * @property {number} broadcastRange - 广播覆盖范围
 */

/**
 * 单位基础数据
 * @typedef {Object} BaseUnit
 * @property {string} id - 单位唯一标识
 * @property {UnitType} type - 单位类型
 * @property {Position} position - 当前位置
 * @property {number} moveSpeed - 移动速度（每格耗时）
 */

/**
 * 维修车数据
 * @typedef {BaseUnit & Object} RepairVehicle
 * @property {UnitType.REPAIR_VEHICLE} type - 单位类型
 * @property {number} capacity - 载重能力
 * @property {number} currentLoad - 当前载重
 * @property {number} repairSpeed - 修复速度
 * @property {number} fuel - 剩余油量
 * @property {number} maxFuel - 最大油量
 */

/**
 * 发电机数据
 * @typedef {BaseUnit & Object} Generator
 * @property {UnitType.GENERATOR} type - 单位类型
 * @property {number} fuel - 剩余油量
 * @property {number} maxFuel - 最大油量
 * @property {number} powerOutput - 输出功率
 * @property {boolean} isDeployed - 是否已部署
 */

/**
 * 指令数据
 * @typedef {Object} Command
 * @property {string} id - 指令唯一标识
 * @property {CommandType} type - 指令类型
 * @property {string} unitId - 执行单位的 ID
 * @property {Position} target - 目标位置
 * @property {number} estimatedTime - 预计耗时
 * @property {Object} [options] - 额外选项
 */

/**
 * 关卡配置
 * @typedef {Object} LevelConfig
 * @property {string} id - 关卡 ID
 * @property {string} name - 关卡名称
 * @property {string} description - 关卡描述
 * @property {number} timeLimit - 时间限制（秒）
 * @property {number} targetCoverage - 目标覆盖率（百分比）
 * @property {Object} grid - 网格配置
 * @property {number} grid.width - 网格宽度
 * @property {number} grid.height - 网格高度
 * @property {Cell[][]} grid.cells - 格子数据
 * @property {Object[]} initialUnits - 初始单位
 * @property {Object} scoring - 评分规则
 * @property {number} scoring.perfectTime - 完美时间（秒）
 * @property {number} scoring.goodTime - 良好时间（秒）
 * @property {number} scoring.perfectCoverage - 完美覆盖率
 * @property {number} scoring.goodCoverage - 良好覆盖率
 */

/**
 * 游戏状态快照
 * @typedef {Object} GameSnapshot
 * @property {number} timestamp - 时间戳
 * @property {number} currentTime - 当前时间
 * @property {Cell[][]} cells - 格子状态
 * @property {(RepairVehicle|Generator)[]} units - 单位状态
 * @property {Command[]} pendingCommands - 待执行指令
 * @property {number} coverage - 当前覆盖率
 * @property {GameState} gameState - 游戏状态
 */

/**
 * 校验结果
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 是否有效
 * @property {string} [error] - 错误信息
 * @property {Object} [details] - 详细信息
 */

/**
 * 评分结果
 * @typedef {Object} ScoreResult
 * @property {number} totalScore - 总分
 * @property {string} grade - 评级 (S/A/B/C/D)
 * @property {Object} breakdown - 分数明细
 * @property {number} breakdown.coverageScore - 覆盖率分数
 * @property {number} breakdown.timeScore - 时间分数
 * @property {number} breakdown.efficiencyScore - 效率分数
 */

/**
 * 存档数据
 * @typedef {Object} SaveData
 * @property {string} levelId - 关卡 ID
 * @property {GameSnapshot} snapshot - 游戏快照
 * @property {number} savedAt - 保存时间戳
 * @property {string} version - 存档版本
 */
