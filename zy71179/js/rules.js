const RuleEngine = {
    checkAllConflicts(state, levelData) {
        const conflicts = [];
        const allPlacedEvents = [];
        
        state.tracks.forEach(track => {
            track.events.forEach(evt => {
                if (evt.placed && evt.startTime !== null) {
                    allPlacedEvents.push(evt);
                }
            });
        });

        conflicts.push(...this.checkOverlap(allPlacedEvents));
        conflicts.push(...this.checkLightOrder(allPlacedEvents));
        conflicts.push(...this.checkPropBlocksEntrance(allPlacedEvents));
        conflicts.push(...this.checkSceneChangeTimeout(state, allPlacedEvents));
        conflicts.push(...this.checkMissingEvents(allPlacedEvents, levelData));

        return conflicts;
    },

    checkOverlap(events) {
        const conflicts = [];
        const trackGroups = {};
        
        events.forEach(evt => {
            if (!trackGroups[evt.track]) trackGroups[evt.track] = [];
            trackGroups[evt.track].push(evt);
        });

        Object.keys(trackGroups).forEach(trackId => {
            const trackEvents = trackGroups[trackId].sort((a, b) => a.startTime - b.startTime);
            for (let i = 0; i < trackEvents.length - 1; i++) {
                const curr = trackEvents[i];
                const next = trackEvents[i + 1];
                if (curr.endTime > next.startTime) {
                    conflicts.push(new Conflict(
                        ConflictType.OVERLAP,
                        `时间重叠: "${curr.name}" 和 "${next.name}" 在同一轨道`,
                        'error',
                        {
                            time: curr.startTime,
                            eventIds: [curr.id, next.id],
                            trackId: trackId
                        }
                    ));
                }
            }
        });

        return conflicts;
    },

    checkLightOrder(events) {
        const conflicts = [];
        const lightGroups = {};
        
        events.filter(e => e.type === EventType.LIGHT && e.lightGroupId).forEach(evt => {
            if (!lightGroups[evt.lightGroupId]) lightGroups[evt.lightGroupId] = [];
            lightGroups[evt.lightGroupId].push(evt);
        });

        Object.keys(lightGroups).forEach(groupId => {
            const groupEvents = lightGroups[groupId]
                .filter(e => e.order !== null && e.order > 0)
                .sort((a, b) => a.startTime - b.startTime);
            
            for (let i = 0; i < groupEvents.length - 1; i++) {
                const curr = groupEvents[i];
                const next = groupEvents[i + 1];
                if (curr.order > next.order) {
                    conflicts.push(new Conflict(
                        ConflictType.LIGHT_ORDER,
                        `灯光顺序错误: "${curr.name}"(#${curr.order}) 不应在 "${next.name}"(#${next.order}) 之前`,
                        'error',
                        {
                            time: curr.startTime,
                            eventIds: [curr.id, next.id],
                            groupId: groupId
                        }
                    ));
                }
            }
        });

        return conflicts;
    },

    checkPropBlocksEntrance(events) {
        const conflicts = [];
        const blockingProps = events.filter(e => e.type === EventType.PROP && e.blockEntrance);
        const actorEvents = events.filter(e => e.type === EventType.ACTOR);

        actorEvents.forEach(actor => {
            const entranceId = actor.entranceId;
            blockingProps.forEach(prop => {
                if (prop.entranceId === entranceId) {
                    const overlap = this.timeOverlap(
                        prop.startTime, prop.endTime,
                        actor.startTime, actor.endTime
                    );
                    if (overlap) {
                        conflicts.push(new Conflict(
                            ConflictType.PROP_BLOCKS_ENTRANCE,
                            `入口阻塞: "${prop.name}" 挡住了入口 ${entranceId}，"${actor.name}" 无法入场`,
                            'error',
                            {
                                time: Math.max(prop.startTime, actor.startTime),
                                eventIds: [prop.id, actor.id],
                                entranceId: entranceId
                            }
                        ));
                    }
                }
            });
        });

        return conflicts;
    },

    checkSceneChangeTimeout(state, events) {
        const conflicts = [];
        
        state.sceneChanges.forEach(sc => {
            const changeEndTime = sc.startTime + sc.maxDuration;
            const eventsDuringChange = events.filter(e => 
                e.startTime >= sc.startTime && e.startTime < changeEndTime
            );
            
            let lastEventEndTime = sc.startTime;
            eventsDuringChange.forEach(e => {
                if (e.endTime > lastEventEndTime) {
                    lastEventEndTime = e.endTime;
                }
            });
            
            sc.actualDuration = Math.max(0, lastEventEndTime - sc.startTime);
            
            if (lastEventEndTime > changeEndTime) {
                const overTime = lastEventEndTime - changeEndTime;
                conflicts.push(new Conflict(
                    ConflictType.SCENECHANGE_TIMEOUT,
                    `换景超时: ${sc.fromScene} → ${sc.toScene} 超出 ${overTime.toFixed(1)}秒 (限制${sc.maxDuration}秒)`,
                    'error',
                    {
                        time: sc.startTime,
                        eventIds: eventsDuringChange.map(e => e.id),
                        sceneChange: sc,
                        overTime: overTime
                    }
                ));
            }
        });

        return conflicts;
    },

    checkMissingEvents(events, levelData) {
        const conflicts = [];
        const placedIds = new Set(events.map(e => e.id));
        
        levelData.requiredEventIds.forEach(reqId => {
            if (!placedIds.has(reqId)) {
                const evtData = levelData.events.find(e => e.id === reqId);
                conflicts.push(new Conflict(
                    ConflictType.MISSING_EVENT,
                    `缺少必需事件: "${evtData ? evtData.name : reqId}" 未放置到时间轴`,
                    'warning',
                    {
                        time: 0,
                        eventIds: [reqId]
                    }
                ));
            }
        });

        return conflicts;
    },

    timeOverlap(s1, e1, s2, e2) {
        return s1 < e2 && s2 < e1;
    },

    calculateScore(conflicts, levelData, state) {
        let score = levelData.maxScore;
        const errors = conflicts.filter(c => c.severity === 'error');
        const warnings = conflicts.filter(c => c.severity === 'warning');

        score -= errors.length * 20;
        score -= warnings.length * 5;

        state.sceneChanges.forEach(sc => {
            if (sc.actualDuration > 0 && sc.actualDuration < sc.maxDuration) {
                const timeBonus = Math.floor((sc.maxDuration - sc.actualDuration) * 2);
                score += timeBonus;
            }
        });

        const allPlaced = state.tracks.reduce((sum, t) => sum + t.events.length, 0);
        if (allPlaced === levelData.requiredEventIds.length) {
            score += 10;
        }

        return Math.max(0, score);
    },

    simulatePlayback(state, levelData, onEventStart, onEventEnd, onConflict, onComplete) {
        const allEvents = [];
        state.tracks.forEach(track => {
            track.events.forEach(evt => {
                if (evt.placed && evt.startTime !== null) {
                    allEvents.push(new ScheduledEvent(evt, evt.startTime));
                    allEvents.push(new ScheduledEvent(evt, evt.endTime, true));
                }
            });
        });

        allEvents.sort((a, b) => {
            if (a.time !== b.time) return a.time - b.time;
            return a.isEnd ? 1 : -1;
        });

        const conflicts = this.checkAllConflicts(state, levelData);
        const errorConflicts = conflicts.filter(c => c.severity === 'error');

        return {
            events: allEvents,
            conflicts: conflicts,
            hasErrors: errorConflicts.length > 0,
            totalTime: state.maxTime
        };
    },

    validatePlacement(event, track, startTime, state) {
        if (track.type !== 'light' && event.type === EventType.LIGHT) {
            return { valid: false, reason: '灯光事件只能放在灯光轨道' };
        }
        if (track.type !== 'prop' && event.type === EventType.PROP) {
            return { valid: false, reason: '道具事件只能放在道具轨道' };
        }
        if (track.type !== 'actor' && event.type === EventType.ACTOR) {
            return { valid: false, reason: '演员事件只能放在演员轨道' };
        }

        if (startTime < 0 || startTime + event.duration > state.maxTime) {
            return { valid: false, reason: '事件超出时间轴范围' };
        }

        const overlapEvent = track.events.find(e => 
            e.id !== event.id && 
            this.timeOverlap(startTime, startTime + event.duration, e.startTime, e.endTime)
        );

        if (overlapEvent) {
            return { valid: false, reason: `与 "${overlapEvent.name}" 时间重叠` };
        }

        return { valid: true };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngine };
}
