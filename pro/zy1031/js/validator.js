/**
 * 数据校验模块
 * 负责校验导入的数据格式和内容
 */

const Validator = {
    /**
     * 校验数据
     * @param {Array} data 数据数组
     * @returns {Object} 校验结果 { valid: boolean, errors: Array }
     */
    validateData(data) {
        const errors = [];
        
        // 检查是否为空
        if (!data || data.length === 0) {
            errors.push('数据为空');
            return { valid: false, errors };
        }
        
        // 检查必填字段
        const requiredFields = CONFIG.fields.required;
        const firstRow = data[0];
        
        for (const field of requiredFields) {
            // 检查是否存在该字段（支持多种命名方式）
            const fieldFound = this.checkFieldExists(firstRow, field);
            if (!fieldFound) {
                errors.push(`缺少必填字段: ${field}`);
            }
        }
        
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        
        // 逐行校验数据
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowErrors = this.validateRow(row, i + 1);
            errors.push(...rowErrors);
        }
        
        // 检查是否有严重错误
        const criticalErrors = errors.filter(e => !e.startsWith('警告'));
        
        return {
            valid: criticalErrors.length === 0,
            errors: errors
        };
    },
    
    /**
     * 检查字段是否存在（支持多种命名）
     * @param {Object} row 数据行
     * @param {string} standardField 标准字段名
     * @returns {boolean} 是否存在
     */
    checkFieldExists(row, standardField) {
        // 字段名映射
        const fieldMappings = {
            '球员': ['球员', 'player', 'Player', '姓名', 'name', 'Name'],
            '拍型': ['拍型', 'shotType', 'ShotType', 'shot_type', '击球类型'],
            '落点X': ['落点X', 'x', 'X', '落点x', 'x坐标'],
            '落点Y': ['落点Y', 'y', 'Y', '落点y', 'y坐标'],
            '回合结果': ['回合结果', 'result', 'Result', '结果']
        };
        
        const variations = fieldMappings[standardField] || [standardField];
        
        for (const variation of variations) {
            if (row[variation] !== undefined && row[variation] !== null) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * 获取字段值（支持多种命名）
     * @param {Object} row 数据行
     * @param {string} standardField 标准字段名
     * @returns {*} 字段值
     */
    getFieldValue(row, standardField) {
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
        
        const variations = fieldMappings[standardField] || [standardField];
        
        for (const variation of variations) {
            if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                return row[variation];
            }
        }
        
        return undefined;
    },
    
    /**
     * 校验单行数据
     * @param {Object} row 数据行
     * @param {number} rowNumber 行号
     * @returns {Array} 错误列表
     */
    validateRow(row, rowNumber) {
        const errors = [];
        
        // 校验球员
        const player = this.getFieldValue(row, '球员');
        if (player === undefined || player === null || player === '') {
            errors.push(`行 ${rowNumber}: 球员不能为空`);
        }
        
        // 校验拍型
        const shotType = this.getFieldValue(row, '拍型');
        if (shotType === undefined || shotType === null || shotType === '') {
            errors.push(`行 ${rowNumber}: 拍型不能为空`);
        } else if (!CONFIG.shotTypes.includes(shotType)) {
            errors.push(`警告: 行 ${rowNumber}: 拍型 "${shotType}" 不是标准类型，建议使用: ${CONFIG.shotTypes.join(', ')}`);
        }
        
        // 校验落点X
        let x = this.getFieldValue(row, '落点X');
        if (x === undefined || x === null || x === '') {
            errors.push(`行 ${rowNumber}: 落点X不能为空`);
        } else {
            x = parseFloat(x);
            if (isNaN(x)) {
                errors.push(`行 ${rowNumber}: 落点X必须是数字`);
            } else if (x < CONFIG.coordinates.minX || x > CONFIG.coordinates.maxX) {
                errors.push(`行 ${rowNumber}: 落点X坐标 (${x}) 超出有效范围 [${CONFIG.coordinates.minX}, ${CONFIG.coordinates.maxX}]`);
            }
        }
        
        // 校验落点Y
        let y = this.getFieldValue(row, '落点Y');
        if (y === undefined || y === null || y === '') {
            errors.push(`行 ${rowNumber}: 落点Y不能为空`);
        } else {
            y = parseFloat(y);
            if (isNaN(y)) {
                errors.push(`行 ${rowNumber}: 落点Y必须是数字`);
            } else if (y < CONFIG.coordinates.minY || y > CONFIG.coordinates.maxY) {
                errors.push(`行 ${rowNumber}: 落点Y坐标 (${y}) 超出有效范围 [${CONFIG.coordinates.minY}, ${CONFIG.coordinates.maxY}]`);
            }
        }
        
        // 校验回合结果
        const result = this.getFieldValue(row, '回合结果');
        if (result === undefined || result === null || result === '') {
            errors.push(`行 ${rowNumber}: 回合结果不能为空`);
        } else if (!CONFIG.resultTypes.includes(result)) {
            errors.push(`警告: 行 ${rowNumber}: 回合结果 "${result}" 不是标准类型，建议使用: ${CONFIG.resultTypes.join(', ')}`);
        }
        
        // 校验时间段（可选）
        const timePeriod = this.getFieldValue(row, '时间段');
        if (timePeriod !== undefined && timePeriod !== null && timePeriod !== '') {
            if (!CONFIG.timePeriods.includes(timePeriod)) {
                errors.push(`警告: 行 ${rowNumber}: 时间段 "${timePeriod}" 不是标准类型，建议使用: ${CONFIG.timePeriods.join(', ')}`);
            }
        }
        
        // 校验训练日期（可选）
        const trainingDate = this.getFieldValue(row, '训练日期');
        if (trainingDate !== undefined && trainingDate !== null && trainingDate !== '') {
            const date = new Date(trainingDate);
            if (isNaN(date.getTime())) {
                errors.push(`警告: 行 ${rowNumber}: 训练日期 "${trainingDate}" 格式不正确`);
            }
        }
        
        return errors;
    },
    
    /**
     * 校验坐标范围
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @returns {Object} 校验结果 { valid: boolean, message: string }
     */
    validateCoordinates(x, y) {
        if (typeof x !== 'number' || isNaN(x)) {
            return { valid: false, message: 'X坐标必须是数字' };
        }
        if (typeof y !== 'number' || isNaN(y)) {
            return { valid: false, message: 'Y坐标必须是数字' };
        }
        
        if (x < CONFIG.coordinates.minX || x > CONFIG.coordinates.maxX) {
            return { 
                valid: false, 
                message: `X坐标 ${x} 超出有效范围 [${CONFIG.coordinates.minX}, ${CONFIG.coordinates.maxX}]` 
            };
        }
        
        if (y < CONFIG.coordinates.minY || y > CONFIG.coordinates.maxY) {
            return { 
                valid: false, 
                message: `Y坐标 ${y} 超出有效范围 [${CONFIG.coordinates.minY}, ${CONFIG.coordinates.maxY}]` 
            };
        }
        
        return { valid: true, message: '坐标有效' };
    },
    
    /**
     * 获取坐标所属区域
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {string} courtType 场地类型 ('singles' 或 'doubles')
     * @returns {string|null} 区域名称
     */
    getZoneName(x, y, courtType = 'singles') {
        const zones = COURT_ZONES[courtType];
        if (!zones) return null;
        
        for (const zone of zones) {
            if (x >= zone.xMin && x <= zone.xMax && 
                y >= zone.yMin && y <= zone.yMax) {
                return zone.name;
            }
        }
        
        return '其他区域';
    },
    
    /**
     * 检查是否是网前区域
     * @param {number} y Y坐标
     * @returns {boolean} 是否是网前
     */
    isNetArea(y) {
        // 网前定义为距离网较近的区域（Y值较小，靠近场地一端）
        return y < -3.0;  // 假设网在中间，Y < -3 为网前区域
    },
    
    /**
     * 检查是否是后场区域
     * @param {number} y Y坐标
     * @returns {boolean} 是否是后场
     */
    isBackArea(y) {
        return y > 3.0;  // Y > 3 为后场区域
    },
    
    /**
     * 检查是否是中场区域
     * @param {number} y Y坐标
     * @returns {boolean} 是否是中场
     */
    isMidArea(y) {
        return y >= -3.0 && y <= 3.0;
    },
    
    /**
     * 统计各区域落点数量
     * @param {Array} data 数据数组
     * @param {string} courtType 场地类型
     * @returns {Object} 区域统计
     */
    countShotsByZone(data, courtType = 'singles') {
        const zones = COURT_ZONES[courtType];
        const stats = {};
        
        // 初始化各区域计数
        for (const zone of zones) {
            stats[zone.name] = 0;
        }
        stats['其他区域'] = 0;
        
        // 统计
        for (const row of data) {
            const x = parseFloat(this.getFieldValue(row, '落点X'));
            const y = parseFloat(this.getFieldValue(row, '落点Y'));
            const zoneName = this.getZoneName(x, y, courtType);
            if (zoneName && stats[zoneName] !== undefined) {
                stats[zoneName]++;
            } else {
                stats['其他区域']++;
            }
        }
        
        return stats;
    },
    
    /**
     * 统计得失分情况
     * @param {Array} data 数据数组
     * @returns {Object} 得失分统计
     */
    countResults(data) {
        const stats = {
            '得分': 0,
            '失分': 0,
            '继续': 0,
            '其他': 0
        };
        
        for (const row of data) {
            const result = this.getFieldValue(row, '回合结果');
            if (stats[result] !== undefined) {
                stats[result]++;
            } else {
                stats['其他']++;
            }
        }
        
        return stats;
    },
    
    /**
     * 计算得分率
     * @param {Array} data 数据数组
     * @returns {number} 得分率（0-1）
     */
    calculateWinRate(data) {
        const results = this.countResults(data);
        const totalDecisive = results['得分'] + results['失分'];
        
        if (totalDecisive === 0) return 0;
        
        return results['得分'] / totalDecisive;
    },
    
    /**
     * 计算网前失误率
     * @param {Array} data 数据数组
     * @returns {number} 网前失误率（0-1）
     */
    calculateNetErrorRate(data) {
        let netShots = 0;
        let netErrors = 0;
        
        for (const row of data) {
            const y = parseFloat(this.getFieldValue(row, '落点Y'));
            const result = this.getFieldValue(row, '回合结果');
            
            if (this.isNetArea(y)) {
                netShots++;
                if (result === '失分') {
                    netErrors++;
                }
            }
        }
        
        if (netShots === 0) return 0;
        
        return netErrors / netShots;
    }
};
