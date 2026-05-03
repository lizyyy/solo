import { LevelParser } from './parser.js';

export class LevelManager {
    constructor() {
        this.parser = new LevelParser();
        this.builtInLevels = [];
        this.customLevels = [];
        this.currentLevel = null;
        this.levelDataCache = new Map();
    }

    async initialize() {
        await this.loadBuiltInLevels();
        this.loadCustomLevelsFromStorage();
    }

    async loadBuiltInLevels() {
        try {
            const levelList = [
                { id: 'tutorial', path: 'src/levels/data/tutorial.json' },
                { id: 'beginner_1', path: 'src/levels/data/beginner_1.json' }
            ];

            for (const levelInfo of levelList) {
                try {
                    const response = await fetch(levelInfo.path);
                    if (response.ok) {
                        const levelData = await response.json();
                        const parsedLevel = this.parser.parse(levelData);
                        const validation = this.parser.validateLevel(parsedLevel);
                        
                        if (validation.isValid) {
                            this.builtInLevels.push({
                                id: parsedLevel.id,
                                name: parsedLevel.name,
                                description: parsedLevel.description,
                                level: parsedLevel
                            });
                            this.levelDataCache.set(parsedLevel.id, parsedLevel);
                        } else {
                            console.warn(`关卡 ${levelInfo.id} 验证失败:`, validation.errors);
                        }
                    }
                } catch (error) {
                    console.error(`加载关卡 ${levelInfo.id} 失败:`, error);
                }
            }
        } catch (error) {
            console.error('加载内置关卡失败:', error);
        }
    }

    loadCustomLevelsFromStorage() {
        try {
            const stored = localStorage.getItem('metroCustomLevels');
            if (stored) {
                this.customLevels = JSON.parse(stored);
                this.customLevels.forEach(levelData => {
                    try {
                        const parsedLevel = this.parser.parse(levelData);
                        const validation = this.parser.validateLevel(parsedLevel);
                        if (validation.isValid) {
                            this.levelDataCache.set(parsedLevel.id, parsedLevel);
                        }
                    } catch (error) {
                        console.error(`解析自定义关卡 ${levelData.id} 失败:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('加载自定义关卡失败:', error);
            this.customLevels = [];
        }
    }

    saveCustomLevel(levelData) {
        try {
            const parsedLevel = this.parser.parse(levelData);
            const validation = this.parser.validateLevel(parsedLevel);
            
            if (!validation.isValid) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }

            const existingIndex = this.customLevels.findIndex(l => l.id === levelData.id);
            if (existingIndex >= 0) {
                this.customLevels[existingIndex] = levelData;
            } else {
                this.customLevels.push(levelData);
            }

            localStorage.setItem('metroCustomLevels', JSON.stringify(this.customLevels));
            this.levelDataCache.set(parsedLevel.id, parsedLevel);

            return {
                success: true,
                level: parsedLevel
            };
        } catch (error) {
            return {
                success: false,
                errors: [error.message]
            };
        }
    }

    deleteCustomLevel(levelId) {
        const index = this.customLevels.findIndex(l => l.id === levelId);
        if (index >= 0) {
            this.customLevels.splice(index, 1);
            localStorage.setItem('metroCustomLevels', JSON.stringify(this.customLevels));
            this.levelDataCache.delete(levelId);
            return true;
        }
        return false;
    }

    getLevelById(levelId) {
        if (this.levelDataCache.has(levelId)) {
            return this.levelDataCache.get(levelId);
        }

        const builtIn = this.builtInLevels.find(l => l.id === levelId);
        if (builtIn) {
            return builtIn.level;
        }

        const custom = this.customLevels.find(l => l.id === levelId);
        if (custom) {
            try {
                const parsed = this.parser.parse(custom);
                this.levelDataCache.set(levelId, parsed);
                return parsed;
            } catch (error) {
                console.error('解析自定义关卡失败:', error);
            }
        }

        return null;
    }

    getLevelList() {
        return {
            builtIn: this.builtInLevels.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description
            })),
            custom: this.customLevels.map(l => ({
                id: l.id,
                name: l.name,
                description: l.description || ''
            }))
        };
    }

    async setCurrentLevel(levelId) {
        const level = this.getLevelById(levelId);
        if (level) {
            this.currentLevel = JSON.parse(JSON.stringify(level));
            return this.currentLevel;
        }
        return null;
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

    exportCurrentLevel() {
        if (!this.currentLevel) {
            return null;
        }

        const exportData = {
            id: this.currentLevel.id,
            name: this.currentLevel.name,
            description: this.currentLevel.description,
            grid: this.currentLevel.grid.map(row => 
                row.map(cell => {
                    if (cell.type === 'empty') return 'E';
                    let typeChar = '';
                    switch (cell.type) {
                        case 'track': typeChar = 'T'; break;
                        case 'station': typeChar = 'S'; break;
                        case 'junction': typeChar = 'J'; break;
                        case 'depot': typeChar = 'D'; break;
                        case 'terminus': typeChar = 'X'; break;
                        default: typeChar = 'T';
                    }
                    const connections = cell.connections.join('');
                    return `${typeChar}-${connections}`;
                })
            ),
            maintenanceCars: this.currentLevel.maintenanceCars.map(car => ({
                id: car.id,
                name: car.name,
                x: car.x,
                y: car.y,
                battery: car.battery,
                maxBattery: car.maxBattery,
                movementCost: car.movementCost,
                repairCost: car.repairCost
            })),
            lastTrains: this.currentLevel.lastTrains.map(train => ({
                id: train.id,
                name: train.name,
                route: train.route,
                startTime: train.startTime,
                speed: train.speed
            })),
            criticalSegments: this.currentLevel.criticalSegments.map(segment => ({
                id: segment.id,
                x: segment.x,
                y: segment.y,
                repairTime: segment.repairTime,
                deadline: segment.deadline,
                priority: segment.priority
            })),
            winConditions: this.currentLevel.winConditions,
            timeLimit: this.currentLevel.timeLimit,
            startingTurn: this.currentLevel.startingTurn
        };

        return JSON.stringify(exportData, null, 2);
    }

    validateLevelData(levelData) {
        try {
            const parsedLevel = this.parser.parse(levelData);
            return this.parser.validateLevel(parsedLevel);
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: []
            };
        }
    }
}
