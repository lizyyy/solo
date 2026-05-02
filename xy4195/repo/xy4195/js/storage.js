// 方案存储模块
const Storage = {
    // 本地存储键名
    STORAGE_KEY: 'display_case_schemes',
    
    // 获取所有保存的方案
    getAllSchemes: function() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('读取方案失败:', e);
        }
        return [];
    },
    
    // 保存方案
    saveScheme: function(schemeData, name) {
        try {
            const schemes = this.getAllSchemes();
            
            const scheme = {
                id: Utils.generateId(),
                name: name || `方案 ${schemes.length + 1}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                data: Utils.deepClone(schemeData),
                risks: schemeData.risks ? Utils.deepClone(schemeData.risks) : []
            };
            
            schemes.push(scheme);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schemes));
            
            return {
                success: true,
                scheme: scheme
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    // 更新方案
    updateScheme: function(schemeId, schemeData) {
        try {
            const schemes = this.getAllSchemes();
            const index = schemes.findIndex(s => s.id === schemeId);
            
            if (index === -1) {
                return {
                    success: false,
                    error: '方案不存在'
                };
            }
            
            schemes[index].data = Utils.deepClone(schemeData);
            schemes[index].updatedAt = new Date().toISOString();
            if (schemeData.risks) {
                schemes[index].risks = Utils.deepClone(schemeData.risks);
            }
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schemes));
            
            return {
                success: true,
                scheme: schemes[index]
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    // 删除方案
    deleteScheme: function(schemeId) {
        try {
            const schemes = this.getAllSchemes();
            const index = schemes.findIndex(s => s.id === schemeId);
            
            if (index === -1) {
                return {
                    success: false,
                    error: '方案不存在'
                };
            }
            
            schemes.splice(index, 1);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(schemes));
            
            return {
                success: true
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    // 获取单个方案
    getScheme: function(schemeId) {
        const schemes = this.getAllSchemes();
        return schemes.find(s => s.id === schemeId) || null;
    },
    
    // 对比两个方案
    compareSchemes: function(schemeA, schemeB) {
        const comparison = {
            schemeA: {
                name: schemeA.name,
                id: schemeA.id,
                riskCount: schemeA.risks?.length || 0,
                highRisks: (schemeA.risks || []).filter(r => r.severity === 'high').length,
                mediumRisks: (schemeA.risks || []).filter(r => r.severity === 'medium').length,
                lowRisks: (schemeA.risks || []).filter(r => r.severity === 'low').length
            },
            schemeB: {
                name: schemeB.name,
                id: schemeB.id,
                riskCount: schemeB.risks?.length || 0,
                highRisks: (schemeB.risks || []).filter(r => r.severity === 'high').length,
                mediumRisks: (schemeB.risks || []).filter(r => r.severity === 'medium').length,
                lowRisks: (schemeB.risks || []).filter(r => r.severity === 'low').length
            },
            differences: []
        };
        
        // 计算改进情况
        const riskReduction = comparison.schemeA.riskCount - comparison.schemeB.riskCount;
        const highRiskReduction = comparison.schemeA.highRisks - comparison.schemeB.highRisks;
        
        if (riskReduction > 0) {
            comparison.differences.push({
                type: 'improvement',
                description: `总风险减少 ${riskReduction} 项`
            });
        } else if (riskReduction < 0) {
            comparison.differences.push({
                type: 'regression',
                description: `总风险增加 ${Math.abs(riskReduction)} 项`
            });
        }
        
        if (highRiskReduction > 0) {
            comparison.differences.push({
                type: 'improvement',
                description: `高风险减少 ${highRiskReduction} 项`
            });
        } else if (highRiskReduction < 0) {
            comparison.differences.push({
                type: 'regression',
                description: `高风险增加 ${Math.abs(highRiskReduction)} 项`
            });
        }
        
        // 找出新增和解决的风险
        const risksA = schemeA.risks || [];
        const risksB = schemeB.risks || [];
        
        // 检查风险类型变化
        const riskTypes = ['illuminance', 'glare', 'reflection', 'visibility'];
        
        for (const type of riskTypes) {
            const countA = risksA.filter(r => r.type === type).length;
            const countB = risksB.filter(r => r.type === type).length;
            
            if (countA !== countB) {
                const typeNames = {
                    illuminance: '照度超标',
                    glare: '眩光',
                    reflection: '反射眩光',
                    visibility: '可见性'
                };
                const diff = countB - countA;
                comparison.differences.push({
                    type: diff < 0 ? 'improvement' : 'regression',
                    description: `${typeNames[type] || type}风险 ${diff > 0 ? '增加' : '减少'} ${Math.abs(diff)} 项`
                });
            }
        }
        
        return comparison;
    },
    
    // 显示方案列表
    showSchemeList: function(mode, onSelect) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        const schemes = this.getAllSchemes();
        
        if (mode === 'save') {
            modalTitle.textContent = '保存方案';
            modalBody.innerHTML = `
                <div class="save-form">
                    <div class="form-group">
                        <label>方案名称:</label>
                        <input type="text" id="scheme-name" value="方案 ${schemes.length + 1}" 
                               placeholder="请输入方案名称">
                    </div>
                    <div class="form-actions">
                        <button id="save-confirm" class="btn btn-primary">保存</button>
                        <button id="save-cancel" class="btn btn-secondary">取消</button>
                    </div>
                </div>
            `;
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .save-form .form-group {
                    margin-bottom: 1rem;
                }
                .save-form label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }
                .save-form input {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 1rem;
                }
                .save-form .form-actions {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 1.5rem;
                }
            `;
            modalBody.appendChild(style);
            
            document.getElementById('save-confirm').onclick = () => {
                const name = document.getElementById('scheme-name').value.trim();
                if (name) {
                    modal.style.display = 'none';
                    if (onSelect) {
                        onSelect({ action: 'save', name: name });
                    }
                } else {
                    Utils.showNotification('请输入方案名称', 'warning');
                }
            };
            
            document.getElementById('save-cancel').onclick = () => {
                modal.style.display = 'none';
            };
            
        } else {
            // 加载或对比模式
            modalTitle.textContent = mode === 'compare' ? '选择方案进行对比' : '加载方案';
            
            if (schemes.length === 0) {
                modalBody.innerHTML = `
                    <div class="no-schemes">
                        <p>暂无保存的方案</p>
                        <button id="close-modal" class="btn btn-secondary">关闭</button>
                    </div>
                `;
                document.getElementById('close-modal').onclick = () => {
                    modal.style.display = 'none';
                };
            } else {
                let schemesHtml = '<div class="scheme-list">';
                
                for (const scheme of schemes) {
                    const riskCount = scheme.risks?.length || 0;
                    const highRisks = (scheme.risks || []).filter(r => r.severity === 'high').length;
                    
                    schemesHtml += `
                        <div class="scheme-item" data-id="${scheme.id}">
                            <div class="scheme-info">
                                <h4>${scheme.name}</h4>
                                <p class="scheme-meta">
                                    创建: ${Utils.formatDate(scheme.createdAt)}<br>
                                    风险: ${riskCount} 项 (高风险: ${highRisks})
                                </p>
                            </div>
                            <div class="scheme-actions">
                                ${mode === 'compare' ? 
                                    `<button class="btn btn-outline select-a" data-id="${scheme.id}">选作A</button>
                                     <button class="btn btn-outline select-b" data-id="${scheme.id}">选作B</button>` :
                                    `<button class="btn btn-primary load-btn" data-id="${scheme.id}">加载</button>
                                     <button class="btn btn-secondary delete-btn" data-id="${scheme.id}">删除</button>`
                                }
                            </div>
                        </div>
                    `;
                }
                
                schemesHtml += '</div>';
                
                if (mode === 'compare') {
                    schemesHtml += `
                        <div class="compare-selection">
                            <p>已选择: <span id="selected-a">无</span> vs <span id="selected-b">无</span></p>
                            <div class="compare-actions">
                                <button id="start-compare" class="btn btn-primary" disabled>开始对比</button>
                                <button id="cancel-compare" class="btn btn-secondary">取消</button>
                            </div>
                        </div>
                    `;
                }
                
                modalBody.innerHTML = schemesHtml;
                
                // 添加样式
                const style = document.createElement('style');
                style.textContent = `
                    .scheme-list {
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    .scheme-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 1rem;
                        border: 1px solid #e0e0e0;
                        border-radius: 4px;
                        margin-bottom: 0.5rem;
                    }
                    .scheme-item:hover {
                        background-color: #f9f9f9;
                    }
                    .scheme-info h4 {
                        margin: 0 0 0.25rem 0;
                    }
                    .scheme-meta {
                        margin: 0;
                        font-size: 0.875rem;
                        color: #666;
                    }
                    .scheme-actions {
                        display: flex;
                        gap: 0.5rem;
                    }
                    .no-schemes {
                        text-align: center;
                        padding: 2rem;
                    }
                    .compare-selection {
                        margin-top: 1rem;
                        padding-top: 1rem;
                        border-top: 1px solid #e0e0e0;
                    }
                    .compare-actions {
                        display: flex;
                        gap: 0.5rem;
                        margin-top: 0.5rem;
                    }
                    #selected-a, #selected-b {
                        font-weight: bold;
                        color: #3498db;
                    }
                `;
                modalBody.appendChild(style);
                
                if (mode === 'compare') {
                    let selectedA = null;
                    let selectedB = null;
                    
                    const updateSelection = () => {
                        document.getElementById('selected-a').textContent = 
                            selectedA ? schemes.find(s => s.id === selectedA)?.name : '无';
                        document.getElementById('selected-b').textContent = 
                            selectedB ? schemes.find(s => s.id === selectedB)?.name : '无';
                        
                        const compareBtn = document.getElementById('start-compare');
                        compareBtn.disabled = !(selectedA && selectedB && selectedA !== selectedB);
                    };
                    
                    document.querySelectorAll('.select-a').forEach(btn => {
                        btn.onclick = () => {
                            selectedA = btn.dataset.id;
                            updateSelection();
                        };
                    });
                    
                    document.querySelectorAll('.select-b').forEach(btn => {
                        btn.onclick = () => {
                            selectedB = btn.dataset.id;
                            updateSelection();
                        };
                    });
                    
                    document.getElementById('start-compare').onclick = () => {
                        modal.style.display = 'none';
                        if (onSelect) {
                            onSelect({ action: 'compare', schemeA: selectedA, schemeB: selectedB });
                        }
                    };
                    
                    document.getElementById('cancel-compare').onclick = () => {
                        modal.style.display = 'none';
                    };
                    
                } else {
                    // 加载模式
                    document.querySelectorAll('.load-btn').forEach(btn => {
                        btn.onclick = () => {
                            modal.style.display = 'none';
                            if (onSelect) {
                                onSelect({ action: 'load', schemeId: btn.dataset.id });
                            }
                        };
                    });
                    
                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const schemeId = btn.dataset.id;
                            if (confirm('确定要删除这个方案吗？')) {
                                this.deleteScheme(schemeId);
                                Utils.showNotification('方案已删除', 'info');
                                // 重新显示列表
                                this.showSchemeList(mode, onSelect);
                            }
                        };
                    });
                }
            }
        }
        
        modal.style.display = 'block';
        
        // 关闭按钮
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
        
        // 点击外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    },
    
    // 导出方案为JSON
    exportSchemeAsJson: function(scheme) {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            scheme: {
                name: scheme.name,
                createdAt: scheme.createdAt,
                data: scheme.data,
                risks: scheme.risks || []
            }
        };
        
        return JSON.stringify(exportData, null, 2);
    },
    
    // 从JSON导入方案
    importSchemeFromJson: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.scheme || !data.scheme.data) {
                return {
                    success: false,
                    error: '无效的方案文件格式'
                };
            }
            
            return {
                success: true,
                scheme: {
                    id: Utils.generateId(),
                    name: data.scheme.name || '导入的方案',
                    createdAt: data.scheme.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    data: data.scheme.data,
                    risks: data.scheme.risks || []
                }
            };
        } catch (e) {
            return {
                success: false,
                error: '解析JSON失败: ' + e.message
            };
        }
    }
};
