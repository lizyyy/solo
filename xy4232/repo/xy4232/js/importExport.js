/**
 * 导入导出模块
 * 负责数据的导入和导出功能
 */

const ImportExport = {
    /**
     * 读取文件内容
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    },

    /**
     * 下载文件
     */
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * 导入展厅平面图
     */
    async importFloorplan(file) {
        try {
            const content = await this.readFile(file);
            const floorplan = DataParser.parseFloorplan(content);
            SpaceModel.setFloorplan(floorplan);
            StateStore.saveSpaceModel();
            console.log('展厅平面图导入成功');
            return { success: true, data: floorplan };
        } catch (error) {
            console.error('导入展厅平面图失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 导入展品清单
     */
    async importExhibits(file) {
        try {
            const content = await this.readFile(file);
            const exhibits = DataParser.parseExhibits(content);
            SpaceModel.setExhibits(exhibits);
            StateStore.saveSpaceModel();
            console.log(`展品清单导入成功，共 ${exhibits.length} 个展品`);
            return { success: true, data: exhibits };
        } catch (error) {
            console.error('导入展品清单失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 导入客流时段表
     */
    async importCrowdSchedule(file) {
        try {
            const content = await this.readFile(file);
            const timeSlots = DataParser.parseCrowdSchedule(content);
            SpaceModel.setTimeSlots(timeSlots);
            StateStore.saveSpaceModel();
            console.log(`客流时段表导入成功，共 ${timeSlots.length} 个时段`);
            return { success: true, data: timeSlots };
        } catch (error) {
            console.error('导入客流时段表失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 导入无障碍规则
     */
    async importAccessibilityRules(file) {
        try {
            const content = await this.readFile(file);
            const rules = DataParser.parseAccessibilityRules(content);
            SpaceModel.setAccessibilityRules(rules);
            StateStore.saveSpaceModel();
            console.log('无障碍规则导入成功');
            return { success: true, data: rules };
        } catch (error) {
            console.error('导入无障碍规则失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 导出场景包
     */
    exportScene() {
        const sceneData = {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            spaceModel: SpaceModel.serialize()
        };

        const jsonString = JSON.stringify(sceneData, null, 2);
        const filename = `scene_${Date.now()}.json`;
        
        this.downloadFile(jsonString, filename, 'application/json');
        console.log(`场景已导出: ${filename}`);
    },

    /**
     * 导入场景包
     */
    async importScene(file) {
        try {
            const content = await this.readFile(file);
            const sceneData = JSON.parse(content);

            if (sceneData.spaceModel) {
                SpaceModel.deserialize(sceneData.spaceModel);
                StateStore.saveSpaceModel();
                console.log('场景导入成功');
                return { success: true, data: sceneData };
            } else {
                throw new Error('场景包格式不正确，缺少 spaceModel 数据');
            }
        } catch (error) {
            console.error('导入场景失败:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 导出 Markdown 评审报告
     */
    exportMarkdownReport() {
        const reportData = SimulationEngine.generateReportData();
        const markdown = this.generateMarkdown(reportData);
        
        const filename = `report_${Date.now()}.md`;
        this.downloadFile(markdown, filename, 'text/markdown');
        console.log(`评审报告已导出: ${filename}`);
    },

    /**
     * 生成 Markdown 报告
     */
    generateMarkdown(reportData) {
        const timestamp = new Date().toLocaleString('zh-CN');
        
        let md = `# 展线拥堵预演报告\n\n`;
        md += `> 生成时间: ${timestamp}\n\n`;

        if (reportData.timeSlot) {
            md += `## 基本信息\n\n`;
            md += `- **时段**: ${reportData.timeSlot.name || '未命名'}\n`;
            md += `- **时段范围**: ${reportData.timeSlot.startTime} - ${reportData.timeSlot.endTime}\n`;
            md += `- **模拟观众数**: ${reportData.totalVisitors}\n\n`;
        }

        md += `## 风险概览\n\n`;
        md += `| 风险等级 | 数量 |\n`;
        md += `|---------|------|\n`;
        md += `| 🔴 高风险 | ${reportData.risks.high} |\n`;
        md += `| 🟡 中风险 | ${reportData.risks.medium} |\n`;
        md += `| 🟢 低风险 | ${reportData.risks.low} |\n`;
        md += `| **总计** | **${reportData.risks.total}** |\n\n`;

        md += `## 风险类型分布\n\n`;
        md += `- 🚶‍♂️ 拥堵: ${reportData.risks.byType.congestion} 处\n`;
        md += `- 🚒 消防通道占用: ${reportData.risks.byType.fire_blocked} 处\n`;
        md += `- 👁️ 视线遮挡: ${reportData.risks.byType.view_obstruction} 处\n`;
        md += `- ♿ 无障碍绕行: ${reportData.risks.byType.accessibility_detour} 处\n\n`;

        if (reportData.riskDetails.length > 0) {
            md += `## 风险详情\n\n`;
            
            const highRisks = reportData.riskDetails.filter(r => r.severity === 'high');
            const mediumRisks = reportData.riskDetails.filter(r => r.severity === 'medium');
            const lowRisks = reportData.riskDetails.filter(r => r.severity === 'low');

            if (highRisks.length > 0) {
                md += `### 🔴 高风险\n\n`;
                highRisks.forEach((risk, index) => {
                    md += `${index + 1}. **${this.getRiskTypeLabel(risk.type)}**\n`;
                    md += `   - 位置: (${risk.position.x.toFixed(2)}, ${risk.position.y.toFixed(2)})\n`;
                    md += `   - 描述: ${risk.description}\n\n`;
                });
            }

            if (mediumRisks.length > 0) {
                md += `### 🟡 中风险\n\n`;
                mediumRisks.forEach((risk, index) => {
                    md += `${index + 1}. **${this.getRiskTypeLabel(risk.type)}**\n`;
                    md += `   - 位置: (${risk.position.x.toFixed(2)}, ${risk.position.y.toFixed(2)})\n`;
                    md += `   - 描述: ${risk.description}\n\n`;
                });
            }

            if (lowRisks.length > 0) {
                md += `### 🟢 低风险\n\n`;
                lowRisks.forEach((risk, index) => {
                    md += `${index + 1}. **${this.getRiskTypeLabel(risk.type)}**\n`;
                    md += `   - 位置: (${risk.position.x.toFixed(2)}, ${risk.position.y.toFixed(2)})\n`;
                    md += `   - 描述: ${risk.description}\n\n`;
                });
            }
        }

        if (reportData.recommendations.length > 0) {
            md += `## 优化建议\n\n`;

            const highRecs = reportData.recommendations.filter(r => r.priority === 'high');
            const mediumRecs = reportData.recommendations.filter(r => r.priority === 'medium');
            const lowRecs = reportData.recommendations.filter(r => r.priority === 'low');

            if (highRecs.length > 0) {
                md += `### 🔴 紧急建议\n\n`;
                highRecs.forEach((rec, index) => {
                    md += `**${index + 1}. ${rec.title}**\n\n`;
                    md += `${rec.description}\n\n`;
                    rec.items.forEach(item => {
                        md += `  - ${item}\n`;
                    });
                    md += `\n`;
                });
            }

            if (mediumRecs.length > 0) {
                md += `### 🟡 重要建议\n\n`;
                mediumRecs.forEach((rec, index) => {
                    md += `**${index + 1}. ${rec.title}**\n\n`;
                    md += `${rec.description}\n\n`;
                    rec.items.forEach(item => {
                        md += `  - ${item}\n`;
                    });
                    md += `\n`;
                });
            }

            if (lowRecs.length > 0) {
                md += `### 🟢 一般建议\n\n`;
                lowRecs.forEach((rec, index) => {
                    md += `**${index + 1}. ${rec.title}**\n\n`;
                    md += `${rec.description}\n\n`;
                    rec.items.forEach(item => {
                        md += `  - ${item}\n`;
                    });
                    md += `\n`;
                });
            }
        }

        md += `---\n\n`;
        md += `*此报告由展线拥堵预演台自动生成*\n`;

        return md;
    },

    /**
     * 获取风险类型标签
     */
    getRiskTypeLabel(type) {
        const labels = {
            'congestion': '拥堵',
            'fire_exit_blocked': '消防通道占用',
            'view_obstruction': '视线遮挡',
            'accessibility_detour': '无障碍绕行'
        };
        return labels[type] || type;
    },

    /**
     * 导出风险点 CSV
     */
    exportRiskCSV() {
        const risks = SimulationEngine.getRisks();
        
        if (risks.length === 0) {
            alert('没有可导出的风险点');
            return;
        }

        let csv = '风险类型,风险等级,位置X,位置Y,描述,涉及人数\n';
        
        risks.forEach(risk => {
            const typeLabel = this.getRiskTypeLabel(risk.type);
            const severityLabel = { high: '高', medium: '中', low: '低' }[risk.severity] || risk.severity;
            
            csv += `"${typeLabel}","${severityLabel}",${risk.position.x.toFixed(2)},${risk.position.y.toFixed(2)},"${risk.description}",${risk.visitorCount || 0}\n`;
        });

        const filename = `risks_${Date.now()}.csv`;
        this.downloadFile(csv, filename, 'text/csv');
        console.log(`风险点已导出: ${filename}`);
    },

    /**
     * 保存方案到本地存储
     */
    saveScheme() {
        StateStore.saveSpaceModel();
        StateStore.saveSimulationState();
        alert('方案已保存');
    },

    /**
     * 导出完整方案文件
     */
    exportFullScheme() {
        const scheme = {
            version: '1.0.0',
            exportTime: new Date().toISOString(),
            spaceModel: SpaceModel.serialize(),
            simulationState: {
                isRunning: SimulationEngine.isRunning,
                isPaused: SimulationEngine.isPaused,
                currentTimeSlot: SimulationEngine.currentTimeSlot,
                speed: SimulationEngine.speed,
                time: SimulationEngine.time
            }
        };

        const jsonString = JSON.stringify(scheme, null, 2);
        const filename = `scheme_${Date.now()}.json`;
        
        this.downloadFile(jsonString, filename, 'application/json');
        console.log(`完整方案已导出: ${filename}`);
    }
};

// 导出为全局变量
window.ImportExport = ImportExport;
