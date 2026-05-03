/**
 * 导出模块
 * 支持导出 Markdown/CSV/JSON 格式的报告
 */

const Exporter = (function() {
    'use strict';

    /**
     * 生成 Markdown 报告
     * @param {Object} state - 应用状态
     * @returns {string} Markdown 内容
     */
    function generateMarkdownReport(state) {
        const { data, riskAnalysis, marks, loadedFiles } = state;
        
        let md = `# 冷链仓库巡检风险报告\n\n`;
        
        md += `## 报告概览\n\n`;
        md += `| 项目 | 内容 |\n`;
        md += `|------|------|\n`;
        md += `| 生成时间 | ${new Date().toLocaleString('zh-CN')} |\n`;
        
        if (data.racks && data.racks.metadata) {
            md += `| 仓库 | ${data.racks.metadata.warehouse || '未设置'} |\n`;
            md += `| 数据日期 | ${data.racks.metadata.date || new Date().toISOString().split('T')[0]} |\n`;
        }
        
        if (loadedFiles) {
            md += `| 货架数据文件 | ${loadedFiles.racks || '未加载'} |\n`;
            md += `| 温度数据文件 | ${loadedFiles.temperature || '未加载'} |\n`;
            md += `| 轨迹数据文件 | ${loadedFiles.trajectory || '未加载'} |\n`;
            md += `| 临期数据文件 | ${loadedFiles.expiring || '未加载'} |\n`;
        }
        
        md += `\n---\n\n`;
        
        if (riskAnalysis && riskAnalysis.summary) {
            md += `## 风险统计\n\n`;
            const s = riskAnalysis.summary;
            
            md += `### 风险等级分布\n\n`;
            md += `- **高风险**: ${s.highRiskCount || 0} 项\n`;
            md += `- **中风险**: ${s.mediumRiskCount || 0} 项\n`;
            md += `- **低风险**: ${s.lowRiskCount || 0} 项\n`;
            md += `- **总计**: ${s.totalRisks || 0} 项\n\n`;
            
            if (s.temperature) {
                md += `### 温度异常统计\n\n`;
                md += `- **高温告警**: ${s.temperature.highTempSlots || 0} 个货位\n`;
                md += `- **温度偏高**: ${s.temperature.warningTempSlots || 0} 个货位\n`;
                md += `- **温度偏低**: ${s.temperature.coldTempSlots || 0} 个货位\n`;
                md += `- **连续高温**: ${s.temperature.consecutiveHighSlots || 0} 个货位\n`;
                if (s.temperature.avgTemperature !== null) {
                    md += `- **平均温度**: ${s.temperature.avgTemperature.toFixed(1)}°C\n`;
                }
                md += `\n`;
            }
            
            if (s.missed) {
                md += `### 巡检覆盖统计\n\n`;
                md += `- **已覆盖区域**: ${s.missed.inspectedAreas || 0} 个\n`;
                md += `- **未覆盖区域**: ${s.missed.missedAreas || 0} 个\n`;
                md += `- **部分覆盖区域**: ${s.missed.partialCoverageAreas || 0} 个\n`;
                md += `- **覆盖率**: ${(s.missed.coveragePercentage || 0).toFixed(1)}%\n\n`;
            }
            
            if (s.expiring) {
                md += `### 临期货品统计\n\n`;
                md += `- **高优先级 (1天内)**: ${s.expiring.highPriority || 0} 件\n`;
                md += `- **中优先级 (1-3天)**: ${s.expiring.mediumPriority || 0} 件\n`;
                md += `- **低优先级 (>3天)**: ${s.expiring.lowPriority || 0} 件\n`;
                md += `- **被堵货品**: ${s.expiring.blockedProducts || 0} 件\n`;
                md += `- **被堵且高优先级**: ${s.expiring.blockedHighPriority || 0} 件\n\n`;
            }
        }
        
        md += `---\n\n`;
        
        if (riskAnalysis && riskAnalysis.allRisks && riskAnalysis.allRisks.length > 0) {
            const highRisks = riskAnalysis.allRisks.filter(r => r.level === 'high');
            
            if (highRisks.length > 0) {
                md += `## 高风险详情\n\n`;
                
                highRisks.forEach((risk, index) => {
                    md += `### ${index + 1}. ${getRiskTypeDescription(risk.type)}\n\n`;
                    md += `- **风险等级**: ⚠️ 高风险\n`;
                    md += `- **描述**: ${risk.description}\n`;
                    
                    if (risk.slotKey) {
                        md += `- **货位**: ${risk.slotKey}\n`;
                    }
                    
                    if (risk.areaName) {
                        md += `- **区域**: ${risk.areaName}\n`;
                        md += `- **覆盖率**: ${(risk.coverageScore || 0).toFixed(1)}%\n`;
                    }
                    
                    if (risk.temperature !== undefined) {
                        md += `- **当前温度**: ${risk.temperature.toFixed(1)}°C\n`;
                    }
                    
                    if (risk.consecutiveHigh) {
                        md += `- **连续高温**: 是\n`;
                    }
                    
                    if (risk.product) {
                        md += `- **货品**: ${risk.product.name || '未命名'}\n`;
                        if (risk.product.sku) md += `- **SKU**: ${risk.product.sku}\n`;
                        if (risk.product.quantity) md += `- **数量**: ${risk.product.quantity}\n`;
                        if (risk.product.daysUntilExpiry !== null) md += `- **剩余天数**: ${risk.product.daysUntilExpiry}\n`;
                        if (risk.isBlocked) md += `- **状态**: 被堵在深处\n`;
                    }
                    
                    if (marks && marks[risk.slotKey || risk.areaName]) {
                        const mark = marks[risk.slotKey || risk.areaName];
                        md += `- **处理状态**: ${getMarkStatusDescription(mark.status)}\n`;
                        if (mark.notes) md += `- **处理备注**: ${mark.notes}\n`;
                    }
                    
                    md += `\n`;
                });
            }
        }
        
        if (marks && Object.keys(marks).length > 0) {
            md += `---\n\n`;
            md += `## 人工标记处理记录\n\n`;
            md += `| 货位/区域 | 处理状态 | 备注 | 更新时间 |\n`;
            md += `|------------|----------|------|----------|\n`;
            
            Object.entries(marks).forEach(([key, mark]) => {
                md += `| ${key} | ${getMarkStatusDescription(mark.status)} | ${mark.notes || '-'} | ${mark.updatedAt ? new Date(mark.updatedAt).toLocaleString('zh-CN') : '-'} |\n`;
            });
            
            md += `\n`;
        }
        
        md += `---\n\n`;
        md += `## 温度风险等级说明\n\n`;
        md += `| 等级 | 温度范围 | 颜色 | 说明 |\n`;
        md += `|------|----------|------|------|\n`;
        md += `| 高温 | > -12°C | 🔴 红色 | 严重超温，需立即处理 |\n`;
        md += `| 偏高 | -15 ~ -12°C | 🟡 黄色 | 接近警戒值，需关注 |\n`;
        md += `| 正常 | -18 ~ -15°C | 🟢 绿色 | 温度正常 |\n`;
        md += `| 偏低 | < -18°C | 🔵 蓝色 | 温度偏低，可能影响品质 |\n\n`;
        
        md += `---\n\n`;
        md += `*报告生成时间: ${new Date().toISOString()}*\n`;
        
        return md;
    }

    /**
     * 生成 CSV 报告
     * @param {Object} state - 应用状态
     * @returns {string} CSV 内容
     */
    function generateCSVReport(state) {
        const { riskAnalysis, marks } = state;
        
        let csv = `风险ID,风险类型,风险等级,货位/区域,描述,温度(°C),剩余天数,是否被堵,覆盖率(%),处理状态,备注,更新时间\n`;
        
        if (riskAnalysis && riskAnalysis.allRisks) {
            riskAnalysis.allRisks.forEach((risk, index) => {
                const key = risk.slotKey || risk.areaName || `RISK-${index + 1}`;
                const mark = marks && marks[key];
                
                const row = [
                    `RISK-${index + 1}`,
                    getRiskTypeDescription(risk.type),
                    getRiskLevelDescription(risk.level),
                    key,
                    `"${(risk.description || '').replace(/"/g, '""')}"`,
                    risk.temperature !== undefined ? risk.temperature.toFixed(1) : '',
                    risk.product?.daysUntilExpiry ?? '',
                    risk.isBlocked ? '是' : '否',
                    risk.coverageScore !== undefined ? risk.coverageScore.toFixed(1) : '',
                    mark ? getMarkStatusDescription(mark.status) : '待处理',
                    mark ? `"${(mark.notes || '').replace(/"/g, '""')}"` : '',
                    mark?.updatedAt || ''
                ];
                
                csv += row.join(',') + '\n';
            });
        }
        
        return csv;
    }

    /**
     * 生成 JSON 报告
     * @param {Object} state - 应用状态
     * @returns {string} JSON 内容
     */
    function generateJSONReport(state) {
        const { data, riskAnalysis, marks, loadedFiles } = state;
        
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                generatedBy: '冷链仓库3D货架巡检可视化器'
            },
            sourceFiles: loadedFiles || {},
            warehouseInfo: data.racks?.metadata || {},
            riskSummary: riskAnalysis?.summary || {},
            risks: [],
            marks: marks || {}
        };
        
        if (riskAnalysis && riskAnalysis.allRisks) {
            report.risks = riskAnalysis.allRisks.map((risk, index) => ({
                id: `RISK-${index + 1}`,
                type: risk.type,
                typeDescription: getRiskTypeDescription(risk.type),
                level: risk.level,
                levelDescription: getRiskLevelDescription(risk.level),
                slotKey: risk.slotKey,
                areaName: risk.areaName,
                description: risk.description,
                temperature: risk.temperature,
                coverageScore: risk.coverageScore,
                consecutiveHigh: risk.consecutiveHigh,
                isBlocked: risk.isBlocked,
                product: risk.product ? {
                    id: risk.product.productId,
                    name: risk.product.name,
                    sku: risk.product.sku,
                    quantity: risk.product.quantity,
                    daysUntilExpiry: risk.product.daysUntilExpiry,
                    expiryDate: risk.product.expiryDate
                } : null
            }));
        }
        
        return JSON.stringify(report, null, 2);
    }

    /**
     * 获取风险类型描述
     */
    function getRiskTypeDescription(type) {
        switch (type) {
            case 'temperature': return '温度异常';
            case 'missed': return '漏检区域';
            case 'expiring': return '临期货品';
            default: return '未知风险';
        }
    }

    /**
     * 获取风险等级描述
     */
    function getRiskLevelDescription(level) {
        switch (level) {
            case 'high': return '高风险';
            case 'medium': return '中风险';
            case 'low': return '低风险';
            default: return '正常';
        }
    }

    /**
     * 获取标记状态描述
     */
    function getMarkStatusDescription(status) {
        switch (status) {
            case 'pending': return '待处理';
            case 'processing': return '处理中';
            case 'resolved': return '已解决';
            case 'ignored': return '忽略';
            default: return '待处理';
        }
    }

    /**
     * 导出文件
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @param {string} mimeType - MIME类型
     */
    function downloadFile(content, filename, mimeType) {
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

    /**
     * 导出 Markdown 报告
     * @param {Object} state - 应用状态
     */
    function exportMarkdown(state) {
        const content = generateMarkdownReport(state);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadFile(content, `冷链巡检报告_${timestamp}.md`, 'text/markdown');
    }

    /**
     * 导出 CSV 报告
     * @param {Object} state - 应用状态
     */
    function exportCSV(state) {
        const content = generateCSVReport(state);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadFile(content, `冷链巡检报告_${timestamp}.csv`, 'text/csv;charset=utf-8');
    }

    /**
     * 导出 JSON 报告
     * @param {Object} state - 应用状态
     */
    function exportJSON(state) {
        const content = generateJSONReport(state);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadFile(content, `冷链巡检报告_${timestamp}.json`, 'application/json');
    }

    /**
     * 根据格式导出报告
     * @param {string} format - 格式: 'markdown', 'csv', 'json'
     * @param {Object} state - 应用状态
     */
    function exportReport(format, state) {
        switch (format.toLowerCase()) {
            case 'markdown':
            case 'md':
                exportMarkdown(state);
                break;
            case 'csv':
                exportCSV(state);
                break;
            case 'json':
                exportJSON(state);
                break;
            default:
                console.error(`不支持的导出格式: ${format}`);
                throw new Error(`不支持的导出格式: ${format}`);
        }
    }

    return {
        generateMarkdownReport,
        generateCSVReport,
        generateJSONReport,
        exportReport,
        exportMarkdown,
        exportCSV,
        exportJSON,
        downloadFile
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.Exporter = Exporter;
}
