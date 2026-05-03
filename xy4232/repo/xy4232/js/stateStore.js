/**
 * 状态存储模块
 * 负责管理应用状态和本地存储
 */

const StateStore = {
    currentState: null,
    storageKey: 'exhibition_simulator_state',

    /**
     * 初始化状态存储
     */
    init() {
        this.currentState = this.createDefaultState();
        this.loadFromStorage();
        return this;
    },

    /**
     * 创建默认状态
     */
    createDefaultState() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            spaceModel: null,
            simulationState: null,
            settings: {
                simulationSpeed: 1,
                autoSave: true,
                theme: 'dark'
            }
        };
    },

    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.currentState };
    },

    /**
     * 更新状态
     */
    updateState(updates) {
        this.currentState = {
            ...this.currentState,
            ...updates,
            timestamp: Date.now()
        };

        if (this.currentState.settings.autoSave) {
            this.saveToStorage();
        }

        return this;
    },

    /**
     * 保存空间模型状态
     */
    saveSpaceModel() {
        this.currentState.spaceModel = SpaceModel.serialize();
        this.currentState.timestamp = Date.now();

        if (this.currentState.settings.autoSave) {
            this.saveToStorage();
        }

        return this;
    },

    /**
     * 保存仿真状态
     */
    saveSimulationState() {
        this.currentState.simulationState = {
            isRunning: SimulationEngine.isRunning,
            isPaused: SimulationEngine.isPaused,
            currentTimeSlot: SimulationEngine.currentTimeSlot,
            speed: SimulationEngine.speed,
            time: SimulationEngine.time
        };
        this.currentState.timestamp = Date.now();

        return this;
    },

    /**
     * 保存到本地存储
     */
    saveToStorage() {
        try {
            const stateToSave = {
                version: this.currentState.version,
                timestamp: this.currentState.timestamp,
                spaceModel: this.currentState.spaceModel,
                settings: this.currentState.settings
            };

            localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
            console.log('状态已保存到本地存储');
        } catch (error) {
            console.error('保存到本地存储失败:', error);
        }
    },

    /**
     * 从本地存储加载
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                
                if (parsed.spaceModel) {
                    SpaceModel.deserialize(parsed.spaceModel);
                }

                this.currentState = {
                    ...this.currentState,
                    ...parsed
                };

                console.log('状态已从本地存储加载');
                return true;
            }
        } catch (error) {
            console.error('从本地存储加载失败:', error);
        }
        return false;
    },

    /**
     * 清除本地存储
     */
    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            this.currentState = this.createDefaultState();
            console.log('本地存储已清除');
        } catch (error) {
            console.error('清除本地存储失败:', error);
        }
    },

    /**
     * 导出完整状态
     */
    exportFullState() {
        return {
            ...this.currentState,
            spaceModel: SpaceModel.serialize()
        };
    },

    /**
     * 导入状态
     */
    importState(state) {
        try {
            if (state.version && state.spaceModel) {
                SpaceModel.deserialize(state.spaceModel);
                this.currentState = {
                    ...this.createDefaultState(),
                    ...state
                };
                this.saveToStorage();
                return true;
            }
        } catch (error) {
            console.error('导入状态失败:', error);
        }
        return false;
    },

    /**
     * 获取设置
     */
    getSettings() {
        return { ...this.currentState.settings };
    },

    /**
     * 更新设置
     */
    updateSettings(settings) {
        this.currentState.settings = {
            ...this.currentState.settings,
            ...settings
        };
        this.currentState.timestamp = Date.now();
        this.saveToStorage();
        return this;
    },

    /**
     * 检查是否有保存的状态
     */
    hasSavedState() {
        return localStorage.getItem(this.storageKey) !== null;
    },

    /**
     * 获取最后保存时间
     */
    getLastSavedTime() {
        if (this.currentState.timestamp) {
            return new Date(this.currentState.timestamp).toLocaleString('zh-CN');
        }
        return null;
    }
};

// 导出为全局变量
window.StateStore = StateStore;
