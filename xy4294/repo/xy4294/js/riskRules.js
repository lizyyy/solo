/**
 * 风险规则模块
 * 负责检测各种风险：温度异常、漏检区域、临期货品
 */

const RiskRules = (function() {
    'use strict';

    /**
     * 风险等级定义
     */
    const RISK_LEVELS = {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low',
        NONE: 'none'
    };

    /**
     * 风险类型定义
     */
    const RISK_TYPES = {
        TEMPERATURE: 'temperature',
        MISSED_AREA: 'missed',
        EXPIRING: 'expiring'
    };

    /**
     * 默认配置
     */
    const DEFAULT_CONFIG = {
        temperature: {
            idealRange: { min: -18, max: -15 },
            warningRange: { min: -15, max: -12 },
            dangerRange: { min: -12, max: 0 },
            coldRange: { min: -30, max: -18 },
            consecutiveHighThreshold: 3,
            highDurationHours: 2
        },
        inspection: {
            missedThresholdDistance: 5,
            missedThresholdTime: 3600000,
            expectedCoveragePercentage: 90
        },
        expiry: {
            highPriorityDays: 1,
            mediumPriorityDays: 3,
            blockedMultiplier: 2
        }
    };

    let config = { ...DEFAULT_CONFIG };

    /**
     * 配置风险规则
     * @param {Object} newConfig - 新的配置
     */
    function configure(newConfig) {
        config = { ...DEFAULT_CONFIG, ...newConfig };
    }

    /**
     * 检测温度风险
     * @param {Object} temperatureData - 温度数据（来自DataParser）
     * @param {Object} rackData - 货架数据
     * @returns {Object} 温度风险检测结果
     */
    function detectTemperatureRisks(temperatureData, rackData) {
        const risks = [];
        const summary = {
            totalSlots: 0,
            normalSlots: 0,
            highTempSlots: 0,
            warningTempSlots: 0,
            coldTempSlots: 0,
            consecutiveHighSlots: 0,
            avgTemperature: null
        };

        if (!temperatureData || !temperatureData.tempMap || temperatureData.tempMap.size === 0) {
            return { risks: [], summary };
        }

        const allTemperatures = [];
        
        temperatureData.tempMap.forEach((records, slotKey) => {
            summary.totalSlots++;
            
            if (records.length === 0) return;

            const latestRecord = records[records.length - 1];
            const currentTemp = latestRecord.temperature;
            allTemperatures.push(currentTemp);

            const risk = evaluateTemperatureRisk(records, slotKey, latestRecord);
            
            if (risk) {
                risks.push(risk);
                
                switch (risk.level) {
                    case RISK_LEVELS.HIGH:
                        summary.highTempSlots++;
                        break;
                    case RISK_LEVELS.MEDIUM:
                        summary.warningTempSlots++;
                        break;
                    case RISK_LEVELS.LOW:
                        summary.coldTempSlots++;
                        break;
                }

                if (risk.consecutiveHigh) {
                    summary.consecutiveHighSlots++;
                }
            } else {
                summary.normalSlots++;
            }
        });

        if (allTemperatures.length > 0) {
            summary.avgTemperature = allTemperatures.reduce((a, b) => a + b, 0) / allTemperatures.length;
        }

        return {
            risks: risks,
            summary: summary,
            getSlotRisk: (slotKey) => risks.find(r => r.slotKey === slotKey)
        };
    }

    /**
     * 评估单个货位的温度风险
     */
    function evaluateTemperatureRisk(records, slotKey, latestRecord) {
        const currentTemp = latestRecord.temperature;
        const tempConfig = config.temperature;
        
        let risk = {
            slotKey: slotKey,
            type: RISK_TYPES.TEMPERATURE,
            temperature: currentTemp,
            latestRecord: latestRecord,
            history: records.slice(-10),
            level: RISK_LEVELS.NONE,
            description: '',
            consecutiveHigh: false,
            durationHigh: 0
        };

        if (currentTemp > tempConfig.dangerRange.min) {
            risk.level = RISK_LEVELS.HIGH;
            risk.description = `严重高温告警：当前温度 ${currentTemp.toFixed(1)}°C，远超安全范围`;
        } else if (currentTemp > tempConfig.warningRange.min) {
            risk.level = RISK_LEVELS.MEDIUM;
            risk.description = `温度偏高：当前温度 ${currentTemp.toFixed(1)}°C，接近警戒值`;
        } else if (currentTemp < tempConfig.coldRange.max) {
            risk.level = RISK_LEVELS.LOW;
            risk.description = `温度偏低：当前温度 ${currentTemp.toFixed(1)}°C`;
        } else {
            return null;
        }

        if (records.length >= tempConfig.consecutiveHighThreshold) {
            const recentRecords = records.slice(-tempConfig.consecutiveHighThreshold);
            const allHigh = recentRecords.every(r => r.temperature > tempConfig.warningRange.min);
            
            if (allHigh) {
                risk.consecutiveHigh = true;
                risk.level = RISK_LEVELS.HIGH;
                risk.description = `连续${tempConfig.consecutiveHighThreshold}次记录高温，需立即处理！当前温度 ${currentTemp.toFixed(1)}°C`;
            }
        }

        return risk;
    }

    /**
     * 检测漏检区域
     * @param {Object} trajectoryData - 叉车轨迹数据
     * @param {Object} rackData - 货架数据
     * @returns {Object} 漏检检测结果
     */
    function detectMissedAreas(trajectoryData, rackData) {
        const risks = [];
        const summary = {
            totalAreas: 0,
            inspectedAreas: 0,
            missedAreas: 0,
            partialCoverageAreas: 0,
            coveragePercentage: 0
        };

        if (!rackData || !rackData.racks || rackData.racks.length === 0) {
            return { risks: [], summary };
        }

        const inspectionConfig = config.inspection;
        const areas = new Map();

        rackData.racks.forEach(rack => {
            const areaName = rack.area || '默认区域';
            if (!areas.has(areaName)) {
                areas.set(areaName, {
                    name: areaName,
                    racks: [],
                    center: { x: 0, y: 0, z: 0 },
                    inspected: false,
                    coverageScore: 0
                });
            }
            areas.get(areaName).racks.push(rack);
        });

        areas.forEach((area, name) => {
            if (area.racks.length > 0) {
                area.center.x = area.racks.reduce((sum, r) => sum + r.position.x, 0) / area.racks.length;
                area.center.y = area.racks.reduce((sum, r) => sum + r.position.y, 0) / area.racks.length;
                area.center.z = area.racks.reduce((sum, r) => sum + r.position.z, 0) / area.racks.length;
            }
        });

        if (trajectoryData && trajectoryData.allPoints && trajectoryData.allPoints.length > 0) {
            areas.forEach((area, name) => {
                const coverage = calculateAreaCoverage(area, trajectoryData.allPoints, inspectionConfig);
                area.coverageScore = coverage;

                if (coverage >= 90) {
                    area.inspected = true;
                    summary.inspectedAreas++;
                } else if (coverage >= 50) {
                    summary.partialCoverageAreas++;
                    
                    risks.push({
                        areaName: name,
                        type: RISK_TYPES.MISSED_AREA,
                        level: RISK_LEVELS.MEDIUM,
                        coverageScore: coverage,
                        description: `区域 "${name}" 部分覆盖，覆盖率 ${coverage.toFixed(1)}%，可能存在漏检货位`,
                        racks: area.racks,
                        center: area.center
                    });
                } else {
                    summary.missedAreas++;
                    
                    risks.push({
                        areaName: name,
                        type: RISK_TYPES.MISSED_AREA,
                        level: RISK_LEVELS.HIGH,
                        coverageScore: coverage,
                        description: `区域 "${name}" 未巡检，覆盖率仅 ${coverage.toFixed(1)}%，需补检`,
                        racks: area.racks,
                        center: area.center
                    });
                }
            });
        } else {
            areas.forEach((area, name) => {
                summary.missedAreas++;
                risks.push({
                    areaName: name,
                    type: RISK_TYPES.MISSED_AREA,
                    level: RISK_LEVELS.HIGH,
                    coverageScore: 0,
                    description: `无巡检数据，区域 "${name}" 未覆盖`,
                    racks: area.racks,
                    center: area.center
                });
            });
        }

        summary.totalAreas = areas.size;
        if (summary.totalAreas > 0) {
            summary.coveragePercentage = (summary.inspectedAreas / summary.totalAreas) * 100;
        }

        return {
            risks: risks,
            summary: summary,
            areas: Object.fromEntries(areas)
        };
    }

    /**
     * 计算区域覆盖率
     */
    function calculateAreaCoverage(area, trajectoryPoints, inspectionConfig) {
        if (area.racks.length === 0) return 0;
        if (trajectoryPoints.length === 0) return 0;

        let coveredSlots = 0;
        let totalSlots = 0;

        area.racks.forEach(rack => {
            rack.slots.forEach(slot => {
                totalSlots++;
                
                const slotX = rack.position.x + (slot.position - 1) * (rack.dimensions.width / rack.slotsPerLevel);
                const slotY = rack.position.y + (slot.level - 1) * (rack.dimensions.height / rack.levels);
                const slotZ = rack.position.z;

                const isCovered = trajectoryPoints.some(point => {
                    const distance = Math.sqrt(
                        Math.pow((point.x ?? 0) - slotX, 2) +
                        Math.pow((point.z ?? 0) - slotZ, 2)
                    );
                    return distance < inspectionConfig.missedThresholdDistance;
                });

                if (isCovered) {
                    coveredSlots++;
                }
            });
        });

        return totalSlots > 0 ? (coveredSlots / totalSlots) * 100 : 0;
    }

    /**
     * 检测临期货品风险
     * @param {Object} expiringData - 临期货品数据
     * @returns {Object} 临期风险检测结果
     */
    function detectExpiringRisks(expiringData) {
        const risks = [];
        const summary = {
            totalProducts: 0,
            highPriority: 0,
            mediumPriority: 0,
            lowPriority: 0,
            blockedProducts: 0,
            blockedHighPriority: 0
        };

        if (!expiringData || !expiringData.products || expiringData.products.length === 0) {
            return { risks: [], summary };
        }

        const expiryConfig = config.expiry;

        expiringData.products.forEach(product => {
            summary.totalProducts++;

            const risk = {
                product: product,
                type: RISK_TYPES.EXPIRING,
                slotKey: product.slotId,
                level: RISK_LEVELS.NONE,
                description: '',
                isBlocked: product.isBlocked
            };

            const days = product.daysUntilExpiry;
            let baseLevel = RISK_LEVELS.LOW;

            if (days !== null && days !== undefined) {
                if (days <= expiryConfig.highPriorityDays) {
                    baseLevel = RISK_LEVELS.HIGH;
                } else if (days <= expiryConfig.mediumPriorityDays) {
                    baseLevel = RISK_LEVELS.MEDIUM;
                }
            } else if (product.priority) {
                switch (product.priority.toLowerCase()) {
                    case 'high':
                        baseLevel = RISK_LEVELS.HIGH;
                        break;
                    case 'medium':
                        baseLevel = RISK_LEVELS.MEDIUM;
                        break;
                    default:
                        baseLevel = RISK_LEVELS.LOW;
                }
            }

            if (product.isBlocked) {
                summary.blockedProducts++;
                risk.level = baseLevel === RISK_LEVELS.HIGH ? RISK_LEVELS.HIGH : 
                             baseLevel === RISK_LEVELS.MEDIUM ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM;
                
                if (baseLevel === RISK_LEVELS.HIGH) {
                    summary.blockedHighPriority++;
                    risk.description = `紧急：${product.name || product.sku || '货品'} ${days !== null ? `剩余${days}天` : ''}临期且被堵在深处，无法出库！`;
                } else {
                    risk.description = `注意：${product.name || product.sku || '货品'} ${days !== null ? `剩余${days}天` : ''}临期但被堵在深处`;
                }
            } else {
                risk.level = baseLevel;
                if (baseLevel === RISK_LEVELS.HIGH) {
                    summary.highPriority++;
                    risk.description = `紧急：${product.name || product.sku || '货品'} ${days !== null ? `剩余${days}天` : ''}即将到期，请立即处理`;
                } else if (baseLevel === RISK_LEVELS.MEDIUM) {
                    summary.mediumPriority++;
                    risk.description = `注意：${product.name || product.sku || '货品'} ${days !== null ? `剩余${days}天` : ''}即将临期`;
                } else {
                    summary.lowPriority++;
                    risk.description = `提示：${product.name || product.sku || '货品'} ${days !== null ? `剩余${days}天` : ''}临期，建议关注`;
                }
            }

            if (risk.level !== RISK_LEVELS.NONE) {
                risks.push(risk);
            }
        });

        return {
            risks: risks,
            summary: summary,
            getProductRisk: (productId) => risks.find(r => r.product.productId === productId || r.product.slotId === productId)
        };
    }

    /**
     * 综合所有风险检测
     * @param {Object} data - 所有数据
     * @returns {Object} 综合风险分析结果
     */
    function analyzeAllRisks(data) {
        const { racks, temperature, trajectory, expiring } = data;

        const tempResult = detectTemperatureRisks(temperature, racks);
        const missedResult = detectMissedAreas(trajectory, racks);
        const expiringResult = detectExpiringRisks(expiring);

        const allRisks = [
            ...tempResult.risks,
            ...missedResult.risks,
            ...expiringResult.risks
        ];

        allRisks.sort((a, b) => {
            const levelOrder = { high: 0, medium: 1, low: 2 };
            return levelOrder[a.level] - levelOrder[b.level];
        });

        const summary = {
            temperature: tempResult.summary,
            missed: missedResult.summary,
            expiring: expiringResult.summary,
            totalRisks: allRisks.length,
            highRiskCount: allRisks.filter(r => r.level === RISK_LEVELS.HIGH).length,
            mediumRiskCount: allRisks.filter(r => r.level === RISK_LEVELS.MEDIUM).length,
            lowRiskCount: allRisks.filter(r => r.level === RISK_LEVELS.LOW).length
        };

        return {
            allRisks: allRisks,
            temperature: tempResult,
            missed: missedResult,
            expiring: expiringResult,
            summary: summary,
            getRisksByType: (type) => allRisks.filter(r => r.type === type),
            getRisksByLevel: (level) => allRisks.filter(r => r.level === level),
            getRisksBySlot: (slotKey) => allRisks.filter(r => r.slotKey === slotKey || (r.areaName && slotKey.includes(r.areaName)))
        };
    }

    /**
     * 根据温度获取颜色
     * @param {number} temperature - 温度值
     * @returns {Object} 包含hex颜色和rgba颜色
     */
    function getTemperatureColor(temperature) {
        const tempConfig = config.temperature;
        
        let r, g, b;
        
        if (temperature > tempConfig.dangerRange.min) {
            r = 233; g = 69; b = 96;
        } else if (temperature > tempConfig.warningRange.min) {
            const t = (temperature - tempConfig.warningRange.min) / 
                     (tempConfig.dangerRange.min - tempConfig.warningRange.min);
            r = 255; g = Math.round(193 + (69 - 193) * t); b = Math.round(7 + (96 - 7) * t);
        } else if (temperature >= tempConfig.coldRange.max) {
            r = 25; g = 135; b = 84;
        } else {
            r = 13; g = 202; b = 240;
        }

        return {
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
            rgb: `rgb(${r}, ${g}, ${b})`,
            rgba: (alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`
        };
    }

    /**
     * 获取风险等级对应的颜色
     */
    function getRiskLevelColor(level) {
        switch (level) {
            case RISK_LEVELS.HIGH:
                return '#e94560';
            case RISK_LEVELS.MEDIUM:
                return '#ffc107';
            case RISK_LEVELS.LOW:
                return '#198754';
            default:
                return '#0f3460';
        }
    }

    /**
     * 获取风险等级描述
     */
    function getRiskLevelDescription(level) {
        switch (level) {
            case RISK_LEVELS.HIGH:
                return '高风险';
            case RISK_LEVELS.MEDIUM:
                return '中风险';
            case RISK_LEVELS.LOW:
                return '低风险';
            default:
                return '正常';
        }
    }

    /**
     * 获取风险类型描述
     */
    function getRiskTypeDescription(type) {
        switch (type) {
            case RISK_TYPES.TEMPERATURE:
                return '温度异常';
            case RISK_TYPES.MISSED_AREA:
                return '漏检区域';
            case RISK_TYPES.EXPIRING:
                return '临期货品';
            default:
                return '未知风险';
        }
    }

    return {
        RISK_LEVELS,
        RISK_TYPES,
        DEFAULT_CONFIG,
        
        configure,
        
        detectTemperatureRisks,
        detectMissedAreas,
        detectExpiringRisks,
        analyzeAllRisks,
        
        getTemperatureColor,
        getRiskLevelColor,
        getRiskLevelDescription,
        getRiskTypeDescription
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.RiskRules = RiskRules;
}
