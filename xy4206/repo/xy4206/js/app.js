class App {
    constructor() {
        this.parser = new Parser();
        this.aligner = new Aligner();
        this.scorer = new Scorer();
        this.player = new Player();
        this.storage = new Storage();
        this.exporter = new Exporter();
        this.ui = new UI(this);

        this.scoreData = null;
        this.performanceData = null;
        this.alignment = null;
        this.analysis = null;
    }

    init() {
        this.ui.init();
        this.setupPlayerCallbacks();
    }

    setupPlayerCallbacks() {
        this.player.onPlaybackUpdate = (current, total) => {
            this.ui.updatePlaybackTime(current, total);
        };

        this.player.onMeasureChange = (measureNumber) => {
            if (measureNumber) {
                this.ui.highlightCurrentMeasure(measureNumber);
            }
        };

        this.player.onPlaybackEnd = () => {
            this.ui.showMessage('播放完成', 'info');
        };
    }

    loadScore(jsonContent) {
        try {
            this.scoreData = this.parser.parseScoreJSON(jsonContent);
            this.ui.showMessage(`乐谱加载成功: ${this.scoreData.title}`, 'success');
            this.tryAnalyze();
        } catch (error) {
            this.ui.showMessage(`乐谱加载失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    loadPerformance(csvContent) {
        try {
            this.performanceData = this.parser.parsePerformanceCSV(csvContent);
            this.ui.showMessage(`演奏记录加载成功: ${this.performanceData.notes.length} 个音符`, 'success');
            this.tryAnalyze();
        } catch (error) {
            this.ui.showMessage(`演奏记录加载失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    tryAnalyze() {
        if (this.scoreData && this.performanceData) {
            this.analyze();
        }
    }

    analyze() {
        try {
            this.alignment = this.aligner.align(this.scoreData, this.performanceData);
            this.analysis = this.scorer.score(this.alignment, this.scoreData);

            this.player.setData(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );

            this.ui.showAnalysis(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );

            const grade = this.scorer.getScoreGrade(this.analysis.totalScore);
            this.ui.showMessage(`分析完成! 总分: ${this.analysis.totalScore.toFixed(1)} (${grade.label})`, 'success');

        } catch (error) {
            this.ui.showMessage(`分析失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    loadSampleData() {
        const sampleScore = SampleData.getSampleScore();
        const samplePerformance = SampleData.getSamplePerformance();

        try {
            this.scoreData = this.parser.parseScoreJSON(JSON.stringify(sampleScore));
            this.performanceData = this.parser.parsePerformanceCSV(samplePerformance);
            this.analyze();
        } catch (error) {
            this.ui.showMessage(`示例数据加载失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    saveCurrentArchive() {
        if (!this.analysis) {
            this.ui.showMessage('没有可保存的分析数据', 'warning');
            return;
        }

        const result = this.storage.saveArchive({
            title: this.scoreData?.title || '未命名练习',
            composer: this.scoreData?.composer || '未知',
            scoreData: this.scoreData,
            performanceData: this.performanceData,
            alignment: this.alignment,
            analysis: this.analysis
        });

        if (result.success) {
            this.ui.showMessage('存档保存成功!', 'success');
            this.ui.loadArchives();
        } else {
            this.ui.showMessage(`保存失败: ${result.error}`, 'error');
        }
    }

    loadArchive(id) {
        const archive = this.storage.getArchive(id);
        
        if (!archive) {
            this.ui.showMessage('存档不存在', 'error');
            return;
        }

        try {
            this.scoreData = archive.scoreData;
            this.performanceData = archive.performanceData;
            this.alignment = archive.alignment;
            this.analysis = archive.analysis;

            this.player.setData(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );

            this.ui.showAnalysis(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );

            this.ui.showMessage(`存档加载成功: ${archive.title}`, 'success');
        } catch (error) {
            this.ui.showMessage(`存档加载失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    exportMarkdown() {
        if (!this.analysis) {
            this.ui.showMessage('没有可导出的数据', 'warning');
            return;
        }

        try {
            this.exporter.downloadMarkdown(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );
            this.ui.showMessage('Markdown讲评已导出', 'success');
        } catch (error) {
            this.ui.showMessage(`导出失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    exportCSV() {
        if (!this.analysis) {
            this.ui.showMessage('没有可导出的数据', 'warning');
            return;
        }

        try {
            this.exporter.downloadCSV(this.analysis);
            this.ui.showMessage('错误明细CSV已导出', 'success');
        } catch (error) {
            this.ui.showMessage(`导出失败: ${error.message}`, 'error');
            console.error(error);
        }
    }

    exportJSON() {
        if (!this.analysis) {
            this.ui.showMessage('没有可导出的数据', 'warning');
            return;
        }

        try {
            this.exporter.downloadJSON(
                this.scoreData,
                this.performanceData,
                this.alignment,
                this.analysis
            );
            this.ui.showMessage('JSON审计包已导出', 'success');
        } catch (error) {
            this.ui.showMessage(`导出失败: ${error.message}`, 'error');
            console.error(error);
        }
    }
}

const SampleData = {
    getSampleScore() {
        return {
            title: "C大调音阶与和弦练习",
            composer: "练习曲",
            timeSignature: "4/4",
            tempo: 120,
            measures: [
                {
                    number: 1,
                    timeSignature: "4/4",
                    tempo: 120,
                    notes: [
                        { pitch: 60, noteName: "C4", velocity: 64, startTime: 0.00, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 62, noteName: "D4", velocity: 64, startTime: 0.50, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 64, noteName: "E4", velocity: 64, startTime: 1.00, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 65, noteName: "F4", velocity: 64, startTime: 1.50, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 67, noteName: "G4", velocity: 64, startTime: 2.00, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 69, noteName: "A4", velocity: 64, startTime: 2.50, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 71, noteName: "B4", velocity: 64, startTime: 3.00, duration: 0.5, isSlurred: true, slurGroup: 1 },
                        { pitch: 72, noteName: "C5", velocity: 64, startTime: 3.50, duration: 0.5, isSlurred: false, slurGroup: 1 }
                    ],
                    pedalEvents: [
                        { type: "damper", time: 0.0, value: 64, isPressed: true }
                    ]
                },
                {
                    number: 2,
                    timeSignature: "4/4",
                    tempo: 120,
                    notes: [
                        { pitch: 72, noteName: "C5", velocity: 64, startTime: 0.00, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 71, noteName: "B4", velocity: 64, startTime: 0.50, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 69, noteName: "A4", velocity: 64, startTime: 1.00, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 67, noteName: "G4", velocity: 64, startTime: 1.50, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 65, noteName: "F4", velocity: 64, startTime: 2.00, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 64, noteName: "E4", velocity: 64, startTime: 2.50, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 62, noteName: "D4", velocity: 64, startTime: 3.00, duration: 0.5, isSlurred: true, slurGroup: 2 },
                        { pitch: 60, noteName: "C4", velocity: 64, startTime: 3.50, duration: 0.5, isSlurred: false, slurGroup: 2 }
                    ],
                    pedalEvents: [
                        { type: "damper", time: 2.0, value: 0, isPressed: false }
                    ]
                },
                {
                    number: 3,
                    timeSignature: "4/4",
                    tempo: 120,
                    notes: [
                        { pitch: 60, noteName: "C4", velocity: 80, startTime: 0.00, duration: 1.0, isSlurred: false },
                        { pitch: 64, noteName: "E4", velocity: 80, startTime: 0.00, duration: 1.0, isSlurred: false },
                        { pitch: 67, noteName: "G4", velocity: 80, startTime: 0.00, duration: 1.0, isSlurred: false },
                        { pitch: 60, noteName: "C4", velocity: 80, startTime: 1.00, duration: 1.0, isSlurred: false },
                        { pitch: 64, noteName: "E4", velocity: 80, startTime: 1.00, duration: 1.0, isSlurred: false },
                        { pitch: 67, noteName: "G4", velocity: 80, startTime: 1.00, duration: 1.0, isSlurred: false },
                        { pitch: 59, noteName: "B3", velocity: 80, startTime: 2.00, duration: 1.0, isSlurred: false },
                        { pitch: 62, noteName: "D4", velocity: 80, startTime: 2.00, duration: 1.0, isSlurred: false },
                        { pitch: 66, noteName: "F#4", velocity: 80, startTime: 2.00, duration: 1.0, isSlurred: false },
                        { pitch: 60, noteName: "C4", velocity: 80, startTime: 3.00, duration: 1.0, isSlurred: false },
                        { pitch: 64, noteName: "E4", velocity: 80, startTime: 3.00, duration: 1.0, isSlurred: false },
                        { pitch: 67, noteName: "G4", velocity: 80, startTime: 3.00, duration: 1.0, isSlurred: false }
                    ],
                    pedalEvents: [
                        { type: "damper", time: 0.0, value: 64, isPressed: true },
                        { type: "damper", time: 1.0, value: 0, isPressed: false },
                        { type: "damper", time: 1.01, value: 64, isPressed: true },
                        { type: "damper", time: 2.0, value: 0, isPressed: false },
                        { type: "damper", time: 2.01, value: 64, isPressed: true },
                        { type: "damper", time: 3.0, value: 0, isPressed: false },
                        { type: "damper", time: 3.01, value: 64, isPressed: true }
                    ]
                },
                {
                    number: 4,
                    timeSignature: "4/4",
                    tempo: 120,
                    notes: [
                        { pitch: 60, noteName: "C4", velocity: 70, startTime: 0.00, duration: 0.5, isSlurred: false },
                        { pitch: 62, noteName: "D4", velocity: 70, startTime: 0.50, duration: 0.5, isSlurred: false },
                        { pitch: 64, noteName: "E4", velocity: 70, startTime: 1.00, duration: 0.5, isSlurred: false },
                        { pitch: 67, noteName: "G4", velocity: 80, startTime: 1.50, duration: 1.0, isSlurred: false },
                        { pitch: 69, noteName: "A4", velocity: 70, startTime: 2.50, duration: 0.5, isSlurred: false },
                        { pitch: 67, noteName: "G4", velocity: 70, startTime: 3.00, duration: 0.5, isSlurred: false },
                        { pitch: 64, noteName: "E4", velocity: 70, startTime: 3.50, duration: 0.5, isSlurred: false }
                    ],
                    pedalEvents: [
                        { type: "damper", time: 4.0, value: 0, isPressed: false }
                    ]
                }
            ]
        };
    },

    getSamplePerformance() {
        return `time,type,pitch,velocity,duration,noteName
0.02,note,60,62,0.48,C4
0.51,note,62,60,0.52,D4
1.02,note,64,65,0.48,E4
1.48,note,65,63,0.50,F4
2.01,note,67,64,0.49,G4
2.55,note,69,66,0.48,A4
3.02,note,71,62,0.51,B4
3.50,note,72,65,0.50,C5
4.00,note,72,64,0.50,C5
4.50,note,71,63,0.50,B4
4.98,note,69,65,0.50,A4
5.52,note,67,62,0.50,G4
6.00,note,65,64,0.50,F4
6.51,note,64,63,0.48,E4
7.00,note,62,65,0.50,D4
7.50,note,60,64,0.50,C4
8.00,note,60,78,1.00,C4
8.00,note,64,82,1.00,E4
8.00,note,67,80,1.00,G4
9.00,note,60,79,1.00,C4
9.00,note,64,81,1.00,E4
9.00,note,67,78,1.00,G4
10.00,note,59,77,1.00,B3
10.00,note,62,80,1.00,D4
10.00,note,65,79,1.00,F4
11.00,note,60,82,1.00,C4
11.00,note,64,80,1.00,E4
11.00,note,67,78,1.00,G4
12.00,note,60,68,0.50,C4
12.55,note,62,72,0.50,D4
13.00,note,64,70,0.50,E4
13.48,note,67,78,1.00,G4
14.50,note,69,71,0.50,A4
15.00,note,67,69,0.50,G4
15.50,note,64,70,0.50,E4`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    window.pianoApp = app;
});
