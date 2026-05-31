export class ExplanationGenerator {
    static formatJudgment(result) {
        const judgmentLabels = {
            auto_confirmed: '✅ 自动确认通过',
            needs_review: '⚠️ 需要人工审核',
            cross_period_fee: '⏳ 存在跨期手续费',
            duplicate: '🔁 重复流水（已跳过）',
        };
        const lines = [];
        lines.push(`═══════════════════════════════════════`);
        lines.push(`【收款流水判断结果】`);
        lines.push(`流水编号：${result.receiptId}`);
        lines.push(`判断结果：${judgmentLabels[result.judgment]}`);
        lines.push(`判断时间：${result.decidedAt}`);
        lines.push(`批次编号：${result.batchRunId}`);
        lines.push(`───────────────────────────────────────`);
        lines.push(`【判断理由】`);
        for (const r of result.reasons) {
            lines.push(`  • [${r.code}] ${r.message}`);
            lines.push(`    详细说明：${r.detail}`);
            lines.push(`    信息来源：${r.source === 'receipt_line' ? '收款流水' : r.source === 'rate_table' ? '费率表' : '规则引擎'}`);
        }
        lines.push(`───────────────────────────────────────`);
        lines.push(`【下一步操作】`);
        for (let i = 0; i < result.nextSteps.length; i++) {
            lines.push(`  ${i + 1}. ${result.nextSteps[i]}`);
        }
        lines.push(`═══════════════════════════════════════`);
        return lines.join('\n');
    }
    static formatCrossPeriodAlert(alert) {
        const sourceLabels = {
            receipt_line: '收款流水（feeAmount 字段）',
            rate_table: '平台费率表',
        };
        const lines = [];
        lines.push(`╔═══════════════════════════════════════╗`);
        lines.push(`║  ⚠️  跨期手续费提醒                    ║`);
        lines.push(`╚═══════════════════════════════════════╝`);
        lines.push(`流水编号：${alert.receiptId}`);
        lines.push(`手续费金额：${alert.feeAmount} ${alert.currency}`);
        lines.push(`手续费归属期间：${alert.feePeriod}`);
        lines.push(`收款发生期间：${alert.receiptPeriod}`);
        lines.push(`───────────────────────────────────────`);
        lines.push(`【手续费来源】${sourceLabels[alert.feeSource]}`);
        lines.push(`  ${alert.sourceDetail}`);
        lines.push(`───────────────────────────────────────`);
        lines.push(`【情况说明】`);
        lines.push(`  ${alert.explanation}`);
        lines.push(`───────────────────────────────────────`);
        lines.push(`【下一步操作】`);
        lines.push(`  ${alert.nextAction}`);
        lines.push(`【联系人】${alert.contactPerson}`);
        return lines.join('\n');
    }
    static formatHistoryEntries(entries) {
        if (entries.length === 0) {
            return '暂无处理历史记录。';
        }
        const lines = [];
        lines.push(`【处理历史】共 ${entries.length} 条记录`);
        lines.push(`───────────────────────────────────────`);
        for (const entry of entries) {
            const status = entry.skipped ? '⏭️ 跳过' : '✅ 已处理';
            lines.push(`  批次：${entry.batchRunId} | ${status} | ${entry.processedAt}`);
            lines.push(`  判断结果：${entry.judgment}`);
            if (entry.skipReason) {
                lines.push(`  跳过原因：${entry.skipReason}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    static formatReconciliation(stmt) {
        const lines = [];
        lines.push(`╔═══════════════════════════════════════╗`);
        lines.push(`║  对账说明                              ║`);
        lines.push(`╚═══════════════════════════════════════╝`);
        lines.push(`流水编号：${stmt.receiptId}`);
        lines.push(`对账期间：${stmt.period}`);
        lines.push(`收款总额：${stmt.totalReceived}`);
        lines.push(`手续费：${stmt.totalFees}`);
        lines.push(`退款总额：${stmt.totalRefunds}`);
        lines.push(`净额：${stmt.netAmount}`);
        lines.push(`───────────────────────────────────────`);
        if (stmt.changeRecords.length > 0) {
            lines.push(`【退款变更记录】共 ${stmt.changeRecords.length} 条`);
            for (const c of stmt.changeRecords) {
                lines.push(`  • ${c.changedAt} | 操作人：${c.changedBy}`);
                lines.push(`    将「${c.field}」从 ${JSON.stringify(c.oldValue)} 改为 ${JSON.stringify(c.newValue)}`);
                lines.push(`    原因：${c.reason}`);
                if (c.reconciliationNote) {
                    lines.push(`    对账备注：${c.reconciliationNote}`);
                }
            }
        }
        else {
            lines.push(`【退款变更记录】无手动变更`);
        }
        lines.push(`───────────────────────────────────────`);
        lines.push(`【变更说明】`);
        lines.push(`  ${stmt.notes}`);
        return lines.join('\n');
    }
    static formatRefundChanges(changes) {
        if (changes.length === 0) {
            return '该退款项无变更记录。';
        }
        const lines = [];
        lines.push(`【退款变更明细】共 ${changes.length} 条`);
        lines.push(`───────────────────────────────────────`);
        for (const c of changes) {
            lines.push(`  变更编号：${c.id}`);
            lines.push(`  操作人：${c.changedBy} | 操作时间：${c.changedAt}`);
            lines.push(`  变更字段：${c.field}`);
            lines.push(`  变更前：${JSON.stringify(c.oldValue)}`);
            lines.push(`  变更后：${JSON.stringify(c.newValue)}`);
            lines.push(`  原因：${c.reason}`);
            lines.push('');
        }
        return lines.join('\n');
    }
}
//# sourceMappingURL=explanation-generator.js.map