/**
 * 主入口文件
 * 负责初始化应用和绑定全局事件
 */

const App = {
    // 当前待导入的数据
    pendingImportData: null,
    
    /**
     * 初始化应用
     */
    init() {
        // 初始化所有模块
        DataManager.init();
        Visualization.init();
        Filters.init();
        Comparison.init();
        Storage.init();
        Report.init();
        
        // 绑定全局事件
        this.bindGlobalEvents();
        
        // 检查是否有已保存的数据
        this.checkExistingData();
        
        // 绑定标签页切换
        this.bindTabEvents();
        
        console.log('🏸 羽毛球训练复盘工具已启动');
    },
    
    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // 导入数据按钮
        const importDataBtn = document.getElementById('importDataBtn');
        const browseBtn = document.getElementById('browseBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
        
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }
        
        // 拖拽上传
        const dropZone = document.getElementById('dropZone');
        
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }
        
        // 加载示例数据按钮
        const loadSampleBtn = document.getElementById('loadSampleBtn');
        if (loadSampleBtn) {
            loadSampleBtn.addEventListener('click', () => {
                this.loadSampleData();
            });
        }
        
        // 导入模态框事件
        const cancelImportBtn = document.getElementById('cancelImportBtn');
        const confirmImportBtn = document.getElementById('confirmImportBtn');
        
        if (cancelImportBtn) {
            cancelImportBtn.addEventListener('click', () => {
                this.hideImportModal();
            });
        }
        
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener('click', () => {
                this.confirmImport();
            });
        }
        
        // 点击模态框外部关闭
        const importModal = document.getElementById('importModal');
        if (importModal) {
            importModal.addEventListener('click', (e) => {
                if (e.target === importModal) {
                    this.hideImportModal();
                }
            });
        }
    },
    
    /**
     * 绑定标签页切换事件
     */
    bindTabEvents() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId);
            });
        });
    },
    
    /**
     * 切换标签页
     * @param {string} tabId 标签页ID
     */
    switchTab(tabId) {
        // 更新按钮状态
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active', 'bg-blue-600', 'text-white');
                btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
            } else {
                btn.classList.remove('active', 'bg-blue-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
            }
        });
        
        // 更新内容显示
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            if (content.id === `${tabId}Tab`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });
        
        // 特殊处理：切换到导出标签页时更新下拉选项
        if (tabId === 'export' || tabId === 'comparison' || tabId === 'notes') {
            Comparison.updateComparisonOptions();
        }
    },
    
    /**
     * 处理文件选择
     * @param {File} file 文件对象
     */
    handleFileSelect(file) {
        if (!file) return;
        
        // 检查文件类型
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.json')) {
            Utils.showToast('只支持 CSV 或 JSON 格式的文件', 'error');
            return;
        }
        
        // 根据文件类型处理
        if (fileName.endsWith('.csv')) {
            DataManager.importCSV(file, (result) => {
                this.handleImportResult(result);
            });
        } else {
            DataManager.importJSON(file, (result) => {
                this.handleImportResult(result);
            });
        }
    },
    
    /**
     * 处理导入结果
     * @param {Object} result 导入结果
     */
    handleImportResult(result) {
        if (result.success) {
            // 保存待导入数据
            this.pendingImportData = result.data;
            
            // 显示导入确认模态框
            this.showImportModal(result.data, result.fileName);
        } else {
            // 显示错误信息
            const errorMessage = result.errors.join('\n');
            Utils.showToast(`导入失败：${errorMessage}`, 'error');
            
            // 也可以在页面上显示详细错误
            const importResult = document.getElementById('importResult');
            if (importResult) {
                importResult.classList.remove('hidden');
                importResult.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 class="text-red-800 font-semibold mb-2">导入失败</h4>
                        <ul class="text-red-600 text-sm space-y-1">
                            ${result.errors.map(e => `<li>• ${e}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }
    },
    
    /**
     * 显示导入确认模态框
     * @param {Object} data 导入的数据
     * @param {string} fileName 文件名
     */
    showImportModal(data, fileName) {
        const modal = document.getElementById('importModal');
        const content = document.getElementById('importModalContent');
        
        if (!modal || !content) return;
        
        // 生成预览内容
        const previewContent = this.generateImportPreview(data, fileName);
        content.innerHTML = previewContent;
        
        // 显示模态框
        modal.classList.remove('hidden');
    },
    
    /**
     * 隐藏导入模态框
     */
    hideImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.pendingImportData = null;
    },
    
    /**
     * 生成导入预览内容
     * @param {Object} data 导入的数据
     * @param {string} fileName 文件名
     * @returns {string} HTML内容
     */
    generateImportPreview(data, fileName) {
        const previewRows = data.data.slice(0, 5);
        
        return `
            <div class="space-y-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 class="text-blue-800 font-semibold mb-2">文件信息</h4>
                    <p class="text-blue-700"><strong>文件名：</strong>${fileName}</p>
                    <p class="text-blue-700"><strong>总拍数：</strong>${data.totalShots}</p>
                    <p class="text-blue-700"><strong>参与球员：</strong>${data.players.join(', ')}</p>
                    <p class="text-blue-700"><strong>训练日期：</strong>${data.trainingDate || '未知'}</p>
                </div>
                
                <div>
                    <h4 class="text-gray-800 font-semibold mb-2">数据预览（前5条）</h4>
                    <div class="overflow-x-auto">
                        <table class="min-w-full border border-gray-200 rounded-lg text-sm">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-3 py-2 text-left">球员</th>
                                    <th class="px-3 py-2 text-left">拍型</th>
                                    <th class="px-3 py-2 text-left">落点X</th>
                                    <th class="px-3 py-2 text-left">落点Y</th>
                                    <th class="px-3 py-2 text-left">回合结果</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${previewRows.map(row => `
                                    <tr class="border-t border-gray-200">
                                        <td class="px-3 py-2">${row['球员'] || '-'}</td>
                                        <td class="px-3 py-2">${row['拍型'] || '-'}</td>
                                        <td class="px-3 py-2">${row['落点X'] !== undefined ? row['落点X'].toFixed(2) : '-'}</td>
                                        <td class="px-3 py-2">${row['落点Y'] !== undefined ? row['落点Y'].toFixed(2) : '-'}</td>
                                        <td class="px-3 py-2">
                                            <span class="px-2 py-1 rounded text-xs ${
                                                row['回合结果'] === '得分' ? 'bg-green-100 text-green-800' :
                                                row['回合结果'] === '失分' ? 'bg-red-100 text-red-800' :
                                                'bg-gray-100 text-gray-800'
                                            }">
                                                ${row['回合结果'] || '-'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${data.data.length > 5 ? `<p class="text-gray-500 text-sm mt-2">... 还有 ${data.data.length - 5} 条记录</p>` : ''}
                </div>
                
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 class="text-green-800 font-semibold mb-2">✓ 数据校验通过</h4>
                    <p class="text-green-700 text-sm">数据格式正确，可以导入。点击"确认导入"完成导入。</p>
                </div>
            </div>
        `;
    },
    
    /**
     * 确认导入
     */
    confirmImport() {
        if (!this.pendingImportData) {
            Utils.showToast('没有待导入的数据', 'warning');
            return;
        }
        
        // 添加数据
        const dataId = DataManager.addTrainingData(this.pendingImportData);
        
        // 设置为当前数据
        DataManager.setCurrentData(dataId);
        
        // 隐藏模态框
        this.hideImportModal();
        
        // 显示主内容区域
        this.showMainContent();
        
        // 更新所有相关组件
        this.updateAllComponents();
        
        Utils.showToast('数据导入成功！', 'success');
    },
    
    /**
     * 加载示例数据
     */
    loadSampleData() {
        // 检查是否已存在示例数据
        const existingSummaries = DataManager.getAllTrainingDataSummaries();
        const hasSampleData = existingSummaries.some(s => s.name.includes('示例训练数据'));
        
        if (hasSampleData) {
            const overwrite = confirm('已存在示例数据，是否重新生成？');
            if (!overwrite) {
                // 直接选择第一个示例数据
                const sampleData = existingSummaries.find(s => s.name.includes('示例训练数据'));
                if (sampleData) {
                    DataManager.setCurrentData(sampleData.id);
                    this.showMainContent();
                    this.updateAllComponents();
                }
                return;
            }
        }
        
        // 生成示例数据
        DataManager.generateAndAddSampleData();
        
        // 获取第一个示例数据并设置为当前
        const summaries = DataManager.getAllTrainingDataSummaries();
        if (summaries.length > 0) {
            DataManager.setCurrentData(summaries[0].id);
        }
        
        // 显示主内容区域
        this.showMainContent();
        
        // 更新所有相关组件
        this.updateAllComponents();
        
        Utils.showToast('示例数据加载成功！', 'success');
    },
    
    /**
     * 检查是否有已保存的数据
     */
    checkExistingData() {
        const summaries = DataManager.getAllTrainingDataSummaries();
        
        if (summaries.length > 0) {
            // 如果有保存的数据，显示选择界面或自动加载第一个
            // 这里暂时选择自动加载第一个
            DataManager.setCurrentData(summaries[0].id);
            this.showMainContent();
            this.updateAllComponents();
        }
    },
    
    /**
     * 显示主内容区域
     */
    showMainContent() {
        // 隐藏导入区域
        const importArea = document.getElementById('importArea');
        if (importArea) {
            importArea.classList.add('hidden');
        }
        
        // 显示统计概览
        const statsOverview = document.getElementById('statsOverview');
        if (statsOverview) {
            statsOverview.classList.remove('hidden');
        }
        
        // 显示筛选区域
        const filterArea = document.getElementById('filterArea');
        if (filterArea) {
            filterArea.classList.remove('hidden');
        }
        
        // 显示主内容
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.classList.remove('hidden');
        }
    },
    
    /**
     * 更新所有相关组件
     */
    updateAllComponents() {
        const currentData = DataManager.getCurrentData();
        if (!currentData) return;
        
        // 更新筛选选项
        Filters.updateFilterOptions(currentData.data);
        
        // 更新统计信息
        Filters.updateStats();
        
        // 更新图表
        Visualization.updateAllCharts(DataManager.filteredData);
        
        // 更新对比选项
        Comparison.updateComparisonOptions();
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
