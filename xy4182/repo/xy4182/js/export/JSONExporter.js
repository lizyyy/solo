/**
 * JSON回放导出器
 * 将游戏回放数据导出为JSON格式
 */

class JSONExporter {
    constructor(engine, level, replaySystem) {
        this.engine = engine;
        this.level = level;
        this.replaySystem = replaySystem;
    }

    generateReplayData() {
        const level = this.level || this.engine.level;
        const replayData = this.replaySystem?.getReplayData?.();
        
        if (replayData) {
            return replayData;
        }
        
        return this.createReplayDataFromEngine();
    }

    createReplayDataFromEngine() {
        const level = this.level || this.engine.level;
        
        return {
            version: '1.0',
            created: new Date().toISOString(),
            initialState: {
                levelId: level?.id || null,
                levelName: level?.name || '未命名关卡',
                boardData: this.engine.board?.toJSON?.() || null,
                ships: this.engine.ships?.map(s => s.toJSON?.()) || [],
                timestamp: Date.now()
            },
            frames: [],
            metadata: {
                totalTurns: this.engine.totalTurns,
                finalTurn: this.engine.turn - 1,
                finalPenalty: this.engine.penaltyPoints,
                totalIncidents: this.engine.incidents?.length || 0,
                levelDifficulty: level?.difficulty || 'medium'
            },
            incidents: JSON.parse(JSON.stringify(this.engine.incidents || [])),
            finalState: {
                turn: this.engine.turn,
                penaltyPoints: this.engine.penaltyPoints,
                ships: this.engine.ships?.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    x: s.x,
                    y: s.y,
                    state: s.state
                })) || []
            }
        };
    }

    exportReplayJSON() {
        const data = this.generateReplayData();
        return JSON.stringify(data, null, 2);
    }

    exportToFile(filename = 'replay.json') {
        const json = this.exportReplayJSON();
        
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        return json;
    }

    importReplayJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.validateReplayData(data);
        } catch (e) {
            console.error('导入回放数据失败:', e);
            return { valid: false, error: e.message };
        }
    }

    validateReplayData(data) {
        const issues = [];
        
        if (!data.version) {
            issues.push('缺少版本号');
        }
        
        if (!data.initialState) {
            issues.push('缺少初始状态');
        } else {
            if (!data.initialState.ships || !Array.isArray(data.initialState.ships)) {
                issues.push('初始状态缺少船舶数据');
            }
            if (!data.initialState.boardData) {
                issues.push('初始状态缺少棋盘数据');
            }
        }
        
        if (!data.frames || !Array.isArray(data.frames)) {
            issues.push('缺少帧数据');
        }
        
        if (!data.metadata) {
            issues.push('缺少元数据');
        }
        
        return {
            valid: issues.length === 0,
            issues: issues,
            data: data
        };
    }

    generateCompactReplay() {
        const level = this.level || this.engine.level;
        const replayData = this.replaySystem?.getReplayData?.();
        
        if (!replayData) {
            return this.createReplayDataFromEngine();
        }
        
        return {
            v: replayData.version,
            ts: replayData.created,
            lvl: {
                id: replayData.initialState.levelId,
                name: replayData.initialState.levelName
            },
            f: replayData.frames.map(frame => ({
                t: frame.turn,
                s: frame.ships.map(ship => ({
                    i: ship.id,
                    x: ship.x,
                    y: ship.y,
                    dx: ship.dx,
                    dy: ship.dy,
                    st: ship.state
                })),
                p: frame.penaltyPoints,
                si: frame.selectedShipId
            })),
            meta: replayData.metadata,
            inc: replayData.incidents?.map(i => ({
                t: i.type,
                tn: i.turn,
                d: i.description,
                p: i.points
            })) || []
        };
    }

    exportCompactReplay() {
        const data = this.generateCompactReplay();
        return JSON.stringify(data);
    }

    exportGameStateJSON() {
        const level = this.level || this.engine.level;
        
        const state = {
            exportType: 'game_state',
            version: '1.0',
            timestamp: new Date().toISOString(),
            level: {
                id: level?.id || null,
                name: level?.name || '未命名关卡',
                difficulty: level?.difficulty || 'medium'
            },
            gameState: {
                turn: this.engine.turn,
                totalTurns: this.engine.totalTurns,
                penaltyPoints: this.engine.penaltyPoints,
                gameStarted: this.engine.gameStarted,
                gameEnded: this.engine.gameEnded,
                winner: this.engine.winner
            },
            ships: this.engine.ships?.map(ship => ({
                id: ship.id,
                name: ship.name,
                type: ship.type,
                x: ship.x,
                y: ship.y,
                dx: ship.dx,
                dy: ship.dy,
                speed: ship.speed,
                state: ship.state,
                mode: ship.mode
            })) || [],
            incidents: JSON.parse(JSON.stringify(this.engine.incidents || []))
        };
        
        return JSON.stringify(state, null, 2);
    }

    exportLevelJSON() {
        const level = this.level || this.engine.level;
        
        if (!level) {
            return JSON.stringify({ error: '无可用关卡数据' }, null, 2);
        }
        
        return JSON.stringify(level.toJSON ? level.toJSON() : level, null, 2);
    }

    exportIncidentsJSON() {
        const incidents = this.engine.incidents || [];
        
        const data = {
            exportType: 'incidents',
            timestamp: new Date().toISOString(),
            levelName: this.level?.name || this.engine.level?.name || '未命名关卡',
            totalIncidents: incidents.length,
            totalPenalty: this.engine.penaltyPoints,
            incidents: incidents.map(incident => ({
                type: incident.type,
                typeName: this.getIncidentTypeName(incident.type),
                turn: incident.turn,
                description: incident.description,
                points: incident.points,
                ships: incident.ships || [],
                details: incident.details || null
            }))
        };
        
        return JSON.stringify(data, null, 2);
    }

    getIncidentTypeName(type) {
        switch (type) {
            case IncidentType.COLLISION: return '碰撞事故';
            case IncidentType.SHALLOW: return '浅滩驶入';
            case IncidentType.SPEED: return '超速违规';
            case IncidentType.GIVE_WAY: return '让路违规';
            case IncidentType.BOUNDARY: return '越界违规';
            default: return '未知违规';
        }
    }

    exportShipsJSON() {
        const ships = this.engine.ships || [];
        
        const data = {
            exportType: 'ships',
            timestamp: new Date().toISOString(),
            levelName: this.level?.name || this.engine.level?.name || '未命名关卡',
            turn: this.engine.turn,
            ships: ships.map(ship => ({
                id: ship.id,
                name: ship.name,
                type: ship.type,
                typeName: this.getShipTypeName(ship.type),
                x: ship.x,
                y: ship.y,
                dx: ship.dx,
                dy: ship.dy,
                speed: ship.speed,
                state: ship.state,
                stateName: ship.getStateDisplayName?.() || ship.state,
                mode: ship.mode,
                isControllable: ship.isControllable?.() || false
            }))
        };
        
        return JSON.stringify(data, null, 2);
    }

    getShipTypeName(type) {
        switch (type) {
            case ShipType.TUG: return '拖轮';
            case ShipType.CARGO: return '货船';
            case ShipType.OTHER: return '来船';
            default: return '未知';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JSONExporter };
}
