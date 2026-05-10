class Exporter {
    constructor() {
        this.formatTime = this.formatTime.bind(this);
    }

    exportToCSV(results, analysis, report) {
        const csvLines = [];
        csvLines.push('港口拖车排队仿真器 - 仿真结果报告');
        csvLines.push('生成时间,' + new Date().toLocaleString('zh-CN'));
        csvLines.push('');
        
        csvLines.push('一、运行概况');
        csvLines.push('指标,数值');
        csvLines.push('仿真时长,' + this.formatTime(results.totalSimulationTime));
        csvLines.push('总到达车辆,' + results.totalGenerated + ' 辆');
        csvLines.push('已处理车辆,' + results.totalProcessed + ' 辆');
        csvLines.push('排队中车辆,' + results.remainingQueue + ' 辆');
        csvLines.push('溢出车辆,' + results.overflowCount + ' 辆');
        csvLines.push('溢出率,' + results.overflowRate.toFixed(2) + '%');
        csvLines.push('');
        
        csvLines.push('二、时间效率分析');
        csvLines.push('指标,数值');
        csvLines.push('平均等待时间,' + results.averageWaitTime.toFixed(2) + ' 分钟');
        csvLines.push('最大等待时间,' + results.maxWaitTime.toFixed(2) + ' 分钟');
        csvLines.push('高峰时段平均等待,' + results.peakAverageWaitTime.toFixed(2) + ' 分钟');
        csvLines.push('平峰时段平均等待,' + results.offPeakAverageWaitTime.toFixed(2) + ' 分钟');
        csvLines.push('');
        
        csvLines.push('三、闸口利用率');
        csvLines.push('指标,数值');
        csvLines.push('平均利用率,' + results.averageGateUtilization.toFixed(2) + '%');
        csvLines.push('高峰时段平均闸口数,' + results.peakAverageGates + ' 个');
        csvLines.push('平峰时段平均闸口数,' + results.offPeakAverageGates + ' 个');
        csvLines.push('策略调整次数,' + results.strategyChangeCount + ' 次');
        csvLines.push('');
        
        csvLines.push('四、评估结果');
        csvLines.push('整体运行状态,' + (analysis.overallStatus === 'pass' ? '正常' : '异常'));
        
        if (analysis.issues.length > 0) {
            csvLines.push('');
            csvLines.push('问题列表');
            csvLines.push('类型,严重程度,描述,建议');
            analysis.issues.forEach(issue => {
                csvLines.push(`${issue.type},${issue.severity},${issue.message},${issue.recommendation}`);
            });
        }
        
        if (analysis.warnings.length > 0) {
            csvLines.push('');
            csvLines.push('警告列表');
            csvLines.push('类型,描述,建议');
            analysis.warnings.forEach(warning => {
                csvLines.push(`${warning.type},${warning.message},${warning.recommendation}`);
            });
        }
        
        csvLines.push('');
        csvLines.push('五、处理建议');
        analysis.recommendations.forEach((rec, index) => {
            csvLines.push(`${index + 1}. ${rec}`);
        });
        
        csvLines.push('');
        csvLines.push('六、车辆处理详情');
        csvLines.push('车辆ID,到达时间,开始处理时间,完成时间,等待时间,处理时间,闸口ID,状态');
        results.processedVehicles.forEach(vehicle => {
            const v = vehicle.toJSON();
            csvLines.push([
                v.id,
                this.formatTime(v.arrivalTime),
                v.processingStartTime ? this.formatTime(v.processingStartTime) : '-',
                v.processingEndTime ? this.formatTime(v.processingEndTime) : '-',
                v.waitTime.toFixed(2) + ' 分钟',
                v.processingTime.toFixed(2) + ' 分钟',
                v.gateId || '-',
                v.status
            ].join(','));
        });
        
        return csvLines.join('\n');
    }

    exportToJSON(results, analysis, report) {
        return JSON.stringify({
            generatedAt: new Date().toISOString(),
            results: this.serializeResults(results),
            analysis: analysis,
            report: report
        }, null, 2);
    }

    exportToText(results, analysis, report) {
        const lines = [];
        lines.push('========================================');
        lines.push('    港口拖车排队仿真器 - 仿真结果报告');
        lines.push('========================================');
        lines.push('');
        lines.push('生成时间：' + new Date().toLocaleString('zh-CN'));
        lines.push('');
        
        report.forEach(section => {
            lines.push(section.title);
            lines.push('-'.repeat(40));
            section.items.forEach(item => {
                lines.push('  ' + item);
            });
            lines.push('');
        });
        
        if (analysis.issues.length > 0) {
            lines.push('========================================');
            lines.push('              问题详情');
            lines.push('========================================');
            lines.push('');
            analysis.issues.forEach((issue, index) => {
                lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`);
                lines.push(`   问题：${issue.message}`);
                lines.push(`   建议：${issue.recommendation}`);
                lines.push('');
            });
        }
        
        if (analysis.warnings.length > 0) {
            lines.push('========================================');
            lines.push('              警告详情');
            lines.push('========================================');
            lines.push('');
            analysis.warnings.forEach((warning, index) => {
                lines.push(`${index + 1}. ${warning.type}`);
                lines.push(`   描述：${warning.message}`);
                lines.push(`   建议：${warning.recommendation}`);
                lines.push('');
            });
        }
        
        lines.push('========================================');
        lines.push('              汇总');
        lines.push('========================================');
        lines.push('');
        lines.push('验收结果：' + (analysis.overallStatus === 'pass' ? '通过 ✅' : '需要人工处理 ⚠️'));
        lines.push('');
        
        if (analysis.overallStatus === 'pass') {
            lines.push('系统运行良好，各项指标在正常范围内。');
            lines.push('可以继续使用当前配置进行生产运营。');
        } else {
            lines.push('存在需要处理的问题，请参考上述建议进行调整。');
            lines.push('调整后建议重新运行仿真验证效果。');
        }
        
        return lines.join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    export(results, analysis, report, format = 'text') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        let content, filename, mimeType;
        
        switch (format) {
            case 'csv':
                content = this.exportToCSV(results, analysis, report);
                filename = `仿真报告_${timestamp}.csv`;
                mimeType = 'text/csv;charset=utf-8';
                break;
            case 'json':
                content = this.exportToJSON(results, analysis, report);
                filename = `仿真报告_${timestamp}.json`;
                mimeType = 'application/json;charset=utf-8';
                break;
            case 'text':
            default:
                content = this.exportToText(results, analysis, report);
                filename = `仿真报告_${timestamp}.txt`;
                mimeType = 'text/plain;charset=utf-8';
        }
        
        this.downloadFile(content, filename, mimeType);
    }

    serializeResults(results) {
        return {
            totalSimulationTime: results.totalSimulationTime,
            totalGenerated: results.totalGenerated,
            totalProcessed: results.totalProcessed,
            remainingQueue: results.remainingQueue,
            overflowCount: results.overflowCount,
            overflowRate: results.overflowRate,
            queueUtilization: results.queueUtilization,
            maxQueueLength: results.maxQueueLength,
            averageWaitTime: results.averageWaitTime,
            maxWaitTime: results.maxWaitTime,
            peakAverageWaitTime: results.peakAverageWaitTime,
            offPeakAverageWaitTime: results.offPeakAverageWaitTime,
            averageGateUtilization: results.averageGateUtilization,
            peakAverageGates: results.peakAverageGates,
            offPeakAverageGates: results.offPeakAverageGates,
            strategyChangeCount: results.strategyChangeCount,
            processedVehicles: results.processedVehicles.map(v => v.toJSON()),
            eventLog: results.eventLog,
            strategyHistory: results.strategyHistory,
            gateStatus: results.gateStatus,
            queueStatus: results.queueStatus
        };
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.floor((minutes % 1) * 60);
        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Exporter };
}
