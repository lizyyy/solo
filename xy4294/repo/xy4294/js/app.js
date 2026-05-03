/**
 * 主应用入口
 * 整合所有模块并处理用户交互
 */

(function() {
    'use strict';

    let playInterval = null;
    let lastTimeIndex = 0;

    document.addEventListener('DOMContentLoaded', function() {
        console.log('冷链仓库3D货架巡检可视化器启动中...');

        try {
            initRenderer();
            initEventListeners();
            initStateSubscriptions();
            showMessage('应用启动成功！点击"加载示例数据"开始体验', 'info');
        } catch (error) {
            console.error('应用初始化失败:', error);
            showMessage('应用初始化失败: ' + error.message, 'error');
        }
    });

    /**
     * 初始化3D渲染器
     */
    function initRenderer() {
        if (window.Renderer3D) {
            Renderer3D.init('canvas-container');
        } else {
            throw new Error('Renderer3D 模块未加载');
        }
    }

    /**
     * 初始化事件监听器
     */
    function initEventListeners() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
        }

        const loadSampleBtn = document.getElementById('load-sample-btn');
        if (loadSampleBtn) {
            loadSampleBtn.addEventListener('click', loadSampleData);
        }

        const exportBtn = document.getElementById('export-btn');
        const exportMenu = document.getElementById('export-menu');
        
        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                exportMenu.classList.toggle('visible');
            });

            document.addEventListener('click', function() {
                exportMenu.classList.remove('visible');
            });

            exportMenu.addEventListener('click', function(e) {
                e.stopPropagation();
            });

            exportMenu.querySelectorAll('.export-menu-item').forEach(item => {
                item.addEventListener('click', function() {
                    const format = this.getAttribute('data-format');
                    handleExport(format);
                    exportMenu.classList.remove('visible');
                });
            });
        }

        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.addEventListener('click', handleCanvasClick);
        }

        const infoClose = document.getElementById('info-close');
        if (infoClose) {
            infoClose.addEventListener('click', closeInfoPanel);
        }

        initFilterListeners();
        initDisplayListeners();
        initTimelineListeners();
        initMarkListeners();
    }

    /**
     * 初始化筛选器监听器
     */
    function initFilterListeners() {
        const riskFilter = document.getElementById('risk-filter');
        const riskTypeFilter = document.getElementById('risk-type-filter');
        const areaFilter = document.getElementById('area-filter');
        const skuFilter = document.getElementById('sku-filter');

        if (riskFilter) {
            riskFilter.addEventListener('change', function() {
                StateManager.setFilter('riskLevel', this.value);
                applyFilters();
            });
        }

        if (riskTypeFilter) {
            riskTypeFilter.addEventListener('change', function() {
                StateManager.setFilter('riskType', this.value);
                applyFilters();
            });
        }

        if (areaFilter) {
            areaFilter.addEventListener('change', function() {
                StateManager.setFilter('area', this.value);
                applyFilters();
            });
        }

        if (skuFilter) {
            let timeoutId;
            skuFilter.addEventListener('input', function() {
                clearTimeout(timeoutId);
                const self = this;
                timeoutId = setTimeout(function() {
                    StateManager.setFilter('sku', self.value);
                    applyFilters();
                }, 300);
            });
        }
    }

    /**
     * 初始化显示选项监听器
     */
    function initDisplayListeners() {
        const heatmapToggle = document.getElementById('heatmap-toggle');
        const pathToggle = document.getElementById('path-toggle');
        const opacitySlider = document.getElementById('opacity-slider');

        if (heatmapToggle) {
            heatmapToggle.addEventListener('change', function() {
                const show = this.value === 'show';
                StateManager.setDisplayOption('showHeatmap', show);
                Renderer3D.setDisplayOptions({ showHeatmap: show });
            });
        }

        if (pathToggle) {
            pathToggle.addEventListener('change', function() {
                const show = this.value === 'show';
                StateManager.setDisplayOption('showPath', show);
                Renderer3D.setDisplayOptions({ showPath: show });
            });
        }

        if (opacitySlider) {
            opacitySlider.addEventListener('input', function() {
                const opacity = this.value / 100;
                StateManager.setDisplayOption('opacity', opacity);
                Renderer3D.setDisplayOptions({ opacity: opacity });
            });
        }
    }

    /**
     * 初始化时间轴监听器
     */
    function initTimelineListeners() {
        const timelineSlider = document.getElementById('timeline-slider');
        const playBtn = document.getElementById('play-btn');
        const playPrev = document.getElementById('play-prev');
        const playNext = document.getElementById('play-next');
        const playSpeed = document.getElementById('play-speed');

        if (timelineSlider) {
            timelineSlider.addEventListener('input', function() {
                const index = parseInt(this.value);
                StateManager.setTimelineIndex(index);
                updateTimeline(index);
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', togglePlay);
        }

        if (playPrev) {
            playPrev.addEventListener('click', function() {
                const timeline = StateManager.getTimeline();
                const newIndex = Math.max(0, timeline.currentIndex - 1);
                StateManager.setTimelineIndex(newIndex);
                updateTimeline(newIndex);
            });
        }

        if (playNext) {
            playNext.addEventListener('click', function() {
                const timeline = StateManager.getTimeline();
                const maxIndex = Math.max(0, timeline.timestamps.length - 1);
                const newIndex = Math.min(maxIndex, timeline.currentIndex + 1);
                StateManager.setTimelineIndex(newIndex);
                updateTimeline(newIndex);
            });
        }

        if (playSpeed) {
            playSpeed.addEventListener('change', function() {
                StateManager.setPlaySpeed(parseFloat(this.value));
            });
        }
    }

    /**
     * 初始化标记监听器
     */
    function initMarkListeners() {
        const markSubmit = document.getElementById('mark-submit');
        
        if (markSubmit) {
            markSubmit.addEventListener('click', function() {
                const selectedSlot = StateManager.getSelectedSlot();
                if (!selectedSlot) {
                    showMessage('请先选择一个货位', 'error');
                    return;
                }

                const markStatus = document.getElementById('mark-status');
                const markNotes = document.getElementById('mark-notes');

                const mark = {
                    status: markStatus ? markStatus.value : 'pending',
                    notes: markNotes ? markNotes.value : ''
                };

                StateManager.addMark(selectedSlot.key, mark);
                showMessage('标记已保存', 'success');
            });
        }
    }

    /**
     * 初始化状态订阅
     */
    function initStateSubscriptions() {
        if (!window.StateManager) return;

        StateManager.subscribe(StateManager.EVENTS.DATA_LOADED, function(data) {
            console.log('数据已加载:', data);
        });

        StateManager.subscribe(StateManager.EVENTS.RISK_ANALYZED, function(riskAnalysis) {
            updateStatsPanel(riskAnalysis);
            applyFilters();
        });

        StateManager.subscribe(StateManager.EVENTS.SLOT_SELECTED, function(selectedSlot) {
            showSlotInfo(selectedSlot);
            Renderer3D.selectSlot(selectedSlot.key);
        });

        StateManager.subscribe(StateManager.EVENTS.SLOT_DESELECTED, function() {
            closeInfoPanel();
            Renderer3D.deselectAllSlots();
        });

        StateManager.subscribe(StateManager.EVENTS.TIMELINE_CHANGED, function(timeline) {
            updateTimelineUI(timeline);
        });

        StateManager.subscribe(StateManager.EVENTS.MARK_ADDED, function({ slotKey, mark }) {
            console.log(`标记已添加: ${slotKey}`, mark);
        });
    }

    /**
     * 处理文件选择
     */
    function handleFileSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        showLoading(true);

        const promises = Array.from(files).map(file => {
            return DataParser.parseFile(file)
                .then(result => {
                    console.log(`文件解析成功: ${file.name}`, result);
                    return result;
                })
                .catch(error => {
                    console.error(`文件解析失败: ${file.name}`, error);
                    showMessage(`文件解析失败: ${file.name} - ${error.message}`, 'error');
                    return null;
                });
        });

        Promise.all(promises)
            .then(results => {
                results.forEach(result => {
                    if (!result) return;

                    switch (result.type) {
                        case 'racks':
                            StateManager.setRacksData(result.data);
                            StateManager.setLoadedFile('racks', result.fileName);
                            Renderer3D.renderRacks(result.data);
                            updateAreaOptions(result.data.areas);
                            showMessage(`货架数据已加载: ${result.data.racks.length} 个货架`, 'success');
                            break;
                        case 'temperature':
                            StateManager.setTemperatureData(result.data);
                            StateManager.setLoadedFile('temperature', result.fileName);
                            Renderer3D.updateHeatmap(result.data);
                            showMessage(`温度数据已加载: ${result.data.records.length} 条记录`, 'success');
                            break;
                        case 'trajectory':
                            StateManager.setTrajectoryData(result.data);
                            StateManager.setLoadedFile('trajectory', result.fileName);
                            Renderer3D.renderTrajectories(result.data);
                            showMessage(`轨迹数据已加载: ${result.data.trajectories.size} 辆叉车`, 'success');
                            break;
                        case 'expiring':
                            StateManager.setExpiringData(result.data);
                            StateManager.setLoadedFile('expiring', result.fileName);
                            showMessage(`临期数据已加载: ${result.data.products.length} 件货品`, 'success');
                            break;
                    }
                });

                event.target.value = '';
            })
            .finally(() => {
                showLoading(false);
            });
    }

    /**
     * 加载示例数据
     */
    function loadSampleData() {
        showLoading(true);

        setTimeout(() => {
            try {
                const sampleRacks = generateSampleRacks();
                const sampleTemperature = generateSampleTemperature(sampleRacks);
                const sampleTrajectory = generateSampleTrajectory(sampleRacks);
                const sampleExpiring = generateSampleExpiring(sampleRacks);

                StateManager.setRacksData(sampleRacks);
                StateManager.setLoadedFile('racks', 'sample_racks.json');
                Renderer3D.renderRacks(sampleRacks);
                updateAreaOptions(sampleRacks.areas);

                StateManager.setTemperatureData(sampleTemperature);
                StateManager.setLoadedFile('temperature', 'sample_temperature.csv');
                Renderer3D.updateHeatmap(sampleTemperature);

                StateManager.setTrajectoryData(sampleTrajectory);
                StateManager.setLoadedFile('trajectory', 'sample_trajectory.jsonl');
                Renderer3D.renderTrajectories(sampleTrajectory);

                StateManager.setExpiringData(sampleExpiring);
                StateManager.setLoadedFile('expiring', 'sample_expiring.json');

                showMessage('示例数据已加载成功！', 'success');
            } catch (error) {
                console.error('加载示例数据失败:', error);
                showMessage('加载示例数据失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }, 500);
    }

    /**
     * 生成示例货架数据
     */
    function generateSampleRacks() {
        const racks = [];
        
        const areas = ['A区', 'B区', 'C区'];
        
        areas.forEach((area, areaIndex) => {
            for (let i = 1; i <= 4; i++) {
                const rack = {
                    id: `${area.charAt(0)}${i}`,
                    name: `${area}货架${i}`,
                    area: area,
                    position: {
                        x: areaIndex * 8 + (i - 1) * 2.5,
                        y: 0,
                        z: i % 2 === 0 ? 6 : -6
                    },
                    dimensions: {
                        width: 2,
                        height: 4,
                        depth: 1
                    },
                    levels: 4,
                    slotsPerLevel: 5,
                    slots: []
                };

                for (let level = 1; level <= rack.levels; level++) {
                    for (let pos = 1; pos <= rack.slotsPerLevel; pos++) {
                        rack.slots.push({
                            id: `${rack.id}-L${level}-P${pos}`,
                            level: level,
                            position: pos,
                            occupied: Math.random() > 0.3
                        });
                    }
                }

                racks.push(rack);
            }
        });

        return {
            metadata: {
                warehouse: '冷链仓库一号库',
                date: new Date().toISOString().split('T')[0]
            },
            racks: racks,
            rackMap: new Map(racks.map(r => [r.id, r])),
            areas: areas
        };
    }

    /**
     * 生成示例温度数据
     */
    function generateSampleTemperature(racksData) {
        const records = [];
        const tempMap = new Map();
        const timestamps = [];

        const baseTime = new Date();
        baseTime.setHours(8, 0, 0, 0);

        for (let h = 0; h < 12; h++) {
            const time = new Date(baseTime.getTime() + h * 3600000);
            const timestamp = time.toISOString();
            timestamps.push(timestamp);

            racksData.racks.forEach(rack => {
                rack.slots.forEach(slot => {
                    let baseTemp = -16 + (Math.random() - 0.5) * 2;
                    
                    if (rack.area === 'C区' && slot.level === 3) {
                        baseTemp = -10 + (Math.random() - 0.5) * 3;
                    }
                    
                    if (rack.id === 'A2' && slot.level === 2 && slot.position >= 3) {
                        baseTemp = -8 + (Math.random() - 0.5) * 2;
                    }

                    const record = {
                        rackId: rack.id,
                        slotId: slot.id,
                        level: slot.level,
                        position: slot.position,
                        temperature: baseTemp,
                        timestamp: timestamp,
                        area: rack.area
                    };

                    records.push(record);

                    if (!tempMap.has(slot.id)) {
                        tempMap.set(slot.id, []);
                    }
                    tempMap.get(slot.id).push(record);
                });
            });
        }

        return {
            records: records,
            tempMap: tempMap,
            timestamps: timestamps,
            hasTimestamp: true
        };
    }

    /**
     * 生成示例轨迹数据
     */
    function generateSampleTrajectory(racksData) {
        const trajectories = new Map();
        const allPoints = [];

        const forklifts = ['叉车01', '叉车02'];

        const baseTime = new Date();
        baseTime.setHours(8, 0, 0, 0);

        forklifts.forEach((forkliftId, idx) => {
            const points = [];
            const startX = idx * 15;
            const startZ = idx === 0 ? -8 : 8;

            for (let i = 0; i < 50; i++) {
                const time = new Date(baseTime.getTime() + i * 60000 * 5);
                
                let x = startX + (Math.sin(i * 0.3) + 1) * 5;
                let z = startZ + (Math.cos(i * 0.2) + 1) * 3;

                if (i > 20 && idx === 1) {
                    x = 28 + Math.sin(i * 0.1) * 2;
                    z = 8 + Math.cos(i * 0.1) * 2;
                }

                const point = {
                    forkliftId: forkliftId,
                    timestamp: time.toISOString(),
                    x: x,
                    y: 0,
                    z: z,
                    speed: 1.5 + Math.random() * 2,
                    action: i % 10 === 0 ? 'loading' : 'moving',
                    index: i
                };

                points.push(point);
                allPoints.push(point);
            }

            trajectories.set(forkliftId, points);
        });

        const timestamps = [...new Set(allPoints.map(p => p.timestamp))]
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        return {
            trajectories: trajectories,
            allPoints: allPoints,
            forkliftIds: forklifts,
            timestamps: timestamps,
            hasTimestamp: true
        };
    }

    /**
     * 生成示例临期货品数据
     */
    function generateSampleExpiring(racksData) {
        const products = [];

        const productNames = ['进口牛排', '冷冻虾仁', '冰淇淋', '速冻饺子', '冷冻鸡肉', '海鲜礼包'];
        const skus = ['SKU001', 'SKU002', 'SKU003', 'SKU004', 'SKU005', 'SKU006'];

        const highPrioritySlots = [
            'C1-L4-P3', 'C1-L4-P4', 'C2-L3-P2',
            'A3-L2-P5', 'B4-L1-P3'
        ];

        highPrioritySlots.forEach((slotId, i) => {
            const rack = racksData.racks.find(r => slotId.startsWith(r.id));
            products.push({
                productId: `PRD-${1001 + i}`,
                name: productNames[i % productNames.length],
                sku: skus[i % skus.length],
                slotId: slotId,
                rackId: rack ? rack.id : null,
                level: parseInt(slotId.match(/L(\d+)/)[1]),
                position: parseInt(slotId.match(/P(\d+)/)[1]),
                quantity: Math.floor(Math.random() * 50) + 10,
                daysUntilExpiry: i < 3 ? 1 : 2,
                priority: i < 3 ? 'high' : 'medium',
                isBlocked: i < 2,
                expiryDate: new Date(Date.now() + (i < 3 ? 1 : 2) * 86400000).toISOString().split('T')[0]
            });
        });

        for (let i = 0; i < 10; i++) {
            const rack = racksData.racks[Math.floor(Math.random() * racksData.racks.length)];
            const level = Math.floor(Math.random() * 4) + 1;
            const pos = Math.floor(Math.random() * 5) + 1;
            const slotId = `${rack.id}-L${level}-P${pos}`;

            products.push({
                productId: `PRD-${2001 + i}`,
                name: productNames[(i + 3) % productNames.length],
                sku: skus[(i + 3) % skus.length],
                slotId: slotId,
                rackId: rack.id,
                level: level,
                position: pos,
                quantity: Math.floor(Math.random() * 30) + 5,
                daysUntilExpiry: Math.floor(Math.random() * 5) + 3,
                priority: 'low',
                isBlocked: false,
                expiryDate: new Date(Date.now() + (Math.floor(Math.random() * 5) + 3) * 86400000).toISOString().split('T')[0]
            });
        }

        const productMap = new Map();
        products.forEach(p => {
            if (p.slotId) {
                productMap.set(p.slotId, p);
            }
        });

        return {
            products: products,
            productMap: productMap,
            highPriority: products.filter(p => p.priority === 'high' || p.daysUntilExpiry <= 1),
            mediumPriority: products.filter(p => p.priority === 'medium' || (p.daysUntilExpiry > 1 && p.daysUntilExpiry <= 3)),
            lowPriority: products.filter(p => p.priority === 'low' || p.daysUntilExpiry > 3)
        };
    }

    /**
     * 处理导出
     */
    function handleExport(format) {
        if (!StateManager.hasData()) {
            showMessage('请先加载数据', 'error');
            return;
        }

        const state = StateManager.getState();
        
        try {
            Exporter.exportReport(format, state);
            showMessage(`报告已导出为 ${format.toUpperCase()} 格式`, 'success');
        } catch (error) {
            console.error('导出失败:', error);
            showMessage('导出失败: ' + error.message, 'error');
        }
    }

    /**
     * 处理画布点击
     */
    function handleCanvasClick(event) {
        if (!Renderer3D) return;

        const userData = Renderer3D.raycast(event.clientX, event.clientY);
        
        if (userData && userData.slotId) {
            StateManager.selectSlot(userData.slotId, userData.slotData);
        } else {
            StateManager.deselectSlot();
        }
    }

    /**
     * 显示货位信息
     */
    function showSlotInfo(selectedSlot) {
        const infoPanel = document.getElementById('info-panel');
        const infoTitle = document.getElementById('info-title');
        const infoContent = document.getElementById('info-content');
        const markStatus = document.getElementById('mark-status');
        const markNotes = document.getElementById('mark-notes');

        if (!infoPanel) return;

        infoTitle.textContent = `货位: ${selectedSlot.key}`;

        let html = '';

        if (selectedSlot.risks && selectedSlot.risks.length > 0) {
            html += '<div class="info-item">';
            html += '<span class="info-item-label">风险:</span>';
            selectedSlot.risks.forEach(risk => {
                const levelClass = `risk-${risk.level}`;
                const levelDesc = RiskRules.getRiskLevelDescription(risk.level);
                const typeDesc = RiskRules.getRiskTypeDescription(risk.type);
                html += `<span class="risk-badge ${levelClass}">${levelDesc} - ${typeDesc}</span>`;
            });
            html += '</div>';
        }

        if (selectedSlot.temperature && selectedSlot.temperature.length > 0) {
            const latestTemp = selectedSlot.temperature[selectedSlot.temperature.length - 1];
            html += `<div class="info-item">`;
            html += `<span class="info-item-label">当前温度:</span>`;
            html += `<span class="info-item-value">${latestTemp.temperature.toFixed(1)}°C</span>`;
            html += `</div>`;

            if (selectedSlot.temperature.length > 1) {
                html += `<div class="info-item">`;
                html += `<span class="info-item-label">温度记录:</span>`;
                html += `<span class="info-item-value">共 ${selectedSlot.temperature.length} 条</span>`;
                html += `</div>`;
            }
        }

        if (selectedSlot.expiring && selectedSlot.expiring.length > 0) {
            selectedSlot.expiring.forEach(product => {
                html += `<div class="info-item">`;
                html += `<span class="info-item-label">货品:</span>`;
                html += `<span class="info-item-value">${product.name || '未命名'}</span>`;
                html += `</div>`;

                if (product.sku) {
                    html += `<div class="info-item">`;
                    html += `<span class="info-item-label">SKU:</span>`;
                    html += `<span class="info-item-value">${product.sku}</span>`;
                    html += `</div>`;
                }

                if (product.quantity) {
                    html += `<div class="info-item">`;
                    html += `<span class="info-item-label">数量:</span>`;
                    html += `<span class="info-item-value">${product.quantity}</span>`;
                    html += `</div>`;
                }

                if (product.daysUntilExpiry !== null && product.daysUntilExpiry !== undefined) {
                    html += `<div class="info-item">`;
                    html += `<span class="info-item-label">剩余天数:</span>`;
                    html += `<span class="info-item-value" style="color: ${product.daysUntilExpiry <= 1 ? '#e94560' : '#ffc107'}">${product.daysUntilExpiry} 天</span>`;
                    html += `</div>`;
                }

                if (product.isBlocked) {
                    html += `<div class="info-item">`;
                    html += `<span class="info-item-label">状态:</span>`;
                    html += `<span class="info-item-value" style="color: #e94560">⚠️ 被堵在深处</span>`;
                    html += `</div>`;
                }
            });
        }

        if (selectedSlot.data) {
            html += `<div class="info-item">`;
            html += `<span class="info-item-label">层级:</span>`;
            html += `<span class="info-item-value">第 ${selectedSlot.data.level} 层</span>`;
            html += `</div>`;

            html += `<div class="info-item">`;
            html += `<span class="info-item-label">位置:</span>`;
            html += `<span class="info-item-value">第 ${selectedSlot.data.position} 位</span>`;
            html += `</div>`;

            html += `<div class="info-item">`;
            html += `<span class="info-item-label">占用状态:</span>`;
            html += `<span class="info-item-value">${selectedSlot.data.occupied ? '已占用' : '空闲'}</span>`;
            html += `</div>`;
        }

        const existingMark = StateManager.getMark(selectedSlot.key);
        if (existingMark) {
            html += `<div class="info-item">`;
            html += `<span class="info-item-label">处理状态:</span>`;
            html += `<span class="info-item-value">${getMarkStatusDescription(existingMark.status)}</span>`;
            html += `</div>`;

            if (existingMark.notes) {
                html += `<div class="info-item">`;
                html += `<span class="info-item-label">处理备注:</span>`;
                html += `<span class="info-item-value">${existingMark.notes}</span>`;
                html += `</div>`;
            }
        }

        infoContent.innerHTML = html;

        if (existingMark && markStatus) {
            markStatus.value = existingMark.status;
        }
        if (existingMark && markNotes) {
            markNotes.value = existingMark.notes || '';
        } else if (markNotes) {
            markNotes.value = '';
        }

        infoPanel.classList.add('visible');
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
     * 关闭信息面板
     */
    function closeInfoPanel() {
        const infoPanel = document.getElementById('info-panel');
        if (infoPanel) {
            infoPanel.classList.remove('visible');
        }
    }

    /**
     * 更新统计面板
     */
    function updateStatsPanel(riskAnalysis) {
        const summary = riskAnalysis.summary;

        const highRiskCount = document.getElementById('high-risk-count');
        const mediumRiskCount = document.getElementById('medium-risk-count');
        const lowRiskCount = document.getElementById('low-risk-count');
        const tempAnomalyCount = document.getElementById('temp-anomaly-count');
        const missedAreaCount = document.getElementById('missed-area-count');
        const expiringCount = document.getElementById('expiring-count');

        if (highRiskCount) highRiskCount.textContent = summary.highRiskCount || 0;
        if (mediumRiskCount) mediumRiskCount.textContent = summary.mediumRiskCount || 0;
        if (lowRiskCount) lowRiskCount.textContent = summary.lowRiskCount || 0;
        
        if (tempAnomalyCount) {
            const temp = summary.temperature || {};
            tempAnomalyCount.textContent = (temp.highTempSlots || 0) + (temp.warningTempSlots || 0);
        }
        
        if (missedAreaCount) {
            const missed = summary.missed || {};
            missedAreaCount.textContent = (missed.missedAreas || 0) + (missed.partialCoverageAreas || 0);
        }
        
        if (expiringCount) {
            const expiring = summary.expiring || {};
            expiringCount.textContent = (expiring.highPriority || 0) + (expiring.mediumPriority || 0);
        }
    }

    /**
     * 更新区域选项
     */
    function updateAreaOptions(areas) {
        const areaFilter = document.getElementById('area-filter');
        if (!areaFilter || !areas) return;

        const currentValue = areaFilter.value;
        
        areaFilter.innerHTML = '<option value="all">全部区域</option>';
        
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            if (area === currentValue) {
                option.selected = true;
            }
            areaFilter.appendChild(option);
        });
    }

    /**
     * 应用筛选条件
     */
    function applyFilters() {
        const filters = StateManager.getFilters();
        const riskAnalysis = StateManager.getRiskAnalysis();

        if (riskAnalysis) {
            Renderer3D.applyFilters(filters, riskAnalysis);
        } else {
            Renderer3D.resetSlotVisibility();
        }
    }

    /**
     * 更新时间轴
     */
    function updateTimeline(index) {
        const tempData = StateManager.getTemperatureData();
        const trajData = StateManager.getTrajectoryData();

        if (tempData) {
            Renderer3D.updateHeatmap(tempData, index);
        }

        if (trajData) {
            Renderer3D.updateForkliftPosition(index);
        }

        lastTimeIndex = index;
    }

    /**
     * 更新时间轴UI
     */
    function updateTimelineUI(timeline) {
        const slider = document.getElementById('timeline-slider');
        const indicator = document.getElementById('time-indicator');
        const playBtn = document.getElementById('play-btn');

        if (slider && timeline.timestamps && timeline.timestamps.length > 0) {
            slider.max = timeline.timestamps.length - 1;
            slider.value = timeline.currentIndex;
        }

        if (indicator) {
            if (timeline.timestamps && timeline.timestamps[timeline.currentIndex]) {
                const time = new Date(timeline.timestamps[timeline.currentIndex]);
                indicator.textContent = `时间: ${time.toLocaleTimeString('zh-CN')}`;
            } else {
                indicator.textContent = `时间: 00:00:00 (共 ${timeline.currentIndex + 1} 帧)`;
            }
        }

        if (playBtn) {
            if (timeline.isPlaying) {
                playBtn.textContent = '⏸';
                playBtn.classList.add('active');
            } else {
                playBtn.textContent = '▶';
                playBtn.classList.remove('active');
            }
        }
    }

    /**
     * 切换播放状态
     */
    function togglePlay() {
        const timeline = StateManager.getTimeline();
        
        if (timeline.isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    }

    /**
     * 开始播放
     */
    function startPlayback() {
        const timeline = StateManager.getTimeline();
        const maxIndex = Math.max(0, timeline.timestamps.length - 1);

        if (maxIndex === 0) {
            showMessage('没有可用的时间序列数据', 'info');
            return;
        }

        StateManager.playTimeline();

        const speed = timeline.speed;
        const interval = 1000 / speed;

        if (playInterval) {
            clearInterval(playInterval);
        }

        playInterval = setInterval(() => {
            const currentTimeline = StateManager.getTimeline();
            const currentMax = Math.max(0, currentTimeline.timestamps.length - 1);
            let newIndex = currentTimeline.currentIndex + 1;

            if (newIndex > currentMax) {
                newIndex = 0;
            }

            StateManager.setTimelineIndex(newIndex);
            updateTimeline(newIndex);
        }, interval);
    }

    /**
     * 暂停播放
     */
    function pausePlayback() {
        StateManager.pauseTimeline();

        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    }

    /**
     * 显示/隐藏加载状态
     */
    function showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.toggle('visible', show);
        }
    }

    /**
     * 显示消息提示
     */
    function showMessage(message, type = 'info') {
        const toast = document.getElementById('message-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `message-toast ${type} visible`;

        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    }

})();
