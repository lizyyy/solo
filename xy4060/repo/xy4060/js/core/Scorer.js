var Scorer = function() {
    this.optimalityThreshold = 1.5;
};

Scorer.prototype.calculateRating = function(executionResult, level, optimalCommandCount) {
    var rating = Constants.RATING.ZERO_STARS;
    
    if (!executionResult.success) {
        return {
            rating: rating,
            details: this._getRatingDetails(rating, executionResult),
            breakdown: this._createBreakdown(rating, executionResult)
        };
    }
    
    var totalCommands = executionResult.stats.commandsTotal;
    var energyUsed = executionResult.stats.energyUsed;
    var checkpointsVisited = executionResult.stats.checkpointsVisited;
    var totalCheckpoints = executionResult.stats.checkpointsTotal;
    
    var allCheckpointsVisited = checkpointsVisited === totalCheckpoints;
    
    if (!allCheckpointsVisited) {
        return {
            rating: Constants.RATING.ONE_STAR,
            details: '未通过所有检查点',
            breakdown: this._createBreakdown(Constants.RATING.ONE_STAR, executionResult)
        };
    }
    
    if (optimalCommandCount && totalCommands <= optimalCommandCount) {
        rating = Constants.RATING.THREE_STARS;
    } else if (optimalCommandCount && totalCommands <= optimalCommandCount * this.optimalityThreshold) {
        rating = Constants.RATING.TWO_STARS;
    } else {
        rating = Constants.RATING.ONE_STAR;
    }
    
    if (rating === Constants.RATING.THREE_STARS) {
        if (executionResult.warnings.length > 0) {
            rating = Constants.RATING.TWO_STARS;
        }
    }
    
    return {
        rating: rating,
        details: this._getRatingDetails(rating, executionResult),
        breakdown: this._createBreakdown(rating, executionResult)
    };
};

Scorer.prototype._getRatingDetails = function(rating, executionResult) {
    switch (rating) {
        case Constants.RATING.THREE_STARS:
            return '完美！指令最优，无任何错误';
        case Constants.RATING.TWO_STARS:
            return '不错！完成任务，但有优化空间';
        case Constants.RATING.ONE_STAR:
            return '基本完成，存在问题';
        case Constants.RATING.ZERO_STARS:
        default:
            if (executionResult.errors.length > 0) {
                return executionResult.errors[0].message;
            }
            return '任务失败';
    }
};

Scorer.prototype._createBreakdown = function(rating, executionResult) {
    var breakdown = {
        totalScore: rating * 100,
        categories: []
    };
    
    var successScore = executionResult.success ? 30 : 0;
    breakdown.categories.push({
        name: '任务完成',
        score: successScore,
        maxScore: 30,
        status: executionResult.success ? 'pass' : 'fail'
    });
    
    var checkpointsVisited = executionResult.stats.checkpointsVisited;
    var totalCheckpoints = executionResult.stats.checkpointsTotal;
    var checkpointScore = totalCheckpoints > 0 ? 
        Math.round((checkpointsVisited / totalCheckpoints) * 30) : 30;
    breakdown.categories.push({
        name: '检查点覆盖',
        score: checkpointScore,
        maxScore: 30,
        visited: checkpointsVisited,
        total: totalCheckpoints,
        status: checkpointsVisited === totalCheckpoints ? 'pass' : 'warning'
    });
    
    var efficiencyScore = 0;
    var commandCount = executionResult.stats.commandsTotal;
    if (executionResult.success) {
        if (commandCount <= 10) {
            efficiencyScore = 40;
        } else if (commandCount <= 20) {
            efficiencyScore = 30;
        } else if (commandCount <= 30) {
            efficiencyScore = 20;
        } else {
            efficiencyScore = 10;
        }
    }
    breakdown.categories.push({
        name: '指令效率',
        score: efficiencyScore,
        maxScore: 40,
        commandCount: commandCount,
        status: efficiencyScore >= 30 ? 'pass' : (efficiencyScore >= 10 ? 'warning' : 'fail')
    });
    
    if (executionResult.warnings.length > 0) {
        breakdown.warnings = executionResult.warnings;
    }
    
    if (executionResult.errors.length > 0) {
        breakdown.errors = executionResult.errors;
    }
    
    return breakdown;
};

Scorer.prototype.estimateOptimalCommands = function(level) {
    var startPos = level.startPosition;
    if (!startPos) return null;
    
    var checkpoints = level.getCheckpoints();
    if (checkpoints.length === 0) return 0;
    
    var totalDistance = 0;
    var currentPos = { x: startPos.x, y: startPos.y };
    
    var remainingCheckpoints = checkpoints.slice();
    
    while (remainingCheckpoints.length > 0) {
        var nearestIndex = 0;
        var nearestDist = Infinity;
        
        for (var i = 0; i < remainingCheckpoints.length; i++) {
            var cp = remainingCheckpoints[i];
            var dist = Math.abs(cp.x - currentPos.x) + Math.abs(cp.y - currentPos.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIndex = i;
            }
        }
        
        totalDistance += nearestDist;
        currentPos = remainingCheckpoints[nearestIndex];
        remainingCheckpoints.splice(nearestIndex, 1);
    }
    
    var samplePoints = level.getSamplePoints();
    var estimatedTurns = checkpoints.length + samplePoints.length;
    
    var optimalCommands = totalDistance + Math.ceil(estimatedTurns * 0.5) + samplePoints.length;
    
    return optimalCommands;
};

Scorer.prototype.getStarDisplay = function(rating) {
    var stars = '';
    for (var i = 0; i < 3; i++) {
        if (i < rating) {
            stars += '⭐';
        } else {
            stars += '☆';
        }
    }
    return stars;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scorer;
}
