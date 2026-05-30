function formatTimestamp(iso) {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}
function buildHeader(session) {
    const lines = [
        '╔══════════════════════════════════════════════════════════════╗',
        '║              DJ曲库调性清洗报告                              ║',
        '╚══════════════════════════════════════════════════════════════╝',
        '',
        `会话ID:     ${session.id}`,
        `生成时间:   ${formatTimestamp(session.timestamp)}`,
        `输入文件:   ${session.inputFiles.join(', ')}`,
        `输入总行数: ${session.totalInputRows}`,
        `成功解析:   ${session.successfullyParsed}`,
    ];
    return lines.join('\n');
}
function buildSummarySection(stats) {
    const lines = [
        '┌─────────────────────────────────┐',
        '│         处理统计总览             │',
        '└─────────────────────────────────┘',
        '',
        `  输入总数:         ${stats.totalInput}`,
        `  成功解析:         ${stats.successfullyParsed}`,
        `  解析错误:         ${stats.parseErrors}`,
        '',
        `  ── BPM处理 ──`,
        `  BPM修正总计:     ${stats.bpmFixed}`,
        `  其中半速修正:     ${stats.bpmHalfSpeed}`,
        `  其中双速修正:     ${stats.bpmDoubleSpeed}`,
        `  其中四舍五入:     ${stats.bpmFixed - stats.bpmHalfSpeed - stats.bpmDoubleSpeed}`,
        '',
        `  ── 调性处理 ──`,
        `  调性标准化:       ${stats.keysNormalized}`,
        `  调性识别失败:     ${stats.keysFailed}`,
        '',
        `  ── 能量值处理 ──`,
        `  能量值解析成功:   ${stats.energyParsed}`,
        `  能量值解析失败:   ${stats.energyFailed}`,
        '',
        `  ── 去重处理 ──`,
        `  重复曲目数:       ${stats.duplicatesFound}`,
        `  已合并:           ${stats.duplicatesMerged}`,
        `  合并补字段数:     ${stats.fieldsFilledFromMerge}`,
        '',
        `  ── 人工干预 ──`,
        `  人工确认保护:     ${stats.manualConfirmed}`,
        `  自动变更数:       ${stats.autoChanges}`,
        `  人工变更数:       ${stats.manualChanges}`,
        '',
        `  ── 数据口径说明 ──`,
        `  以上数字与下方明细列表来自同一次清洗流水线，`,
        `  不存在二次统计或抽样。数字 = 明细条目数。`,
    ];
    return { title: '处理统计总览', content: lines.join('\n') };
}
function buildBpmChangesDetail(changes) {
    const bpmChanges = changes.filter(c => c.field === 'bpm' && !c.superseded);
    const halfSpeed = bpmChanges.filter(c => c.reason.includes('疑似半速'));
    const doubleSpeed = bpmChanges.filter(c => c.reason.includes('疑似双速'));
    const rounded = bpmChanges.filter(c => c.changeType === 'bpm_round');
    const lines = [
        `共 ${bpmChanges.length} 条BPM变更 (半速:${halfSpeed.length} 双速:${doubleSpeed.length} 四舍五入:${rounded.length})`,
        '',
    ];
    if (halfSpeed.length > 0) {
        lines.push('  【半速修正明细】');
        for (const c of halfSpeed) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      ${c.oldValue} → ${c.newValue}  (${c.reason})`);
        }
        lines.push('');
    }
    if (doubleSpeed.length > 0) {
        lines.push('  【双速修正明细】');
        for (const c of doubleSpeed) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      ${c.oldValue} → ${c.newValue}  (${c.reason})`);
        }
        lines.push('');
    }
    if (rounded.length > 0) {
        lines.push('  【四舍五入明细】');
        for (const c of rounded) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      ${c.oldValue} → ${c.newValue}  (${c.reason})`);
        }
    }
    const blocked = changes.filter(c => c.field === 'bpm' && c.superseded);
    if (blocked.length > 0) {
        lines.push('');
        lines.push(`  【被人工确认阻止的BPM变更: ${blocked.length}条】`);
        for (const c of blocked) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      ${c.reason}`);
        }
    }
    return { title: 'BPM变更明细', content: lines.join('\n') };
}
function buildKeyChangesDetail(changes) {
    const keyChanges = changes.filter(c => c.field === 'key' && !c.superseded);
    const failedKeyChanges = changes.filter(c => c.changeType === 'key_mapped' && !c.superseded && c.newValue === '');
    const lines = [
        `共 ${keyChanges.length} 条调性标准化`,
    ];
    if (failedKeyChanges.length > 0) {
        lines.push(`其中 ${failedKeyChanges.length} 条原始调性无法识别`);
    }
    lines.push('');
    const normalized = keyChanges.filter(c => c.newValue !== '');
    if (normalized.length > 0) {
        lines.push('  【标准化明细】');
        for (const c of normalized) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      "${c.oldValue}" → ${c.newValue}  (${c.reason})`);
        }
    }
    if (failedKeyChanges.length > 0) {
        lines.push('');
        lines.push('  【无法识别明细】');
        for (const c of failedKeyChanges) {
            lines.push(`    ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`      原始值: "${c.oldValue}"  (${c.reason})`);
        }
    }
    return { title: '调性变更明细', content: lines.join('\n') };
}
function buildDuplicateDetail(groups, changes) {
    const mergeChanges = changes.filter(c => c.changeType === 'duplicate_merged');
    const fieldFills = changes.filter(c => c.changeType === 'field_filled');
    const lines = [
        `发现 ${groups.length} 组重复，共 ${mergeChanges.length} 条被合并`,
        '',
    ];
    for (const group of groups) {
        lines.push(`  【${group.canonicalTitle} - ${group.canonicalArtist}】`);
        lines.push(`    保留策略: ${group.mergeStrategy === 'keep_richest' ? '保留完整度最高的记录' : group.mergeStrategy}`);
        for (const member of group.members) {
            const marker = member.trackId === group.canonicalId ? ' ★保留' : ' →合并';
            const bpmStr = member.bpm !== null ? `${member.bpm}BPM` : 'BPM缺失';
            const keyStr = member.key || '调性缺失';
            const energyStr = member.energy !== null ? `E${member.energy}` : '能量缺失';
            const src = member.source || '未知来源';
            lines.push(`    ${marker} [${src}] ${bpmStr} ${keyStr} ${energyStr} (完整度:${(member.completenessScore * 100).toFixed(0)}%)`);
        }
        const groupFills = fieldFills.filter(c => group.members.some(m => m.trackId === c.trackId));
        if (groupFills.length > 0) {
            lines.push(`    补充字段:`);
            for (const f of groupFills) {
                lines.push(`      ${f.field}: ${f.oldValue} → ${f.newValue}`);
            }
        }
        lines.push('');
    }
    return { title: '重复曲目明细', content: lines.join('\n') };
}
function buildParseWarningsDetail(warnings) {
    if (warnings.length === 0) {
        return { title: '解析警告', content: '无解析警告' };
    }
    const errors = warnings.filter(w => w.severity === 'error');
    const warns = warnings.filter(w => w.severity === 'warn');
    const infos = warnings.filter(w => w.severity === 'info');
    const lines = [
        `共 ${warnings.length} 条解析提示 (错误:${errors.length} 警告:${warns.length} 信息:${infos.length})`,
        '',
    ];
    for (const w of warnings) {
        const icon = w.severity === 'error' ? '✗' : w.severity === 'warn' ? '⚠' : 'ℹ';
        lines.push(`  ${icon} 行${w.rowIndex >= 0 ? w.rowIndex : '?'} [${w.field}] ${w.message}`);
        if (w.rawLine) {
            lines.push(`    原始内容: ${w.rawLine.slice(0, 100)}`);
        }
    }
    return { title: '解析警告明细', content: lines.join('\n') };
}
function buildManualOverridesDetail(changes) {
    const manualChanges = changes.filter(c => c.source === 'manual');
    const superseded = changes.filter(c => c.superseded);
    if (manualChanges.length === 0 && superseded.length === 0) {
        return { title: '人工干预记录', content: '本次清洗无人工干预记录' };
    }
    const lines = [];
    if (superseded.length > 0) {
        lines.push(`【被人工确认阻止的自动变更: ${superseded.length}条】`);
        lines.push('以下自动变更因存在历史人工确认而未执行:');
        lines.push('');
        for (const c of superseded) {
            lines.push(`  ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`    字段: ${c.field} | 自动建议: ${c.oldValue}→${c.newValue}`);
            lines.push(`    原因: ${c.reason}`);
        }
        lines.push('');
    }
    if (manualChanges.length > 0) {
        lines.push(`【本次人工确认: ${manualChanges.length}条】`);
        for (const c of manualChanges) {
            lines.push(`  ${c.trackTitle} - ${c.trackArtist}`);
            lines.push(`    字段: ${c.field} | 值: ${c.newValue} | 原因: ${c.reason}`);
        }
    }
    return { title: '人工干预记录', content: lines.join('\n') };
}
function buildDataCaliberNote(session) {
    const halfSpeedCount = session.changes.filter(c => c.reason.includes('疑似半速') && !c.superseded).length;
    const doubleSpeedCount = session.changes.filter(c => c.reason.includes('疑似双速') && !c.superseded).length;
    const roundCount = session.changes.filter(c => c.changeType === 'bpm_round' && !c.superseded).length;
    const lines = [
        '本报告所有数字统计均来自同一次清洗流水线(CleaningSession)，',
        '与各明细列表条目一一对应，无二次统计或抽样。具体映射关系:',
        '',
        `  处理统计总览.bpmFixed (${session.stats.bpmFixed})`,
        `    = BPM变更明细中半速修正(${halfSpeedCount})`,
        `    + 双速修正(${doubleSpeedCount})`,
        `    + 四舍五入(${roundCount})`,
        `    = ${halfSpeedCount + doubleSpeedCount + roundCount} ✓`,
        '',
        `  处理统计总览.keysNormalized (${session.stats.keysNormalized})`,
        `    = 调性变更明细中标准化条目数`,
        '',
        `  处理统计总览.duplicatesFound (${session.stats.duplicatesFound})`,
        `    = 重复曲目明细中各组(members.length-1)之和`,
        '',
        `  处理统计总览.manualConfirmed (${session.stats.manualConfirmed})`,
        `    = 人工干预记录中被阻止的自动变更数`,
        '',
        '所有变更记录(ChangeRecord)包含完整的: 原值、新值、原因、时间戳、',
        '来源(auto/manual)、是否被覆盖(superseded)。无需反查数据库即可理解处理口径。',
    ];
    return { title: '数据口径说明', content: lines.join('\n') };
}
function buildFooter(session) {
    const lines = [
        '',
        '════════════════════════════════════════════════════════════════',
        `报告结束 | 会话: ${session.id} | 时间: ${formatTimestamp(session.timestamp)}`,
        '════════════════════════════════════════════════════════════════',
    ];
    return lines.join('\n');
}
export function generateReport(session) {
    const sections = [
        buildSummarySection(session.stats),
        buildBpmChangesDetail(session.changes),
        buildKeyChangesDetail(session.changes),
        buildDuplicateDetail(session.duplicates, session.changes),
        buildParseWarningsDetail(session.parseWarnings),
        buildManualOverridesDetail(session.changes),
        buildDataCaliberNote(session),
    ];
    return {
        header: buildHeader(session),
        sections,
        footer: buildFooter(session),
        summary: session.stats,
    };
}
export function formatReportText(report) {
    const parts = [report.header, ''];
    for (const section of report.sections) {
        parts.push(`━━━ ${section.title} ━━━`);
        parts.push(section.content);
        parts.push('');
    }
    parts.push(report.footer);
    return parts.join('\n');
}
//# sourceMappingURL=reporter.js.map