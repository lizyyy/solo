class UI {
    constructor(app) {
        this.app = app;
        this.elements = {};
        this.currentMeasure = null;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadArchives();
    }

    cacheElements() {
        this.elements = {
            scoreInput: document.getElementById('score-input'),
            performanceInput: document.getElementById('performance-input'),
            loadSample: document.getElementById('load-sample'),
            analysisSummary: document.getElementById('analysis-summary'),
            totalScore: document.getElementById('total-score'),
            measureCount: document.getElementById('measure-count'),
            wrongNotes: document.getElementById('wrong-notes'),
            rhythmIssues: document.getElementById('rhythm-issues'),
            missedNotes: document.getElementById('missed-notes'),
            slurBreaks: document.getElementById('slur-breaks'),
            storagePanel: document.getElementById('storage-panel'),
            archiveList: document.getElementById('archive-list'),
            saveArchive: document.getElementById('save-archive'),
            exportMarkdown: document.getElementById('export-markdown'),
            exportCsv: document.getElementById('export-csv'),
            exportJson: document.getElementById('export-json'),
            playBtn: document.getElementById('play-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            stopBtn: document.getElementById('stop-btn'),
            playbackTime: document.getElementById('playback-time'),
            playTarget: document.getElementById('play-target'),
            playPerformance: document.getElementById('play-performance'),
            speedControl: document.getElementById('speed-control'),
            speedDisplay: document.getElementById('speed-display'),
            placeholder: document.getElementById('placeholder'),
            scoreDisplay: document.getElementById('score-display'),
            scoreContainer: document.getElementById('score-container'),
            evidencePanel: document.getElementById('evidence-panel'),
            evidenceContent: document.getElementById('evidence-content')
        };
    }

    bindEvents() {
        this.elements.scoreInput.addEventListener('change', (e) => {
            this.handleFileInput(e, 'score');
        });

        this.elements.performanceInput.addEventListener('change', (e) => {
            this.handleFileInput(e, 'performance');
        });

        this.elements.loadSample.addEventListener('click', () => {
            this.app.loadSampleData();
        });

        this.elements.saveArchive.addEventListener('click', () => {
            this.app.saveCurrentArchive();
        });

        this.elements.exportMarkdown.addEventListener('click', () => {
            this.app.exportMarkdown();
        });

        this.elements.exportCsv.addEventListener('click', () => {
            this.app.exportCSV();
        });

        this.elements.exportJson.addEventListener('click', () => {
            this.app.exportJSON();
        });

        this.elements.playBtn.addEventListener('click', () => {
            this.app.player.play();
        });

        this.elements.pauseBtn.addEventListener('click', () => {
            this.app.player.pause();
        });

        this.elements.stopBtn.addEventListener('click', () => {
            this.app.player.stop();
        });

        this.elements.playTarget.addEventListener('change', (e) => {
            this.app.player.togglePlayTarget(e.target.checked);
        });

        this.elements.playPerformance.addEventListener('change', (e) => {
            this.app.player.togglePlayPerformance(e.target.checked);
        });

        this.elements.speedControl.addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            this.elements.speedDisplay.textContent = `${speed.toFixed(1)}x`;
            this.app.player.setSpeed(speed);
        });
    }

    handleFileInput(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            if (type === 'score') {
                this.app.loadScore(content);
            } else {
                this.app.loadPerformance(content);
            }
        };
        reader.readAsText(file);
    }

    updatePlaybackTime(current, total) {
        const currentStr = this.formatTime(current);
        const totalStr = this.formatTime(total);
        this.elements.playbackTime.textContent = `${currentStr} / ${totalStr}`;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showAnalysis(score, performance, alignment, analysis) {
        this.elements.placeholder.style.display = 'none';
        this.elements.scoreDisplay.style.display = 'block';
        this.elements.analysisSummary.style.display = 'block';
        this.elements.storagePanel.style.display = 'block';
        this.elements.saveArchive.style.display = 'block';

        this.elements.totalScore.textContent = `${analysis.totalScore.toFixed(1)}`;
        this.elements.measureCount.textContent = score.measures.length;
        this.elements.wrongNotes.textContent = analysis.summary.wrongNotes;
        this.elements.rhythmIssues.textContent = analysis.summary.timingIssues;
        this.elements.missedNotes.textContent = analysis.summary.missedNotes;
        this.elements.slurBreaks.textContent = analysis.summary.slurBreaks;

        this.elements.playBtn.disabled = false;
        this.elements.pauseBtn.disabled = false;
        this.elements.stopBtn.disabled = false;
        this.elements.exportMarkdown.disabled = false;
        this.elements.exportCsv.disabled = false;
        this.elements.exportJson.disabled = false;

        this.renderScore(score, alignment, analysis);
    }

    renderScore(score, alignment, analysis) {
        const scoreDisplay = this.elements.scoreDisplay;
        scoreDisplay.innerHTML = '';

        const parser = new Parser();

        score.measures.forEach((measure, mIndex) => {
            const measureAlign = alignment.measures[mIndex];
            const measureAnalysis = analysis.measures[mIndex];

            const measureRow = document.createElement('div');
            measureRow.className = 'measure-row';
            measureRow.dataset.measureNumber = measure.number;

            const measureHeader = document.createElement('div');
            measureHeader.className = 'measure-header';
            
            const scoreClass = this.getScoreClass(measureAnalysis.score);
            measureHeader.innerHTML = `
                <span class="measure-number">第 ${measure.number} 小节</span>
                <span class="score-badge ${scoreClass}">${measureAnalysis.score.toFixed(0)}分</span>
            `;

            measureHeader.addEventListener('click', () => {
                this.showMeasureDetails(measure.number, measureAlign, measureAnalysis);
                this.highlightMeasure(measureRow);
            });

            const measureContent = document.createElement('div');
            measureContent.className = 'measure-content';

            measure.notes.forEach((note, nIndex) => {
                const noteAlign = measureAlign.notes ? measureAlign.notes[nIndex] : null;
                const noteAnalysis = measureAnalysis.notes ? measureAnalysis.notes[nIndex] : null;

                const noteEl = document.createElement('div');
                noteEl.className = 'note';
                noteEl.dataset.pitch = note.pitch;
                noteEl.dataset.noteName = note.noteName;

                let noteClass = 'target';
                let timingIndicator = '';

                if (noteAnalysis) {
                    if (noteAnalysis.isMissed) {
                        noteClass = 'error';
                    } else if (noteAnalysis.timingError || noteAnalysis.velocityError || noteAnalysis.durationError) {
                        noteClass = noteAnalysis.timingError?.severity === 'high' ? 'error' : 'warning';
                        
                        if (noteAnalysis.timingError) {
                            const direction = noteAnalysis.timingError.isEarly ? '提前' : '滞后';
                            const ms = Math.abs(noteAnalysis.details?.timingDeviation * 1000).toFixed(0);
                            timingIndicator = `<span class="timing-indicator">${direction}${ms}ms</span>`;
                        }
                    } else if (noteAlign && noteAlign.status === 'matched') {
                        noteClass = 'performance';
                    }
                }

                noteEl.classList.add(noteClass);
                noteEl.innerHTML = `
                    <span class="note-name">${note.noteName}</span>
                    <span class="duration">${note.duration.toFixed(1)}</span>
                    ${timingIndicator}
                `;

                noteEl.title = `
                    音高: ${note.noteName} (MIDI ${note.pitch})
                    时间: ${note.startTime.toFixed(2)}s
                    时值: ${note.duration.toFixed(2)}s
                    力度: ${note.velocity}
                    ${noteAnalysis && !noteAnalysis.isCorrect ? `状态: ${this.getNoteStatus(noteAnalysis)}` : ''}
                `.trim();

                measureContent.appendChild(noteEl);
            });

            if (measureAlign && measureAlign.extraNotes) {
                measureAlign.extraNotes.forEach(extraNote => {
                    const noteEl = document.createElement('div');
                    noteEl.className = 'note error';
                    noteEl.innerHTML = `
                        <span class="note-name">${extraNote.performance.noteName}</span>
                        <span class="duration">${extraNote.performance.duration.toFixed(1)}</span>
                    `;
                    noteEl.title = `误按: ${extraNote.performance.noteName} (MIDI ${extraNote.performance.pitch}) - 不在乐谱中`;
                    measureContent.appendChild(noteEl);
                });
            }

            measureRow.appendChild(measureHeader);
            measureRow.appendChild(measureContent);
            scoreDisplay.appendChild(measureRow);
        });
    }

    getScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 70) return 'good';
        return 'poor';
    }

    getNoteStatus(noteAnalysis) {
        const issues = [];
        if (noteAnalysis.isMissed) issues.push('漏音');
        if (noteAnalysis.timingError) issues.push('节奏问题');
        if (noteAnalysis.velocityError) issues.push('力度问题');
        if (noteAnalysis.durationError) issues.push('时值问题');
        return issues.join(', ');
    }

    showMeasureDetails(measureNumber, measureAlign, measureAnalysis) {
        this.elements.evidencePanel.style.display = 'block';
        this.currentMeasure = measureNumber;

        let content = `<h4>第 ${measureNumber} 小节分析</h4>`;
        content += `<p>小节得分: <strong>${measureAnalysis.score.toFixed(1)}</strong> 分</p>`;

        const measureErrors = measureAnalysis.errors || [];

        if (measureErrors.length === 0) {
            content += `<p class="success-message">✅ 本小节演奏正确！</p>`;
        } else {
            content += `<div class="error-list">`;
            
            measureErrors.forEach((error, idx) => {
                const typeClass = `type-${error.type === 'timing' ? 'rhythm' : 
                                          error.type === 'missed' ? 'missed' : 
                                          error.type === 'slur_break' ? 'slur' : 'wrong'}`;
                
                content += `
                    <div class="error-detail ${typeClass}">
                        <h5>${idx + 1}. ${this.getErrorTitle(error.type)}</h5>
                        <p><strong>${error.message}</strong></p>
                        ${error.details ? this.renderErrorDetails(error.details) : ''}
                        <div class="detail-row">
                            <span>严重程度: <strong>${this.getSeverityLabel(error.severity)}</strong></span>
                            <span>扣分: <strong>${error.penalty}</strong> 分</span>
                        </div>
                    </div>
                `;
            });
            
            content += `</div>`;
        }

        content += `<h5 style="margin-top: 1rem;">小节音符</h5>`;
        content += `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">`;

        if (measureAlign && measureAlign.notes) {
            measureAlign.notes.forEach(noteAlign => {
                const status = noteAlign.status === 'matched' ? '✅' : '❌';
                const noteName = noteAlign.target?.noteName || '?';
                content += `<div style="padding: 0.25rem 0.5rem; background: #f0f0f0; border-radius: 4px;">
                    ${status} ${noteName}
                </div>`;
            });
        }

        if (measureAlign && measureAlign.extraNotes) {
            measureAlign.extraNotes.forEach(extraNote => {
                content += `<div style="padding: 0.25rem 0.5rem; background: #ffebee; border-radius: 4px;">
                    ❌ ${extraNote.performance.noteName} (误按)
                </div>`;
            });
        }

        content += `</div>`;

        this.elements.evidenceContent.innerHTML = content;
    }

    renderErrorDetails(details) {
        let html = '<div class="detail-row">';
        
        if (details.expectedTime !== undefined && details.actualTime !== undefined) {
            html += `
                <span class="expected">期望时间: ${details.expectedTime.toFixed(3)}s</span>
                <span class="actual">实际时间: ${details.actualTime.toFixed(3)}s</span>
            `;
        }
        
        if (details.expectedVelocity !== undefined) {
            html += `
                <span class="expected">期望力度: ${details.expectedVelocity}</span>
                <span class="actual">实际力度: ${details.actualVelocity}</span>
            `;
        }
        
        if (details.expectedDuration !== undefined) {
            html += `
                <span class="expected">期望时值: ${details.expectedDuration.toFixed(3)}s</span>
                <span class="actual">实际时值: ${details.actualDuration.toFixed(3)}s</span>
            `;
        }
        
        if (details.gapDuration !== undefined) {
            html += `<span>断裂间隔: ${(details.gapDuration * 1000).toFixed(0)}ms</span>`;
        }
        
        html += '</div>';
        return html;
    }

    getErrorTitle(type) {
        const titles = {
            missed: '漏音',
            wrong_pitch: '错音',
            timing: '节奏问题',
            velocity: '力度问题',
            duration: '时值问题',
            slur_break: '连音断裂'
        };
        return titles[type] || type;
    }

    getSeverityLabel(severity) {
        const labels = {
            high: '🔴 严重',
            medium: '🟡 中等',
            low: '🟢 轻微'
        };
        return labels[severity] || severity;
    }

    highlightMeasure(measureRow) {
        document.querySelectorAll('.measure-row').forEach(row => {
            row.classList.remove('current-measure');
        });
        measureRow.classList.add('current-measure');
        measureRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    highlightCurrentMeasure(measureNumber) {
        const measureRow = document.querySelector(`.measure-row[data-measure-number="${measureNumber}"]`);
        if (measureRow) {
            document.querySelectorAll('.measure-row').forEach(row => {
                row.classList.remove('playing-highlight');
            });
            measureRow.classList.add('playing-highlight');
            measureRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    loadArchives() {
        const archives = this.app.storage.getArchives();
        this.renderArchiveList(archives);
    }

    renderArchiveList(archives) {
        if (archives.length === 0) {
            this.elements.archiveList.innerHTML = '<p style="color: #999; font-size: 0.85rem;">暂无存档</p>';
            return;
        }

        let html = '';
        archives.forEach(archive => {
            const date = this.app.storage.formatDate(archive.createdAt);
            const scoreColor = archive.totalScore >= 70 ? '#5cb85c' : (archive.totalScore >= 50 ? '#f0ad4e' : '#d9534f');
            
            html += `
                <div class="archive-item" data-id="${archive.id}">
                    <div class="archive-info">
                        <div class="archive-title">${archive.title}</div>
                        <div class="archive-date">${date}</div>
                        <div class="archive-score" style="color: ${scoreColor};">
                            ${archive.totalScore.toFixed(1)}分
                        </div>
                    </div>
                    <div class="archive-actions">
                        <span class="load-btn" title="加载">📂</span>
                        <span class="delete-btn" title="删除">🗑️</span>
                    </div>
                </div>
            `;
        });

        this.elements.archiveList.innerHTML = html;

        this.elements.archiveList.querySelectorAll('.archive-item').forEach(item => {
            const id = item.dataset.id;
            const loadBtn = item.querySelector('.load-btn');
            const deleteBtn = item.querySelector('.delete-btn');

            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.loadArchive(id);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要删除这个存档吗？')) {
                    this.app.storage.deleteArchive(id);
                    this.loadArchives();
                }
            });
        });
    }

    showMessage(message, type = 'info') {
        const colors = {
            info: '#5bc0de',
            success: '#5cb85c',
            warning: '#f0ad4e',
            error: '#d9534f'
        };

        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        messageEl.textContent = message;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transition = 'opacity 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
