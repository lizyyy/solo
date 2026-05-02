// 导出模块
const Export = {
    // 导出Markdown调整建议
    exportMarkdownSuggestions: function(risks, data, suggestions) {
        let markdown = '# 展柜光照眩光调整建议\n\n';
        
        // 添加元数据
        markdown += `**生成时间:** ${new Date().toLocaleString()}\n\n`;
        markdown += `---\n\n`;
        
        // 风险统计
        const highRisks = risks.filter(r => r.severity === 'high').length;
        const mediumRisks = risks.filter(r => r.severity === 'medium').length;
        const lowRisks = risks.filter(r => r.severity === 'low').length;
        
        markdown += '## 风险概览\n\n';
        markdown += `| 风险等级 | 数量 |\n`;
        markdown += `|---------|------|\n`;
        markdown += `| 高风险 | ${highRisks} |\n`;
        markdown += `| 中风险 | ${mediumRisks} |\n`;
        markdown += `| 低风险 | ${lowRisks} |\n`;
        markdown += `| **总计** | **${risks.length}** |\n\n`;
        
        // 按风险类型分类
        markdown += '## 风险详情与调整建议\n\n';
        
        // 高风险优先
        const severityOrder = ['high', 'medium', 'low'];
        const severityNames = { high: '高风险', medium: '中风险', low: '低风险' };
        const severityEmoji = { high: '🔴', medium: '🟡', low: '🔵' };
        
        const typeNames = {
            illuminance: '照度超标',
            glare: '直接眩光',
            reflection: '反射眩光',
            visibility: '说明牌可见性',
            direct: '直接眩光'
        };
        
        for (const severity of severityOrder) {
            const severityRisks = risks.filter(r => r.severity === severity);
            if (severityRisks.length === 0) continue;
            
            markdown += `### ${severityEmoji[severity]} ${severityNames[severity]} (${severityRisks.length}项)\n\n`;
            
            // 按类型分组
            const groupedRisks = {};
            for (const risk of severityRisks) {
                const type = risk.type;
                if (!groupedRisks[type]) {
                    groupedRisks[type] = [];
                }
                groupedRisks[type].push(risk);
            }
            
            for (const [type, typeRisks] of Object.entries(groupedRisks)) {
                markdown += `#### ${typeNames[type] || type}\n\n`;
                
                for (const risk of typeRisks) {
                    markdown += `**问题:** ${risk.description}\n\n`;
                    
                    // 添加调整建议
                    const suggestion = suggestions?.find(s => s.risk === risk);
                    if (suggestion && suggestion.actions) {
                        markdown += `**建议调整:**\n\n`;
                        for (let i = 0; i < suggestion.actions.length; i++) {
                            markdown += `${i + 1}. ${suggestion.actions[i]}\n`;
                        }
                        markdown += '\n';
                    }
                    
                    // 添加详细信息
                    if (risk.illuminance !== undefined) {
                        markdown += `- 当前照度: ${risk.illuminance.toFixed(0)} lux\n`;
                        markdown += `- 限值: ${risk.maxIlluminance} lux\n`;
                    }
                    if (risk.visibilityRatio !== undefined) {
                        markdown += `- 可见率: ${(risk.visibilityRatio * 100).toFixed(0)}%\n`;
                    }
                    
                    markdown += '\n---\n\n';
                }
            }
        }
        
        // 总体建议
        markdown += '## 总体优化建议\n\n';
        markdown += `1. **优先处理高风险问题**: 先解决照度超标和严重眩光问题\n`;
        markdown += `2. **灯具位置调整**: 对于反射眩光，优先考虑移动灯具位置\n`;
        markdown += `3. **角度优化**: 调整灯具照射角度，避免直接反射到观众视线\n`;
        markdown += `4. **照度平衡**: 确保所有文物的照度都在安全范围内\n`;
        markdown += `5. **动线测试**: 在主要动线路径上测试说明牌的可见性\n\n`;
        
        // 附录
        markdown += '## 附录\n\n';
        markdown += '### 照度标准参考\n\n';
        markdown += `| 材质类型 | 建议最大照度 (lux) |\n`;
        markdown += `|---------|-------------------|\n`;
        markdown += `| 纸张、丝绸 | 50 |\n`;
        markdown += `| 皮革 | 150 |\n`;
        markdown += `| 油画 | 200 |\n`;
        markdown += `| 木质 | 300 |\n`;
        markdown += `| 陶瓷 | 500 |\n`;
        markdown += `| 金属 | 1000 |\n`;
        markdown += `| 宝石 | 2000 |\n\n`;
        
        markdown += '### 眩光等级说明\n\n';
        markdown += `- **高风险**: 可能造成观众不适或文物损坏，需要立即调整\n`;
        markdown += `- **中风险**: 可能影响观赏体验，建议调整\n`;
        markdown += `- **低风险**: 轻微问题，可根据实际情况调整\n`;
        
        return markdown;
    },
    
    // 导出CSV风险清单
    exportRiskCsv: function(risks) {
        let csv = '';
        
        // 表头
        const headers = [
            '序号',
            '风险类型',
            '严重程度',
            '描述',
            '相关灯具',
            '相关展柜',
            '相关文物',
            '相关动线',
            '照度值',
            '照度限值',
            '可见率'
        ];
        
        csv += headers.map(h => Utils.escapeCsv(h)).join(',') + '\n';
        
        // 数据行
        const typeNames = {
            illuminance: '照度超标',
            glare: '直接眩光',
            reflection: '反射眩光',
            visibility: '说明牌可见性',
            direct: '直接眩光'
        };
        
        const severityNames = { high: '高', medium: '中', low: '低' };
        
        for (let i = 0; i < risks.length; i++) {
            const risk = risks[i];
            const row = [
                i + 1,
                typeNames[risk.type] || risk.type,
                severityNames[risk.severity] || risk.severity,
                risk.description,
                risk.lightId || '',
                risk.caseId || '',
                risk.artifactId || '',
                risk.pathId || '',
                risk.illuminance !== undefined ? risk.illuminance.toFixed(0) : '',
                risk.maxIlluminance || '',
                risk.visibilityRatio !== undefined ? (risk.visibilityRatio * 100).toFixed(0) + '%' : ''
            ];
            
            csv += row.map(h => Utils.escapeCsv(h)).join(',') + '\n';
        }
        
        return csv;
    },
    
    // 导出JSON审计包
    exportAuditPackage: function(data, risks, schemeInfo) {
        const auditPackage = {
            version: '1.0',
            generatedAt: new Date().toISOString(),
            scheme: {
                name: schemeInfo?.name || '未命名方案',
                createdAt: schemeInfo?.createdAt,
                savedAt: schemeInfo?.updatedAt
            },
            summary: {
                totalRisks: risks.length,
                highRisks: risks.filter(r => r.severity === 'high').length,
                mediumRisks: risks.filter(r => r.severity === 'medium').length,
                lowRisks: risks.filter(r => r.severity === 'low').length
            },
            data: {
                cases: data.cases || [],
                lights: data.lights || [],
                artifacts: data.artifacts || [],
                paths: data.paths || []
            },
            risks: risks.map(risk => ({
                ...risk,
                riskTypeName: {
                    illuminance: '照度超标',
                    glare: '直接眩光',
                    reflection: '反射眩光',
                    visibility: '说明牌可见性',
                    direct: '直接眩光'
                }[risk.type] || risk.type,
                severityName: {
                    high: '高风险',
                    medium: '中风险',
                    low: '低风险'
                }[risk.severity] || risk.severity
            })),
            suggestions: this.generateSuggestionList(risks, data)
        };
        
        return JSON.stringify(auditPackage, null, 2);
    },
    
    // 生成建议列表
    generateSuggestionList: function(risks, data) {
        const suggestions = [];
        
        for (const risk of risks) {
            let actions = [];
            
            switch (risk.type) {
                case 'illuminance':
                    actions = [
                        `降低灯具 ${risk.lightId || '相关灯具'} 的强度`,
                        `调整灯具照射角度`,
                        `增加灯具与文物的距离`,
                        `使用漫射滤镜`
                    ];
                    break;
                    
                case 'reflection':
                    actions = [
                        `重新定位灯具 ${risk.lightId || '相关灯具'}`,
                        `调整灯具角度改变反射方向`,
                        `使用偏光滤镜`,
                        `考虑使用低反射玻璃`
                    ];
                    break;
                    
                case 'direct':
                case 'glare':
                    actions = [
                        `调整灯具 ${risk.lightId || '相关灯具'} 角度`,
                        `使用遮光板或格栅`,
                        `将灯具移至视野外`
                    ];
                    break;
                    
                case 'visibility':
                    actions = [
                        `调整说明牌位置或角度`,
                        `增加说明牌照明`,
                        `优化动线 ${risk.pathId || '相关动线'}`,
                        `考虑使用电子显示屏`
                    ];
                    break;
            }
            
            suggestions.push({
                riskId: risk.id || Utils.generateId(),
                riskDescription: risk.description,
                severity: risk.severity,
                type: risk.type,
                actions: actions
            });
        }
        
        return suggestions;
    },
    
    // 导出对比报告
    exportComparisonReport: function(comparison, schemeA, schemeB) {
        let markdown = '# 方案对比报告\n\n';
        
        markdown += `**生成时间:** ${new Date().toLocaleString()}\n\n`;
        markdown += `---\n\n`;
        
        // 方案信息
        markdown += '## 方案信息\n\n';
        markdown += `| 方案 | 名称 | 创建时间 | 风险总数 | 高风险 |\n`;
        markdown += `|-----|------|---------|---------|--------|\n`;
        markdown += `| A | ${schemeA.name} | ${Utils.formatDate(schemeA.createdAt)} | ${comparison.schemeA.riskCount} | ${comparison.schemeA.highRisks} |\n`;
        markdown += `| B | ${schemeB.name} | ${Utils.formatDate(schemeB.createdAt)} | ${comparison.schemeB.riskCount} | ${comparison.schemeB.highRisks} |\n\n`;
        
        // 差异分析
        markdown += '## 差异分析\n\n';
        
        if (comparison.differences.length === 0) {
            markdown += '两个方案没有显著差异。\n\n';
        } else {
            for (const diff of comparison.differences) {
                const emoji = diff.type === 'improvement' ? '✅' : '⚠️';
                const typeText = diff.type === 'improvement' ? '改进' : '退步';
                markdown += `${emoji} **${typeText}**: ${diff.description}\n\n`;
            }
        }
        
        // 详细对比
        markdown += '## 详细对比\n\n';
        
        markdown += '### 风险分布\n\n';
        markdown += `| 风险等级 | 方案A | 方案B | 变化 |\n`;
        markdown += `|---------|-------|-------|------|\n`;
        
        const categories = [
            { key: 'highRisks', name: '高风险' },
            { key: 'mediumRisks', name: '中风险' },
            { key: 'lowRisks', name: '低风险' },
            { key: 'riskCount', name: '总计' }
        ];
        
        for (const cat of categories) {
            const a = comparison.schemeA[cat.key];
            const b = comparison.schemeB[cat.key];
            const diff = b - a;
            const diffText = diff === 0 ? '-' : (diff > 0 ? `+${diff}` : `${diff}`);
            markdown += `| ${cat.name} | ${a} | ${b} | ${diffText} |\n`;
        }
        
        markdown += '\n';
        
        // 建议
        markdown += '## 建议\n\n';
        
        const totalReduction = comparison.schemeA.riskCount - comparison.schemeB.riskCount;
        const highReduction = comparison.schemeA.highRisks - comparison.schemeB.highRisks;
        
        if (totalReduction > 0 && highReduction >= 0) {
            markdown += `方案B相对于方案A有 ${totalReduction} 项风险减少，其中高风险减少 ${highReduction} 项。建议采用方案B。\n\n`;
        } else if (totalReduction < 0) {
            markdown += `方案B相对于方案A风险增加 ${Math.abs(totalReduction)} 项。建议保持方案A或进一步优化方案B。\n\n`;
        } else {
            markdown += `两个方案风险数量相近，建议根据具体风险类型和实际场景选择。\n\n`;
        }
        
        return markdown;
    },
    
    // 显示导出选项
    showExportOptions: function(data, risks, schemeInfo) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = '导出数据';
        
        modalBody.innerHTML = `
            <div class="export-options">
                <div class="export-option" data-type="markdown">
                    <h4>📄 Markdown 调整建议</h4>
                    <p>导出详细的风险分析和调整建议文档</p>
                    <button class="btn btn-primary export-btn" data-type="markdown">导出</button>
                </div>
                <div class="export-option" data-type="csv">
                    <h4>📊 CSV 风险清单</h4>
                    <p>导出结构化的风险数据表格</p>
                    <button class="btn btn-primary export-btn" data-type="csv">导出</button>
                </div>
                <div class="export-option" data-type="json">
                    <h4>📦 JSON 审计包</h4>
                    <p>导出完整的方案数据和风险分析</p>
                    <button class="btn btn-primary export-btn" data-type="json">导出</button>
                </div>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .export-options {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .export-option {
                padding: 1rem;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
            }
            .export-option h4 {
                margin: 0 0 0.5rem 0;
            }
            .export-option p {
                margin: 0 0 0.75rem 0;
                color: #666;
                font-size: 0.875rem;
            }
        `;
        modalBody.appendChild(style);
        
        // 绑定导出按钮事件
        const suggestions = Geometry.generateAdjustmentSuggestions(risks, data);
        
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                let content, filename, fileType;
                
                switch (type) {
                    case 'markdown':
                        content = this.exportMarkdownSuggestions(risks, data, suggestions);
                        filename = `光照调整建议_${new Date().toISOString().slice(0, 10)}.md`;
                        fileType = 'text/markdown';
                        break;
                        
                    case 'csv':
                        content = this.exportRiskCsv(risks);
                        filename = `风险清单_${new Date().toISOString().slice(0, 10)}.csv`;
                        fileType = 'text/csv';
                        break;
                        
                    case 'json':
                        content = this.exportAuditPackage(data, risks, schemeInfo);
                        filename = `审计包_${new Date().toISOString().slice(0, 10)}.json`;
                        fileType = 'application/json';
                        break;
                }
                
                if (content) {
                    Utils.downloadFile(content, filename, fileType);
                    Utils.showNotification('导出成功', 'success');
                }
                
                modal.style.display = 'none';
            };
        });
        
        modal.style.display = 'block';
        
        // 关闭按钮
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
};
