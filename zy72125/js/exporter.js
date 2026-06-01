const Exporter = {
  exportAsJSON(records, filterDesc) {
    const data = DataManager.exportData(records);
    data.filterDescription = filterDesc || '全部记录';

    const jsonStr = JSON.stringify(data, null, 2);
    this.downloadFile(jsonStr, '巡演舞台输入表_' + this.getDateStr() + '.json', 'application/json');
  },

  exportAsCSV(records, filterDesc) {
    const headers = [
      '序号', '核对状态', '问题标记', '演出日期', '城市', '场地',
      '曲目名称', '输入类型', '通道号', '文件名', '文件格式',
      '时长', '来源类型', '来源详情', '备注', '版本号',
      '最后修改人', '最后修改时间'
    ];

    const rows = records.map((r, i) => [
      i + 1,
      r.status,
      (r.issues || []).map(i => i.type).join(';') || '',
      r.performanceDate || '',
      r.city || '',
      r.venue || '',
      r.songName || '',
      r.inputType || '',
      r.channelNumber || '',
      r.fileName || '',
      r.fileFormat || '',
      r.duration || '',
      r.sourceType || '',
      r.sourceDetail || '',
      r.remark || '',
      r.version || 1,
      r.updatedBy || '',
      this.formatDateTime(r.updatedAt)
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(cell => this.csvEscape(cell)).join(','))
      .join('\n');

    this.downloadFile(csvContent, '巡演舞台输入表_' + this.getDateStr() + '.csv', 'text/csv;charset=utf-8');
  },

  exportAsTextReport(records, filterDesc) {
    const now = new Date();
    const lines = [];

    lines.push('═══════════════════════════════════════════════════');
    lines.push('  巡演舞台输入表核对报告');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    lines.push(`  导出时间：${this.formatDateTime(now.toISOString())}`);
    lines.push(`  导出人：${DataManager.currentUser}`);
    lines.push(`  筛选条件：${filterDesc || '全部记录'}`);
    lines.push(`  记录总数：${records.length} 条`);
    lines.push('');

    const { results, stats } = this.getValidationStats(records);

    lines.push('───────────────────────────────────────────────────');
    lines.push('  核对统计');
    lines.push('───────────────────────────────────────────────────');
    lines.push(`  核对通过：${stats.ok} 条`);
    lines.push(`  有疑问：${stats.warning} 条`);
    lines.push(`  缺材料/空值：${stats.empty} 条`);
    lines.push(`  重复项：${stats.duplicate} 条`);
    lines.push(`  边界异常：${stats.boundary} 条`);
    lines.push('');

    if (results.some(r => r.issues.some(i => i.type === '空值'))) {
      lines.push('───────────────────────────────────────────────────');
      lines.push('  缺失材料明细');
      lines.push('───────────────────────────────────────────────────');
      const emptyResults = results.filter(r => r.issues.some(i => i.type === '空值'));
      for (const r of emptyResults) {
        const rec = records.find(rec => rec.id === r.recordId);
        if (!rec) continue;
        const emptyFields = r.issues.filter(i => i.type === '空值').map(i => i.fieldLabel);
        lines.push(`  [${rec.performanceDate || '日期缺失'}] ${rec.city || '城市缺失'} - ${rec.songName || '曲目缺失'}`);
        lines.push(`    缺少：${emptyFields.join('、')}`);
        lines.push(`    来源：${rec.sourceType || '未标注'} ${rec.sourceDetail || ''}`);
        lines.push('');
      }
    }

    if (results.some(r => r.issues.some(i => i.type === '重复'))) {
      lines.push('───────────────────────────────────────────────────');
      lines.push('  重复记录明细');
      lines.push('───────────────────────────────────────────────────');
      const dupResults = results.filter(r => r.issues.some(i => i.type === '重复'));
      for (const r of dupResults) {
        const rec = records.find(rec => rec.id === r.recordId);
        if (!rec) continue;
        const dupIssues = r.issues.filter(i => i.type === '重复');
        lines.push(`  [${rec.performanceDate || '日期缺失'}] ${rec.city || '城市缺失'} - ${rec.songName || '曲目缺失'}`);
        for (const issue of dupIssues) {
          lines.push(`    ${issue.message}`);
        }
        lines.push('');
      }
    }

    if (results.some(r => r.issues.some(i => i.type === '边界'))) {
      lines.push('───────────────────────────────────────────────────');
      lines.push('  需要人工确认的项目');
      lines.push('───────────────────────────────────────────────────');
      const boundaryResults = results.filter(r => r.issues.some(i => i.type === '边界'));
      for (const r of boundaryResults) {
        const rec = records.find(rec => rec.id === r.recordId);
        if (!rec) continue;
        const boundaryIssues = r.issues.filter(i => i.type === '边界');
        lines.push(`  [${rec.performanceDate || '日期缺失'}] ${rec.city || '城市缺失'} - ${rec.songName || '曲目缺失'}`);
        for (const issue of boundaryIssues) {
          lines.push(`    ${issue.message}`);
        }
        if (r.suggestions) {
          for (const s of r.suggestions) {
            if (s.type === 'warning' || s.type === 'info') {
              const cleanAction = s.action.replace(/<[^>]*>/g, '');
              lines.push(`    建议：${cleanAction}`);
            }
          }
        }
        lines.push('');
      }
    }

    lines.push('───────────────────────────────────────────────────');
    lines.push('  完整记录清单');
    lines.push('───────────────────────────────────────────────────');
    lines.push('');

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const validationResult = results.find(vr => vr.recordId === r.id);
      const issueTypes = validationResult
        ? [...new Set(validationResult.issues.map(i => i.type))].join('、')
        : '';

      lines.push(`  #${i + 1}  ${r.songName || '(曲目未填)'}`);
      lines.push(`  日期：${r.performanceDate || '未填'}  城市：${r.city || '未填'}  场地：${r.venue || '未填'}`);
      lines.push(`  输入类型：${r.inputType || '未填'}  通道：${r.channelNumber || '未填'}`);
      lines.push(`  文件：${r.fileName || '未填'}  格式：${r.fileFormat || '未填'}  时长：${r.duration || '未填'}`);
      lines.push(`  来源：${r.sourceType || '未标注'} ${r.sourceDetail ? '- ' + r.sourceDetail : ''}`);
      lines.push(`  备注：${r.remark || '无'}`);
      lines.push(`  状态：${r.status}${issueTypes ? '  问题：' + issueTypes : ''}`);
      lines.push(`  版本：v${r.version}  最后修改：${r.updatedBy} ${this.formatDateTime(r.updatedAt)}`);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');
    lines.push('  本报告由"巡演舞台输入表核对"工具自动生成');
    lines.push('  如有疑问请联系录音师老许核实');
    lines.push('═══════════════════════════════════════════════════');

    const textContent = lines.join('\n');
    this.downloadFile(textContent, '巡演舞台输入表核对报告_' + this.getDateStr() + '.txt', 'text/plain;charset=utf-8');
  },

  getValidationStats(records) {
    const allRecords = DataManager.getAllRecords();
    const results = [];
    const stats = {
      total: records.length,
      ok: 0,
      warning: 0,
      error: 0,
      duplicate: 0,
      empty: 0,
      boundary: 0
    };

    for (const record of records) {
      const { issues, suggestions } = Validator.validateRecord(record, allRecords);

      const hasError = issues.some(i => i.severity === 'error');
      const hasWarning = issues.some(i => i.severity === 'warning');
      const hasDuplicate = issues.some(i => i.type === '重复');
      const hasEmpty = issues.some(i => i.type === '空值');
      const hasBoundary = issues.some(i => i.type === '边界');

      if (issues.length === 0) stats.ok++;
      if (hasError) stats.error++;
      if (hasWarning) stats.warning++;
      if (hasDuplicate) stats.duplicate++;
      if (hasEmpty) stats.empty++;
      if (hasBoundary) stats.boundary++;

      results.push({
        recordId: record.id,
        issues,
        suggestions,
        hasError,
        hasWarning
      });
    }

    return { results, stats };
  },

  csvEscape(value) {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
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

  getDateStr() {
    const now = new Date();
    return now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');
  },

  formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
};
