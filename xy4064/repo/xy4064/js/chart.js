const Chart = {
    NOTE_TYPES: {
        LEFT: 'left',
        DOWN: 'down',
        UP: 'up',
        RIGHT: 'right'
    },

    NOTE_COLORS: {
        left: '#ff6b6b',
        down: '#9775fa',
        up: '#51cf66',
        right: '#ffd43b'
    },

    builtInCharts: [],

    init: function() {
        this.builtInCharts = this.createBuiltInCharts();
    },

    createBuiltInCharts: function() {
        return [
            {
                id: 'beginner',
                name: '新手入门',
                description: '简单的节奏练习，适合初学者',
                bpm: 120,
                beatInterval: 0.5,
                notes: this.generateBeginnerChart()
            },
            {
                id: 'intermediate',
                name: '进阶挑战',
                description: '中等难度，包含更多变化',
                bpm: 140,
                beatInterval: 0.428,
                notes: this.generateIntermediateChart()
            },
            {
                id: 'expert',
                name: '大师级',
                description: '高难度谱面，考验反应速度',
                bpm: 180,
                beatInterval: 0.333,
                notes: this.generateExpertChart()
            }
        ];
    },

    generateBeginnerChart: function() {
        const notes = [];
        const types = [this.NOTE_TYPES.LEFT, this.NOTE_TYPES.DOWN, this.NOTE_TYPES.UP, this.NOTE_TYPES.RIGHT];
        const interval = 500;
        
        for (let i = 0; i < 30; i++) {
            const type = types[i % 4];
            notes.push({
                time: (i + 1) * interval,
                type: type,
                id: `note_${i}`
            });
        }
        
        return notes;
    },

    generateIntermediateChart: function() {
        const notes = [];
        const types = [this.NOTE_TYPES.LEFT, this.NOTE_TYPES.DOWN, this.NOTE_TYPES.UP, this.NOTE_TYPES.RIGHT];
        const patterns = [
            [0, 1, 2, 3],
            [3, 2, 1, 0],
            [0, 2, 1, 3],
            [1, 0, 3, 2],
            [0, 1, 0, 1],
            [2, 3, 2, 3],
            [0, 3, 1, 2],
            [2, 1, 3, 0]
        ];
        const interval = 428;
        let time = 500;
        
        for (let patternIndex = 0; patternIndex < 10; patternIndex++) {
            const pattern = patterns[patternIndex % patterns.length];
            for (const typeIndex of pattern) {
                notes.push({
                    time: time,
                    type: types[typeIndex],
                    id: `note_${notes.length}`
                });
                time += interval;
            }
        }
        
        return notes;
    },

    generateExpertChart: function() {
        const notes = [];
        const types = [this.NOTE_TYPES.LEFT, this.NOTE_TYPES.DOWN, this.NOTE_TYPES.UP, this.NOTE_TYPES.RIGHT];
        const interval = 333;
        let time = 500;
        
        for (let i = 0; i < 80; i++) {
            let type;
            if (i % 8 < 4) {
                type = types[Math.floor(Math.random() * 4)];
            } else {
                type = types[i % 4];
            }
            
            notes.push({
                time: time,
                type: type,
                id: `note_${i}`
            });
            
            if ((i + 1) % 16 === 0) {
                time += interval * 2;
            } else {
                time += interval;
            }
        }
        
        return notes;
    },

    getBuiltInCharts: function() {
        return this.builtInCharts;
    },

    getChartById: function(id) {
        return this.builtInCharts.find(chart => chart.id === id);
    },

    parseChart: function(chartData) {
        if (!chartData || !chartData.notes || !Array.isArray(chartData.notes)) {
            return null;
        }

        const parsedChart = {
            id: chartData.id || 'custom',
            name: chartData.name || '自定义谱面',
            description: chartData.description || '',
            bpm: chartData.bpm || 120,
            beatInterval: chartData.beatInterval || 0.5,
            notes: []
        };

        for (const note of chartData.notes) {
            if (this.isValidNote(note)) {
                parsedChart.notes.push({
                    time: note.time,
                    type: note.type,
                    id: note.id || `note_${parsedChart.notes.length}`
                });
            }
        }

        parsedChart.notes.sort((a, b) => a.time - b.time);

        return parsedChart;
    },

    isValidNote: function(note) {
        if (!note || typeof note !== 'object') return false;
        if (typeof note.time !== 'number' || note.time < 0) return false;
        if (!Object.values(this.NOTE_TYPES).includes(note.type)) return false;
        return true;
    },

    getNotesInRange: function(chart, startTime, endTime) {
        if (!chart || !chart.notes) return [];

        return chart.notes.filter(note => 
            note.time >= startTime && note.time <= endTime
        );
    },

    createBeatSimulator: function(chart) {
        if (!chart) return null;

        const beatInterval = chart.beatInterval * 1000;
        const totalBeats = Math.ceil(chart.getChartDuration ? chart.getChartDuration() / beatInterval : 100);

        return {
            beatInterval: beatInterval,
            totalBeats: totalBeats,
            currentBeat: 0,
            lastBeatTime: 0,

            update: function(currentTime) {
                const expectedBeats = Math.floor(currentTime / this.beatInterval);
                const beatsPassed = expectedBeats - this.currentBeat;
                
                if (beatsPassed > 0) {
                    this.currentBeat = expectedBeats;
                    this.lastBeatTime = currentTime;
                    return beatsPassed;
                }
                return 0;
            },

            reset: function() {
                this.currentBeat = 0;
                this.lastBeatTime = 0;
            }
        };
    },

    serializeChart: function(chart) {
        return JSON.stringify({
            id: chart.id,
            name: chart.name,
            description: chart.description,
            bpm: chart.bpm,
            beatInterval: chart.beatInterval,
            notes: chart.notes.map(note => ({
                time: note.time,
                type: note.type,
                id: note.id
            }))
        });
    },

    deserializeChart: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.parseChart(data);
        } catch (e) {
            console.error('Failed to deserialize chart:', e);
            return null;
        }
    }
};

Chart.init();
