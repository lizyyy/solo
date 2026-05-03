class Aligner {
    constructor() {
        this.timingTolerance = 0.15;
    }

    align(score, performance) {
        const alignment = {
            measures: [],
            globalMetrics: {
                totalNotes: 0,
                alignedNotes: 0,
                missedNotes: 0,
                extraNotes: 0,
                timingDeviation: { min: Infinity, max: -Infinity, avg: 0, sum: 0, count: 0 }
            }
        };

        const tempo = score.tempo || 120;
        const secondsPerBeat = 60 / tempo;
        const beatsPerMeasure = this.parseTimeSignature(score.timeSignature);
        const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;

        const performanceNotesByMeasure = this.groupPerformanceByMeasure(
            performance.notes,
            secondsPerMeasure
        );

        let globalNoteIndex = 0;

        score.measures.forEach((scoreMeasure, measureIndex) => {
            const measureAlignment = this.alignMeasure(
                scoreMeasure,
                performanceNotesByMeasure[measureIndex + 1] || [],
                measureIndex,
                secondsPerMeasure,
                tempo
            );

            measureAlignment.notes.forEach(noteAlign => {
                alignment.globalMetrics.totalNotes++;
                
                if (noteAlign.status === 'matched') {
                    alignment.globalMetrics.alignedNotes++;
                    const deviation = noteAlign.timingDeviation;
                    if (deviation !== undefined) {
                        alignment.globalMetrics.timingDeviation.sum += deviation;
                        alignment.globalMetrics.timingDeviation.count++;
                        alignment.globalMetrics.timingDeviation.min = Math.min(
                            alignment.globalMetrics.timingDeviation.min,
                            deviation
                        );
                        alignment.globalMetrics.timingDeviation.max = Math.max(
                            alignment.globalMetrics.timingDeviation.max,
                            deviation
                        );
                    }
                } else if (noteAlign.status === 'missed') {
                    alignment.globalMetrics.missedNotes++;
                }
            });

            measureAlignment.extraNotes.forEach(() => {
                alignment.globalMetrics.extraNotes++;
            });

            measureAlignment.globalIndex = globalNoteIndex;
            globalNoteIndex += measureAlignment.notes.length;

            alignment.measures.push(measureAlignment);
        });

        if (alignment.globalMetrics.timingDeviation.count > 0) {
            alignment.globalMetrics.timingDeviation.avg = 
                alignment.globalMetrics.timingDeviation.sum / alignment.globalMetrics.timingDeviation.count;
        }

        return alignment;
    }

    alignMeasure(scoreMeasure, perfNotes, measureIndex, secondsPerMeasure, tempo) {
        const measureStartTime = measureIndex * secondsPerMeasure;
        const measureEndTime = measureStartTime + secondsPerMeasure;

        const result = {
            measureNumber: scoreMeasure.number,
            measureStartTime,
            measureEndTime,
            timeSignature: scoreMeasure.timeSignature,
            tempo: scoreMeasure.tempo || tempo,
            notes: [],
            extraNotes: [],
            pedalAlignment: this.alignPedals(scoreMeasure.pedalEvents, [])
        };

        const scoreNotes = [...scoreMeasure.notes].sort((a, b) => a.startTime - b.startTime);
        const performanceNotes = [...perfNotes].sort((a, b) => a.startTime - b.startTime);

        const usedPerfIndices = new Set();

        scoreNotes.forEach(scoreNote => {
            const scoreAbsTime = measureStartTime + scoreNote.startTime;
            
            let bestMatch = null;
            let bestMatchIndex = -1;
            let bestScore = Infinity;

            performanceNotes.forEach((perfNote, perfIndex) => {
                if (usedPerfIndices.has(perfIndex)) return;

                if (perfNote.pitch === scoreNote.pitch) {
                    const timeDiff = perfNote.startTime - scoreAbsTime;
                    const absTimeDiff = Math.abs(timeDiff);

                    if (absTimeDiff <= this.timingTolerance * 2) {
                        const score = absTimeDiff;
                        if (score < bestScore) {
                            bestScore = score;
                            bestMatch = perfNote;
                            bestMatchIndex = perfIndex;
                        }
                    }
                }
            });

            if (bestMatch) {
                usedPerfIndices.add(bestMatchIndex);
                
                const timingDeviation = bestMatch.startTime - scoreAbsTime;
                const velocityDiff = bestMatch.velocity - scoreNote.velocity;
                const durationDiff = bestMatch.duration - scoreNote.duration;

                result.notes.push({
                    status: 'matched',
                    target: { ...scoreNote, absoluteTime: scoreAbsTime },
                    performance: { ...bestMatch },
                    timingDeviation,
                    velocityDiff,
                    durationDiff,
                    isEarly: timingDeviation < -this.timingTolerance,
                    isLate: timingDeviation > this.timingTolerance,
                    isVelocityMismatch: Math.abs(velocityDiff) > 15,
                    isDurationMismatch: Math.abs(durationDiff) > scoreNote.duration * 0.3
                });
            } else {
                result.notes.push({
                    status: 'missed',
                    target: { ...scoreNote, absoluteTime: scoreAbsTime },
                    performance: null,
                    reason: 'no_match'
                });
            }
        });

        performanceNotes.forEach((perfNote, perfIndex) => {
            if (!usedPerfIndices.has(perfIndex)) {
                result.extraNotes.push({
                    status: 'extra',
                    target: null,
                    performance: { ...perfNote },
                    reason: 'unmatched'
                });
            }
        });

        return result;
    }

    alignPedals(scorePedals, perfPedals) {
        return {
            targetPedals: scorePedals,
            performancePedals: perfPedals,
            issues: []
        };
    }

    groupPerformanceByMeasure(notes, secondsPerMeasure) {
        const groups = {};

        notes.forEach(note => {
            const measureNumber = Math.floor(note.startTime / secondsPerMeasure) + 1;
            if (!groups[measureNumber]) {
                groups[measureNumber] = [];
            }
            groups[measureNumber].push(note);
        });

        return groups;
    }

    parseTimeSignature(timeSig) {
        const match = timeSig.match(/(\d+)\/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 4;
    }

    detectSlurBreaks(alignment) {
        const slurGroups = {};

        alignment.measures.forEach((measure, mIndex) => {
            measure.notes.forEach((noteAlign, nIndex) => {
                if (noteAlign.target && noteAlign.target.slurGroup) {
                    const groupId = noteAlign.target.slurGroup;
                    if (!slurGroups[groupId]) {
                        slurGroups[groupId] = [];
                    }
                    slurGroups[groupId].push({
                        measureIndex: mIndex,
                        noteIndex: nIndex,
                        alignment: noteAlign
                    });
                }
            });
        });

        const slurBreaks = [];

        Object.values(slurGroups).forEach(group => {
            if (group.length < 2) return;

            group.sort((a, b) => {
                if (a.measureIndex !== b.measureIndex) {
                    return a.measureIndex - b.measureIndex;
                }
                return a.alignment.target.startTime - b.alignment.target.startTime;
            });

            for (let i = 1; i < group.length; i++) {
                const prev = group[i - 1];
                const curr = group[i];

                if (prev.alignment.status === 'matched' && curr.alignment.status === 'matched') {
                    const prevEndTime = prev.alignment.performance.endTime;
                    const currStartTime = curr.alignment.performance.startTime;
                    const gap = currStartTime - prevEndTime;

                    if (gap > 0.05) {
                        slurBreaks.push({
                            type: 'slur_break',
                            measure: prev.alignment.target.measureNumber || prev.measureIndex + 1,
                            previousNote: prev.alignment,
                            currentNote: curr.alignment,
                            gapDuration: gap,
                            severity: gap > 0.2 ? 'high' : (gap > 0.1 ? 'medium' : 'low')
                        });
                    }
                } else if (prev.alignment.status === 'missed' || curr.alignment.status === 'missed') {
                    slurBreaks.push({
                        type: 'slur_missed_note',
                        measure: prev.alignment.target.measureNumber || prev.measureIndex + 1,
                        previousNote: prev.alignment,
                        currentNote: curr.alignment,
                        severity: 'high'
                    });
                }
            }
        });

        return slurBreaks;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Aligner;
}
