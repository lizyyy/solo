var Exporter = (function() {

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
      var d = new Date(isoStr);
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    } catch (e) {
      return isoStr;
    }
  }

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    return isoStr.slice(0, 10);
  }

  function statusText(status) {
    var map = { pending: '待审核', reviewed: '已审核', anomaly: '有异常' };
    return map[status] || status;
  }

  function changeTypeText(type) {
    var map = { supplement: '补充材料', conclusion_change: '影响结论' };
    return map[type] || type;
  }

  function categoryText(cat) {
    var map = {
      weather: '气象数据',
      pilot_note: '飞手备注',
      battery: '电池信息',
      photo: '巡检照片',
      result: '识别结果',
      conclusion: '巡检结论'
    };
    return map[cat] || cat;
  }

  function generateHTML(exportData) {
    var snapshot = exportData.snapshot;
    var records = exportData.records;

    var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<title>水库漂浮物识别 - 飞行复盘报告</title>\n';
    html += '<style>\n';
    html += 'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1a1a2e;background:#f5f6f7;padding:20px;font-size:14px;line-height:1.6;}\n';
    html += '.report-header{background:#fff;border-radius:6px;padding:20px;margin-bottom:20px;border:1px solid #e0e3e8;}\n';
    html += '.report-header h1{font-size:20px;margin-bottom:12px;}\n';
    html += '.snapshot-info{font-size:12px;color:#6b7280;background:#f5f6f7;padding:10px;border-radius:4px;margin-top:12px;}\n';
    html += '.filter-info{margin-top:8px;font-size:12px;color:#6b7280;}\n';
    html += '.filter-info span{background:#e0e3e8;padding:1px 6px;border-radius:3px;margin-right:4px;}\n';
    html += '.record-section{background:#fff;border-radius:6px;padding:16px;margin-bottom:16px;border:1px solid #e0e3e8;page-break-inside:avoid;}\n';
    html += '.record-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e0e3e8;}\n';
    html += '.record-header h2{font-size:16px;}\n';
    html += '.status-badge{padding:2px 10px;border-radius:10px;font-size:12px;font-weight:500;}\n';
    html += '.status-pending{background:#fef3c7;color:#d97706;}\n';
    html += '.status-reviewed{background:#d1fae5;color:#059669;}\n';
    html += '.status-anomaly{background:#fee2e2;color:#dc2626;}\n';
    html += 'table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;}\n';
    html += 'th,td{padding:6px 10px;border:1px solid #e0e3e8;text-align:left;}\n';
    html += 'th{background:#f5f6f7;font-weight:600;color:#6b7280;font-size:12px;}\n';
    html += '.anomaly-box{border-left:3px solid #dc2626;background:#fee2e2;padding:8px 12px;border-radius:0 6px 6px 0;margin:8px 0;font-size:13px;}\n';
    html += '.anomaly-box .title{font-weight:600;color:#dc2626;}\n';
    html += '.anomaly-box .explain{color:#7f1d1d;font-size:12px;}\n';
    html += '.change-entry{padding:6px 10px;border-radius:4px;margin:6px 0;font-size:12px;}\n';
    html += '.change-supplement{background:#e0f2fe;border-left:3px solid #0284c7;}\n';
    html += '.change-conclusion{background:#fff7ed;border-left:3px solid #c2410c;}\n';
    html += '.change-label{font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px;color:#fff;}\n';
    html += '.label-supplement{background:#0284c7;}\n';
    html += '.label-conclusion{background:#c2410c;}\n';
    html += '.conclusion-box{padding:8px 12px;border-radius:4px;margin:8px 0;font-size:13px;line-height:1.6;}\n';
    html += '.conclusion-normal{background:#d1fae5;border-left:3px solid #059669;}\n';
    html += '.conclusion-changed{background:#fff7ed;border-left:3px solid #c2410c;}\n';
    html += '.conclusion-anomaly{background:#fee2e2;border-left:3px solid #dc2626;}\n';
    html += '@media print{body{background:#fff;padding:0;}.record-section{border:1px solid #ccc;}}\n';
    html += '</style>\n</head>\n<body>\n';

    html += '<div class="report-header">\n';
    html += '<h1>水库漂浮物识别 - 飞行复盘报告</h1>\n';
    html += '<div>导出时间: ' + formatDateTime(snapshot.timestamp) + '</div>\n';
    html += '<div>记录数量: ' + snapshot.recordCount + ' 条</div>\n';

    var f = snapshot.filterState;
    var filterDesc = [];
    if (f.status !== 'all') filterDesc.push('状态=' + statusText(f.status));
    if (f.changeType !== 'all') filterDesc.push('变更=' + changeTypeText(f.changeType));
    if (f.reservoir !== 'all') filterDesc.push('水库=' + f.reservoir);
    if (f.dateFrom) filterDesc.push('起始=' + f.dateFrom);
    if (f.dateTo) filterDesc.push('截止=' + f.dateTo);
    if (f.keyword) filterDesc.push('关键词=' + f.keyword);

    if (filterDesc.length > 0) {
      html += '<div class="filter-info">筛选条件: ';
      filterDesc.forEach(function(d) {
        html += '<span>' + escapeHtml(d) + '</span>';
      });
      html += '</div>\n';
    }

    html += '<div class="snapshot-info">此报告基于导出时刻的筛选快照生成，包含 ' + snapshot.recordCount + ' 条记录。报告内容与导出时屏幕显示一致。</div>\n';
    html += '</div>\n';

    records.forEach(function(item) {
      var r = item.record;
      var changes = item.changes;
      var anomalies = item.anomalies;

      html += '<div class="record-section">\n';
      html += '<div class="record-header">\n';
      html += '<h2>' + escapeHtml(r.flightId) + '</h2>\n';
      html += '<span class="status-badge status-' + r.status + '">' + statusText(r.status) + '</span>\n';
      html += '</div>\n';

      html += '<table><tbody>\n';
      html += '<tr><th width="120">巡检日期</th><td>' + formatDate(r.flightDate) + '</td><th width="120">水库</th><td>' + escapeHtml(r.reservoir) + '</td></tr>\n';
      html += '<tr><th>飞手</th><td>' + escapeHtml(r.pilot) + '</td><th>巡检员</th><td>' + escapeHtml(r.inspector) + '</td></tr>\n';
      html += '<tr><th>安全员</th><td>' + escapeHtml(r.safetyOfficer) + '</td><th>电池ID</th><td>' + escapeHtml(r.batteryId) + '</td></tr>\n';
      html += '<tr><th>申报循环</th><td>' + r.batteryCycles + '次</td><th>实际循环</th><td>' + (r.batteryCyclesActual !== null ? r.batteryCyclesActual + '次' : '未校验') + '</td></tr>\n';

      if (r.weatherData) {
        html += '<tr><th>气象信息</th><td colspan="3">风速 ' + escapeHtml(r.weatherData.windSpeed) + ' | 能见度 ' + escapeHtml(r.weatherData.visibility) + ' | 温度 ' + escapeHtml(r.weatherData.temperature) + ' | 来源 ' + escapeHtml(r.weatherData.source) + '</td></tr>\n';
      } else {
        html += '<tr><th>气象信息</th><td colspan="3" style="color:#d97706;">未提供（待补充）</td></tr>\n';
      }

      if (r.pilotNotes) {
        html += '<tr><th>飞手备注</th><td colspan="3">' + escapeHtml(r.pilotNotes) + '</td></tr>\n';
      } else {
        html += '<tr><th>飞手备注</th><td colspan="3" style="color:#d97706;">未填写（待补充）</td></tr>\n';
      }
      html += '</tbody></table>\n';

      if (anomalies.length > 0) {
        html += '<h3 style="font-size:14px;margin:12px 0 8px;color:#dc2626;">异常说明</h3>\n';
        anomalies.forEach(function(a) {
          html += '<div class="anomaly-box">\n';
          html += '<div class="title">' + escapeHtml(a.description) + '</div>\n';
          html += '<div class="explain">' + escapeHtml(a.explanation) + '</div>\n';
          html += '</div>\n';
        });
      }

      if (r.debrisResults.length > 0) {
        html += '<h3 style="font-size:14px;margin:12px 0 8px;">漂浮物识别结果</h3>\n';
        html += '<table><thead><tr><th>类型</th><th>置信度</th><th>位置</th><th>确认状态</th></tr></thead><tbody>\n';
        r.debrisResults.forEach(function(d) {
          html += '<tr><td>' + escapeHtml(d.type) + '</td><td>' + (d.confidence * 100).toFixed(0) + '%</td><td>' + escapeHtml(d.location) + '</td><td>' + (d.confirmed ? '已确认' : '待确认') + '</td></tr>\n';
        });
        html += '</tbody></table>\n';
      }

      if (r.photos.length > 0) {
        html += '<h3 style="font-size:14px;margin:12px 0 8px;">巡检照片</h3>\n';
        html += '<table><thead><tr><th>文件名</th><th>时间</th><th>位置</th><th>状态</th></tr></thead><tbody>\n';
        r.photos.forEach(function(p) {
          html += '<tr><td>' + escapeHtml(p.filename) + '</td><td>' + formatDateTime(p.timestamp) + '</td><td>' + escapeHtml(p.location) + '</td><td>' + (p.modified ? '<span style="color:#c2410c;font-weight:600;">已修改</span>' : '原始') + '</td></tr>\n';
        });
        html += '</tbody></table>\n';
      }

      if (changes.length > 0) {
        html += '<h3 style="font-size:14px;margin:12px 0 8px;">变更记录</h3>\n';
        changes.forEach(function(c) {
          var cssClass = c.changeType === 'supplement' ? 'change-supplement' : 'change-conclusion';
          var labelClass = c.changeType === 'supplement' ? 'label-supplement' : 'label-conclusion';
          html += '<div class="change-entry ' + cssClass + '">\n';
          html += '<span class="change-label ' + labelClass + '">' + changeTypeText(c.changeType) + '</span> ';
          html += '<span style="color:#6b7280;font-size:11px;">' + categoryText(c.category) + ' | ' + formatDateTime(c.timestamp) + '</span><br>\n';
          html += escapeHtml(c.description) + '<br>\n';
          html += '<span style="color:#6b7280;font-size:11px;font-style:italic;">' + escapeHtml(c.explanation) + '</span>\n';
          html += '</div>\n';
        });
      }

      if (r.conclusion) {
        var hasCC = changes.some(function(c) { return c.conclusionAffected; });
        var conclusionClass = r.status === 'anomaly' ? 'conclusion-anomaly' : (hasCC ? 'conclusion-changed' : 'conclusion-normal');
        html += '<h3 style="font-size:14px;margin:12px 0 8px;">巡检结论</h3>\n';
        html += '<div class="conclusion-box ' + conclusionClass + '">' + escapeHtml(r.conclusion) + '</div>\n';
      }

      html += '</div>\n';
    });

    html += '</body>\n</html>';
    return html;
  }

  function generateCSV(exportData) {
    var records = exportData.records;
    var lines = [];

    lines.push('架次号,巡检日期,水库,飞手,巡检员,安全员,电池ID,申报循环,实际循环,状态,气象,飞手备注,漂浮物数量,确认数量,结论,异常项,补充材料项');

    records.forEach(function(item) {
      var r = item.record;
      var anomalies = item.anomalies;
      var supplements = item.changes.filter(function(c) { return c.changeType === 'supplement'; });

      var weatherStr = r.weatherData
        ? '风速' + r.weatherData.windSpeed + ' 能见度' + r.weatherData.visibility + ' 温度' + r.weatherData.temperature
        : '未提供';

      var debrisCount = r.debrisResults.length;
      var confirmedCount = r.debrisResults.filter(function(d) { return d.confirmed; }).length;
      var anomalyStr = anomalies.map(function(a) { return a.description; }).join('; ');
      var supplementStr = supplements.map(function(s) { return s.description; }).join('; ');

      lines.push([
        r.flightId,
        r.flightDate,
        r.reservoir,
        r.pilot,
        r.inspector,
        r.safetyOfficer,
        r.batteryId,
        r.batteryCycles,
        r.batteryCyclesActual !== null ? r.batteryCyclesActual : '',
        statusText(r.status),
        '"' + weatherStr.replace(/"/g, '""') + '"',
        '"' + (r.pilotNotes || '').replace(/"/g, '""') + '"',
        debrisCount,
        confirmedCount,
        '"' + (r.conclusion || '').replace(/"/g, '""') + '"',
        '"' + anomalyStr.replace(/"/g, '""') + '"',
        '"' + supplementStr.replace(/"/g, '""') + '"'
      ].join(','));
    });

    return '\uFEFF' + lines.join('\n');
  }

  function download(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportHTML() {
    var snapshot = Store.captureExportSnapshot();
    var data = Store.getExportData();
    var content = generateHTML(data);
    var filename = '水库漂浮物识别_飞行复盘_' + snapshot.timestamp.slice(0, 10) + '.html';
    download(content, filename, 'text/html;charset=utf-8');
    return snapshot;
  }

  function exportCSV() {
    var snapshot = Store.captureExportSnapshot();
    var data = Store.getExportData();
    var content = generateCSV(data);
    var filename = '水库漂浮物识别_飞行复盘_' + snapshot.timestamp.slice(0, 10) + '.csv';
    download(content, filename, 'text/csv;charset=utf-8');
    return snapshot;
  }

  return {
    exportHTML: exportHTML,
    exportCSV: exportCSV,
    generateHTML: generateHTML,
    generateCSV: generateCSV
  };
})();
