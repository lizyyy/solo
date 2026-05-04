const RiskEngine = {
    analyzeAll(data) {
        const risks = [];
        
        risks.push(...this.checkOverload(data));
        risks.push(...this.checkUnbalance(data));
        risks.push(...this.checkSafetyRopes(data));
        risks.push(...this.checkConflicts(data));
        risks.push(...this.checkLoadCellDiscrepancies(data));
        
        return risks.sort((a, b) => {
            const levelOrder = { critical: 0, warning: 1, info: 2 };
            return levelOrder[a.level] - levelOrder[b.level];
        });
    },
    
    checkOverload(data) {
        const risks = [];
        const { hoists, equipment, trusses } = data;
        
        const hoistLoads = this.calculateHoistLoads(data);
        
        for (const hoist of hoists) {
            const load = hoistLoads[hoist.id] || 0;
            const loadRatio = load / hoist.ratedLoad;
            
            if (loadRatio >= APP_CONFIG.RISK_THRESHOLDS.OVERLOAD_RATIO_CRITICAL) {
                risks.push({
                    id: Utils.generateId('risk'),
                    type: 'overload',
                    level: 'critical',
                    title: `${hoist.name} 严重超载`,
                    description: `当前载荷 ${Utils.roundTo(load)} kg 超过额定载荷 ${hoist.ratedLoad} kg 的 ${Utils.roundTo((loadRatio - 1) * 100)}%`,
                    suggestion: '建议立即减少该吊点的设备数量，或重新分配载荷',
                    affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                    details: {
                        currentLoad: load,
                        ratedLoad: hoist.ratedLoad,
                        loadRatio: loadRatio,
                    },
                });
            } else if (loadRatio >= APP_CONFIG.RISK_THRESHOLDS.OVERLOAD_RATIO_WARNING) {
                risks.push({
                    id: Utils.generateId('risk'),
                    type: 'overload',
                    level: 'warning',
                    title: `${hoist.name} 接近额定载荷`,
                    description: `当前载荷 ${Utils.roundTo(load)} kg 已达到额定载荷 ${hoist.ratedLoad} kg 的 ${Utils.roundTo(loadRatio * 100)}%`,
                    suggestion: '建议注意载荷控制，预留安全余量',
                    affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                    details: {
                        currentLoad: load,
                        ratedLoad: hoist.ratedLoad,
                        loadRatio: loadRatio,
                    },
                });
            }
        }
        
        return risks;
    },
    
    checkUnbalance(data) {
        const risks = [];
        const { hoists, trusses } = data;
        
        if (hoists.length < 2) return risks;
        
        const hoistLoads = this.calculateHoistLoads(data);
        const loads = hoists.map(h => hoistLoads[h.id] || 0);
        const totalLoad = loads.reduce((sum, load) => sum + load, 0);
        
        if (totalLoad === 0) return risks;
        
        const averageLoad = totalLoad / hoists.length;
        
        for (let i = 0; i < hoists.length; i++) {
            const hoist = hoists[i];
            const load = loads[i];
            const deviation = Math.abs(load - averageLoad);
            const deviationPercent = (deviation / averageLoad) * 100;
            
            if (deviationPercent >= APP_CONFIG.RISK_THRESHOLDS.UNBALANCE_PERCENT_CRITICAL) {
                risks.push({
                    id: Utils.generateId('risk'),
                    type: 'unbalance',
                    level: 'critical',
                    title: `${hoist.name} 严重偏载`,
                    description: `载荷偏差 ${Utils.roundTo(deviationPercent)}%，远超平均值 ${Utils.roundTo(averageLoad)} kg`,
                    suggestion: '建议重新均匀分布设备，确保各吊点载荷均衡',
                    affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                    details: {
                        load: load,
                        averageLoad: averageLoad,
                        deviationPercent: deviationPercent,
                    },
                });
            } else if (deviationPercent >= APP_CONFIG.RISK_THRESHOLDS.UNBALANCE_PERCENT_WARNING) {
                risks.push({
                    id: Utils.generateId('risk'),
                    type: 'unbalance',
                    level: 'warning',
                    title: `${hoist.name} 载荷分布不均`,
                    description: `载荷偏差 ${Utils.roundTo(deviationPercent)}%，与平均值 ${Utils.roundTo(averageLoad)} kg 有一定差距`,
                    suggestion: '建议适当调整设备位置，改善载荷分布',
                    affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                    details: {
                        load: load,
                        averageLoad: averageLoad,
                        deviationPercent: deviationPercent,
                    },
                });
            }
        }
        
        return risks;
    },
    
    checkSafetyRopes(data) {
        const risks = [];
        const { hoists, equipment } = data;
        
        for (const hoist of hoists) {
            if (!hoist.hasSafetyRope) {
                const hoistLoads = this.calculateHoistLoads(data);
                const load = hoistLoads[hoist.id] || 0;
                
                if (load > 0) {
                    risks.push({
                        id: Utils.generateId('risk'),
                        type: 'safety-ropes',
                        level: 'critical',
                        title: `${hoist.name} 缺少安全绳`,
                        description: `该葫芦承载 ${Utils.roundTo(load)} kg 设备，但未配置安全绳`,
                        suggestion: '必须为承载设备的葫芦安装安全绳作为备份保护',
                        affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                        details: {
                            load: load,
                            hasSafetyRope: false,
                        },
                    });
                } else {
                    risks.push({
                        id: Utils.generateId('risk'),
                        type: 'safety-ropes',
                        level: 'info',
                        title: `${hoist.name} 未配置安全绳`,
                        description: `该葫芦当前无载荷，建议在正式使用前确认安全绳配置`,
                        suggestion: '虽然当前无载荷，但建议确保安全绳可用',
                        affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                        details: {
                            load: load,
                            hasSafetyRope: false,
                        },
                    });
                }
            }
        }
        
        for (const eq of equipment) {
            if (!eq.hasSafetyRope && eq.weight > 0) {
                risks.push({
                    id: Utils.generateId('risk'),
                    type: 'safety-ropes',
                    level: 'warning',
                    title: `${eq.name} 缺少独立安全绳`,
                    description: `该设备 ${eq.weight} kg，建议配置独立安全绳`,
                    suggestion: '建议为重要设备添加独立安全绳',
                    affectedObject: { type: 'equipment', id: eq.id, name: eq.name },
                    details: {
                        weight: eq.weight,
                        hasSafetyRope: false,
                    },
                });
            }
        }
        
        return risks;
    },
    
    checkConflicts(data) {
        const risks = [];
        const { hoists, trusses, equipment } = data;
        
        for (let i = 0; i < hoists.length; i++) {
            for (let j = i + 1; j < hoists.length; j++) {
                const h1 = hoists[i];
                const h2 = hoists[j];
                const distance = Utils.distance3D(h1.position, h2.position);
                
                if (distance < APP_CONFIG.RISK_THRESHOLDS.CONFLICT_DISTANCE_CRITICAL) {
                    risks.push({
                        id: Utils.generateId('risk'),
                        type: 'conflicts',
                        level: 'critical',
                        title: `${h1.name} 与 ${h2.name} 距离过近`,
                        description: `两葫芦间距仅 ${Utils.roundTo(distance)} 米，存在操作冲突风险`,
                        suggestion: '建议增加两吊点间距，至少保持 0.5 米以上',
                        affectedObject: { 
                            type: 'multiple', 
                            items: [
                                { type: 'hoist', id: h1.id, name: h1.name },
                                { type: 'hoist', id: h2.id, name: h2.name },
                            ]
                        },
                        details: {
                            distance: distance,
                            minSafeDistance: APP_CONFIG.RISK_THRESHOLDS.CONFLICT_DISTANCE_WARNING,
                        },
                    });
                } else if (distance < APP_CONFIG.RISK_THRESHOLDS.CONFLICT_DISTANCE_WARNING) {
                    risks.push({
                        id: Utils.generateId('risk'),
                        type: 'conflicts',
                        level: 'warning',
                        title: `${h1.name} 与 ${h2.name} 间距较近`,
                        description: `两葫芦间距 ${Utils.roundTo(distance)} 米，建议保持适当距离`,
                        suggestion: '如条件允许，建议增加间距至 1 米以上',
                        affectedObject: { 
                            type: 'multiple', 
                            items: [
                                { type: 'hoist', id: h1.id, name: h1.name },
                                { type: 'hoist', id: h2.id, name: h2.name },
                            ]
                        },
                        details: {
                            distance: distance,
                            recommendedDistance: APP_CONFIG.RISK_THRESHOLDS.CONFLICT_DISTANCE_WARNING,
                        },
                    });
                }
            }
        }
        
        const mountedEquipment = equipment.filter(eq => eq.mountedOn);
        for (let i = 0; i < mountedEquipment.length; i++) {
            for (let j = i + 1; j < mountedEquipment.length; j++) {
                const eq1 = mountedEquipment[i];
                const eq2 = mountedEquipment[j];
                const distance = Utils.distance3D(eq1.position, eq2.position);
                
                if (distance < 0.3) {
                    risks.push({
                        id: Utils.generateId('risk'),
                        type: 'conflicts',
                        level: 'warning',
                        title: `${eq1.name} 与 ${eq2.name} 可能干涉`,
                        description: `两设备间距仅 ${Utils.roundTo(distance)} 米，可能存在安装或操作干涉`,
                        suggestion: '建议调整设备位置，确保安装和操作空间',
                        affectedObject: { 
                            type: 'multiple', 
                            items: [
                                { type: 'equipment', id: eq1.id, name: eq1.name },
                                { type: 'equipment', id: eq2.id, name: eq2.name },
                            ]
                        },
                        details: {
                            distance: distance,
                        },
                    });
                }
            }
        }
        
        return risks;
    },
    
    checkLoadCellDiscrepancies(data) {
        const risks = [];
        const { hoists, loadCells } = data;
        
        if (loadCells.length === 0) return risks;
        
        const hoistLoads = this.calculateHoistLoads(data);
        
        for (const loadCell of loadCells) {
            if (loadCell.attachedToHoist) {
                const hoist = hoists.find(h => h.id === loadCell.attachedToHoist || h.name === loadCell.attachedToHoist);
                if (hoist) {
                    const calculatedLoad = hoistLoads[hoist.id] || 0;
                    const measuredLoad = loadCell.measuredLoad || 0;
                    
                    if (calculatedLoad > 0 && measuredLoad > 0) {
                        const discrepancy = Math.abs(calculatedLoad - measuredLoad);
                        const discrepancyPercent = (discrepancy / measuredLoad) * 100;
                        
                        if (discrepancyPercent > 20) {
                            risks.push({
                                id: Utils.generateId('risk'),
                                type: 'overload',
                                level: 'warning',
                                title: `${hoist.name} 载荷与读数差异大`,
                                description: `计算载荷 ${Utils.roundTo(calculatedLoad)} kg 与拉力计读数 ${measuredLoad} kg 相差 ${Utils.roundTo(discrepancyPercent)}%`,
                                suggestion: '建议检查设备摆放位置或拉力计读数是否准确',
                                affectedObject: { type: 'hoist', id: hoist.id, name: hoist.name },
                                details: {
                                    calculatedLoad: calculatedLoad,
                                    measuredLoad: measuredLoad,
                                    discrepancyPercent: discrepancyPercent,
                                },
                            });
                        }
                    }
                }
            }
        }
        
        return risks;
    },
    
    calculateHoistLoads(data) {
        const { hoists, trusses, equipment } = data;
        const loads = {};
        
        hoists.forEach(h => loads[h.id] = 0);
        
        for (const eq of equipment) {
            if (!eq.mountedOn) continue;
            
            const nearestHoist = this.findNearestHoist(eq.position, hoists);
            if (nearestHoist) {
                loads[nearestHoist.id] = (loads[nearestHoist.id] || 0) + eq.weight;
            }
        }
        
        for (const truss of trusses) {
            const trussWeight = truss.length * 10;
            
            for (const point of truss.points) {
                const attachedHoist = hoists.find(h => h.attachedTo === point.id || 
                    (h.position.x === point.position.x && h.position.z === point.position.z));
                
                if (attachedHoist) {
                    loads[attachedHoist.id] = (loads[attachedHoist.id] || 0) + trussWeight / truss.points.length;
                }
            }
        }
        
        return loads;
    },
    
    findNearestHoist(position, hoists) {
        if (hoists.length === 0) return null;
        
        let nearest = null;
        let minDistance = Infinity;
        
        for (const hoist of hoists) {
            const distance = Utils.distance2D(position, hoist.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = hoist;
            }
        }
        
        return nearest;
    },
    
    getRiskStats(risks) {
        const stats = {
            critical: 0,
            warning: 0,
            info: 0,
            total: risks.length,
        };
        
        for (const risk of risks) {
            if (risk.level === 'critical') stats.critical++;
            else if (risk.level === 'warning') stats.warning++;
            else stats.info++;
        }
        
        return stats;
    },
    
    filterRisksByType(risks, type) {
        if (type === 'all') return risks;
        return risks.filter(r => r.type === type);
    },
};
