var UI = (function() {
  var selectedRecordId = null;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

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

  function statusText(s) {
    return { pending: '待审核', reviewed: '已审核', anomaly: '有异常' }[s] || s;
  }

  function changeTypeText(t) {
    return { supplement: '补充材料', conclusion_change: '影响结论' }[t] || t;
  }

  function categoryText(c) {
    return {
      weather: '气象数据', pilot_note: '飞手备注', battery: '电池信息',
      photo: '巡检照片', result: '识别结果', conclusion: '巡检结论'
    }[c] || c;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  function showToast(message, type) {
    type = type || 'success';
    var container = $('#toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  function renderRecordList() {
    var records = Store.getFilteredRecords();
    var listEl = $('#record-list');

    if (records.length === 0) {
      listEl.innerHTML = '<div class="empty-state">无匹配的巡检记录</div>';
      $('#record-count').textContent = '0 条记录';
      return;
    }

    $('#record-count').textContent = records.length + ' 条记录';

    var html = '';
    records.forEach(function(r) {
      var changes = Store.getChangeLog(r.id);
      var hasSupplement = changes.some(function(c) { return c.changeType === 'supplement'; });
      var hasConclusion = changes.some(function(c) { return c.changeType === 'conclusion_change'; });

      var isActive = r.id === selectedRecordId ? ' active' : '';

      html += '<div class="record-card' + isActive + '" data-id="' + r.id + '" role="button" tabindex="0" aria-label="' + escapeHtml(r.flightId) + ' ' + escapeHtml(r.reservoir) + '">';
      html += '<div class="record-card-header">';
      html += '<span class="record-card-title">' + escapeHtml(r.flightId) + '</span>';
      html += '<span class="status-badge status-' + r.status + '">' + statusText(r.status) + '</span>';
      html += '</div>';
      html += '<div class="record-card-meta">';
      html += '<span>' + escapeHtml(r.reservoir) + '</span>';
      html += '<span>' + r.flightDate + '</span>';
      html += '<span>' + escapeHtml(r.pilot) + '</span>';
      html += '</div>';

      if (hasSupplement || hasConclusion) {
        html += '<div class="change-indicators">';
        if (hasSupplement) {
          var suppCount = changes.filter(function(c) { return c.changeType === 'supplement'; }).length;
          html += '<span class="change-tag tag-supplement">补充材料 ' + suppCount + '</span>';
        }
        if (hasConclusion) {
          var ccCount = changes.filter(function(c) { return c.changeType === 'conclusion_change'; }).length;
          html += '<span class="change-tag tag-conclusion">影响结论 ' + ccCount + '</span>';
        }
        html += '</div>';
      }

      html += '</div>';
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.record-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        selectRecord(id);
      });
    });
  }

  function selectRecord(id) {
    selectedRecordId = id;
    Store.selectRecord(id);
    renderRecordList();
    renderDetail(id);
  }

  function renderDetail(recordId) {
    var record = Store.getRecord(recordId);
    if (!record) {
      $('#detail-panel').innerHTML = '<div class="empty-state">记录不存在</div>';
      return;
    }

    var changes = Store.getChangeLog(recordId);
    var anomalies = Store.getAnomalies(recordId);

    var html = '';

    html += '<div class="detail-section">';
    html += '<h3>基本信息</h3>';
    html += '<dl class="detail-grid">';
    html += '<dt>架次号</dt><dd>' + escapeHtml(record.flightId) + '</dd>';
    html += '<dt>巡检日期</dt><dd>' + record.flightDate + '</dd>';
    html += '<dt>水库</dt><dd>' + escapeHtml(record.reservoir) + '</dd>';
    html += '<dt>飞手</dt><dd>' + escapeHtml(record.pilot) + '</dd>';
    html += '<dt>巡检员</dt><dd>' + escapeHtml(record.inspector) + '</dd>';
    html += '<dt>安全员</dt><dd>' + escapeHtml(record.safetyOfficer) + '</dd>';
    html += '<dt>状态</dt><dd><span class="status-badge status-' + record.status + '">' + statusText(record.status) + '</span></dd>';
    html += '</dl>';
    html += '</div>';

    html += '<div class="detail-section">';
    html += '<h3>电池信息</h3>';
    html += '<dl class="detail-grid">';
    html += '<dt>电池ID</dt><dd>' + escapeHtml(record.batteryId) + '</dd>';
    html += '<dt>申报循环</dt><dd>' + record.batteryCycles + '次</dd>';
    html += '<dt>实际循环</dt><dd>' + (record.batteryCyclesActual !== null ? record.batteryCyclesActual + '次' : '未校验') + '</dd>';

    if (record.batteryCyclesActual !== null && record.batteryCyclesActual !== record.batteryCycles) {
      var diff = Math.abs(record.batteryCyclesActual - record.batteryCycles);
      html += '<dt>循环差异</dt><dd style="color:' + (diff > 10 ? '#dc2626' : '#d97706') + ';font-weight:600;">' + diff + '次' + (diff > 10 ? '（超出阈值）' : '（阈值内）') + '</dd>';
    }
    html += '</dl>';
    html += '</div>';

    if (record.weatherData) {
      html += '<div class="detail-section">';
      html += '<h3>气象信息</h3>';
      html += '<dl class="detail-grid">';
      html += '<dt>风速</dt><dd>' + escapeHtml(record.weatherData.windSpeed) + '</dd>';
      html += '<dt>能见度</dt><dd>' + escapeHtml(record.weatherData.visibility) + '</dd>';
      html += '<dt>温度</dt><dd>' + escapeHtml(record.weatherData.temperature) + '</dd>';
      html += '<dt>数据来源</dt><dd>' + escapeHtml(record.weatherData.source) + '</dd>';
      html += '<dt>采集时间</dt><dd>' + formatDateTime(record.weatherData.timestamp) + '</dd>';
      html += '</dl>';
      html += '</div>';
    } else {
      html += '<div class="detail-section">';
      html += '<h3>气象信息</h3>';
      html += '<p style="color:#d97706;font-size:13px;">未提供（待补充）</p>';
      html += '<button class="btn btn-sm btn-secondary" onclick="UI.supplementWeather(\'' + record.id + '\')">补充气象数据</button>';
      html += '</div>';
    }

    html += '<div class="detail-section">';
    html += '<h3>飞手备注</h3>';
    if (record.pilotNotes) {
      html += '<p style="font-size:13px;line-height:1.6;">' + escapeHtml(record.pilotNotes) + '</p>';
    } else {
      html += '<p style="color:#d97706;font-size:13px;">未填写（待补充）</p>';
      html += '<button class="btn btn-sm btn-secondary" onclick="UI.supplementPilotNote(\'' + record.id + '\')">补充飞手备注</button>';
    }
    html += '</div>';

    if (anomalies.length > 0) {
      html += '<div class="detail-section">';
      html += '<h3 style="color:#dc2626;">异常说明</h3>';
      anomalies.forEach(function(a) {
        html += '<div class="anomaly-card">';
        html += '<div class="anomaly-title">' + escapeHtml(a.description) + '</div>';
        html += '<div class="anomaly-explain">' + escapeHtml(a.explanation) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (record.debrisResults.length > 0) {
      html += '<div class="detail-section">';
      html += '<h3>漂浮物识别结果</h3>';
      html += '<table class="debris-table"><thead><tr><th>类型</th><th>置信度</th><th>位置</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      record.debrisResults.forEach(function(d) {
        html += '<tr>';
        html += '<td>' + escapeHtml(d.type) + '</td>';
        html += '<td>' + (d.confidence * 100).toFixed(0) + '%</td>';
        html += '<td>' + escapeHtml(d.location) + '</td>';
        html += '<td class="' + (d.confirmed ? 'debris-confirmed' : 'debris-unconfirmed') + '">' + (d.confirmed ? '已确认' : '待确认') + '</td>';
        html += '<td>';
        if (!d.confirmed) {
          html += '<button class="btn btn-sm btn-secondary" onclick="UI.confirmDebris(\'' + record.id + '\',\'' + d.id + '\')">确认</button>';
        }
        html += '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    }

    if (record.photos.length > 0) {
      html += '<div class="detail-section">';
      html += '<h3>巡检照片</h3>';
      html += '<div class="photo-grid">';
      record.photos.forEach(function(p) {
        html += '<div class="photo-thumb' + (p.modified ? ' photo-modified' : '') + '">';
        html += escapeHtml(p.filename);
        html += '<br><span style="font-size:10px;">' + formatDateTime(p.timestamp) + '</span>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (changes.length > 0) {
      html += '<div class="detail-section">';
      html += '<h3>变更记录（状态回看）</h3>';
      html += '<div class="change-timeline">';
      changes.forEach(function(c) {
        var typeClass = c.changeType === 'supplement' ? 'type-supplement' : 'type-conclusion_change';
        var labelClass = c.changeType === 'supplement' ? 'label-supplement' : 'label-conclusion';

        html += '<div class="change-entry ' + typeClass + '">';
        html += '<div class="change-entry-header">';
        html += '<span class="change-type-label ' + labelClass + '">' + changeTypeText(c.changeType) + '</span>';
        html += '<span class="change-time">' + categoryText(c.category) + ' | ' + formatDateTime(c.timestamp) + '</span>';
        html += '</div>';
        html += '<div class="change-desc">' + escapeHtml(c.description) + '</div>';

        if (c.beforeValue !== null && c.beforeValue !== undefined) {
          html += '<div class="change-diff">';
          html += '<span class="before">' + escapeHtml(String(c.beforeValue)) + '</span>';
          html += ' → ';
          html += '<span class="after">' + escapeHtml(String(c.afterValue)) + '</span>';
          html += '</div>';
        }

        html += '<div class="change-explain">' + escapeHtml(c.explanation) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (record.conclusion) {
      var hasCC = changes.some(function(c) { return c.conclusionAffected; });
      var conclusionClass = record.status === 'anomaly' ? 'conclusion-anomaly' : (hasCC ? 'conclusion-changed' : 'conclusion-normal');
      html += '<div class="detail-section">';
      html += '<h3>巡检结论</h3>';
      html += '<div class="conclusion-box ' + conclusionClass + '">' + escapeHtml(record.conclusion) + '</div>';
      html += '</div>';
    }

    html += '<div class="detail-section" style="text-align:right;">';
    html += '<button class="btn btn-secondary" onclick="UI.simulateBatchUpdate(\'' + record.id + '\')">模拟批量更新</button> ';
    html += '</div>';

    $('#detail-panel').innerHTML = html;
  }

  function supplementWeather(recordId) {
    var record = Store.getRecord(recordId);
    if (!record) return;

    var weatherInput = {
      windSpeed: '3.5m/s',
      visibility: '7km',
      temperature: '20°C',
      source: '事后补充',
      timestamp: new Date().toISOString()
    };

    Store.updateRecord(recordId, {
      weatherData: weatherInput,
      _operator: '飞手-事后补充'
    });

    showToast('气象数据已补充（归类为补充材料，不影响结论）', 'success');
    renderRecordList();
    renderDetail(recordId);
  }

  function supplementPilotNote(recordId) {
    var record = Store.getRecord(recordId);
    if (!record) return;

    Store.updateRecord(recordId, {
      pilotNotes: '事后补充：巡检区域水面正常，未发现新增漂浮物。',
      _operator: '飞手-事后补充'
    });

    showToast('飞手备注已补充（归类为补充材料，不影响结论）', 'success');
    renderRecordList();
    renderDetail(recordId);
  }

  function confirmDebris(recordId, debrisId) {
    Store.updateRecord(recordId, {
      debrisResults: [{ id: debrisId, confirmed: true }],
      _operator: '巡检员'
    });

    showToast('漂浮物结果已确认', 'success');
    renderRecordList();
    renderDetail(recordId);
  }

  function simulateBatchUpdate(recordId) {
    var record = Store.getRecord(recordId);
    if (!record) return;

    Store.updateRecord(recordId, {
      batteryCyclesActual: record.batteryCycles + 15,
      _operator: '批量校验'
    });

    showToast('批量更新：电池循环数已更正（差异超阈值，归类为影响结论）', 'warning');
    renderRecordList();
    renderDetail(recordId);
  }

  function runBatchProcess() {
    var records = Store.getFilteredRecords();
    if (records.length === 0) {
      showToast('当前筛选条件下无记录可处理', 'warning');
      return;
    }

    var progressEl = document.createElement('div');
    progressEl.className = 'batch-progress';
    progressEl.innerHTML = '<h4>批量处理中...</h4><div class="batch-progress-bar"><div class="batch-progress-fill" style="width:0%"></div></div><div class="batch-progress-text">0 / ' + records.length + '</div>';
    document.body.appendChild(progressEl);

    var items = records.map(function(r) {
      return {
        flightId: r.flightId,
        pilot: r.pilot,
        inspector: r.inspector,
        safetyOfficer: r.safetyOfficer,
        reservoir: r.reservoir,
        batteryId: r.batteryId,
        batteryCycles: r.batteryCycles,
        flightDate: r.flightDate,
        _operator: '批量处理'
      };
    });

    var total = items.length;
    var processed = 0;

    function processNext() {
      if (processed >= total) {
        var result = Store.batchProcess(items);
        progressEl.querySelector('.batch-progress-fill').style.width = '100%';
        progressEl.querySelector('.batch-progress-text').textContent = '完成: 处理 ' + result.processed + ' 条, 跳过 ' + result.skipped + ' 条';

        if (result.errors.length > 0) {
          showToast('批量处理完成，' + result.errors.length + ' 条出错', 'error');
        } else {
          showToast('批量处理完成，幂等校验通过，无重复记录', 'success');
        }

        renderRecordList();
        if (selectedRecordId) {
          renderDetail(selectedRecordId);
        }

        setTimeout(function() {
          if (progressEl.parentNode) progressEl.parentNode.removeChild(progressEl);
        }, 3000);
        return;
      }

      processed++;
      var pct = Math.round((processed / total) * 100);
      progressEl.querySelector('.batch-progress-fill').style.width = pct + '%';
      progressEl.querySelector('.batch-progress-text').textContent = processed + ' / ' + total;

      setTimeout(processNext, 50);
    }

    processNext();
  }

  function handleExport() {
    var format = 'html';
    if (format === 'html') {
      var snapshot = Exporter.exportHTML();
      showToast('飞行复盘已导出（HTML），包含 ' + snapshot.recordCount + ' 条记录，与当前屏幕一致', 'success');
    }
  }

  function handleExportCSV() {
    var snapshot = Exporter.exportCSV();
    showToast('飞行复盘已导出（CSV），包含 ' + snapshot.recordCount + ' 条记录', 'success');
  }

  function populateReservoirFilter() {
    var reservoirs = Store.getReservoirs();
    var select = $('#filter-reservoir');
    var current = select.value;

    while (select.options.length > 1) {
      select.remove(1);
    }

    reservoirs.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      select.appendChild(opt);
    });

    select.value = current || 'all';
  }

  function syncFiltersFromStore() {
    var f = Store.getState().filters;
    $('#filter-status').value = f.status;
    $('#filter-change-type').value = f.changeType;
    $('#filter-reservoir').value = f.reservoir;
    $('#filter-date-from').value = f.dateFrom;
    $('#filter-date-to').value = f.dateTo;
    $('#filter-keyword').value = f.keyword;
  }

  function init() {
    syncFiltersFromStore();
    populateReservoirFilter();
    selectedRecordId = Store.getState().selectedRecordId;
    renderRecordList();

    if (selectedRecordId) {
      var rec = Store.getRecord(selectedRecordId);
      if (rec) {
        renderDetail(selectedRecordId);
      }
    }

    $('#filter-status').addEventListener('change', function() {
      Store.setFilter('status', this.value);
      renderRecordList();
    });

    $('#filter-change-type').addEventListener('change', function() {
      Store.setFilter('changeType', this.value);
      renderRecordList();
    });

    $('#filter-reservoir').addEventListener('change', function() {
      Store.setFilter('reservoir', this.value);
      renderRecordList();
    });

    $('#filter-date-from').addEventListener('change', function() {
      Store.setFilter('dateFrom', this.value);
      renderRecordList();
    });

    $('#filter-date-to').addEventListener('change', function() {
      Store.setFilter('dateTo', this.value);
      renderRecordList();
    });

    var keywordTimer = null;
    $('#filter-keyword').addEventListener('input', function() {
      var val = this.value;
      clearTimeout(keywordTimer);
      keywordTimer = setTimeout(function() {
        Store.setFilter('keyword', val);
        renderRecordList();
      }, 300);
    });

    $('#btn-reset-filters').addEventListener('click', function() {
      Store.resetFilters();
      syncFiltersFromStore();
      renderRecordList();
      showToast('筛选条件已重置', 'success');
    });

    $('#btn-batch-process').addEventListener('click', function() {
      runBatchProcess();
    });

    $('#btn-export').addEventListener('click', function() {
      var menu = document.createElement('div');
      menu.style.cssText = 'position:absolute;top:50px;right:20px;background:#fff;border:1px solid #e0e3e8;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.12);z-index:100;min-width:160px;overflow:hidden;';

      var htmlBtn = document.createElement('button');
      htmlBtn.textContent = '导出 HTML 报告';
      htmlBtn.className = 'btn btn-ghost';
      htmlBtn.style.cssText = 'width:100%;text-align:left;padding:8px 16px;border-radius:0;border:none;';
      htmlBtn.addEventListener('click', function() {
        handleExport();
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      });

      var csvBtn = document.createElement('button');
      csvBtn.textContent = '导出 CSV 数据';
      csvBtn.className = 'btn btn-ghost';
      csvBtn.style.cssText = 'width:100%;text-align:left;padding:8px 16px;border-radius:0;border:none;';
      csvBtn.addEventListener('click', function() {
        handleExportCSV();
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      });

      menu.appendChild(htmlBtn);
      menu.appendChild(csvBtn);
      document.querySelector('.app-header').style.position = 'relative';
      document.querySelector('.app-header').appendChild(menu);

      setTimeout(function() {
        function close(e) {
          if (!menu.contains(e.target)) {
            if (menu.parentNode) menu.parentNode.removeChild(menu);
            document.removeEventListener('click', close);
          }
        }
        document.addEventListener('click', close);
      }, 10);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    supplementWeather: supplementWeather,
    supplementPilotNote: supplementPilotNote,
    confirmDebris: confirmDebris,
    simulateBatchUpdate: simulateBatchUpdate,
    runBatchProcess: runBatchProcess
  };
})();
