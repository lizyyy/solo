const Utils = {
    parseCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        
        return data;
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
    
    toCSV: function(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const lines = [headers.join(',')];
        
        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header] || '';
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            lines.push(values.join(','));
        });
        
        return lines.join('\n');
    },
    
    formatNumber: function(num, decimals = 2) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        return num.toFixed(decimals);
    },
    
    parseNumber: function(str) {
        if (typeof str === 'number') return str;
        if (typeof str !== 'string') return 0;
        const cleaned = str.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },
    
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('zh-CN');
    },
    
    calculateDaysUntilExpiry: function(expiryDate) {
        if (!expiryDate) return null;
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },
    
    downloadFile: function(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    readFileAsText: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },
    
    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    generateId: function() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    roundUp: function(num, precision = 2) {
        const factor = Math.pow(10, precision);
        return Math.ceil(num * factor) / factor;
    },
    
    getMaterialUnit: function(type) {
        const units = {
            '瓷砖': '㎡',
            '地板': '㎡',
            '乳胶漆': '桶',
            '踢脚线': '米',
            '壁纸': '卷',
            '木门': '樘',
            '玻璃': '㎡',
            '五金': '件',
            '胶水': '瓶',
            '辅料': '袋',
            '水泥': '袋',
            '沙子': '袋'
        };
        return units[type] || '单位';
    },
    
    getMaterialTypeOptions: function() {
        return [
            '瓷砖', '地板', '乳胶漆', '踢脚线', '壁纸', 
            '木门', '玻璃', '五金', '胶水', '辅料', '水泥', '沙子'
        ];
    }
};

window.Utils = Utils;
