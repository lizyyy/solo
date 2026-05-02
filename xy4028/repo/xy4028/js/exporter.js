/**
 * 结果导出功能模块
 * 支持导出 JSON 和 CSV 格式
 */

class Exporter {
  exportToJSON(record) {
    const data = JSON.stringify(record, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.download(blob, `cpr-training-${record.id}.json`);
  }

  exportToCSV(record) {
    const headers = [
      '时间', '总按压次数', '有效按压', '准确率%', '平均BPM',
      '稳定度%', '最长连续合格', '过快次数', '过慢次数',
      '漏拍次数', '连击误触', '完美次数', '综合评分',
      '目标BPM低', '目标BPM高', '容忍误差(ms)'
    ];

    const row = [
      new Date(record.timestamp).toLocaleString('zh-CN'),
      record.score.totalPresses,
      record.score.validPresses,
      record.score.accuracy,
      record.score.averageBPM,
      record.score.stability,
      record.score.longestStreak,
      record.score.tooFastCount,
      record.score.tooSlowCount,
      record.score.missedCount,
      record.score.doubleTapCount,
      record.score.perfectCount,
      record.score.overallScore,
      record.config.targetBPMLow,
      record.config.targetBPMHigh,
      record.config.errorToleranceMs
    ];

    const csvContent = [
      headers.join(','),
      row.join(','),
      '',
      '建议练习点:',
      ...record.score.suggestions
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    this.download(blob, `cpr-training-${record.id}.csv`);
  }

  exportHistoryToJSON(history) {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.download(blob, `cpr-history-${Date.now()}.json`);
  }

  exportHistoryToCSV(history) {
    const headers = [
      'ID', '时间', '总按压次数', '有效按压', '准确率%', '平均BPM',
      '稳定度%', '最长连续合格', '过快次数', '过慢次数',
      '漏拍次数', '连击误触', '完美次数', '综合评分',
      '目标BPM低', '目标BPM高', '容忍误差(ms)'
    ];

    const rows = history.map(record => [
      record.id,
      new Date(record.timestamp).toLocaleString('zh-CN'),
      record.score.totalPresses,
      record.score.validPresses,
      record.score.accuracy,
      record.score.averageBPM,
      record.score.stability,
      record.score.longestStreak,
      record.score.tooFastCount,
      record.score.tooSlowCount,
      record.score.missedCount,
      record.score.doubleTapCount,
      record.score.perfectCount,
      record.score.overallScore,
      record.config.targetBPMLow,
      record.config.targetBPMHigh,
      record.config.errorToleranceMs
    ].map(v => `"${v}"`).join(','));

    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    this.download(blob, `cpr-history-${Date.now()}.csv`);
  }

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new Exporter();
