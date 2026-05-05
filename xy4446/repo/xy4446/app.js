/**
 * 窑烧复盘工具 - 核心应用
 * 
 * 功能模块：
 * 1. 数据模型定义
 * 2. 文件导入处理
 * 3. 风险分析算法
 * 4. 数据持久化
 * 5. UI 渲染与交互
 * 6. 导出功能
 */

// ==================== 数据模型定义 ====================

/**
 * 窑温曲线数据点
 * @typedef {Object} TemperaturePoint
 * @property {number} time - 时间点（分钟）
 * @property {number} temperature - 温度（摄氏度）
 * @property {number} [rate] - 升温/降温速率（℃/min）
 */

/**
 * 釉料配方
 * @typedef {Object} GlazeRecipe
 * @property {string} id - 釉料唯一标识
 * @property {string} name - 釉料名称
 * @property {Object} ingredients - 成分组成 { 原料名: 百分比 }
 * @property {number} firingTemp - 烧成温度
 * @property {string} atmosphere - 烧成气氛（氧化/还原）
 * @property {number} holdTime - 保温时间（分钟）
 * @property {string} [notes] - 备注
 */

/**
 * 窑位信息
 * @typedef {Object} KilnPosition
 * @property {string} layerId - 窑层标识
 * @property {number} layerIndex - 窑层序号（从下往上）
 * @property {string} positionCode - 位置编码（如：A1, B2）
 * @property {string} zone - 区域（前/中/后）
 */

/**
 * 作品信息
 * @typedef {Object} Work
 * @property {string} id - 作品唯一标识
 * @property {string} name - 作品名称
 * @property {string} artist - 作者
 * @property {KilnPosition} position - 窑位
 * @property {string[]} glazes - 使用的釉料ID列表
 * @property {string} clayType - 泥料类型
 * @property {number} thickness - 壁厚（mm）
 * @property {string[]} photos - 照片文件名列表
 * @property {Risk[]} risks - 检测到的风险
 * @property {Note[]} notes - 备注列表
 */

/**
 * 风险类型
 * @typedef {Object} Risk
 * @property {string} id - 风险唯一标识
 * @property {string} type - 风险类型（shrinkage/pinhole/flowing/warping）
 * @property {string} typeName - 风险类型名称（缩釉/针孔/流釉/翘曲）
 * @property {string} level - 风险等级（high/medium/low）
 * @property {string} description - 风险描述
 * @property {Object} factors - 风险因子
 * @property {string[]} evidence - 证据列表
 * @property {Object} [overrule] - 改判信息
 * @property {boolean} overrule.isOverruled - 是否被改判
 * @property {string} overrule.newLevel - 改判后的等级
 * @property {string} overrule.reason - 改判原因
 * @property {string} overrule.operator - 改判人
 * @property {string} overrule.timestamp - 改判时间
 */

/**
 * 备注
 * @typedef {Object} Note
 * @property {string} id - 备注唯一标识
 * @property {string} content - 备注内容
 * @property {string} author - 作者
 * @property {string} timestamp - 时间戳
 */

/**
 * 窑烧记录
 * @typedef {Object} KilnFiringRecord
 * @property {string} id - 记录唯一标识
 * @property {string} name - 窑烧名称
 * @property {string} date - 日期
 * @property {string} kilnId - 窑炉编号
 * @property {TemperaturePoint[]} temperatureCurve - 窑温曲线
 * @property {GlazeRecipe[]} glazeRecipes - 釉料配方
 * @property {Map<string, Work>} works - 作品映射表
 * @property {Map<string, string>} photoData - 照片数据（base64）
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 */

// ==================== 应用状态 ====================

const AppState = {
    currentRecord: null,
    selectedLayer: null,
    selectedWork: null,
    isInitialized: false
};

// ==================== 工具函数 ====================

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
            const value = values[index];
            obj[header] = isNaN(value) ? value : parseFloat(value);
        });
        result.push(obj);
    }
    
    return result;
}

// ==================== 风险分析算法 ====================

const RiskAnalyzer = {
    
    /**
     * 分析缩釉风险
     * 缩釉主要原因：
     * 1. 升温过快
     * 2. 釉料与泥料膨胀系数不匹配
     * 3. 釉层过厚
     * 4. 窑位温度分布不均
     */
    analyzeShrinkage(work, temperatureCurve, glazeRecipes) {
        const factors = [];
        let level = 'low';
        const evidence = [];
        
        const heatingRate = this.calculateHeatingRate(temperatureCurve, 500, 800);
        if (heatingRate > 150) {
            factors.push({ name: '升温过快', value: `${heatingRate.toFixed(1)}℃/h`, threshold: '≤150℃/h' });
            evidence.push(`500-800℃区间升温速率为${heatingRate.toFixed(1)}℃/h，超过安全阈值`);
            level = 'high';
        } else if (heatingRate > 100) {
            factors.push({ name: '升温偏快', value: `${heatingRate.toFixed(1)}℃/h`, threshold: '≤100℃/h' });
            evidence.push(`500-800℃区间升温速率为${heatingRate.toFixed(1)}℃/h，偏快`);
            level = 'medium';
        }
        
        if (work.position) {
            const zoneRisk = this.getZoneRisk(work.position.zone);
            if (zoneRisk === 'high') {
                factors.push({ name: '窑位区域', value: work.position.zone, risk: '高风险区域' });
                evidence.push(`位于${work.position.zone}区域，温度分布可能不均`);
                if (level === 'low') level = 'medium';
            }
        }
        
        if (work.thickness > 8) {
            factors.push({ name: '壁厚', value: `${work.thickness}mm`, threshold: '≤8mm' });
            evidence.push(`作品壁厚${work.thickness}mm，较厚，可能导致内外温差`);
            if (level === 'low') level = 'medium';
        }
        
        work.glazes.forEach(glazeId => {
            const glaze = glazeRecipes.find(g => g.id === glazeId);
            if (glaze && this.isHighExpansionGlaze(glaze)) {
                factors.push({ name: '釉料特性', value: glaze.name, risk: '高膨胀系数釉料' });
                evidence.push(`使用高膨胀系数釉料${glaze.name}`);
                level = 'high';
            }
        });
        
        return {
            type: 'shrinkage',
            typeName: '缩釉',
            level,
            description: level === 'high' ? '存在较高缩釉风险，建议检查釉料配方和升温曲线' :
                        level === 'medium' ? '存在一定缩釉风险，需关注窑位和升温情况' :
                        '缩釉风险较低',
            factors,
            evidence
        };
    },
    
    /**
     * 分析针孔风险
     * 针孔主要原因：
     * 1. 釉料分解气体未能及时排出
     * 2. 保温时间不足
     * 3. 釉层过厚
     * 4. 升温过快
     */
    analyzePinhole(work, temperatureCurve, glazeRecipes) {
        const factors = [];
        let level = 'low';
        const evidence = [];
        
        const holdTime = this.getHoldTime(temperatureCurve, 1200, 50);
        if (holdTime < 20) {
            factors.push({ name: '保温时间', value: `${holdTime}分钟`, threshold: '≥20分钟' });
            evidence.push(`高温保温时间仅${holdTime}分钟，可能导致釉料气体未能完全排出`);
            level = 'high';
        } else if (holdTime < 30) {
            factors.push({ name: '保温时间', value: `${holdTime}分钟`, threshold: '≥30分钟' });
            evidence.push(`高温保温时间${holdTime}分钟，偏短`);
            level = 'medium';
        }
        
        const criticalRate = this.calculateHeatingRate(temperatureCurve, 800, 1000);
        if (criticalRate > 200) {
            factors.push({ name: '临界区升温', value: `${criticalRate.toFixed(1)}℃/h`, threshold: '≤200℃/h' });
            evidence.push(`800-1000℃临界区升温过快(${criticalRate.toFixed(1)}℃/h)`);
            if (level === 'low') level = 'medium';
        }
        
        work.glazes.forEach(glazeId => {
            const glaze = glazeRecipes.find(g => g.id === glazeId);
            if (glaze && this.hasHighVolatileContent(glaze)) {
                factors.push({ name: '釉料成分', value: glaze.name, risk: '含高挥发性成分' });
                evidence.push(`釉料${glaze.name}含高挥发性成分，易产生气体`);
                level = 'high';
            }
        });
        
        return {
            type: 'pinhole',
            typeName: '针孔',
            level,
            description: level === 'high' ? '存在较高针孔风险，建议检查保温时间和釉料配方' :
                        level === 'medium' ? '存在一定针孔风险，需关注保温和升温情况' :
                        '针孔风险较低',
            factors,
            evidence
        };
    },
    
    /**
     * 分析流釉风险
     * 流釉主要原因：
     * 1. 烧成温度过高
     * 2. 保温时间过长
     * 3. 釉层过厚
     * 4. 釉料熔融温度低
     */
    analyzeFlowing(work, temperatureCurve, glazeRecipes) {
        const factors = [];
        let level = 'low';
        const evidence = [];
        
        const maxTemp = this.getMaxTemperature(temperatureCurve);
        
        work.glazes.forEach(glazeId => {
            const glaze = glazeRecipes.find(g => g.id === glazeId);
            if (glaze) {
                if (maxTemp > glaze.firingTemp + 30) {
                    factors.push({ 
                        name: '烧成温度', 
                        value: `${maxTemp}℃`, 
                        threshold: `≤${glaze.firingTemp + 30}℃` 
                    });
                    evidence.push(`实际烧成温度${maxTemp}℃超过釉料${glaze.name}的安全温度`);
                    level = 'high';
                } else if (maxTemp > glaze.firingTemp) {
                    factors.push({ 
                        name: '烧成温度', 
                        value: `${maxTemp}℃`, 
                        threshold: `≤${glaze.firingTemp}℃` 
                    });
                    evidence.push(`实际烧成温度${maxTemp}℃接近釉料${glaze.name}的上限`);
                    if (level === 'low') level = 'medium';
                }
            }
        });
        
        const highTempHoldTime = this.getHoldTime(temperatureCurve, 1200, 50);
        if (highTempHoldTime > 60) {
            factors.push({ name: '高温保温', value: `${highTempHoldTime}分钟`, threshold: '≤60分钟' });
            evidence.push(`高温保温时间${highTempHoldTime}分钟过长`);
            if (level === 'low') level = 'medium';
            else if (level === 'medium') level = 'high';
        }
        
        if (work.position) {
            const hotZoneRisk = this.isHotZone(work.position.zone, work.position.layerIndex);
            if (hotZoneRisk) {
                factors.push({ name: '窑位区域', value: `${work.position.zone}第${work.position.layerIndex}层`, risk: '高温区域' });
                evidence.push(`位于窑炉高温区域，实际温度可能偏高`);
                if (level === 'low') level = 'medium';
            }
        }
        
        return {
            type: 'flowing',
            typeName: '流釉',
            level,
            description: level === 'high' ? '存在较高流釉风险，建议检查烧成温度和保温时间' :
                        level === 'medium' ? '存在一定流釉风险，需关注窑位和温度控制' :
                        '流釉风险较低',
            factors,
            evidence
        };
    },
    
    /**
     * 分析翘曲风险
     * 翘曲主要原因：
     * 1. 降温过快
     * 2. 作品厚度不均
     * 3. 窑位温度分布不均
     * 4. 支撑不当
     */
    analyzeWarping(work, temperatureCurve, glazeRecipes) {
        const factors = [];
        let level = 'low';
        const evidence = [];
        
        const coolingRate = this.calculateCoolingRate(temperatureCurve, 1000, 600);
        if (coolingRate > 200) {
            factors.push({ name: '降温过快', value: `${coolingRate.toFixed(1)}℃/h`, threshold: '≤200℃/h' });
            evidence.push(`1000-600℃区间降温速率${coolingRate.toFixed(1)}℃/h过快`);
            level = 'high';
        } else if (coolingRate > 150) {
            factors.push({ name: '降温偏快', value: `${coolingRate.toFixed(1)}℃/h`, threshold: '≤150℃/h' });
            evidence.push(`1000-600℃区间降温速率${coolingRate.toFixed(1)}℃/h偏快`);
            level = 'medium';
        }
        
        if (work.thickness > 10) {
            factors.push({ name: '壁厚', value: `${work.thickness}mm`, threshold: '≤10mm' });
            evidence.push(`作品壁厚${work.thickness}mm，较厚，降温时内外温差大`);
            if (level === 'low') level = 'medium';
        }
        
        if (work.position) {
            const zoneRisk = this.getZoneRisk(work.position.zone);
            if (zoneRisk === 'high') {
                factors.push({ name: '窑位区域', value: work.position.zone, risk: '温度不均区域' });
                evidence.push(`位于${work.position.zone}区域，可能存在温度不均`);
                if (level === 'low') level = 'medium';
            }
        }
        
        work.glazes.forEach(glazeId => {
            const glaze = glazeRecipes.find(g => g.id === glazeId);
            if (glaze && this.isMatteGlaze(glaze)) {
                factors.push({ name: '釉料类型', value: glaze.name, risk: '哑光釉' });
                evidence.push(`使用哑光釉${glaze.name}，冷却收缩应力大`);
                level = 'medium';
            }
        });
        
        return {
            type: 'warping',
            typeName: '翘曲',
            level,
            description: level === 'high' ? '存在较高翘曲风险，建议检查降温曲线和作品厚度' :
                        level === 'medium' ? '存在一定翘曲风险，需关注降温速度和窑位' :
                        '翘曲风险较低',
            factors,
            evidence
        };
    },
    
    /**
     * 综合分析作品的所有风险
     */
    analyzeWork(work, temperatureCurve, glazeRecipes) {
        const risks = [];
        
        risks.push({
            id: generateId(),
            ...this.analyzeShrinkage(work, temperatureCurve, glazeRecipes),
            overrule: { isOverruled: false }
        });
        
        risks.push({
            id: generateId(),
            ...this.analyzePinhole(work, temperatureCurve, glazeRecipes),
            overrule: { isOverruled: false }
        });
        
        risks.push({
            id: generateId(),
            ...this.analyzeFlowing(work, temperatureCurve, glazeRecipes),
            overrule: { isOverruled: false }
        });
        
        risks.push({
            id: generateId(),
            ...this.analyzeWarping(work, temperatureCurve, glazeRecipes),
            overrule: { isOverruled: false }
        });
        
        return risks;
    },
    
    // 辅助计算函数
    calculateHeatingRate(curve, startTemp, endTemp) {
        if (!curve || curve.length < 2) return 0;
        
        const startPoint = curve.find(p => p.temperature >= startTemp);
        const endPoint = [...curve].reverse().find(p => p.temperature <= endTemp);
        
        if (!startPoint || !endPoint) return 0;
        
        const timeDiff = endPoint.time - startPoint.time;
        const tempDiff = endPoint.temperature - startPoint.temperature;
        
        if (timeDiff <= 0) return 0;
        
        return (tempDiff / timeDiff) * 60;
    },
    
    calculateCoolingRate(curve, startTemp, endTemp) {
        if (!curve || curve.length < 2) return 0;
        
        const maxTemp = this.getMaxTemperature(curve);
        const maxIndex = curve.findIndex(p => p.temperature === maxTemp);
        
        const coolingSegment = curve.slice(maxIndex);
        
        const startPoint = coolingSegment.find(p => p.temperature <= startTemp);
        const endPoint = coolingSegment.find(p => p.temperature <= endTemp);
        
        if (!startPoint || !endPoint) return 0;
        
        const timeDiff = endPoint.time - startPoint.time;
        const tempDiff = startPoint.temperature - endPoint.temperature;
        
        if (timeDiff <= 0) return 0;
        
        return (tempDiff / timeDiff) * 60;
    },
    
    getMaxTemperature(curve) {
        if (!curve || curve.length === 0) return 0;
        return Math.max(...curve.map(p => p.temperature));
    },
    
    getHoldTime(curve, targetTemp, tolerance) {
        if (!curve || curve.length < 2) return 0;
        
        let inHold = false;
        let holdStartTime = 0;
        let totalHoldTime = 0;
        
        for (let i = 1; i < curve.length; i++) {
            const temp = curve[i].temperature;
            const isWithinRange = Math.abs(temp - targetTemp) <= tolerance;
            
            if (isWithinRange && !inHold) {
                inHold = true;
                holdStartTime = curve[i].time;
            } else if (!isWithinRange && inHold) {
                inHold = false;
                totalHoldTime += curve[i - 1].time - holdStartTime;
            }
        }
        
        if (inHold) {
            totalHoldTime += curve[curve.length - 1].time - holdStartTime;
        }
        
        return totalHoldTime;
    },
    
    getZoneRisk(zone) {
        const highRiskZones = ['前', '后', '边缘'];
        return highRiskZones.includes(zone) ? 'high' : 'low';
    },
    
    isHotZone(zone, layerIndex) {
        const hotZones = ['中'];
        const hotLayers = [3, 4, 5];
        return hotZones.includes(zone) && hotLayers.includes(layerIndex);
    },
    
    isHighExpansionGlaze(glaze) {
        const highExpansionIngredients = ['长石', '石英', '钾长石'];
        let total = 0;
        for (const ing in glaze.ingredients) {
            if (highExpansionIngredients.some(hei => ing.includes(hei))) {
                total += glaze.ingredients[ing];
            }
        }
        return total > 60;
    },
    
    hasHighVolatileContent(glaze) {
        const volatileIngredients = ['碳酸盐', '碳酸钡', '碳酸锶', '白云石'];
        for (const ing in glaze.ingredients) {
            if (volatileIngredients.some(vi => ing.includes(vi))) {
                return true;
            }
        }
        return false;
    },
    
    isMatteGlaze(glaze) {
        const matteIndicators = ['哑光', '无光', '乳浊'];
        return matteIndicators.some(mi => glaze.name.includes(mi));
    }
};

// ==================== 数据持久化 ====================

const StorageManager = {
    STORAGE_KEY: 'kiln_firing_record',
    
    save(record) {
        try {
            const data = JSON.stringify(record);
            localStorage.setItem(this.STORAGE_KEY, data);
            return true;
        } catch (error) {
            console.error('保存数据失败:', error);
            return false;
        }
    },
    
    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('加载数据失败:', error);
            return null;
        }
    },
    
    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('清除数据失败:', error);
            return false;
        }
    }
};

// ==================== 文件导入处理 ====================

const FileImporter = {
    
    async importKilnTemperature(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvData = parseCSV(e.target.result);
                    const curve = csvData.map(row => ({
                        time: row['时间'] || row['time'] || row[0],
                        temperature: row['温度'] || row['temperature'] || row[1]
                    }));
                    resolve(curve);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async importGlazeRecipes(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const recipes = data.map((recipe, index) => ({
                        id: recipe.id || `glaze_${index}`,
                        name: recipe.name || `釉料 ${index + 1}`,
                        ingredients: recipe.ingredients || {},
                        firingTemp: recipe.firingTemp || recipe.temperature || 1250,
                        atmosphere: recipe.atmosphere || '氧化',
                        holdTime: recipe.holdTime || 30,
                        notes: recipe.notes || ''
                    }));
                    resolve(recipes);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async importPlacement(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const works = new Map();
                    
                    data.forEach((item, index) => {
                        const workId = item.id || `work_${index}`;
                        const work = {
                            id: workId,
                            name: item.name || `作品 ${index + 1}`,
                            artist: item.artist || '未知',
                            position: {
                                layerId: item.layerId || `layer_${item.layer || 1}`,
                                layerIndex: item.layerIndex || item.layer || 1,
                                positionCode: item.positionCode || item.position || 'A1',
                                zone: item.zone || '中'
                            },
                            glazes: item.glazes || item.glazeIds || [],
                            clayType: item.clayType || '未知',
                            thickness: item.thickness || 5,
                            photos: item.photos || [],
                            risks: [],
                            notes: []
                        };
                        works.set(workId, work);
                    });
                    
                    resolve(works);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    async importPhotos(files) {
        const photoData = new Map();
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await this.fileToBase64(file);
                photoData.set(file.name, base64);
            }
        }
        
        return photoData;
    },
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

// ==================== UI 渲染与交互 ====================

const UIRenderer = {
    
    updateImportStatus(status) {
        const statusEl = document.getElementById('importStatus');
        statusEl.textContent = status;
    },
    
    renderLayerList() {
        const layerListEl = document.getElementById('layerList');
        const record = AppState.currentRecord;
        
        if (!record || !record.works || record.works.size === 0) {
            layerListEl.innerHTML = '<p class="empty-message">请先导入窑位摆放数据</p>';
            return;
        }
        
        const layers = this.groupWorksByLayer(record.works);
        
        let html = '';
        layers.forEach((works, layerId) => {
            const layerIndex = works[0].position.layerIndex;
            const riskSummary = this.summarizeRisks(works);
            
            html += `
                <div class="layer-item" data-layer-id="${layerId}" data-layer-index="${layerIndex}">
                    <h3>第 ${layerIndex} 层</h3>
                    <p>${works.length} 件作品</p>
                    <div>
                        ${riskSummary.high > 0 ? `<span class="risk-badge risk-high">高风险 ${riskSummary.high}</span>` : ''}
                        ${riskSummary.medium > 0 ? `<span class="risk-badge risk-medium">中风险 ${riskSummary.medium}</span>` : ''}
                        ${riskSummary.low > 0 ? `<span class="risk-badge risk-low">低风险 ${riskSummary.low}</span>` : ''}
                        ${riskSummary.high === 0 && riskSummary.medium === 0 && riskSummary.low === 0 ? 
                            '<span class="risk-badge risk-low">无风险</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        layerListEl.innerHTML = html;
        
        layerListEl.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', () => this.selectLayer(item.dataset.layerId));
        });
    },
    
    renderWorkList() {
        const workListEl = document.getElementById('workList');
        const record = AppState.currentRecord;
        
        if (!record || !record.works || record.works.size === 0) {
            workListEl.innerHTML = '<p class="empty-message">请先导入窑位摆放数据</p>';
            return;
        }
        
        let html = '';
        record.works.forEach(work => {
            const riskSummary = this.summarizeWorkRisks(work);
            
            html += `
                <div class="work-item" data-work-id="${work.id}">
                    <h3>${work.name}</h3>
                    <p>作者: ${work.artist} | 位置: ${work.position.positionCode}</p>
                    <div>
                        ${riskSummary.high > 0 ? `<span class="risk-badge risk-high">高风险 ${riskSummary.high}</span>` : ''}
                        ${riskSummary.medium > 0 ? `<span class="risk-badge risk-medium">中风险 ${riskSummary.medium}</span>` : ''}
                        ${riskSummary.low > 0 ? `<span class="risk-badge risk-low">低风险 ${riskSummary.low}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
        workListEl.innerHTML = html;
        
        workListEl.querySelectorAll('.work-item').forEach(item => {
            item.addEventListener('click', () => this.selectWork(item.dataset.workId));
        });
    },
    
    selectLayer(layerId) {
        AppState.selectedLayer = layerId;
        AppState.selectedWork = null;
        
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.toggle('active', item.dataset.layerId === layerId);
        });
        
        this.renderLayerDetail(layerId);
    },
    
    selectWork(workId) {
        AppState.selectedWork = workId;
        
        document.querySelectorAll('.work-item').forEach(item => {
            item.classList.toggle('active', item.dataset.workId === workId);
        });
        
        this.renderWorkDetail(workId);
    },
    
    renderLayerDetail(layerId) {
        const layerDetailEl = document.getElementById('layerDetail');
        const record = AppState.currentRecord;
        
        if (!record || !record.works) {
            layerDetailEl.innerHTML = '<p class="empty-message">选择一个窑层查看详情</p>';
            return;
        }
        
        const layers = this.groupWorksByLayer(record.works);
        const works = layers.get(layerId) || [];
        
        if (works.length === 0) {
            layerDetailEl.innerHTML = '<p class="empty-message">该层暂无作品</p>';
            return;
        }
        
        const layerIndex = works[0].position.layerIndex;
        const riskSummary = this.summarizeRisks(works);
        
        let worksHtml = '';
        works.forEach(work => {
            const workRiskSummary = this.summarizeWorkRisks(work);
            
            worksHtml += `
                <div class="work-item" data-work-id="${work.id}" style="cursor: pointer; margin-bottom: 15px; padding: 15px; background: var(--bg-color); border-radius: 6px;">
                    <h4 style="margin-bottom: 8px;">${work.name}</h4>
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 8px;">
                        作者: ${work.artist} | 位置: ${work.position.positionCode} | 泥料: ${work.clayType}
                    </p>
                    <div>
                        ${workRiskSummary.high > 0 ? `<span class="risk-badge risk-high">高风险 ${workRiskSummary.high}</span>` : ''}
                        ${workRiskSummary.medium > 0 ? `<span class="risk-badge risk-medium">中风险 ${workRiskSummary.medium}</span>` : ''}
                        ${workRiskSummary.low > 0 ? `<span class="risk-badge risk-low">低风险 ${workRiskSummary.low}</span>` : ''}
                    </div>
                </div>
            `;
        });
        
        layerDetailEl.innerHTML = `
            <div class="detail-header">
                <h2>第 ${layerIndex} 层 - 窑层详情</h2>
                <div class="detail-info">
                    <div class="info-item">
                        <label>作品数量</label>
                        <value>${works.length} 件</value>
                    </div>
                    <div class="info-item">
                        <label>风险统计</label>
                        <value>
                            高风险: ${riskSummary.high} | 中风险: ${riskSummary.medium} | 低风险: ${riskSummary.low}
                        </value>
                    </div>
                </div>
            </div>
            
            <div class="risks-section">
                <h3>本层作品列表</h3>
                ${worksHtml}
            </div>
        `;
        
        layerDetailEl.querySelectorAll('.work-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('workViewBtn').click();
                this.selectWork(item.dataset.workId);
            });
        });
    },
    
    renderWorkDetail(workId) {
        const workDetailEl = document.getElementById('workDetail');
        const record = AppState.currentRecord;
        
        if (!record || !record.works) {
            workDetailEl.innerHTML = '<p class="empty-message">选择一个作品查看详情</p>';
            return;
        }
        
        const work = record.works.get(workId);
        if (!work) {
            workDetailEl.innerHTML = '<p class="empty-message">作品不存在</p>';
            return;
        }
        
        const glazesInfo = work.glazes.map(glazeId => {
            const glaze = record.glazeRecipes?.find(g => g.id === glazeId);
            return glaze ? glaze.name : glazeId;
        }).join(', ');
        
        let photosHtml = '';
        if (work.photos && work.photos.length > 0) {
            work.photos.forEach(photoName => {
                const photoData = record.photoData?.get(photoName);
                if (photoData) {
                    photosHtml += `
                        <img class="photo-item" src="${photoData}" alt="${photoName}" 
                             onclick="UIRenderer.showPhotoModal('${photoName}')">
                    `;
                }
            });
        } else {
            photosHtml = '<p style="color: var(--text-muted);">暂无照片</p>';
        }
        
        let risksHtml = '';
        if (work.risks && work.risks.length > 0) {
            work.risks.forEach(risk => {
                const displayLevel = risk.overrule?.isOverruled ? risk.overrule.newLevel : risk.level;
                const isOverruled = risk.overrule?.isOverruled;
                
                risksHtml += `
                    <div class="risk-item ${displayLevel} ${isOverruled ? 'overridden' : ''}">
                        <div class="risk-header">
                            <h4>${risk.typeName} ${isOverruled ? '<span class="overrule-badge">已改判</span>' : ''}</h4>
                            <div class="risk-actions">
                                <span class="risk-badge risk-${displayLevel}">${this.getLevelName(displayLevel)}</span>
                                <button class="btn btn-warning" onclick="UIRenderer.toggleOverruleForm('${workId}', '${risk.id}')">
                                    改判
                                </button>
                            </div>
                        </div>
                        <p class="risk-description">${risk.description}</p>
                        <div class="risk-meta">
                            ${risk.factors.map(f => `<span><strong>${f.name}:</strong> ${f.value} ${f.threshold ? `(阈值: ${f.threshold})` : ''}</span>`).join('')}
                        </div>
                        
                        ${isOverruled ? `
                            <div class="overrule-note">
                                <strong>改判说明：</strong><br>
                                原判定：${this.getLevelName(risk.level)} → 改判为：${this.getLevelName(risk.overrule.newLevel)}<br>
                                原因：${risk.overrule.reason}<br>
                                改判人：${risk.overrule.operator} | 时间：${formatDate(risk.overrule.timestamp)}
                            </div>
                        ` : ''}
                        
                        <div class="overrule-section" id="overrule-form-${risk.id}" style="display: none;">
                            <h5>风险改判</h5>
                            <form class="overrule-form" onsubmit="UIRenderer.submitOverrule(event, '${workId}', '${risk.id}')">
                                <label>改判为：</label>
                                <select id="overrule-level-${risk.id}">
                                    <option value="high" ${displayLevel === 'high' ? 'selected' : ''}>高风险</option>
                                    <option value="medium" ${displayLevel === 'medium' ? 'selected' : ''}>中风险</option>
                                    <option value="low" ${displayLevel === 'low' ? 'selected' : ''}>低风险</option>
                                </select>
                                <label>改判原因：</label>
                                <textarea id="overrule-reason-${risk.id}" placeholder="请输入改判原因..." required></textarea>
                                <label>改判人：</label>
                                <input type="text" id="overrule-operator-${risk.id}" placeholder="请输入您的姓名" required 
                                       style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.9375rem;">
                                <div class="overrule-buttons">
                                    <button type="submit" class="btn btn-primary">确认改判</button>
                                    <button type="button" class="btn btn-secondary" 
                                            onclick="document.getElementById('overrule-form-${risk.id}').style.display = 'none'">
                                        取消
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
            });
        } else {
            risksHtml = '<p style="color: var(--text-muted);">暂无风险分析</p>';
        }
        
        let notesHtml = '';
        if (work.notes && work.notes.length > 0) {
            work.notes.forEach(note => {
                notesHtml += `
                    <div class="note-item">
                        <div class="note-header">
                            <span class="note-author">${note.author}</span>
                            <span class="note-time">${formatDate(note.timestamp)}</span>
                        </div>
                        <p class="note-content">${note.content}</p>
                    </div>
                `;
            });
        } else {
            notesHtml = '<p style="color: var(--text-muted);">暂无备注</p>';
        }
        
        workDetailEl.innerHTML = `
            <div class="detail-header">
                <h2>${work.name} - 作品详情</h2>
                <div class="detail-info">
                    <div class="info-item">
                        <label>作者</label>
                        <value>${work.artist}</value>
                    </div>
                    <div class="info-item">
                        <label>窑位</label>
                        <value>第 ${work.position.layerIndex} 层 ${work.position.positionCode} (${work.position.zone}区)</value>
                    </div>
                    <div class="info-item">
                        <label>泥料</label>
                        <value>${work.clayType}</value>
                    </div>
                    <div class="info-item">
                        <label>壁厚</label>
                        <value>${work.thickness} mm</value>
                    </div>
                    <div class="info-item">
                        <label>釉料</label>
                        <value>${glazesInfo || '无'}</value>
                    </div>
                </div>
            </div>
            
            <div class="photo-gallery">
                <h3 style="width: 100%; margin-bottom: 10px;">作品照片</h3>
                ${photosHtml}
            </div>
            
            <div class="risks-section">
                <h3>风险分析</h3>
                ${risksHtml}
            </div>
            
            <div class="notes-section">
                <h3>备注</h3>
                ${notesHtml}
                
                <form class="add-note-form" onsubmit="UIRenderer.addNote(event, '${workId}')">
                    <textarea id="note-content-${workId}" placeholder="添加备注..." required></textarea>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <input type="text" id="note-author-${workId}" placeholder="您的姓名" required
                               style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.9375rem; width: 200px;">
                        <button type="submit" class="btn btn-primary">添加备注</button>
                    </div>
                </form>
            </div>
        `;
    },
    
    showPhotoModal(photoName) {
        const record = AppState.currentRecord;
        const photoData = record.photoData?.get(photoName);
        
        if (!photoData) return;
        
        let modal = document.getElementById('photo-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'photo-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="UIRenderer.closePhotoModal()">&times;</button>
                    <img id="modal-image" src="" alt="大图">
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    UIRenderer.closePhotoModal();
                }
            });
        }
        
        const modalImage = document.getElementById('modal-image');
        modalImage.src = photoData;
        modal.classList.add('active');
    },
    
    closePhotoModal() {
        const modal = document.getElementById('photo-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },
    
    toggleOverruleForm(workId, riskId) {
        const formEl = document.getElementById(`overrule-form-${riskId}`);
        if (formEl) {
            formEl.style.display = formEl.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    submitOverrule(event, workId, riskId) {
        event.preventDefault();
        
        const level = document.getElementById(`overrule-level-${riskId}`).value;
        const reason = document.getElementById(`overrule-reason-${riskId}`).value;
        const operator = document.getElementById(`overrule-operator-${riskId}`).value;
        
        if (!level || !reason || !operator) {
            alert('请填写完整的改判信息');
            return;
        }
        
        const work = AppState.currentRecord.works.get(workId);
        if (work) {
            const risk = work.risks.find(r => r.id === riskId);
            if (risk) {
                risk.overrule = {
                    isOverruled: true,
                    newLevel: level,
                    reason: reason,
                    operator: operator,
                    timestamp: new Date().toISOString()
                };
                
                AppState.currentRecord.updatedAt = new Date().toISOString();
                StorageManager.save(AppState.currentRecord);
                
                this.renderWorkDetail(workId);
                this.renderWorkList();
                this.renderLayerList();
            }
        }
    },
    
    addNote(event, workId) {
        event.preventDefault();
        
        const content = document.getElementById(`note-content-${workId}`).value;
        const author = document.getElementById(`note-author-${workId}`).value;
        
        if (!content || !author) {
            alert('请填写完整的备注信息');
            return;
        }
        
        const work = AppState.currentRecord.works.get(workId);
        if (work) {
            if (!work.notes) {
                work.notes = [];
            }
            
            work.notes.push({
                id: generateId(),
                content: content,
                author: author,
                timestamp: new Date().toISOString()
            });
            
            AppState.currentRecord.updatedAt = new Date().toISOString();
            StorageManager.save(AppState.currentRecord);
            
            this.renderWorkDetail(workId);
        }
    },
    
    groupWorksByLayer(works) {
        const layers = new Map();
        works.forEach(work => {
            const layerId = work.position.layerId;
            if (!layers.has(layerId)) {
                layers.set(layerId, []);
            }
            layers.get(layerId).push(work);
        });
        
        const sortedLayers = new Map(
            [...layers.entries()].sort((a, b) => {
                const layerA = a[1][0].position.layerIndex;
                const layerB = b[1][0].position.layerIndex;
                return layerA - layerB;
            })
        );
        
        return sortedLayers;
    },
    
    summarizeRisks(works) {
        let high = 0, medium = 0, low = 0;
        
        works.forEach(work => {
            const summary = this.summarizeWorkRisks(work);
            high += summary.high;
            medium += summary.medium;
            low += summary.low;
        });
        
        return { high, medium, low };
    },
    
    summarizeWorkRisks(work) {
        let high = 0, medium = 0, low = 0;
        
        if (work.risks) {
            work.risks.forEach(risk => {
                const level = risk.overrule?.isOverruled ? risk.overrule.newLevel : risk.level;
                if (level === 'high') high++;
                else if (level === 'medium') medium++;
                else low++;
            });
        }
        
        return { high, medium, low };
    },
    
    getLevelName(level) {
        const names = {
            high: '高风险',
            medium: '中风险',
            low: '低风险'
        };
        return names[level] || level;
    }
};

// ==================== 导出功能 ====================

const Exporter = {
    
    exportMarkdown() {
        const record = AppState.currentRecord;
        if (!record) {
            alert('暂无数据可导出');
            return;
        }
        
        let md = `# 窑烧复盘单\n\n`;
        md += `## 基本信息\n\n`;
        md += `- **窑烧名称**: ${record.name || '未命名'}\n`;
        md += `- **日期**: ${record.date || formatDate(record.createdAt)}\n`;
        md += `- **窑炉编号**: ${record.kilnId || '未知'}\n`;
        md += `- **创建时间**: ${formatDate(record.createdAt)}\n`;
        md += `- **更新时间**: ${formatDate(record.updatedAt)}\n\n`;
        
        md += `## 窑温曲线摘要\n\n`;
        if (record.temperatureCurve && record.temperatureCurve.length > 0) {
            const maxTemp = RiskAnalyzer.getMaxTemperature(record.temperatureCurve);
            const totalTime = record.temperatureCurve[record.temperatureCurve.length - 1].time;
            md += `- **最高温度**: ${maxTemp}℃\n`;
            md += `- **总时长**: ${totalTime} 分钟\n\n`;
        }
        
        md += `## 风险统计\n\n`;
        const layers = UIRenderer.groupWorksByLayer(record.works);
        let totalHigh = 0, totalMedium = 0, totalLow = 0;
        
        layers.forEach((works, layerId) => {
            const summary = UIRenderer.summarizeRisks(works);
            totalHigh += summary.high;
            totalMedium += summary.medium;
            totalLow += summary.low;
        });
        
        md += `| 风险等级 | 数量 |\n`;
        md += `|---------|------|\n`;
        md += `| 高风险 | ${totalHigh} |\n`;
        md += `| 中风险 | ${totalMedium} |\n`;
        md += `| 低风险 | ${totalLow} |\n\n`;
        
        md += `## 窑层详情\n\n`;
        layers.forEach((works, layerId) => {
            const layerIndex = works[0].position.layerIndex;
            const summary = UIRenderer.summarizeRisks(works);
            
            md += `### 第 ${layerIndex} 层\n\n`;
            md += `- **作品数量**: ${works.length} 件\n`;
            md += `- **风险统计**: 高风险 ${summary.high} | 中风险 ${summary.medium} | 低风险 ${summary.low}\n\n`;
            
            md += `#### 作品列表\n\n`;
            works.forEach(work => {
                const workSummary = UIRenderer.summarizeWorkRisks(work);
                md += `##### ${work.name}\n\n`;
                md += `- **作者**: ${work.artist}\n`;
                md += `- **位置**: ${work.position.positionCode} (${work.position.zone}区)\n`;
                md += `- **泥料**: ${work.clayType}\n`;
                md += `- **风险**: 高风险 ${workSummary.high} | 中风险 ${workSummary.medium} | 低风险 ${workSummary.low}\n\n`;
                
                if (work.risks && work.risks.length > 0) {
                    md += `###### 风险详情\n\n`;
                    work.risks.forEach(risk => {
                        const displayLevel = risk.overrule?.isOverruled ? risk.overrule.newLevel : risk.level;
                        const levelName = UIRenderer.getLevelName(displayLevel);
                        
                        md += `- **${risk.typeName}** (${levelName}): ${risk.description}\n`;
                        
                        if (risk.overrule?.isOverruled) {
                            md += `  - *改判*: 原判定 ${UIRenderer.getLevelName(risk.level)} → ${levelName}\n`;
                            md += `  - *改判原因*: ${risk.overrule.reason}\n`;
                            md += `  - *改判人*: ${risk.overrule.operator}\n`;
                        }
                    });
                    md += `\n`;
                }
                
                if (work.notes && work.notes.length > 0) {
                    md += `###### 备注\n\n`;
                    work.notes.forEach(note => {
                        md += `- **${note.author}** (${formatDate(note.timestamp)}): ${note.content}\n`;
                    });
                    md += `\n`;
                }
            });
        });
        
        this.downloadFile(md, `窑烧复盘单_${record.name || '未命名'}_${new Date().toISOString().split('T')[0]}.md`);
    },
    
    exportJson() {
        const record = AppState.currentRecord;
        if (!record) {
            alert('暂无数据可导出');
            return;
        }
        
        const exportData = {
            ...record,
            works: Array.from(record.works.entries()),
            photoData: record.photoData ? Array.from(record.photoData.entries()) : []
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        this.downloadFile(jsonString, `窑烧审计包_${record.name || '未命名'}_${new Date().toISOString().split('T')[0]}.json`);
    },
    
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// ==================== 应用初始化 ====================

function initApp() {
    const savedRecord = StorageManager.load();
    if (savedRecord) {
        savedRecord.works = new Map(savedRecord.works);
        savedRecord.photoData = savedRecord.photoData ? new Map(savedRecord.photoData) : new Map();
        AppState.currentRecord = savedRecord;
        UIRenderer.updateImportStatus('已加载保存的数据');
        updateUI();
    }
    
    setupEventListeners();
    AppState.isInitialized = true;
}

function setupEventListeners() {
    document.getElementById('layerViewBtn').addEventListener('click', () => {
        document.getElementById('layerViewBtn').classList.add('active');
        document.getElementById('workViewBtn').classList.remove('active');
        document.getElementById('layerView').classList.add('active');
        document.getElementById('workView').classList.remove('active');
    });
    
    document.getElementById('workViewBtn').addEventListener('click', () => {
        document.getElementById('workViewBtn').classList.add('active');
        document.getElementById('layerViewBtn').classList.remove('active');
        document.getElementById('workView').classList.add('active');
        document.getElementById('layerView').classList.remove('active');
    });
    
    document.getElementById('kilnTempCsv').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const curve = await FileImporter.importKilnTemperature(file);
                ensureCurrentRecord();
                AppState.currentRecord.temperatureCurve = curve;
                UIRenderer.updateImportStatus(`已导入窑温曲线: ${curve.length} 个数据点`);
                reanalyzeAllRisks();
                saveAndUpdateUI();
            } catch (error) {
                UIRenderer.updateImportStatus(`导入窑温曲线失败: ${error.message}`);
            }
        }
    });
    
    document.getElementById('glazeJson').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const recipes = await FileImporter.importGlazeRecipes(file);
                ensureCurrentRecord();
                AppState.currentRecord.glazeRecipes = recipes;
                UIRenderer.updateImportStatus(`已导入釉料配方: ${recipes.length} 种`);
                reanalyzeAllRisks();
                saveAndUpdateUI();
            } catch (error) {
                UIRenderer.updateImportStatus(`导入釉料配方失败: ${error.message}`);
            }
        }
    });
    
    document.getElementById('placementJson').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const works = await FileImporter.importPlacement(file);
                ensureCurrentRecord();
                
                if (AppState.currentRecord.works) {
                    works.forEach((newWork, id) => {
                        const existingWork = AppState.currentRecord.works.get(id);
                        if (existingWork) {
                            newWork.risks = existingWork.risks;
                            newWork.notes = existingWork.notes;
                            newWork.photos = existingWork.photos;
                        }
                    });
                }
                
                AppState.currentRecord.works = works;
                UIRenderer.updateImportStatus(`已导入窑位摆放: ${works.size} 件作品`);
                reanalyzeAllRisks();
                saveAndUpdateUI();
            } catch (error) {
                UIRenderer.updateImportStatus(`导入窑位摆放失败: ${error.message}`);
            }
        }
    });
    
    document.getElementById('photosDir').addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            try {
                const photoData = await FileImporter.importPhotos(files);
                ensureCurrentRecord();
                
                if (!AppState.currentRecord.photoData) {
                    AppState.currentRecord.photoData = new Map();
                }
                
                photoData.forEach((data, name) => {
                    AppState.currentRecord.photoData.set(name, data);
                });
                
                AppState.currentRecord.works.forEach(work => {
                    const workPhotos = [];
                    photoData.forEach((_, name) => {
                        if (name.includes(work.name) || name.includes(work.id)) {
                            workPhotos.push(name);
                        }
                    });
                    if (workPhotos.length > 0) {
                        work.photos = [...new Set([...work.photos, ...workPhotos])];
                    }
                });
                
                UIRenderer.updateImportStatus(`已导入照片: ${photoData.size} 张`);
                saveAndUpdateUI();
            } catch (error) {
                UIRenderer.updateImportStatus(`导入照片失败: ${error.message}`);
            }
        }
    });
    
    document.getElementById('exportMarkdownBtn').addEventListener('click', () => {
        Exporter.exportMarkdown();
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
        Exporter.exportJson();
    });
    
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
            StorageManager.clear();
            AppState.currentRecord = null;
            AppState.selectedLayer = null;
            AppState.selectedWork = null;
            UIRenderer.updateImportStatus('数据已清空');
            updateUI();
        }
    });
}

function ensureCurrentRecord() {
    if (!AppState.currentRecord) {
        AppState.currentRecord = {
            id: generateId(),
            name: '未命名窑烧',
            date: new Date().toISOString().split('T')[0],
            kilnId: '未知',
            temperatureCurve: [],
            glazeRecipes: [],
            works: new Map(),
            photoData: new Map(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
}

function reanalyzeAllRisks() {
    const record = AppState.currentRecord;
    if (!record || !record.works || !record.temperatureCurve || !record.glazeRecipes) {
        return;
    }
    
    record.works.forEach(work => {
        const oldRisks = work.risks || [];
        const newRisks = RiskAnalyzer.analyzeWork(
            work, 
            record.temperatureCurve, 
            record.glazeRecipes
        );
        
        newRisks.forEach(newRisk => {
            const oldRisk = oldRisks.find(r => r.type === newRisk.type);
            if (oldRisk && oldRisk.overrule?.isOverruled) {
                newRisk.overrule = oldRisk.overrule;
            }
        });
        
        work.risks = newRisks;
    });
}

function saveAndUpdateUI() {
    if (AppState.currentRecord) {
        AppState.currentRecord.updatedAt = new Date().toISOString();
        StorageManager.save(AppState.currentRecord);
    }
    updateUI();
}

function updateUI() {
    UIRenderer.renderLayerList();
    UIRenderer.renderWorkList();
    
    if (AppState.selectedLayer) {
        UIRenderer.selectLayer(AppState.selectedLayer);
    }
    
    if (AppState.selectedWork) {
        UIRenderer.selectWork(AppState.selectedWork);
    }
}

document.addEventListener('DOMContentLoaded', initApp);
