/**
 * 可视化模块
 * 负责绘制热力图、统计图表等
 */

const Visualization = {
    // 图表实例
    charts: {
        singlesCourt: null,
        doublesCourt: null,
        shotType: null,
        result: null,
        player: null,
        timePeriod: null,
        comparisonHeatmap1: null,
        comparisonHeatmap2: null
    },
    
    /**
     * 初始化可视化模块
     */
    init() {
        // 初始化所有图表容器
        this.initCharts();
        
        // 监听窗口大小变化
        window.addEventListener('resize', Utils.debounce(() => {
            this.resizeAllCharts();
        }, 300));
    },
    
    /**
     * 初始化图表
     */
    initCharts() {
        // 单打场地热力图
        const singlesCourtDom = document.getElementById('singlesCourt');
        if (singlesCourtDom) {
            this.charts.singlesCourt = echarts.init(singlesCourtDom);
        }
        
        // 双打场地热力图
        const doublesCourtDom = document.getElementById('doublesCourt');
        if (doublesCourtDom) {
            this.charts.doublesCourt = echarts.init(doublesCourtDom);
        }
        
        // 拍型分布图表
        const shotTypeDom = document.getElementById('shotTypeChart');
        if (shotTypeDom) {
            this.charts.shotType = echarts.init(shotTypeDom);
        }
        
        // 回合结果图表
        const resultDom = document.getElementById('resultChart');
        if (resultDom) {
            this.charts.result = echarts.init(resultDom);
        }
        
        // 球员得分图表
        const playerDom = document.getElementById('playerChart');
        if (playerDom) {
            this.charts.player = echarts.init(playerDom);
        }
        
        // 时间段分布图表
        const timePeriodDom = document.getElementById('timePeriodChart');
        if (timePeriodDom) {
            this.charts.timePeriod = echarts.init(timePeriodDom);
        }
        
        // 对比热力图1
        const comparisonHeatmap1Dom = document.getElementById('comparisonHeatmap1');
        if (comparisonHeatmap1Dom) {
            this.charts.comparisonHeatmap1 = echarts.init(comparisonHeatmap1Dom);
        }
        
        // 对比热力图2
        const comparisonHeatmap2Dom = document.getElementById('comparisonHeatmap2');
        if (comparisonHeatmap2Dom) {
            this.charts.comparisonHeatmap2 = echarts.init(comparisonHeatmap2Dom);
        }
    },
    
    /**
     * 调整所有图表大小
     */
    resizeAllCharts() {
        for (const [name, chart] of Object.entries(this.charts)) {
            if (chart && chart.resize) {
                chart.resize();
            }
        }
    },
    
    /**
     * 绘制羽毛球场地热力图
     * @param {Array} data 数据数组
     * @param {string} courtType 场地类型 ('singles' 或 'doubles')
     * @param {Object} options 配置选项
     */
    drawCourtHeatmap(data, courtType = 'singles', options = {}) {
        const chart = courtType === 'singles' ? this.charts.singlesCourt : this.charts.doublesCourt;
        if (!chart) return;
        
        // 获取场地尺寸
        const courtConfig = courtType === 'singles' ? CONFIG.court.singles : CONFIG.court.doubles;
        const halfWidth = courtConfig.width / 2;
        const halfLength = courtConfig.length / 2;
        
        // 准备热力图数据
        const heatmapData = this.prepareHeatmapData(data, courtType);
        
        // 准备场地背景标记
        const courtMarkers = this.createCourtMarkers(courtType);
        
        // 配置选项
        const option = {
            title: {
                text: options.title || (courtType === 'singles' ? '单打场地落点热力图' : '双打场地落点热力图'),
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.seriesName === '热力图') {
                        return `落点数量: ${params.value[2]}`;
                    }
                    return params.name;
                }
            },
            grid: {
                left: '10%',
                right: '10%',
                top: '15%',
                bottom: '10%'
            },
            xAxis: {
                type: 'value',
                min: -halfWidth - 0.5,
                max: halfWidth + 0.5,
                name: '横向位置 (米)',
                nameLocation: 'middle',
                nameGap: 20,
                splitLine: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                min: -halfLength - 0.5,
                max: halfLength + 0.5,
                name: '纵向位置 (米)',
                nameLocation: 'middle',
                nameGap: 30,
                splitLine: {
                    show: false
                }
            },
            visualMap: {
                show: true,
                min: 0,
                max: this.getMaxHeatmapValue(heatmapData),
                calculable: true,
                orient: 'vertical',
                right: '5%',
                top: 'center',
                inRange: {
                    color: CONFIG.colors.heatmap
                }
            },
            series: [
                // 热力图系列
                {
                    name: '热力图',
                    type: 'heatmap',
                    data: heatmapData,
                    pointSize: CONFIG.heatmap.radius * 50,
                    blurSize: CONFIG.heatmap.blur * 50,
                    minOpacity: CONFIG.heatmap.minOpacity,
                    maxOpacity: CONFIG.heatmap.maxOpacity
                },
                // 场地边界线
                {
                    name: '场地边界',
                    type: 'line',
                    data: courtMarkers.boundary,
                    lineStyle: {
                        color: '#333',
                        width: 2
                    },
                    symbol: 'none',
                    animation: false
                },
                // 中线
                {
                    name: '中线',
                    type: 'line',
                    data: courtMarkers.centerLine,
                    lineStyle: {
                        color: '#333',
                        width: 1,
                        type: 'solid'
                    },
                    symbol: 'none',
                    animation: false
                },
                // 前发球线
                {
                    name: '前发球线',
                    type: 'line',
                    data: courtMarkers.shortServiceLine,
                    lineStyle: {
                        color: '#333',
                        width: 1,
                        type: 'solid'
                    },
                    symbol: 'none',
                    animation: false
                },
                // 单打边线（双打场地显示）
                ...(courtType === 'doubles' ? [{
                    name: '单打边线',
                    type: 'line',
                    data: courtMarkers.singlesSideline,
                    lineStyle: {
                        color: '#666',
                        width: 1,
                        type: 'dashed'
                    },
                    symbol: 'none',
                    animation: false
                }] : [])
            ]
        };
        
        chart.setOption(option, true);
    },
    
    /**
     * 准备热力图数据
     * @param {Array} data 原始数据
     * @param {string} courtType 场地类型
     * @returns {Array} 热力图数据格式 [x, y, value]
     */
    prepareHeatmapData(data, courtType = 'singles') {
        if (!data || data.length === 0) return [];
        
        // 创建网格统计
        const gridSize = 0.3; // 网格大小（米）
        const heatmap = {};
        
        for (const row of data) {
            const x = parseFloat(Validator.getFieldValue(row, '落点X'));
            const y = parseFloat(Validator.getFieldValue(row, '落点Y'));
            
            if (isNaN(x) || isNaN(y)) continue;
            
            // 网格对齐
            const gridX = Math.round(x / gridSize) * gridSize;
            const gridY = Math.round(y / gridSize) * gridSize;
            const key = `${gridX},${gridY}`;
            
            if (!heatmap[key]) {
                heatmap[key] = { x: gridX, y: gridY, count: 0 };
            }
            heatmap[key].count++;
        }
        
        // 转换为ECharts格式
        return Object.values(heatmap).map(item => [item.x, item.y, item.count]);
    },
    
    /**
     * 获取热力图最大值
     * @param {Array} heatmapData 热力图数据
     * @returns {number} 最大值
     */
    getMaxHeatmapValue(heatmapData) {
        if (!heatmapData || heatmapData.length === 0) return 1;
        return Math.max(...heatmapData.map(item => item[2]));
    },
    
    /**
     * 创建场地标记线数据
     * @param {string} courtType 场地类型
     * @returns {Object} 各条线的数据
     */
    createCourtMarkers(courtType = 'singles') {
        const courtConfig = courtType === 'singles' ? CONFIG.court.singles : CONFIG.court.doubles;
        const singlesConfig = CONFIG.court.singles;
        
        const halfWidth = courtConfig.width / 2;
        const halfLength = courtConfig.length / 2;
        const singlesHalfWidth = singlesConfig.width / 2;
        
        // 场地边界
        const boundary = [
            [-halfWidth, -halfLength],
            [halfWidth, -halfLength],
            [halfWidth, halfLength],
            [-halfWidth, halfLength],
            [-halfWidth, -halfLength]
        ];
        
        // 中线（网的位置，Y=0）
        const centerLine = [
            [-halfWidth, 0],
            [halfWidth, 0]
        ];
        
        // 前发球线
        const shortServiceY = -CONFIG.court.shortServiceLine;
        const shortServiceLine = [
            [-singlesHalfWidth, shortServiceY],
            [singlesHalfWidth, shortServiceY]
        ];
        
        // 单打边线（双打场地显示）
        const singlesSideline = [
            [-singlesHalfWidth, -halfLength],
            [-singlesHalfWidth, halfLength],
            [singlesHalfWidth, halfLength],
            [singlesHalfWidth, -halfLength]
        ];
        
        return {
            boundary,
            centerLine,
            shortServiceLine,
            singlesSideline
        };
    },
    
    /**
     * 绘制拍型分布图表
     * @param {Array} data 数据数组
     */
    drawShotTypeChart(data) {
        if (!this.charts.shotType) return;
        
        const shotTypeCounts = Utils.groupBy(data, '拍型');
        const categories = Object.keys(shotTypeCounts);
        const values = categories.map(cat => shotTypeCounts[cat].length);
        
        const option = {
            title: {
                text: '拍型分布统计',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                top: 'middle'
            },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{b}\n{d}%'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                data: categories.map((name, index) => ({
                    value: values[index],
                    name: name
                }))
            }]
        };
        
        this.charts.shotType.setOption(option, true);
    },
    
    /**
     * 绘制回合结果统计图表
     * @param {Array} data 数据数组
     */
    drawResultChart(data) {
        if (!this.charts.result) return;
        
        const resultCounts = Utils.groupBy(data, '回合结果');
        const categories = ['得分', '失分', '继续', '其他'];
        const values = categories.map(cat => resultCounts[cat]?.length || 0);
        
        const colors = [
            CONFIG.colors.success,
            CONFIG.colors.danger,
            CONFIG.colors.neutral,
            CONFIG.colors.warning
        ];
        
        const option = {
            title: {
                text: '回合结果统计',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categories,
                axisLabel: {
                    rotate: 0
                }
            },
            yAxis: {
                type: 'value',
                name: '数量'
            },
            series: [{
                type: 'bar',
                data: values.map((value, index) => ({
                    value: value,
                    itemStyle: {
                        color: colors[index]
                    }
                })),
                label: {
                    show: true,
                    position: 'top',
                    formatter: '{c}'
                },
                barWidth: '60%'
            }]
        };
        
        this.charts.result.setOption(option, true);
    },
    
    /**
     * 绘制球员得分情况图表
     * @param {Array} data 数据数组
     */
    drawPlayerChart(data) {
        if (!this.charts.player) return;
        
        const players = Utils.unique(data, '球员');
        
        // 统计每个球员的得分和失分
        const playerStats = players.map(player => {
            const playerData = data.filter(row => row['球员'] === player);
            const results = Utils.groupBy(playerData, '回合结果');
            return {
                name: player,
                wins: results['得分']?.length || 0,
                losses: results['失分']?.length || 0,
                total: playerData.length
            };
        });
        
        const option = {
            title: {
                text: '球员得失分统计',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            legend: {
                data: ['得分', '失分'],
                top: '10%'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '20%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: players
            },
            yAxis: {
                type: 'value',
                name: '数量'
            },
            series: [
                {
                    name: '得分',
                    type: 'bar',
                    stack: 'total',
                    data: playerStats.map(s => s.wins),
                    itemStyle: {
                        color: CONFIG.colors.success
                    }
                },
                {
                    name: '失分',
                    type: 'bar',
                    stack: 'total',
                    data: playerStats.map(s => s.losses),
                    itemStyle: {
                        color: CONFIG.colors.danger
                    }
                }
            ]
        };
        
        this.charts.player.setOption(option, true);
    },
    
    /**
     * 绘制时间段分布图表
     * @param {Array} data 数据数组
     */
    drawTimePeriodChart(data) {
        if (!this.charts.timePeriod) return;
        
        const timePeriodCounts = Utils.groupBy(data, '时间段');
        const categories = CONFIG.timePeriods.filter(p => timePeriodCounts[p]);
        const values = categories.map(cat => timePeriodCounts[cat]?.length || 0);
        
        const option = {
            title: {
                text: '时间段分布',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'line'
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: categories,
                boundaryGap: false
            },
            yAxis: {
                type: 'value',
                name: '数量'
            },
            series: [{
                type: 'line',
                smooth: true,
                data: values,
                areaStyle: {
                    color: 'rgba(37, 99, 235, 0.2)'
                },
                lineStyle: {
                    color: CONFIG.colors.primary,
                    width: 3
                },
                symbol: 'circle',
                symbolSize: 8
            }]
        };
        
        this.charts.timePeriod.setOption(option, true);
    },
    
    /**
     * 绘制对比热力图
     * @param {Array} data1 数据1
     * @param {Array} data2 数据2
     * @param {string} title1 标题1
     * @param {string} title2 标题2
     */
    drawComparisonHeatmaps(data1, data2, title1 = '数据1', title2 = '数据2') {
        // 绘制第一个热力图
        if (this.charts.comparisonHeatmap1 && data1) {
            this.drawSimpleHeatmap(this.charts.comparisonHeatmap1, data1, title1);
        }
        
        // 绘制第二个热力图
        if (this.charts.comparisonHeatmap2 && data2) {
            this.drawSimpleHeatmap(this.charts.comparisonHeatmap2, data2, title2);
        }
    },
    
    /**
     * 绘制简化版热力图（用于对比）
     * @param {Object} chart ECharts实例
     * @param {Array} data 数据
     * @param {string} title 标题
     */
    drawSimpleHeatmap(chart, data, title) {
        const heatmapData = this.prepareHeatmapData(data, 'singles');
        const courtConfig = CONFIG.court.singles;
        const halfWidth = courtConfig.width / 2;
        const halfLength = courtConfig.length / 2;
        
        const option = {
            title: {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14
                }
            },
            tooltip: {
                trigger: 'item'
            },
            grid: {
                left: '15%',
                right: '15%',
                top: '15%',
                bottom: '10%'
            },
            xAxis: {
                type: 'value',
                min: -halfWidth,
                max: halfWidth,
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                min: -halfLength,
                max: halfLength,
                splitLine: { show: false }
            },
            visualMap: {
                show: true,
                min: 0,
                max: this.getMaxHeatmapValue(heatmapData),
                calculable: true,
                orient: 'horizontal',
                bottom: '5%',
                left: 'center',
                inRange: {
                    color: CONFIG.colors.heatmap
                }
            },
            series: [{
                name: '落点',
                type: 'heatmap',
                data: heatmapData,
                pointSize: 30,
                blurSize: 20
            }]
        };
        
        chart.setOption(option, true);
    },
    
    /**
     * 更新所有图表
     * @param {Array} data 数据数组
     */
    updateAllCharts(data) {
        if (!data || data.length === 0) {
            Utils.showToast('没有数据可显示', 'warning');
            return;
        }
        
        // 更新热力图
        this.drawCourtHeatmap(data, 'singles');
        this.drawCourtHeatmap(data, 'doubles');
        
        // 更新统计图表
        this.drawShotTypeChart(data);
        this.drawResultChart(data);
        this.drawPlayerChart(data);
        this.drawTimePeriodChart(data);
    }
};
