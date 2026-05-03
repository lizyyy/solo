/**
 * 导出模块
 * 负责导出Markdown复盘报告和CSV风险清单
 */

import store from '../state/store.js';
import { RiskRules } from '../risk/rules.js';

export class ExportManager {
    constructor(options = {}) {
        this.options = {
            includeEvidence: options.includeEvidence !== false,
            includeStatistics: options.includeStatistics !== false,
            dateFormat: options.dateFormat || 'YYYY-MM-DD HH:mm:ss',
            ...options
        };
        
        this.riskRules = new RiskRules();
    }

    exportMarkdownReport(options = {}) {
        const reportOptions = {
            includeEvidence: options.includeEvidence !== undefined ? options.includeEvidence : this.options.includeEvidence,
            includeStatistics: options.includeStatistics !== undefined ? options.includeStatistics : this.options.includeStatistics,
            title: options.title || '仓库车辆轨迹安全复盘报告',
            filterVehicles: options.filterVehicles || null,
            filterSeverities: options.filterSeverities || null,
            timeRange: options.timeRange || null,
            ...options
        };

        const state = store.getState();
        const risks = this.getFilteredRisks(reportOptions);
        const mapData = state.mapData;
        const trajectoryData = state.trajectoryData;

        let markdown = '';

        markdown += this.generateReportHeader(reportOptions, state);
        markdown += '\n\n';

        if (reportOptions.includeStatistics) {
            markdown += this.generateStatisticsSection(risks, trajectoryData, mapData);
            markdown += '\n\n';
        }

        markdown += this.generateRiskSummarySection(risks);
        markdown += '\n\n';

        markdown += this.generateRiskDetailsSection(risks, reportOptions);
        markdown += '\n\n';

        if (mapData) {
            markdown += this.generateMapInfoSection(mapData);
            markdown += '\n\n';
        }

        markdown += this.generateTrajectorySummarySection(trajectoryData);
        markdown += '\n\n';

        if (state.invalidRows && state.invalidRows.length > 0) {
            markdown += this.generateInvalidDataSection(state.invalidRows);
            markdown += '\n\n';
        }

        markdown += this.generateReportFooter();

        return {
            content: markdown,
            fileName: this.generateReportFileName('report'),
            type: 'text/markdown'
        };
    }

    exportCSV(options = {}) {
        const csvOptions = {
            includeEvidence: options.includeEvidence !== undefined ? options.includeEvidence : this.options.includeEvidence,
            filterVehicles: options.filterVehicles || null,
            filterSeverities: options.filterSeverities || null,
            timeRange: options.timeRange || null,
            ...options
        };

        const risks = this.getFilteredRisks(csvOptions);

        let csv = '';
        const headers = [
            '风险ID',
            '风险类型',
            '时间戳',
            '严重程度',
            '涉及车辆',
            '位置',
            '描述',
            '详细信息'
        ];

        csv += headers.join(',') + '\n';

        const allRisks = [
            ...(risks.collisions || []),
            ...(risks.suddenStops || []),
            ...(risks.restrictedAreaApproaches || []),
            ...(risks.speeding || []),
            ...(risks.nearMisses || [])
        ];

        allRisks.sort((a, b) => a.timestamp - b.timestamp);

        allRisks.forEach(risk => {
            const row = [
                this.escapeCSV(risk.id),
                this.escapeCSV(this.getRiskTypeLabel(risk.type)),
                this.escapeCSV(this.formatTimestamp(risk.timestamp)),
                this.escapeCSV(this.getSeverityLabel(risk.severity)),
                this.escapeCSV(this.getVehiclesString(risk)),
                this.escapeCSV(this.getPositionString(risk)),
                this.escapeCSV(risk.description),
                this.escapeCSV(this.getRiskDetailsJSON(risk, csvOptions.includeEvidence))
            ];

            csv += row.join(',') + '\n';
        });

        return {
            content: csv,
            fileName: this.generateReportFileName('risks'),
            type: 'text/csv'
        };
    }

    download(data, fileName, type) {
        const blob = new Blob([data], { type: type || 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    downloadMarkdownReport(options = {}) {
        const result = this.exportMarkdownReport(options);
        this.download(result.content, result.fileName, result.type);
        return result;
    }

    downloadCSV(options = {}) {
        const result = this.exportCSV(options);
        this.download(result.content, result.fileName, result.type);
        return result;
    }

    generateReportHeader(options, state) {
        let header = `# ${options.title}\n\n`;
        header += `**生成时间**: ${this.formatTimestamp(Date.now())}\n\n`;
        
        if (options.timeRange) {
            header += `**分析时间范围**: ${this.formatTimestamp(options.timeRange.start)} 至 ${this.formatTimestamp(options.timeRange.end)}\n\n`;
        }

        if (options.filterVehicles && options.filterVehicles.length > 0) {
            header += `**筛选车辆**: ${options.filterVehicles.join(', ')}\n\n`;
        }

        if (options.filterSeverities && options.filterSeverities.length > 0) {
            header += `**筛选严重程度**: ${options.filterSeverities.map(s => this.getSeverityLabel(s)).join(', ')}\n\n`;
        }

        header += '---\n';

        return header;
    }

    generateStatisticsSection(risks, trajectoryData, mapData) {
        let section = '## 统计概览\n\n';

        section += '### 风险统计\n\n';
        
        const totalRisks = risks.statistics.totalRisks || 0;
        
        section += `| 指标 | 数值 |\n`;
        section += `|------|------|\n`;
        section += `| **总风险数** | ${totalRisks} |\n`;
        section += `| 高风险 | ${risks.statistics.bySeverity?.high || 0} |\n`;
        section += `| 中风险 | ${risks.statistics.bySeverity?.medium || 0} |\n`;
        section += `| 低风险 | ${risks.statistics.bySeverity?.low || 0} |\n\n`;

        section += '### 风险类型分布\n\n';
        
        const byType = risks.statistics.byType || {};
        const typeLabels = {
            collisions: '会车风险',
            suddenStops: '急停风险',
            restrictedAreaApproaches: '禁行区靠近',
            speeding: '超速风险',
            nearMisses: '险兆事件'
        };

        section += `| 风险类型 | 数量 |\n`;
        section += `|----------|------|\n`;
        
        Object.keys(byType).forEach(type => {
            if (byType[type] > 0) {
                section += `| ${typeLabels[type] || type} | ${byType[type]} |\n`;
            }
        });

        section += '\n';

        if (trajectoryData && trajectoryData.length > 0) {
            section += '### 轨迹数据统计\n\n';
            
            const vehicles = new Set(trajectoryData.map(p => p.vehicleId));
            const timeRange = this.getTimeRange(trajectoryData);
            
            section += `| 指标 | 数值 |\n`;
            section += `|------|------|\n`;
            section += `| 数据点数 | ${trajectoryData.length} |\n`;
            section += `| 车辆数量 | ${vehicles.size} |\n`;
            section += `| 时间范围 | ${this.formatTimestamp(timeRange.start)} 至 ${this.formatTimestamp(timeRange.end)} |\n\n`;
        }

        return section;
    }

    generateRiskSummarySection(risks) {
        let section = '## 风险摘要\n\n';

        const allRisks = [
            ...(risks.collisions || []).map(r => ({ ...r, displayType: 'collision' })),
            ...(risks.suddenStops || []).map(r => ({ ...r, displayType: 'suddenStop' })),
            ...(risks.restrictedAreaApproaches || []).map(r => ({ ...r, displayType: 'restrictedArea' })),
            ...(risks.speeding || []).map(r => ({ ...r, displayType: 'speeding' })),
            ...(risks.nearMisses || []).map(r => ({ ...r, displayType: 'nearMiss' }))
        ];

        if (allRisks.length === 0) {
            section += '> 未检测到风险事件\n\n';
            return section;
        }

        allRisks.sort((a, b) => a.timestamp - b.timestamp);

        const highRisks = allRisks.filter(r => r.severity === 'high');
        const mediumRisks = allRisks.filter(r => r.severity === 'medium');
        const lowRisks = allRisks.filter(r => r.severity === 'low');

        if (highRisks.length > 0) {
            section += '### 高风险事件\n\n';
            section += this.generateRiskList(highRisks);
            section += '\n';
        }

        if (mediumRisks.length > 0) {
            section += '### 中风险事件\n\n';
            section += this.generateRiskList(mediumRisks);
            section += '\n';
        }

        if (lowRisks.length > 0) {
            section += '### 低风险事件\n\n';
            section += this.generateRiskList(lowRisks);
            section += '\n';
        }

        return section;
    }

    generateRiskList(risks) {
        if (risks.length === 0) return '';

        let list = '';
        
        risks.forEach((risk, index) => {
            const time = this.formatTimestamp(risk.timestamp);
            const typeLabel = this.getRiskTypeLabel(risk.displayType || risk.type);
            const vehicles = this.getVehiclesString(risk);
            
            list += `${index + 1}. **${typeLabel}** - ${time}\n`;
            list += `   - 涉及车辆: ${vehicles}\n`;
            list += `   - 描述: ${risk.description}\n\n`;
        });

        return list;
    }

    generateRiskDetailsSection(risks, options) {
        let section = '## 风险详情\n\n';

        const allRisks = [
            ...(risks.collisions || []).map(r => ({ ...r, displayType: 'collision' })),
            ...(risks.suddenStops || []).map(r => ({ ...r, displayType: 'suddenStop' })),
            ...(risks.restrictedAreaApproaches || []).map(r => ({ ...r, displayType: 'restrictedArea' })),
            ...(risks.speeding || []).map(r => ({ ...r, displayType: 'speeding' })),
            ...(risks.nearMisses || []).map(r => ({ ...r, displayType: 'nearMiss' }))
        ];

        if (allRisks.length === 0) {
            section += '> 未检测到风险事件\n\n';
            return section;
        }

        allRisks.sort((a, b) => {
            const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return a.timestamp - b.timestamp;
        });

        allRisks.forEach((risk, index) => {
            section += `### ${index + 1}. ${this.getRiskTypeLabel(risk.displayType || risk.type)}\n\n`;
            section += `**风险ID**: ${risk.id}\n\n`;
            section += `**时间**: ${this.formatTimestamp(risk.timestamp)}\n\n`;
            section += `**严重程度**: ${this.getSeverityBadge(risk.severity)}\n\n`;
            section += `**描述**: ${risk.description}\n\n`;
            
            if (risk.vehicles) {
                section += `**涉及车辆**: ${risk.vehicles.join(', ')}\n\n`;
            } else if (risk.vehicleId) {
                section += `**涉及车辆**: ${risk.vehicleId}\n\n`;
            }

            section += `**位置**: ${this.getPositionString(risk)}\n\n`;

            if (risk.acceleration !== undefined) {
                section += `**加速度**: ${risk.acceleration.toFixed(2)} m/s²\n\n`;
            }

            if (risk.speed !== undefined) {
                section += `**速度**: ${risk.speed.toFixed(1)} km/h`;
                if (risk.speedLimit) {
                    section += ` (限速: ${risk.speedLimit} km/h)`;
                }
                section += '\n\n';
            }

            if (risk.distance !== undefined) {
                section += `**距离**: ${risk.distance.toFixed(2)} 米\n\n`;
            }

            if (risk.distances !== undefined) {
                section += `**距离**: ${risk.distances.toFixed(2)} 米\n\n`;
            }

            if (risk.areaName) {
                section += `**区域**: ${risk.areaName}\n\n`;
                section += `**是否进入**: ${risk.isInside ? '是' : '否'}\n\n`;
            }

            if (options.includeEvidence && risk.evidence) {
                section += '#### 证据数据\n\n';
                section += '```json\n';
                section += JSON.stringify(risk.evidence, null, 2);
                section += '\n```\n\n';
            }

            section += '---\n\n';
        });

        return section;
    }

    generateMapInfoSection(mapData) {
        let section = '## 地图信息\n\n';

        section += `**地图名称**: ${mapData.name || '未命名'}\n\n`;
        
        if (mapData.bounds) {
            section += `**地图边界**: X: [${mapData.bounds.minX}, ${mapData.bounds.maxX}], Y: [${mapData.bounds.minY}, ${mapData.bounds.maxY}]\n\n`;
        }

        if (mapData.zones && mapData.zones.length > 0) {
            section += `**区域数量**: ${mapData.zones.length}\n\n`;
        }

        if (mapData.aisles && mapData.aisles.length > 0) {
            section += `**通道数量**: ${mapData.aisles.length}\n\n`;
        }

        if (mapData.racks && mapData.racks.length > 0) {
            section += `**货架数量**: ${mapData.racks.length}\n\n`;
        }

        if (mapData.restrictedAreas && mapData.restrictedAreas.length > 0) {
            section += `**禁行区数量**: ${mapData.restrictedAreas.length}\n\n`;
            
            section += '### 禁行区列表\n\n';
            mapData.restrictedAreas.forEach((area, index) => {
                section += `${index + 1}. **${area.name || '未命名'}**\n`;
                if (area.description) {
                    section += `   - 描述: ${area.description}\n`;
                }
                if (area.restriction) {
                    section += `   - 限制类型: ${this.getRestrictionLabel(area.restriction)}\n`;
                }
                section += '\n';
            });
        }

        return section;
    }

    generateTrajectorySummarySection(trajectoryData) {
        let section = '## 轨迹数据摘要\n\n';

        if (!trajectoryData || trajectoryData.length === 0) {
            section += '> 无轨迹数据\n\n';
            return section;
        }

        const vehicleGroups = {};
        trajectoryData.forEach(point => {
            if (!vehicleGroups[point.vehicleId]) {
                vehicleGroups[point.vehicleId] = [];
            }
            vehicleGroups[point.vehicleId].push(point);
        });

        section += `**总数据点数**: ${trajectoryData.length}\n\n`;
        section += `**车辆数量**: ${Object.keys(vehicleGroups).length}\n\n`;

        section += '### 各车辆数据统计\n\n';
        
        section += `| 车辆ID | 数据点数 | 时间范围 |\n`;
        section += `|--------|----------|----------|\n`;

        Object.keys(vehicleGroups).sort().forEach(vehicleId => {
            const points = vehicleGroups[vehicleId];
            points.sort((a, b) => a.timestamp - b.timestamp);
            
            const start = this.formatTimestamp(points[0].timestamp);
            const end = this.formatTimestamp(points[points.length - 1].timestamp);
            
            section += `| ${vehicleId} | ${points.length} | ${start} 至 ${end} |\n`;
        });

        section += '\n';

        return section;
    }

    generateInvalidDataSection(invalidRows) {
        let section = '## 数据质量问题\n\n';

        const errorTypeCounts = {};
        invalidRows.forEach(row => {
            const errorType = row.errorType || 'unknown';
            if (!errorTypeCounts[errorType]) {
                errorTypeCounts[errorType] = 0;
            }
            errorTypeCounts[errorType]++;
        });

        section += `**问题行数**: ${invalidRows.length}\n\n`;

        section += '### 问题类型统计\n\n';
        section += `| 错误类型 | 数量 |\n`;
        section += `|----------|------|\n`;
        
        Object.keys(errorTypeCounts).forEach(type => {
            section += `| ${this.getErrorTypeLabel(type)} | ${errorTypeCounts[type]} |\n`;
        });

        section += '\n';

        if (invalidRows.length <= 20) {
            section += '### 问题行详情\n\n';
            
            invalidRows.forEach((row, index) => {
                section += `#### 第 ${row.rowNumber} 行\n\n`;
                section += `**错误类型**: ${this.getErrorTypeLabel(row.errorType)}\n\n`;
                section += `**错误信息**: \n`;
                if (row.errors && Array.isArray(row.errors)) {
                    row.errors.forEach(error => {
                        section += `- ${error}\n`;
                    });
                }
                section += '\n';
                section += `**原始数据**: ${row.rowData}\n\n`;
                section += '---\n\n';
            });
        } else {
            section += '> 问题行数量较多，详情请查看导入时的错误日志\n\n';
        }

        return section;
    }

    generateReportFooter() {
        let footer = '## 附录\n\n';
        footer += '### 风险类型说明\n\n';
        footer += '- **会车风险**: 多辆车在同一时间点距离过近\n';
        footer += '- **急停风险**: 车辆加速度小于设定阈值\n';
        footer += '- **禁行区靠近**: 车辆靠近或进入禁行区域\n';
        footer += '- **超速风险**: 车辆速度超过设定限速\n';
        footer += '- **险兆事件**: 车辆距离较近但未达到会车风险阈值\n\n';

        footer += '### 严重程度说明\n\n';
        footer += '- **高风险**: 需要立即关注和处理的严重安全问题\n';
        footer += '- **中风险**: 需要记录并在后续复盘中关注的问题\n';
        footer += '- **低风险**: 轻微异常，建议持续观察\n\n';

        footer += `---\n\n`;
        footer += `*报告生成工具: 仓库车辆轨迹安全复盘系统*\n`;

        return footer;
    }

    getFilteredRisks(options) {
        let risks = store.getRisks();
        
        if (!risks) {
            return {
                collisions: [],
                suddenStops: [],
                restrictedAreaApproaches: [],
                speeding: [],
                nearMisses: [],
                statistics: {
                    totalRisks: 0,
                    byType: {},
                    bySeverity: { high: 0, medium: 0, low: 0 }
                }
            };
        }

        risks = JSON.parse(JSON.stringify(risks));

        if (options.filterVehicles && options.filterVehicles.length > 0) {
            risks = this.riskRules.filterRisksByVehicle(risks, options.filterVehicles);
        }

        if (options.filterSeverities && options.filterSeverities.length > 0) {
            risks = this.riskRules.filterRisksBySeverity(risks, options.filterSeverities);
        }

        if (options.timeRange) {
            risks = this.riskRules.filterRisksByTime(risks, options.timeRange.start, options.timeRange.end);
        }

        return risks;
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '未知';
        
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return String(timestamp);
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    getRiskTypeLabel(type) {
        const labels = {
            'collision': '会车风险',
            'collisions': '会车风险',
            'suddenStop': '急停风险',
            'suddenStops': '急停风险',
            'restrictedArea': '禁行区靠近',
            'restrictedAreaApproaches': '禁行区靠近',
            'speeding': '超速风险',
            'nearMiss': '险兆事件',
            'nearMisses': '险兆事件'
        };
        return labels[type] || type;
    }

    getSeverityLabel(severity) {
        const labels = {
            'high': '高风险',
            'medium': '中风险',
            'low': '低风险'
        };
        return labels[severity] || severity;
    }

    getSeverityBadge(severity) {
        const badges = {
            'high': '🔴 高风险',
            'medium': '🟡 中风险',
            'low': '🟢 低风险'
        };
        return badges[severity] || severity;
    }

    getVehiclesString(risk) {
        if (risk.vehicles) {
            return risk.vehicles.join(', ');
        }
        if (risk.vehicleId) {
            return risk.vehicleId;
        }
        return '未知';
    }

    getPositionString(risk) {
        if (risk.position) {
            const pos = risk.position;
            return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${(pos.z || 0).toFixed(2)})`;
        }
        if (risk.positions && risk.positions.length > 0) {
            return risk.positions.map(pos => 
                `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${(pos.z || 0).toFixed(2)})`
            ).join(', ');
        }
        return '未知';
    }

    getRiskDetailsJSON(risk, includeEvidence) {
        const details = { ...risk };
        
        if (!includeEvidence) {
            delete details.evidence;
        }
        
        return JSON.stringify(details);
    }

    getRestrictionLabel(restriction) {
        const labels = {
            'no_vehicle': '禁止车辆进入',
            'no_entry': '禁止进入',
            'speed_limit': '限速区域',
            'pedestrian_only': '仅行人区域'
        };
        return labels[restriction] || restriction;
    }

    getErrorTypeLabel(errorType) {
        const labels = {
            'missingFields': '缺少必填字段',
            'timeOutOfOrder': '时间倒序',
            'outOfBounds': '坐标越界',
            'speedAbnormal': '速度异常',
            'invalidFormat': '格式错误',
            'unknown': '未知错误'
        };
        return labels[errorType] || errorType;
    }

    getTimeRange(data) {
        if (!data || data.length === 0) {
            return { start: 0, end: 0 };
        }

        let min = Infinity;
        let max = -Infinity;

        data.forEach(point => {
            if (point.timestamp < min) min = point.timestamp;
            if (point.timestamp > max) max = point.timestamp;
        });

        return { start: min, end: max };
    }

    escapeCSV(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const str = String(value);
        
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }

        return str;
    }

    generateReportFileName(type) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        
        const extensions = {
            'report': 'md',
            'risks': 'csv'
        };

        return `warehouse_${type}_${timestamp}.${extensions[type] || 'txt'}`;
    }
}

const exportManager = new ExportManager();
export default exportManager;
