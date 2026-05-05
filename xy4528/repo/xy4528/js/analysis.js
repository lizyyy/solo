/**
 * 数据分析模块
 * 包含时间线对齐逻辑和异常检测算法
 */

const Analysis = {
    // 数据存储
    data: {
        scoreLogs: [],
        roundSchedule: [],
        videoTimestamps: [],
        refereeNotes: [],
        alignedTimeline: [],
        anomalies: [],
        manualNotes: {}
    },
    
    // 加载数据
    loadData: function(scoreLogs, roundSchedule, videoTimestamps, refereeNotes) {
        this.data.scoreLogs = scoreLogs || [];
        this.data.roundSchedule = roundSchedule || [];
        this.data.videoTimestamps = videoTimestamps || [];
        this.data.refereeNotes = refereeNotes || [];
        this.data.alignedTimeline = [];
        this.data.anomalies = [];
    },
    
    // 解析时间字符串
    parseTime: function(timeStr) {
        if (!timeStr) return null;
        
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const seconds = parts.length > 2 ? parseInt(parts[2]) || 0 : 0;
            return hours * 3600 + minutes * 60 + seconds;
        }
        
        return null;
    },
    
    // 对齐时间线
    alignTimeline: function() {
        const timeline = [];
        
        // 添加得分日志到时间线
        this.data.scoreLogs.forEach(bout => {
            const timeSeconds = this.parseTime(bout.timestamp);
            timeline.push({
                type: 'bout',
                data: bout,
                boutId: bout.boutId,
                timestamp: bout.timestamp,
                timeSeconds: timeSeconds,
                piste: bout.piste,
                fencers: [bout.fencer1, bout.fencer2].filter(f => f)
            });
        });
        
        // 添加视频时间码到时间线
        this.data.videoTimestamps.forEach(timestamp => {
            const timeSeconds = this.parseTime(timestamp.realTime);
            timeline.push({
                type: 'video',
                data: timestamp,
                timestampId: timestamp.timestampId,
                boutId: timestamp.boutId,
                timestamp: timestamp.realTime,
                timeSeconds: timeSeconds,
                description: timestamp.description
            });
        });
        
        // 添加裁判备注到时间线
        this.data.refereeNotes.forEach(note => {
            const timeSeconds = this.parseTime(note.timestamp);
            timeline.push({
                type: 'referee_note',
                data: note,
                noteId: note.noteId,
                boutId: note.boutId,
                timestamp: note.timestamp,
                timeSeconds: timeSeconds,
                referee: note.referee
            });
        });
        
        // 按时间排序
        timeline.sort((a, b) => {
            if (a.timeSeconds !== null && b.timeSeconds !== null) {
                return a.timeSeconds - b.timeSeconds;
            }
            return 0;
        });
        
        this.data.alignedTimeline = timeline;
        return timeline;
    },
    
    // 检测所有异常
    detectAllAnomalies: function() {
        const anomalies = [];
        
        // 检测疑似漏记
        anomalies.push(...this.detectMissedBouts());
        
        // 检测双灯争议
        anomalies.push(...this.detectDoubleLightDisputes());
        
        // 检测暂停后比分错位
        anomalies.push(...this.detectScoreMismatchAfterPause());
        
        // 检测选手轮空异常
        anomalies.push(...this.detectByeAnomalies());
        
        this.data.anomalies = anomalies;
        return anomalies;
    },
    
    // 检测疑似漏记
    detectMissedBouts: function() {
        const anomalies = [];
        
        // 按场地分组
        const byPiste = {};
        this.data.scoreLogs.forEach(bout => {
            if (!byPiste[bout.piste]) {
                byPiste[bout.piste] = [];
            }
            byPiste[bout.piste].push(bout);
        });
        
        // 检查每个场地的剑次
        Object.keys(byPiste).forEach(piste => {
            const bouts = byPiste[piste].sort((a, b) => {
                const timeA = this.parseTime(a.timestamp);
                const timeB = this.parseTime(b.timestamp);
                return timeA - timeB;
            });
            
            // 检查比分是否连续
            for (let i = 1; i < bouts.length; i++) {
                const prev = bouts[i - 1];
                const curr = bouts[i];
                
                // 检查是否是同一场比赛
                if (prev.fencer1 === curr.fencer1 && prev.fencer2 === curr.fencer2) {
                    // 比分应该递增
                    const expectedScore1 = prev.score1 + (prev.winner === prev.fencer1 ? 1 : 0);
                    const expectedScore2 = prev.score2 + (prev.winner === prev.fencer2 ? 1 : 0);
                    
                    // 检查比分跳跃
                    if (curr.score1 > expectedScore1 + 1 || curr.score2 > expectedScore2 + 1) {
                        anomalies.push({
                            anomalyId: `MISSED_${Date.now()}_${Math.random()}`,
                            type: 'missed',
                            typeName: '疑似漏记',
                            description: `在${prev.boutId}和${curr.boutId}之间疑似漏记了一剑`,
                            severity: 'medium',
                            piste: piste,
                            fencers: [prev.fencer1, prev.fencer2],
                            relatedBouts: [prev.boutId, curr.boutId],
                            timestamp: prev.timestamp,
                            details: {
                                prevScore1: prev.score1,
                                prevScore2: prev.score2,
                                currScore1: curr.score1,
                                currScore2: curr.score2,
                                expectedScore1: expectedScore1,
                                expectedScore2: expectedScore2
                            }
                        });
                    }
                }
            }
            
            // 检查备注中的漏记提示
            bouts.forEach(bout => {
                if (bout.notes && bout.notes.includes('漏记')) {
                    anomalies.push({
                        anomalyId: `MISSED_${Date.now()}_${Math.random()}`,
                        type: 'missed',
                        typeName: '疑似漏记',
                        description: bout.notes,
                        severity: 'high',
                        piste: piste,
                        fencers: [bout.fencer1, bout.fencer2],
                        relatedBouts: [bout.boutId],
                        timestamp: bout.timestamp,
                        details: {
                            notes: bout.notes
                        }
                    });
                }
            });
        });
        
        return anomalies;
    },
    
    // 检测双灯争议
    detectDoubleLightDisputes: function() {
        const anomalies = [];
        
        this.data.scoreLogs.forEach(bout => {
            if (bout.isDoubleLight || (bout.lightStatus && bout.lightStatus.includes('双灯'))) {
                // 检查是否有裁判备注
                const relatedNotes = this.data.refereeNotes.filter(note => 
                    note.boutId === bout.boutId || 
                    (note.content && note.content.includes('双灯'))
                );
                
                anomalies.push({
                    anomalyId: `DOUBLE_${Date.now()}_${Math.random()}`,
                    type: 'double-light',
                    typeName: '双灯争议',
                    description: `剑次${bout.boutId}出现双灯情况`,
                    severity: 'medium',
                    piste: bout.piste,
                    fencers: [bout.fencer1, bout.fencer2],
                    relatedBouts: [bout.boutId],
                    timestamp: bout.timestamp,
                    details: {
                        lightStatus: bout.lightStatus,
                        winner: bout.winner,
                        score1: bout.score1,
                        score2: bout.score2,
                        refereeNotes: relatedNotes.map(n => ({
                            referee: n.referee,
                            content: n.content
                        }))
                    }
                });
            }
        });
        
        return anomalies;
    },
    
    // 检测暂停后比分错位
    detectScoreMismatchAfterPause: function() {
        const anomalies = [];
        
        // 按场地分组
        const byPiste = {};
        this.data.scoreLogs.forEach(bout => {
            if (!byPiste[bout.piste]) {
                byPiste[bout.piste] = [];
            }
            byPiste[bout.piste].push(bout);
        });
        
        Object.keys(byPiste).forEach(piste => {
            const bouts = byPiste[piste].sort((a, b) => {
                const timeA = this.parseTime(a.timestamp);
                const timeB = this.parseTime(b.timestamp);
                return timeA - timeB;
            });
            
            for (let i = 1; i < bouts.length; i++) {
                const prev = bouts[i - 1];
                const curr = bouts[i];
                
                // 检查是否有暂停标记
                if (curr.pauseBefore || (curr.notes && curr.notes.includes('暂停'))) {
                    // 检查时间间隔是否异常
                    const prevTime = this.parseTime(prev.timestamp);
                    const currTime = this.parseTime(curr.timestamp);
                    
                    if (prevTime !== null && currTime !== null) {
                        const timeDiff = currTime - prevTime;
                        
                        // 如果时间间隔超过5分钟，可能是暂停
                        if (timeDiff > 300) {
                            // 检查比分是否合理
                            const expectedScore1 = prev.score1 + (prev.winner === prev.fencer1 ? 1 : 0);
                            const expectedScore2 = prev.score2 + (prev.winner === prev.fencer2 ? 1 : 0);
                            
                            if (curr.score1 !== expectedScore1 || curr.score2 !== expectedScore2) {
                                anomalies.push({
                                    anomalyId: `SCORE_${Date.now()}_${Math.random()}`,
                                    type: 'score-mismatch',
                                    typeName: '暂停后比分错位',
                                    description: `剑次${curr.boutId}暂停后比分与预期不符`,
                                    severity: 'high',
                                    piste: piste,
                                    fencers: [curr.fencer1, curr.fencer2],
                                    relatedBouts: [prev.boutId, curr.boutId],
                                    timestamp: curr.timestamp,
                                    details: {
                                        timeDiffMinutes: Math.round(timeDiff / 60),
                                        prevScore1: prev.score1,
                                        prevScore2: prev.score2,
                                        currScore1: curr.score1,
                                        currScore2: curr.score2,
                                        expectedScore1: expectedScore1,
                                        expectedScore2: expectedScore2
                                    }
                                });
                            }
                        }
                    }
                }
                
                // 检查备注中的比分错位提示
                if (curr.notes && (curr.notes.includes('比分') && curr.notes.includes('错位'))) {
                    anomalies.push({
                        anomalyId: `SCORE_${Date.now()}_${Math.random()}`,
                        type: 'score-mismatch',
                        typeName: '暂停后比分错位',
                        description: curr.notes,
                        severity: 'high',
                        piste: piste,
                        fencers: [curr.fencer1, curr.fencer2],
                        relatedBouts: [curr.boutId],
                        timestamp: curr.timestamp,
                        details: {
                            notes: curr.notes
                        }
                    });
                }
            }
        });
        
        return anomalies;
    },
    
    // 检测选手轮空异常
    detectByeAnomalies: function() {
        const anomalies = [];
        
        this.data.roundSchedule.forEach(round => {
            if (round.isBye) {
                // 检查轮空是否合理
                const fencer = round.byeFencer || round.fencer1;
                
                if (!fencer) {
                    anomalies.push({
                        anomalyId: `BYE_${Date.now()}_${Math.random()}`,
                        type: 'bye-anomaly',
                        typeName: '选手轮空异常',
                        description: `轮次${round.roundId}轮空但未指定轮空选手`,
                        severity: 'low',
                        piste: round.piste,
                        fencers: [],
                        relatedRounds: [round.roundId],
                        timestamp: round.startTime,
                        details: {
                            roundNumber: round.roundNumber,
                            status: round.status
                        }
                    });
                } else {
                    // 检查轮空选手是否在其他场地有比赛
                    const conflictingRounds = this.data.roundSchedule.filter(r => 
                        r.roundId !== round.roundId &&
                        r.roundNumber === round.roundNumber &&
                        (r.fencer1 === fencer || r.fencer2 === fencer) &&
                        !r.isBye
                    );
                    
                    if (conflictingRounds.length > 0) {
                        anomalies.push({
                            anomalyId: `BYE_${Date.now()}_${Math.random()}`,
                            type: 'bye-anomaly',
                            typeName: '选手轮空异常',
                            description: `选手${fencer}在轮次${round.roundNumber}同时有轮空和比赛`,
                            severity: 'high',
                            piste: round.piste,
                            fencers: [fencer],
                            relatedRounds: [round.roundId, ...conflictingRounds.map(r => r.roundId)],
                            timestamp: round.startTime,
                            details: {
                                roundNumber: round.roundNumber,
                                conflictingPiste: conflictingRounds[0].piste,
                                status: round.status
                            }
                        });
                    }
                }
            }
        });
        
        return anomalies;
    },
    
    // 获取所有选手
    getFencers: function() {
        const fencers = new Set();
        
        this.data.scoreLogs.forEach(bout => {
            if (bout.fencer1) fencers.add(bout.fencer1);
            if (bout.fencer2) fencers.add(bout.fencer2);
        });
        
        this.data.roundSchedule.forEach(round => {
            if (round.fencer1) fencers.add(round.fencer1);
            if (round.fencer2) fencers.add(round.fencer2);
            if (round.byeFencer) fencers.add(round.byeFencer);
        });
        
        return Array.from(fencers).sort();
    },
    
    // 获取所有场地
    getPistes: function() {
        const pistes = new Set();
        
        this.data.scoreLogs.forEach(bout => {
            if (bout.piste) pistes.add(bout.piste);
        });
        
        this.data.roundSchedule.forEach(round => {
            if (round.piste) pistes.add(round.piste);
        });
        
        return Array.from(pistes).sort();
    },
    
    // 筛选数据
    filterData: function(fencer, piste, anomalyType) {
        let filteredAnomalies = [...this.data.anomalies];
        
        if (fencer) {
            filteredAnomalies = filteredAnomalies.filter(a => 
                a.fencers && a.fencers.includes(fencer)
            );
        }
        
        if (piste) {
            filteredAnomalies = filteredAnomalies.filter(a => a.piste === piste);
        }
        
        if (anomalyType) {
            filteredAnomalies = filteredAnomalies.filter(a => a.type === anomalyType);
        }
        
        let filteredTimeline = [...this.data.alignedTimeline];
        
        if (fencer) {
            filteredTimeline = filteredTimeline.filter(t => 
                t.fencers && t.fencers.includes(fencer)
            );
        }
        
        if (piste) {
            filteredTimeline = filteredTimeline.filter(t => t.piste === piste);
        }
        
        return {
            anomalies: filteredAnomalies,
            timeline: filteredTimeline
        };
    },
    
    // 保存人工改判备注
    saveManualNote: function(boutId, reversalType, reversalReason) {
        this.data.manualNotes[boutId] = {
            boutId: boutId,
            reversalType: reversalType,
            reversalReason: reversalReason,
            timestamp: new Date().toISOString()
        };
        
        return this.data.manualNotes[boutId];
    },
    
    // 获取人工改判备注
    getManualNote: function(boutId) {
        return this.data.manualNotes[boutId] || null;
    },
    
    // 获取所有人工改判备注
    getAllManualNotes: function() {
        return Object.values(this.data.manualNotes);
    },
    
    // 获取完整分析结果
    getAnalysisResult: function() {
        return {
            scoreLogs: this.data.scoreLogs,
            roundSchedule: this.data.roundSchedule,
            videoTimestamps: this.data.videoTimestamps,
            refereeNotes: this.data.refereeNotes,
            alignedTimeline: this.data.alignedTimeline,
            anomalies: this.data.anomalies,
            manualNotes: this.getAllManualNotes(),
            summary: {
                totalBouts: this.data.scoreLogs.length,
                totalAnomalies: this.data.anomalies.length,
                totalFencers: this.getFencers().length,
                totalPistes: this.getPistes().length,
                anomalyBreakdown: {
                    missed: this.data.anomalies.filter(a => a.type === 'missed').length,
                    doubleLight: this.data.anomalies.filter(a => a.type === 'double-light').length,
                    scoreMismatch: this.data.anomalies.filter(a => a.type === 'score-mismatch').length,
                    byeAnomaly: this.data.anomalies.filter(a => a.type === 'bye-anomaly').length
                }
            }
        };
    }
};

// 导出模块（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analysis;
}
