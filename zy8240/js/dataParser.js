const DataParser = (function() {
    'use strict';
    
    function parseJSON(content) {
        try {
            return {
                success: true,
                data: JSON.parse(content)
            };
        } catch (error) {
            return {
                success: false,
                error: `JSON解析错误: ${error.message}`
            };
        }
    }
    
    function parseCSV(content) {
        try {
            const lines = content.trim().split('\n');
            if (lines.length < 2) {
                return {
                    success: false,
                    error: 'CSV文件格式错误：至少需要标题行和数据行'
                };
            }
            
            const headers = parseCSVLine(lines[0]);
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header.trim()] = parseValue(values[index].trim());
                    });
                    data.push(row);
                }
            }
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            return {
                success: false,
                error: `CSV解析错误: ${error.message}`
            };
        }
    }
    
    function parseCSVLine(line) {
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
    }
    
    function parseValue(value) {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }
        
        if (value.toLowerCase() === 'true') {
            return true;
        }
        
        if (value.toLowerCase() === 'false') {
            return false;
        }
        
        return value;
    }
    
    function parseYAML(content) {
        try {
            if (typeof jsyaml !== 'undefined') {
                return {
                    success: true,
                    data: jsyaml.load(content)
                };
            } else {
                return {
                    success: false,
                    error: 'YAML解析库未加载，请确保js-yaml库可用'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `YAML解析错误: ${error.message}`
            };
        }
    }
    
    function parseByExtension(content, extension) {
        const ext = extension.toLowerCase().replace('.', '');
        
        switch (ext) {
            case 'json':
                return parseJSON(content);
            case 'csv':
                return parseCSV(content);
            case 'yaml':
            case 'yml':
                return parseYAML(content);
            default:
                return {
                    success: false,
                    error: `不支持的文件格式: .${ext}`
                };
        }
    }
    
    function validateSheltersData(data) {
        if (!Array.isArray(data)) {
            return {
                valid: false,
                error: 'shelters.json 格式错误：应该是一个数组'
            };
        }
        
        const requiredFields = ['id', 'name', 'capacity', 'location'];
        const errors = [];
        
        data.forEach((shelter, index) => {
            const missingFields = requiredFields.filter(field => !(field in shelter));
            if (missingFields.length > 0) {
                errors.push(`避难点 ${index + 1} 缺少必要字段: ${missingFields.join(', ')}`);
            }
            
            if (shelter.capacity !== undefined && typeof shelter.capacity !== 'number') {
                errors.push(`避难点 ${shelter.name || index + 1} 的capacity字段应该是数字类型`);
            }
        });
        
        if (errors.length > 0) {
            return {
                valid: false,
                error: errors.join('; ')
            };
        }
        
        return { valid: true };
    }
    
    function validateEvacueesData(data) {
        if (!Array.isArray(data)) {
            return {
                valid: false,
                error: 'evacuees.csv 格式错误：应该是一个数组'
            };
        }
        
        const requiredFields = ['id', 'name', 'arrival_time', 'shelter_id'];
        const errors = [];
        
        data.forEach((evacuee, index) => {
            const missingFields = requiredFields.filter(field => !(field in evacuee));
            if (missingFields.length > 0) {
                errors.push(`转移人员 ${index + 1} 缺少必要字段: ${missingFields.join(', ')}`);
            }
            
            if (evacuee.arrival_time) {
                const date = new Date(evacuee.arrival_time);
                if (isNaN(date.getTime())) {
                    errors.push(`转移人员 ${evacuee.name || index + 1} 的arrival_time格式无效`);
                }
            }
        });
        
        if (errors.length > 0) {
            return {
                valid: false,
                error: errors.join('; ')
            };
        }
        
        return { valid: true };
    }
    
    function validateSupplyRulesData(data) {
        if (typeof data !== 'object' || data === null) {
            return {
                valid: false,
                error: 'supply_rules.yaml 格式错误：应该是一个对象'
            };
        }
        
        const errors = [];
        
        if (!data.supply_types || !Array.isArray(data.supply_types)) {
            errors.push('supply_rules.yaml 缺少supply_types数组');
        }
        
        if (!data.rules || !Array.isArray(data.rules)) {
            errors.push('supply_rules.yaml 缺少rules数组');
        }
        
        if (errors.length > 0) {
            return {
                valid: false,
                error: errors.join('; ')
            };
        }
        
        return { valid: true };
    }
    
    return {
        parseJSON,
        parseCSV,
        parseYAML,
        parseByExtension,
        validateSheltersData,
        validateEvacueesData,
        validateSupplyRulesData
    };
})();
