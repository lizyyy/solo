class Scorer {
    constructor(options = {}) {
        this.config = {
            timingTolerance: 0.15,
            timingSevereTolerance: 0.3,
            velocityTolerance: 15,
            durationTolerance: 0.3,
            weights: {
                missed: 30,
                wrongPitch: 25,
                timingSevere: 20,
                timingMild: 5,
                velocity: 3,
                duration: 5,
                slurBreak: 15
            },
            maxScorePerNote: 100
        };

        Object.assign(this.config, options);
    }

    score(alignment, scoreData) {
        const analysis = {
            totalScore: 100,
            measures: [],
            errors: [],
            summary: {
                totalNotes: 0,
                correctNotes: 0,
                missedNotes: 0,
                wrongNotes: 0,
                timingIssues: 0,
                velocityIssues: 0,
                durationIssues: 0,
                slurBreaks: 0
            },
            timingStatistics: {
                min: Infinity,
                max: -Infinity,
                avg: 0,
                sum: 0,
                count: 0
            }
        };

        let totalPenalty = 0;

        alignment.measures.forEach((measureAlign, mIndex) => {
            const measureAnalysis = this.scoreMeasure(measureAlign, mIndex);
            analysis.measures.push(measureAnalysis);

            totalPenalty += measureAnalysis.penalty;
            analysis.errors.push(...measureAnalysis.errors);

            analysis.summary.totalNotes += measureAnalysis.summary.totalNotes;
            analysis.summary.correctNotes += measureAnalysis.summary.correctNotes;
            analysis.summary.missedNotes += measureAnalysis.summary.missedNotes;
            analysis.summary.wrongNotes += measureAnalysis.summary.wrongNotes;
            analysis.summary.timingIssues += measureAnalysis.summary.timingIssues;
            analysis.summary.velocityIssues += measureAnalysis.summary.velocityIssues;
            analysis.summary.durationIssues += measureAnalysis.summary.durationIssues;

            if (measureAlign.notes) {
                measureAlign.notes.forEach(noteAlign => {
                    if (noteAlign.timingDeviation !== undefined) {
                        analysis.timingStatistics.sum += noteAlign.timingDeviation;
                        analysis.timingStatistics.count++;
                        analysis.timingStatistics.min = Math.min(
                            analysis.timingStatistics.min,
                            noteAlign.timingDeviation
                        );
                        analysis.timingStatistics.max = Math.max(
                            analysis.timingStatistics.max,
                            noteAlign.timingDeviation
                        );
                    }
                });
            }
        });

        if (analysis.timingStatistics.count > 0) {
            analysis.timingStatistics.avg = 
                analysis.timingStatistics.sum / analysis.timingStatistics.count;
        }

        const aligner = new Aligner();
        const slurBreaks = aligner.detectSlurBreaks(alignment);
        
        analysis.summary.slurBreaks = slurBreaks.length;
        totalPenalty += slurBreaks.length * this.config.weights.slurBreak;
        
        slurBreaks.forEach(breakInfo => {
            analysis.errors.push({
                type: 'slur_break',
                measure: breakInfo.measure,
                severity: breakInfo.severity,
                details: {
                    gapDuration: breakInfo.gapDuration,
                    previousNote: breakInfo.previousNote,
                    currentNote: breakInfo.currentNote
                },
                penalty: this.config.weights.slurBreak,
                message: `连音断裂，间隔 ${(breakInfo.gapDuration * 1000).toFixed(0)}ms`
            });
        });

        alignment.measures.forEach((measureAlign, mIndex) => {
            measureAlign.extraNotes.forEach(extraNote => {
                const penalty = this.config.weights.wrongPitch;
                totalPenalty += penalty;
                
                analysis.errors.push({
                    type: 'wrong_pitch',
                    measure: measureAlign.measureNumber,
                    note: extraNote.performance,
                    severity: 'high',
                    details: {
                        playedPitch: extraNote.performance.pitch,
                        playedNoteName: extraNote.performance.noteName,
                        velocity: extraNote.performance.velocity
                    },
                    penalty: penalty,
                    message: `误按 ${extraNote.performance.noteName} (MIDI ${extraNote.performance.pitch})`
                });
            });
        });

        const maxPossiblePenalty = analysis.summary.totalNotes * Math.max(
            this.config.weights.missed,
            this.config.weights.wrongPitch
        );

        if (maxPossiblePenalty > 0) {
            const penaltyRatio = Math.min(totalPenalty / maxPossiblePenalty, 1);
            analysis.totalScore = Math.max(0, 100 - (penaltyRatio * 100));
        }

        return analysis;
    }

    scoreMeasure(measureAlign, measureIndex) {
        const analysis = {
            measureNumber: measureAlign.measureNumber,
            score: 100,
            penalty: 0,
            errors: [],
            notes: [],
            summary: {
                totalNotes: 0,
                correctNotes: 0,
                missedNotes: 0,
                wrongNotes: 0,
                timingIssues: 0,
                velocityIssues: 0,
                durationIssues: 0
            }
        };

        if (!measureAlign.notes) {
            return analysis;
        }

        measureAlign.notes.forEach(noteAlign => {
            const noteAnalysis = this.scoreNote(noteAlign, measureAlign.measureNumber);
            analysis.notes.push(noteAnalysis);

            analysis.summary.totalNotes++;
            analysis.penalty += noteAnalysis.penalty;
            analysis.errors.push(...noteAnalysis.errors);

            if (noteAnalysis.isCorrect) {
                analysis.summary.correctNotes++;
            }
            if (noteAnalysis.isMissed) {
                analysis.summary.missedNotes++;
            }
            if (noteAnalysis.timingError) {
                analysis.summary.timingIssues++;
            }
            if (noteAnalysis.velocityError) {
                analysis.summary.velocityIssues++;
            }
            if (noteAnalysis.durationError) {
                analysis.summary.durationIssues++;
            }
        });

        const maxPossiblePenalty = measureAlign.notes.length * Math.max(
            this.config.weights.missed,
            this.config.weights.wrongPitch
        );

        if (maxPossiblePenalty > 0) {
            const penaltyRatio = Math.min(analysis.penalty / maxPossiblePenalty, 1);
            analysis.score = Math.max(0, 100 - (penaltyRatio * 100));
        }

        return analysis;
    }

    scoreNote(noteAlign, measureNumber) {
        const analysis = {
            isCorrect: false,
            isMissed: false,
            timingError: null,
            velocityError: null,
            durationError: null,
            penalty: 0,
            errors: [],
            details: {}
        };

        if (noteAlign.status === 'missed') {
            analysis.isMissed = true;
            analysis.penalty = this.config.weights.missed;
            analysis.errors.push({
                type: 'missed',
                measure: measureNumber,
                note: noteAlign.target,
                severity: 'high',
                details: {
                    expectedPitch: noteAlign.target.pitch,
                    expectedNoteName: noteAlign.target.noteName,
                    expectedTime: noteAlign.target.startTime
                },
                penalty: this.config.weights.missed,
                message: `漏按 ${noteAlign.target.noteName} (MIDI ${noteAlign.target.pitch})`
            });
            return analysis;
        }

        if (noteAlign.status === 'matched') {
            analysis.isCorrect = true;
            analysis.details = {
                target: noteAlign.target,
                performance: noteAlign.performance,
                timingDeviation: noteAlign.timingDeviation,
                velocityDiff: noteAlign.velocityDiff,
                durationDiff: noteAlign.durationDiff
            };

            if (Math.abs(noteAlign.timingDeviation) > this.config.timingTolerance) {
                analysis.timingError = {
                    deviation: noteAlign.timingDeviation,
                    isEarly: noteAlign.timingDeviation < 0,
                    isLate: noteAlign.timingDeviation > 0,
                    severity: Math.abs(noteAlign.timingDeviation) > this.config.timingSevereTolerance ? 'high' : 'medium'
                };
                analysis.isCorrect = false;

                const timingPenalty = Math.abs(noteAlign.timingDeviation) > this.config.timingSevereTolerance
                    ? this.config.weights.timingSevere
                    : this.config.weights.timingMild;

                analysis.penalty += timingPenalty;

                const direction = noteAlign.timingDeviation < 0 ? '提前' : '滞后';
                const msDeviation = Math.abs(noteAlign.timingDeviation * 1000).toFixed(0);

                analysis.errors.push({
                    type: 'timing',
                    measure: measureNumber,
                    note: noteAlign.target,
                    performance: noteAlign.performance,
                    severity: analysis.timingError.severity,
                    details: {
                        expectedTime: noteAlign.target.absoluteTime,
                        actualTime: noteAlign.performance.startTime,
                        deviationMs: msDeviation,
                        direction: direction
                    },
                    penalty: timingPenalty,
                    message: `${noteAlign.target.noteName} ${direction} ${msDeviation}ms`
                });
            }

            if (Math.abs(noteAlign.velocityDiff) > this.config.velocityTolerance) {
                analysis.velocityError = {
                    diff: noteAlign.velocityDiff,
                    isTooSoft: noteAlign.velocityDiff < 0,
                    isTooLoud: noteAlign.velocityDiff > 0
                };
                analysis.isCorrect = false;
                analysis.penalty += this.config.weights.velocity;

                const direction = noteAlign.velocityDiff < 0 ? '太轻' : '太重';
                analysis.errors.push({
                    type: 'velocity',
                    measure: measureNumber,
                    note: noteAlign.target,
                    performance: noteAlign.performance,
                    severity: 'low',
                    details: {
                        expectedVelocity: noteAlign.target.velocity,
                        actualVelocity: noteAlign.performance.velocity,
                        difference: noteAlign.velocityDiff
                    },
                    penalty: this.config.weights.velocity,
                    message: `${noteAlign.target.noteName} 力度${direction} (期望 ${noteAlign.target.velocity}, 实际 ${noteAlign.performance.velocity})`
                });
            }

            const expectedDuration = noteAlign.target.duration;
            const durationRatio = Math.abs(noteAlign.durationDiff) / expectedDuration;

            if (durationRatio > this.config.durationTolerance) {
                analysis.durationError = {
                    diff: noteAlign.durationDiff,
                    ratio: durationRatio,
                    isTooShort: noteAlign.durationDiff < 0,
                    isTooLong: noteAlign.durationDiff > 0
                };
                analysis.isCorrect = false;
                analysis.penalty += this.config.weights.duration;

                const direction = noteAlign.durationDiff < 0 ? '太短' : '太长';
                analysis.errors.push({
                    type: 'duration',
                    measure: measureNumber,
                    note: noteAlign.target,
                    performance: noteAlign.performance,
                    severity: 'low',
                    details: {
                        expectedDuration: noteAlign.target.duration,
                        actualDuration: noteAlign.performance.duration,
                        difference: noteAlign.durationDiff
                    },
                    penalty: this.config.weights.duration,
                    message: `${noteAlign.target.noteName} 时值${direction} (期望 ${noteAlign.target.duration.toFixed(2)}s, 实际 ${noteAlign.performance.duration.toFixed(2)}s)`
                });
            }
        }

        return analysis;
    }

    getScoreGrade(score) {
        if (score >= 90) return { grade: 'A', label: '优秀', color: '#5cb85c' };
        if (score >= 80) return { grade: 'B', label: '良好', color: '#5bc0de' };
        if (score >= 70) return { grade: 'C', label: '中等', color: '#f0ad4e' };
        if (score >= 60) return { grade: 'D', label: '及格', color: '#f0ad4e' };
        return { grade: 'F', label: '需努力', color: '#d9534f' };
    }

    getSeverityLabel(severity) {
        const labels = {
            high: '严重',
            medium: '中等',
            low: '轻微'
        };
        return labels[severity] || '未知';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scorer;
}
