/**
 * 对比模块
 * 负责两场训练数据的对比分析
 */

const Comparison = {
    // 选中的对比数据
    selectedData1: null,
    selectedData2: null,
    
    /**
     * 初始化对比模块
     */
    init() {
        this.bindEvents();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 对比数据选择
        const comparisonData1 = document.getElementById('comparisonData1');
        const comparisonData2 = document.getElementById('comparisonData2');
        
        if (comparisonData1) {
            comparisonData1.addEventListener('change', () => {
                this.selectedData1 = comparisonData1.value;
            });
        }
        
        if (comparisonData2) {
            comparisonData2.addEventListener('change', () => {
                this.selectedData2 = comparisonData2.value;
            });
        }
        
        // 对比按钮
        const compareBtn = document.getElementById('compareBtn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                this.performComparison();
            });
        }
    },
    
    /**
     * 更新对比数据选项
     */
    updateComparisonOptions() {
        const summaries = DataManager.getAllTrainingDataSummaries();
        const selects = ['comparisonData1', 'comparisonData2', 'notesDataSelect', 'exportDataSelect'];
        
        for (const selectId of selects) {
            const select = document.getElementById(selectId);
            if (!select) continue;
            
            // 保存当前选中值
            const currentValue = select.value;
            
            // 清空选项
            select.innerHTML = '<option value="">请选择训练数据...</option>';
            
            // 添加新选项
            for (const summary of summaries) {
                const opt = document.createElement('option');
                opt.value = summary.id;
                opt.textContent = `${summary.name} (${summary.trainingDate}) - ${summary.totalShots}拍`;
                if (summary.id === currentValue) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            }
        }
    },
    
    /**
     * 执行对比分析
     */
    performComparison() {
        if (!this.selectedData1 || !this.selectedData2) {
            Utils.showToast('请选择两场训练数据进行对比', 'warning');
            return;
        }
        
        if (this.selectedData1 === this.selectedData2) {
            Utils.showToast('请选择不同的训练数据进行对比', 'warning');
            return;
        }
        
        const data1 = DataManager.getTrainingData(this.selectedData1);
        const data2 = DataManager.getTrainingData(this.selectedData2);
        
        if (!data1 || !data2) {
            Utils.showToast('无法获取训练数据', 'error');
            return;
        }
        
        // 显示对比结果区域
        const comparisonResults = document.getElementById('comparisonResults');
        if (comparisonResults) {
            comparisonResults.classList.remove('hidden');
        }
        
        // 更新对比概览
        this.updateComparisonOverview(data1, data2);
        
        // 绘制对比热力图
        Visualization.drawComparisonHeatmaps(
            data1.data, 
            data2.data,
            data1.name,
            data2.name
        );
        
        // 生成对比分析
        this.generateComparisonAnalysis(data1, data2);
        
        Utils.showToast('对比分析完成', 'success');
    },
    
    /**
     * 更新对比概览
     * @param {Object} data1 数据1
     * @param {Object} data2 数据2
     */
    updateComparisonOverview(data1, data2) {
        // 总拍数对比
        const totalShots1 = data1.totalShots;
        const totalShots2 = data2.totalShots;
        
        const totalShotsEl = document.getElementById('totalShotsComparison');
        if (totalShotsEl) {
            totalShotsEl.innerHTML = `
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data1.name}</p>
                    <p class="text-xl font-bold text-blue-600">${totalShots1}</p>
                </div>
                <div class="text-gray-400">vs</div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data2.name}</p>
                    <p class="text-xl font-bold text-green-600">${totalShots2}</p>
                </div>
            `;
        }
        
        // 得分率对比
        const winRate1 = Validator.calculateWinRate(data1.data);
        const winRate2 = Validator.calculateWinRate(data2.data);
        
        const winRateEl = document.getElementById('winRateComparison');
        if (winRateEl) {
            const winRate1Str = (winRate1 * 100).toFixed(1) + '%';
            const winRate2Str = (winRate2 * 100).toFixed(1) + '%';
            
            winRateEl.innerHTML = `
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data1.name}</p>
                    <p class="text-xl font-bold ${winRate1 >= winRate2 ? 'text-green-600' : 'text-blue-600'}">${winRate1Str}</p>
                </div>
                <div class="text-gray-400">vs</div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data2.name}</p>
                    <p class="text-xl font-bold ${winRate2 > winRate1 ? 'text-green-600' : 'text-blue-600'}">${winRate2Str}</p>
                </div>
            `;
        }
        
        // 网前失误率对比
        const netErrorRate1 = Validator.calculateNetErrorRate(data1.data);
        const netErrorRate2 = Validator.calculateNetErrorRate(data2.data);
        
        const netErrorRateEl = document.getElementById('netErrorRateComparison');
        if (netErrorRateEl) {
            const netErrorRate1Str = (netErrorRate1 * 100).toFixed(1) + '%';
            const netErrorRate2Str = (netErrorRate2 * 100).toFixed(1) + '%';
            
            netErrorRateEl.innerHTML = `
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data1.name}</p>
                    <p class="text-xl font-bold ${netErrorRate1 <= netErrorRate2 ? 'text-green-600' : 'text-red-600'}">${netErrorRate1Str}</p>
                </div>
                <div class="text-gray-400">vs</div>
                <div class="text-center">
                    <p class="text-xs text-gray-500">${data2.name}</p>
                    <p class="text-xl font-bold ${netErrorRate2 < netErrorRate1 ? 'text-green-600' : 'text-red-600'}">${netErrorRate2Str}</p>
                </div>
            `;
        }
    },
    
    /**
     * 生成对比分析结果
     * @param {Object} data1 数据1
     * @param {Object} data2 数据2
     */
    generateComparisonAnalysis(data1, data2) {
        const analysisEl = document.getElementById('comparisonAnalysis');
        if (!analysisEl) return;
        
        const analysis = [];
        
        // 1. 总体对比
        analysis.push('<h4 class="text-lg font-semibold text-gray-800 mb-3">📊 总体对比</h4>');
        
        const totalShots1 = data1.totalShots;
        const totalShots2 = data2.totalShots;
        const shotsDiff = totalShots2 - totalShots1;
        
        analysis.push(`<p class="mb-2"><strong>训练量对比：</strong>${data1.name} 共 ${totalShots1} 拍，${data2.name} 共 ${totalShots2} 拍。${shotsDiff > 0 ? `${data2.name} 比 ${data1.name} 多 ${shotsDiff} 拍` : `${data1.name} 比 ${data2.name} 多 ${Math.abs(shotsDiff)} 拍`}。</p>`);
        
        // 2. 得分率对比
        const winRate1 = Validator.calculateWinRate(data1.data);
        const winRate2 = Validator.calculateWinRate(data2.data);
        const winRateDiff = winRate2 - winRate1;
        
        if (winRateDiff > 0.05) {
            analysis.push(`<p class="mb-2"><strong>得分率提升：</strong>${data2.name} 的得分率 (${(winRate2 * 100).toFixed(1)}%) 比 ${data1.name} (${(winRate1 * 100).toFixed(1)}%) 提升了 ${(winRateDiff * 100).toFixed(1)} 个百分点，表现有明显进步！</p>`);
        } else if (winRateDiff < -0.05) {
            analysis.push(`<p class="mb-2"><strong>得分率下降：</strong>${data2.name} 的得分率 (${(winRate2 * 100).toFixed(1)}%) 比 ${data1.name} (${(winRate1 * 100).toFixed(1)}%) 下降了 ${(Math.abs(winRateDiff) * 100).toFixed(1)} 个百分点，需要关注。</p>`);
        } else {
            analysis.push(`<p class="mb-2"><strong>得分率稳定：</strong>两次训练得分率相近（${(winRate1 * 100).toFixed(1)}% vs ${(winRate2 * 100).toFixed(1)}%），表现较为稳定。</p>`);
        }
        
        // 3. 网前失误率对比
        const netErrorRate1 = Validator.calculateNetErrorRate(data1.data);
        const netErrorRate2 = Validator.calculateNetErrorRate(data2.data);
        const netErrorRateDiff = netErrorRate2 - netErrorRate1;
        
        if (netErrorRateDiff < -0.05) {
            analysis.push(`<p class="mb-2"><strong>✅ 网前失误减少：</strong>${data2.name} 的网前失误率 (${(netErrorRate2 * 100).toFixed(1)}%) 比 ${data1.name} (${(netErrorRate1 * 100).toFixed(1)}%) 下降了 ${(Math.abs(netErrorRateDiff) * 100).toFixed(1)} 个百分点，网前技术有明显进步！</p>`);
        } else if (netErrorRateDiff > 0.05) {
            analysis.push(`<p class="mb-2"><strong>⚠️ 网前失误增加：</strong>${data2.name} 的网前失误率 (${(netErrorRate2 * 100).toFixed(1)}%) 比 ${data1.name} (${(netErrorRate1 * 100).toFixed(1)}%) 上升了 ${(netErrorRateDiff * 100).toFixed(1)} 个百分点，建议加强网前练习。</p>`);
        }
        
        // 4. 拍型使用变化
        analysis.push('<h4 class="text-lg font-semibold text-gray-800 mb-3 mt-6">🏸 拍型使用变化</h4>');
        
        const shotTypeAnalysis = this.analyzeShotTypeChanges(data1, data2);
        analysis.push(shotTypeAnalysis);
        
        // 5. 区域分布变化
        analysis.push('<h4 class="text-lg font-semibold text-gray-800 mb-3 mt-6">📍 落点区域变化</h4>');
        
        const zoneAnalysis = this.analyzeZoneChanges(data1, data2);
        analysis.push(zoneAnalysis);
        
        // 6. 总结建议
        analysis.push('<h4 class="text-lg font-semibold text-gray-800 mb-3 mt-6">💡 总结与建议</h4>');
        
        const suggestions = this.generateSuggestions(data1, data2, winRateDiff, netErrorRateDiff);
        analysis.push(suggestions);
        
        analysisEl.innerHTML = analysis.join('');
    },
    
    /**
     * 分析拍型使用变化
     * @param {Object} data1 数据1
     * @param {Object} data2 数据2
     * @returns {string} 分析结果HTML
     */
    analyzeShotTypeChanges(data1, data2) {
        const shotTypes1 = Utils.groupBy(data1.data, '拍型');
        const shotTypes2 = Utils.groupBy(data2.data, '拍型');
        
        const allShotTypes = new Set([...Object.keys(shotTypes1), ...Object.keys(shotTypes2)]);
        
        const changes = [];
        
        for (const shotType of allShotTypes) {
            const count1 = shotTypes1[shotType]?.length || 0;
            const count2 = shotTypes2[shotType]?.length || 0;
            const percent1 = (count1 / data1.totalShots * 100).toFixed(1);
            const percent2 = (count2 / data2.totalShots * 100).toFixed(1);
            const diff = parseFloat(percent2) - parseFloat(percent1);
            
            if (Math.abs(diff) > 3) {
                if (diff > 0) {
                    changes.push(`<li><strong>${shotType}</strong>：使用比例从 ${percent1}% 增加到 ${percent2}%（+${diff.toFixed(1)}%）</li>`);
                } else {
                    changes.push(`<li><strong>${shotType}</strong>：使用比例从 ${percent1}% 减少到 ${percent2}%（${diff.toFixed(1)}%）</li>`);
                }
            }
        }
        
        if (changes.length > 0) {
            return `<ul class="list-disc pl-6 space-y-1">${changes.join('')}</ul>`;
        }
        
        return '<p>拍型使用比例变化不大，技术运用较为稳定。</p>';
    },
    
    /**
     * 分析区域分布变化
     * @param {Object} data1 数据1
     * @param {Object} data2 数据2
     * @returns {string} 分析结果HTML
     */
    analyzeZoneChanges(data1, data2) {
        const zones1 = Validator.countShotsByZone(data1.data, 'singles');
        const zones2 = Validator.countShotsByZone(data2.data, 'singles');
        
        const changes = [];
        
        for (const [zone, count1] of Object.entries(zones1)) {
            if (zone === '其他区域') continue;
            
            const count2 = zones2[zone] || 0;
            const percent1 = (count1 / data1.totalShots * 100).toFixed(1);
            const percent2 = (count2 / data2.totalShots * 100).toFixed(1);
            const diff = parseFloat(percent2) - parseFloat(percent1);
            
            if (Math.abs(diff) > 3) {
                if (diff > 0) {
                    changes.push(`<li><strong>${zone}</strong>：落点比例从 ${percent1}% 增加到 ${percent2}%（+${diff.toFixed(1)}%）</li>`);
                } else {
                    changes.push(`<li><strong>${zone}</strong>：落点比例从 ${percent1}% 减少到 ${percent2}%（${diff.toFixed(1)}%）</li>`);
                }
            }
        }
        
        if (changes.length > 0) {
            return `<ul class="list-disc pl-6 space-y-1">${changes.join('')}</ul>`;
        }
        
        return '<p>落点区域分布变化不大。</p>';
    },
    
    /**
     * 生成对比建议
     * @param {Object} data1 数据1
     * @param {Object} data2 数据2
     * @param {number} winRateDiff 得分率差异
     * @param {number} netErrorRateDiff 网前失误率差异
     * @returns {string} 建议HTML
     */
    generateSuggestions(data1, data2, winRateDiff, netErrorRateDiff) {
        const suggestions = [];
        
        // 根据得分率变化
        if (winRateDiff > 0.05) {
            suggestions.push('<li><strong>保持优势：</strong>得分率有明显提升，请继续保持当前的训练方法和状态。</li>');
        } else if (winRateDiff < -0.05) {
            suggestions.push('<li><strong>关注表现：</strong>得分率有所下降，建议回顾录像，分析失分原因，调整训练重点。</li>');
        }
        
        // 根据网前失误率
        if (netErrorRateDiff < -0.05) {
            suggestions.push('<li><strong>巩固进步：</strong>网前失误率明显降低，网前技术有进步，可以适当增加网前训练的难度和强度。</li>');
        } else if (netErrorRateDiff > 0.05) {
            suggestions.push('<li><strong>加强网前：</strong>网前失误率有所上升，建议增加网前小球、搓球、勾球等技术的专项练习。</li>');
        }
        
        // 通用建议
        suggestions.push('<li><strong>保持训练连贯性：</strong>建议保持规律的训练频率，每周至少2-3次训练。</li>');
        suggestions.push('<li><strong>针对性训练：</strong>根据对比分析结果，针对薄弱环节进行专项训练。</li>');
        suggestions.push('<li><strong>记录习惯：</strong>继续保持每次训练后记录数据和复盘的习惯，便于长期追踪进步。</li>');
        
        return `<ul class="list-disc pl-6 space-y-2">${suggestions.join('')}</ul>`;
    }
};
