const Utils = {
    generateId: function() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    formatDate: function(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDateTime: function(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const dateStr = this.formatDate(date);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${dateStr} ${hours}:${minutes}:${seconds}`;
    },

    parseDate: function(dateStr) {
        if (!dateStr) return null;
        
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                return new Date(year, parseInt(parts[1]) - 1, parts[0]);
            }
        }
        
        if (dateStr.includes('-')) {
            return new Date(dateStr);
        }
        
        return new Date(dateStr);
    },

    getShiftName: function(shiftCode) {
        const shiftMap = {
            'morning': '早班',
            'afternoon': '中班',
            'evening': '晚班'
        };
        return shiftMap[shiftCode] || shiftCode;
    },

    getShiftCode: function(shiftName) {
        const shiftMap = {
            '早班': 'morning',
            '中班': 'afternoon',
            '晚班': 'evening'
        };
        return shiftMap[shiftName] || shiftName;
    },

    getStatusName: function(status) {
        const statusMap = {
            'pending': '待喂',
            'completed': '已喂',
            'missed': '漏喂'
        };
        return statusMap[status] || status;
    },

    getStatusClass: function(status) {
        const classMap = {
            'pending': 'status-pending',
            'completed': 'status-completed',
            'missed': 'status-missed',
            'warning': 'status-warning',
            'danger': 'status-danger',
            'info': 'status-info'
        };
        return classMap[status] || 'status-info';
    },

    parseCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            return { headers: [], data: [] };
        }

        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length > 0 && values.some(v => v.trim() !== '')) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index] ? values[index].trim() : '';
                });
                data.push(row);
            }
        }

        return { headers, data };
    },

    parseCSVLine: function(line) {
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

    toCSV: function(data, headers) {
        if (!data || data.length === 0) {
            return '';
        }

        const csvHeaders = headers || Object.keys(data[0]);
        let csv = csvHeaders.map(h => this.escapeCSV(h)).join(',') + '\n';

        data.forEach(row => {
            const values = csvHeaders.map(header => {
                const value = row[header] !== undefined ? row[header] : '';
                return this.escapeCSV(String(value));
            });
            csv += values.join(',') + '\n';
        });

        return csv;
    },

    escapeCSV: function(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        const strValue = String(value);
        
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
            return '"' + strValue.replace(/"/g, '""') + '"';
        }
        
        return strValue;
    },

    downloadFile: function(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    debounce: function(func, wait) {
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

    deepClone: function(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        
        return cloned;
    },

    isEmpty: function(value) {
        if (value === null || value === undefined) {
            return true;
        }
        
        if (typeof value === 'string') {
            return value.trim() === '';
        }
        
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        
        if (typeof value === 'object') {
            return Object.keys(value).length === 0;
        }
        
        return false;
    },

    getToday: function() {
        return this.formatDate(new Date());
    },

    getDateRange: function(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            dates.push(this.formatDate(new Date(current)));
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    },

    calculateAge: function(birthDate) {
        if (!birthDate) return null;
        
        const birth = new Date(birthDate);
        const today = new Date();
        
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    },

    calculateDose: function(weight, dosePerKg, minDose, maxDose) {
        if (!weight || !dosePerKg) return null;
        
        let calculatedDose = weight * dosePerKg;
        
        if (minDose !== undefined && calculatedDose < minDose) {
            calculatedDose = minDose;
        }
        
        if (maxDose !== undefined && calculatedDose > maxDose) {
            calculatedDose = maxDose;
        }
        
        return Number(calculatedDose.toFixed(2));
    },

    showNotification: function(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type || 'info'}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
