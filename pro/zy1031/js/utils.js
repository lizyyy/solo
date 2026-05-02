/**
 * 工具函数模块
 */

const Utils = {
    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    /**
     * 格式化日期
     * @param {Date|string} date 日期对象或日期字符串
     * @param {string} format 格式化模板 (YYYY-MM-DD, YYYY/MM/DD 等)
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    },
    
    /**
     * 计算百分比
     * @param {number} value 值
     * @param {number} total 总值
     * @param {number} decimals 小数位数
     * @returns {string} 百分比字符串
     */
    calculatePercentage(value, total, decimals = 1) {
        if (total === 0) return '0%';
        return `${(value / total * 100).toFixed(decimals)}%`;
    },
    
    /**
     * 深拷贝对象
     * @param {*} obj 要拷贝的对象
     * @returns {*} 拷贝后的对象
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    /**
     * 防抖函数
     * @param {Function} func 要执行的函数
     * @param {number} wait 等待时间（毫秒）
     * @returns {Function} 防抖后的函数
     */
    debounce(func, wait = 300) {
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
    
    /**
     * 节流函数
     * @param {Function} func 要执行的函数
     * @param {number} limit 时间限制（毫秒）
     * @returns {Function} 节流后的函数
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * 显示提示消息
     * @param {string} message 消息内容
     * @param {string} type 消息类型 (success, error, warning, info)
     * @param {number} duration 显示时长（毫秒）
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        // 设置样式
        toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity';
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-600', 'text-white');
                break;
            case 'error':
                toast.classList.add('bg-red-600', 'text-white');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-600', 'text-white');
                break;
            default:
                toast.classList.add('bg-blue-600', 'text-white');
        }
        
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        
        // 自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, duration);
    },
    
    /**
     * 下载文件
     * @param {string} content 文件内容
     * @param {string} filename 文件名
     * @param {string} mimeType MIME类型
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * 将对象数组转换为CSV格式
     * @param {Array} data 对象数组
     * @returns {string} CSV格式字符串
     */
    arrayToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header];
                // 处理包含逗号、引号或换行符的值
                if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            });
            csvRows.push(values.join(','));
        }
        
        return csvRows.join('\n');
    },
    
    /**
     * 计算两点之间的距离
     * @param {number} x1 点1的X坐标
     * @param {number} y1 点1的Y坐标
     * @param {number} x2 点2的X坐标
     * @param {number} y2 点2的Y坐标
     * @returns {number} 距离
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    /**
     * 计算平均值
     * @param {Array} arr 数值数组
     * @returns {number} 平均值
     */
    calculateAverage(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    },
    
    /**
     * 计算中位数
     * @param {Array} arr 数值数组
     * @returns {number} 中位数
     */
    calculateMedian(arr) {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
    },
    
    /**
     * 找出数组中出现次数最多的元素
     * @param {Array} arr 数组
     * @returns {*} 出现次数最多的元素
     */
    findMostFrequent(arr) {
        if (!arr || arr.length === 0) return null;
        
        const counts = {};
        let maxCount = 0;
        let mostFrequent = arr[0];
        
        for (const item of arr) {
            counts[item] = (counts[item] || 0) + 1;
            if (counts[item] > maxCount) {
                maxCount = counts[item];
                mostFrequent = item;
            }
        }
        
        return mostFrequent;
    },
    
    /**
     * 分组统计
     * @param {Array} arr 数组
     * @param {string} key 分组键
     * @returns {Object} 分组统计结果
     */
    groupBy(arr, key) {
        if (!arr || arr.length === 0) return {};
        
        return arr.reduce((groups, item) => {
            const groupKey = item[key];
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    },
    
    /**
     * 过滤数组
     * @param {Array} arr 数组
     * @param {Object} filters 过滤条件 { key: value }
     * @returns {Array} 过滤后的数组
     */
    filterArray(arr, filters) {
        if (!arr || arr.length === 0) return [];
        if (!filters || Object.keys(filters).length === 0) return [...arr];
        
        return arr.filter(item => {
            for (const [key, value] of Object.entries(filters)) {
                if (value === undefined || value === null || value === '') continue;
                if (item[key] !== value) return false;
            }
            return true;
        });
    },
    
    /**
     * 从数组中提取唯一值
     * @param {Array} arr 数组
     * @param {string} [key] 如果是对象数组，指定提取的键
     * @returns {Array} 唯一值数组
     */
    unique(arr, key) {
        if (!arr || arr.length === 0) return [];
        
        if (key) {
            return [...new Set(arr.map(item => item[key]))].filter(v => v !== undefined && v !== null);
        }
        
        return [...new Set(arr)];
    }
};
