/**
 * 报告导出模块
 * 负责生成Markdown复盘报告和导出CSV
 */

const Report = {
    // 当前选中的导出数据
    selectedDataId: null,
    
    /**
     * 初始化报告模块
     */
    init() {
        this.bindEvents();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 选择导出数据
        const exportDataSelect = document.getElementById('exportDataSelect');
        if (exportDataSelect) {
            exportDataSelect.addEventListener('change', () => {
                this.selectedDataId = exportDataSelect.value;
                if (this.selectedDataId) {
                    this.updateReportPreview();
                }
            });
        }
        
        // 导出Markdown报告按钮
        const exportMarkdownBtn = document.getElementById('exportMarkdownBtn');
        if (exportMarkdownBtn) {
            exportMarkdownBtn.addEventListener('click', () => {
                this.exportMarkdownReport();
            });
        }
        
        // 导出CSV按钮
        const exportCSVBtn = document.getElementById('exportCSVBtn');
        if (exportCSVBtn) {
            exportCSVBtn.addEventListener('click', () => {
                this.exportFilteredCSV();
            });
        }
    },
    
    /**
     * 更新报告预览
     */
    updateReportPreview() {
        const previewEl = document.getElementById('reportPreview');
        if (!previewEl || !this.selectedDataId) return;
        
        const trainingData = DataManager.getTrainingData(this.selectedDataId);
        if (!trainingData) {
            previewEl.innerHTML = '<p class="text-red-500">无法获取训练数据</p>';
            return;
        }
        
        // 生成报告内容
        const reportContent = this.generateMarkdownReport(trainingData);
        
        // 转换为HTML预览
        const htmlPreview = this.markdownToHtml(reportContent);
        
        previewEl.innerHTML = htmlPreview;
    },
    
    /**
     * 生成Markdown报告
     * @param {Object} trainingData 训练数据
     * @returns {string} Markdown格式的报告
     */
    generateMarkdownReport(trainingData) {
        const data = trainingData.data;
        const notes = Storage.getNotes(trainingData.id);
        
        // 获取导出选项
        const includeStats = document.getElementById('includeStats')?.checked ?? true;
        const includeHeatmap = document.getElementById('includeHeatmap')?.checked ?? true;
        const includeProblems = document.getElementById('includeProblems')?.checked ?? true;
        const includeSuggestions = document.getElementById('includeSuggestions')?.checked ?? true;
        
        const lines = [];
        
        // 标题
        lines.push(`# ${CONFIG.export.reportTitle}`);
        lines.push('');
        lines.push(`**训练名称：** ${trainingData.name}`);
        lines.push(`**训练日期：** ${trainingData.trainingDate || '未知'}`);
        lines.push(`**导入时间：** ${Utils.formatDate(trainingData.importTime, 'YYYY-MM-DD HH:mm')}`);
        lines.push(`**总拍数：** ${trainingData.totalShots}`);
        lines.push('');
        lines.push('---');
        lines.push('');
        
        // 关键统计
        if (includeStats) {
            lines.push('## 📊 关键统计');
            lines.push('');
            
            // 统计数据
            const results = Validator.countResults(data);
            const winRate = Validator.calculateWinRate(data);
            const netErrorRate = Validator.calculateNetErrorRate(data);
            
            lines.push('| 统计项 | 数值 |');
            lines.push('|--------|------|');
            lines.push(`| 总拍数 | ${trainingData.totalShots} |`);
            lines.push(`| 得分 | ${results['得分'] || 0} |`);
            lines.push(`| 失分 | ${results['失分'] || 0} |`);
            lines.push(`| 继续回合 | ${results['继续'] || 0} |`);
            lines.push(`| **得分率** | **${(winRate * 100).toFixed(1)}%** |`);
            lines.push(`| **网前失误率** | **${(netErrorRate * 100).toFixed(1)}%** |`);
            lines.push('');
            
            // 拍型统计
            const shotTypeCounts = Utils.groupBy(data, '拍型');
            lines.push('### 🏸 拍型分布');
            lines.push('');
            lines.push('| 拍型 | 数量 | 占比 |');
            lines.push('|------|------|------|');
            
            const sortedShotTypes = Object.entries(shotTypeCounts)
                .sort((a, b) => b[1].length - a[1].length);
            
            for (const [shotType, shots] of sortedShotTypes) {
                const count = shots.length;
                const percent = (count / trainingData.totalShots * 100).toFixed(1);
                lines.push(`| ${shotType} | ${count} | ${percent}% |`);
            }
            lines.push('');
            
            // 球员统计
            const players = Utils.unique(data, '球员');
            lines.push('### 👥 球员统计');
            lines.push('');
            lines.push('| 球员 | 总拍数 | 得分 | 失分 | 得分率 |');
            lines.push('|------|--------|------|------|--------|');
            
            for (const player of players) {
                const playerShots = data.filter(s => s['球员'] === player);
                const playerResults = Validator.countResults(playerShots);
                const playerWinRate = Validator.calculateWinRate(playerShots);
                
                lines.push(`| ${player} | ${playerShots.length} | ${playerResults['得分'] || 0} | ${playerResults['失分'] || 0} | ${(playerWinRate * 100).toFixed(1)}% |`);
            }
            lines.push('');
        }
        
        // 热区分析
        if (includeHeatmap) {
            lines.push('## 🔥 热区分析');
            lines.push('');
            
            const zones = Validator.countShotsByZone(data, 'singles');
            const totalShots = trainingData.totalShots;
            
            // 找出最热区域
            const sortedZones = Object.entries(zones)
                .filter(([zone]) => zone !== '其他区域')
                .sort((a, b) => b[1] - a[1]);
            
            if (sortedZones.length > 0) {
                const hottestZone = sortedZones[0];
                const hottestPercent = (hottestZone[1] / totalShots * 100).toFixed(1);
                
                lines.push(`### 最热门区域`);
                lines.push('');
                lines.push(`**${hottestZone[0]}** 是最热门的落点区域，共 ${hottestZone[1]} 拍，占比 ${hottestPercent}%。`);
                lines.push('');
                
                lines.push('### 各区域分布');
                lines.push('');
                lines.push('| 区域 | 数量 | 占比 |');
                lines.push('|------|------|------|');
                
                for (const [zone, count] of sortedZones) {
                    const percent = (count / totalShots * 100).toFixed(1);
                    lines.push(`| ${zone} | ${count} | ${percent}% |`);
                }
                lines.push('');
                
                // 分析建议
                lines.push('### 热区分析结论');
                lines.push('');
                
                if (hottestPercent > 30) {
                    lines.push(`⚠️ **注意：** 落点过于集中在 ${hottestZone[0]}（${hottestPercent}%），建议增加落点变化，提高对手的防守难度。`);
                    lines.push('');
                }
                
                // 网前分析
                const netZones = sortedZones.filter(([zone]) => zone.includes('前场'));
                const netTotal = netZones.reduce((sum, [, count]) => sum + count, 0);
                const netPercent = (netTotal / totalShots * 100).toFixed(1);
                
                if (netPercent > 40) {
                    lines.push(`✅ **优势：** 网前球占比 ${netPercent}%，网前技术运用较多。如果网前得分率高，这是一个优势；如果网前失误率高，需要加强网前练习。`);
                    lines.push('');
                }
                
                // 后场分析
                const backZones = sortedZones.filter(([zone]) => zone.includes('后场'));
                const backTotal = backZones.reduce((sum, [, count]) => sum + count, 0);
                const backPercent = (backTotal / totalShots * 100).toFixed(1);
                
                if (backPercent > 40) {
                    lines.push(`📍 **特点：** 后场球占比 ${backPercent}%，以控制后场为主。建议结合网前小球，丰富战术组合。`);
                    lines.push('');
                }
            }
        }
        
        // 丢分球路分析
        if (includeProblems) {
            lines.push('## ⚠️ 丢分球路分析');
            lines.push('');
            
            const lossShots = data.filter(s => s['回合结果'] === '失分');
            
            if (lossShots.length === 0) {
                lines.push('本次训练没有失分记录，表现优秀！');
                lines.push('');
            } else {
                // 分析失分的拍型
                const lossShotTypes = Utils.groupBy(lossShots, '拍型');
                const sortedLossTypes = Object.entries(lossShotTypes)
                    .sort((a, b) => b[1].length - a[1].length);
                
                lines.push('### 失分最多的拍型');
                lines.push('');
                
                if (sortedLossTypes.length > 0) {
                    const worstShotType = sortedLossTypes[0];
                    const worstPercent = (worstShotType[1].length / lossShots.length * 100).toFixed(1);
                    
                    lines.push(`**${worstShotType[0]}** 是失分最多的拍型，共 ${worstShotType[1].length} 次失分，占失分总数的 ${worstPercent}%。`);
                    lines.push('');
                    
                    lines.push('| 拍型 | 失分次数 | 占比 |');
                    lines.push('|------|----------|------|');
                    
                    for (const [shotType, shots] of sortedLossTypes) {
                        const count = shots.length;
                        const percent = (count / lossShots.length * 100).toFixed(1);
                        lines.push(`| ${shotType} | ${count} | ${percent}% |`);
                    }
                    lines.push('');
                }
                
                // 分析失分区域
                const lossZones = Validator.countShotsByZone(lossShots, 'singles');
                const sortedLossZones = Object.entries(lossZones)
                    .filter(([zone]) => zone !== '其他区域')
                    .sort((a, b) => b[1] - a[1]);
                
                if (sortedLossZones.length > 0) {
                    lines.push('### 失分最多的区域');
                    lines.push('');
                    
                    const worstZone = sortedLossZones[0];
                    lines.push(`**${worstZone[0]}** 是失分最多的区域，共 ${worstZone[1]} 次失分。`);
                    lines.push('');
                    
                    // 网前失分分析
                    const netLossZones = sortedLossZones.filter(([zone]) => zone.includes('前场'));
                    const netLossTotal = netLossZones.reduce((sum, [, count]) => sum + count, 0);
                    
                    if (netLossTotal > lossShots.length * 0.3) {
                        lines.push(`⚠️ **重点关注：** 网前区域失分较多（${netLossTotal} 次），建议加强网前技术练习，特别是搓球、勾球和推球的稳定性。`);
                        lines.push('');
                    }
                }
                
                // 分析失分球员
                const lossByPlayer = Utils.groupBy(lossShots, '球员');
                const sortedLossPlayers = Object.entries(lossByPlayer)
                    .sort((a, b) => b[1].length - a[1].length);
                
                if (sortedLossPlayers.length > 0) {
                    lines.push('### 各球员失分情况');
                    lines.push('');
                    lines.push('| 球员 | 失分次数 |');
                    lines.push('|------|----------|');
                    
                    for (const [player, shots] of sortedLossPlayers) {
                        lines.push(`| ${player} | ${shots.length} |`);
                    }
                    lines.push('');
                }
            }
        }
        
        // 训练建议
        if (includeSuggestions) {
            lines.push('## 💡 训练建议');
            lines.push('');
            
            const suggestions = this.generateSuggestions(data, notes);
            
            for (const suggestion of suggestions) {
                lines.push(`- ${suggestion}`);
            }
            lines.push('');
        }
        
        // 备注信息
        if (notes) {
            lines.push('## 📝 教练备注');
            lines.push('');
            
            if (notes.topic) {
                lines.push(`**训练主题：** ${notes.topic}`);
                lines.push('');
            }
            
            if (notes.rating) {
                lines.push(`**整体评价：** ${notes.rating}`);
                lines.push('');
            }
            
            if (notes.problems) {
                lines.push('### 主要问题');
                lines.push('');
                lines.push(notes.problems);
                lines.push('');
            }
            
            if (notes.progress) {
                lines.push('### 进步之处');
                lines.push('');
                lines.push(notes.progress);
                lines.push('');
            }
            
            if (notes.nextSteps) {
                lines.push('### 下次训练建议');
                lines.push('');
                lines.push(notes.nextSteps);
                lines.push('');
            }
            
            if (notes.other) {
                lines.push('### 其他备注');
                lines.push('');
                lines.push(notes.other);
                lines.push('');
            }
        }
        
        // 筛选信息
        if (Filters.hasFilters()) {
            lines.push('---');
            lines.push('');
            lines.push('*📋 筛选条件：*');
            lines.push('');
            lines.push(Filters.getFilterDescription());
            lines.push('');
        }
        
        // 页脚
        lines.push('---');
        lines.push('');
        lines.push(`*报告生成时间：${Utils.formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}*`);
        lines.push('');
        lines.push('*此报告由羽毛球训练复盘工具自动生成*');
        
        return lines.join('\n');
    },
    
    /**
     * 生成训练建议
     * @param {Array} data 训练数据
     * @param {Object} notes 教练备注
     * @returns {Array} 建议列表
     */
    generateSuggestions(data, notes) {
        const suggestions = [];
        
        const winRate = Validator.calculateWinRate(data);
        const netErrorRate = Validator.calculateNetErrorRate(data);
        
        // 基于得分率的建议
        if (winRate < 0.4) {
            suggestions.push('**提升得分率：** 当前得分率偏低，建议加强进攻性技术练习，提高一拍制胜的能力。');
        } else if (winRate > 0.6) {
            suggestions.push('**保持优势：** 得分率表现良好，继续保持当前的训练状态和技术运用。');
        } else {
            suggestions.push('**稳定发挥：** 得分率处于中等水平，建议在保持稳定性的基础上，适当增加进攻性。');
        }
        
        // 基于网前失误率的建议
        if (netErrorRate > 0.3) {
            suggestions.push('**加强网前：** 网前失误率较高，建议增加网前小球（搓、勾、推）的专项练习，提高网前技术的稳定性和细腻度。');
        } else if (netErrorRate > 0.2) {
            suggestions.push('**关注网前：** 网前有一定失误，建议在日常训练中增加网前多球练习。');
        }
        
        // 拍型分析
        const shotTypeCounts = Utils.groupBy(data, '拍型');
        const shotTypes = Object.keys(shotTypeCounts);
        
        if (shotTypes.length < 5) {
            suggestions.push('**丰富技术：** 使用的拍型较少，建议在训练中尝试更多技术类型，丰富战术组合。');
        }
        
        // 通用建议
        suggestions.push('**保持记录：** 继续保持每次训练后记录数据的习惯，便于长期追踪技术进步。');
        suggestions.push('**针对性训练：** 根据数据反映的问题，制定针对性的训练计划，重点突破薄弱环节。');
        suggestions.push('**定期复盘：** 建议每周进行一次数据复盘，对比分析技术变化，及时调整训练重点。');
        
        return suggestions;
    },
    
    /**
     * 简单的Markdown转HTML（用于预览）
     * @param {string} markdown Markdown内容
     * @returns {string} HTML内容
     */
    markdownToHtml(markdown) {
        let html = markdown;
        
        // 标题
        html = html.replace(/^### (.+)$/gm, '<h4 class="text-lg font-semibold text-gray-800 mt-6 mb-3">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 class="text-xl font-bold text-gray-800 mt-8 mb-4">$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mb-6">$1</h2>');
        
        // 粗体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // 斜体
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        
        // 表格
        const tableRegex = /\|.*\|\n\|[-:| ]+\|\n((?:\|.*\|\n)+)/g;
        html = html.replace(tableRegex, (match, rows) => {
            const headerRow = match.split('\n')[0];
            const headers = headerRow.split('|').filter(h => h.trim() !== '');
            
            let tableHtml = '<div class="overflow-x-auto"><table class="min-w-full border border-gray-200 rounded-lg">';
            
            // 表头
            tableHtml += '<thead class="bg-gray-50"><tr>';
            for (const header of headers) {
                tableHtml += `<th class="px-4 py-2 text-left font-semibold text-gray-700 border-b">${header.trim()}</th>`;
            }
            tableHtml += '</tr></thead><tbody>';
            
            // 数据行
            const rowLines = rows.trim().split('\n');
            for (const rowLine of rowLines) {
                const cells = rowLine.split('|').filter(c => c.trim() !== '');
                tableHtml += '<tr class="border-b hover:bg-gray-50">';
                for (const cell of cells) {
                    tableHtml += `<td class="px-4 py-2">${cell.trim()}</td>`;
                }
                tableHtml += '</tr>';
            }
            
            tableHtml += '</tbody></table></div>';
            return tableHtml;
        });
        
        // 列表
        html = html.replace(/^- (.+)$/gm, '<li class="ml-6 list-disc mb-2">$1</li>');
        
        // 分隔线
        html = html.replace(/^---$/gm, '<hr class="my-6 border-gray-200">');
        
        // 段落
        html = html.split('\n\n').map(p => {
            if (p.startsWith('<') || p.trim() === '') return p;
            return `<p class="mb-4 text-gray-700">${p}</p>`;
        }).join('\n');
        
        return html;
    },
    
    /**
     * 导出Markdown报告
     */
    exportMarkdownReport() {
        if (!this.selectedDataId) {
            Utils.showToast('请先选择要导出的训练数据', 'warning');
            return;
        }
        
        const trainingData = DataManager.getTrainingData(this.selectedDataId);
        if (!trainingData) {
            Utils.showToast('无法获取训练数据', 'error');
            return;
        }
        
        const reportContent = this.generateMarkdownReport(trainingData);
        const fileName = `复盘报告_${trainingData.trainingDate || '未知日期'}_${Utils.formatDate(new Date(), 'YYYYMMDD')}.md`;
        
        Utils.downloadFile(reportContent, fileName, 'text/markdown');
        Utils.showToast('Markdown报告导出成功！', 'success');
    },
    
    /**
     * 导出筛选后的CSV
     */
    exportFilteredCSV() {
        const data = DataManager.filteredData;
        
        if (!data || data.length === 0) {
            Utils.showToast('没有数据可导出', 'warning');
            return;
        }
        
        const csvContent = Utils.arrayToCSV(data);
        const currentData = DataManager.getCurrentData();
        const fileName = `筛选数据_${currentData?.trainingDate || '未知日期'}_${Utils.formatDate(new Date(), 'YYYYMMDD')}.csv`;
        
        Utils.downloadFile(csvContent, fileName, 'text/csv;charset=utf-8');
        Utils.showToast('CSV数据导出成功！', 'success');
    }
};
