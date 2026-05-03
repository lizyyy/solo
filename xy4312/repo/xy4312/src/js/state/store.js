/**
 * 状态管理模块
 * 负责管理应用的全局状态，包括轨迹数据、地图数据、风险数据、播放状态等
 */

export class Store {
    constructor() {
        this.state = {
            trajectoryData: [],
            mapData: null,
            risks: null,
            invalidRows: [],
            parseStatistics: null,
            
            playback: {
                isPlaying: false,
                currentTime: 0,
                startTime: 0,
                endTime: 0,
                speed: 1.0,
                duration: 0
            },
            
            filters: {
                vehicles: [],
                allVehicles: [],
                severities: ['high', 'medium', 'low'],
                timeRange: null
            },
            
            selectedRisk: null,
            hoveredVehicle: null,
            
            uiState: {
                sidebarOpen: true,
                activeTab: 'overview',
                viewMode: '3d'
            }
        };

        this.listeners = new Map();
        this.nextListenerId = 0;
    }

    getState() {
        return { ...this.state };
    }

    getTrajectoryData() {
        return [...this.state.trajectoryData];
    }

    getMapData() {
        return this.state.mapData ? { ...this.state.mapData } : null;
    }

    getRisks() {
        return this.state.risks ? { ...this.state.risks } : null;
    }

    getInvalidRows() {
        return [...this.state.invalidRows];
    }

    getParseStatistics() {
        return this.state.parseStatistics ? { ...this.state.parseStatistics } : null;
    }

    getPlaybackState() {
        return { ...this.state.playback };
    }

    getFilters() {
        return { ...this.state.filters };
    }

    getSelectedRisk() {
        return this.state.selectedRisk ? { ...this.state.selectedRisk } : null;
    }

    getHoveredVehicle() {
        return this.state.hoveredVehicle;
    }

    getUIState() {
        return { ...this.state.uiState };
    }

    setTrajectoryData(data, invalidRows = [], statistics = null) {
        this.state.trajectoryData = [...data];
        this.state.invalidRows = [...invalidRows];
        if (statistics) {
            this.state.parseStatistics = { ...statistics };
        }

        this.updateVehicleList();
        this.updateTimeRange();
        this.notify('trajectoryData');
    }

    appendTrajectoryData(data, invalidRows = [], statistics = null) {
        const existingTimestamps = new Set();
        this.state.trajectoryData.forEach(item => {
            existingTimestamps.add(`${item.vehicleId}_${item.timestamp}`);
        });

        const newData = data.filter(item => {
            const key = `${item.vehicleId}_${item.timestamp}`;
            return !existingTimestamps.has(key);
        });

        this.state.trajectoryData = [...this.state.trajectoryData, ...newData];
        this.state.trajectoryData.sort((a, b) => a.timestamp - b.timestamp);

        if (invalidRows.length > 0) {
            this.state.invalidRows = [...this.state.invalidRows, ...invalidRows];
        }

        if (statistics) {
            if (this.state.parseStatistics) {
                this.state.parseStatistics.totalRows += statistics.totalRows;
                this.state.parseStatistics.validRows += statistics.validRows;
                this.state.parseStatistics.invalidRows += statistics.invalidRows;
                Object.keys(statistics.errorsByType).forEach(type => {
                    if (this.state.parseStatistics.errorsByType[type]) {
                        this.state.parseStatistics.errorsByType[type] += statistics.errorsByType[type];
                    } else {
                        this.state.parseStatistics.errorsByType[type] = statistics.errorsByType[type];
                    }
                });
            } else {
                this.state.parseStatistics = { ...statistics };
            }
        }

        this.updateVehicleList();
        this.updateTimeRange();
        this.notify('trajectoryData');
    }

    setMapData(mapData) {
        this.state.mapData = mapData ? { ...mapData } : null;
        this.notify('mapData');
    }

    setRisks(risks) {
        this.state.risks = risks ? { ...risks } : null;
        this.notify('risks');
    }

    updateVehicleList() {
        const vehicles = new Set();
        this.state.trajectoryData.forEach(point => {
            if (point.vehicleId) {
                vehicles.add(point.vehicleId);
            }
        });
        
        this.state.filters.allVehicles = Array.from(vehicles).sort();
        
        if (this.state.filters.vehicles.length === 0) {
            this.state.filters.vehicles = [...this.state.filters.allVehicles];
        }
    }

    updateTimeRange() {
        if (this.state.trajectoryData.length === 0) {
            this.state.playback.startTime = 0;
            this.state.playback.endTime = 0;
            this.state.playback.currentTime = 0;
            this.state.playback.duration = 0;
            return;
        }

        let minTime = Infinity;
        let maxTime = -Infinity;

        this.state.trajectoryData.forEach(point => {
            if (point.timestamp < minTime) minTime = point.timestamp;
            if (point.timestamp > maxTime) maxTime = point.timestamp;
        });

        this.state.playback.startTime = minTime;
        this.state.playback.endTime = maxTime;
        this.state.playback.duration = maxTime - minTime;

        if (this.state.playback.currentTime === 0 || 
            this.state.playback.currentTime < minTime || 
            this.state.playback.currentTime > maxTime) {
            this.state.playback.currentTime = minTime;
        }

        this.state.filters.timeRange = {
            start: minTime,
            end: maxTime
        };
    }

    setPlaybackState(state) {
        this.state.playback = {
            ...this.state.playback,
            ...state
        };
        this.notify('playback');
    }

    play() {
        if (!this.state.playback.isPlaying) {
            this.state.playback.isPlaying = true;
            this.notify('playback');
        }
    }

    pause() {
        if (this.state.playback.isPlaying) {
            this.state.playback.isPlaying = false;
            this.notify('playback');
        }
    }

    togglePlayback() {
        this.state.playback.isPlaying = !this.state.playback.isPlaying;
        this.notify('playback');
    }

    setCurrentTime(time) {
        const clampedTime = Math.max(
            this.state.playback.startTime,
            Math.min(this.state.playback.endTime, time)
        );
        
        if (this.state.playback.currentTime !== clampedTime) {
            this.state.playback.currentTime = clampedTime;
            this.notify('playback');
        }
    }

    setPlaybackSpeed(speed) {
        const clampedSpeed = Math.max(0.1, Math.min(10, speed));
        if (this.state.playback.speed !== clampedSpeed) {
            this.state.playback.speed = clampedSpeed;
            this.notify('playback');
        }
    }

    seekToTime(time) {
        this.setCurrentTime(time);
    }

    seekToStart() {
        this.setCurrentTime(this.state.playback.startTime);
    }

    seekToEnd() {
        this.setCurrentTime(this.state.playback.endTime);
    }

    stepForward(ms = 1000) {
        this.setCurrentTime(this.state.playback.currentTime + ms);
    }

    stepBackward(ms = 1000) {
        this.setCurrentTime(this.state.playback.currentTime - ms);
    }

    setVehicleFilters(vehicles) {
        this.state.filters.vehicles = [...vehicles];
        this.notify('filters');
    }

    toggleVehicleFilter(vehicleId) {
        const index = this.state.filters.vehicles.indexOf(vehicleId);
        if (index > -1) {
            this.state.filters.vehicles.splice(index, 1);
        } else {
            this.state.filters.vehicles.push(vehicleId);
        }
        this.notify('filters');
    }

    selectAllVehicles() {
        this.state.filters.vehicles = [...this.state.filters.allVehicles];
        this.notify('filters');
    }

    deselectAllVehicles() {
        this.state.filters.vehicles = [];
        this.notify('filters');
    }

    setSeverityFilters(severities) {
        this.state.filters.severities = [...severities];
        this.notify('filters');
    }

    toggleSeverityFilter(severity) {
        const index = this.state.filters.severities.indexOf(severity);
        if (index > -1) {
            this.state.filters.severities.splice(index, 1);
        } else {
            this.state.filters.severities.push(severity);
        }
        this.notify('filters');
    }

    setTimeRangeFilter(startTime, endTime) {
        this.state.filters.timeRange = {
            start: startTime,
            end: endTime
        };
        this.notify('filters');
    }

    setSelectedRisk(risk) {
        this.state.selectedRisk = risk ? { ...risk } : null;
        if (risk && risk.timestamp) {
            this.setCurrentTime(risk.timestamp);
        }
        this.notify('selectedRisk');
    }

    clearSelectedRisk() {
        this.state.selectedRisk = null;
        this.notify('selectedRisk');
    }

    setHoveredVehicle(vehicleId) {
        this.state.hoveredVehicle = vehicleId;
        this.notify('hoveredVehicle');
    }

    clearHoveredVehicle() {
        this.state.hoveredVehicle = null;
        this.notify('hoveredVehicle');
    }

    setUIState(uiState) {
        this.state.uiState = {
            ...this.state.uiState,
            ...uiState
        };
        this.notify('uiState');
    }

    toggleSidebar() {
        this.state.uiState.sidebarOpen = !this.state.uiState.sidebarOpen;
        this.notify('uiState');
    }

    setActiveTab(tab) {
        this.state.uiState.activeTab = tab;
        this.notify('uiState');
    }

    setViewMode(mode) {
        this.state.uiState.viewMode = mode;
        this.notify('uiState');
    }

    getVehiclesAtTime(time) {
        if (this.state.trajectoryData.length === 0) {
            return [];
        }

        const vehicleMap = new Map();

        this.state.trajectoryData.forEach(point => {
            if (!vehicleMap.has(point.vehicleId)) {
                vehicleMap.set(point.vehicleId, []);
            }
            vehicleMap.get(point.vehicleId).push(point);
        });

        const result = [];

        vehicleMap.forEach((points, vehicleId) => {
            if (points.length === 0) return;

            points.sort((a, b) => a.timestamp - b.timestamp);

            let exactMatch = points.find(p => p.timestamp === time);
            if (exactMatch) {
                result.push(exactMatch);
                return;
            }

            let beforeIndex = -1;
            let afterIndex = -1;

            for (let i = 0; i < points.length; i++) {
                if (points[i].timestamp < time) {
                    beforeIndex = i;
                }
                if (points[i].timestamp > time && afterIndex === -1) {
                    afterIndex = i;
                }
            }

            if (beforeIndex === -1) {
                if (afterIndex !== -1) {
                    result.push({ ...points[afterIndex], interpolated: true });
                }
            } else if (afterIndex === -1) {
                result.push({ ...points[beforeIndex], interpolated: true });
            } else {
                const before = points[beforeIndex];
                const after = points[afterIndex];
                const timeDelta = after.timestamp - before.timestamp;
                const progress = (time - before.timestamp) / timeDelta;

                result.push({
                    vehicleId: vehicleId,
                    timestamp: time,
                    x: before.x + (after.x - before.x) * progress,
                    y: before.y + (after.y - before.y) * progress,
                    z: before.z + (after.z - before.z) * progress,
                    speed: before.speed + (after.speed - before.speed) * progress,
                    interpolated: true,
                    beforeTimestamp: before.timestamp,
                    afterTimestamp: after.timestamp
                });
            }
        });

        if (this.state.filters.vehicles.length > 0) {
            return result.filter(vehicle => 
                this.state.filters.vehicles.includes(vehicle.vehicleId)
            );
        }

        return result;
    }

    getFilteredRisks() {
        if (!this.state.risks) {
            return null;
        }

        const risks = this.state.risks;
        const filters = this.state.filters;
        const result = {
            collisions: [],
            suddenStops: [],
            restrictedAreaApproaches: [],
            speeding: [],
            nearMisses: [],
            statistics: { ...risks.statistics }
        };

        const timeFilter = (risk) => {
            if (!filters.timeRange) return true;
            return risk.timestamp >= filters.timeRange.start && 
                   risk.timestamp <= filters.timeRange.end;
        };

        const vehicleFilter = (risk) => {
            if (filters.vehicles.length === 0) return false;
            if (risk.vehicles) {
                return risk.vehicles.some(v => filters.vehicles.includes(v));
            }
            return filters.vehicles.includes(risk.vehicleId);
        };

        const severityFilter = (risk) => {
            return filters.severities.includes(risk.severity);
        };

        const combinedFilter = (risk) => {
            return timeFilter(risk) && vehicleFilter(risk) && severityFilter(risk);
        };

        result.collisions = (risks.collisions || []).filter(combinedFilter);
        result.suddenStops = (risks.suddenStops || []).filter(combinedFilter);
        result.restrictedAreaApproaches = (risks.restrictedAreaApproaches || []).filter(combinedFilter);
        result.speeding = (risks.speeding || []).filter(combinedFilter);
        result.nearMisses = (risks.nearMisses || []).filter(combinedFilter);

        return result;
    }

    clearAllData() {
        this.state.trajectoryData = [];
        this.state.mapData = null;
        this.state.risks = null;
        this.state.invalidRows = [];
        this.state.parseStatistics = null;
        this.state.selectedRisk = null;
        this.state.hoveredVehicle = null;

        this.state.playback = {
            isPlaying: false,
            currentTime: 0,
            startTime: 0,
            endTime: 0,
            speed: 1.0,
            duration: 0
        };

        this.state.filters = {
            vehicles: [],
            allVehicles: [],
            severities: ['high', 'medium', 'low'],
            timeRange: null
        };

        this.notify('all');
    }

    subscribe(callback, types = ['all']) {
        const id = this.nextListenerId++;
        this.listeners.set(id, {
            callback,
            types
        });
        return id;
    }

    unsubscribe(id) {
        this.listeners.delete(id);
    }

    notify(changeType) {
        this.listeners.forEach((listener) => {
            if (listener.types.includes('all') || listener.types.includes(changeType)) {
                try {
                    listener.callback(this.getState(), changeType);
                } catch (error) {
                    console.error('Error in state listener:', error);
                }
            }
        });
    }
}

const store = new Store();
export default store;
