
const EVENT_TYPES = {
    SINGLE_ROCKER: 'single_rocker',
    DOUBLE_ROCKER: 'double_rocker',
    RELAY: 'relay'
};

const EVENT_NAMES = {
    [EVENT_TYPES.SINGLE_ROCKER]: '单摇',
    [EVENT_TYPES.DOUBLE_ROCKER]: '双摇',
    [EVENT_TYPES.RELAY]: '接力'
};

const EVENT_CONFIGS = {
    [EVENT_TYPES.SINGLE_ROCKER]: {
        name: '单摇',
        duration: 60,
        countPerJump: 1,
        maxErrors: null,
        errorPenalty: 0,
        foulPenalty: 5,
        disqualifyAfterFouls: 3
    },
    [EVENT_TYPES.DOUBLE_ROCKER]: {
        name: '双摇',
        duration: 60,
        countPerJump: 2,
        maxErrors: 10,
        errorPenalty: 2,
        foulPenalty: 5,
        disqualifyAfterFouls: 2
    },
    [EVENT_TYPES.RELAY]: {
        name: '接力',
        duration: 180,
        countPerJump: 1,
        maxErrors: null,
        errorPenalty: 0,
        foulPenalty: 10,
        disqualifyAfterFouls: 1
    }
};

class RulesEngine {
    constructor() {
        this.eventConfigs = EVENT_CONFIGS;
    }

    getEventConfig(eventType) {
        return this.eventConfigs[eventType] || null;
    }

    getEventName(eventType) {
        return EVENT_NAMES[eventType] || '未知项目';
    }

    calculateEffectiveScore(result, eventType) {
        const config = this.getEventConfig(eventType);
        if (!config) return { valid: false, score: 0, message: '无效的项目类型' };

        const { rawCount, errorCount, foulCount } = result;
        
        if (config.disqualifyAfterFouls && foulCount >= config.disqualifyAfterFouls) {
            return { 
                valid: false, 
                score: 0, 
                disqualified: true,
                message: `犯规${foulCount}次，已取消资格` 
            };
        }

        let effectiveScore = rawCount * config.countPerJump;
        let penalty = 0;

        if (config.errorPenalty > 0) {
            penalty += errorCount * config.errorPenalty;
        }

        if (config.foulPenalty > 0) {
            penalty += foulCount * config.foulPenalty;
        }

        effectiveScore = Math.max(0, effectiveScore - penalty);

        return {
            valid: true,
            score: effectiveScore,
            rawCount,
            errorCount,
            foulCount,
            penalty,
            config: {
                countPerJump: config.countPerJump,
                errorPenalty: config.errorPenalty,
                foulPenalty: config.foulPenalty
            },
            message: this.getScoreMessage(result, eventType)
        };
    }

    getScoreMessage(result, eventType) {
        const config = this.getEventConfig(eventType);
        if (!config) return '无效项目';

        const messages = [];
        messages.push(`原始次数: ${result.rawCount}`);
        
        if (config.countPerJump > 1) {
            messages.push(`×${config.countPerJump} = ${result.rawCount * config.countPerJump}`);
        }

        if (result.errorCount > 0 && config.errorPenalty > 0) {
            messages.push(`失误${result.errorCount}次，处罚${result.errorCount * config.errorPenalty}分`);
        }

        if (result.foulCount > 0 && config.foulPenalty > 0) {
            messages.push(`犯规${result.foulCount}次，处罚${result.foulCount * config.foulPenalty}分`);
        }

        return messages.join(' | ');
    }

    calculateRankings(results, eventType) {
        const scoredResults = results.map(result => ({
            ...result,
            ...this.calculateEffectiveScore(result, eventType)
        }));

        const validResults = scoredResults.filter(r => r.valid);
        const disqualifiedResults = scoredResults.filter(r => r.disqualified);

        validResults.sort((a, b) => b.score - a.score);

        let currentRank = 1;
        const rankedResults = [];
        let previousScore = null;
        let tieCount = 0;

        validResults.forEach((result, index) => {
            if (index === 0) {
                result.rank = 1;
                previousScore = result.score;
                tieCount = 1;
            } else {
                if (result.score === previousScore) {
                    result.rank = currentRank;
                    tieCount++;
                } else {
                    currentRank = currentRank + tieCount;
                    result.rank = currentRank;
                    tieCount = 1;
                    previousScore = result.score;
                }
            }
            result.isTie = tieCount > 1;
            rankedResults.push(result);
        });

        disqualifiedResults.forEach(result => {
            result.rank = -1;
            result.isTie = false;
            rankedResults.push(result);
        });

        return rankedResults;
    }

    calculateTeamRankings(results, eventType) {
        const teamScores = {};

        results.forEach(result => {
            const team = result.team || '未知队伍';
            const event = result.eventType || eventType;
            
            const key = `${team}_${event}`;
            
            if (!teamScores[key]) {
                teamScores[key] = {
                    team,
                    event,
                    count: 0,
                    totalScore: 0,
                    results: []
                };
            }

            const scored = this.calculateEffectiveScore(result, event);
            if (scored.valid) {
                teamScores[key].count++;
                teamScores[key].totalScore += scored.score;
                teamScores[key].results.push(result);
            }
        });

        const teamList = Object.values(teamScores);
        
        teamList.sort((a, b) => b.totalScore - a.totalScore);

        let currentRank = 1;
        const rankedTeams = [];
        let previousScore = null;
        let tieCount = 0;

        teamList.forEach((team, index) => {
            if (index === 0) {
                team.rank = 1;
                previousScore = team.totalScore;
                tieCount = 1;
            } else {
                if (team.totalScore === previousScore) {
                    team.rank = currentRank;
                    tieCount++;
                } else {
                    currentRank = currentRank + tieCount;
                    team.rank = currentRank;
                    tieCount = 1;
                    previousScore = team.totalScore;
                }
            }
            team.isTie = tieCount > 1;
            rankedTeams.push(team);
        });

        return rankedTeams;
    }

    validateResult(result, eventType) {
        const errors = [];
        const warnings = [];

        if (result.rawCount < 0) {
            errors.push('有效次数不能为负数');
        }

        if (result.errorCount < 0) {
            errors.push('失误次数不能为负数');
        }

        if (result.foulCount < 0) {
            errors.push('犯规次数不能为负数');
        }

        if (result.rawCount > 300) {
            warnings.push('有效次数异常高，请确认是否正确');
        }

        if (result.errorCount > 50) {
            warnings.push('失误次数异常高，请确认是否正确');
        }

        if (result.foulCount > 5) {
            warnings.push('犯规次数较多，请确认是否正确');
        }

        const config = this.getEventConfig(eventType);
        if (config && config.disqualifyAfterFouls && result.foulCount >= config.disqualifyAfterFouls) {
            warnings.push(`犯规${result.foulCount}次，已达到取消资格阈值`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    compareResults(result1, result2, eventType) {
        const score1 = this.calculateEffectiveScore(result1, eventType);
        const score2 = this.calculateEffectiveScore(result2, eventType);

        if (score1.score > score2.score) return 1;
        if (score1.score < score2.score) return -1;
        return 0;
    }
}

export default RulesEngine;
export { EVENT_TYPES, EVENT_NAMES, EVENT_CONFIGS };
