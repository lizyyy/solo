const ReportGenerator = {
    generateReport(game) {
        const summary = game.getGameSummary();
        const errors = game.getErrors();
        const logs = game.getSettlementLog();
        const policies = summary.policies;
        const roundHistory = summary.roundHistory;

        const isVictory = summary.finalState === GameState.VICTORY;
        const isGameOver = summary.finalState === GameState.GAME_OVER;

        let statusText = '进行中';
        let statusClass = 'warning';
        if (isVictory) {
            statusText = '🎉 胜利';
            statusClass = 'success';
        } else if (isGameOver) {
            statusText = '💔 失败';
            statusClass = 'danger';
        }

        const html = `
            <div class="report-section">
                <h3>📊 游戏概览</h3>
                <div class="report-summary">
                    <div class="summary-card ${statusClass}">
                        <div class="label">游戏状态</div>
                        <div class="value">${statusText}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">完成回合</div>
                        <div class="value">${summary.currentRound} / ${summary.totalRounds}</div>
                    </div>
                    <div class="summary-card success">
                        <div class="label">结案赔案</div>
                        <div class="value">${summary.totalClaimsProcessed}</div>
                    </div>
                    <div class="summary-card danger">
                        <div class="label">逃脱赔案</div>
                        <div class="value">${summary.totalClaimsEscaped} / ${GameData.maxEscaped}</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>💰 财务概况</h3>
                <div class="report-summary">
                    <div class="summary-card success">
                        <div class="label">保费收入</div>
                        <div class="value">${this._formatMoney(summary.totalPremiumIncome)}</div>
                    </div>
                    <div class="summary-card danger">
                        <div class="label">赔付支出</div>
                        <div class="value">${this._formatMoney(summary.totalPayout)}</div>
                    </div>
                    <div class="summary-card ${summary.reserve.netChange >= 0 ? 'success' : 'danger'}">
                        <div class="label">准备金变动</div>
                        <div class="value">${this._formatMoney(summary.reserve.netChange)}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">当前准备金</div>
                        <div class="value">${this._formatMoney(summary.reserve.currentBalance)}</div>
                    </div>
                </div>
                <table class="report-table" style="margin-top: 12px;">
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>金额</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>初始准备金</td>
                            <td>${this._formatMoney(summary.reserve.initialBalance)}</td>
                            <td>游戏开始时的准备金余额</td>
                        </tr>
                        <tr>
                            <td>累计收入</td>
                            <td class="success">${this._formatMoney(summary.reserve.totalIncome)}</td>
                            <td>所有保单保费收入合计</td>
                        </tr>
                        <tr>
                            <td>累计赔付</td>
                            <td class="danger">${this._formatMoney(summary.reserve.totalPayout)}</td>
                            <td>所有赔案赔付支出合计</td>
                        </tr>
                        <tr>
                            <td>准备金透支次数</td>
                            <td>${summary.reserve.overdraftCount}</td>
                            <td>准备金不足导致赔付失败的次数</td>
                        </tr>
                        <tr>
                            <td>最大透支金额</td>
                            <td>${this._formatMoney(summary.reserve.maxOverdraft)}</td>
                            <td>单次赔付最大的资金缺口</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="report-section">
                <h3>📋 保单使用情况</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>保单编号</th>
                            <th>保单名称</th>
                            <th>险种</th>
                            <th>赔付次数</th>
                            <th>累计赔付</th>
                            <th>免赔合计</th>
                            <th>剩余额度</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${policies.map(p => `
                            <tr>
                                <td>${p.id}</td>
                                <td>${p.name}</td>
                                <td>${p.type}</td>
                                <td>${p.claimCount}</td>
                                <td class="danger">${this._formatMoney(p.totalPayout)}</td>
                                <td>${this._formatMoney(p.deductibleApplied)}</td>
                                <td class="${p.remainingLimit > 0 ? 'success' : 'danger'}">${this._formatMoney(p.remainingLimit)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="report-section">
                <h3>⚠️ 错误与问题统计</h3>
                <div class="report-summary">
                    <div class="summary-card danger">
                        <div class="label">错误总数</div>
                        <div class="value">${summary.errors.totalErrors}</div>
                    </div>
                    <div class="summary-card warning">
                        <div class="label">警告总数</div>
                        <div class="value">${summary.errors.totalWarnings}</div>
                    </div>
                </div>
                ${Object.keys(summary.errors.byType).length > 0 ? `
                    <h4 style="margin-top: 12px; color: #e94560; font-size: 13px;">错误类型分布</h4>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>错误类型</th>
                                <th>发生次数</th>
                                <th>说明</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(summary.errors.byType).map(([type, count]) => `
                                <tr>
                                    <td>${this._getErrorTypeName(type)}</td>
                                    <td class="danger">${count}</td>
                                    <td>${this._getErrorTypeDescription(type)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </div>

            ${errors.length > 0 ? `
                <div class="report-section">
                    <h3>❌ 错误详情</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>错误ID</th>
                                <th>回合</th>
                                <th>错误类型</th>
                                <th>发生步骤</th>
                                <th>描述</th>
                                <th>建议修复</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${errors.map(e => `
                                <tr>
                                    <td>${e.id}</td>
                                    <td>第${e.round}回合</td>
                                    <td class="risk-${this._getRiskLevelForError(e.type)}">${this._getErrorTypeName(e.type)}</td>
                                    <td>${e.step}</td>
                                    <td>${e.userMessage}</td>
                                    <td style="font-size: 11px;">${e.fix}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            ${roundHistory.length > 0 ? `
                <div class="report-section">
                    <h3>📅 回合历史</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>回合</th>
                                <th>结案</th>
                                <th>逃脱</th>
                                <th>本回合错误</th>
                                <th>结束时准备金</th>
                                <th>持续时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${roundHistory.map(r => `
                                <tr>
                                    <td>第${r.round}回合</td>
                                    <td class="success">${r.killed}</td>
                                    <td class="danger">${r.escaped}</td>
                                    <td>${r.errors.length}</td>
                                    <td>${this._formatMoney(r.reserve.currentBalance)}</td>
                                    <td>${((r.endTime - r.startTime) / 1000).toFixed(1)}秒</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <div class="report-section">
                <h3>🎯 培训要点总结</h3>
                <div style="background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 8px; line-height: 1.8;">
                    ${this._generateTrainingPoints(summary, errors)}
                </div>
            </div>
        `;

        const jsonData = {
            generatedAt: new Date().toISOString(),
            gameSummary: summary,
            errors: errors,
            policies: policies,
            roundHistory: roundHistory,
            settlementLogs: logs.slice(-100)
        };

        return {
            html: html,
            json: JSON.stringify(jsonData, null, 2),
            summary: summary,
            generatedAt: new Date().toLocaleString('zh-CN')
        };
    },

    exportReport(report) {
        const content = this._generateExportContent(report);
        const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `保险精算怪物塔-复盘报告-${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        try {
            const jsonBlob = new Blob([report.json], { type: 'application/json;charset=utf-8' });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonA = document.createElement('a');
            jsonA.href = jsonUrl;
            jsonA.download = `保险精算怪物塔-复盘数据-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(jsonA);
            jsonA.click();
            document.body.removeChild(jsonA);
            URL.revokeObjectURL(jsonUrl);
        } catch (e) {
            console.warn('JSON导出失败:', e);
        }
    },

    _generateExportContent(report) {
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>保险精算怪物塔 - 复盘报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; background: #1a202c; color: #e4e4e4; padding: 20px; line-height: 1.6; }
        h1 { color: #e94560; text-align: center; border-bottom: 2px solid #e94560; padding-bottom: 12px; }
        h2 { color: #e94560; margin-top: 24px; padding-bottom: 6px; border-bottom: 1px solid #2d3748; }
        h3 { color: #f39c12; margin-top: 20px; font-size: 16px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .summary-card { background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 8px; text-align: center; }
        .summary-card .label { font-size: 12px; color: #888; }
        .summary-card .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
        .success .value { color: #4caf50; }
        .warning .value { color: #ffc107; }
        .danger .value { color: #e94560; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #2d3748; }
        th { background: rgba(0, 0, 0, 0.3); color: #e94560; font-weight: 600; }
        tr:hover { background: rgba(255, 255, 255, 0.05); }
        .risk-1 { color: #81c784; }
        .risk-2 { color: #ffd54f; }
        .risk-3 { color: #ffb74d; }
        .risk-4 { color: #ff8a65; }
        .risk-5 { color: #e57373; }
        .training-points { background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 8px; margin-top: 16px; }
        .training-points ul { margin: 12px 0; padding-left: 20px; }
        .training-points li { margin: 8px 0; }
        .footer { text-align: center; color: #666; margin-top: 30px; padding-top: 16px; border-top: 1px solid #2d3748; font-size: 12px; }
        .money { font-family: 'Courier New', monospace; }
    </style>
</head>
<body>
    <h1>🏰 保险精算怪物塔 - 复盘报告</h1>
    <div style="text-align: center; color: #888; margin-bottom: 20px;">
        报告生成时间：${report.generatedAt}
    </div>
    ${report.html}
    <div class="footer">
        <p>本报告由保险精算怪物塔系统自动生成</p>
        <p>培训用途 · 风险分层模拟训练</p>
    </div>
</body>
</html>`;
    },

    _generateTrainingPoints(summary, errors) {
        const points = [];

        if (summary.finalState === GameState.VICTORY) {
            points.push('✅ <strong>恭喜完成培训！</strong>你成功抵御了所有回合的赔案攻击，展示了良好的风险分层能力。');
        } else if (summary.finalState === GameState.GAME_OVER) {
            points.push('❌ <strong>游戏结束</strong>，请根据以下要点改进你的风险防御策略：');
        }

        const deductibleErrors = errors.filter(e => e.type === 'DEDUCTIBLE_DUPLICATE').length;
        if (deductibleErrors > 0) {
            points.push(`⚠️ <strong>免赔额重复扣除问题（${deductibleErrors}次）</strong>：保险理赔原则是同一赔案在同一保单项下只能扣除一次免赔额。在放置保单时要注意赔案的流向，避免同一赔案经过多张相同类型的保单。`);
        }

        const reserveErrors = errors.filter(e => e.type === 'RESERVE_OVERDRAFT' || e.type === 'RESERVE_EMPTY').length;
        if (reserveErrors > 0) {
            points.push(`💰 <strong>准备金管理问题（${reserveErrors}次）</strong>：准备金是赔付的基础，要合理规划保费收入和赔付支出的节奏。建议：<ul><li>优先放置低保费高免赔的保单在前，快速积累准备金</li><li>高保额高风险的保单放在后面，应对大额赔案</li><li>密切关注准备金余额，及时调整策略</li></ul>`);
        }

        const riskErrors = errors.filter(e => e.type === 'RISK_LEVEL_MISMATCH').length;
        if (riskErrors > 0) {
            points.push(`🎯 <strong>风险层级错配问题（${riskErrors}次）</strong>：每张保单都有特定的承保风险等级范围。要根据每回合的风险等级分布，合理放置对应保障范围的保单。`);
        }

        const usageErrors = errors.filter(e => e.type === 'USAGE_EXCEEDED').length;
        if (usageErrors > 0) {
            points.push(`📊 <strong>赔付次数超限问题（${usageErrors}次）</strong>：部分保单有赔付次数限制，要注意保单的使用频率，合理安排不同保单的位置。`);
        }

        const limitErrors = errors.filter(e => e.type === 'LIMIT_EXCEEDED').length;
        if (limitErrors > 0) {
            points.push(`📈 <strong>保障额度用尽问题（${limitErrors}次）</strong>：每张保单的保障额度是有限的，对于高风险高金额的赔案，需要准备多张保单或更高保额的保单。`);
        }

        if (summary.totalClaimsEscaped > 0) {
            points.push(`🚨 <strong>赔案逃脱（${summary.totalClaimsEscaped}件）</strong>：共有${summary.totalClaimsEscaped}件赔案成功逃脱。分析逃脱赔案的风险等级和金额，调整保单放置策略。`);
        }

        if (summary.reserve.overdraftCount > 0) {
            points.push(`💸 <strong>准备金透支（${summary.reserve.overdraftCount}次）</strong>：最大透支金额${this._formatMoney(summary.reserve.maxOverdraft)}。建议增加前期保费收入，或调整保单放置顺序以延迟大额赔付。`);
        }

        if (points.length === 0) {
            points.push('💡 <strong>完美表现！</strong>本次游戏没有出现任何操作错误，继续保持！');
            points.push('📚 进阶建议：尝试用更少的保单完成挑战，或优化准备金使用效率。');
        } else {
            points.push('🎓 <strong>下一步学习建议</strong>：<ul><li>复习保险产品的承保范围和赔付规则</li><li>练习准备金规划和现金流管理</li><li>分析每回合的风险分布，提前做好保单布局</li></ul>');
        }

        return points.map(p => `<p>${p}</p>`).join('');
    },

    _getErrorTypeName(type) {
        const names = {
            'DEDUCTIBLE_DUPLICATE': '免赔额重复扣除',
            'RESERVE_OVERDRAFT': '准备金透支',
            'RESERVE_EMPTY': '准备金耗尽',
            'RISK_LEVEL_MISMATCH': '风险层级错配',
            'USAGE_EXCEEDED': '赔付次数超限',
            'LIMIT_EXCEEDED': '保障额度用尽'
        };
        return names[type] || type;
    },

    _getErrorTypeDescription(type) {
        const descriptions = {
            'DEDUCTIBLE_DUPLICATE': '同一赔案在同一保单项下被多次扣除免赔额',
            'RESERVE_OVERDRAFT': '准备金不足以支付当前赔案，只能部分赔付',
            'RESERVE_EMPTY': '准备金已归零，无法支付任何赔付',
            'RISK_LEVEL_MISMATCH': '保单承保范围不包含当前赔案的风险等级',
            'USAGE_EXCEEDED': '保单赔付次数已用完',
            'LIMIT_EXCEEDED': '保单保障额度已用尽'
        };
        return descriptions[type] || '';
    },

    _getRiskLevelForError(type) {
        const levels = {
            'DEDUCTIBLE_DUPLICATE': 2,
            'RESERVE_OVERDRAFT': 4,
            'RESERVE_EMPTY': 5,
            'RISK_LEVEL_MISMATCH': 3,
            'USAGE_EXCEEDED': 2,
            'LIMIT_EXCEEDED': 3
        };
        return levels[type] || 3;
    },

    _formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }
};
