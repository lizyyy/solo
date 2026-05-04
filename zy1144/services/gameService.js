const db = require('../database');
const gameLogic = require('./gameLogic');
const seedData = require('../data/seedData');

function initializeSeedData() {
    if (db.count('levels') > 0) return;

    for (const level of seedData) {
        const levelRecord = db.insert('levels', {
            id: level.id,
            name: level.name,
            description: level.description,
            center_lat: level.center_lat,
            center_lng: level.center_lng,
            radius: level.radius,
            config: level.config
        });

        for (const spot of level.hidingSpots) {
            db.insert('hidingSpots', {
                level_id: level.id,
                name: spot.name,
                lat: spot.lat,
                lng: spot.lng,
                radius: spot.radius,
                points: spot.points,
                difficulty: spot.difficulty
            });
        }

        for (const zone of level.interferenceZones) {
            db.insert('interferenceZones', {
                level_id: level.id,
                name: zone.name,
                lat: zone.lat,
                lng: zone.lng,
                radius: zone.radius,
                drift_multiplier: zone.drift_multiplier
            });
        }
    }
}

function getAllLevels() {
    const levels = db.findAll('levels');
    return levels.map(level => ({
        ...level,
        hidingSpots: db.findAll('hidingSpots', s => s.level_id === level.id),
        interferenceZones: db.findAll('interferenceZones', z => z.level_id === level.id)
    }));
}

function getLevelById(levelId) {
    const level = db.findById('levels', levelId);
    if (!level) return null;

    const spots = db.findAll('hidingSpots', s => s.level_id === levelId);
    const zones = db.findAll('interferenceZones', z => z.level_id === levelId);

    return {
        ...level,
        hidingSpots: spots,
        interferenceZones: zones
    };
}

function generateGameId() {
    return 'game_' + require('uuid').v4().slice(0, 12);
}

function createGame(levelId, playerName) {
    const level = getLevelById(levelId);
    if (!level) throw new Error('关卡不存在');

    const config = level.config;

    const game = db.insert('games', {
        level_id: levelId,
        player_name: playerName,
        status: 'pending',
        score: 0,
        time_limit: config.timeLimit,
        start_time: null,
        end_time: null
    });

    db.insert('items', {
        game_id: game.id,
        item_type: 'expand_scan',
        used: 0,
        used_at: null
    });

    return getGameById(game.id);
}

function getGameById(gameId) {
    const game = db.findById('games', gameId);
    if (!game) return null;

    const level = getLevelById(game.level_id);
    const items = db.findAll('items', i => i.game_id === gameId);
    const hitSpots = db.findAll('hitRecords', h => h.game_id === gameId).map(h => h.spot_id);

    return {
        ...game,
        level: level,
        items: items,
        hitSpots: hitSpots
    };
}

function startGame(gameId) {
    const game = db.findById('games', gameId);
    if (!game) throw new Error('游戏不存在');
    if (game.status !== 'pending') throw new Error('游戏状态不正确');

    db.update('games', g => g.id === gameId, {
        status: 'playing',
        start_time: new Date().toISOString()
    });

    return getGameById(gameId);
}

function processLocationSample(gameId, rawLat, rawLng, accuracy, isSimulated = false) {
    const game = getGameById(gameId);
    if (!game) throw new Error('游戏不存在');
    if (game.status !== 'playing') throw new Error('游戏未进行中');

    const level = game.level;
    const config = level.config;

    const interferenceZone = gameLogic.isInInterferenceZone(
        rawLat, rawLng, level.interferenceZones
    );
    const driftMultiplier = interferenceZone ? interferenceZone.drift_multiplier : 1.0;

    const drift = gameLogic.generateDriftNoise(rawLat, rawLng, accuracy, driftMultiplier);
    const driftLevel = gameLogic.calculateDriftLevel(accuracy * driftMultiplier);

    const sampleIndex = db.count('locationSamples', s => s.game_id === gameId);
    const timestamp = new Date().toISOString();

    let nearestSpot = null;
    let nearestDistance = Infinity;

    for (const spot of level.hidingSpots) {
        const distance = gameLogic.calculateDistance(
            drift.noisyLat, drift.noisyLng, spot.lat, spot.lng
        );
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestSpot = spot;
        }
    }

    const prevSamples = db.findAll('locationSamples', s => s.game_id === gameId);

    const currentSample = {
        raw_lat: rawLat,
        raw_lng: rawLng,
        timestamp: timestamp
    };

    const lastSample = prevSamples.length > 0 ? prevSamples[prevSamples.length - 1] : null;
    const isSuspicious = gameLogic.detectSuspiciousJump(lastSample, currentSample);

    let hitResult = null;
    let hitSpot = null;

    if (nearestSpot && !game.hitSpots.includes(nearestSpot.id)) {
        const expandItem = game.items.find(i => i.item_type === 'expand_scan' && i.used === 1);
        const expandedRadius = expandItem ? config.scanRadius * 2 : config.scanRadius;

        const directHit = gameLogic.checkHidingSpotHit(
            drift.noisyLat, drift.noisyLng, nearestSpot, expandedRadius
        );

        if (directHit.isHit) {
            const allSamples = [...prevSamples, {
                noisy_lat: drift.noisyLat,
                noisy_lng: drift.noisyLng
            }];
            
            const continuousHit = gameLogic.checkContinuousApproach(
                allSamples, nearestSpot, config.requiredContinuousSamples
            );

            if (continuousHit) {
                hitResult = continuousHit;
                hitSpot = nearestSpot;
            }
        }
    }

    const sampleRecord = db.insert('locationSamples', {
        game_id: gameId,
        sample_index: sampleIndex,
        raw_lat: rawLat,
        raw_lng: rawLng,
        noisy_lat: drift.noisyLat,
        noisy_lng: drift.noisyLng,
        accuracy: accuracy,
        timestamp: timestamp,
        is_simulated: isSimulated ? 1 : 0,
        is_suspicious: isSuspicious ? 1 : 0,
        drift_level: driftLevel,
        distance_to_target: nearestDistance,
        target_spot_id: nearestSpot ? nearestSpot.id : null,
        is_hit: hitResult ? 1 : 0,
        hit_reason: hitResult ? hitResult.reason : null
    });

    if (hitResult && hitSpot) {
        db.insert('hitRecords', {
            game_id: gameId,
            spot_id: hitSpot.id,
            sample_index: sampleIndex,
            points_awarded: hitSpot.points,
            timestamp: timestamp
        });

        const currentGame = db.findById('games', gameId);
        const newScore = (currentGame.score || 0) + hitSpot.points;
        db.update('games', g => g.id === gameId, { score: newScore });

        const allSpots = level.hidingSpots;
        const hitCount = db.count('hitRecords', h => h.game_id === gameId);
        
        if (hitCount >= allSpots.length) {
            db.update('games', g => g.id === gameId, {
                status: 'won',
                end_time: new Date().toISOString()
            });
        }
    }

    return {
        sample: {
            id: sampleRecord.id,
            sampleIndex,
            rawLat,
            rawLng,
            noisyLat: drift.noisyLat,
            noisyLng: drift.noisyLng,
            accuracy,
            timestamp,
            isSimulated,
            isSuspicious,
            driftLevel,
            driftAmount: drift.driftAmount,
            inInterferenceZone: !!interferenceZone,
            interferenceZoneName: interferenceZone ? interferenceZone.name : null
        },
        nearestSpot: nearestSpot ? {
            id: nearestSpot.id,
            name: nearestSpot.name,
            distance: nearestDistance,
            bearing: gameLogic.calculateBearing(drift.noisyLat, drift.noisyLng, nearestSpot.lat, nearestSpot.lng),
            direction: gameLogic.getDirectionFromBearing(
                gameLogic.calculateBearing(drift.noisyLat, drift.noisyLng, nearestSpot.lat, nearestSpot.lng)
            )
        } : null,
        hit: hitResult ? {
            spot: hitSpot,
            points: hitSpot.points,
            reason: hitResult.reason
        } : null
    };
}

function useItem(gameId, itemType) {
    const game = getGameById(gameId);
    if (!game) throw new Error('游戏不存在');
    if (game.status !== 'playing') throw new Error('游戏未进行中');

    const item = game.items.find(i => i.item_type === itemType && i.used === 0);
    if (!item) throw new Error('道具不可用');

    db.update('items', i => i.id === item.id, {
        used: 1,
        used_at: new Date().toISOString()
    });

    return {
        item: itemType,
        used: true,
        effect: itemType === 'expand_scan' ? '扫描圈已扩大2倍，持续本局' : null
    };
}

function endGame(gameId, status = 'lost') {
    const game = db.findById('games', gameId);
    if (!game) throw new Error('游戏不存在');
    if (game.status !== 'playing') throw new Error('游戏未进行中');

    db.update('games', g => g.id === gameId, {
        status: status,
        end_time: new Date().toISOString()
    });

    return getGameById(gameId);
}

function getGameSamples(gameId) {
    return db.findAll('locationSamples', s => s.game_id === gameId);
}

function getGameHits(gameId) {
    const hits = db.findAll('hitRecords', h => h.game_id === gameId);
    
    return hits.map(hit => {
        const spot = db.findById('hidingSpots', hit.spot_id);
        return {
            ...hit,
            spot_name: spot ? spot.name : '未知',
            spot_points: spot ? spot.points : 0,
            difficulty: spot ? spot.difficulty : 'unknown'
        };
    });
}

function generateReplayData(gameId) {
    const game = getGameById(gameId);
    if (!game) return null;

    const samples = getGameSamples(gameId);
    const hits = getGameHits(gameId);

    return {
        game: {
            id: game.id,
            levelId: game.level_id,
            levelName: game.level.name,
            playerName: game.player_name,
            status: game.status,
            score: game.score,
            startTime: game.start_time,
            endTime: game.end_time
        },
        level: {
            center: { lat: game.level.center_lat, lng: game.level.center_lng },
            radius: game.level.radius,
            hidingSpots: game.level.hidingSpots,
            interferenceZones: game.level.interferenceZones
        },
        samples: samples.map((s, idx) => ({
            index: s.sample_index,
            raw: { lat: s.raw_lat, lng: s.raw_lng },
            noisy: { lat: s.noisy_lat, lng: s.noisy_lng },
            accuracy: s.accuracy,
            timestamp: s.timestamp,
            isSimulated: s.is_simulated === 1,
            isSuspicious: s.is_suspicious === 1,
            driftLevel: s.drift_level,
            distanceToTarget: s.distance_to_target,
            targetSpotId: s.target_spot_id,
            isHit: s.is_hit === 1,
            hitReason: s.hit_reason
        })),
        hits: hits,
        totalSpots: game.level.hidingSpots.length,
        foundSpots: hits.length
    };
}

function exportReport(gameId, format = 'json') {
    const replay = generateReplayData(gameId);
    if (!replay) return null;

    if (format === 'json') {
        return JSON.stringify(replay, null, 2);
    }

    const duration = replay.game.endTime && replay.game.startTime
        ? Math.round((new Date(replay.game.endTime) - new Date(replay.game.startTime)) / 1000)
        : null;

    const markdown = `# 定位捉迷藏游戏报告

## 游戏信息
- **游戏ID**: ${replay.game.id}
- **关卡**: ${replay.game.levelName}
- **玩家**: ${replay.game.playerName}
- **最终状态**: ${replay.game.status === 'won' ? '胜利' : replay.game.status === 'lost' ? '失败' : '进行中'}
- **得分**: ${replay.game.score} 分
- **开始时间**: ${replay.game.startTime || '-'}
- **结束时间**: ${replay.game.endTime || '-'}
- **游戏时长**: ${duration ? duration + ' 秒' : '-'}

## 关卡信息
- **藏身点总数**: ${replay.totalSpots}
- **已发现**: ${replay.foundSpots}
- **隐藏点列表**:
${replay.level.hidingSpots.map(spot => `  - ${spot.name} (${spot.difficulty}, ${spot.points}分)`).join('\n')}

## 命中记录
${replay.hits.length > 0 ? replay.hits.map((hit, idx) => 
`### ${idx + 1}. ${hit.spot_name}
- 得分: +${hit.spot_points}
- 难度: ${hit.difficulty}
- 采样序号: #${hit.sample_index}
- 时间: ${hit.timestamp}`
).join('\n\n') : '暂无命中记录'}

## 采样统计
- **总采样次数**: ${replay.samples.length}
- **模拟定位**: ${replay.samples.filter(s => s.isSimulated).length} 次
- **可疑跳点**: ${replay.samples.filter(s => s.isSuspicious).length} 次
- **高漂移采样**: ${replay.samples.filter(s => s.driftLevel === 'high').length} 次

## 详细采样日志
| 序号 | 距离 | 精度 | 漂移 | 可疑 | 命中 | 原因 |
|------|------|------|------|------|------|------|
${replay.samples.slice(-20).map(s => 
`| ${s.index} | ${s.distanceToTarget ? s.distanceToTarget.toFixed(1) + 'm' : '-'} | ${s.accuracy}m | ${s.driftLevel} | ${s.isSuspicious ? '是' : '否'} | ${s.isHit ? '是' : '否'} | ${s.hitReason || '-'} |`
).join('\n')}

---
*报告生成时间: ${new Date().toISOString()}*
`;

    return markdown;
}

module.exports = {
    initializeSeedData,
    getAllLevels,
    getLevelById,
    createGame,
    getGameById,
    startGame,
    processLocationSample,
    useItem,
    endGame,
    getGameSamples,
    getGameHits,
    generateReplayData,
    exportReport
};
