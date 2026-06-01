const Utils = {
    formatDate(date) {
        const d = new Date(date);
        const pad = n => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    formatDateShort(date) {
        const d = new Date(date);
        const pad = n => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },

    getDeviceTypeName(type) {
        const names = {
            camera: '摄像头',
            sensor: '传感器',
            gateway: '网关'
        };
        return names[type] || type;
    },

    getStatusName(status) {
        const names = {
            online: '在线',
            offline: '离线',
            warning: '警告'
        };
        return names[status] || status;
    },

    getLevelName(level) {
        const names = {
            critical: '严重',
            warning: '警告',
            info: '提示'
        };
        return names[level] || level;
    },

    getLevelColor(level) {
        const colors = {
            critical: '#ef4444',
            warning: '#fbbf24',
            info: '#3b82f6'
        };
        return colors[level] || '#888';
    },

    getDeviceColor(type) {
        const colors = {
            camera: '#00d4ff',
            sensor: '#10b981',
            gateway: '#a855f7'
        };
        return colors[type] || '#888';
    },

    calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    isSameDevice(device1, device2) {
        if (device1.id === device2.id) return true;
        if (device1.name === device2.name) return true;
        const dist = this.calculateDistance(device1.position, device2.position);
        return dist < 20 && device1.type === device2.type && device1.floor === device2.floor;
    },

    findConflicts(gisDevices, importDevices) {
        const conflicts = [];
        
        importDevices.forEach(impDevice => {
            const matchingGis = gisDevices.find(gis => this.isSameDevice(gis, impDevice));
            
            if (matchingGis) {
                const conflict = this.checkSingleDeviceConflict(matchingGis, impDevice);
                if (conflict) {
                    conflicts.push(conflict);
                }
            }
        });
        
        return conflicts;
    },

    checkSingleDeviceConflict(gisDevice, impDevice) {
        const conflicts = [];
        
        if (gisDevice.name !== impDevice.name) {
            conflicts.push({
                field: 'name',
                gisValue: gisDevice.name,
                impValue: impDevice.name
            });
        }
        
        const coordDist = this.calculateDistance(gisDevice.position, impDevice.position);
        if (coordDist > 5) {
            conflicts.push({
                field: 'position',
                gisValue: `(${gisDevice.position.x}, ${gisDevice.position.y})`,
                impValue: `(${impDevice.position.x}, ${impDevice.position.y})`
            });
        }
        
        if (gisDevice.hasPhoto !== impDevice.hasPhoto) {
            conflicts.push({
                field: 'hasPhoto',
                gisValue: gisDevice.hasPhoto ? '有' : '无',
                impValue: impDevice.hasPhoto ? '有' : '无'
            });
        }
        
        if (conflicts.length === 0) return null;
        
        return {
            id: 'conflict_' + gisDevice.id,
            deviceId: impDevice.id,
            gisDeviceId: gisDevice.id,
            title: `${gisDevice.name} 数据冲突`,
            description: `检测到 ${conflicts.length} 处数据不一致`,
            conflicts,
            gisDevice,
            impDevice
        };
    },

    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch {
                return false;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch {
                return false;
            }
        }
    }
};
