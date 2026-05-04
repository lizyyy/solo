const Exporter = {
    exportMarkdownRiskReport(data, risks) {
        const stats = RiskEngine.getRiskStats(risks);
        const reviewStatusText = Utils.getReviewStatusText(data.reviewStatus);
        
        let riskDetails = '';
        const groupedRisks = {
            critical: [],
            warning: [],
            info: [],
        };
        
        for (const risk of risks) {
            groupedRisks[risk.level].push(risk);
        }
        
        if (groupedRisks.critical.length > 0) {
            riskDetails += '### 严重风险\n\n';
            groupedRisks.critical.forEach((risk, index) => {
                riskDetails += `${index + 1}. **${risk.title}**\n`;
                riskDetails += `   - 描述: ${risk.description}\n`;
                riskDetails += `   - 建议: ${risk.suggestion}\n`;
                riskDetails += `   - 类型: ${this.getRiskTypeText(risk.type)}\n\n`;
            });
        }
        
        if (groupedRisks.warning.length > 0) {
            riskDetails += '### 警告\n\n';
            groupedRisks.warning.forEach((risk, index) => {
                riskDetails += `${index + 1}. **${risk.title}**\n`;
                riskDetails += `   - 描述: ${risk.description}\n`;
                riskDetails += `   - 建议: ${risk.suggestion}\n`;
                riskDetails += `   - 类型: ${this.getRiskTypeText(risk.type)}\n\n`;
            });
        }
        
        if (groupedRisks.info.length > 0) {
            riskDetails += '### 提示\n\n';
            groupedRisks.info.forEach((risk, index) => {
                riskDetails += `${index + 1}. **${risk.title}**\n`;
                riskDetails += `   - 描述: ${risk.description}\n`;
                riskDetails += `   - 建议: ${risk.suggestion}\n`;
                riskDetails += `   - 类型: ${this.getRiskTypeText(risk.type)}\n\n`;
            });
        }
        
        if (riskDetails === '') {
            riskDetails = '无检测到的风险。\n';
        }
        
        const totalTrussPoints = data.trusses.reduce((sum, t) => sum + (t.points ? t.points.length : 0), 0);
        
        let report = '# 吊点安全风险评估报告\n\n';
        
        report += '## 项目信息\n\n';
        report += `- **预演名称**: ${data.rehearsalName || '未命名'}\n`;
        report += `- **评估时间**: ${Utils.formatDate(new Date())}\n`;
        report += `- **复核状态**: ${reviewStatusText}\n\n`;
        
        report += '## 风险总览\n\n';
        report += `| 风险等级 | 数量 |\n`;
        report += `|----------|------|\n`;
        report += `| 严重 | ${stats.critical} |\n`;
        report += `| 警告 | ${stats.warning} |\n`;
        report += `| 提示 | ${stats.info} |\n\n`;
        
        if (stats.critical > 0) {
            report += `⚠️ **警告**: 存在 ${stats.critical} 个严重风险，建议立即处理！\n\n`;
        }
        
        report += '## 风险详情\n\n';
        report += riskDetails;
        
        report += '## 数据概览\n\n';
        report += `- **桁架数量**: ${data.trusses.length}\n`;
        report += `- **吊点数量**: ${totalTrussPoints}\n`;
        report += `- **设备数量**: ${data.equipment.length}\n`;
        report += `- **葫芦数量**: ${data.hoists.length}\n`;
        report += `- **拉力计数量**: ${data.loadCells.length}\n\n`;
        
        report += '## 葫芦载荷详情\n\n';
        const hoistLoads = RiskEngine.calculateHoistLoads(data);
        report += `| 葫芦名称 | 额定载荷 | 当前载荷 | 载荷占比 | 安全绳 |\n`;
        report += `|----------|----------|----------|----------|--------|\n`;
        
        for (const hoist of data.hoists) {
            const load = hoistLoads[hoist.id] || 0;
            const ratio = hoist.ratedLoad > 0 ? (load / hoist.ratedLoad * 100).toFixed(1) : '0';
            const safetyRope = hoist.hasSafetyRope ? '是' : '否';
            report += `| ${hoist.name} | ${hoist.ratedLoad}kg | ${load.toFixed(1)}kg | ${ratio}% | ${safetyRope} |\n`;
        }
        report += '\n';
        
        report += '## 设备清单\n\n';
        if (data.equipment.length > 0) {
            report += `| 设备名称 | 类型 | 重量 | 安全绳 | 位置 |\n`;
            report += `|----------|------|------|--------|------|\n`;
            
            for (const eq of data.equipment) {
                const typeText = this.getEquipmentTypeText(eq.type);
                const safetyRope = eq.hasSafetyRope ? '是' : '否';
                const position = `(${eq.position.x.toFixed(1)}, ${eq.position.y.toFixed(1)}, ${eq.position.z.toFixed(1)})`;
                report += `| ${eq.name} | ${typeText} | ${eq.weight}kg | ${safetyRope} | ${position} |\n`;
            }
        } else {
            report += '无设备数据。\n';
        }
        report += '\n';
        
        report += '## 人工复核备注\n\n';
        if (data.reviewNotes) {
            report += data.reviewNotes + '\n\n';
        } else {
            report += '无复核备注。\n\n';
        }
        
        report += '---\n\n';
        report += `*报告生成时间: ${Utils.formatDate(new Date())}*\n`;
        report += `*工具版本: ${APP_CONFIG.VERSION}*\n`;
        
        return report;
    },
    
    exportJSONAuditPackage(data, risks) {
        const stats = RiskEngine.getRiskStats(risks);
        const hoistLoads = RiskEngine.calculateHoistLoads(data);
        
        const auditPackage = {
            version: APP_CONFIG.VERSION,
            generatedAt: new Date().toISOString(),
            rehearsal: {
                name: data.rehearsalName,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                reviewStatus: data.reviewStatus,
                reviewNotes: data.reviewNotes,
            },
            riskSummary: {
                total: stats.total,
                critical: stats.critical,
                warning: stats.warning,
                info: stats.info,
            },
            risks: risks.map(risk => ({
                id: risk.id,
                type: risk.type,
                level: risk.level,
                title: risk.title,
                description: risk.description,
                suggestion: risk.suggestion,
                affectedObject: risk.affectedObject,
                details: risk.details,
            })),
            configuration: {
                trusses: data.trusses,
                hoists: data.hoists.map(h => ({
                    ...h,
                    calculatedLoad: hoistLoads[h.id] || 0,
                    loadRatio: h.ratedLoad > 0 ? (hoistLoads[h.id] || 0) / h.ratedLoad : 0,
                })),
                equipment: data.equipment,
                loadCells: data.loadCells,
            },
            thresholds: {
                ...APP_CONFIG.RISK_THRESHOLDS,
            },
        };
        
        return JSON.stringify(auditPackage, null, 2);
    },
    
    exportFullReport(data, risks) {
        const markdown = this.exportMarkdownRiskReport(data, risks);
        const json = this.exportJSONAuditPackage(data, risks);
        
        return {
            markdown,
            json,
        };
    },
    
    downloadMarkdown(data, risks) {
        const content = this.exportMarkdownRiskReport(data, risks);
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const filename = `吊点安全报告_${data.rehearsalName || '未命名'}_${this.getTimestamp()}.md`;
        saveAs(blob, filename);
    },
    
    downloadJSON(data, risks) {
        const content = this.exportJSONAuditPackage(data, risks);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const filename = `吊点审计包_${data.rehearsalName || '未命名'}_${this.getTimestamp()}.json`;
        saveAs(blob, filename);
    },
    
    downloadAll(data, risks) {
        this.downloadMarkdown(data, risks);
        setTimeout(() => {
            this.downloadJSON(data, risks);
        }, 500);
    },
    
    exportRehearsalData(data) {
        const exportData = {
            version: APP_CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            rehearsal: data,
        };
        return JSON.stringify(exportData, null, 2);
    },
    
    downloadRehearsalData(data) {
        const content = this.exportRehearsalData(data);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const filename = `预演数据_${data.rehearsalName || '未命名'}_${this.getTimestamp()}.json`;
        saveAs(blob, filename);
    },
    
    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    },
    
    getRiskTypeText(type) {
        const typeMap = {
            'overload': '超载',
            'unbalance': '偏载',
            'safety-ropes': '安全绳',
            'conflicts': '冲突',
        };
        return typeMap[type] || type;
    },
    
    getEquipmentTypeText(type) {
        const typeMap = {
            'fixture': '灯具',
            'speaker': '音箱',
            'other': '其他',
        };
        return typeMap[type] || type;
    },
};
