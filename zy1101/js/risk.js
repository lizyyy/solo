const RiskDetector = {
    RISK_TYPES: {
        MIXED_BATCHES: 'mixed_batches',
        SHORTAGE_AFTER_CHANGE: 'shortage_after_change',
        EXCESS_PURCHASE: 'excess_purchase',
        EXPIRY_SOON: 'expiry_soon',
        CRITICAL_SHORTAGE: 'critical_shortage'
    },
    
    RISK_LEVELS: {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    },
    
    detectAll: function(calculatedData, purchases, materials) {
        const risks = [];
        
        if (!calculatedData) return risks;
        
        risks.push(...this.detectMixedBatches(purchases, materials));
        
        risks.push(...this.detectShortageAfterChange(calculatedData));
        
        risks.push(...this.detectExcessPurchase(calculatedData));
        
        risks.push(...this.detectExpirySoon(purchases, materials));
        
        risks.push(...this.detectCriticalShortage(calculatedData));
        
        risks.sort((a, b) => {
            const levelOrder = { high: 0, medium: 1, low: 2 };
            return levelOrder[a.level] - levelOrder[b.level];
        });
        
        return risks;
    },
    
    detectMixedBatches: function(purchases, materials) {
        const risks = [];
        
        const materialPurchases = {};
        purchases.forEach(p => {
            const key = p.materialId || p.materialName;
            if (!materialPurchases[key]) {
                materialPurchases[key] = [];
            }
            materialPurchases[key].push(p);
        });
        
        Object.keys(materialPurchases).forEach(key => {
            const matPurchases = materialPurchases[key];
            
            if (matPurchases.length < 2) return;
            
            const batches = new Set();
            const colorNos = new Set();
            
            matPurchases.forEach(p => {
                if (p.batchNo) batches.add(p.batchNo);
                if (p.colorNo) colorNos.add(p.colorNo);
            });
            
            if (batches.size > 1 || colorNos.size > 1) {
                const samplePurchase = matPurchases[0];
                const material = materials.find(m => 
                    m.id === samplePurchase.materialId || 
                    m.name === samplePurchase.materialName
                );
                
                const isTileOrFloor = material && ['瓷砖', '地板', '壁纸'].includes(material.type);
                
                risks.push({
                    id: 'risk_mixed_' + key,
                    type: this.RISK_TYPES.MIXED_BATCHES,
                    level: isTileOrFloor ? this.RISK_LEVELS.HIGH : this.RISK_LEVELS.MEDIUM,
                    title: `不同批次/色号混用风险`,
                    materialId: samplePurchase.materialId,
                    materialName: samplePurchase.materialName,
                    purchases: matPurchases,
                    batches: Array.from(batches),
                    colorNos: Array.from(colorNos),
                    summary: `检测到 ${samplePurchase.materialName} 存在 ${batches.size} 个不同批次${colorNos.size > 1 ? '和' + colorNos.size + '个不同色号' : ''}`,
                    details: {
                        batches: Array.from(batches),
                        colorNos: Array.from(colorNos),
                        purchaseCount: matPurchases.length,
                        isCriticalMaterial: isTileOrFloor
                    },
                    calculation: {
                        steps: [
                            { label: '采购批次统计', value: `${batches.size} 个批次`, detail: Array.from(batches).join(', ') },
                            { label: '采购色号统计', value: `${colorNos.size} 个色号`, detail: colorNos.size > 0 ? Array.from(colorNos).join(', ') : '无' },
                            { label: '风险分析', value: isTileOrFloor ? '高风险' : '中等风险', detail: isTileOrFloor ? '瓷砖/地板/壁纸等材料不同批次可能有色差' : '建议核对批次和色号' }
                        ]
                    }
                });
            }
        });
        
        return risks;
    },
    
    detectShortageAfterChange: function(calculatedData) {
        const risks = [];
        
        calculatedData.roomMaterials.forEach(rm => {
            if (rm.changeCount > 0 && rm.shortage > 0) {
                const changes = rm.changes || [];
                const areaIncreases = changes.filter(c => c.areaDifference > 0);
                
                if (areaIncreases.length > 0) {
                    const totalIncrease = areaIncreases.reduce((sum, c) => sum + c.areaDifference, 0);
                    
                    risks.push({
                        id: 'risk_shortage_change_' + rm.roomId + '_' + rm.materialId,
                        type: this.RISK_TYPES.SHORTAGE_AFTER_CHANGE,
                        level: this.RISK_LEVELS.HIGH,
                        title: `改尺后材料不足`,
                        roomId: rm.roomId,
                        roomName: rm.roomName,
                        materialId: rm.materialId,
                        materialName: rm.materialName,
                        roomMaterial: rm,
                        changes: changes,
                        summary: `${rm.roomName} 的 ${rm.materialName} 因尺寸变更增加 ${totalIncrease}㎡，目前短缺 ${rm.shortage} ${rm.unit}`,
                        details: {
                            originalArea: rm.originalArea,
                            currentArea: rm.area,
                            areaIncrease: totalIncrease,
                            shortage: rm.shortage,
                            unit: rm.unit
                        },
                        calculation: {
                            steps: this.buildShortageCalculationSteps(rm, totalIncrease)
                        }
                    });
                }
            }
        });
        
        return risks;
    },
    
    detectExcessPurchase: function(calculatedData) {
        const risks = [];
        
        calculatedData.materialSummary.forEach(ms => {
            if (ms.surplus <= 0) return;
            
            const surplusPercentage = ms.totalRequired > 0 
                ? (ms.surplus / ms.totalRequired) * 100 
                : 0;
            
            if (surplusPercentage > 30) {
                risks.push({
                    id: 'risk_excess_' + ms.materialId,
                    type: this.RISK_TYPES.EXCESS_PURCHASE,
                    level: surplusPercentage > 50 ? this.RISK_LEVELS.MEDIUM : this.RISK_LEVELS.LOW,
                    title: `采购过剩`,
                    materialId: ms.materialId,
                    materialName: ms.materialName,
                    materialSummary: ms,
                    summary: `${ms.materialName} 采购过剩 ${ms.surplus} ${ms.unit}，超过需求量 ${Utils.formatNumber(surplusPercentage)}%`,
                    details: {
                        totalRequired: ms.totalRequired,
                        totalPurchased: ms.totalPurchased,
                        surplus: ms.surplus,
                        surplusPercentage: surplusPercentage,
                        unit: ms.unit
                    },
                    calculation: {
                        steps: [
                            { label: '总需求量', value: `${Utils.formatNumber(ms.totalRequired)} ${ms.unit}`, detail: '所有房间需求量之和' },
                            { label: '已采购量', value: `${Utils.formatNumber(ms.totalPurchased)} ${ms.unit}`, detail: '所有采购批次数量之和' },
                            { label: '过剩量', value: `${Utils.formatNumber(ms.surplus)} ${ms.unit}`, detail: `已采购 - 需求 = ${ms.totalPurchased} - ${ms.totalRequired}` },
                            { label: '过剩比例', value: `${Utils.formatNumber(surplusPercentage)}%`, detail: `(${ms.surplus} ÷ ${ms.totalRequired}) × 100%` }
                        ]
                    }
                });
            }
        });
        
        return risks;
    },
    
    detectExpirySoon: function(purchases, materials) {
        const risks = [];
        
        const today = new Date();
        
        purchases.forEach(p => {
            if (!p.expiryDate) return;
            
            const daysUntilExpiry = Utils.calculateDaysUntilExpiry(p.expiryDate);
            
            if (daysUntilExpiry === null || daysUntilExpiry > 90) return;
            
            const material = materials.find(m => 
                m.id === p.materialId || 
                m.name === p.materialName
            );
            
            const isAdhesive = material?.isAdhesive || p.materialName?.includes('胶水');
            const isAccessory = material?.isAccessory || false;
            
            if (isAdhesive || isAccessory) {
                let level = this.RISK_LEVELS.LOW;
                if (daysUntilExpiry <= 30) {
                    level = this.RISK_LEVELS.HIGH;
                } else if (daysUntilExpiry <= 60) {
                    level = this.RISK_LEVELS.MEDIUM;
                }
                
                risks.push({
                    id: 'risk_expiry_' + p.id,
                    type: this.RISK_TYPES.EXPIRY_SOON,
                    level: level,
                    title: `材料即将过期`,
                    purchaseId: p.id,
                    materialId: p.materialId,
                    materialName: p.materialName,
                    purchase: p,
                    summary: `${p.materialName} (批次 ${p.batchNo || '未知'}) 将在 ${daysUntilExpiry} 天后过期`,
                    details: {
                        batchNo: p.batchNo,
                        quantity: p.quantity,
                        unit: p.unit,
                        purchaseDate: p.purchaseDate,
                        expiryDate: p.expiryDate,
                        daysUntilExpiry: daysUntilExpiry,
                        isAdhesive: isAdhesive,
                        isAccessory: isAccessory
                    },
                    calculation: {
                        steps: [
                            { label: '采购日期', value: Utils.formatDate(p.purchaseDate), detail: '实际采购日期' },
                            { label: '到期日期', value: Utils.formatDate(p.expiryDate), detail: '保质期截止日期' },
                            { label: '剩余天数', value: `${daysUntilExpiry} 天`, detail: `到期日 - 今天 = ${daysUntilExpiry} 天` },
                            { label: '风险等级', value: this.getLevelText(level), detail: daysUntilExpiry <= 30 ? '紧急处理' : daysUntilExpiry <= 60 ? '近期处理' : '关注即可' }
                        ]
                    }
                });
            }
        });
        
        return risks;
    },
    
    detectCriticalShortage: function(calculatedData) {
        const risks = [];
        
        calculatedData.materialSummary.forEach(ms => {
            if (ms.shortage <= 0) return;
            
            const shortagePercentage = ms.totalRequired > 0 
                ? (ms.shortage / ms.totalRequired) * 100 
                : 0;
            
            if (shortagePercentage > 10) {
                risks.push({
                    id: 'risk_critical_shortage_' + ms.materialId,
                    type: this.RISK_TYPES.CRITICAL_SHORTAGE,
                    level: shortagePercentage > 20 ? this.RISK_LEVELS.HIGH : this.RISK_LEVELS.MEDIUM,
                    title: `材料严重短缺`,
                    materialId: ms.materialId,
                    materialName: ms.materialName,
                    materialSummary: ms,
                    summary: `${ms.materialName} 短缺 ${ms.shortage} ${ms.unit}，占需求量 ${Utils.formatNumber(shortagePercentage)}%`,
                    details: {
                        totalRequired: ms.totalRequired,
                        totalPurchased: ms.totalPurchased,
                        shortage: ms.shortage,
                        shortagePercentage: shortagePercentage,
                        unit: ms.unit,
                        affectedRooms: ms.roomMaterials.map(rm => rm.roomName)
                    },
                    calculation: {
                        steps: [
                            { label: '总需求量', value: `${Utils.formatNumber(ms.totalRequired)} ${ms.unit}`, detail: '所有房间需求量之和' },
                            { label: '已采购量', value: `${Utils.formatNumber(ms.totalPurchased)} ${ms.unit}`, detail: '所有采购批次数量之和' },
                            { label: '短缺量', value: `${Utils.formatNumber(ms.shortage)} ${ms.unit}`, detail: `需求 - 已采购 = ${ms.totalRequired} - ${ms.totalPurchased}` },
                            { label: '短缺比例', value: `${Utils.formatNumber(shortagePercentage)}%`, detail: `(${ms.shortage} ÷ ${ms.totalRequired}) × 100%` }
                        ]
                    }
                });
            }
        });
        
        return risks;
    },
    
    buildShortageCalculationSteps: function(rm, areaIncrease) {
        const steps = [];
        
        steps.push({
            label: '原始面积',
            value: `${Utils.formatNumber(rm.originalArea)} ㎡`,
            detail: '变更前的房间面积'
        });
        
        steps.push({
            label: '当前面积',
            value: `${Utils.formatNumber(rm.area)} ㎡`,
            detail: '变更后的实际面积'
        });
        
        steps.push({
            label: '面积增加',
            value: `+${Utils.formatNumber(areaIncrease)} ㎡`,
            detail: `当前 - 原始 = ${rm.area} - ${rm.originalArea}`
        });
        
        steps.push({
            label: '变更后需求量',
            value: `${Utils.formatNumber(rm.totalRequired)} ${rm.unit}`,
            detail: rm.calculationDetails?.steps?.[rm.calculationDetails.steps.length - 1]?.detail || '根据新面积计算'
        });
        
        steps.push({
            label: '已采购量',
            value: `${Utils.formatNumber(rm.totalPurchased)} ${rm.unit}`,
            detail: '实际采购的数量'
        });
        
        steps.push({
            label: '短缺量',
            value: `${Utils.formatNumber(rm.shortage)} ${rm.unit}`,
            detail: `需求 - 已采购 = ${rm.totalRequired} - ${rm.totalPurchased}`
        });
        
        return steps;
    },
    
    getLevelText: function(level) {
        const texts = {
            high: '高风险',
            medium: '中风险',
            low: '低风险'
        };
        return texts[level] || level;
    },
    
    getTypeText: function(type) {
        const texts = {
            mixed_batches: '批次/色号混用',
            shortage_after_change: '改尺后短缺',
            excess_purchase: '采购过剩',
            expiry_soon: '即将过期',
            critical_shortage: '严重短缺'
        };
        return texts[type] || type;
    },
    
    getTypeIcon: function(type) {
        const icons = {
            mixed_batches: '🎨',
            shortage_after_change: '📐',
            excess_purchase: '📦',
            expiry_soon: '⏰',
            critical_shortage: '❌'
        };
        return icons[type] || '⚠️';
    }
};

window.RiskDetector = RiskDetector;
