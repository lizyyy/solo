// 存档模块 - 负责本地保存和加载游戏进度

/**
 * 存档管理器类
 */
export class SaveManager {
    constructor() {
        this.storageKeyPrefix = 'emergency_broadcast_save_';
        this.version = '1.0.0';
    }

    /**
     * 保存游戏进度
     * @param {string} levelId - 关卡 ID
     * @param {import('./types.js').GameSnapshot} snapshot - 游戏状态快照
     * @returns {boolean} 是否保存成功
     */
    save(levelId, snapshot) {
        try {
            const saveData = {
                levelId,
                snapshot,
                savedAt: Date.now(),
                version: this.version
            };

            const key = this.getSaveKey(levelId);
            const jsonString = JSON.stringify(saveData);
            
            localStorage.setItem(key, jsonString);
            
            this.updateSaveList(levelId);
            
            return true;
        } catch (error) {
            console.error('保存游戏进度失败:', error);
            return false;
        }
    }

    /**
     * 加载游戏进度
     * @param {string} levelId - 关卡 ID
     * @returns {import('./types.js').SaveData|null} 存档数据，如果不存在则返回 null
     */
    load(levelId) {
        try {
            const key = this.getSaveKey(levelId);
            const jsonString = localStorage.getItem(key);
            
            if (!jsonString) {
                return null;
            }

            const saveData = JSON.parse(jsonString);
            
            if (!this.validateSaveData(saveData)) {
                console.warn('存档数据格式不正确');
                return null;
            }

            return saveData;
        } catch (error) {
            console.error('加载游戏进度失败:', error);
            return null;
        }
    }

    /**
     * 检查是否存在存档
     * @param {string} levelId - 关卡 ID
     * @returns {boolean} 是否存在存档
     */
    hasSave(levelId) {
        const key = this.getSaveKey(levelId);
        return localStorage.getItem(key) !== null;
    }

    /**
     * 删除存档
     * @param {string} levelId - 关卡 ID
     * @returns {boolean} 是否删除成功
     */
    deleteSave(levelId) {
        try {
            const key = this.getSaveKey(levelId);
            localStorage.removeItem(key);
            
            this.removeFromSaveList(levelId);
            
            return true;
        } catch (error) {
            console.error('删除存档失败:', error);
            return false;
        }
    }

    /**
     * 获取所有存档列表
     * @returns {Array<{levelId: string, savedAt: number, version: string}>} 存档列表
     */
    getSaveList() {
        try {
            const listJson = localStorage.getItem(this.getSaveListKey());
            if (!listJson) {
                return [];
            }
            return JSON.parse(listJson);
        } catch (error) {
            console.error('获取存档列表失败:', error);
            return [];
        }
    }

    /**
     * 更新存档列表
     * @param {string} levelId - 关卡 ID
     */
    updateSaveList(levelId) {
        const saveList = this.getSaveList();
        const existingIndex = saveList.findIndex(item => item.levelId === levelId);
        
        const saveData = this.load(levelId);
        const listItem = {
            levelId,
            savedAt: saveData ? saveData.savedAt : Date.now(),
            version: this.version
        };

        if (existingIndex >= 0) {
            saveList[existingIndex] = listItem;
        } else {
            saveList.push(listItem);
        }

        localStorage.setItem(this.getSaveListKey(), JSON.stringify(saveList));
    }

    /**
     * 从存档列表中移除
     * @param {string} levelId - 关卡 ID
     */
    removeFromSaveList(levelId) {
        const saveList = this.getSaveList();
        const filteredList = saveList.filter(item => item.levelId !== levelId);
        localStorage.setItem(this.getSaveListKey(), JSON.stringify(filteredList));
    }

    /**
     * 验证存档数据
     * @param {Object} saveData - 存档数据
     * @returns {boolean} 是否有效
     */
    validateSaveData(saveData) {
        if (!saveData || typeof saveData !== 'object') {
            return false;
        }

        if (!saveData.levelId || typeof saveData.levelId !== 'string') {
            return false;
        }

        if (!saveData.snapshot || typeof saveData.snapshot !== 'object') {
            return false;
        }

        const { snapshot } = saveData;
        if (!snapshot.cells || !Array.isArray(snapshot.cells)) {
            return false;
        }
        if (!snapshot.units || !Array.isArray(snapshot.units)) {
            return false;
        }
        if (typeof snapshot.currentTime !== 'number') {
            return false;
        }
        if (typeof snapshot.coverage !== 'number') {
            return false;
        }

        return true;
    }

    /**
     * 获取存档存储键
     * @param {string} levelId - 关卡 ID
     * @returns {string} 存储键
     */
    getSaveKey(levelId) {
        return `${this.storageKeyPrefix}${levelId}`;
    }

    /**
     * 获取存档列表存储键
     * @returns {string} 存储键
     */
    getSaveListKey() {
        return `${this.storageKeyPrefix}list`;
    }

    /**
     * 清空所有存档
     * @returns {boolean} 是否清空成功
     */
    clearAllSaves() {
        try {
            const saveList = this.getSaveList();
            
            for (const item of saveList) {
                const key = this.getSaveKey(item.levelId);
                localStorage.removeItem(key);
            }
            
            localStorage.removeItem(this.getSaveListKey());
            
            return true;
        } catch (error) {
            console.error('清空存档失败:', error);
            return false;
        }
    }

    /**
     * 获取存档的总大小
     * @returns {number} 总大小（字节）
     */
    getTotalSize() {
        let totalSize = 0;
        
        try {
            const saveList = this.getSaveList();
            
            for (const item of saveList) {
                const key = this.getSaveKey(item.levelId);
                const data = localStorage.getItem(key);
                if (data) {
                    totalSize += new Blob([data]).size;
                }
            }
            
            const listData = localStorage.getItem(this.getSaveListKey());
            if (listData) {
                totalSize += new Blob([listData]).size;
            }
        } catch (error) {
            console.error('计算存档大小失败:', error);
        }
        
        return totalSize;
    }

    /**
     * 导出存档为 JSON 字符串
     * @param {string} levelId - 关卡 ID
     * @returns {string|null} JSON 字符串，如果不存在则返回 null
     */
    exportSave(levelId) {
        const saveData = this.load(levelId);
        if (!saveData) {
            return null;
        }
        return JSON.stringify(saveData, null, 2);
    }

    /**
     * 从 JSON 字符串导入存档
     * @param {string} jsonString - JSON 字符串
     * @returns {boolean} 是否导入成功
     */
    importSave(jsonString) {
        try {
            const saveData = JSON.parse(jsonString);
            
            if (!this.validateSaveData(saveData)) {
                throw new Error('存档数据格式不正确');
            }

            return this.save(saveData.levelId, saveData.snapshot);
        } catch (error) {
            console.error('导入存档失败:', error);
            return false;
        }
    }
}

export default SaveManager;
