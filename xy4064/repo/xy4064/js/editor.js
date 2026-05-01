const Editor = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    currentChart: {
        id: 'custom_chart_' + Date.now(),
        name: '自定义谱面',
        description: '',
        bpm: 120,
        beatInterval: 0.5,
        notes: []
    },

    currentTime: 0,
    selectedNoteIndex: -1,
    isPlaying: false,
    playStartTime: 0,
    animationFrame: null,

    uiElements: {
        chartNameInput: null,
        bpmInput: null,
        intervalInput: null
    },

    gridConfig: {
        timeScale: 10,
        trackCount: 4,
        trackPadding: 50,
        noteRadius: 15,
        beatLineInterval: 500
    },

    init: function() {
        this.canvas = document.getElementById('editor-canvas');
        if (!this.canvas) {
            console.error('Editor canvas not found');
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Failed to get editor canvas context');
            return false;
        }

        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));

        this.initUIElements();
        this.bindEvents();

        return true;
    },

    resizeCanvas: function() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        this.canvas.width = container.clientWidth;
        this.canvas.height = 300;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    },

    initUIElements: function() {
        this.uiElements.chartNameInput = document.getElementById('chart-name');
        this.uiElements.bpmInput = document.getElementById('chart-bpm');
        this.uiElements.intervalInput = document.getElementById('chart-interval');

        if (this.uiElements.chartNameInput) {
            this.uiElements.chartNameInput.value = this.currentChart.name;
        }
        if (this.uiElements.bpmInput) {
            this.uiElements.bpmInput.value = this.currentChart.bpm;
        }
        if (this.uiElements.intervalInput) {
            this.uiElements.intervalInput.value = this.currentChart.beatInterval;
        }
    },

    bindEvents: function() {
        if (this.canvas) {
            this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        }

        if (this.uiElements.chartNameInput) {
            this.uiElements.chartNameInput.addEventListener('input', (e) => {
                this.currentChart.name = e.target.value || '自定义谱面';
            });
        }

        if (this.uiElements.bpmInput) {
            this.uiElements.bpmInput.addEventListener('change', (e) => {
                const bpm = parseFloat(e.target.value) || 120;
                this.currentChart.bpm = bpm;
                this.currentChart.beatInterval = 60 / bpm;
                if (this.uiElements.intervalInput) {
                    this.uiElements.intervalInput.value = this.currentChart.beatInterval.toFixed(3);
                }
            });
        }

        if (this.uiElements.intervalInput) {
            this.uiElements.intervalInput.addEventListener('change', (e) => {
                const interval = parseFloat(e.target.value) || 0.5;
                this.currentChart.beatInterval = interval;
                this.currentChart.bpm = Math.round(60 / interval);
                if (this.uiElements.bpmInput) {
                    this.uiElements.bpmInput.value = this.currentChart.bpm;
                }
            });
        }

        const directionButtons = {
            'place-left': Chart.NOTE_TYPES.LEFT,
            'place-down': Chart.NOTE_TYPES.DOWN,
            'place-up': Chart.NOTE_TYPES.UP,
            'place-right': Chart.NOTE_TYPES.RIGHT
        };

        for (const [buttonId, noteType] of Object.entries(directionButtons)) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    this.placeNote(noteType);
                });
            }
        }

        const clearButton = document.getElementById('clear-note');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSelectedNote();
            });
        }

        const previewButton = document.getElementById('preview-chart');
        if (previewButton) {
            previewButton.addEventListener('click', () => {
                this.togglePreview();
            });
        }

        const saveButton = document.getElementById('save-chart');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveChart();
            });
        }

        const loadButton = document.getElementById('load-chart');
        if (loadButton) {
            loadButton.addEventListener('click', () => {
                this.loadChart();
            });
        }
    },

    handleCanvasClick: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const trackWidth = (this.width - this.gridConfig.trackPadding * 2) / this.gridConfig.trackCount;
        const trackIndex = Math.floor((x - this.gridConfig.trackPadding) / trackWidth);

        if (trackIndex >= 0 && trackIndex < this.gridConfig.trackCount) {
            const time = (y - this.height * 0.5) * this.gridConfig.timeScale;
            this.currentTime = Math.max(0, Math.round(time / 100) * 100);
            this.selectedNoteIndex = this.findNoteAtPosition(trackIndex, this.currentTime);
            this.render();
        }
    },

    findNoteAtPosition: function(trackIndex, time) {
        const types = ['left', 'down', 'up', 'right'];
        const targetType = types[trackIndex];
        const timeThreshold = 100;

        for (let i = 0; i < this.currentChart.notes.length; i++) {
            const note = this.currentChart.notes[i];
            if (note.type === targetType && Math.abs(note.time - time) < timeThreshold) {
                return i;
            }
        }

        return -1;
    },

    placeNote: function(noteType) {
        const types = ['left', 'down', 'up', 'right'];
        const trackIndex = types.indexOf(noteType);

        if (trackIndex === -1) return;

        const existingIndex = this.findNoteAtPosition(trackIndex, this.currentTime);

        if (existingIndex >= 0) {
            this.currentChart.notes[existingIndex].type = noteType;
            this.currentChart.notes[existingIndex].time = this.currentTime;
        } else {
            this.currentChart.notes.push({
                time: this.currentTime,
                type: noteType,
                id: `note_${Date.now()}_${Math.random()}`
            });
        }

        this.currentChart.notes.sort((a, b) => a.time - b.time);
        this.currentTime += this.currentChart.beatInterval * 1000;
        this.render();
    },

    clearSelectedNote: function() {
        if (this.selectedNoteIndex >= 0) {
            this.currentChart.notes.splice(this.selectedNoteIndex, 1);
            this.selectedNoteIndex = -1;
            this.render();
        }
    },

    togglePreview: function() {
        if (this.isPlaying) {
            this.stopPreview();
        } else {
            this.startPreview();
        }
    },

    startPreview: function() {
        if (this.currentChart.notes.length === 0) {
            alert('请先添加一些音符！');
            return;
        }

        this.isPlaying = true;
        this.currentTime = 0;
        this.playStartTime = performance.now();
        this.animate();

        const previewButton = document.getElementById('preview-chart');
        if (previewButton) {
            previewButton.textContent = '停止预览';
        }
    },

    stopPreview: function() {
        this.isPlaying = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        const previewButton = document.getElementById('preview-chart');
        if (previewButton) {
            previewButton.textContent = '预览谱面';
        }

        this.render();
    },

    animate: function() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsed = now - this.playStartTime;
        this.currentTime = elapsed;

        const maxTime = this.getMaxTime();
        if (this.currentTime > maxTime + 2000) {
            this.stopPreview();
            return;
        }

        this.render();
        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    },

    getMaxTime: function() {
        if (this.currentChart.notes.length === 0) return 0;
        return Math.max(...this.currentChart.notes.map(note => note.time));
    },

    saveChart: function() {
        if (this.currentChart.notes.length === 0) {
            alert('谱面为空，请先添加音符！');
            return;
        }

        if (!this.currentChart.id || this.currentChart.id.startsWith('custom_chart_')) {
            this.currentChart.id = 'custom_' + Date.now();
        }

        const success = Storage.saveCustomChart(this.currentChart);

        if (success) {
            alert('谱面保存成功！');
        } else {
            alert('保存失败，请检查浏览器存储权限。');
        }
    },

    loadChart: function() {
        const customCharts = Storage.getCustomCharts();

        if (customCharts.length === 0) {
            alert('没有找到已保存的自定义谱面。');
            return;
        }

        let chartList = '请选择要加载的谱面（输入编号）：\n\n';
        customCharts.forEach((chart, index) => {
            chartList += `${index + 1}. ${chart.name} (${chart.notes.length}个音符)\n`;
        });

        const input = prompt(chartList);
        if (input === null) return;

        const index = parseInt(input) - 1;
        if (index >= 0 && index < customCharts.length) {
            this.currentChart = JSON.parse(JSON.stringify(customCharts[index]));
            this.updateUIFromChart();
            this.currentTime = 0;
            this.selectedNoteIndex = -1;
            this.render();
            alert('谱面加载成功！');
        } else {
            alert('无效的编号。');
        }
    },

    updateUIFromChart: function() {
        if (this.uiElements.chartNameInput) {
            this.uiElements.chartNameInput.value = this.currentChart.name;
        }
        if (this.uiElements.bpmInput) {
            this.uiElements.bpmInput.value = this.currentChart.bpm;
        }
        if (this.uiElements.intervalInput) {
            this.uiElements.intervalInput.value = this.currentChart.beatInterval;
        }
    },

    clear: function() {
        if (!this.ctx) return;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.width, this.height);
    },

    render: function() {
        this.clear();
        this.drawGrid();
        this.drawTimeIndicator();
        this.drawNotes();

        if (this.isPlaying) {
            this.drawPlayIndicator();
        }
    },

    drawGrid: function() {
        if (!this.ctx) return;

        const trackWidth = (this.width - this.gridConfig.trackPadding * 2) / this.gridConfig.trackCount;
        const trackColors = [
            'rgba(255, 107, 107, 0.1)',
            'rgba(151, 117, 250, 0.1)',
            'rgba(81, 207, 102, 0.1)',
            'rgba(255, 212, 59, 0.1)'
        ];

        for (let i = 0; i < this.gridConfig.trackCount; i++) {
            const x = this.gridConfig.trackPadding + i * trackWidth;
            this.ctx.fillStyle = trackColors[i];
            this.ctx.fillRect(x, 0, trackWidth, this.height);

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + trackWidth, 0);
            this.ctx.lineTo(x + trackWidth, this.height);
            this.ctx.stroke();
        }

        this.ctx.strokeStyle = 'rgba(233, 69, 96, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height * 0.5);
        this.ctx.lineTo(this.width, this.height * 0.5);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('当前时间线', this.width / 2, this.height * 0.5 - 10);

        const centerY = this.height * 0.5;
        const beatIntervalMs = this.currentChart.beatInterval * 1000;
        
        for (let t = 0; t < this.getMaxTime() + 5000; t += beatIntervalMs) {
            const y = centerY + t / this.gridConfig.timeScale;
            if (y > 0 && y < this.height) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(this.gridConfig.trackPadding, y);
                this.ctx.lineTo(this.width - this.gridConfig.trackPadding, y);
                this.ctx.stroke();
            }
        }
    },

    drawTimeIndicator: function() {
        if (!this.ctx) return;

        const centerY = this.height * 0.5;
        const indicatorY = centerY + this.currentTime / this.gridConfig.timeScale;

        if (indicatorY > 0 && indicatorY < this.height) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, indicatorY);
            this.ctx.lineTo(this.width, indicatorY);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${(this.currentTime / 1000).toFixed(1)}s`, 10, indicatorY - 5);
        }
    },

    drawPlayIndicator: function() {
        if (!this.ctx) return;

        const centerY = this.height * 0.5;
        const judgeY = centerY;

        this.ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.gridConfig.trackPadding, judgeY);
        this.ctx.lineTo(this.width - this.gridConfig.trackPadding, judgeY);
        this.ctx.stroke();
    },

    drawNotes: function() {
        if (!this.ctx) return;

        const trackWidth = (this.width - this.gridConfig.trackPadding * 2) / this.gridConfig.trackCount;
        const types = ['left', 'down', 'up', 'right'];
        const centerY = this.height * 0.5;

        for (let i = 0; i < this.currentChart.notes.length; i++) {
            const note = this.currentChart.notes[i];
            const trackIndex = types.indexOf(note.type);
            const x = this.gridConfig.trackPadding + trackIndex * trackWidth + trackWidth / 2;
            const y = centerY + note.time / this.gridConfig.timeScale;

            if (y < -this.gridConfig.noteRadius || y > this.height + this.gridConfig.noteRadius) {
                continue;
            }

            const color = Chart.NOTE_COLORS[note.type];
            const isSelected = i === this.selectedNoteIndex;

            if (isSelected) {
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.gridConfig.noteRadius + 5, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            const glow = this.ctx.createRadialGradient(x, y, 0, x, y, this.gridConfig.noteRadius);
            glow.addColorStop(0, color);
            glow.addColorStop(1, color + '00');
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.gridConfig.noteRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.gridConfig.noteRadius * 0.7, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const directionSymbols = {
                left: '←',
                down: '↓',
                up: '↑',
                right: '→'
            };

            this.ctx.fillText(directionSymbols[note.type], x, y);
        }
    },

    reset: function() {
        this.stopPreview();
        this.currentChart = {
            id: 'custom_chart_' + Date.now(),
            name: '自定义谱面',
            description: '',
            bpm: 120,
            beatInterval: 0.5,
            notes: []
        };
        this.currentTime = 0;
        this.selectedNoteIndex = -1;
        this.updateUIFromChart();
        this.render();
    }
};
