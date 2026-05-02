/**
 * 数据管理模块
 * 负责数据的导入、存储、管理
 */

const DataManager = {
    trainingData: [],  // 存储所有训练数据
    currentDataId: null,  // 当前选中的训练数据ID
    filteredData: [],  // 筛选后的数据
    
    /**
     * 初始化数据管理器
     */
    init() {
        this.loadFromStorage();
    },
    
    /**
     * 从本地存储加载数据
     */
    loadFromStorage() {
        const savedData = localStorage.getItem(CONFIG.storage.trainingData);
        if (savedData) {
            try {
                this.trainingData = JSON.parse(savedData);
            } catch (e) {
                console.error('解析本地存储数据失败:', e);
                this.trainingData = [];
            }
        }
    },
    
    /**
     * 保存数据到本地存储
     */
    saveToStorage() {
        localStorage.setItem(CONFIG.storage.trainingData, JSON.stringify(this.trainingData));
    },
    
    /**
     * 导入CSV数据
     * @param {File} file CSV文件
     * @param {Function} callback 回调函数
     */
    importCSV(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = Papa.parse(e.target.result, {
                    header: true,
                    skipEmptyLines: true,
                    encoding: 'UTF-8'
                });
                
                if (result.errors.length > 0) {
                    callback({
                        success: false,
                        errors: result.errors.map(err => `行 ${err.row}: ${err.message}`)
                    });
                    return;
                }
                
                // 验证数据
                const validation = Validator.validateData(result.data);
                if (!validation.valid) {
                    callback({
                        success: false,
                        errors: validation.errors
                    });
                    return;
                }
                
                // 转换数据格式
                const processedData = this.processData(result.data, file.name);
                
                callback({
                    success: true,
                    data: processedData,
                    fileName: file.name
                });
                
            } catch (e) {
                callback({
                    success: false,
                    errors: [`解析CSV文件失败: ${e.message}`]
                });
            }
        };
        reader.onerror = () => {
            callback({
                success: false,
                errors: ['读取文件失败']
            });
        };
        reader.readAsText(file);
    },
    
    /**
     * 导入JSON数据
     * @param {File} file JSON文件
     * @param {Function} callback 回调函数
     */
    importJSON(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 支持两种格式：直接数组 或 { data: [...] }
                const actualData = Array.isArray(data) ? data : (data.data || []);
                
                if (!Array.isArray(actualData) || actualData.length === 0) {
                    callback({
                        success: false,
                        errors: ['JSON文件格式不正确或数据为空']
                    });
                    return;
                }
                
                // 验证数据
                const validation = Validator.validateData(actualData);
                if (!validation.valid) {
                    callback({
                        success: false,
                        errors: validation.errors
                    });
                    return;
                }
                
                // 转换数据格式
                const processedData = this.processData(actualData, file.name);
                
                callback({
                    success: true,
                    data: processedData,
                    fileName: file.name
                });
                
            } catch (e) {
                callback({
                    success: false,
                    errors: [`解析JSON文件失败: ${e.message}`]
                });
            }
        };
        reader.onerror = () => {
            callback({
                success: false,
                errors: ['读取文件失败']
            });
        };
        reader.readAsText(file);
    },
    
    /**
     * 处理导入的数据
     * @param {Array} rawData 原始数据
     * @param {string} fileName 文件名
     * @returns {Object} 处理后的数据对象
     */
    processData(rawData, fileName) {
        // 标准化字段名（支持中文和英文）
        const standardizedData = rawData.map(row => {
            const standardized = {};
            
            // 映射字段名
            const fieldMappings = {
                '球员': ['球员', 'player', 'Player', '姓名', 'name', 'Name'],
                '拍型': ['拍型', 'shotType', 'ShotType', 'shot_type', '击球类型'],
                '落点X': ['落点X', 'x', 'X', '落点x', 'x坐标'],
                '落点Y': ['落点Y', 'y', 'Y', '落点y', 'y坐标'],
                '回合结果': ['回合结果', 'result', 'Result', '结果'],
                '时间段': ['时间段', 'timePeriod', 'TimePeriod', 'time_period', '时段'],
                '备注': ['备注', 'notes', 'Notes', 'comment', 'Comment'],
                '训练日期': ['训练日期', 'trainingDate', 'TrainingDate', 'date', 'Date', '日期']
            };
            
            for (const [standardField, variations] of Object.entries(fieldMappings)) {
                for (const variation of variations) {
                    if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                        standardized[standardField] = row[variation];
                        break;
                    }
                }
            }
            
            // 转换坐标为数字
            if (standardized['落点X'] !== undefined) {
                standardized['落点X'] = parseFloat(standardized['落点X']);
            }
            if (standardized['落点Y'] !== undefined) {
                standardized['落点Y'] = parseFloat(standardized['落点Y']);
            }
            
            return standardized;
        });
        
        // 提取训练日期（从数据或文件名）
        let trainingDate = this.extractDateFromData(standardizedData);
        if (!trainingDate) {
            trainingDate = this.extractDateFromFileName(fileName);
        }
        if (!trainingDate) {
            trainingDate = Utils.formatDate(new Date());
        }
        
        // 生成数据对象
        return {
            id: Utils.generateId(),
            name: fileName.replace(/\.(csv|json)$/i, ''),
            fileName: fileName,
            importTime: new Date().toISOString(),
            trainingDate: trainingDate,
            data: standardizedData,
            totalShots: standardizedData.length,
            players: Utils.unique(standardizedData, '球员'),
            shotTypes: Utils.unique(standardizedData, '拍型'),
            resultTypes: Utils.unique(standardizedData, '回合结果'),
            dates: Utils.unique(standardizedData, '训练日期').filter(d => d)
        };
    },
    
    /**
     * 从数据中提取日期
     * @param {Array} data 数据数组
     * @returns {string|null} 日期字符串
     */
    extractDateFromData(data) {
        if (!data || data.length === 0) return null;
        
        // 检查每条记录的训练日期字段
        const dates = Utils.unique(data, '训练日期').filter(d => d && d !== '');
        if (dates.length === 1) {
            return dates[0];
        }
        
        // 如果有多个日期，取最早的
        if (dates.length > 1) {
            const sortedDates = dates.sort((a, b) => new Date(a) - new Date(b));
            return sortedDates[0];
        }
        
        return null;
    },
    
    /**
     * 从文件名中提取日期
     * @param {string} fileName 文件名
     * @returns {string|null} 日期字符串
     */
    extractDateFromFileName(fileName) {
        // 匹配 YYYY-MM-DD 或 YYYYMMDD 格式
        const patterns = [
            /(\d{4})-(\d{1,2})-(\d{1,2})/,
            /(\d{4})(\d{2})(\d{2})/
        ];
        
        for (const pattern of patterns) {
            const match = fileName.match(pattern);
            if (match) {
                try {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]);
                    const day = parseInt(match[3]);
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                        return Utils.formatDate(date);
                    }
                } catch (e) {
                    // 忽略无效日期
                }
            }
        }
        
        return null;
    },
    
    /**
     * 添加训练数据
     * @param {Object} trainingData 训练数据对象
     * @returns {string} 数据ID
     */
    addTrainingData(trainingData) {
        // 检查是否已存在同名数据
        const existingIndex = this.trainingData.findIndex(d => d.name === trainingData.name);
        if (existingIndex !== -1) {
            // 询问是否覆盖
            const overwrite = confirm(`已存在名为 "${trainingData.name}" 的数据，是否覆盖？`);
            if (!overwrite) {
                // 重命名
                let counter = 1;
                let newName = `${trainingData.name} (${counter})`;
                while (this.trainingData.some(d => d.name === newName)) {
                    counter++;
                    newName = `${trainingData.name} (${counter})`;
                }
                trainingData.name = newName;
            } else {
                // 覆盖
                this.trainingData.splice(existingIndex, 1);
            }
        }
        
        this.trainingData.push(trainingData);
        this.saveToStorage();
        return trainingData.id;
    },
    
    /**
     * 获取训练数据
     * @param {string} id 数据ID
     * @returns {Object|null} 训练数据对象
     */
    getTrainingData(id) {
        return this.trainingData.find(d => d.id === id) || null;
    },
    
    /**
     * 获取所有训练数据摘要
     * @returns {Array} 训练数据摘要列表
     */
    getAllTrainingDataSummaries() {
        return this.trainingData.map(d => ({
            id: d.id,
            name: d.name,
            trainingDate: d.trainingDate,
            importTime: d.importTime,
            totalShots: d.totalShots,
            players: d.players
        }));
    },
    
    /**
     * 删除训练数据
     * @param {string} id 数据ID
     * @returns {boolean} 是否成功删除
     */
    deleteTrainingData(id) {
        const index = this.trainingData.findIndex(d => d.id === id);
        if (index !== -1) {
            this.trainingData.splice(index, 1);
            this.saveToStorage();
            if (this.currentDataId === id) {
                this.currentDataId = null;
                this.filteredData = [];
            }
            return true;
        }
        return false;
    },
    
    /**
     * 设置当前选中的数据
     * @param {string} id 数据ID
     */
    setCurrentData(id) {
        const data = this.getTrainingData(id);
        if (data) {
            this.currentDataId = id;
            this.filteredData = [...data.data]; // 默认不筛选
            return true;
        }
        return false;
    },
    
    /**
     * 获取当前数据
     * @returns {Object|null} 当前数据对象
     */
    getCurrentData() {
        return this.getTrainingData(this.currentDataId);
    },
    
    /**
     * 应用筛选条件
     * @param {Object} filters 筛选条件
     */
    applyFilters(filters) {
        const currentData = this.getCurrentData();
        if (!currentData) {
            this.filteredData = [];
            return;
        }
        
        this.filteredData = Utils.filterArray(currentData.data, filters);
    },
    
    /**
     * 重置筛选
     */
    resetFilters() {
        const currentData = this.getCurrentData();
        if (currentData) {
            this.filteredData = [...currentData.data];
        }
    },
    
    /**
     * 生成示例数据
     * @param {string} date 训练日期
     * @param {Array} players 球员列表
     * @param {number} count 数据条数
     * @returns {Array} 示例数据数组
     */
    generateSampleData(date, players, count = 150) {
        const data = [];
        const shotTypes = CONFIG.shotTypes;
        const resultTypes = CONFIG.resultTypes;
        const timePeriods = CONFIG.timePeriods;
        
        // 定义常见的落点区域（用于生成更真实的数据）
        const hotZones = [
            { xMin: -2, xMax: 2, yMin: -6, yMax: -4, weight: 0.3 },  // 网前
            { xMin: -2.5, xMax: 2.5, yMin: 4, yMax: 6.5, weight: 0.4 },  // 后场
            { xMin: -2, xMax: 2, yMin: -2, yMax: 2, weight: 0.2 },  // 中场
            { xMin: -2.5, xMax: 2.5, yMin: -6.5, yMax: 6.5, weight: 0.1 }  // 全场
        ];
        
        // 定义不同拍型的典型落点
        const shotTypeZones = {
            '高远球': { yMin: 4, yMax: 6.5, xMin: -2, xMax: 2 },
            '平高球': { yMin: 3, yMax: 6, xMin: -2.5, xMax: 2.5 },
            '杀球': { yMin: -1, yMax: 1, xMin: -2, xMax: 2 },
            '吊球': { yMin: -4, yMax: -2, xMin: -2, xMax: 2 },
            '搓球': { yMin: -5, yMax: -3, xMin: -1.5, xMax: 1.5 },
            '推球': { yMin: 2, yMax: 5, xMin: -2, xMax: 2 },
            '勾球': { yMin: -5, yMax: -3, xMin: -2, xMax: 2 },
            '扑球': { yMin: -5, yMax: -3, xMin: -1, xMax: 1 },
            '挑球': { yMin: 4, yMax: 6.5, xMin: -2, xMax: 2 },
            '接杀': { yMin: -3, yMax: 0, xMin: -2.5, xMax: 2.5 },
            '抽球': { yMin: -1, yMax: 2, xMin: -2.5, xMax: 2.5 },
            '挡网': { yMin: -5, yMax: -3, xMin: -2, xMax: 2 }
        };
        
        for (let i = 0; i < count; i++) {
            // 随机选择球员
            const player = players[Math.floor(Math.random() * players.length)];
            
            // 随机选择拍型（某些拍型更常见）
            const shotTypeWeights = {
                '高远球': 0.15,
                '平高球': 0.12,
                '杀球': 0.10,
                '吊球': 0.12,
                '搓球': 0.10,
                '推球': 0.08,
                '勾球': 0.06,
                '扑球': 0.05,
                '挑球': 0.08,
                '接杀': 0.05,
                '抽球': 0.05,
                '挡网': 0.04
            };
            
            let shotType = '高远球';
            const rand = Math.random();
            let cumulative = 0;
            for (const [st, weight] of Object.entries(shotTypeWeights)) {
                cumulative += weight;
                if (rand <= cumulative) {
                    shotType = st;
                    break;
                }
            }
            
            // 生成落点坐标
            let x, y;
            const zone = shotTypeZones[shotType];
            if (zone) {
                x = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
                y = zone.yMin + Math.random() * (zone.yMax - zone.yMin);
            } else {
                // 随机选择一个热区
                let zoneIndex = 0;
                const zoneRand = Math.random();
                let zoneCumulative = 0;
                for (let j = 0; j < hotZones.length; j++) {
                    zoneCumulative += hotZones[j].weight;
                    if (zoneRand <= zoneCumulative) {
                        zoneIndex = j;
                        break;
                    }
                }
                const selectedZone = hotZones[zoneIndex];
                x = selectedZone.xMin + Math.random() * (selectedZone.xMax - selectedZone.xMin);
                y = selectedZone.yMin + Math.random() * (selectedZone.yMax - selectedZone.yMin);
            }
            
            // 添加一些随机性
            x += (Math.random() - 0.5) * 0.5;
            y += (Math.random() - 0.5) * 0.5;
            
            // 确保在场地范围内
            x = Math.max(CONFIG.coordinates.minX, Math.min(CONFIG.coordinates.maxX, x));
            y = Math.max(CONFIG.coordinates.minY, Math.min(CONFIG.coordinates.maxY, y));
            
            // 生成回合结果
            let result = '继续';
            const resultRand = Math.random();
            if (resultRand < 0.3) {
                result = '得分';
            } else if (resultRand < 0.5) {
                result = '失分';
            }
            
            // 生成时间段
            const periodIndex = Math.floor(Math.random() * timePeriods.length);
            const timePeriod = timePeriods[periodIndex];
            
            // 生成备注（偶尔）
            let notes = '';
            if (Math.random() < 0.2) {
                const noteTemplates = [
                    '质量不错',
                    '需要加强',
                    '落点很好',
                    '力量不足',
                    '角度很好',
                    '失误了',
                    '得分了',
                    '配合不错'
                ];
                notes = noteTemplates[Math.floor(Math.random() * noteTemplates.length)];
            }
            
            data.push({
                '球员': player,
                '拍型': shotType,
                '落点X': parseFloat(x.toFixed(2)),
                '落点Y': parseFloat(y.toFixed(2)),
                '回合结果': result,
                '时间段': timePeriod,
                '备注': notes,
                '训练日期': date
            });
        }
        
        return data;
    },
    
    /**
     * 生成并添加示例数据
     */
    generateAndAddSampleData() {
        const dates = SAMPLE_DATA_CONFIG.trainingDates;
        const players = SAMPLE_DATA_CONFIG.players;
        const count = SAMPLE_DATA_CONFIG.shotCountPerSession;
        
        for (const date of dates) {
            const rawData = this.generateSampleData(date, players, count);
            const processedData = {
                id: Utils.generateId(),
                name: `示例训练数据 - ${date}`,
                fileName: `sample_${date}.json`,
                importTime: new Date().toISOString(),
                trainingDate: date,
                data: rawData,
                totalShots: rawData.length,
                players: Utils.unique(rawData, '球员'),
                shotTypes: Utils.unique(rawData, '拍型'),
                resultTypes: Utils.unique(rawData, '回合结果'),
                dates: [date]
            };
            
            this.addTrainingData(processedData);
        }
        
        return true;
    }
};
