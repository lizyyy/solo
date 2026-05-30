const ExportModule = {
    currentHistory: [],

    init() {
        this.refreshExportList();
    },

    refreshExportList() {
        this.currentHistory = JSON.parse(localStorage.getItem(GAME_CONFIG.STORAGE_KEYS.history) || '[]');
        
        const container = document.getElementById('exportList');
        
        if (this.currentHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <p>暂无可导出的游戏记录</p>
                    <p style="font-size: 12px; margin-top: 8px;">完成一局游戏后，可以在此处导出批次报告</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.currentHistory.map((game, index) => {
            const date = new Date(game.startTime);
            const filename = this.generateFilename(game);
            const successRate = Math.round(game.escapedCount / game.totalRounds * 100);
            
            return `
                <div class="export-item">
                    <div class="export-info">
                        <div class="export-filename">${filename}</div>
                        <div class="export-meta">
                            <span>批次: ${game.batchId}</span>
                            <span style="margin: 0 12px;">|</span>
                            <span>${formatDisplayTime(date)}</span>
                            <span style="margin: 0 12px;">|</span>
                            <span>⭐ ${game.score} 分</span>
                            <span style="margin: 0 12px;">|</span>
                            <span>🎯 ${game.escapedCount}/${game.totalRounds} (${successRate}%)</span>
                        </div>
                    </div>
                    <div class="export-actions">
                        <button class="btn btn-secondary" data-action="preview" data-index="${index}">👁️ 预览</button>
                        <button class="btn btn-primary" data-action="export" data-index="${index}">📥 导出JSON</button>
                        <button class="btn btn-secondary" data-action="exportCSV" data-index="${index}">📊 导出CSV</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                const game = this.currentHistory[index];

                if (action === 'export') {
                    this.exportGameReport(game);
                } else if (action === 'preview') {
                    this.previewReport(game);
                } else if (action === 'exportCSV') {
                    this.exportGameCSV(game);
                }
            });
        });
    },

    generateFilename(game) {
        const date = new Date(game.startTime);
        const timestamp = formatTimestamp(date);
        return `escape_report_${game.batchId}_${timestamp}.json`;
    },

    generateCSVFilename(game) {
        const date = new Date(game.startTime);
        const timestamp = formatTimestamp(date);
        return `escape_report_${game.batchId}_${timestamp}.csv`;
    },

    buildReport(game) {
        const date = new Date(game.startTime);
        const endDate = new Date(game.endTime);
        
        const roundsSummary = game.rounds.map((round, idx) => {
            const body = round.body;
            const fuels = round.selectedFuels || [];
            
            let escapeVel = '--';
            let actualVel = '--';
            let velocityDiff = '--';
            let errorType = '--';
            
            if (round.escapeResult) {
                escapeVel = round.escapeResult.escapeVelocityKms?.toFixed(4) || '--';
            }
            if (round.velocityResult) {
                actualVel = round.velocityResult.totalVelocityKms?.toFixed(4) || '--';
            }
            if (round.checkResult) {
                velocityDiff = round.checkResult.velocityDiffKms?.toFixed(4) || '--';
                errorType = round.checkResult.errorType || '--';
            }

            return {
                roundNumber: round.roundNumber,
                bodyId: body?.id || '--',
                bodyName: body?.name || '--',
                bodyType: body?.type || '--',
                bodyMass: body?.mass || '--',
                bodyRadius: body?.radius || '--',
                escapeVelocity: escapeVel,
                fuelIds: fuels.map(f => f.id).join('; ') || '--',
                fuelNames: fuels.map(f => f.name).join('; ') || '--',
                fuelTotalBoost: round.velocityResult?.fuelBoostKms?.toFixed(4) || '0',
                direction: round.direction || '--',
                actualVelocity: actualVel,
                velocityDiff: velocityDiff,
                success: round.success ? '是' : '否',
                abandoned: round.abandoned ? '是' : '否',
                errorType: errorType,
                scoreGained: round.scoreGained || 0,
                decisionReason: round.decisionReason || '--',
                timestamp: formatDisplayTime(new Date(round.timestamp))
            };
        });

        const report = {
            schemaVersion: '1.0',
            reportType: 'black_hole_escape_game_report',
            generatedAt: new Date().toISOString(),
            
            batchInfo: {
                batchId: game.batchId,
                gameId: game.gameId,
                startTime: date.toISOString(),
                endTime: endDate.toISOString(),
                durationMs: game.duration,
                durationSeconds: Math.round(game.duration / 1000),
                source: game.traceData?.registry?.[game.shipId]?.source || 'unknown'
            },
            
            summary: {
                totalRounds: game.totalRounds,
                completedRounds: game.completedRounds,
                escapedCount: game.escapedCount,
                failedCount: game.totalRounds - game.escapedCount,
                successRate: Math.round(game.escapedCount / game.totalRounds * 100),
                totalScore: game.score,
                fuelsUsed: game.usedFuelIds?.length || 0,
                fuelsTotal: game.rounds?.[0]?.escapeResult?.body ? game.rounds.filter(r => r.success).reduce((sum, r) => sum + (r.selectedFuels?.length || 0), 0) : 0
            },
            
            ship: {
                id: game.ship?.id,
                name: game.ship?.name,
                baseVelocity: game.ship?.baseVelocity,
                description: game.ship?.description
            },
            
            calculationRules: {
                formula: 'v = √(2GM/r)',
                gravitationalConstant: GAME_CONFIG.G,
                units: {
                    mass: 'kg (自动转换)',
                    radius: 'm (自动转换)',
                    velocity: 'km/s (显示用)'
                },
                scoringRules: {
                    baseEscape: GAME_CONFIG.SCORE.baseEscape,
                    massMultiplier: GAME_CONFIG.SCORE.massMultiplier,
                    perfectEscapeBonus: GAME_CONFIG.SCORE.perfectEscapeBonus,
                    fuelEfficiencyBonus: GAME_CONFIG.SCORE.fuelEfficiencyBonus
                }
            },
            
            rounds: roundsSummary,
            
            errorAnalysis: this.analyzeErrors(game),
            
            traceData: game.traceData || null
        };

        return report;
    },

    analyzeErrors(game) {
        const errors = {
            total: 0,
            byType: {},
            details: []
        };

        for (const round of game.rounds) {
            if (round.checkResult?.errorType) {
                errors.total++;
                const type = round.checkResult.errorType;
                
                if (!errors.byType[type]) {
                    errors.byType[type] = 0;
                }
                errors.byType[type]++;

                const errorDesc = SampleData.getErrorCaseDescription(type);
                errors.details.push({
                    round: round.roundNumber,
                    body: round.body?.name,
                    errorType: type,
                    errorDescription: errorDesc?.title || type,
                    reason: round.checkResult.reason,
                    decisionReason: round.decisionReason
                });
            }
        }

        return errors;
    },

    exportGameReport(game) {
        const report = this.buildReport(game);
        const filename = this.generateFilename(game);
        const content = JSON.stringify(report, null, 2);

        this.downloadFile(content, filename, 'application/json');
        showToast(`报告已导出: ${filename}`, 'success');
    },

    exportGameCSV(game) {
        const report = this.buildReport(game);
        
        const headers = [
            '回合',
            '天体ID',
            '天体名称',
            '天体类型',
            '质量',
            '半径',
            '逃逸速度(km/s)',
            '使用燃料',
            '燃料总增量(km/s)',
            '方向',
            '实际速度(km/s)',
            '速度差(km/s)',
            '是否成功',
            '是否放弃',
            '错误类型',
            '获得分数',
            '决策原因',
            '时间'
        ];

        const rows = report.rounds.map(round => [
            round.roundNumber,
            round.bodyId,
            round.bodyName,
            round.bodyType,
            round.bodyMass,
            round.bodyRadius,
            round.escapeVelocity,
            round.fuelNames,
            round.fuelTotalBoost,
            round.direction === 'away' ? '远离天体' : '朝向天体',
            round.actualVelocity,
            round.velocityDiff,
            round.success,
            round.abandoned,
            round.errorType,
            round.scoreGained,
            `"${round.decisionReason.replace(/"/g, '""')}"`,
            round.timestamp
        ]);

        const summaryRow = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        const summaryRow2 = [
            '汇总',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            `${report.summary.escapedCount}/${report.summary.totalRounds}`,
            '',
            `${report.errorAnalysis.total}个错误`,
            report.summary.totalScore,
            '',
            ''
        ];

        const batchInfoRows = [
            ['批次信息'],
            ['批次号', report.batchInfo.batchId],
            ['游戏ID', report.batchInfo.gameId],
            ['开始时间', report.batchInfo.startTime],
            ['结束时间', report.batchInfo.endTime],
            ['用时(秒)', report.batchInfo.durationSeconds],
            ['飞船', report.ship.name],
            ['总分数', report.summary.totalScore],
            ['成功率', `${report.summary.successRate}%`],
            []
        ];

        const csvContent = [
            ...batchInfoRows.map(r => r.join(',')),
            headers.join(','),
            ...rows.map(r => r.join(',')),
            summaryRow.join(','),
            summaryRow2.join(',')
        ].join('\n');

        const filename = this.generateCSVFilename(game);
        const bom = '\uFEFF';
        this.downloadFile(bom + csvContent, filename, 'text/csv;charset=utf-8');
        showToast(`CSV已导出: ${filename}`, 'success');
    },

    previewReport(game) {
        const report = this.buildReport(game);
        
        let errorsHtml = '';
        if (report.errorAnalysis.total > 0) {
            errorsHtml = `
                <div class="trace-section">
                    <h4>⚠️ 错误分析</h4>
                    ${Object.entries(report.errorAnalysis.byType).map(([type, count]) => {
                        const desc = SampleData.getErrorCaseDescription(type);
                        return `
                            <div class="trace-item">
                                <span class="trace-label">${desc?.title || type}</span>
                                <span class="trace-value">${count} 次</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const previewHtml = `
            <div style="font-family: monospace; font-size: 12px; max-height: 500px; overflow-y: auto;">
                <div class="trace-section">
                    <h4>📄 报告预览 - ${this.generateFilename(game)}</h4>
                    <div class="trace-item">
                        <span class="trace-label">批次号</span>
                        <span class="trace-value">${report.batchInfo.batchId}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">游戏ID</span>
                        <span class="trace-value">${report.batchInfo.gameId}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">时间</span>
                        <span class="trace-value">${report.batchInfo.startTime}</span>
                    </div>
                </div>
                
                <div class="trace-section">
                    <h4>📊 游戏汇总</h4>
                    <div class="trace-item">
                        <span class="trace-label">总回合</span>
                        <span class="trace-value">${report.summary.totalRounds}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">成功逃逸</span>
                        <span class="trace-value">${report.summary.escapedCount}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">成功率</span>
                        <span class="trace-value">${report.summary.successRate}%</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">总分数</span>
                        <span class="trace-value">${report.summary.totalScore}</span>
                    </div>
                </div>

                ${errorsHtml}

                <div class="trace-section">
                    <h4>🔬 计算规则</h4>
                    <div class="trace-item">
                        <span class="trace-label">公式</span>
                        <span class="trace-value">${report.calculationRules.formula}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">引力常数G</span>
                        <span class="trace-value">${report.calculationRules.gravitationalConstant}</span>
                    </div>
                </div>

                <div class="trace-section">
                    <h4>🎮 回合详情</h4>
                    ${report.rounds.map(round => `
                        <div style="padding: 10px; margin: 8px 0; background: var(--bg-card); border-radius: 8px; border-left: 3px solid ${round.success ? 'var(--accent-success)' : 'var(--accent-danger)'};">
                            <strong>第${round.roundNumber}回合: ${round.bodyName}</strong><br>
                            逃逸速度: ${round.escapeVelocity} km/s | 实际: ${round.actualVelocity} km/s | 差: ${round.velocityDiff} km/s<br>
                            结果: ${round.success ? '✅ 成功' : '❌ 失败'}${round.abandoned ? ' (已放弃)' : ''}
                            ${round.errorType !== '--' ? `<br>错误: ${round.errorType}` : ''}
                            ${round.scoreGained > 0 ? `<br>得分: +${round.scoreGained}` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const modal = document.getElementById('traceModal');
        const body = document.getElementById('traceModalBody');
        body.innerHTML = previewHtml;
        modal.classList.add('active');
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    exportAllReports() {
        if (this.currentHistory.length === 0) {
            showToast('暂无可导出的记录', 'warning');
            return;
        }

        const allReports = this.currentHistory.map(game => this.buildReport(game));
        const filename = `escape_reports_all_${formatTimestamp()}.json`;
        const content = JSON.stringify(allReports, null, 2);
        
        this.downloadFile(content, filename, 'application/json');
        showToast(`已导出 ${allReports.length} 份报告`, 'success');
    }
};
