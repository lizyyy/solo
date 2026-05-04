// 装修材料核算工具 - 核心逻辑
class MaterialCalculator {
    constructor() {
        this.data = {
            rooms: [],
            materials: [],
            purchases: [],
            changes: []
        };
        
        this.filterState = {
            rooms: [],
            materialTypes: [],
            riskLevel: ''
        };
        
        this.calculatedData = null;
        this.risks = [];
        
        this.init();
    }
    
    init() {
        this.loadFromLocalStorage();
        this.bindEvents();
        this.render();
    }
    
    // ==================== 数据管理 ====================
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('materialCalculatorData');
            if (saved) {
                this.data = JSON.parse(saved);
                this.recalculate();
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
    }
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('materialCalculatorData', JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }
    
    loadSampleData() {
        this.data = {
            rooms: [
                { id: 'R001', name: '客厅', width: 4.5, length: 6.0, area: 27.0, perimeter: 21.0, height: 2.8 },
                { id: 'R002', name: '主卧', width: 3.6, length: 4.8, area: 17.28, perimeter: 16.8, height: 2.8 },
                { id: 'R003', name: '次卧', width: 3.0, length: 4.2, area: 12.6, perimeter: 14.4, height: 2.8 },
                { id: 'R004', name: '厨房', width: 2.4, length: 3.6, area: 8.64, perimeter: 12.0, height: 2.4 },
                { id: 'R005', name: '卫生间', width: 2.0, length: 2.8, area: 5.6, perimeter: 9.6, height: 2.4 }
            ],
            materials: [
                { id: 'M001', name: '800x800抛光砖', type: '瓷砖', unit: '片', specWidth: 0.8, specLength: 0.8, areaPerUnit: 0.64, lossRate: 0.08, price: 128 },
                { id: 'M002', name: '600x600仿古砖', type: '瓷砖', unit: '片', specWidth: 0.6, specLength: 0.6, areaPerUnit: 0.36, lossRate: 0.05, price: 86 },
                { id: 'M003', name: '300x600墙砖', type: '瓷砖', unit: '片', specWidth: 0.3, specLength: 0.6, areaPerUnit: 0.18, lossRate: 0.05, price: 32 },
                { id: 'M004', name: '300x300小地砖', type: '瓷砖', unit: '片', specWidth: 0.3, specLength: 0.3, areaPerUnit: 0.09, lossRate: 0.05, price: 18 },
                { id: 'M005', name: '实木复合地板', type: '地板', unit: '㎡', specWidth: 0.19, specLength: 1.218, areaPerUnit: 0.2314, lossRate: 0.05, price: 268 },
                { id: 'M006', name: '白色乳胶漆', type: '乳胶漆', unit: '桶', coverage: 12, lossRate: 0.1, price: 380, expiryDate: '2027-03-15' },
                { id: 'M007', name: '浅灰乳胶漆', type: '乳胶漆', unit: '桶', coverage: 12, lossRate: 0.1, price: 395, expiryDate: '2027-03-15' },
                { id: 'M008', name: '实木踢脚线', type: '踢脚线', unit: '米', height: 0.08, lossRate: 0.03, price: 45 },
                { id: 'M009', name: 'PVC踢脚线', type: '踢脚线', unit: '米', height: 0.08, lossRate: 0.03, price: 12 },
                { id: 'M010', name: '瓷砖胶', type: '胶水', unit: '袋', coverage: 4, lossRate: 0.1, price: 65, expiryDate: '2026-08-20' },
                { id: 'M011', name: '玻璃胶', type: '胶水', unit: '支', lossRate: 0.05, price: 18, expiryDate: '2025-11-30' },
                { id: 'M012', name: '填缝剂', type: '辅料', unit: '盒', coverage: 8, lossRate: 0.1, price: 42 }
            ],
            purchases: [
                { id: 'P001', materialId: 'M001', materialName: '800x800抛光砖', batch: 'B20260401', color: '米白', quantity: 50, unitPrice: 125, purchaseDate: '2026-04-10', supplier: '东鹏瓷砖' },
                { id: 'P002', materialId: 'M001', materialName: '800x800抛光砖', batch: 'B20260415', color: '米白', quantity: 10, unitPrice: 128, purchaseDate: '2026-04-22', supplier: '东鹏瓷砖' },
                { id: 'P003', materialId: 'M002', materialName: '600x600仿古砖', batch: 'B20260328', color: '浅灰', quantity: 40, unitPrice: 82, purchaseDate: '2026-04-05', supplier: '马可波罗' },
                { id: 'P004', materialId: 'M003', materialName: '300x600墙砖', batch: 'B20260408', color: '纯白', quantity: 120, unitPrice: 30, purchaseDate: '2026-04-12', supplier: '东鹏瓷砖' },
                { id: 'P005', materialId: 'M004', materialName: '300x300小地砖', batch: 'B20260408', color: '浅灰', quantity: 80, unitPrice: 16, purchaseDate: '2026-04-12', supplier: '东鹏瓷砖' },
                { id: 'P006', materialId: 'M005', materialName: '实木复合地板', batch: 'B20260315', color: '橡木色', quantity: 35, unitPrice: 258, purchaseDate: '2026-04-08', supplier: '圣象地板' },
                { id: 'P007', materialId: 'M006', materialName: '白色乳胶漆', batch: 'B20260210', color: '纯白', quantity: 6, unitPrice: 370, purchaseDate: '2026-04-02', supplier: '立邦漆' },
                { id: 'P008', materialId: 'M007', materialName: '浅灰乳胶漆', batch: 'B20260210', color: '浅灰', quantity: 3, unitPrice: 385, purchaseDate: '2026-04-02', supplier: '立邦漆' },
                { id: 'P009', materialId: 'M008', materialName: '实木踢脚线', batch: 'B20260320', color: '原木色', quantity: 40, unitPrice: 42, purchaseDate: '2026-04-15', supplier: '圣象地板' },
                { id: 'P010', materialId: 'M010', materialName: '瓷砖胶', batch: 'B20260115', color: '', quantity: 15, unitPrice: 62, purchaseDate: '2026-04-01', supplier: '德高' },
                { id: 'P011', materialId: 'M011', materialName: '玻璃胶', batch: 'B20251201', color: '透明', quantity: 10, unitPrice: 16, purchaseDate: '2026-03-28', supplier: '硅宝' },
                { id: 'P012', materialId: 'M012', materialName: '填缝剂', batch: 'B20260301', color: '白色', quantity: 8, unitPrice: 40, purchaseDate: '2026-04-05', supplier: '德高' }
            ],
            changes: [
                { id: 'C001', roomId: 'R001', roomName: '客厅', changeDate: '2026-04-18', changeType: '尺寸变更', reason: '背景墙调整', originalWidth: 4.5, originalLength: 6.0, originalArea: 27.0, originalPerimeter: 21.0, newWidth: 4.2, newLength: 6.2, newArea: 26.04, newPerimeter: 20.8, areaDiff: -0.96, perimeterDiff: -0.2, remark: '背景墙内嵌，占用空间' },
                { id: 'C002', roomId: 'R002', roomName: '主卧', changeDate: '2026-04-20', changeType: '尺寸变更', reason: '衣柜调整', originalWidth: 3.6, originalLength: 4.8, originalArea: 17.28, originalPerimeter: 16.8, newWidth: 3.4, newLength: 4.8, newArea: 16.32, newPerimeter: 16.4, areaDiff: -0.96, perimeterDiff: -0.4, remark: '嵌入式衣柜占0.2米宽度' },
                { id: 'C003', roomId: 'R004', roomName: '厨房', changeDate: '2026-04-25', changeType: '材料变更', reason: '设计师建议', originalWidth: 2.4, originalLength: 3.6, originalArea: 8.64, originalPerimeter: 12.0, newWidth: 2.4, newLength: 3.6, newArea: 8.64, newPerimeter: 12.0, areaDiff: 0, perimeterDiff: 0, remark: '墙砖改用400x800大砖，暂未更新材料表' }
            ]
        };
        
        this.saveToLocalStorage();
        this.recalculate();
        this.render();
        this.showToast('示例数据已加载', 'success');
    }
    
    clearData() {
        if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
            this.data = { rooms: [], materials: [], purchases: [], changes: [] };
            this.calculatedData = null;
            this.risks = [];
            localStorage.removeItem('materialCalculatorData');
            this.render();
            this.showToast('数据已清空', 'info');
        }
    }
    
    // ==================== 核心计算逻辑 ====================
    recalculate() {
        this.calculatedData = {
            roomMaterials: {},
            materialSummary: {},
            purchaseSummary: {}
        };
        
        // 计算每个房间的材料需求
        this.data.rooms.forEach(room => {
            const effectiveRoom = this.getEffectiveRoomDimensions(room);
            this.calculatedData.roomMaterials[room.id] = this.calculateRoomMaterialNeeds(effectiveRoom, room);
        });
        
        // 汇总每种材料的总需求
        this.data.materials.forEach(material => {
            let totalNeeded = 0;
            let totalLoss = 0;
            const roomBreakdown = [];
            
            this.data.rooms.forEach(room => {
                const roomMaterials = this.calculatedData.roomMaterials[room.id];
                if (roomMaterials && roomMaterials[material.id]) {
                    const rm = roomMaterials[material.id];
                    totalNeeded += rm.needed;
                    totalLoss += rm.lossAmount;
                    roomBreakdown.push({
                        roomId: room.id,
                        roomName: room.name,
                        needed: rm.needed,
                        lossAmount: rm.lossAmount
                    });
                }
            });
            
            // 计算已采购数量
            const purchases = this.data.purchases.filter(p => p.materialId === material.id);
            const purchasedQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
            
            // 计算差额
            const difference = purchasedQuantity - totalNeeded;
            
            this.calculatedData.materialSummary[material.id] = {
                material: material,
                totalNeeded,
                totalLoss,
                purchasedQuantity,
                difference,
                roomBreakdown,
                purchases
            };
        });
        
        // 检测风险
        this.detectRisks();
    }
    
    getEffectiveRoomDimensions(room) {
        const changes = this.data.changes.filter(c => c.roomId === room.id && c.changeType === '尺寸变更');
        if (changes.length === 0) {
            return { ...room };
        }
        
        // 获取最新的尺寸变更
        const latestChange = changes.sort((a, b) => new Date(b.changeDate) - new Date(a.changeDate))[0];
        
        return {
            ...room,
            width: latestChange.newWidth,
            length: latestChange.newLength,
            area: latestChange.newArea,
            perimeter: latestChange.newPerimeter
        };
    }
    
    calculateRoomMaterialNeeds(effectiveRoom, originalRoom) {
        const result = {};
        
        // 为房间分配材料（根据材料类型）
        this.data.materials.forEach(material => {
            let needed = 0;
            let applies = false;
            
            switch (material.type) {
                case '瓷砖':
                    // 客厅、厨房、卫生间用地砖
                    if (['客厅', '厨房', '卫生间'].includes(originalRoom.name)) {
                        if (material.name.includes('800x800') && originalRoom.name === '客厅') {
                            applies = true;
                            needed = Math.ceil(effectiveRoom.area / material.areaPerUnit);
                        } else if (material.name.includes('300x300') && ['厨房', '卫生间'].includes(originalRoom.name)) {
                            applies = true;
                            needed = Math.ceil(effectiveRoom.area / material.areaPerUnit);
                        } else if (material.name.includes('300x600') && ['厨房', '卫生间'].includes(originalRoom.name)) {
                            // 墙砖：周长 * 高度
                            applies = true;
                            const wallArea = effectiveRoom.perimeter * (effectiveRoom.height || 2.4);
                            needed = Math.ceil(wallArea / material.areaPerUnit);
                        }
                    }
                    break;
                    
                case '地板':
                    // 卧室用地板
                    if (['主卧', '次卧'].includes(originalRoom.name)) {
                        applies = true;
                        needed = Math.ceil(effectiveRoom.area / material.areaPerUnit);
                    }
                    break;
                    
                case '乳胶漆':
                    // 所有房间用乳胶漆
                    applies = true;
                    const wallArea = effectiveRoom.perimeter * (effectiveRoom.height || 2.8);
                    const ceilingArea = effectiveRoom.area;
                    const totalArea = wallArea + ceilingArea;
                    
                    if (material.name.includes('白色')) {
                        // 白色用于天花板和部分墙面
                        needed = Math.ceil((totalArea * 0.7) / material.coverage);
                    } else {
                        // 其他颜色用于背景墙
                        needed = Math.ceil((totalArea * 0.3) / material.coverage);
                    }
                    break;
                    
                case '踢脚线':
                    // 所有房间用踢脚线
                    applies = true;
                    needed = Math.ceil(effectiveRoom.perimeter);
                    break;
                    
                case '胶水':
                case '辅料':
                    // 根据瓷砖用量估算
                    if (['客厅', '厨房', '卫生间'].includes(originalRoom.name)) {
                        applies = true;
                        if (material.name.includes('瓷砖胶')) {
                            needed = Math.ceil(effectiveRoom.area / material.coverage);
                        } else if (material.name.includes('填缝剂')) {
                            needed = Math.ceil(effectiveRoom.area / material.coverage);
                        } else if (material.name.includes('玻璃胶')) {
                            needed = 2; // 每房间约2支
                        }
                    }
                    break;
            }
            
            if (applies && needed > 0) {
                const lossAmount = Math.ceil(needed * material.lossRate);
                result[material.id] = {
                    material: material,
                    room: originalRoom,
                    effectiveRoom: effectiveRoom,
                    needed: needed + lossAmount,
                    baseNeeded: needed,
                    lossAmount: lossAmount,
                    lossRate: material.lossRate
                };
            }
        });
        
        return result;
    }
    
    // ==================== 风险检测 ====================
    detectRisks() {
        this.risks = [];
        
        // 1. 检测材料不足或过量
        Object.entries(this.calculatedData.materialSummary).forEach(([materialId, summary]) => {
            const material = summary.material;
            const difference = summary.difference;
            
            // 材料不足（差额为负）
            if (difference < 0) {
                const severity = Math.abs(difference) / summary.totalNeeded > 0.2 ? 'high' : 'medium';
                this.risks.push({
                    id: `SHORTAGE_${materialId}`,
                    type: 'shortage',
                    title: `${material.name} 材料不足`,
                    description: `需要 ${summary.totalNeeded} ${material.unit}，已采购 ${summary.purchasedQuantity} ${material.unit}，还差 ${Math.abs(difference)} ${material.unit}`,
                    severity,
                    materialId,
                    material,
                    summary,
                    calculation: {
                        totalNeeded: summary.totalNeeded,
                        purchased: summary.purchasedQuantity,
                        difference: difference,
                        lossAmount: summary.totalLoss
                    }
                });
            }
            
            // 材料过量（差额超过15%）
            if (difference > 0 && difference / summary.totalNeeded > 0.15) {
                this.risks.push({
                    id: `OVERAGE_${materialId}`,
                    type: 'overage',
                    title: `${material.name} 采购过量`,
                    description: `需要 ${summary.totalNeeded} ${material.unit}，已采购 ${summary.purchasedQuantity} ${material.unit}，多买了 ${difference} ${material.unit}（超量 ${((difference / summary.totalNeeded) * 100).toFixed(1)}%）`,
                    severity: difference / summary.totalNeeded > 0.3 ? 'high' : 'low',
                    materialId,
                    material,
                    summary,
                    calculation: {
                        totalNeeded: summary.totalNeeded,
                        purchased: summary.purchasedQuantity,
                        difference: difference,
                        overagePercent: (difference / summary.totalNeeded) * 100
                    }
                });
            }
        });
        
        // 2. 检测同一种材料不同批次/色号混用
        const materialPurchases = {};
        this.data.purchases.forEach(purchase => {
            if (!materialPurchases[purchase.materialId]) {
                materialPurchases[purchase.materialId] = [];
            }
            materialPurchases[purchase.materialId].push(purchase);
        });
        
        Object.entries(materialPurchases).forEach(([materialId, purchases]) => {
            if (purchases.length <= 1) return;
            
            const batches = new Set(purchases.map(p => p.batch).filter(b => b));
            const colors = new Set(purchases.map(p => p.color).filter(c => c));
            
            if (batches.size > 1 || colors.size > 1) {
                const material = this.data.materials.find(m => m.id === materialId);
                this.risks.push({
                    id: `MIXED_${materialId}`,
                    type: 'mixed_batch',
                    title: `${material?.name || materialId} 存在混批风险`,
                    description: `该材料存在 ${batches.size} 个不同批次${colors.size > 1 ? `和 ${colors.size} 种色号` : ''}，混用可能导致色差`,
                    severity: 'high',
                    materialId,
                    material,
                    purchases,
                    calculation: {
                        batchCount: batches.size,
                        colorCount: colors.size,
                        batches: Array.from(batches),
                        colors: Array.from(colors)
                    }
                });
            }
        });
        
        // 3. 检测临期材料
        const today = new Date();
        this.data.materials.forEach(material => {
            if (!material.expiryDate) return;
            
            const expiryDate = new Date(material.expiryDate);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry <= 90 && daysUntilExpiry > 0) {
                const summary = this.calculatedData.materialSummary[material.id];
                const unusedQuantity = summary ? Math.max(0, summary.difference) : 0;
                
                if (unusedQuantity > 0) {
                    this.risks.push({
                        id: `EXPIRY_${material.id}`,
                        type: 'expiry',
                        title: `${material.name} 即将过期`,
                        description: `有效期至 ${material.expiryDate}，距今天还有 ${daysUntilExpiry} 天，剩余 ${unusedQuantity} ${material.unit} 可能浪费`,
                        severity: daysUntilExpiry <= 30 ? 'high' : 'medium',
                        materialId: material.id,
                        material,
                        summary,
                        calculation: {
                            expiryDate: material.expiryDate,
                            daysUntilExpiry,
                            unusedQuantity
                        }
                    });
                }
            }
        });
        
        // 4. 检测尺寸变更导致的材料偏差
        this.data.changes.forEach(change => {
            if (change.changeType !== '尺寸变更') return;
            if (Math.abs(change.areaDiff) < 0.5) return; // 忽略小变更
            
            const room = this.data.rooms.find(r => r.id === change.roomId);
            const areaDiffPercent = (change.areaDiff / change.originalArea) * 100;
            
            this.risks.push({
                id: `CHANGE_${change.id}`,
                type: 'dimension_change',
                title: `${room?.name || change.roomName} 尺寸变更影响`,
                description: `面积从 ${change.originalArea}㎡ 变为 ${change.newArea}㎡，${change.areaDiff > 0 ? '增加' : '减少'}了 ${Math.abs(change.areaDiff).toFixed(2)}㎡（${Math.abs(areaDiffPercent).toFixed(1)}%），可能影响材料用量`,
                severity: Math.abs(areaDiffPercent) > 10 ? 'high' : 'medium',
                roomId: change.roomId,
                room,
                change,
                calculation: {
                    originalArea: change.originalArea,
                    newArea: change.newArea,
                    areaDiff: change.areaDiff,
                    areaDiffPercent
                }
            });
        });
        
        // 按风险等级排序
        const severityOrder = { high: 0, medium: 1, low: 2 };
        this.risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }
    
    // ==================== 数据导入导出 ====================
    async importData(files) {
        for (const file of files) {
            const content = await this.readFile(file);
            
            if (file.name.endsWith('.json')) {
                this.importJSON(content);
            } else if (file.name.endsWith('.csv')) {
                this.importCSV(file.name, content);
            }
        }
        
        this.saveToLocalStorage();
        this.recalculate();
        this.render();
        this.showToast('数据导入成功', 'success');
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    }
    
    importJSON(content) {
        try {
            const data = JSON.parse(content);
            if (data.rooms) this.data.rooms = data.rooms;
            if (data.materials) this.data.materials = data.materials;
            if (data.purchases) this.data.purchases = data.purchases;
            if (data.changes) this.data.changes = data.changes;
        } catch (e) {
            this.showToast('JSON格式错误', 'error');
        }
    }
    
    importCSV(filename, content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) return;
        
        const headers = this.parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(line => this.parseCSVLine(line));
        
        if (filename.includes('rooms') || headers.includes('房间名称')) {
            this.data.rooms = rows.map((row, i) => ({
                id: row[headers.indexOf('id')] || `R${String(i + 1).padStart(3, '0')}`,
                name: row[headers.indexOf('房间名称')] || row[headers.indexOf('name')] || '',
                width: parseFloat(row[headers.indexOf('宽度')] || row[headers.indexOf('width')]) || 0,
                length: parseFloat(row[headers.indexOf('长度')] || row[headers.indexOf('length')]) || 0,
                area: parseFloat(row[headers.indexOf('面积')] || row[headers.indexOf('area')]) || 0,
                perimeter: parseFloat(row[headers.indexOf('周长')] || row[headers.indexOf('perimeter')]) || 0,
                height: parseFloat(row[headers.indexOf('高度')] || row[headers.indexOf('height')]) || 2.8
            }));
        } else if (filename.includes('purchases') || headers.includes('采购日期')) {
            this.data.purchases = rows.map((row, i) => ({
                id: row[headers.indexOf('id')] || `P${String(i + 1).padStart(3, '0')}`,
                materialId: row[headers.indexOf('材料ID')] || row[headers.indexOf('materialId')] || '',
                materialName: row[headers.indexOf('材料名称')] || row[headers.indexOf('materialName')] || '',
                batch: row[headers.indexOf('批次')] || row[headers.indexOf('batch')] || '',
                color: row[headers.indexOf('色号')] || row[headers.indexOf('color')] || '',
                quantity: parseFloat(row[headers.indexOf('数量')] || row[headers.indexOf('quantity')]) || 0,
                unitPrice: parseFloat(row[headers.indexOf('单价')] || row[headers.indexOf('unitPrice')]) || 0,
                purchaseDate: row[headers.indexOf('采购日期')] || row[headers.indexOf('purchaseDate')] || '',
                supplier: row[headers.indexOf('供应商')] || row[headers.indexOf('supplier')] || ''
            }));
        } else if (filename.includes('changes') || headers.includes('变更日期')) {
            this.data.changes = rows.map((row, i) => ({
                id: row[headers.indexOf('id')] || `C${String(i + 1).padStart(3, '0')}`,
                roomId: row[headers.indexOf('房间ID')] || row[headers.indexOf('roomId')] || '',
                roomName: row[headers.indexOf('房间名称')] || row[headers.indexOf('roomName')] || '',
                changeDate: row[headers.indexOf('变更日期')] || row[headers.indexOf('changeDate')] || '',
                changeType: row[headers.indexOf('变更类型')] || row[headers.indexOf('changeType')] || '',
                reason: row[headers.indexOf('变更原因')] || row[headers.indexOf('reason')] || '',
                originalWidth: parseFloat(row[headers.indexOf('原宽度')] || row[headers.indexOf('originalWidth')]) || 0,
                originalLength: parseFloat(row[headers.indexOf('原长度')] || row[headers.indexOf('originalLength')]) || 0,
                originalArea: parseFloat(row[headers.indexOf('原面积')] || row[headers.indexOf('originalArea')]) || 0,
                originalPerimeter: parseFloat(row[headers.indexOf('原周长')] || row[headers.indexOf('originalPerimeter')]) || 0,
                newWidth: parseFloat(row[headers.indexOf('新宽度')] || row[headers.indexOf('newWidth')]) || 0,
                newLength: parseFloat(row[headers.indexOf('新长度')] || row[headers.indexOf('newLength')]) || 0,
                newArea: parseFloat(row[headers.indexOf('新面积')] || row[headers.indexOf('newArea')]) || 0,
                newPerimeter: parseFloat(row[headers.indexOf('新周长')] || row[headers.indexOf('newPerimeter')]) || 0,
                areaDiff: parseFloat(row[headers.indexOf('面积差')] || row[headers.indexOf('areaDiff')]) || 0,
                perimeterDiff: parseFloat(row[headers.indexOf('周长差')] || row[headers.indexOf('perimeterDiff')]) || 0,
                remark: row[headers.indexOf('备注')] || row[headers.indexOf('remark')] || ''
            }));
        }
    }
    
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
    }
    
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        this.downloadFile(dataStr, `装修材料数据_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // ==================== 报告生成 ====================
    generateReport(format = 'markdown') {
        const date = new Date().toISOString().split('T')[0];
        const highRisks = this.risks.filter(r => r.severity === 'high');
        const mediumRisks = this.risks.filter(r => r.severity === 'medium');
        const lowRisks = this.risks.filter(r => r.severity === 'low');
        
        const shortages = this.risks.filter(r => r.type === 'shortage');
        const overages = this.risks.filter(r => r.type === 'overage');
        
        let report = '';
        
        if (format === 'markdown') {
            report = this.generateMarkdownReport(date, highRisks, mediumRisks, lowRisks, shortages, overages);
            this.downloadFile(report, `装修材料报告_${date}.md`, 'text/markdown');
        } else {
            report = this.generateHTMLReport(date, highRisks, mediumRisks, lowRisks, shortages, overages);
            this.downloadFile(report, `装修材料报告_${date}.html`, 'text/html');
        }
        
        this.showToast('报告生成成功', 'success');
        return report;
    }
    
    generateMarkdownReport(date, highRisks, mediumRisks, lowRisks, shortages, overages) {
        let md = `# 装修材料核算报告\n\n`;
        md += `**生成日期：** ${date}\n\n`;
        md += `---\n\n`;
        
        // 摘要
        md += `## 一、风险摘要\n\n`;
        md += `| 风险等级 | 数量 |\n|---------|------|\n`;
        md += `| 🔴 高风险 | ${highRisks.length} |\n`;
        md += `| 🟡 中风险 | ${mediumRisks.length} |\n`;
        md += `| 🔵 低风险 | ${lowRisks.length} |\n\n`;
        
        // 补货清单
        if (shortages.length > 0) {
            md += `## 二、补货清单\n\n`;
            md += `| 材料名称 | 单位 | 需求量 | 已采购 | 缺口 |\n|---------|------|--------|--------|------|\n`;
            shortages.forEach(s => {
                md += `| ${s.material.name} | ${s.material.unit} | ${s.summary.totalNeeded} | ${s.summary.purchasedQuantity} | **${Math.abs(s.summary.difference)}** |\n`;
            });
            md += `\n`;
        }
        
        // 退料清单
        if (overages.length > 0) {
            md += `## 三、退料清单\n\n`;
            md += `| 材料名称 | 单位 | 需求量 | 已采购 | 剩余 | 超量比例 |\n|---------|------|--------|--------|------|----------|\n`;
            overages.forEach(o => {
                md += `| ${o.material.name} | ${o.material.unit} | ${o.summary.totalNeeded} | ${o.summary.purchasedQuantity} | **${o.summary.difference}** | ${(o.calculation.overagePercent).toFixed(1)}% |\n`;
            });
            md += `\n`;
        }
        
        // 风险详情
        md += `## 四、风险详情\n\n`;
        
        if (highRisks.length > 0) {
            md += `### 🔴 高风险\n\n`;
            highRisks.forEach(r => {
                md += `#### ${r.title}\n\n`;
                md += `${r.description}\n\n`;
                if (r.calculation) {
                    md += `**计算依据：**\n`;
                    Object.entries(r.calculation).forEach(([key, value]) => {
                        md += `- ${key}: ${value}\n`;
                    });
                    md += `\n`;
                }
            });
        }
        
        if (mediumRisks.length > 0) {
            md += `### 🟡 中风险\n\n`;
            mediumRisks.forEach(r => {
                md += `#### ${r.title}\n\n`;
                md += `${r.description}\n\n`;
            });
        }
        
        // 材料汇总
        md += `## 五、材料汇总\n\n`;
        md += `| 材料名称 | 类型 | 单位 | 总需求 | 损耗量 | 已采购 | 差额 |\n|---------|------|------|--------|--------|--------|------|\n`;
        
        Object.entries(this.calculatedData.materialSummary).forEach(([id, summary]) => {
            const diffClass = summary.difference >= 0 ? '' : '**';
            md += `| ${summary.material.name} | ${summary.material.type} | ${summary.material.unit} | ${summary.totalNeeded} | ${summary.totalLoss} | ${summary.purchasedQuantity} | ${diffClass}${summary.difference >= 0 ? '+' : ''}${summary.difference}${diffClass} |\n`;
        });
        
        return md;
    }
    
    generateHTMLReport(date, highRisks, mediumRisks, lowRisks, shortages, overages) {
        let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>装修材料核算报告 - ${date}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
        h1 { font-size: 28px; color: #1a1a1a; border-bottom: 3px solid #4a90d9; padding-bottom: 12px; }
        h2 { font-size: 22px; color: #1a1a1a; margin-top: 40px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px; }
        h3 { font-size: 18px; color: #4a90d9; margin-top: 24px; }
        h4 { font-size: 16px; color: #333; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 12px; text-align: left; border: 1px solid #e9ecef; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .high-risk { color: #dc3545; font-weight: 600; }
        .medium-risk { color: #ffc107; font-weight: 600; }
        .low-risk { color: #17a2b8; font-weight: 600; }
        .positive { color: #28a745; font-weight: 600; }
        .negative { color: #dc3545; font-weight: 600; }
        .summary-box { display: flex; gap: 24px; margin: 24px 0; }
        .summary-item { flex: 1; padding: 16px; border-radius: 8px; text-align: center; }
        .summary-item.high { background-color: #fef5f5; border: 1px solid #fecaca; }
        .summary-item.medium { background-color: #fffbeb; border: 1px solid #fed7aa; }
        .summary-item.low { background-color: #f0fdfa; border: 1px solid #99f6e4; }
        .summary-value { font-size: 32px; font-weight: 700; }
        .meta { color: #6c757d; font-size: 14px; margin-bottom: 24px; }
        hr { border: none; border-top: 1px solid #e9ecef; margin: 24px 0; }
    </style>
</head>
<body>
    <h1>装修材料核算报告</h1>
    <p class="meta"><strong>生成日期：</strong>${date}</p>
    <hr>
    
    <h2>一、风险摘要</h2>
    <div class="summary-box">
        <div class="summary-item high">
            <div class="summary-value high-risk">${highRisks.length}</div>
            <div>🔴 高风险</div>
        </div>
        <div class="summary-item medium">
            <div class="summary-value medium-risk">${mediumRisks.length}</div>
            <div>🟡 中风险</div>
        </div>
        <div class="summary-item low">
            <div class="summary-value low-risk">${lowRisks.length}</div>
            <div>🔵 低风险</div>
        </div>
    </div>`;
        
        if (shortages.length > 0) {
            html += `
    <h2>二、补货清单</h2>
    <table>
        <thead>
            <tr><th>材料名称</th><th>单位</th><th>需求量</th><th>已采购</th><th>缺口</th></tr>
        </thead>
        <tbody>`;
            shortages.forEach(s => {
                html += `
            <tr><td>${s.material.name}</td><td>${s.material.unit}</td><td>${s.summary.totalNeeded}</td><td>${s.summary.purchasedQuantity}</td><td class="negative">${Math.abs(s.summary.difference)}</td></tr>`;
            });
            html += `
        </tbody>
    </table>`;
        }
        
        if (overages.length > 0) {
            html += `
    <h2>三、退料清单</h2>
    <table>
        <thead>
            <tr><th>材料名称</th><th>单位</th><th>需求量</th><th>已采购</th><th>剩余</th><th>超量比例</th></tr>
        </thead>
        <tbody>`;
            overages.forEach(o => {
                html += `
            <tr><td>${o.material.name}</td><td>${o.material.unit}</td><td>${o.summary.totalNeeded}</td><td>${o.summary.purchasedQuantity}</td><td class="positive">${o.summary.difference}</td><td>${o.calculation.overagePercent.toFixed(1)}%</td></tr>`;
            });
            html += `
        </tbody>
    </table>`;
        }
        
        html += `
    <h2>四、材料汇总</h2>
    <table>
        <thead>
            <tr><th>材料名称</th><th>类型</th><th>单位</th><th>总需求</th><th>损耗量</th><th>已采购</th><th>差额</th></tr>
        </thead>
        <tbody>`;
        
        Object.entries(this.calculatedData.materialSummary).forEach(([id, summary]) => {
            const diffClass = summary.difference >= 0 ? 'positive' : 'negative';
            const diffText = summary.difference >= 0 ? `+${summary.difference}` : summary.difference;
            html += `
            <tr><td>${summary.material.name}</td><td>${summary.material.type}</td><td>${summary.material.unit}</td><td>${summary.totalNeeded}</td><td>${summary.totalLoss}</td><td>${summary.purchasedQuantity}</td><td class="${diffClass}">${diffText}</td></tr>`;
        });
        
        html += `
        </tbody>
    </table>
</body>
</html>`;
        
        return html;
    }
    
    // ==================== UI 渲染 ====================
    render() {
        this.updateStats();
        this.updateRoomFilter();
        this.renderRoomsTab();
        this.renderMaterialsTab();
        this.renderRisksTab();
    }
    
    updateStats() {
        document.getElementById('room-count').textContent = this.data.rooms.length;
        document.getElementById('material-count').textContent = this.data.materials.length;
        document.getElementById('purchase-count').textContent = this.data.purchases.length;
        document.getElementById('change-count').textContent = this.data.changes.length;
        
        const highCount = this.risks.filter(r => r.severity === 'high').length;
        const mediumCount = this.risks.filter(r => r.severity === 'medium').length;
        const lowCount = this.risks.filter(r => r.severity === 'low').length;
        
        document.getElementById('high-risk-count').textContent = highCount;
        document.getElementById('medium-risk-count').textContent = mediumCount;
        document.getElementById('low-risk-count').textContent = lowCount;
    }
    
    updateRoomFilter() {
        const select = document.getElementById('room-filter');
        select.innerHTML = '<option value="">全部房间</option>';
        this.data.rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            select.appendChild(option);
        });
    }
    
    renderRoomsTab() {
        const container = document.getElementById('rooms-list');
        
        if (!this.calculatedData || Object.keys(this.calculatedData.roomMaterials).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据，请先导入或加载示例数据</p></div>';
            return;
        }
        
        let html = '';
        
        this.data.rooms.forEach(room => {
            const roomMaterials = this.calculatedData.roomMaterials[room.id] || {};
            const effectiveRoom = this.getEffectiveRoomDimensions(room);
            const hasChange = this.data.changes.some(c => c.roomId === room.id);
            
            // 计算该房间的材料总数
            const materialCount = Object.keys(roomMaterials).length;
            
            // 计算该房间是否有风险
            const roomRisks = this.risks.filter(r => 
                (r.roomId === room.id) || 
                (r.summary && r.summary.roomBreakdown && r.summary.roomBreakdown.some(rb => rb.roomId === room.id))
            );
            const hasRisk = roomRisks.length > 0;
            
            html += `
            <div class="card" data-room-id="${room.id}">
                <div class="card-header">
                    <h3 class="card-title">${room.name}</h3>
                    <div style="display: flex; gap: 8px;">
                        ${hasChange ? '<span class="card-badge warning">已变更</span>' : ''}
                        ${hasRisk ? `<span class="card-badge danger">${roomRisks.length} 项风险</span>` : '<span class="card-badge success">正常</span>'}
                    </div>
                </div>
                <div class="card-content">
                    <div class="card-item">
                        <span class="card-item-label">面积</span>
                        <span class="card-item-value">${effectiveRoom.area.toFixed(2)} ㎡${room.area !== effectiveRoom.area ? ` (原 ${room.area.toFixed(2)})` : ''}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">周长</span>
                        <span class="card-item-value">${effectiveRoom.perimeter.toFixed(1)} m</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">材料种类</span>
                        <span class="card-item-value">${materialCount} 种</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">尺寸</span>
                        <span class="card-item-value">${effectiveRoom.width}m × ${effectiveRoom.length}m</span>
                    </div>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const roomId = card.dataset.roomId;
                this.showRoomDetail(roomId);
            });
        });
    }
    
    renderMaterialsTab() {
        const container = document.getElementById('materials-list');
        
        if (!this.calculatedData || Object.keys(this.calculatedData.materialSummary).length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据，请先导入或加载示例数据</p></div>';
            return;
        }
        
        let html = '';
        
        Object.entries(this.calculatedData.materialSummary).forEach(([materialId, summary]) => {
            const material = summary.material;
            const difference = summary.difference;
            
            // 确定状态
            let status = 'normal';
            let statusText = '正常';
            let statusClass = 'success';
            
            if (difference < 0) {
                status = 'shortage';
                statusText = '不足';
                statusClass = 'danger';
            } else if (difference > 0 && difference / summary.totalNeeded > 0.15) {
                status = 'overage';
                statusText = '过量';
                statusClass = 'warning';
            }
            
            html += `
            <div class="card" data-material-id="${materialId}">
                <div class="card-header">
                    <h3 class="card-title">${material.name}</h3>
                    <span class="card-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="card-content">
                    <div class="card-item">
                        <span class="card-item-label">类型</span>
                        <span class="card-item-value">${material.type}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">总需求</span>
                        <span class="card-item-value">${summary.totalNeeded} ${material.unit}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">已采购</span>
                        <span class="card-item-value">${summary.purchasedQuantity} ${material.unit}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">差额</span>
                        <span class="card-item-value ${difference >= 0 ? 'positive' : 'negative'}">${difference >= 0 ? '+' : ''}${difference} ${material.unit}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">损耗量</span>
                        <span class="card-item-value">${summary.totalLoss} ${material.unit}</span>
                    </div>
                    <div class="card-item">
                        <span class="card-item-label">单价</span>
                        <span class="card-item-value">¥${material.price}</span>
                    </div>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const materialId = card.dataset.materialId;
                this.showMaterialDetail(materialId);
            });
        });
    }
    
    renderRisksTab() {
        const container = document.getElementById('risks-list');
        
        if (this.risks.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无风险数据</p></div>';
            return;
        }
        
        // 应用筛选
        let filteredRisks = [...this.risks];
        
        if (this.filterState.riskLevel) {
            filteredRisks = filteredRisks.filter(r => r.severity === this.filterState.riskLevel);
        }
        
        if (this.filterState.materialTypes.length > 0) {
            filteredRisks = filteredRisks.filter(r => {
                if (!r.material) return false;
                return this.filterState.materialTypes.includes(r.material.type);
            });
        }
        
        if (filteredRisks.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>没有符合筛选条件的风险</p></div>';
            return;
        }
        
        let html = '';
        
        filteredRisks.forEach(risk => {
            const severityLabel = { high: '高风险', medium: '中风险', low: '低风险' };
            
            html += `
            <div class="risk-item ${risk.severity}" data-risk-id="${risk.id}">
                <div class="risk-header">
                    <h3 class="risk-title">${risk.title}</h3>
                    <span class="risk-badge ${risk.severity}">${severityLabel[risk.severity]}</span>
                </div>
                <p class="risk-description">${risk.description}</p>
                <div class="risk-meta">
                    <span class="risk-meta-item">📋 类型: ${this.getRiskTypeName(risk.type)}</span>
                    ${risk.material ? `<span class="risk-meta-item">🧱 材料: ${risk.material.name}</span>` : ''}
                    ${risk.room ? `<span class="risk-meta-item">🏠 房间: ${risk.room.name}</span>` : ''}
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.risk-item').forEach(item => {
            item.addEventListener('click', () => {
                const riskId = item.dataset.riskId;
                this.showRiskDetail(riskId);
            });
        });
    }
    
    getRiskTypeName(type) {
        const names = {
            shortage: '材料不足',
            overage: '采购过量',
            mixed_batch: '混批风险',
            expiry: '临期风险',
            dimension_change: '尺寸变更'
        };
        return names[type] || type;
    }
    
    // ==================== 详情弹窗 ====================
    showRoomDetail(roomId) {
        const room = this.data.rooms.find(r => r.id === roomId);
        if (!room) return;
        
        const effectiveRoom = this.getEffectiveRoomDimensions(room);
        const roomMaterials = this.calculatedData.roomMaterials[roomId] || {};
        const changes = this.data.changes.filter(c => c.roomId === roomId);
        
        let materialsHtml = '';
        Object.entries(roomMaterials).forEach(([materialId, rm]) => {
            const purchases = this.data.purchases.filter(p => p.materialId === materialId);
            const purchasedForRoom = purchases.length > 0 ? 
                Math.ceil(rm.needed * (purchases.reduce((s, p) => s + p.quantity, 0) / 
                    (this.calculatedData.materialSummary[materialId]?.totalNeeded || 1))) : 0;
            
            materialsHtml += `
                <tr>
                    <td>${rm.material.name}</td>
                    <td>${rm.material.type}</td>
                    <td>${rm.baseNeeded} ${rm.material.unit}</td>
                    <td>${rm.lossAmount} ${rm.material.unit} (${(rm.lossRate * 100).toFixed(0)}%)</td>
                    <td>${rm.needed} ${rm.material.unit}</td>
                </tr>`;
        });
        
        let changesHtml = '';
        if (changes.length > 0) {
            changesHtml = `
            <div class="detail-section">
                <h4>📝 尺寸变更记录</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>变更日期</th><th>变更类型</th><th>原因</th><th>原面积</th><th>新面积</th><th>面积差</th><th>备注</th></tr>
                    </thead>
                    <tbody>
                        ${changes.map(c => `
                        <tr>
                            <td>${c.changeDate}</td>
                            <td>${c.changeType}</td>
                            <td>${c.reason}</td>
                            <td>${c.originalArea} ㎡</td>
                            <td>${c.newArea} ㎡</td>
                            <td class="${c.areaDiff >= 0 ? 'success' : 'danger'}">${c.areaDiff >= 0 ? '+' : ''}${c.areaDiff.toFixed(2)} ㎡</td>
                            <td>${c.remark || '-'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        
        const content = `
            <div class="detail-section">
                <h4>🏠 房间基本信息</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">房间名称</span>
                        <span class="detail-value">${room.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">当前面积</span>
                        <span class="detail-value ${room.area !== effectiveRoom.area ? 'highlight' : ''}">${effectiveRoom.area.toFixed(2)} ㎡</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">当前尺寸</span>
                        <span class="detail-value">${effectiveRoom.width}m × ${effectiveRoom.length}m</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">周长</span>
                        <span class="detail-value">${effectiveRoom.perimeter.toFixed(1)} m</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">高度</span>
                        <span class="detail-value">${effectiveRoom.height || 2.8} m</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>🧱 材料需求明细</h4>
                ${materialsHtml ? `
                <table class="detail-table">
                    <thead>
                        <tr><th>材料名称</th><th>类型</th><th>基础用量</th><th>损耗量</th><th>总需求</th></tr>
                    </thead>
                    <tbody>${materialsHtml}</tbody>
                </table>` : '<p>暂未分配材料</p>'}
            </div>
            
            ${changesHtml}
        `;
        
        this.showModal(`${room.name} - 详情`, content);
    }
    
    showMaterialDetail(materialId) {
        const summary = this.calculatedData.materialSummary[materialId];
        if (!summary) return;
        
        const material = summary.material;
        
        let roomBreakdownHtml = '';
        if (summary.roomBreakdown.length > 0) {
            roomBreakdownHtml = `
            <div class="detail-section">
                <h4>📊 各房间用量明细</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>房间</th><th>需求量</th><th>损耗量</th><th>占比</th></tr>
                    </thead>
                    <tbody>
                        ${summary.roomBreakdown.map(rb => `
                        <tr>
                            <td>${rb.roomName}</td>
                            <td>${rb.needed} ${material.unit}</td>
                            <td>${rb.lossAmount} ${material.unit}</td>
                            <td>${((rb.needed / summary.totalNeeded) * 100).toFixed(1)}%</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        
        let purchasesHtml = '';
        if (summary.purchases.length > 0) {
            purchasesHtml = `
            <div class="detail-section">
                <h4>📦 采购记录</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>采购日期</th><th>批次</th><th>色号</th><th>数量</th><th>单价</th><th>供应商</th></tr>
                    </thead>
                    <tbody>
                        ${summary.purchases.map(p => `
                        <tr>
                            <td>${p.purchaseDate}</td>
                            <td>${p.batch || '-'}</td>
                            <td>${p.color || '-'}</td>
                            <td>${p.quantity} ${material.unit}</td>
                            <td>¥${p.unitPrice}</td>
                            <td>${p.supplier || '-'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        
        const content = `
            <div class="detail-section">
                <h4>🧱 材料基本信息</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">材料名称</span>
                        <span class="detail-value">${material.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">类型</span>
                        <span class="detail-value">${material.type}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">单位</span>
                        <span class="detail-value">${material.unit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">规格</span>
                        <span class="detail-value">${material.specWidth ? material.specWidth + 'm × ' + material.specLength + 'm' : '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">每单位面积</span>
                        <span class="detail-value">${material.areaPerUnit || '-'} ㎡</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">损耗率</span>
                        <span class="detail-value">${(material.lossRate * 100).toFixed(0)}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">单价</span>
                        <span class="detail-value">¥${material.price}</span>
                    </div>
                    ${material.expiryDate ? `
                    <div class="detail-item">
                        <span class="detail-label">有效期</span>
                        <span class="detail-value">${material.expiryDate}</span>
                    </div>` : ''}
                </div>
            </div>
            
            <div class="detail-section">
                <h4>📊 供需汇总</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">总需求量</span>
                        <span class="detail-value highlight">${summary.totalNeeded} ${material.unit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">损耗总量</span>
                        <span class="detail-value">${summary.totalLoss} ${material.unit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">已采购</span>
                        <span class="detail-value">${summary.purchasedQuantity} ${material.unit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">差额</span>
                        <span class="detail-value ${summary.difference >= 0 ? 'success' : 'danger'}">${summary.difference >= 0 ? '+' : ''}${summary.difference} ${material.unit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">采购金额</span>
                        <span class="detail-value">¥${summary.purchases.reduce((s, p) => s + p.quantity * p.unitPrice, 0)}</span>
                    </div>
                </div>
            </div>
            
            ${roomBreakdownHtml}
            ${purchasesHtml}
        `;
        
        this.showModal(`${material.name} - 详情`, content);
    }
    
    showRiskDetail(riskId) {
        const risk = this.risks.find(r => r.id === riskId);
        if (!risk) return;
        
        const severityLabel = { high: '高风险', medium: '中风险', low: '低风险' };
        const severityColor = { high: 'danger', medium: 'warning', low: 'info' };
        
        let calculationHtml = '';
        if (risk.calculation) {
            calculationHtml = `
            <div class="detail-section">
                <h4>🧮 计算依据</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>参数</th><th>值</th></tr>
                    </thead>
                    <tbody>
                        ${Object.entries(risk.calculation).map(([key, value]) => `
                        <tr>
                            <td>${this.formatKey(key)}</td>
                            <td>${this.formatValue(value)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        
        let purchasesHtml = '';
        if (risk.purchases && risk.purchases.length > 0) {
            purchasesHtml = `
            <div class="detail-section">
                <h4>📦 相关采购记录</h4>
                <table class="detail-table">
                    <thead>
                        <tr><th>采购日期</th><th>批次</th><th>色号</th><th>数量</th><th>供应商</th></tr>
                    </thead>
                    <tbody>
                        ${risk.purchases.map(p => `
                        <tr>
                            <td>${p.purchaseDate}</td>
                            <td>${p.batch || '-'}</td>
                            <td>${p.color || '-'}</td>
                            <td>${p.quantity}</td>
                            <td>${p.supplier || '-'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }
        
        const content = `
            <div class="detail-section">
                <h4>⚠️ 风险基本信息</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">风险标题</span>
                        <span class="detail-value">${risk.title}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">风险类型</span>
                        <span class="detail-value">${this.getRiskTypeName(risk.type)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">风险等级</span>
                        <span class="detail-value ${severityColor[risk.severity]}">${severityLabel[risk.severity]}</span>
                    </div>
                    ${risk.material ? `
                    <div class="detail-item">
                        <span class="detail-label">相关材料</span>
                        <span class="detail-value">${risk.material.name}</span>
                    </div>` : ''}
                    ${risk.room ? `
                    <div class="detail-item">
                        <span class="detail-label">相关房间</span>
                        <span class="detail-value">${risk.room.name}</span>
                    </div>` : ''}
                </div>
            </div>
            
            <div class="detail-section">
                <h4>📝 风险描述</h4>
                <p>${risk.description}</p>
            </div>
            
            ${calculationHtml}
            ${purchasesHtml}
        `;
        
        this.showModal(`风险详情 - ${risk.title}`, content);
    }
    
    formatKey(key) {
        const keyMap = {
            totalNeeded: '总需求量',
            purchased: '已采购数量',
            difference: '差额',
            lossAmount: '损耗量',
            overagePercent: '超量比例',
            batchCount: '批次数量',
            colorCount: '色号数量',
            batches: '批次列表',
            colors: '色号列表',
            expiryDate: '有效期',
            daysUntilExpiry: '距到期天数',
            unusedQuantity: '未使用数量',
            originalArea: '原面积',
            newArea: '新面积',
            areaDiff: '面积差',
            areaDiffPercent: '面积变化比例'
        };
        return keyMap[key] || key;
    }
    
    formatValue(value) {
        if (Array.isArray(value)) {
            return value.join(', ') || '-';
        }
        if (typeof value === 'number') {
            if (value % 1 === 0) return value.toString();
            return value.toFixed(2);
        }
        return value || '-';
    }
    
    // ==================== Modal 管理 ====================
    showModal(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal-overlay').classList.add('active');
    }
    
    hideModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }
    
    // ==================== Toast 通知 ====================
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // ==================== 事件绑定 ====================
    bindEvents() {
        // Tab 切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const tabName = tab.dataset.tab;
                document.getElementById(`${tabName}-content`).classList.add('active');
            });
        });
        
        // Modal 关闭
        document.getElementById('modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-cancel').addEventListener('click', () => this.hideModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') this.hideModal();
        });
        
        // 筛选器
        document.getElementById('risk-filter').addEventListener('change', (e) => {
            this.filterState.riskLevel = e.target.value;
            this.renderRisksTab();
        });
        
        document.getElementById('material-type-filter').addEventListener('change', (e) => {
            this.filterState.materialTypes = Array.from(e.target.selectedOptions)
                .map(opt => opt.value)
                .filter(v => v);
            this.renderRisksTab();
        });
        
        document.getElementById('reset-filter-btn').addEventListener('click', () => {
            this.filterState = {
                rooms: [],
                materialTypes: [],
                riskLevel: ''
            };
            document.getElementById('risk-filter').value = '';
            document.getElementById('material-type-filter').selectedIndex = 0;
            this.render();
        });
        
        // 数据管理按钮
        document.getElementById('load-sample-btn').addEventListener('click', () => {
            this.loadSampleData();
        });
        
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearData();
        });
        
        // 导入导出按钮
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('multi-file-input').click();
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            if (this.data.rooms.length === 0) {
                this.showToast('暂无数据可导出', 'error');
                return;
            }
            this.exportData();
        });
        
        document.getElementById('report-btn').addEventListener('click', () => {
            if (this.data.rooms.length === 0) {
                this.showToast('请先加载或导入数据', 'error');
                return;
            }
            this.showReportOptions();
        });
        
        // 文件输入
        document.getElementById('multi-file-input').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(Array.from(e.target.files));
                e.target.value = '';
            }
        });
    }
    
    showReportOptions() {
        const content = `
            <div class="detail-section">
                <h4>📄 选择报告格式</h4>
                <div style="display: flex; gap: 16px; margin-top: 16px;">
                    <button class="btn btn-primary" id="export-md-btn" style="flex: 1; padding: 16px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📝</div>
                        <div>Markdown 格式</div>
                        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">适合编辑和分享</div>
                    </button>
                    <button class="btn btn-primary" id="export-html-btn" style="flex: 1; padding: 16px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🌐</div>
                        <div>HTML 格式</div>
                        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">适合浏览器查看</div>
                    </button>
                </div>
            </div>
        `;
        
        this.showModal('生成报告', content);
        
        // 绑定按钮事件
        setTimeout(() => {
            document.getElementById('export-md-btn')?.addEventListener('click', () => {
                this.generateReport('markdown');
                this.hideModal();
            });
            
            document.getElementById('export-html-btn')?.addEventListener('click', () => {
                this.generateReport('html');
                this.hideModal();
            });
        }, 0);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new MaterialCalculator();
});