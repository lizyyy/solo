class StrategyManager {
    constructor(config = {}) {
        this.peakStrategy = config.peakStrategy || 'fixed';
        this.offPeakStrategy = config.offPeakStrategy || 'fixed';
        this.peakGates = config.peakGates || 5;
        this.offPeakGates = config.offPeakGates || 2;
        this.peakStartTime = config.peakStartTime || 6;
        this.peakEndTime = config.peakEndTime || 18;
        this.elasticThresholdHigh = config.elasticThresholdHigh || 70;
        this.elasticThresholdLow = config.elasticThresholdLow || 30;
        this.currentGates = this.offPeakGates;
        this.strategyChangeHistory = [];
    }

    setConfig(config) {
        if (config.peakStrategy !== undefined) this.peakStrategy = config.peakStrategy;
        if (config.offPeakStrategy !== undefined) this.offPeakStrategy = config.offPeakStrategy;
        if (config.peakGates !== undefined) this.peakGates = config.peakGates;
        if (config.offPeakGates !== undefined) this.offPeakGates = config.offPeakGates;
        if (config.peakStartTime !== undefined) this.peakStartTime = config.peakStartTime;
        if (config.peakEndTime !== undefined) this.peakEndTime = config.peakEndTime;
        if (config.elasticThresholdHigh !== undefined) this.elasticThresholdHigh = config.elasticThresholdHigh;
        if (config.elasticThresholdLow !== undefined) this.elasticThresholdLow = config.elasticThresholdLow;
    }

    isPeakTime(currentHour) {
        return currentHour >= this.peakStartTime && currentHour < this.peakEndTime;
    }

    getCurrentStrategy(currentHour) {
        return this.isPeakTime(currentHour) ? this.peakStrategy : this.offPeakStrategy;
    }

    getBaseGatesCount(currentHour) {
        return this.isPeakTime(currentHour) ? this.peakGates : this.offPeakGates;
    }

    calculateGatesCount(currentTime, queueSize, maxQueueSize, currentGates, totalGates) {
        const currentHour = currentTime / 60;
        const strategy = this.getCurrentStrategy(currentHour);
        const baseGates = this.getBaseGatesCount(currentHour);
        let newGatesCount = baseGates;

        if (strategy === 'elastic') {
            const queueUtilization = maxQueueSize > 0 ? (queueSize / maxQueueSize) * 100 : 0;
            
            if (queueUtilization > this.elasticThresholdHigh) {
                newGatesCount = Math.min(currentGates + 1, totalGates);
            } else if (queueUtilization < this.elasticThresholdLow) {
                newGatesCount = Math.max(currentGates - 1, baseGates);
            } else {
                newGatesCount = currentGates;
            }
        }

        if (newGatesCount !== this.currentGates) {
            this.strategyChangeHistory.push({
                time: currentTime,
                hour: currentHour,
                isPeak: this.isPeakTime(currentHour),
                strategy: strategy,
                oldGates: this.currentGates,
                newGates: newGatesCount,
                queueSize: queueSize,
                queueUtilization: maxQueueSize > 0 ? (queueSize / maxQueueSize) * 100 : 0
            });
            this.currentGates = newGatesCount;
        }

        return newGatesCount;
    }

    getStrategyInfo(currentTime) {
        const currentHour = currentTime / 60;
        return {
            isPeak: this.isPeakTime(currentHour),
            strategy: this.getCurrentStrategy(currentHour),
            baseGates: this.getBaseGatesCount(currentHour),
            currentGates: this.currentGates,
            peakStartTime: this.peakStartTime,
            peakEndTime: this.peakEndTime
        };
    }

    getChangeHistory() {
        return [...this.strategyChangeHistory];
    }

    reset() {
        this.currentGates = this.offPeakGates;
        this.strategyChangeHistory = [];
    }

    toJSON() {
        return {
            peakStrategy: this.peakStrategy,
            offPeakStrategy: this.offPeakStrategy,
            peakGates: this.peakGates,
            offPeakGates: this.offPeakGates,
            peakStartTime: this.peakStartTime,
            peakEndTime: this.peakEndTime,
            currentGates: this.currentGates,
            changeHistory: this.strategyChangeHistory
        };
    }
}

class PerformanceAnalyzer {
    constructor() {
        this.thresholds = {
            maxOverflowRate: 5,
            maxAverageWaitTime: 30,
            minGateUtilization: 50,
            maxGateUtilization: 90
        };
    }

    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    analyze(results) {
        const analysis = {
            overallStatus: 'pass',
            issues: [],
            warnings: [],
            recommendations: []
        };

        if (results.overflowRate > this.thresholds.maxOverflowRate) {
            analysis.overallStatus = 'fail';
            analysis.issues.push({
                type: 'overflow',
                severity: 'high',
                message: `车辆溢出率 ${results.overflowRate.toFixed(2)}% 超过阈值 ${this.thresholds.maxOverflowRate}%`,
                recommendation: '建议增加闸口数量或延长高峰时段'
            });
        } else if (results.overflowRate > 0) {
            analysis.warnings.push({
                type: 'overflow',
                message: `存在 ${results.overflowCount} 辆车辆溢出`,
                recommendation: '建议优化调度策略'
            });
        }

        if (results.averageWaitTime > this.thresholds.maxAverageWaitTime) {
            analysis.overallStatus = 'fail';
            analysis.issues.push({
                type: 'wait_time',
                severity: 'high',
                message: `平均等待时间 ${results.averageWaitTime.toFixed(2)} 分钟超过阈值 ${this.thresholds.maxAverageWaitTime} 分钟`,
                recommendation: '建议增加闸口或加快处理速度'
            });
        }

        if (results.peakAverageWaitTime > this.thresholds.maxAverageWaitTime) {
            analysis.warnings.push({
                type: 'peak_wait',
                message: `高峰时段平均等待时间较长：${results.peakAverageWaitTime.toFixed(2)} 分钟`,
                recommendation: '建议在高峰时段增加闸口配置'
            });
        }

        if (results.averageGateUtilization > this.thresholds.maxGateUtilization) {
            analysis.warnings.push({
                type: 'high_utilization',
                message: `闸口平均利用率 ${results.averageGateUtilization.toFixed(2)}% 较高`,
                recommendation: '建议增加备用闸口'
            });
        } else if (results.averageGateUtilization < this.thresholds.minGateUtilization) {
            analysis.warnings.push({
                type: 'low_utilization',
                message: `闸口平均利用率 ${results.averageGateUtilization.toFixed(2)}% 较低`,
                recommendation: '建议减少闲置闸口或采用弹性调度'
            });
        }

        if (analysis.issues.length > 0) {
            analysis.recommendations.push('存在严重问题，需要人工处理并调整策略');
        } else if (analysis.warnings.length > 0) {
            analysis.recommendations.push('存在潜在问题，建议优化现有配置');
        } else {
            analysis.recommendations.push('系统运行良好，可以保持当前配置');
        }

        return analysis;
    }

    generateBusinessReport(results, analysis) {
        const report = [];
        report.push({
            title: '一、运行概况',
            items: [
                `仿真时长：${this.formatTime(results.totalSimulationTime)}`,
                `总到达车辆：${results.totalGenerated} 辆`,
                `已处理车辆：${results.totalProcessed} 辆`,
                `排队中车辆：${results.remainingQueue} 辆`,
                `溢出车辆：${results.overflowCount} 辆`
            ]
        });
        report.push({
            title: '二、时间效率分析',
            items: [
                `平均等待时间：${results.averageWaitTime.toFixed(2)} 分钟`,
                `最大等待时间：${results.maxWaitTime.toFixed(2)} 分钟`,
                `高峰时段平均等待：${results.peakAverageWaitTime.toFixed(2)} 分钟`,
                `平峰时段平均等待：${results.offPeakAverageWaitTime.toFixed(2)} 分钟`
            ]
        });
        report.push({
            title: '三、闸口利用率',
            items: [
                `平均利用率：${results.averageGateUtilization.toFixed(2)}%`,
                `高峰时段平均闸口数：${results.peakAverageGates} 个`,
                `平峰时段平均闸口数：${results.offPeakAverageGates} 个`,
                `策略调整次数：${results.strategyChangeCount} 次`
            ]
        });
        report.push({
            title: '四、评估结果',
            items: analysis.overallStatus === 'pass' 
                ? ['整体运行状态：正常', '符合验收标准，可投入使用']
                : ['整体运行状态：异常', '存在需要人工处理的问题']
        });
        report.push({
            title: '五、处理建议',
            items: analysis.recommendations
        });
        return report;
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        if (hours > 0) {
            return `${hours} 小时 ${mins} 分钟`;
        }
        return `${mins} 分钟`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StrategyManager, PerformanceAnalyzer };
}
