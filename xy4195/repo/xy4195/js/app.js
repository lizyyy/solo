// 主应用程序
const App = {
    // 应用状态
    state: {
        data: null,
        risks: [],
        currentScheme: null,
        modified: false,
        selectedElement: null,
        history: [],
        historyIndex: -1,
        settings: {
            showBeams: true,
            showGlare: true,
            showVisibility: true,
            showPaths: true
        }
    },
    
    // 初始化应用
    init: function() {
        console.log('展柜光照眩光排练板 - 初始化中...');
        
        // 初始化画布
        const canvas = document.getElementById('main-canvas');
        Visualization.init(canvas);
        
        // 初始化交互
        Interaction.init(canvas, this.state);
        
        // 设置交互回调
        Interaction.onElementDrag = (element, finished) => {
            this.render();
            this.updateRiskList();
            if (finished) {
                Interaction.saveHistory(this.state);
            }
        };
        
        // 设置键盘事件
        document.addEventListener('keydown', (e) => {
            Interaction.handleKeyDown(e, this.state);
            this.render();
            this.updateRiskList();
        });
        
        // 绑定UI事件
        this.bindEvents();
        
        // 窗口大小变化
        window.addEventListener('resize', () => {
            Visualization.resize();
            this.render();
        });
        
        console.log('应用初始化完成');
    },
    
    // 绑定UI事件
    bindEvents: function() {
        // 文件导入按钮
        document.getElementById('load-example-btn').addEventListener('click', () => {
            this.loadExampleData();
        });
        
        // 文件上传
        document.getElementById('case-json').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'case');
        });
        
        document.getElementById('lights-csv').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'lights');
        });
        
        document.getElementById('materials-csv').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'materials');
        });
        
        document.getElementById('paths-json').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'paths');
        });
        
        // 视图切换
        document.getElementById('plan-view-btn').addEventListener('click', () => {
            this.setViewMode('plan');
        });
        
        document.getElementById('section-view-btn').addEventListener('click', () => {
            this.setViewMode('section');
        });
        
        // 显示设置
        document.getElementById('show-beams').addEventListener('change', (e) => {
            this.state.settings.showBeams = e.target.checked;
            this.render();
        });
        
        document.getElementById('show-glare').addEventListener('change', (e) => {
            this.state.settings.showGlare = e.target.checked;
            this.render();
        });
        
        document.getElementById('show-visibility').addEventListener('change', (e) => {
            this.state.settings.showVisibility = e.target.checked;
            this.render();
        });
        
        document.getElementById('show-paths').addEventListener('change', (e) => {
            this.state.settings.showPaths = e.target.checked;
            this.render();
        });
        
        // 顶部按钮
        document.getElementById('import-btn').addEventListener('click', () => {
            Utils.showNotification('请使用侧边栏的文件选择器导入数据', 'info');
        });
        
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveScheme();
        });
        
        document.getElementById('compare-btn').addEventListener('click', () => {
            this.showComparison();
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        // 画布双击编辑
        const canvas = document.getElementById('main-canvas');
        canvas.addEventListener('dblclick', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const element = Visualization.getElementAtPosition(x, y, this.state.data);
            if (element && element.type === 'light') {
                Interaction.showLightProperties(element.element, (updatedLight => {
                    // 重新计算风险
                    if (this.state.data) {
                        this.state.risks = Geometry.evaluateAllRisks(this.state.data);
                    }
                    this.render();
                    this.updateRiskList();
                    this.state.modified = true;
                    Interaction.saveHistory(this.state);
                });
            }
        });
    },
    
    // 加载示例数据
    loadExampleData: function() {
        console.log('加载示例数据...');
        
        // 示例数据
        const exampleData = {
            cases: [
                {
                    id: 'case_1',
                    name: '主展柜',
                    width: 2.0,
                    height: 1.2,
                    depth: 0.6,
                    position: { x: 0, y: 0 },
                    glass: {
                        front: true,
                        reflectivity: 0.08
                    },
                    infoPanel: {
                        position: { x: 1.0, y: 0.2, z: 1.0 },
                        width: 0.4,
                        height: 0.3,
                        angle: 0
                    }
                },
                {
                    id: 'case_2',
                    name: '副展柜',
                    width: 1.5,
                    height: 1.0,
                    depth: 0.5,
                    position: { x: 3.0, y: 0 },
                    glass: {
                        front: true,
                        reflectivity: 0.08
                    },
                    infoPanel: {
                        position: { x: 0.75, y: 0.2, z: 0.9 },
                        width: 0.3,
                        height: 0.25,
                        angle: 0
                    }
                }
            ],
            lights: [
                {
                    id: 'light_1',
                    position: { x: 0.5, y: -1.5, z: 2.5 },
                    angle: { x: 60, y: 90, z: 0 },
                    intensity: 1500,
                    beamAngle: 35
                },
                {
                    id: 'light_2',
                    position: { x: 1.5, y: -1.5, z: 2.5 },
                    angle: { x: 60, y: 90, z: 0 },
                    intensity: 1200,
                    beamAngle: 30
                },
                {
                    id: 'light_3',
                    position: { x: 3.5, y: -1.2, z: 2.2 },
                    angle: { x: 55, y: 90, z: 0 },
                    intensity: 1800,
                    beamAngle: 40
                }
            ],
            artifacts: [
                {
                    id: 'artifact_1',
                    name: '古代书画',
                    material: '纸张',
                    maxIlluminance: 50,
                    sensitivity: '高',
                    position: { x: 0.6, y: 0.4, z: 0.8 }
                },
                {
                    id: 'artifact_2',
                    name: '陶瓷花瓶',
                    material: '陶瓷',
                    maxIlluminance: 500,
                    sensitivity: '低',
                    position: { x: 1.4, y: 0.4, z: 0.6 }
                },
                {
                    id: 'artifact_3',
                    name: '青铜器',
                    material: '金属',
                    maxIlluminance: 1000,
                    sensitivity: '低',
                    position: { x: 3.5, y: 0.3, z: 0.7 }
                }
            ],
            paths: [
                {
                    id: 'path_1',
                    name: '主动线',
                    type: 'main',
                    points: [
                        { x: -1.0, y: 2.0, z: 1.6, name: '入口' },
                        { x: 1.0, y: 2.0, z: 1.6, name: '观展点1' },
                        { x: 2.0, y: 2.0, z: 1.6, name: '观展点2' },
                        { x: 4.0, y: 2.0, z: 1.6, name: '出口' }
                    ]
                }
            ]
        };
        
        this.state.data = exampleData;
        this.state.currentScheme = null;
        this.state.modified = false;
        
        // 计算风险
        this.state.risks = Geometry.evaluateAllRisks(this.state.data);
        
        // 保存历史
        Interaction.saveHistory(this.state);
        
        // 渲染
        this.render();
        this.updateRiskList();
        this.updateCanvasInfo();
        
        Utils.showNotification('示例数据已加载', 'success');
    },
    
    // 处理文件上传
    handleFileUpload: function(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            let result;
            
            switch (type) {
                case 'case':
                    result = Parser.parseCaseJson(content);
                    if (result.success) {
                        if (!this.state.data) this.state.data = {};
                        this.state.data.cases = result.data.cases;
                    }
                    break;
                    
                case 'lights':
                    result = Parser.parseLightsCsv(content);
                    if (result.success) {
                        if (!this.state.data) this.state.data = {};
                        this.state.data.lights = result.data.lights;
                    }
                    break;
                    
                case 'materials':
                    result = Parser.parseMaterialsCsv(content);
                    if (result.success) {
                        if (!this.state.data) this.state.data = {};
                        this.state.data.artifacts = result.data.artifacts;
                    }
                    break;
                    
                case 'paths':
                    result = Parser.parsePathsJson(content);
                    if (result.success) {
                        if (!this.state.data) this.state.data = {};
                        this.state.data.paths = result.data.paths;
                    }
                    break;
            }
            
            if (result && result.success) {
                this.state.modified = true;
                
                // 如果所有数据都已加载，计算风险
                if (this.state.data && 
                    this.state.data.cases && 
                    this.state.data.lights) {
                    this.state.risks = Geometry.evaluateAllRisks(this.state.data);
                }
                
                this.render();
                this.updateRiskList();
                this.updateCanvasInfo();
                
                const typeNames = {
                    case: '展柜尺寸',
                    lights: '灯具角度',
                    materials: '文物材质',
                    paths: '观众动线'
                };
                
                Utils.showNotification(`${typeNames[type]}数据导入成功`, 'success');
            } else if (result) {
                Utils.showNotification(`导入失败: ${result.error}`, 'error');
            }
        };
        
        reader.onerror = () => {
            Utils.showNotification('文件读取失败', 'error');
        };
        
        reader.readAsText(file);
    },
    
    // 设置视图模式
    setViewMode: function(mode) {
        Visualization.setViewMode(mode);
        
        // 更新按钮状态
        document.getElementById('plan-view-btn').classList.toggle('active', mode === 'plan');
        document.getElementById('section-view-btn').classList.toggle('active', mode === 'section');
        
        this.render();
    },
    
    // 渲染画布
    render: function() {
        Visualization.draw(this.state.data, this.state.settings, this.state.risks);
    },
    
    // 更新风险列表
    updateRiskList: function() {
        const listElement = document.getElementById('risks-list');
        
        if (!this.state.risks || this.state.risks.length === 0) {
            listElement.innerHTML = '<p class="no-data">暂无风险数据</p>';
            return;
        }
        
        let html = '';
        
        for (const risk of this.state.risks) {
            const severityClass = risk.severity;
            const typeNames = {
                illuminance: '照度超标',
                glare: '直接眩光',
                reflection: '反射眩光',
                visibility: '说明牌可见性',
                direct: '直接眩光'
            };
            
            html += `
                <div class="risk-item ${severityClass}">
                    <strong>${typeNames[risk.type] || risk.type}</strong><br>
                    ${risk.description}
                </div>
            `;
        }
        
        listElement.innerHTML = html;
    },
    
    // 更新画布信息
    updateCanvasInfo: function() {
        const infoElement = document.getElementById('canvas-info');
        
        if (!this.state.data) {
            infoElement.innerHTML = '<span>请先导入数据或加载示例数据</span>';
            return;
        }
        
        const caseCount = this.state.data.cases?.length || 0;
        const lightCount = this.state.data.lights?.length || 0;
        const riskCount = this.state.risks?.length || 0;
        const highRisks = (this.state.risks || []).filter(r => r.severity === 'high').length;
        
        let statusText = `展柜: ${caseCount} | 灯具: ${lightCount}`;
        if (riskCount > 0) {
            statusText += ` | 风险: ${riskCount} (高风险: ${highRisks})`;
        }
        
        if (this.state.modified) {
            statusText += ' | ⚠️ 未保存';
        }
        
        infoElement.innerHTML = `<span>${statusText}</span>`;
    },
    
    // 保存方案
    saveScheme: function() {
        if (!this.state.data) {
            Utils.showNotification('没有可保存的数据', 'warning');
            return;
        }
        
        Storage.showSchemeList('save', (result) => {
            if (result.action === 'save') {
                // 将风险数据保存到data中以便导出
                const saveData = {
                    ...this.state.data,
                    risks: this.state.risks
                };
                
                const saveResult = Storage.saveScheme(saveData, result.name);
                
                if (saveResult.success) {
                    this.state.currentScheme = saveResult.scheme;
                    this.state.modified = false;
                    this.updateCanvasInfo();
                    Utils.showNotification('方案保存成功', 'success');
                } else {
                    Utils.showNotification(`保存失败: ${saveResult.error}`, 'error');
                }
            }
        });
    },
    
    // 显示对比
    showComparison: function() {
        Storage.showSchemeList('compare', (result) => {
            if (result.action === 'compare') {
                const schemeA = Storage.getScheme(result.schemeA);
                const schemeB = Storage.getScheme(result.schemeB);
                
                if (!schemeA || !schemeB) {
                    Utils.showNotification('无法加载方案数据', 'error');
                    return;
                }
                
                // 显示对比容器
                const compareContainer = document.getElementById('compare-container');
                compareContainer.style.display = 'block';
                
                // 绘制对比视图
                const canvasA = document.getElementById('compare-canvas-a');
                const canvasB = document.getElementById('compare-canvas-b');
                
                Visualization.drawComparison(canvasA, canvasB, schemeA.data, schemeB.data, this.state.settings);
                
                // 计算对比结果
                const comparison = Storage.compareSchemes(schemeA, schemeB);
                
                // 更新对比摘要
                const summaryElement = document.getElementById('compare-summary');
                let summaryHtml = `<p><strong>对比结果:</strong></p>`;
                summaryHtml += `<ul>`;
                
                for (const diff of comparison.differences) {
                    const emoji = diff.type === 'improvement' ? '✅' : '⚠️';
                    summaryHtml += `<li>${emoji} ${diff.description}</li>`;
                }
                
                summaryHtml += `</ul>`;
                summaryHtml += `<p><a href="#" id="export-comparison" class="btn btn-outline">导出对比报告</a></p>`;
                
                summaryElement.innerHTML = summaryHtml;
                
                // 绑定导出按钮
                document.getElementById('export-comparison').onclick = (e) => {
                    e.preventDefault();
                    const report = Export.exportComparisonReport(comparison, schemeA, schemeB);
                    Utils.downloadFile(
                        report,
                        `方案对比_${new Date().toISOString().slice(0, 10)}.md`,
                        'text/markdown'
                    );
                    Utils.showNotification('对比报告已导出', 'success');
                };
            }
        });
    },
    
    // 导出数据
    exportData: function() {
        if (!this.state.data) {
            Utils.showNotification('没有可导出的数据', 'warning');
            return;
        }
        
        Export.showExportOptions(
            this.state.data,
            this.state.risks,
            this.state.currentScheme
        );
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
