import { EchoCalculator } from '../physics/EchoCalculator.js';

export class ReportGenerator {
    constructor(gameEngine, errorDetector, changeTracker) {
        this.gameEngine = gameEngine;
        this.errorDetector = errorDetector;
        this.changeTracker = changeTracker;
    }

    generateExperimentReport(options = {}) {
        const gameState = this.gameEngine.gameState;
        const maze = this.gameEngine.maze;
        const history = this.gameEngine.getHistory();
        const failures = this.gameEngine.getAllFailures();
        const errors = this.errorDetector.getErrorSummary();
        const changes = this.changeTracker.getChangeSummary();

        const report = {
            reportId: `report_${Date.now()}`,
            generatedAt: new Date().toISOString(),
            experimentInfo: {
                title: options.title || '声波迷宫救援队实验报告',
                studentName: options.studentName || '匿名学生',
                class: options.class || '',
                date: options.date || new Date().toLocaleDateString('zh-CN'),
                experimentType: '声音反射实验'
            },
            experimentSetup: {
                mazeSize: {
                    width: maze.width,
                    height: maze.height
                },
                gridSize: maze.gridSize,
                wallCount: maze.walls.filter(w => !w.id.startsWith('boundary_')).length,
                characterCount: maze.characters.length,
                soundSourceCount: maze.soundSources.length,
                initialResources: {
                    soundPulses: gameState.resources.soundPulsesMax,
                    energy: gameState.resources.energyMax,
                    timeUnits: gameState.resources.timeUnitsMax
                }
            },
            gameResult: {
                victory: gameState.victory,
                gameOver: gameState.gameOver,
                failReason: gameState.failReason,
                totalTurns: gameState.turn,
                finalScore: {
                    ...gameState.score
                },
                finalResources: {
                    soundPulses: gameState.resources.soundPulses,
                    energy: gameState.resources.energy,
                    timeUnits: gameState.resources.timeUnits
                },
                teammatesRescued: maze.getRescuedTeammates().length,
                teammatesTrapped: maze.getTrappedTeammates().length,
                teammatesLost: maze.characters.filter(c => c.type === 'teammate' && c.status === 'lost').length
            },
            actionHistory: this.formatActionHistory(history),
            soundAnalysis: this.generateSoundAnalysis(history),
            errorAnalysis: this.generateErrorAnalysis(errors),
            changeHistory: this.generateChangeSummary(changes),
            failureAnalysis: this.generateFailureAnalysis(failures),
            physicsConcepts: this.generatePhysicsConcepts(),
            conclusions: this.generateConclusions(gameState, history, errors),
            teacherNotes: options.teacherNotes || ''
        };

        return report;
    }

    formatActionHistory(history) {
        return history.map((action, index) => ({
            actionNumber: index + 1,
            turn: action.turn,
            type: action.type,
            typeLabel: this.getActionTypeLabel(action.type),
            timestamp: new Date(action.timestamp).toLocaleString('zh-CN'),
            parameters: action.parameters,
            result: action.result,
            resourcesAfter: action.stateSnapshot ? {
                soundPulses: action.stateSnapshot.resources.soundPulses,
                energy: action.stateSnapshot.resources.energy,
                timeUnits: action.stateSnapshot.resources.timeUnits,
                score: action.stateSnapshot.score.total
            } : null
        }));
    }

    getActionTypeLabel(type) {
        const labels = {
            move: '移动',
            sound_pulse: '发射声波',
            rescue: '救援队友'
        };
        return labels[type] || type;
    }

    generateSoundAnalysis(history) {
        const soundPulses = history.filter(h => h.type === 'sound_pulse');
        
        if (soundPulses.length === 0) {
            return {
                totalPulses: 0,
                message: '未发射任何声波'
            };
        }

        let totalEchoes = 0;
        let totalReflections = 0;
        let totalDistance = 0;
        let totalTime = 0;
        const echoBreakdown = {};

        for (const pulse of soundPulses) {
            totalEchoes += pulse.result.echoCount || 0;
            totalReflections += pulse.result.reflectionCount || 0;
            totalDistance += pulse.result.totalDistance || 0;
            totalTime += pulse.result.totalTime || 0;

            if (pulse.echoes) {
                for (const echo of pulse.echoes) {
                    const material = echo.wallMaterial || 'unknown';
                    if (!echoBreakdown[material]) {
                        echoBreakdown[material] = { count: 0, totalTime: 0, totalDistance: 0 };
                    }
                    echoBreakdown[material].count++;
                    echoBreakdown[material].totalTime += echo.time;
                    echoBreakdown[material].totalDistance += echo.distance;
                }
            }
        }

        return {
            totalPulses: soundPulses.length,
            totalEchoes: totalEchoes,
            totalReflections: totalReflections,
            averageEchoesPerPulse: (totalEchoes / soundPulses.length).toFixed(2),
            averageReflectionsPerPulse: (totalReflections / soundPulses.length).toFixed(2),
            averageDistancePerPulse: (totalDistance / soundPulses.length).toFixed(2),
            averageTimePerPulse: (totalTime / soundPulses.length).toFixed(4),
            echoByMaterial: echoBreakdown,
            pulses: soundPulses.map((p, i) => ({
                pulseNumber: i + 1,
                turn: p.turn,
                direction: p.parameters.direction,
                intensity: p.parameters.intensity,
                echoCount: p.result.echoCount,
                reflectionCount: p.result.reflectionCount,
                totalDistance: p.result.totalDistance?.toFixed(2),
                totalTime: p.result.totalTime?.toFixed(4)
            }))
        };
    }

    generateErrorAnalysis(errorSummary) {
        const errorTypeLabels = {
            reflection_angle: '反射角错误',
            time_unit: '时间单位错误',
            wall_penetration: '墙体穿透错误',
            boundary_violation: '边界违规',
            echo_consistency: '回声一致性错误',
            movement_boundary: '移动边界错误',
            movement_collision: '移动碰撞错误',
            invalid_wall: '无效墙体数据',
            invalid_character: '无效角色数据',
            wall_overlap: '墙体重叠警告'
        };

        const severityLabels = {
            warning: '警告',
            error: '错误',
            critical: '严重错误'
        };

        const byTypeWithLabels = {};
        for (const [type, count] of Object.entries(errorSummary.byType)) {
            byTypeWithLabels[errorTypeLabels[type] || type] = count;
        }

        const bySeverityWithLabels = {};
        for (const [severity, count] of Object.entries(errorSummary.bySeverity)) {
            bySeverityWithLabels[severityLabels[severity] || severity] = count;
        }

        return {
            totalErrors: errorSummary.total,
            byType: byTypeWithLabels,
            bySeverity: bySeverityWithLabels,
            unconfirmed: errorSummary.unconfirmed,
            confirmed: errorSummary.confirmed,
            hasCriticalErrors: errorSummary.bySeverity.critical > 0,
            errorDetails: this.errorDetector.detectedErrors.map(e => ({
                type: errorTypeLabels[e.type] || e.type,
                severity: severityLabels[e.severity] || e.severity,
                description: e.description,
                location: e.location,
                detectedAt: new Date(e.detectedAt).toLocaleString('zh-CN'),
                confirmed: e.confirmed,
                ignored: e.ignored
            }))
        };
    }

    generateChangeSummary(changeSummary) {
        const entityLabels = {
            wall: '墙体',
            character: '角色',
            soundSource: '声源',
            maze: '迷宫设置',
            gameState: '游戏状态'
        };

        const actionLabels = {
            create: '新增',
            update: '更新',
            delete: '删除'
        };

        const byEntityWithLabels = {};
        for (const [type, count] of Object.entries(changeSummary.byEntityType)) {
            byEntityWithLabels[entityLabels[type] || type] = count;
        }

        const byActionWithLabels = {};
        for (const [action, count] of Object.entries(changeSummary.byAction)) {
            byActionWithLabels[actionLabels[action] || action] = count;
        }

        const recentChanges = this.changeTracker.getRecentChanges(10).map(change => 
            this.changeTracker.formatChangeForDisplay(change)
        );

        return {
            totalChanges: changeSummary.totalChanges,
            batches: changeSummary.batches,
            byEntityType: byEntityWithLabels,
            byAction: byActionWithLabels,
            lastChange: changeSummary.lastChange ? {
                timestamp: new Date(changeSummary.lastChange.timestamp).toLocaleString('zh-CN'),
                author: changeSummary.lastChange.author,
                summary: this.changeTracker.generateChangeSummary(changeSummary.lastChange)
            } : null,
            recentChanges: recentChanges
        };
    }

    generateFailureAnalysis(failures) {
        if (failures.length === 0) {
            return {
                totalFailures: 0,
                message: '本次实验无失败记录'
            };
        }

        const reasonCounts = {};
        for (const failure of failures) {
            reasonCounts[failure.reason] = (reasonCounts[failure.reason] || 0) + 1;
        }

        return {
            totalFailures: failures.length,
            failureReasons: reasonCounts,
            averageTurnsAtFailure: (failures.reduce((sum, f) => sum + f.turn, 0) / failures.length).toFixed(1),
            failures: failures.map((f, i) => ({
                failureNumber: i + 1,
                reason: f.reason,
                turn: f.turn,
                timestamp: new Date(f.timestamp).toLocaleString('zh-CN'),
                finalScore: f.finalState.score.total,
                actions: f.history.length
            }))
        };
    }

    generatePhysicsConcepts() {
        return [
            {
                concept: '声音的反射',
                description: '声波遇到障碍物时会发生反射，遵循反射定律：入射角等于反射角。',
                application: '在迷宫中，通过分析回声时间可以判断障碍物的距离和位置。'
            },
            {
                concept: '回声测距原理',
                description: '利用公式 s = v × t / 2，其中 v 是声速（约343m/s），t 是回声时间。',
                application: '通过测量回声返回的时间，可以计算出到障碍物的距离。'
            },
            {
                concept: '不同材质的反射特性',
                description: '硬表面（如金属、水泥）反射系数高（约0.95），软表面（如海绵）反射系数低（约0.6），吸声材料反射系数极低（约0.1）。',
                application: '通过回声强度可以判断障碍物的材质类型。'
            },
            {
                concept: '多次反射',
                description: '声波可以在多个表面之间多次反射，每次反射都会损失能量。',
                application: '多次反射的回声可以提供更丰富的环境信息，但需要注意识别直接反射和间接反射。'
            }
        ];
    }

    generateConclusions(gameState, history, errors) {
        const conclusions = [];
        const soundPulses = history.filter(h => h.type === 'sound_pulse');
        const moves = history.filter(h => h.type === 'move');

        conclusions.push(`本次实验共进行了 ${gameState.turn} 回合，其中移动 ${moves.length} 次，发射声波 ${soundPulses.length} 次。`);

        if (gameState.victory) {
            conclusions.push(`实验成功！成功救援了所有被困队友，最终得分 ${gameState.score.total} 分。`);
        } else {
            conclusions.push(`实验结束，失败原因：${gameState.failReason || '未知原因'}。`);
        }

        if (soundPulses.length > 0) {
            const avgEchoes = soundPulses.reduce((sum, p) => sum + (p.result.echoCount || 0), 0) / soundPulses.length;
            conclusions.push(`平均每次声波探测收到 ${avgEchoes.toFixed(1)} 个回声，有效帮助判断了障碍物位置。`);
        }

        if (errors.total > 0) {
            conclusions.push(`实验过程中检测到 ${errors.total} 个错误，其中 ${errors.bySeverity.critical} 个严重错误，${errors.bySeverity.error} 个错误，${errors.bySeverity.warning} 个警告。`);
        }

        const efficiency = gameState.score.efficiency;
        const accuracy = gameState.score.accuracy;
        
        if (efficiency > 200) {
            conclusions.push('移动效率优秀，能够快速向目标前进。');
        } else if (efficiency > 100) {
            conclusions.push('移动效率良好，整体方向正确。');
        } else {
            conclusions.push('移动效率有待提高，可以更直接地向目标前进。');
        }

        if (accuracy > 50) {
            conclusions.push('声波探测准确度良好，能够有效获取回声信息。');
        } else {
            conclusions.push('声波探测准确度可以通过优化发射角度和强度来提高。');
        }

        conclusions.push('建议：在下次实验中，可以尝试减少无效的声波发射，更有策略地选择探测方向，以节省资源并提高效率。');

        return conclusions;
    }

    exportReportAsJSON(report) {
        return JSON.stringify(report, null, 2);
    }

    exportReportAsText(report) {
        let text = '='.repeat(60) + '\n';
        text += '            声波迷宫救援队实验报告\n';
        text += '='.repeat(60) + '\n\n';

        text += `报告编号: ${report.reportId}\n`;
        text += `生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}\n\n`;

        text += '【实验信息】\n';
        text += `- 实验名称: ${report.experimentInfo.title}\n`;
        text += `- 学生姓名: ${report.experimentInfo.studentName}\n`;
        text += `- 班级: ${report.experimentInfo.class || '未填写'}\n`;
        text += `- 实验日期: ${report.experimentInfo.date}\n\n`;

        text += '【实验结果】\n';
        text += `- 最终状态: ${report.gameResult.victory ? '成功 ✓' : '失败 ✗'}\n`;
        text += `- 总回合数: ${report.gameResult.totalTurns}\n`;
        text += `- 最终得分: ${report.gameResult.finalScore.total} 分\n`;
        text += `  · 基础分: ${report.gameResult.finalScore.base}\n`;
        text += `  · 效率分: ${report.gameResult.finalScore.efficiency}\n`;
        text += `  · 准确度分: ${report.gameResult.finalScore.accuracy}\n`;
        text += `  · 救援分: ${report.gameResult.finalScore.rescue}\n`;
        text += `- 救援情况: 已救 ${report.gameResult.teammatesRescued} 人，被困 ${report.gameResult.teammatesTrapped} 人\n`;
        if (report.gameResult.failReason) {
            text += `- 失败原因: ${report.gameResult.failReason}\n`;
        }
        text += '\n';

        text += '【资源消耗】\n';
        text += `- 声波脉冲: 剩余 ${report.gameResult.finalResources.soundPulses} / ${report.experimentSetup.initialResources.soundPulses}\n`;
        text += `- 能量: 剩余 ${report.gameResult.finalResources.energy} / ${report.experimentSetup.initialResources.energy}\n`;
        text += `- 时间: 剩余 ${report.gameResult.finalResources.timeUnits} / ${report.experimentSetup.initialResources.timeUnits}\n\n`;

        if (report.soundAnalysis.totalPulses > 0) {
            text += '【声波分析】\n';
            text += `- 发射声波次数: ${report.soundAnalysis.totalPulses}\n`;
            text += `- 总回声数: ${report.soundAnalysis.totalEchoes}\n`;
            text += `- 总反射次数: ${report.soundAnalysis.totalReflections}\n`;
            text += `- 平均每次回声数: ${report.soundAnalysis.averageEchoesPerPulse}\n`;
            text += `- 平均每次传播距离: ${report.soundAnalysis.averageDistancePerPulse} 单位\n`;
            text += `- 平均每次传播时间: ${report.soundAnalysis.averageTimePerPulse} 秒\n\n`;
        }

        if (report.errorAnalysis.totalErrors > 0) {
            text += '【错误分析】\n';
            text += `- 总错误数: ${report.errorAnalysis.totalErrors}\n`;
            for (const [type, count] of Object.entries(report.errorAnalysis.bySeverity)) {
                if (count > 0) {
                    text += `- ${type}: ${count} 个\n`;
                }
            }
            text += '\n';
        }

        if (report.failureAnalysis.totalFailures > 0) {
            text += '【失败记录】\n';
            text += `- 总失败次数: ${report.failureAnalysis.totalFailures}\n`;
            for (const [reason, count] of Object.entries(report.failureAnalysis.failureReasons)) {
                text += `- ${reason}: ${count} 次\n`;
            }
            text += '\n';
        }

        text += '【实验结论】\n';
        for (const conclusion of report.conclusions) {
            text += `· ${conclusion}\n`;
        }
        text += '\n';

        text += '【相关物理知识】\n';
        for (const concept of report.physicsConcepts) {
            text += `★ ${concept.concept}\n`;
            text += `  ${concept.description}\n`;
            text += `  应用: ${concept.application}\n\n`;
        }

        if (report.teacherNotes) {
            text += '【教师评语】\n';
            text += report.teacherNotes + '\n\n';
        }

        text += '='.repeat(60) + '\n';
        text += '                    报告结束\n';
        text += '='.repeat(60) + '\n';

        return text;
    }

    downloadReport(report, format = 'json', filename = '') {
        let content, mimeType, extension;

        switch (format) {
            case 'text':
                content = this.exportReportAsText(report);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'json':
            default:
                content = this.exportReportAsJSON(report);
                mimeType = 'application/json';
                extension = 'json';
                break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `experiment_report_${Date.now()}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadGameState() {
        const state = this.gameEngine.getFullState();
        const content = JSON.stringify(state, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game_state_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
