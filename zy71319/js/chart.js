const ChartManager = {
    chart: null,
    dataPoints: [],

    init() {
        const ctx = document.getElementById('density-chart');
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: '漂浮物体',
                        data: [],
                        backgroundColor: 'rgba(72, 187, 120, 0.8)',
                        borderColor: 'rgba(72, 187, 120, 1)',
                        borderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 12,
                        showLine: false
                    },
                    {
                        label: '悬浮物体',
                        data: [],
                        backgroundColor: 'rgba(66, 153, 225, 0.8)',
                        borderColor: 'rgba(66, 153, 225, 1)',
                        borderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 12,
                        showLine: false
                    },
                    {
                        label: '下沉物体',
                        data: [],
                        backgroundColor: 'rgba(237, 137, 54, 0.8)',
                        borderColor: 'rgba(237, 137, 54, 1)',
                        borderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 12,
                        showLine: false
                    },
                    {
                        label: '密度参考线 (ρ液)',
                        data: [],
                        type: 'line',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 11
                            },
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                if (point.label) {
                                    return [
                                        point.label,
                                        `密度: ${point.x.toFixed(3)} g/cm³`,
                                        `浮力: ${point.y.toFixed(3)} N`,
                                        `状态: ${point.stateLabel}`
                                    ];
                                }
                                return null;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '物体密度 (g/cm³)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '浮力 (N)',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        beginAtZero: true
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;
                        const point = this.chart.data.datasets[datasetIndex].data[index];
                        if (point && point.recordId) {
                            App.showRecordDetail(point.recordId);
                        }
                    }
                }
            }
        });

        this.loadRecords();
    },

    loadRecords() {
        const records = Storage.getRecords();
        this.dataPoints = [];
        
        for (const record of records) {
            if (record.analysis) {
                this.dataPoints.push({
                    x: record.analysis.objectDensity,
                    y: record.analysis.buoyancy,
                    label: record.name,
                    stateLabel: record.analysis.stateLabel,
                    recordId: record.id,
                    status: record.status
                });
            }
        }
        
        this.updateChart();
    },

    addDataPoint(record) {
        if (record.analysis) {
            this.dataPoints.push({
                x: record.analysis.objectDensity,
                y: record.analysis.buoyancy,
                label: record.name,
                stateLabel: record.analysis.stateLabel,
                recordId: record.id,
                status: record.status
            });
            this.updateChart();
        }
    },

    removeDataPoint(recordId) {
        this.dataPoints = this.dataPoints.filter(p => p.recordId !== recordId);
        this.updateChart();
    },

    updateChart(liquidDensity = 1.0) {
        if (!this.chart) return;

        const floating = this.dataPoints.filter(p => p.x < liquidDensity);
        const suspended = this.dataPoints.filter(p => Math.abs(p.x - liquidDensity) < 0.001);
        const sinking = this.dataPoints.filter(p => p.x > liquidDensity);

        const maxX = Math.max(...this.dataPoints.map(p => p.x), liquidDensity * 1.5, 1);
        const referenceLine = [
            { x: 0, y: 0 },
            { x: maxX, y: 0 }
        ];

        this.chart.data.datasets[0].data = floating;
        this.chart.data.datasets[1].data = suspended;
        this.chart.data.datasets[2].data = sinking;
        this.chart.data.datasets[3].data = referenceLine;

        const originalCallback = this.chart.options.plugins.tooltip.callbacks.label;
        this.chart.options.plugins.annotation = {
            annotations: {
                liquidDensityLine: {
                    type: 'line',
                    xMin: liquidDensity,
                    xMax: liquidDensity,
                    borderColor: 'rgba(102, 126, 234, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: `ρ液 = ${liquidDensity.toFixed(2)} g/cm³`,
                        position: 'end',
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        font: {
                            size: 10
                        }
                    }
                }
            }
        };

        this.chart.update();
    },

    clear() {
        this.dataPoints = [];
        this.updateChart();
    },

    exportChartAsImage() {
        if (!this.chart) return null;
        return this.chart.toBase64Image();
    }
};
