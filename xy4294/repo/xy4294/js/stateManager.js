/**
 * 状态管理模块
 * 负责管理应用的状态、事件订阅和数据变更
 */

const StateManager = (function() {
    'use strict';

    /**
     * 应用状态
     */
    let state = {
        data: {
            racks: null,
            temperature: null,
            trajectory: null,
            expiring: null
        },
        riskAnalysis: null,
        selectedSlot: null,
        filters: {
            riskLevel: 'all',
            riskType: 'all',
            area: 'all',
            sku: ''
        },
        display: {
            showHeatmap: true,
            showPath: true,
            opacity: 1.0
        },
        timeline: {
            currentIndex: 0,
            isPlaying: false,
            speed: 1.0,
            timestamps: [],
            startTime: null,
            endTime: null
        },
        marks: new Map(),
        loadedFiles: {
            racks: null,
            temperature: null,
            trajectory: null,
            expiring: null
        }
    };

    /**
     * 事件订阅者
     */
    const subscribers = new Map();

    /**
     * 事件类型
     */
    const EVENTS = {
        DATA_LOADED: 'data:loaded',
        RACKS_LOADED: 'racks:loaded',
        TEMPERATURE_LOADED: 'temperature:loaded',
        TRAJECTORY_LOADED: 'trajectory:loaded',
        EXPIRING_LOADED: 'expiring:loaded',
        RISK_ANALYZED: 'risk:analyzed',
        SLOT_SELECTED: 'slot:selected',
        SLOT_DESELECTED: 'slot:deselected',
        FILTER_CHANGED: 'filter:changed',
        DISPLAY_CHANGED: 'display:changed',
        TIMELINE_CHANGED: 'timeline:changed',
        TIMELINE_PLAY: 'timeline:play',
        TIMELINE_PAUSE: 'timeline:pause',
        MARK_ADDED: 'mark:added',
        MARK_REMOVED: 'mark:removed',
        STATE_RESET: 'state:reset'
    };

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    function subscribe(event, callback) {
        if (!subscribers.has(event)) {
            subscribers.set(event, new Set());
        }
        subscribers.get(event).add(callback);
        
        return () => {
            if (subscribers.has(event)) {
                subscribers.get(event).delete(callback);
            }
        };
    }

    /**
     * 发布事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    function publish(event, data) {
        if (subscribers.has(event)) {
            subscribers.get(event).forEach(callback => {
                try {
                    callback(data, event);
                } catch (error) {
                    console.error(`事件 "${event}" 处理错误:`, error);
                }
            });
        }
    }

    /**
     * 设置货架数据
     * @param {Object} racksData - 货架数据
     */
    function setRacksData(racksData) {
        state.data.racks = racksData;
        publish(EVENTS.RACKS_LOADED, racksData);
        
        if (racksData && racksData.areas) {
            updateAreaOptions(racksData.areas);
        }
        
        checkAllDataLoaded();
    }

    /**
     * 设置温度数据
     * @param {Object} tempData - 温度数据
     */
    function setTemperatureData(tempData) {
        state.data.temperature = tempData;
        publish(EVENTS.TEMPERATURE_LOADED, tempData);
        
        if (tempData && tempData.timestamps && tempData.timestamps.length > 0) {
            updateTimeline(tempData.timestamps);
        }
        
        checkAllDataLoaded();
    }

    /**
     * 设置轨迹数据
     * @param {Object} trajectoryData - 轨迹数据
     */
    function setTrajectoryData(trajectoryData) {
        state.data.trajectory = trajectoryData;
        publish(EVENTS.TRAJECTORY_LOADED, trajectoryData);
        
        if (trajectoryData && trajectoryData.timestamps && trajectoryData.timestamps.length > 0) {
            updateTimeline(trajectoryData.timestamps);
        }
        
        checkAllDataLoaded();
    }

    /**
     * 设置临期货品数据
     * @param {Object} expiringData - 临期货品数据
     */
    function setExpiringData(expiringData) {
        state.data.expiring = expiringData;
        publish(EVENTS.EXPIRING_LOADED, expiringData);
        checkAllDataLoaded();
    }

    /**
     * 检查所有数据是否已加载，并执行风险分析
     */
    function checkAllDataLoaded() {
        if (state.data.racks) {
            publish(EVENTS.DATA_LOADED, {
                racks: state.data.racks,
                temperature: state.data.temperature,
                trajectory: state.data.trajectory,
                expiring: state.data.expiring
            });
            
            analyzeRisks();
        }
    }

    /**
     * 执行风险分析
     */
    function analyzeRisks() {
        if (!window.RiskRules) {
            console.warn('RiskRules 模块未加载');
            return;
        }

        state.riskAnalysis = RiskRules.analyzeAllRisks(state.data);
        publish(EVENTS.RISK_ANALYZED, state.riskAnalysis);
    }

    /**
     * 更新时间轴
     * @param {Array} timestamps - 时间戳数组
     */
    function updateTimeline(timestamps) {
        if (!timestamps || timestamps.length === 0) return;

        const existingTimestamps = state.timeline.timestamps;
        const allTimestamps = [...new Set([...existingTimestamps, ...timestamps])]
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        state.timeline.timestamps = allTimestamps;
        state.timeline.currentIndex = 0;
        state.timeline.startTime = allTimestamps[0];
        state.timeline.endTime = allTimestamps[allTimestamps.length - 1];

        publish(EVENTS.TIMELINE_CHANGED, {
            ...state.timeline
        });
    }

    /**
     * 更新区域选项
     * @param {Array} areas - 区域数组
     */
    function updateAreaOptions(areas) {
        publish('areas:updated', areas);
    }

    /**
     * 选择货位
     * @param {string} slotKey - 货位标识
     * @param {Object} slotData - 货位数据
     */
    function selectSlot(slotKey, slotData = null) {
        state.selectedSlot = {
            key: slotKey,
            data: slotData,
            risks: getSlotRisks(slotKey),
            expiring: getSlotExpiringProducts(slotKey),
            temperature: getSlotTemperature(slotKey)
        };
        publish(EVENTS.SLOT_SELECTED, state.selectedSlot);
    }

    /**
     * 取消选择货位
     */
    function deselectSlot() {
        const previous = state.selectedSlot;
        state.selectedSlot = null;
        publish(EVENTS.SLOT_DESELECTED, previous);
    }

    /**
     * 获取货位的风险
     */
    function getSlotRisks(slotKey) {
        if (!state.riskAnalysis) return [];
        return state.riskAnalysis.getRisksBySlot(slotKey);
    }

    /**
     * 获取货位的临期货品
     */
    function getSlotExpiringProducts(slotKey) {
        if (!state.data.expiring) return [];
        return state.data.expiring.products.filter(p => p.slotId === slotKey);
    }

    /**
     * 获取货位的温度数据
     */
    function getSlotTemperature(slotKey) {
        if (!state.data.temperature || !state.data.temperature.tempMap) return null;
        return state.data.temperature.tempMap.get(slotKey);
    }

    /**
     * 设置筛选条件
     * @param {string} key - 筛选键
     * @param {*} value - 筛选值
     */
    function setFilter(key, value) {
        if (state.filters[key] !== value) {
            state.filters[key] = value;
            publish(EVENTS.FILTER_CHANGED, {
                key,
                value,
                filters: { ...state.filters }
            });
        }
    }

    /**
     * 批量设置筛选条件
     * @param {Object} filters - 筛选条件对象
     */
    function setFilters(filters) {
        const changed = [];
        Object.keys(filters).forEach(key => {
            if (state.filters[key] !== filters[key]) {
                state.filters[key] = filters[key];
                changed.push(key);
            }
        });
        
        if (changed.length > 0) {
            publish(EVENTS.FILTER_CHANGED, {
                changed,
                filters: { ...state.filters }
            });
        }
    }

    /**
     * 设置显示选项
     * @param {string} key - 显示选项键
     * @param {*} value - 显示选项值
     */
    function setDisplayOption(key, value) {
        if (state.display[key] !== value) {
            state.display[key] = value;
            publish(EVENTS.DISPLAY_CHANGED, {
                key,
                value,
                display: { ...state.display }
            });
        }
    }

    /**
     * 设置时间轴当前索引
     * @param {number} index - 时间轴索引
     */
    function setTimelineIndex(index) {
        const clampedIndex = Math.max(0, Math.min(index, state.timeline.timestamps.length - 1));
        if (state.timeline.currentIndex !== clampedIndex) {
            state.timeline.currentIndex = clampedIndex;
            publish(EVENTS.TIMELINE_CHANGED, {
                ...state.timeline,
                currentTime: state.timeline.timestamps[clampedIndex]
            });
        }
    }

    /**
     * 播放时间轴
     */
    function playTimeline() {
        state.timeline.isPlaying = true;
        publish(EVENTS.TIMELINE_PLAY, { ...state.timeline });
    }

    /**
     * 暂停时间轴
     */
    function pauseTimeline() {
        state.timeline.isPlaying = false;
        publish(EVENTS.TIMELINE_PAUSE, { ...state.timeline });
    }

    /**
     * 设置播放速度
     * @param {number} speed - 播放速度
     */
    function setPlaySpeed(speed) {
        state.timeline.speed = parseFloat(speed) || 1.0;
    }

    /**
     * 添加标记
     * @param {string} slotKey - 货位标识
     * @param {Object} mark - 标记数据
     */
    function addMark(slotKey, mark) {
        const existingMark = state.marks.get(slotKey) || {};
        const updatedMark = {
            ...existingMark,
            ...mark,
            slotKey: slotKey,
            updatedAt: new Date().toISOString()
        };
        
        state.marks.set(slotKey, updatedMark);
        publish(EVENTS.MARK_ADDED, { slotKey, mark: updatedMark });
        
        return updatedMark;
    }

    /**
     * 移除标记
     * @param {string} slotKey - 货位标识
     */
    function removeMark(slotKey) {
        if (state.marks.has(slotKey)) {
            const mark = state.marks.get(slotKey);
            state.marks.delete(slotKey);
            publish(EVENTS.MARK_REMOVED, { slotKey, mark });
        }
    }

    /**
     * 获取货位的标记
     * @param {string} slotKey - 货位标识
     * @returns {Object} 标记数据
     */
    function getMark(slotKey) {
        return state.marks.get(slotKey);
    }

    /**
     * 获取所有标记
     * @returns {Map} 所有标记
     */
    function getAllMarks() {
        return new Map(state.marks);
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前状态的深拷贝
     */
    function getState() {
        return JSON.parse(JSON.stringify({
            data: {
                racks: state.data.racks,
                temperature: state.data.temperature,
                trajectory: state.data.trajectory,
                expiring: state.data.expiring
            },
            riskAnalysis: state.riskAnalysis,
            selectedSlot: state.selectedSlot,
            filters: { ...state.filters },
            display: { ...state.display },
            timeline: { ...state.timeline },
            marks: Object.fromEntries(state.marks),
            loadedFiles: { ...state.loadedFiles }
        }));
    }

    /**
     * 获取货架数据
     */
    function getRacksData() {
        return state.data.racks;
    }

    /**
     * 获取温度数据
     */
    function getTemperatureData() {
        return state.data.temperature;
    }

    /**
     * 获取轨迹数据
     */
    function getTrajectoryData() {
        return state.data.trajectory;
    }

    /**
     * 获取临期货品数据
     */
    function getExpiringData() {
        return state.data.expiring;
    }

    /**
     * 获取风险分析结果
     */
    function getRiskAnalysis() {
        return state.riskAnalysis;
    }

    /**
     * 获取选中的货位
     */
    function getSelectedSlot() {
        return state.selectedSlot;
    }

    /**
     * 获取筛选条件
     */
    function getFilters() {
        return { ...state.filters };
    }

    /**
     * 获取显示选项
     */
    function getDisplayOptions() {
        return { ...state.display };
    }

    /**
     * 获取时间轴状态
     */
    function getTimeline() {
        return { ...state.timeline };
    }

    /**
     * 检查是否有数据加载
     */
    function hasData() {
        return state.data.racks !== null;
    }

    /**
     * 记录已加载的文件
     */
    function setLoadedFile(type, fileName) {
        state.loadedFiles[type] = fileName;
    }

    /**
     * 获取已加载的文件
     */
    function getLoadedFiles() {
        return { ...state.loadedFiles };
    }

    /**
     * 重置状态
     */
    function reset() {
        state = {
            data: {
                racks: null,
                temperature: null,
                trajectory: null,
                expiring: null
            },
            riskAnalysis: null,
            selectedSlot: null,
            filters: {
                riskLevel: 'all',
                riskType: 'all',
                area: 'all',
                sku: ''
            },
            display: {
                showHeatmap: true,
                showPath: true,
                opacity: 1.0
            },
            timeline: {
                currentIndex: 0,
                isPlaying: false,
                speed: 1.0,
                timestamps: [],
                startTime: null,
                endTime: null
            },
            marks: new Map(),
            loadedFiles: {
                racks: null,
                temperature: null,
                trajectory: null,
                expiring: null
            }
        };

        publish(EVENTS.STATE_RESET, null);
    }

    return {
        EVENTS,
        
        subscribe,
        publish,
        
        setRacksData,
        setTemperatureData,
        setTrajectoryData,
        setExpiringData,
        analyzeRisks,
        
        selectSlot,
        deselectSlot,
        getSelectedSlot,
        
        setFilter,
        setFilters,
        getFilters,
        
        setDisplayOption,
        getDisplayOptions,
        
        setTimelineIndex,
        playTimeline,
        pauseTimeline,
        setPlaySpeed,
        getTimeline,
        
        addMark,
        removeMark,
        getMark,
        getAllMarks,
        
        getState,
        getRacksData,
        getTemperatureData,
        getTrajectoryData,
        getExpiringData,
        getRiskAnalysis,
        
        hasData,
        setLoadedFile,
        getLoadedFiles,
        
        reset
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
}
