const Helpers = {
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    distance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    },

    getEventIcon(type) {
        const icons = {
            spawn: '🚶',
            exit: '✅',
            wrong_exit: '❌',
            patience_zero: '😡',
            congestion: '🚨',
            congestion_end: '✅',
            tool_used: '🔧',
            tool_removed: '🗑️',
            gate_toggle: '🚪',
            victory: '🎉',
            defeat: '😢',
            info: 'ℹ️',
            warning: '⚠️'
        };
        return icons[type] || '📌';
    },

    getColorByType(type) {
        return CONSTANTS.COLOR_VALUES[type] || '#888';
    },

    getColorName(type) {
        return CONSTANTS.COLOR_NAMES[type] || '未知';
    },

    validateLevelJson(jsonStr) {
        try {
            const level = JSON.parse(jsonStr);
            
            if (!level.name || typeof level.name !== 'string') {
                return { valid: false, error: '关卡缺少 name 字段' };
            }
            
            if (!level.objective || typeof level.objective !== 'string') {
                return { valid: false, error: '关卡缺少 objective 字段' };
            }
            
            if (!level.width || !level.height || level.width < 5 || level.height < 5) {
                return { valid: false, error: '关卡 width/height 无效 (最小 5x5)' };
            }
            
            if (!level.grid || !Array.isArray(level.grid)) {
                return { valid: false, error: '关卡缺少 grid 字段' };
            }
            
            if (level.grid.length !== level.height) {
                return { valid: false, error: 'grid 行数与 height 不匹配' };
            }
            
            for (let y = 0; y < level.grid.length; y++) {
                if (level.grid[y].length !== level.width) {
                    return { valid: false, error: `第 ${y} 行宽度与 width 不匹配` };
                }
            }
            
            if (!level.entrances || !Array.isArray(level.entrances) || level.entrances.length === 0) {
                return { valid: false, error: '关卡至少需要一个入口 (entrances)' };
            }
            
            if (!level.exits || !Array.isArray(level.exits) || level.exits.length === 0) {
                return { valid: false, error: '关卡至少需要一个出口 (exits)' };
            }
            
            if (!level.goals || !Array.isArray(level.goals) || level.goals.length === 0) {
                return { valid: false, error: '关卡缺少目标 (goals)' };
            }
            
            if (!level.spawnConfig) {
                return { valid: false, error: '关卡缺少 spawnConfig' };
            }
            
            if (!level.tools) {
                return { valid: false, error: '关卡缺少 tools 配置' };
            }
            
            return { valid: true, level };
        } catch (e) {
            return { valid: false, error: 'JSON 格式错误: ' + e.message };
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

if (typeof module !== 'undefined') {
    module.exports = Helpers;
}
