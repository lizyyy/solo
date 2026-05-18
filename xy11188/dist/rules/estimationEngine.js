"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EstimationEngine = void 0;
const defaultConfig_1 = require("./defaultConfig");
class EstimationEngine {
    constructor(config = defaultConfig_1.defaultEstimationConfig) {
        this.config = config;
    }
    calculateItemVolume(item) {
        return (item.width * item.height * item.depth * item.quantity) / 1000000000;
    }
    calculateItemWeight(item) {
        return item.weight * item.quantity;
    }
    applySpecialCases(item, volume, weight, hasElevator, floors) {
        let adjustedVolume = volume;
        let adjustedWeight = weight;
        const specialCases = [];
        const notes = [];
        if (item.isNonDisassemblable) {
            const multiplier = this.config.specialCaseRules.nonDisassemblableMultiplier;
            adjustedVolume *= multiplier;
            specialCases.push({
                itemId: item.id,
                itemName: item.name,
                caseType: 'nonDisassemblable',
                description: `大件不可拆解，体积乘以 ${multiplier} 系数`,
                impact: `体积从 ${volume.toFixed(3)}m³ 增加至 ${adjustedVolume.toFixed(3)}m³`
            });
            notes.push(`大件不可拆，体积调整系数 ${multiplier}`);
        }
        if (!hasElevator && floors > 1) {
            const penalty = this.config.specialCaseRules.noElevatorFloorPenalty;
            adjustedWeight *= (1 + penalty * floors);
            specialCases.push({
                itemId: item.id,
                itemName: item.name,
                caseType: 'noElevator',
                description: `无电梯，${floors} 层楼，每层增加 ${penalty * 100}% 搬运成本`,
                impact: `重量成本调整系数: ${(1 + penalty * floors).toFixed(2)}`
            });
            notes.push(`无电梯 ${floors} 层，重量调整系数 ${(1 + penalty * floors).toFixed(2)}`);
        }
        return { adjustedVolume, adjustedWeight, specialCases, notes };
    }
    estimate(parsedItems, hasElevator = true, floors = 1) {
        const estimationDetails = [];
        const allSpecialCases = [];
        let totalVolume = 0;
        let totalWeight = 0;
        let totalAdjustedVolume = 0;
        let totalAdjustedWeight = 0;
        for (const parsedItem of parsedItems) {
            if (!parsedItem.data)
                continue;
            const item = parsedItem.data;
            const volume = this.calculateItemVolume(item);
            const weight = this.calculateItemWeight(item);
            const { adjustedVolume, adjustedWeight, specialCases, notes } = this.applySpecialCases(item, volume, weight, hasElevator, floors);
            totalVolume += volume;
            totalWeight += weight;
            totalAdjustedVolume += adjustedVolume;
            totalAdjustedWeight += adjustedWeight;
            allSpecialCases.push(...specialCases);
            estimationDetails.push({
                itemName: item.name,
                lineNumber: parsedItem.lineNumber,
                fileName: parsedItem.fileName,
                volume,
                weight,
                adjustedVolume,
                adjustedWeight,
                notes
            });
        }
        const finalVolume = totalAdjustedVolume * this.config.volumeRules.stackingAllowance * this.config.volumeRules.paddingFactor;
        const finalWeight = totalAdjustedWeight * this.config.weightRules.weightDistributionFactor;
        const recommendedTrucks = this.recommendTrucks(finalVolume, finalWeight);
        return {
            orderId: 'EST-' + Date.now(),
            totalVolume,
            totalWeight,
            adjustedVolume: finalVolume,
            adjustedWeight: finalWeight,
            recommendedTrucks,
            specialCases: allSpecialCases,
            estimationDetails
        };
    }
    recommendTrucks(volume, weight) {
        const recommendations = [];
        for (const truck of this.config.truckTypes) {
            const neededByVolume = Math.ceil(volume / truck.maxVolume);
            const neededByWeight = Math.ceil(weight / truck.maxWeight);
            const quantity = Math.max(neededByVolume, neededByWeight);
            if (quantity > 0) {
                recommendations.push({
                    truckType: truck,
                    quantity,
                    totalCost: quantity * truck.baseCost
                });
            }
        }
        return recommendations.sort((a, b) => a.totalCost - b.totalCost);
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.EstimationEngine = EstimationEngine;
