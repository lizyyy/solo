const Renderer = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    config: {
        noteSize: 40,
        noteSpeed: 400,
        judgeLineY: 0,
        trackPadding: 50,
        trackWidth: 0,
        noteSpacing: 10
    },

    uiElements: {
        scoreElement: null,
        comboElement: null,
        maxComboElement: null,
        judgementElement: null
    },

    animationFrame: null,
    lastJudgement: null,
    judgementTimer: 0,

    init: function(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found');
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Failed to get canvas context');
            return false;
        }

        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));

        this.initUIElements();

        return true;
    },

    resizeCanvas: function() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.config.judgeLineY = this.height * 0.85;
        this.config.trackWidth = (this.width - this.config.trackPadding * 2) / 4;
    },

    initUIElements: function() {
        this.uiElements.scoreElement = document.getElementById('score');
        this.uiElements.comboElement = document.getElementById('combo');
        this.uiElements.maxComboElement = document.getElementById('max-combo');
        this.uiElements.judgementElement = document.getElementById('judgement');
    },

    clear: function() {
        if (!this.ctx) return;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);
    },

    drawBackground: function() {
        if (!this.ctx) return;

        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, 'rgba(26, 26, 46, 0.8)');
        gradient.addColorStop(0.5, 'rgba(22, 33, 62, 0.8)');
        gradient.addColorStop(1, 'rgba(15, 52, 96, 0.8)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    },

    drawTracks: function() {
        if (!this.ctx) return;

        const trackColors = [
            'rgba(255, 107, 107, 0.1)',
            'rgba(151, 117, 250, 0.1)',
            'rgba(81, 207, 102, 0.1)',
            'rgba(255, 212, 59, 0.1)'
        ];

        for (let i = 0; i < 4; i++) {
            const x = this.config.trackPadding + i * this.config.trackWidth;
            const width = this.config.trackWidth;

            this.ctx.fillStyle = trackColors[i];
            this.ctx.fillRect(x, 0, width, this.height);

            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + width, 0);
            this.ctx.lineTo(x + width, this.height);
            this.ctx.stroke();
        }
    },

    drawJudgeLine: function() {
        if (!this.ctx) return;

        const gradient = this.ctx.createLinearGradient(0, this.config.judgeLineY, this.width, this.config.judgeLineY);
        gradient.addColorStop(0, 'rgba(233, 69, 96, 0)');
        gradient.addColorStop(0.5, 'rgba(233, 69, 96, 0.8)');
        gradient.addColorStop(1, 'rgba(233, 69, 96, 0)');

        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.config.judgeLineY);
        this.ctx.lineTo(this.width, this.config.judgeLineY);
        this.ctx.stroke();

        const noteTypes = ['left', 'down', 'up', 'right'];
        const glowColors = [
            'rgba(255, 107, 107, 0.5)',
            'rgba(151, 117, 250, 0.5)',
            'rgba(81, 207, 102, 0.5)',
            'rgba(255, 212, 59, 0.5)'
        ];

        for (let i = 0; i < 4; i++) {
            const x = this.config.trackPadding + i * this.config.trackWidth + this.config.trackWidth / 2;
            const y = this.config.judgeLineY;

            const glow = this.ctx.createRadialGradient(x, y, 0, x, y, this.config.noteSize);
            glow.addColorStop(0, glowColors[i]);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');

            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.config.noteSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
    },

    drawNote: function(note, currentTime) {
        if (!this.ctx) return;

        const noteTypeIndex = this.getNoteTypeIndex(note.type);
        const x = this.config.trackPadding + noteTypeIndex * this.config.trackWidth + this.config.trackWidth / 2;
        
        const timeUntilJudge = note.time - currentTime;
        const y = this.config.judgeLineY - (timeUntilJudge * this.config.noteSpeed / 1000);

        if (y < -this.config.noteSize || y > this.height + this.config.noteSize) {
            return;
        }

        const noteState = Scoring.getNoteState(note.id);
        const color = Chart.NOTE_COLORS[note.type];

        if (noteState === 'pending') {
            this.drawActiveNote(x, y, color, note.type);
        } else if (noteState === 'perfect' || noteState === 'good') {
            this.drawHitEffect(x, y, color, noteState);
        } else if (noteState === 'miss') {
            this.drawMissEffect(x, y);
        }
    },

    drawActiveNote: function(x, y, color, noteType) {
        const glow = this.ctx.createRadialGradient(x, y, 0, x, y, this.config.noteSize);
        glow.addColorStop(0, color);
        glow.addColorStop(0.7, color + '80');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.noteSize, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.noteSize * 0.7, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const directionSymbols = {
            left: '←',
            down: '↓',
            up: '↑',
            right: '→'
        };

        this.ctx.fillText(directionSymbols[noteType], x, y);
    },

    drawHitEffect: function(x, y, color, judgement) {
        const alpha = 0.5;
        this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.noteSize * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
    },

    drawMissEffect: function(x, y) {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.config.noteSize * 1.2, 0, Math.PI * 2);
        this.ctx.fill();
    },

    getNoteTypeIndex: function(noteType) {
        const types = ['left', 'down', 'up', 'right'];
        return types.indexOf(noteType);
    },

    updateUI: function(stats) {
        if (this.uiElements.scoreElement) {
            this.uiElements.scoreElement.textContent = stats.score.toLocaleString();
        }
        if (this.uiElements.comboElement) {
            this.uiElements.comboElement.textContent = stats.combo;
        }
        if (this.uiElements.maxComboElement) {
            this.uiElements.maxComboElement.textContent = stats.maxCombo;
        }
    },

    showJudgement: function(judgement) {
        if (!this.uiElements.judgementElement) return;

        const element = this.uiElements.judgementElement;
        element.textContent = judgement.toUpperCase();
        element.className = `show ${judgement}`;

        setTimeout(() => {
            element.className = 'hidden';
        }, 500);
    },

    drawBeatEffect: function(beatCount) {
        if (!this.ctx) return;

        const alpha = 0.1 + (beatCount % 2) * 0.05;
        this.ctx.fillStyle = `rgba(233, 69, 96, ${alpha})`;
        this.ctx.fillRect(0, this.config.judgeLineY - 10, this.width, 20);
    },

    render: function(notes, currentTime, stats, beatCount) {
        this.clear();
        this.drawBackground();
        this.drawTracks();
        this.drawJudgeLine();

        if (beatCount > 0) {
            this.drawBeatEffect(beatCount);
        }

        for (const note of notes) {
            this.drawNote(note, currentTime);
        }

        this.updateUI(stats);
    },

    renderEditor: function(editorData) {
        this.clear();
        this.drawBackground();
        this.drawTracks();

        if (editorData && editorData.notes) {
            for (const note of editorData.notes) {
                const noteTypeIndex = this.getNoteTypeIndex(note.type);
                const x = this.config.trackPadding + noteTypeIndex * this.config.trackWidth + this.config.trackWidth / 2;
                const y = this.height * 0.5 + note.time / 10;

                if (y >= 0 && y <= this.height) {
                    const color = Chart.NOTE_COLORS[note.type];
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 15, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }
};
