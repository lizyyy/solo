var ReportGenerator = (function() {

    function generateReport(session) {
        var board = session.board;
        var history = session.history;
        var hintHistory = session.hintHistory || [];
        var startTime = session.startTime || null;
        var endTime = session.endTime || Date.now();

        var totalHints = 0;
        var level1Hints = 0;
        var level2Hints = 0;
        var level3Hints = 0;
        var techniquesUsed = {};

        for (var i = 0; i < hintHistory.length; i++) {
            var h = hintHistory[i];
            totalHints++;
            if (h.level === 1) level1Hints++;
            else if (h.level === 2) level2Hints++;
            else if (h.level === 3) level3Hints++;
            if (h.technique) {
                techniquesUsed[h.technique] = (techniquesUsed[h.technique] || 0) + 1;
            }
        }

        var givenCount = board ? board.givenCount() : 0;
        var userFilled = board ? (board.filledCount() - givenCount) : 0;
        var emptyCount = board ? (81 - board.filledCount()) : 81;

        var durationMs = startTime ? (endTime - startTime) : 0;
        var durationMin = Math.floor(durationMs / 60000);
        var durationSec = Math.floor((durationMs % 60000) / 1000);

        var conflictCount = 0;
        if (board) {
            board.detectConflicts();
            conflictCount = board.getConflictCells().length;
        }

        var solutionStatus = 'incomplete';
        if (board && board.isComplete() && conflictCount === 0) {
            solutionStatus = 'complete';
        } else if (conflictCount > 0) {
            solutionStatus = 'has_conflicts';
        }

        var hintWarning = '';
        var emptyTotal = 81 - givenCount;
        if (emptyTotal > 0) {
            var hintRatio = level3Hints / emptyTotal;
            if (hintRatio > 0.5) {
                hintWarning = '过度依赖提示，建议减少答案提示的使用';
            } else if (hintRatio > 0.3) {
                hintWarning = '提示使用较多，尝试更多独立思考';
            }
        }

        return {
            summary: {
                solutionStatus: solutionStatus,
                givenCount: givenCount,
                userFilled: userFilled,
                emptyCount: emptyCount,
                conflictCount: conflictCount,
                duration: {
                    ms: durationMs,
                    minutes: durationMin,
                    seconds: durationSec,
                    text: durationMin + '分' + durationSec + '秒'
                }
            },
            hints: {
                total: totalHints,
                level1: level1Hints,
                level2: level2Hints,
                level3: level3Hints,
                techniques: techniquesUsed,
                warning: hintWarning
            },
            difficulty: {
                level: session.difficulty || 'unknown',
                estimated: estimateDifficulty(hintHistory, userFilled, durationMs)
            },
            timestamp: {
                start: startTime,
                end: endTime,
                text: new Date(endTime).toLocaleString()
            }
        };
    }

    function estimateDifficulty(hintHistory, userFilled, durationMs) {
        var score = 0;
        if (durationMs < 180000) score += 1;
        else if (durationMs < 300000) score += 2;
        else if (durationMs < 600000) score += 3;
        else score += 4;

        var answerHints = 0;
        for (var i = 0; i < hintHistory.length; i++) {
            if (hintHistory[i].level === 3) answerHints++;
        }
        if (userFilled > 0) {
            var hintRatio = answerHints / userFilled;
            if (hintRatio < 0.1) score += 1;
            else if (hintRatio < 0.3) score += 2;
            else score += 3;
        }

        if (score <= 3) return 'easy';
        if (score <= 5) return 'medium';
        if (score <= 7) return 'hard';
        return 'expert';
    }

    function exportReport(report, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(report, null, 2);
            case 'text':
                return formatReportText(report);
            default:
                return JSON.stringify(report, null, 2);
        }
    }

    function formatReportText(report) {
        var lines = [];
        lines.push('===== 数独练习报告 =====');
        lines.push('生成时间: ' + report.timestamp.text);
        lines.push('');
        lines.push('--- 解题概况 ---');
        lines.push('完成状态: ' + getStatusText(report.summary.solutionStatus));
        lines.push('题目数字: ' + report.summary.givenCount + ' 个');
        lines.push('用户填写: ' + report.summary.userFilled + ' 个');
        lines.push('剩余空格: ' + report.summary.emptyCount + ' 个');
        lines.push('存在冲突: ' + (report.summary.conflictCount > 0 ? '是 (' + report.summary.conflictCount + '处)' : '否'));
        lines.push('用时: ' + report.summary.duration.text);
        lines.push('');
        lines.push('--- 提示统计 ---');
        lines.push('提示总数: ' + report.hints.total + ' 次');
        lines.push('  方向提示: ' + report.hints.level1 + ' 次');
        lines.push('  技巧提示: ' + report.hints.level2 + ' 次');
        lines.push('  答案提示: ' + report.hints.level3 + ' 次');
        if (report.hints.warning) {
            lines.push('注意: ' + report.hints.warning);
        }
        lines.push('');
        lines.push('--- 难度评估 ---');
        lines.push('题目难度: ' + report.difficulty.level);
        lines.push('表现难度: ' + getDifficultyText(report.difficulty.estimated));
        return lines.join('\n');
    }

    function getStatusText(status) {
        var map = {
            'complete': '已完成',
            'incomplete': '未完成',
            'has_conflicts': '存在冲突'
        };
        return map[status] || status;
    }

    function getDifficultyText(diff) {
        var map = {
            'easy': '简单',
            'medium': '中等',
            'hard': '困难',
            'expert': '专家级'
        };
        return map[diff] || diff;
    }

    return {
        generateReport: generateReport,
        exportReport: exportReport,
        formatReportText: formatReportText
    };
})();
