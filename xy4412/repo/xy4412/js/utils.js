const Utils = {
    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    },

    formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },

    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const result = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            result.push(row);
        }
        
        return result;
    },

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    },

    roundTo(value, decimals = 2) {
        return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    },

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    distance3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    distance2D(p1, p2) {
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dz * dz);
    },

    snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    },

    snapPositionToGrid(position, gridSize) {
        return {
            x: this.snapToGrid(position.x, gridSize),
            y: position.y,
            z: this.snapToGrid(position.z, gridSize),
        };
    },

    validateNumber(value, defaultValue = 0) {
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    },

    parseWeight(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const match = value.match(/(\d+\.?\d*)/);
            if (match) return parseFloat(match[1]);
        }
        return 0;
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

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    getReviewStatusText(status) {
        const statusMap = {
            'pending': '待复核',
            'reviewed': '已复核',
            'approved': '已批准',
            'needs-change': '需修改',
        };
        return statusMap[status] || status;
    },

    getRiskLevelText(level) {
        const levelMap = {
            'critical': '严重',
            'warning': '警告',
            'info': '提示',
        };
        return levelMap[level] || level;
    },
};
