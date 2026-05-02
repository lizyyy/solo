const LEVELS_STORAGE_KEY = 'movable_type_levels';
const CUSTOM_LEVELS_KEY = 'movable_type_custom_levels';

export class LevelData {
    constructor() {
        this.builtInLevels = [];
        this.customLevels = [];
        this.levels = [];
        this.currentLevelIndex = -1;
    }

    async init() {
        await this.loadBuiltInLevels();
        this.loadCustomLevels();
        this.mergeLevels();
    }

    async loadBuiltInLevels() {
        try {
            const response = await fetch('data/levels.json');
            if (response.ok) {
                this.builtInLevels = await response.json();
            }
        } catch (error) {
            console.warn('无法加载内置关卡数据:', error);
            this.builtInLevels = this.getDefaultLevels();
        }
    }

    getDefaultLevels() {
        return [
            {
                id: 'level_001',
                title: '第1关: 三人行',
                description: '还原论语经典',
                hint: '子曰：三人行，必有我师焉',
                difficulty: 1,
                gridSize: { rows: 3, cols: 4 },
                targetSentence: '三人行必有我师',
                characterPool: ['三', '人', '行', '必', '有', '我', '师', '焉', '曰', '子'],
                forbiddenCells: [],
                punctuationDirection: 'horizontal',
                maxSteps: 20,
                targetTime: 60,
                isCustom: false
            }
        ];
    }

    loadCustomLevels() {
        try {
            const saved = localStorage.getItem(CUSTOM_LEVELS_KEY);
            if (saved) {
                this.customLevels = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('无法加载自定义关卡:', error);
            this.customLevels = [];
        }
    }

    mergeLevels() {
        this.levels = [...this.builtInLevels, ...this.customLevels];
        this.levels.forEach((level, index) => {
            level.index = index;
        });
    }

    getAllLevels() {
        return this.levels;
    }

    getLevel(index) {
        if (index >= 0 && index < this.levels.length) {
            this.currentLevelIndex = index;
            return JSON.parse(JSON.stringify(this.levels[index]));
        }
        return null;
    }

    getCurrentLevel() {
        if (this.currentLevelIndex >= 0) {
            return this.getLevel(this.currentLevelIndex);
        }
        return null;
    }

    getNextLevel() {
        if (this.currentLevelIndex < this.levels.length - 1) {
            return this.getLevel(this.currentLevelIndex + 1);
        }
        return null;
    }

    hasNextLevel() {
        return this.currentLevelIndex < this.levels.length - 1;
    }

    addCustomLevel(levelData) {
        const level = {
            ...levelData,
            id: `custom_${Date.now()}`,
            isCustom: true
        };
        this.customLevels.push(level);
        this.saveCustomLevels();
        this.mergeLevels();
        return level;
    }

    saveCustomLevels() {
        try {
            localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(this.customLevels));
        } catch (error) {
            console.error('保存自定义关卡失败:', error);
        }
    }

    removeCustomLevel(levelId) {
        this.customLevels = this.customLevels.filter(l => l.id !== levelId);
        this.saveCustomLevels();
        this.mergeLevels();
    }

    exportLevelTemplate() {
        const template = {
            id: 'custom_level_template',
            title: '自定义关卡标题',
            description: '关卡描述',
            hint: '提示信息，帮助玩家理解目标',
            difficulty: 1,
            gridSize: { rows: 3, cols: 4 },
            targetSentence: '目标句子，不含标点',
            characterPool: ['字1', '字2', '字3', '字4'],
            forbiddenCells: [
                { row: 0, col: 0, reason: '此格不可放置活字' }
            ],
            punctuationDirection: 'horizontal',
            maxSteps: 20,
            targetTime: 60
        };
        return JSON.stringify(template, null, 2);
    }

    validateLevelData(data) {
        const requiredFields = ['title', 'targetSentence', 'characterPool', 'gridSize'];
        const missingFields = requiredFields.filter(field => !(field in data));
        
        if (missingFields.length > 0) {
            return {
                valid: false,
                error: `缺少必填字段: ${missingFields.join(', ')}`
            };
        }

        if (!data.gridSize.rows || !data.gridSize.cols) {
            return { valid: false, error: 'gridSize 必须包含 rows 和 cols' };
        }

        if (data.targetSentence.length > data.gridSize.rows * data.gridSize.cols) {
            return { valid: false, error: '目标句子长度超过版心容量' };
        }

        if (!Array.isArray(data.characterPool)) {
            return { valid: false, error: 'characterPool 必须是数组' };
        }

        if (data.forbiddenCells && !Array.isArray(data.forbiddenCells)) {
            return { valid: false, error: 'forbiddenCells 必须是数组' };
        }

        return { valid: true };
    }

    importLevelFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const validation = this.validateLevelData(data);
            
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const level = this.addCustomLevel(data);
            return { success: true, level };
        } catch (error) {
            return { success: false, error: 'JSON 格式错误: ' + error.message };
        }
    }

    exportLevelToJSON(levelIndex) {
        const level = this.getLevel(levelIndex);
        if (!level) {
            return null;
        }
        return JSON.stringify(level, null, 2);
    }

    getBuiltInLevels() {
        return this.builtInLevels;
    }

    getCustomLevels() {
        return this.customLevels;
    }
}