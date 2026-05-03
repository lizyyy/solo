// 导入导出模块 - 负责关卡的导入和导出功能

import { LevelParser } from './levelParser.js';

/**
 * 导入导出管理器类
 */
export class ImportExportManager {
    constructor() {
        this.levelParser = new LevelParser();
    }

    /**
     * 导出关卡配置为 JSON 文件
     * @param {import('./types.js').LevelConfig} levelConfig - 关卡配置
     * @param {string} [filename] - 文件名（可选）
     * @returns {boolean} 是否导出成功
     */
    exportLevel(levelConfig, filename) {
        try {
            const jsonString = this.levelParser.stringify(levelConfig);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            const url = URL.createObjectURL(blob);
            
            const actualFilename = filename || `${levelConfig.id}_${levelConfig.name.replace(/\s+/g, '_')}.json`;
            
            const link = document.createElement('a');
            link.href = url;
            link.download = actualFilename;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('导出关卡失败:', error);
            return false;
        }
    }

    /**
     * 从文件导入关卡
     * @param {File} file - 文件对象
     * @returns {Promise<import('./types.js').LevelConfig>} 解析后的关卡配置
     */
    importLevelFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('没有选择文件'));
                return;
            }

            if (!file.name.endsWith('.json')) {
                reject(new Error('文件格式不正确，请选择 .json 文件'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const jsonString = event.target.result;
                    const levelConfig = this.levelParser.parse(jsonString);
                    resolve(levelConfig);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * 从 JSON 字符串导入关卡
     * @param {string} jsonString - JSON 字符串
     * @returns {import('./types.js').LevelConfig} 解析后的关卡配置
     */
    importLevelFromString(jsonString) {
        try {
            return this.levelParser.parse(jsonString);
        } catch (error) {
            console.error('从字符串导入关卡失败:', error);
            throw error;
        }
    }

    /**
     * 触发文件选择对话框
     * @param {Function} onSuccess - 成功回调
     * @param {Function} onError - 错误回调
     */
    triggerFileSelection(onSuccess, onError) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                if (onError) onError(new Error('没有选择文件'));
                return;
            }

            try {
                const levelConfig = await this.importLevelFromFile(file);
                if (onSuccess) onSuccess(levelConfig);
            } catch (error) {
                if (onError) onError(error);
            }
        };

        input.click();
    }

    /**
     * 验证关卡配置
     * @param {import('./types.js').LevelConfig} levelConfig - 关卡配置
     * @returns {{valid: boolean, errors: string[]}} 验证结果
     */
    validateLevel(levelConfig) {
        const errors = [];

        try {
            if (!levelConfig.id || typeof levelConfig.id !== 'string') {
                errors.push('关卡 ID 必须是非空字符串');
            }

            if (!levelConfig.name || typeof levelConfig.name !== 'string') {
                errors.push('关卡名称必须是非空字符串');
            }

            if (!levelConfig.timeLimit || typeof levelConfig.timeLimit !== 'number' || levelConfig.timeLimit <= 0) {
                errors.push('时间限制必须是大于 0 的数字');
            }

            if (!levelConfig.grid || !levelConfig.grid.width || !levelConfig.grid.height || !levelConfig.grid.cells) {
                errors.push('网格配置不完整');
            } else {
                const { width, height, cells } = levelConfig.grid;
                
                if (!Array.isArray(cells) || cells.length !== height) {
                    errors.push(`单元格数组长度必须等于高度 ${height}`);
                } else {
                    for (let y = 0; y < cells.length; y++) {
                        const row = cells[y];
                        if (!Array.isArray(row) || row.length !== width) {
                            errors.push(`第 ${y} 行的长度必须等于宽度 ${width}`);
                        }
                    }
                }
            }

            if (!levelConfig.initialUnits || !Array.isArray(levelConfig.initialUnits)) {
                errors.push('初始单位配置必须是数组');
            } else {
                const unitIds = new Set();
                for (const unit of levelConfig.initialUnits) {
                    if (!unit.id || typeof unit.id !== 'string') {
                        errors.push('每个单位必须有字符串类型的 ID');
                    } else if (unitIds.has(unit.id)) {
                        errors.push(`重复的单位 ID: ${unit.id}`);
                    } else {
                        unitIds.add(unit.id);
                    }

                    if (!unit.type || !['repair_vehicle', 'generator'].includes(unit.type)) {
                        errors.push(`无效的单位类型: ${unit.type}`);
                    }

                    if (!unit.position || typeof unit.position.x !== 'number' || typeof unit.position.y !== 'number') {
                        errors.push('每个单位必须有有效的位置坐标');
                    }
                }
            }

            if (levelConfig.grid && levelConfig.grid.cells) {
                let hasBroadcastPoint = false;
                for (const row of levelConfig.grid.cells) {
                    for (const cell of row) {
                        if (cell && (cell.hasBroadcast || cell.type === 'broadcast_point')) {
                            hasBroadcastPoint = true;
                            break;
                        }
                    }
                    if (hasBroadcastPoint) break;
                }

                if (!hasBroadcastPoint) {
                    errors.push('关卡中必须至少有一个广播点');
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        } catch (error) {
            return {
                valid: false,
                errors: [`验证过程出错: ${error.message}`]
            };
        }
    }

    /**
     * 创建关卡模板
     * @param {Object} options - 选项
     * @param {string} options.id - 关卡 ID
     * @param {string} options.name - 关卡名称
     * @param {number} options.width - 网格宽度
     * @param {number} options.height - 网格高度
     * @param {number} options.timeLimit - 时间限制
     * @returns {import('./types.js').LevelConfig} 关卡模板
     */
    createLevelTemplate(options) {
        const { id, name, width = 8, height = 8, timeLimit = 300 } = options;

        const cells = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    row.push({
                        type: 'building',
                        isPassable: false,
                        isRepairable: false,
                        repairCost: 0,
                        hasBroadcast: false,
                        isBroadcastActive: false,
                        broadcastRange: 0
                    });
                } else {
                    row.push({
                        type: 'road',
                        isPassable: true,
                        isRepairable: false,
                        repairCost: 0,
                        hasBroadcast: false,
                        isBroadcastActive: false,
                        broadcastRange: 0
                    });
                }
            }
            cells.push(row);
        }

        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        cells[centerY][centerX] = {
            type: 'broadcast_point',
            isPassable: true,
            isRepairable: false,
            repairCost: 0,
            hasBroadcast: true,
            isBroadcastActive: false,
            broadcastRange: 2
        };

        return {
            id,
            name,
            description: '这是一个模板关卡，请根据需要修改配置',
            timeLimit,
            targetCoverage: 80,
            grid: {
                width,
                height,
                cells
            },
            initialUnits: [
                {
                    id: 'repair_1',
                    type: 'repair_vehicle',
                    position: { x: 1, y: 1 },
                    moveSpeed: 5,
                    capacity: 100,
                    currentLoad: 0,
                    repairSpeed: 1,
                    fuel: 100,
                    maxFuel: 100
                },
                {
                    id: 'generator_1',
                    type: 'generator',
                    position: { x: width - 2, y: 1 },
                    moveSpeed: 5,
                    fuel: 100,
                    maxFuel: 100,
                    powerOutput: 100,
                    isDeployed: false
                }
            ],
            scoring: {
                perfectTime: Math.floor(timeLimit * 0.3),
                goodTime: Math.floor(timeLimit * 0.6),
                perfectCoverage: 100,
                goodCoverage: 80
            }
        };
    }

    /**
     * 导出多个关卡为一个 ZIP 文件
     * @param {import('./types.js').LevelConfig[]} levelConfigs - 关卡配置数组
     * @param {string} [filename] - ZIP 文件名
     * @returns {boolean} 是否导出成功
     * @note 此功能需要额外的 ZIP 库支持，当前实现仅导出第一个关卡
     */
    exportLevelsAsZip(levelConfigs, filename) {
        console.warn('导出为 ZIP 需要额外的库支持，当前仅导出第一个关卡');
        
        if (levelConfigs.length === 0) {
            return false;
        }

        return this.exportLevel(levelConfigs[0], filename);
    }

    /**
     * 从剪贴板导入关卡
     * @returns {Promise<import('./types.js').LevelConfig>} 解析后的关卡配置
     */
    async importFromClipboard() {
        try {
            if (!navigator.clipboard) {
                throw new Error('浏览器不支持剪贴板 API');
            }

            const text = await navigator.clipboard.readText();
            
            if (!text || text.trim().length === 0) {
                throw new Error('剪贴板为空');
            }

            return this.importLevelFromString(text);
        } catch (error) {
            console.error('从剪贴板导入失败:', error);
            throw error;
        }
    }

    /**
     * 导出关卡到剪贴板
     * @param {import('./types.js').LevelConfig} levelConfig - 关卡配置
     * @returns {Promise<boolean>} 是否导出成功
     */
    async exportToClipboard(levelConfig) {
        try {
            if (!navigator.clipboard) {
                throw new Error('浏览器不支持剪贴板 API');
            }

            const jsonString = this.levelParser.stringify(levelConfig);
            await navigator.clipboard.writeText(jsonString);
            
            return true;
        } catch (error) {
            console.error('导出到剪贴板失败:', error);
            throw error;
        }
    }
}

export default ImportExportManager;
