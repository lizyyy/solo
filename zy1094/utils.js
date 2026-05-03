export const Utils = {
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return { headers: [], rows: [] };

        const headers = this.parseCSVLine(lines[0]);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] !== undefined ? values[index] : '';
            });
            rows.push(row);
        }

        return { headers, rows };
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
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    },

    toCSV(headers, rows) {
        const escapeCSV = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const headerLine = headers.map(escapeCSV).join(',');
        const dataLines = rows.map(row => 
            headers.map(h => escapeCSV(row[h])).join(',')
        );

        return [headerLine, ...dataLines].join('\n');
    },

    parseJSON(jsonText) {
        const data = JSON.parse(jsonText);
        
        if (Array.isArray(data)) {
            if (data.length === 0) return { headers: [], rows: [] };
            const headers = Object.keys(data[0]);
            return { headers, rows: data };
        }
        
        if (data && typeof data === 'object') {
            if (data.headers && Array.isArray(data.headers) && 
                data.rows && Array.isArray(data.rows)) {
                return data;
            }
            if (data.data && Array.isArray(data.data)) {
                if (data.data.length === 0) return { headers: [], rows: [] };
                const headers = Object.keys(data.data[0]);
                return { headers, rows: data.data };
            }
        }
        
        throw new Error('无法解析的 JSON 格式');
    },

    detectJSON(csvText) {
        const trimmed = csvText.trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
    },

    DATE_FORMATS: {
        'YYYY-MM-DD': {
            regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            parse: (match) => new Date(+match[1], +match[2] - 1, +match[3]),
            format: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        },
        'YYYY/MM/DD': {
            regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
            parse: (match) => new Date(+match[1], +match[2] - 1, +match[3]),
            format: (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        },
        'MM/DD/YYYY': {
            regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            parse: (match) => new Date(+match[3], +match[1] - 1, +match[2]),
            format: (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
        },
        'DD/MM/YYYY': {
            regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            parse: (match) => new Date(+match[3], +match[2] - 1, +match[1]),
            format: (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        },
        'YYYY-MM-DD HH:mm:ss': {
            regex: /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$/,
            parse: (match) => new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]),
            format: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        },
        'YYYY/MM/DD HH:mm:ss': {
            regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$/,
            parse: (match) => new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]),
            format: (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        }
    },

    parseDate(value, format = 'auto') {
        if (!value || value === '') return null;
        
        const strValue = String(value).trim();
        
        if (format === 'auto') {
            return this.detectAndParseDate(strValue);
        }
        
        const formatConfig = this.DATE_FORMATS[format];
        if (!formatConfig) return null;
        
        const match = strValue.match(formatConfig.regex);
        if (!match) return null;
        
        try {
            const date = formatConfig.parse(match);
            if (isNaN(date.getTime())) return null;
            return { date, format, ambiguous: false };
        } catch {
            return null;
        }
    },

    detectAndParseDate(strValue) {
        const results = [];
        
        for (const [formatName, config] of Object.entries(this.DATE_FORMATS)) {
            const match = strValue.match(config.regex);
            if (match) {
                try {
                    const date = config.parse(match);
                    if (!isNaN(date.getTime())) {
                        results.push({ date, format: formatName });
                    }
                } catch {}
            }
        }
        
        const timestamp = Date.parse(strValue);
        if (!isNaN(timestamp)) {
            results.push({ date: new Date(timestamp), format: 'iso' });
        }
        
        if (results.length === 0) return null;
        if (results.length === 1) return { ...results[0], ambiguous: false };
        
        const uniqueDates = [...new Set(results.map(r => r.date.getTime()))];
        if (uniqueDates.length === 1) {
            return { ...results[0], ambiguous: false };
        }
        
        return { ...results[0], ambiguous: true, possibleFormats: results.map(r => r.format) };
    },

    formatDate(date, targetFormat = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const formatConfig = this.DATE_FORMATS[targetFormat];
        if (formatConfig) {
            return formatConfig.format(date);
        }
        
        return date.toISOString().split('T')[0];
    },

    AMOUNT_UNITS: {
        yuan: { multiplier: 1, label: '元' },
        wanyuan: { multiplier: 10000, label: '万元' },
        thousand: { multiplier: 1000, label: '千元' },
        cent: { multiplier: 0.01, label: '分' }
    },

    parseAmount(value, unit = 'auto') {
        if (value === null || value === undefined || value === '') return null;
        
        const strValue = String(value).trim();
        
        const cleanValue = strValue
            .replace(/[,，]/g, '')
            .replace(/[￥¥$]/g, '')
            .replace(/\s+/g, '');
        
        let detectedUnit = null;
        let numericPart = cleanValue;
        
        if (/万$/.test(cleanValue)) {
            detectedUnit = 'wanyuan';
            numericPart = cleanValue.slice(0, -1);
        } else if (/千$/.test(cleanValue)) {
            detectedUnit = 'thousand';
            numericPart = cleanValue.slice(0, -1);
        }
        
        const num = parseFloat(numericPart);
        if (isNaN(num)) return null;
        
        const actualUnit = detectedUnit || (unit === 'auto' ? 'yuan' : unit);
        const unitConfig = this.AMOUNT_UNITS[actualUnit];
        
        if (!unitConfig) return { value: num, unit: actualUnit, normalized: num, ambiguous: false };
        
        const normalized = num * unitConfig.multiplier;
        
        return {
            value: num,
            unit: actualUnit,
            normalized,
            ambiguous: unit === 'auto' && !detectedUnit,
            detectedUnit
        };
    },

    formatAmount(normalizedValue, targetUnit = 'yuan') {
        if (normalizedValue === null || normalizedValue === undefined) return '';
        
        const unitConfig = this.AMOUNT_UNITS[targetUnit];
        if (!unitConfig) return String(normalizedValue);
        
        const value = normalizedValue / unitConfig.multiplier;
        return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })} ${unitConfig.label}`;
    },

    parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        
        const strValue = String(value).trim().replace(/[,，]/g, '');
        const num = parseFloat(strValue);
        
        if (isNaN(num)) return null;
        return num;
    },

    parseBoolean(value) {
        if (value === null || value === undefined || value === '') return null;
        
        const strValue = String(value).trim().toLowerCase();
        
        if (['true', '1', 'yes', '是', '对', '有'].includes(strValue)) return true;
        if (['false', '0', 'no', '否', '错', '无'].includes(strValue)) return false;
        
        return null;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

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

    groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
            return groups;
        }, {});
    },

    truncate(str, maxLength = 50) {
        if (!str) return '';
        const s = String(str);
        if (s.length <= maxLength) return s;
        return s.slice(0, maxLength) + '...';
    }
};

export default Utils;
