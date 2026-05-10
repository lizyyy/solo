const WoodDryingApp = (function() {
    const STORAGE_KEY = 'wood_drying_calibration_data';
    const CURRENT_BATCH_KEY = 'current_calibration_batch';

    const StatusEnum = {
        PENDING: 'PENDING',
        CURVE_VERIFICATION: 'CURVE_VERIFICATION',
        MODEL_VERIFICATION: 'MODEL_VERIFICATION',
        BATCH_COMPARISON: 'BATCH_COMPARISON',
        PASSED: 'PASSED',
        NEEDS_REVIEW: 'NEEDS_REVIEW',
        FAILED: 'FAILED',
        RE_CALIBRATION: 'RE_CALIBRATION'
    };

    const StatusLabels = {
        PENDING: '待校准',
        CURVE_VERIFICATION: '曲线验证中',
        MODEL_VERIFICATION: '模型验证中',
        BATCH_COMPARISON: '批次对比中',
        PASSED: '正常通过',
        NEEDS_REVIEW: '需人工处理',
        FAILED: '校准失败',
        RE_CALIBRATION: '重新校准'
    };

    const WoodTypeLabels = {
        pine: '松木',
        oak: '橡木',
        maple: '枫木',
        birch: '桦木',
        cedar: '杉木'
    };

    function generateId() {
        return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    function generateMockData() {
        const mockData = [];
        
        const now = new Date();
        
        const curveTemplate = [
            { time: 0, temperature: 20, humidity: 60, targetMC: 55.0 },
            { time: 2, temperature: 35, humidity: 75, targetMC: 53.5 },
            { time: 4, temperature: 45, humidity: 78, targetMC: 51.8 },
            { time: 6, temperature: 50, humidity: 80, targetMC: 49.5 },
            { time: 8, temperature: 55, humidity: 75, targetMC: 46.0 },
            { time: 10, temperature: 58, humidity: 70, targetMC: 42.0 },
            { time: 12, temperature: 60, humidity: 65, targetMC: 38.0 },
            { time: 14, temperature: 62, humidity: 60, targetMC: 34.0 },
            { time: 16, temperature: 64, humidity: 55, targetMC: 30.0 },
            { time: 18, temperature: 65, humidity: 50, targetMC: 26.0 },
            { time: 20, temperature: 65, humidity: 45, targetMC: 22.0 },
            { time: 22, temperature: 65, humidity: 40, targetMC: 18.0 },
            { time: 24, temperature: 65, humidity: 35, targetMC: 14.0 },
            { time: 26, temperature: 60, humidity: 30, targetMC: 12.0 }
        ];

        const batch1 = {
            id: generateId(),
            batchNo: 'BATCH-2024-001',
            woodType: 'pine',
            initialMC: 55.0,
            targetMC: 12.0,
            woodThickness: 50,
            batchSize: 25.5,
            remarks: '第一批次，松木，标准烘干曲线',
            status: StatusEnum.PASSED,
            createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
            curveData: JSON.parse(JSON.stringify(curveTemplate)),
            actualData: curveTemplate.map(p => ({
                time: p.time,
                temperature: p.temperature + (Math.random() - 0.5) * 1.5,
                humidity: p.humidity + (Math.random() - 0.5) * 2,
                moistureContent: p.targetMC + (Math.random() - 0.5) * 1.0
            })),
            curveVerification: {
                passed: true,
                dataPoints: 14,
                timeIntervalConsistent: true,
                tempRangeValid: true,
                humidityRangeValid: true,
                messages: [
                    { type: 'success', text: '曲线数据点数充足（14个点）' },
                    { type: 'success', text: '时间间隔一致（每2小时记录一次）' },
                    { type: 'success', text: '温度范围合理（20℃ ~ 65℃）' },
                    { type: 'success', text: '湿度范围合理（30% ~ 80%）' }
                ]
            },
            modelVerification: {
                passed: true,
                avgDeviation: 0.42,
                maxDeviation: 1.15,
                correlationCoefficient: 0.992,
                trendConsistent: true,
                messages: [
                    { type: 'success', text: '平均偏差 0.42%（阈值 ≤ 1.5%）' },
                    { type: 'success', text: '最大偏差 1.15%（阈值 ≤ 3.0%）' },
                    { type: 'success', text: '相关系数 0.992（阈值 ≥ 0.95）' },
                    { type: 'success', text: '含水率变化趋势一致' }
                ]
            },
            batchComparison: {
                passed: true,
                tempDeviationAvg: 0.35,
                humidityDeviationAvg: 0.85,
                mcDeviationAvg: 0.42,
                finalMC: 11.85,
                messages: [
                    { type: 'success', text: '温度偏差均值 0.35℃（阈值 ≤ ±2℃）' },
                    { type: 'success', text: '湿度偏差均值 0.85%RH（阈值 ≤ ±3%）' },
                    { type: 'success', text: '最终含水率 11.85%，达到目标值' },
                    { type: 'info', text: '建议：可直接用于生产' }
                ]
            },
            finalResult: 'PASSED',
            timeline: [
                { time: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.PENDING, note: '批次创建' },
                { time: new Date(now - 7 * 24 * 60 * 60 * 1000 + 60000).toISOString(), status: StatusEnum.CURVE_VERIFICATION, note: '开始曲线导入验证' },
                { time: new Date(now - 7 * 24 * 60 * 60 * 1000 + 180000).toISOString(), status: StatusEnum.MODEL_VERIFICATION, note: '曲线验证通过，开始模型验证' },
                { time: new Date(now - 7 * 24 * 60 * 60 * 1000 + 300000).toISOString(), status: StatusEnum.BATCH_COMPARISON, note: '模型验证通过，开始批次对比' },
                { time: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.PASSED, note: '所有验证通过，批次正常通过' }
            ]
        };

        const batch2 = {
            id: generateId(),
            batchNo: 'BATCH-2024-002',
            woodType: 'oak',
            initialMC: 48.0,
            targetMC: 10.0,
            woodThickness: 60,
            batchSize: 30.0,
            remarks: '橡木批次，厚度较大',
            status: StatusEnum.NEEDS_REVIEW,
            createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
            curveData: JSON.parse(JSON.stringify(curveTemplate.map(p => ({ ...p, targetMC: p.targetMC - 3 })))),
            actualData: curveTemplate.map((p, i) => ({
                time: p.time,
                temperature: p.temperature + (i > 5 ? 2.5 : (Math.random() - 0.5) * 1),
                humidity: p.humidity + (i > 8 ? -4 : (Math.random() - 0.5) * 2),
                moistureContent: p.targetMC - 3 + (Math.random() - 0.3) * 2.5
            })),
            curveVerification: {
                passed: true,
                dataPoints: 14,
                timeIntervalConsistent: true,
                tempRangeValid: true,
                humidityRangeValid: true,
                messages: [
                    { type: 'success', text: '曲线数据点数充足（14个点）' },
                    { type: 'success', text: '时间间隔一致（每2小时记录一次）' },
                    { type: 'success', text: '温度范围合理（20℃ ~ 65℃）' },
                    { type: 'success', text: '湿度范围合理（30% ~ 80%）' }
                ]
            },
            modelVerification: {
                passed: false,
                avgDeviation: 2.18,
                maxDeviation: 4.25,
                correlationCoefficient: 0.92,
                trendConsistent: true,
                messages: [
                    { type: 'warning', text: '平均偏差 2.18%（超过阈值 1.5%）' },
                    { type: 'warning', text: '最大偏差 4.25%（超过阈值 3.0%）' },
                    { type: 'warning', text: '相关系数 0.92（低于阈值 0.95）' },
                    { type: 'info', text: '含水率变化趋势基本一致' }
                ]
            },
            batchComparison: {
                passed: false,
                tempDeviationAvg: 2.85,
                humidityDeviationAvg: 4.2,
                mcDeviationAvg: 2.18,
                finalMC: 8.92,
                messages: [
                    { type: 'warning', text: '温度偏差均值 2.85℃（超过阈值 ±2℃）' },
                    { type: 'warning', text: '湿度偏差均值 4.2%RH（超过阈值 ±3%）' },
                    { type: 'info', text: '最终含水率 8.92%，略低于目标值 10%' },
                    { type: 'warning', text: '建议：第10-18小时温度偏高，后期湿度偏低，需人工复核' }
                ]
            },
            finalResult: 'NEEDS_REVIEW',
            timeline: [
                { time: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.PENDING, note: '批次创建' },
                { time: new Date(now - 4 * 24 * 60 * 60 * 1000 + 60000).toISOString(), status: StatusEnum.CURVE_VERIFICATION, note: '开始曲线导入验证' },
                { time: new Date(now - 4 * 24 * 60 * 60 * 1000 + 180000).toISOString(), status: StatusEnum.MODEL_VERIFICATION, note: '曲线验证通过，开始模型验证' },
                { time: new Date(now - 4 * 24 * 60 * 60 * 1000 + 300000).toISOString(), status: StatusEnum.BATCH_COMPARISON, note: '模型验证存在偏差，开始批次对比' },
                { time: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.NEEDS_REVIEW, note: '存在中等程度偏差，需人工处理' }
            ]
        };

        const batch3 = {
            id: generateId(),
            batchNo: 'BATCH-2024-003',
            woodType: 'maple',
            initialMC: 52.0,
            targetMC: 11.0,
            woodThickness: 45,
            batchSize: 20.0,
            remarks: '枫木批次，校准失败待重跑',
            status: StatusEnum.FAILED,
            createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
            curveData: curveTemplate.slice(0, 6).map((p, i) => ({
                time: i * 3,
                temperature: p.temperature + 15,
                humidity: p.humidity - 20,
                targetMC: p.targetMC
            })),
            actualData: curveTemplate.slice(0, 6).map((p, i) => ({
                time: i * 3,
                temperature: p.temperature + 12 + (Math.random() - 0.5) * 5,
                humidity: p.humidity - 18 + (Math.random() - 0.5) * 8,
                moistureContent: p.targetMC + (Math.random() - 0.2) * 6
            })),
            curveVerification: {
                passed: false,
                dataPoints: 6,
                timeIntervalConsistent: false,
                tempRangeValid: false,
                humidityRangeValid: false,
                messages: [
                    { type: 'error', text: '数据点数不足（仅6个点，建议≥10个）' },
                    { type: 'error', text: '时间间隔不一致（部分间隔3小时）' },
                    { type: 'error', text: '温度偏高（最高80℃，建议≤70℃）' },
                    { type: 'error', text: '湿度偏低（最低40%，建议前期≥60%）' }
                ]
            },
            modelVerification: {
                passed: false,
                avgDeviation: 4.52,
                maxDeviation: 7.85,
                correlationCoefficient: 0.72,
                trendConsistent: false,
                messages: [
                    { type: 'error', text: '平均偏差 4.52%（远超过阈值 3.0%）' },
                    { type: 'error', text: '最大偏差 7.85%（远超过阈值 5.0%）' },
                    { type: 'error', text: '相关系数 0.72（低于阈值 0.80）' },
                    { type: 'error', text: '含水率变化趋势异常' }
                ]
            },
            batchComparison: {
                passed: false,
                tempDeviationAvg: 5.2,
                humidityDeviationAvg: 8.5,
                mcDeviationAvg: 4.52,
                finalMC: 45.5,
                messages: [
                    { type: 'error', text: '温度偏差均值 5.2℃（远超过阈值 4℃）' },
                    { type: 'error', text: '湿度偏差均值 8.5%RH（远超过阈值 6%）' },
                    { type: 'error', text: '最终含水率 45.5%，远未达到目标值 11%' },
                    { type: 'error', text: '严重警告：曲线数据质量差，存在木材开裂风险' }
                ]
            },
            finalResult: 'FAILED',
            timeline: [
                { time: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.PENDING, note: '批次创建' },
                { time: new Date(now - 2 * 24 * 60 * 60 * 1000 + 60000).toISOString(), status: StatusEnum.CURVE_VERIFICATION, note: '开始曲线导入验证' },
                { time: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), status: StatusEnum.FAILED, note: '曲线验证失败，数据存在严重问题' }
            ]
        };

        const batch4 = {
            id: generateId(),
            batchNo: 'BATCH-2024-004',
            woodType: 'birch',
            initialMC: 58.0,
            targetMC: 12.0,
            woodThickness: 55,
            batchSize: 22.5,
            remarks: '桦木批次，新建待校准',
            status: StatusEnum.PENDING,
            createdAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
            curveData: null,
            actualData: null,
            curveVerification: null,
            modelVerification: null,
            batchComparison: null,
            finalResult: null,
            timeline: [
                { time: new Date(now - 12 * 60 * 60 * 1000).toISOString(), status: StatusEnum.PENDING, note: '批次创建，待导入曲线' }
            ]
        };

        mockData.push(batch1, batch2, batch3, batch4);
        return mockData;
    }

    function getData() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
        }
        
        const mockData = generateMockData();
        saveData(mockData);
        return mockData;
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save data to localStorage:', e);
            return false;
        }
    }

    function getCurrentBatch() {
        try {
            const id = localStorage.getItem(CURRENT_BATCH_KEY);
            if (id) {
                const data = getData();
                return data.find(b => b.id === id);
            }
        } catch (e) {
            console.error('Failed to get current batch:', e);
        }
        return null;
    }

    function setCurrentBatch(batchId) {
        try {
            localStorage.setItem(CURRENT_BATCH_KEY, batchId);
            return true;
        } catch (e) {
            console.error('Failed to set current batch:', e);
            return false;
        }
    }

    function clearCurrentBatch() {
        try {
            localStorage.removeItem(CURRENT_BATCH_KEY);
            return true;
        } catch (e) {
            console.error('Failed to clear current batch:', e);
            return false;
        }
    }

    function getBatchById(id) {
        const data = getData();
        return data.find(b => b.id === id);
    }

    function getBatchByNo(batchNo) {
        const data = getData();
        return data.find(b => b.batchNo === batchNo);
    }

    function createBatch(batchData) {
        const data = getData();
        const now = new Date().toISOString();
        
        const newBatch = {
            id: generateId(),
            batchNo: batchData.batchNo,
            woodType: batchData.woodType,
            initialMC: parseFloat(batchData.initialMC),
            targetMC: parseFloat(batchData.targetMC),
            woodThickness: parseInt(batchData.woodThickness),
            batchSize: parseFloat(batchData.batchSize),
            remarks: batchData.remarks || '',
            status: StatusEnum.PENDING,
            createdAt: now,
            updatedAt: now,
            curveData: null,
            actualData: null,
            curveVerification: null,
            modelVerification: null,
            batchComparison: null,
            finalResult: null,
            timeline: [
                { time: now, status: StatusEnum.PENDING, note: '批次创建，待导入曲线' }
            ]
        };
        
        data.push(newBatch);
        saveData(data);
        setCurrentBatch(newBatch.id);
        return newBatch;
    }

    function updateBatch(id, updates) {
        const data = getData();
        const index = data.findIndex(b => b.id === id);
        
        if (index === -1) {
            return null;
        }
        
        data[index] = {
            ...data[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        saveData(data);
        return data[index];
    }

    function addTimelineEvent(batchId, status, note) {
        const batch = getBatchById(batchId);
        if (!batch) return null;
        
        batch.timeline.push({
            time: new Date().toISOString(),
            status: status,
            note: note
        });
        
        return updateBatch(batchId, {
            status: status,
            timeline: batch.timeline
        });
    }

    function deleteBatch(id) {
        const data = getData();
        const filtered = data.filter(b => b.id !== id);
        
        if (filtered.length === data.length) {
            return false;
        }
        
        saveData(filtered);
        
        const current = getCurrentBatch();
        if (current && current.id === id) {
            clearCurrentBatch();
        }
        
        return true;
    }

    function exportData() {
        const data = getData();
        const exportObj = {
            exportTime: new Date().toISOString(),
            version: '1.0',
            batches: data
        };
        
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wood_drying_calibration_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const result = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            const values = line.split(',').map(v => v.trim());
            if (values.length < 4) continue;
            
            const point = {
                time: parseFloat(values[0]),
                temperature: parseFloat(values[1]),
                humidity: parseFloat(values[2]),
                targetMC: parseFloat(values[3])
            };
            
            if (!isNaN(point.time) && !isNaN(point.temperature) && 
                !isNaN(point.humidity) && !isNaN(point.targetMC)) {
                result.push(point);
            }
        }
        
        return result;
    }

    function parseActualCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const result = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            const values = line.split(',').map(v => v.trim());
            if (values.length < 4) continue;
            
            const point = {
                time: parseFloat(values[0]),
                temperature: parseFloat(values[1]),
                humidity: parseFloat(values[2]),
                moistureContent: parseFloat(values[3])
            };
            
            if (!isNaN(point.time) && !isNaN(point.temperature) && 
                !isNaN(point.humidity) && !isNaN(point.moistureContent)) {
                result.push(point);
            }
        }
        
        return result;
    }

    return {
        StatusEnum,
        StatusLabels,
        WoodTypeLabels,
        getData,
        saveData,
        getCurrentBatch,
        setCurrentBatch,
        clearCurrentBatch,
        getBatchById,
        getBatchByNo,
        createBatch,
        updateBatch,
        addTimelineEvent,
        deleteBatch,
        exportData,
        parseCSV,
        parseActualCSV,
        formatDate,
        generateId
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WoodDryingApp;
}
