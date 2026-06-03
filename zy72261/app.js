var App = (function () {
  var state = {
    currentStep: 1,
    records: [],
    selectedRecordId: null,
    auditTrail: [],
    conflicts: [],
    currentConflictId: null,
    currentCoordRecordId: null,
  };

  var OPERATOR = '培训教官 老梁';

  function genId() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function now() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
  }

  function addAudit(entry) {
    state.auditTrail.unshift({
      id: genId(),
      time: now(),
      who: entry.who || OPERATOR,
      what: entry.what || '',
      why: entry.why || '',
      impact: entry.impact || '',
      type: entry.type || 'update',
    });
    renderAuditTrail();
  }

  var SAMPLE_DATA = {
    normal: {
      type: 'normal',
      typeName: '顺利记录',
      description: 'A区3排12号看台，坐标体系统一为WGS84，剖面草图与点云日志一致',
      sketch: {
        sectionName: 'A区3排12号看台剖面',
        coordSystem: 'WGS84',
        elevation: '12.5m',
        observerPoint: { lat: 39.9042, lng: 116.4074 },
        targetPoint: { lat: 39.9045, lng: 116.4078 },
        sightlineAngle: '18.3°',
        obstructionHeight: '0.0m',
        importTime: null,
        importedBy: OPERATOR,
      },
      pointCloudLog: {
        logDate: '2026-05-28',
        caliber: 'v2.1（现行口径）',
        isSupplemented: false,
        remark: '抽稀后保留率92%，遮挡视点全部保留，无异常',
        formalData: {
          totalPoints: 124580,
          retainedPoints: 114614,
          retentionRate: '92%',
          coordSystem: 'WGS84',
          elevation: '12.5m',
          obstructionHeight: '0.0m',
        },
      },
      expectedProcessing: '顺利通过：坐标体系统一，草图与日志一致，直接生成现场班组说明',
    },
    mixed_coords: {
      type: 'mixed_coords',
      typeName: '混合坐标记录',
      description: 'B区5排8号看台，经纬度和米制坐标混用，需巡检组复核',
      sketch: {
        sectionName: 'B区5排8号看台剖面',
        coordSystem: '混合（WGS84 + 米制）',
        elevation: '15.8m',
        observerPoint: { lat: 39.9051, lng: 116.4082, x: 500324.5, y: 4418920.3 },
        targetPoint: { x: 500340.7, y: 4418935.1 },
        sightlineAngle: '22.1°',
        obstructionHeight: '1.2m',
        importTime: null,
        importedBy: OPERATOR,
      },
      pointCloudLog: {
        logDate: '2026-05-25',
        caliber: 'v2.1（现行口径）',
        isSupplemented: false,
        remark: '⚠️ 观察点坐标经纬度与米制混录，目标点仅米制坐标。抽稀保留率87%，疑似遮挡高度偏大，待复核',
        formalData: {
          totalPoints: 98340,
          retainedPoints: 85536,
          retentionRate: '87%',
          coordSystem: '混合',
          elevation: '15.8m',
          obstructionHeight: '1.2m',
        },
      },
      expectedProcessing: '标记待巡检组复核：坐标体系不一致，不自动归正常，留待人工确认',
    },
    supplemented: {
      type: 'supplemented',
      typeName: '补录旧口径记录',
      description: 'C区2排6号看台，点云抽稀日志为旧口径补录，与当前草图数据存在矛盾',
      sketch: {
        sectionName: 'C区2排6号看台剖面',
        coordSystem: 'WGS84',
        elevation: '8.3m',
        observerPoint: { lat: 39.9038, lng: 116.4069 },
        targetPoint: { lat: 39.9040, lng: 116.4072 },
        sightlineAngle: '14.7°',
        obstructionHeight: '0.0m',
        importTime: null,
        importedBy: OPERATOR,
      },
      pointCloudLog: {
        logDate: '2026-03-10',
        caliber: 'v1.8（旧口径，已于2026-04-01废止）',
        isSupplemented: true,
        supplementedFrom: '点云抽稀日志旧档补录',
        remark: '🔴 旧口径v1.8数据，遮挡高度0.5m（旧口径阈值标准不同）。按旧口径判定为遮挡，但按现行口径v2.1遮挡高度阈值已调整为0.8m以下不视为遮挡。本条为补录，原现场班组说明可能仍按旧口径生成。',
        formalData: {
          totalPoints: 76230,
          retainedPoints: 64796,
          retentionRate: '85%',
          coordSystem: 'WGS84',
          elevation: '8.3m',
          obstructionHeight: '0.5m（旧口径）',
        },
      },
      expectedProcessing: '触发冲突检测：旧口径遮挡高度0.5m与现行草图0.0m矛盾，由培训教官老梁选择确认或驳回',
    },
  };

  function createRecord(sampleKey) {
    var sample = SAMPLE_DATA[sampleKey];
    var record = {
      id: genId(),
      type: sample.type,
      typeName: sample.typeName,
      description: sample.description,
      expectedProcessing: sample.expectedProcessing,
      sketch: JSON.parse(JSON.stringify(sample.sketch)),
      pointCloudLog: JSON.parse(JSON.stringify(sample.pointCloudLog)),
      fieldNote: null,
      conflicts: [],
      coordFlag: sample.type === 'mixed_coords',
      status: 'draft',
      step1Done: false,
      step2Done: false,
      step3Done: false,
    };
    return record;
  }

  function detectConflicts(record) {
    var conflicts = [];
    var sketch = record.sketch;
    var log = record.pointCloudLog;

    if (log.isSupplemented) {
      var sketchObstruction = parseFloat(sketch.obstructionHeight) || 0;
      var logObstructionStr = log.formalData.obstructionHeight;
      var logObstruction = parseFloat(logObstructionStr) || 0;
      if (sketchObstruction !== logObstruction) {
        conflicts.push({
          id: genId(),
          type: 'obstruction_mismatch',
          title: '遮挡高度不一致',
          description: '楼层剖面草图与点云抽稀日志的遮挡高度数据矛盾',
          sketchValue: '遮挡高度: ' + sketch.obstructionHeight + '（当前草图）',
          logValue: '遮挡高度: ' + logObstructionStr + '（' + log.caliber + '）',
          severity: 'high',
          resolution: null,
          resolvedBy: null,
          resolvedAt: null,
        });
      }
    }

    if (sketch.coordSystem !== log.formalData.coordSystem && sketch.coordSystem !== '混合（WGS84 + 米制）') {
      conflicts.push({
        id: genId(),
        type: 'coord_mismatch',
        title: '坐标体系不一致',
        description: '楼层剖面草图与点云抽稀日志的坐标体系不同',
        sketchValue: '坐标体系: ' + sketch.coordSystem + '（当前草图）',
        logValue: '坐标体系: ' + log.formalData.coordSystem + '（点云日志）',
        severity: 'medium',
        resolution: null,
        resolvedBy: null,
        resolvedAt: null,
      });
    }

    var sketchElev = parseFloat(sketch.elevation) || 0;
    var logElev = parseFloat(log.formalData.elevation) || 0;
    if (Math.abs(sketchElev - logElev) > 0.01) {
      conflicts.push({
        id: genId(),
        type: 'elevation_mismatch',
        title: '标高数据不一致',
        description: '楼层剖面草图与点云抽稀日志的标高数据不同',
        sketchValue: '标高: ' + sketch.elevation + '（当前草图）',
        logValue: '标高: ' + log.formalData.elevation + '（点云日志）',
        severity: 'medium',
        resolution: null,
        resolvedBy: null,
        resolvedAt: null,
      });
    }

    return conflicts;
  }

  function detectCoordMix(record) {
    if (record.type !== 'mixed_coords') return false;
    var sketch = record.sketch;
    var obs = sketch.observerPoint || {};
    var tgt = sketch.targetPoint || {};
    var hasWgs84 = (obs.lat !== undefined && obs.lng !== undefined) || (tgt.lat !== undefined && tgt.lng !== undefined);
    var hasMetric = (obs.x !== undefined && obs.y !== undefined) || (tgt.x !== undefined && tgt.y !== undefined);
    return hasWgs84 && hasMetric;
  }

  function generateFieldNote(record) {
    var sketch = record.sketch;
    var log = record.pointCloudLog;
    var lines = [];
    lines.push('【体育馆看台视线遮挡 · 现场班组说明】');
    lines.push('');
    lines.push('剖面名称: ' + sketch.sectionName);
    lines.push('坐标体系: ' + sketch.coordSystem);
    lines.push('标　　高: ' + sketch.elevation);
    lines.push('视线下倾角: ' + sketch.sightlineAngle);
    lines.push('遮挡高度: ' + sketch.obstructionHeight);
    lines.push('');

    if (record.type === 'mixed_coords') {
      lines.push('⚠️ 特别说明：');
      lines.push('  本剖面观察点坐标为经纬度+米制混录，目标点仅有米制坐标。');
      lines.push('  坐标体系尚未统一归正常，待巡检组复核确认。');
      lines.push('  现场班组请按实际测量为准，暂勿直接引用本说明中的坐标数值。');
      lines.push('');
    }

    if (record.type === 'supplemented' && record.conflicts.length > 0) {
      var resolved = record.conflicts.filter(function (c) { return c.resolution === 'confirmed'; });
      var rejected = record.conflicts.filter(function (c) { return c.resolution === 'rejected'; });
      if (resolved.length > 0) {
        lines.push('🔴 口径差异说明：');
        lines.push('  点云抽稀日志来源: ' + log.supplementedFrom);
        lines.push('  日志口径: ' + log.caliber);
        lines.push('  经培训教官 ' + OPERATOR + ' 确认，以日志数据为准。');
        lines.push('  日志遮挡高度: ' + log.formalData.obstructionHeight);
        lines.push('');
      }
      if (rejected.length > 0) {
        lines.push('🟢 口径差异说明：');
        lines.push('  点云抽稀日志来源: ' + log.supplementedFrom);
        lines.push('  日志口径: ' + log.caliber);
        lines.push('  经培训教官 ' + OPERATOR + ' 驳回日志数据，保留当前草图。');
        lines.push('  草图遮挡高度: ' + sketch.obstructionHeight);
        lines.push('');
      }
    }

    lines.push('点云抽稀日志备注: ' + log.remark);
    lines.push('');
    lines.push('生成时间: ' + now());
    lines.push('审核人员: ' + OPERATOR);
    return lines.join('\n');
  }

  function renderRecordList() {
    var el = document.getElementById('recordList');
    if (state.records.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>暂无记录，请加载样例</p></div>';
      return;
    }
    var html = '';
    state.records.forEach(function (r) {
      var selected = r.id === state.selectedRecordId ? ' selected' : '';
      var typeClass = ' type-' + r.type;
      html += '<div class="record-item' + selected + typeClass + '" onclick="App.selectRecord(\'' + r.id + '\')">';
      html += '<div class="record-title">' + r.typeName + '</div>';
      html += '<div class="record-subtitle">' + r.sketch.sectionName + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderQuickStats() {
    var el = document.getElementById('quickStats');
    var total = state.records.length;
    var normal = state.records.filter(function (r) { return r.type === 'normal'; }).length;
    var mixed = state.records.filter(function (r) { return r.type === 'mixed_coords'; }).length;
    var supp = state.records.filter(function (r) { return r.type === 'supplemented'; }).length;
    var conflicts = state.records.reduce(function (s, r) { return s + r.conflicts.filter(function (c) { return !c.resolution; }).length; }, 0);
    el.innerHTML =
      '<div class="stat-row"><span class="stat-label">总记录</span><span class="stat-value">' + total + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">顺利记录</span><span class="stat-value" style="color:var(--success)">' + normal + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">混合坐标</span><span class="stat-value" style="color:var(--warning)">' + mixed + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">补录旧口径</span><span class="stat-value" style="color:var(--info)">' + supp + '</span></div>' +
      '<div class="stat-row"><span class="stat-label">待处理冲突</span><span class="stat-value" style="color:var(--danger)">' + conflicts + '</span></div>';
  }

  function renderAuditTrail() {
    var el = document.getElementById('auditTrail');
    if (state.auditTrail.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>暂无审计记录</p></div>';
      return;
    }
    var html = '';
    state.auditTrail.slice(0, 50).forEach(function (a) {
      html += '<div class="audit-entry audit-' + a.type + '">';
      html += '<div class="audit-time">' + a.time + '</div>';
      html += '<div class="audit-who">' + a.who + '</div>';
      html += '<div class="audit-what">' + a.what + '</div>';
      if (a.why) html += '<div class="audit-why">原因: ' + a.why + '</div>';
      if (a.impact) html += '<div class="audit-impact">影响: ' + a.impact + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderStepStatus() {
    var records = state.records;
    var s1 = records.every(function (r) { return r.step1Done; }) ? 'done' : (records.some(function (r) { return r.step1Done; }) ? 'pending' : '');
    var s2 = records.every(function (r) { return r.step2Done; }) ? 'done' : (records.some(function (r) { return r.step2Done; }) ? 'pending' : '');
    var s3 = records.every(function (r) { return r.step3Done; }) ? 'done' : (records.some(function (r) { return r.step3Done; }) ? 'pending' : '');

    document.getElementById('step1Status').className = 'step-status ' + (s1 ? 'status-' + s1 : '');
    document.getElementById('step1Status').textContent = s1 === 'done' ? '✓' : s1 === 'pending' ? '…' : '';
    document.getElementById('step2Status').className = 'step-status ' + (s2 ? 'status-' + s2 : '');
    document.getElementById('step2Status').textContent = s2 === 'done' ? '✓' : s2 === 'pending' ? '…' : '';
    document.getElementById('step3Status').className = 'step-status ' + (s3 ? 'status-' + s3 : '');
    document.getElementById('step3Status').textContent = s3 === 'done' ? '✓' : s3 === 'pending' ? '…' : '';
  }

  function renderSketchImport() {
    var el = document.getElementById('sketchImportArea');
    if (state.records.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>点击上方按钮加载样例数据</p></div>';
      return;
    }

    var html = '<div class="processing-result">';
    state.records.forEach(function (r) {
      var typeClass = 'type-' + r.type;
      var stepIcon = r.step1Done ? '✅' : '⬜';
      html += '<div class="result-card ' + typeClass + '">';
      html += '<h5>' + stepIcon + ' ' + r.typeName + ' <span class="result-status ' + (r.step1Done ? 'status-confirmed' : 'status-review') + '">' + (r.step1Done ? '已导入' : '待导入') + '</span></h5>';
      html += '<div class="result-detail">';
      html += '<strong>' + r.sketch.sectionName + '</strong><br>';
      html += '坐标体系: ' + r.sketch.coordSystem + '<br>';
      html += '标高: ' + r.sketch.elevation + '<br>';
      html += '视线下倾角: ' + r.sketch.sightlineAngle + '<br>';
      html += '遮挡高度: ' + r.sketch.obstructionHeight + '<br>';
      if (r.coordFlag) {
        html += '<span class="coord-flag" onclick="App.showCoordDetail(\'' + r.id + '\')">⚠️ 混合坐标检测</span><br>';
      }
      html += '</div>';
      if (!r.step1Done) {
        html += '<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="App.confirmSketchImport(\'' + r.id + '\')">确认导入</button>';
      }
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="card" style="margin-top:16px;">';
    html += '<div class="card-header"><h4>三种处理结果对比</h4></div>';
    html += '<div class="card-body">';
    html += '<table class="data-table">';
    html += '<thead><tr><th>记录类型</th><th>处理方式</th><th>结果</th></tr></thead>';
    html += '<tbody>';
    state.records.forEach(function (r) {
      var result = r.type === 'normal' ? '直接通过 → 生成说明' :
                   r.type === 'mixed_coords' ? '标记待复核 → 不自动归正常' :
                   '触发冲突 → 等待教官确认';
      html += '<tr><td>' + r.typeName + '</td><td>' + r.expectedProcessing + '</td><td>' + (r.step1Done ? result : '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '</div></div>';

    el.innerHTML = html;
  }

  function renderLogReview() {
    var el = document.getElementById('logReviewArea');
    var conflictEl = document.getElementById('conflictArea');

    if (state.records.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>请先在第一步导入楼层剖面草图</p></div>';
      conflictEl.innerHTML = '';
      return;
    }

    var html = '';
    state.records.forEach(function (r) {
      var log = r.pointCloudLog;
      var stepIcon = r.step2Done ? '✅' : '⬜';
      var remarkClass = log.isSupplemented ? 'remark-supplemented' : (r.type === 'mixed_coords' ? 'remark-important' : 'remark-normal');

      html += '<div class="log-entry">';
      html += '<div class="log-header">';
      html += '<span>' + stepIcon + ' ' + r.typeName + ' — ' + r.sketch.sectionName + '</span>';
      html += '<span class="remark-tag ' + remarkClass + '">' + (log.isSupplemented ? '补录' : r.type === 'mixed_coords' ? '需复核' : '正常') + '</span>';
      html += '</div>';
      html += '<div class="log-body">';

      html += '<div class="log-remark">';
      html += '<div class="log-remark-label">📝 备注（比正式表更重要）</div>';
      html += '<div class="log-remark-text">' + log.remark + '</div>';
      html += '</div>';

      html += '<div class="log-formal">';
      html += '<div class="log-formal-label">正式数据</div>';
      html += '总点数: ' + log.formalData.totalPoints.toLocaleString() + ' | ';
      html += '保留点数: ' + log.formalData.retainedPoints.toLocaleString() + ' | ';
      html += '保留率: ' + log.formalData.retentionRate + ' | ';
      html += '坐标体系: ' + log.formalData.coordSystem + ' | ';
      html += '标高: ' + log.formalData.elevation + ' | ';
      html += '遮挡高度: ' + log.formalData.obstructionHeight;
      html += '</div>';

      if (log.isSupplemented) {
        html += '<div style="margin-top:8px;padding:8px 12px;background:var(--info-bg);border-radius:var(--radius);font-size:12px;color:var(--info);">';
        html += '📌 补录来源: ' + log.supplementedFrom + ' | 口径: ' + log.caliber;
        html += '</div>';
      }

      if (!r.step2Done && r.step1Done) {
        html += '<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="App.reviewLog(\'' + r.id + '\')">审看完成，检测冲突</button>';
      }
      if (r.step2Done) {
        html += '<div style="margin-top:8px;padding:8px 12px;background:var(--success-bg);border-radius:var(--radius);font-size:12px;color:var(--success);">✓ 已完成审看</div>';
      }

      html += '</div></div>';
    });

    el.innerHTML = html;

    var conflictHtml = '';
    var hasConflicts = false;
    state.records.forEach(function (r) {
      if (r.conflicts.length > 0) {
        r.conflicts.forEach(function (c) {
          hasConflicts = true;
          conflictHtml += '<div class="conflict-card">';
          conflictHtml += '<div class="conflict-header">⚠️ 冲突: ' + c.title + ' — ' + r.typeName + '</div>';
          conflictHtml += '<div class="conflict-body">';
          conflictHtml += '<p style="margin-bottom:8px;color:var(--text-muted);">' + c.description + '</p>';
          conflictHtml += '<div class="evidence-row">';
          conflictHtml += '<div class="evidence-col"><h5>楼层剖面草图</h5><div class="evidence-data">' + c.sketchValue + '</div></div>';
          conflictHtml += '<div class="evidence-col"><h5>点云抽稀日志</h5><div class="evidence-data">' + c.logValue + '</div></div>';
          conflictHtml += '</div>';
          if (c.resolution) {
            var resLabel = c.resolution === 'confirmed' ? '✓ 已确认（以日志为准）' : '✗ 已驳回（保留草图）';
            var resClass = c.resolution === 'confirmed' ? 'status-confirmed' : 'status-review';
            conflictHtml += '<div style="padding:8px 12px;border-radius:var(--radius);font-size:13px;" class="result-status ' + resClass + '">' + resLabel + ' — ' + c.resolvedBy + ' @ ' + c.resolvedAt + '</div>';
          } else {
            conflictHtml += '<div class="conflict-actions">';
            conflictHtml += '<button class="btn btn-success btn-sm" onclick="App.showConflictModal(\'' + r.id + '\',\'' + c.id + '\')">处理冲突</button>';
            conflictHtml += '</div>';
          }
          conflictHtml += '</div></div>';
        });
      }
    });

    if (!hasConflicts && state.records.some(function (r) { return r.step2Done; })) {
      conflictHtml = '<div class="card" style="border-left:4px solid var(--success);"><div class="card-body" style="color:var(--success);font-size:14px;">✓ 所有已审看记录无冲突</div></div>';
    }

    conflictEl.innerHTML = conflictHtml;
  }

  function renderFieldNotes() {
    var el = document.getElementById('fieldNoteArea');
    if (state.records.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>请先完成前两步</p></div>';
      return;
    }

    var html = '';
    state.records.forEach(function (r) {
      var canGenerate = r.step1Done && r.step2Done;
      var hasNote = r.fieldNote !== null;

      html += '<div class="card field-note-card">';
      html += '<div class="card-header">';
      html += '<h4>' + r.typeName + ' — ' + r.sketch.sectionName + '</h4>';
      if (hasNote) {
        html += '<span class="result-status status-confirmed">已生成</span>';
      } else if (canGenerate) {
        html += '<button class="btn btn-success btn-sm" onclick="App.generateNote(\'' + r.id + '\')">生成现场班组说明</button>';
      } else {
        html += '<span class="result-status status-review">待前序步骤完成</span>';
      }
      html += '</div>';
      html += '<div class="card-body">';
      if (hasNote) {
        html += '<div class="note-content">' + r.fieldNote + '</div>';
      } else if (!canGenerate) {
        html += '<p style="color:var(--text-dim);">需先完成：' + (!r.step1Done ? '①草图导入 ' : '') + (!r.step2Done ? '②日志审看' : '') + '</p>';
      }
      html += '</div></div>';
    });

    html += '<div class="card" style="margin-top:16px;border-left:4px solid var(--accent);">';
    html += '<div class="card-header"><h4>历史记录核对</h4></div>';
    html += '<div class="card-body">';
    html += '<table class="data-table">';
    html += '<thead><tr><th>记录</th><th>草图遮挡高度</th><th>日志遮挡高度</th><th>口径</th><th>冲突处理</th><th>说明状态</th></tr></thead>';
    html += '<tbody>';
    state.records.forEach(function (r) {
      var conflictRes = '—';
      if (r.conflicts.length > 0) {
        conflictRes = r.conflicts.map(function (c) {
          if (!c.resolution) return '⏳ 待处理';
          return c.resolution === 'confirmed' ? '✓ 以日志为准' : '✗ 保留草图';
        }).join('；');
      } else {
        conflictRes = '无冲突';
      }
      html += '<tr>';
      html += '<td>' + r.typeName + '</td>';
      html += '<td>' + r.sketch.obstructionHeight + '</td>';
      html += '<td>' + r.pointCloudLog.formalData.obstructionHeight + '</td>';
      html += '<td>' + r.pointCloudLog.caliber + '</td>';
      html += '<td>' + conflictRes + '</td>';
      html += '<td>' + (r.fieldNote ? '✓ 已生成' : '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div></div>';

    el.innerHTML = html;
  }

  function updateTime() {
    var el = document.getElementById('currentTime');
    if (el) el.textContent = now();
  }

  var api = {
    init: function () {
      updateTime();
      setInterval(updateTime, 1000);
      renderRecordList();
      renderQuickStats();
      renderAuditTrail();
      renderSketchImport();
      renderLogReview();
      renderFieldNotes();
      renderStepStatus();
    },

    gotoStep: function (step) {
      state.currentStep = step;
      document.querySelectorAll('.step-item').forEach(function (el) {
        el.classList.toggle('active', parseInt(el.dataset.step) === step);
      });
      document.querySelectorAll('.step-panel').forEach(function (el) {
        el.classList.remove('active');
      });
      document.getElementById('step' + step + 'Panel').classList.add('active');
      if (step === 1) renderSketchImport();
      if (step === 2) renderLogReview();
      if (step === 3) renderFieldNotes();
    },

    selectRecord: function (id) {
      state.selectedRecordId = id;
      renderRecordList();
    },

    loadSampleSketch: function (type) {
      var record = createRecord(type);
      state.records.push(record);
      state.selectedRecordId = record.id;
      addAudit({
        type: 'create',
        what: '创建 ' + record.typeName + '：' + record.sketch.sectionName,
        why: '加载样例数据',
        impact: '新增1条待导入记录',
      });
      renderRecordList();
      renderQuickStats();
      renderSketchImport();
      renderStepStatus();
    },

    loadAllSamples: function () {
      ['normal', 'mixed_coords', 'supplemented'].forEach(function (type) {
        var exists = state.records.some(function (r) { return r.type === type; });
        if (!exists) {
          var record = createRecord(type);
          state.records.push(record);
        }
      });
      if (state.records.length > 0) {
        state.selectedRecordId = state.records[0].id;
      }
      addAudit({
        type: 'create',
        what: '批量加载全部3条样例记录',
        why: '一次性加载正常、混合坐标、补录旧口径三种样例',
        impact: '新增3条待导入记录',
      });
      renderRecordList();
      renderQuickStats();
      renderSketchImport();
      renderStepStatus();
    },

    confirmSketchImport: function (id) {
      var record = state.records.find(function (r) { return r.id === id; });
      if (!record) return;
      record.step1Done = true;
      record.sketch.importTime = now();
      record.sketch.importedBy = OPERATOR;
      record.status = 'imported';

      if (detectCoordMix(record)) {
        record.coordFlag = true;
        addAudit({
          type: 'flag',
          what: '检测到混合坐标：' + record.sketch.sectionName,
          why: '观察点同时包含经纬度和米制坐标，目标点仅有米制坐标',
          impact: '不自动归正常，标记待巡检组复核',
        });
      }

      addAudit({
        type: 'create',
        what: '导入楼层剖面草图：' + record.sketch.sectionName,
        why: '第一步：草图数据导入确认',
        impact: '记录状态变为"已导入"，可进入第二步审看',
      });

      if (record.coordFlag) {
        state.currentCoordRecordId = record.id;
        api.showCoordModal();
      }

      renderSketchImport();
      renderStepStatus();
    },

    showCoordDetail: function (id) {
      state.currentCoordRecordId = id;
      api.showCoordModal();
    },

    showCoordModal: function () {
      var record = state.records.find(function (r) { return r.id === state.currentCoordRecordId; });
      if (!record) return;
      var el = document.getElementById('coordEvidence');
      var html = '<div class="evidence-item">';
      html += '<h5>观察点坐标（混合）</h5>';
      var obs = record.sketch.observerPoint;
      html += '<div class="evidence-detail">';
      if (obs.lat !== undefined) html += '<span class="coord-wgs84">WGS84: lat=' + obs.lat + ', lng=' + obs.lng + '</span><br>';
      if (obs.x !== undefined) html += '<span class="coord-metric">米制: x=' + obs.x + ', y=' + obs.y + '</span><br>';
      html += '</div></div>';
      html += '<div class="evidence-item">';
      html += '<h5>目标点坐标（仅米制）</h5>';
      var tgt = record.sketch.targetPoint;
      html += '<div class="evidence-detail">';
      if (tgt.lat !== undefined) html += '<span class="coord-wgs84">WGS84: lat=' + tgt.lat + ', lng=' + tgt.lng + '</span><br>';
      if (tgt.x !== undefined) html += '<span class="coord-metric">米制: x=' + tgt.x + ', y=' + tgt.y + '</span><br>';
      html += '</div></div>';
      html += '<div class="evidence-item" style="border:1px solid var(--warning);background:var(--warning-bg);">';
      html += '<h5 style="color:var(--warning);">⚠️ 处理原则</h5>';
      html += '<div style="color:var(--text);font-size:13px;">经纬度与米制坐标混合存在时，<strong>不自动归正常</strong>，留给巡检组复核确认。系统仅标记状态，不做坐标转换假设。</div>';
      html += '</div>';
      el.innerHTML = html;
      document.getElementById('coordReviewModal').style.display = 'flex';
    },

    closeCoordModal: function () {
      document.getElementById('coordReviewModal').style.display = 'none';
    },

    flagForInspection: function () {
      var record = state.records.find(function (r) { return r.id === state.currentCoordRecordId; });
      if (record) {
        record.coordFlag = true;
        addAudit({
          type: 'flag',
          what: '标记待巡检组复核：' + record.sketch.sectionName,
          who: OPERATOR,
          why: '经纬度与米制坐标混合，不自动归正常',
          impact: '该记录坐标体系待巡检组人工确认，现场班组说明将标注坐标未统一',
        });
      }
      api.closeCoordModal();
      renderSketchImport();
    },

    reviewLog: function (id) {
      var record = state.records.find(function (r) { return r.id === id; });
      if (!record || !record.step1Done) return;

      var conflicts = detectConflicts(record);
      record.conflicts = conflicts;
      record.step2Done = true;

      addAudit({
        type: conflicts.length > 0 ? 'conflict' : 'update',
        what: '审看点云抽稀日志：' + record.sketch.sectionName,
        why: '第二步：培训教官审看日志数据',
        impact: conflicts.length > 0 ? '发现' + conflicts.length + '处冲突，需人工确认' : '无冲突，可进入第三步',
      });

      renderLogReview();
      renderStepStatus();

      if (conflicts.length > 0) {
        api.showConflictModal(id, conflicts[0].id);
      }
    },

    showConflictModal: function (recordId, conflictId) {
      var record = state.records.find(function (r) { return r.id === recordId; });
      if (!record) return;
      var conflict = record.conflicts.find(function (c) { return c.id === conflictId; });
      if (!conflict) return;

      state.currentConflictId = { recordId: recordId, conflictId: conflictId };

      var el = document.getElementById('conflictEvidence');
      var html = '<div class="evidence-item">';
      html += '<h5>冲突描述</h5>';
      html += '<div class="evidence-detail" style="color:var(--danger);">' + conflict.description + '</div>';
      html += '</div>';
      html += '<div class="evidence-item">';
      html += '<h5>楼层剖面草图数据</h5>';
      html += '<div class="evidence-detail">' + conflict.sketchValue + '</div>';
      html += '</div>';
      html += '<div class="evidence-item">';
      html += '<h5>点云抽稀日志数据</h5>';
      html += '<div class="evidence-detail">' + conflict.logValue + '</div>';
      html += '</div>';
      if (record.pointCloudLog.isSupplemented) {
        html += '<div class="evidence-item" style="border:1px solid var(--info);background:var(--info-bg);">';
        html += '<h5 style="color:var(--info);">📌 补录信息</h5>';
        html += '<div style="font-size:13px;">此日志为旧口径补录，口径: ' + record.pointCloudLog.caliber + '，来源: ' + record.pointCloudLog.supplementedFrom + '</div>';
        html += '</div>';
      }
      el.innerHTML = html;
      document.getElementById('conflictModal').style.display = 'flex';
    },

    closeConflictModal: function () {
      document.getElementById('conflictModal').style.display = 'none';
    },

    resolveConflict: function (resolution) {
      var ids = state.currentConflictId;
      if (!ids) return;
      var record = state.records.find(function (r) { return r.id === ids.recordId; });
      if (!record) return;
      var conflict = record.conflicts.find(function (c) { return c.id === ids.conflictId; });
      if (!conflict) return;

      conflict.resolution = resolution;
      conflict.resolvedBy = OPERATOR;
      conflict.resolvedAt = now();

      var resLabel = resolution === 'confirmed' ? '确认（以日志为准）' : '驳回（保留草图）';
      addAudit({
        type: 'resolve',
        what: '冲突处理：' + conflict.title + ' → ' + resLabel,
        who: OPERATOR,
        why: resolution === 'confirmed' ? '点云抽稀日志数据更可靠，以日志为准' : '当前草图数据更准确，保留草图',
        impact: resolution === 'confirmed'
          ? '遮挡高度将以日志值 ' + record.pointCloudLog.formalData.obstructionHeight + ' 为准，影响现场班组说明'
          : '遮挡高度保留草图值 ' + record.sketch.obstructionHeight + '，日志差异记入备注',
      });

      api.closeConflictModal();
      renderLogReview();

      var nextConflict = record.conflicts.find(function (c) { return !c.resolution; });
      if (nextConflict) {
        api.showConflictModal(record.id, nextConflict.id);
      }
    },

    generateNote: function (id) {
      var record = state.records.find(function (r) { return r.id === id; });
      if (!record || !record.step1Done || !record.step2Done) return;

      var unresolvedConflicts = record.conflicts.filter(function (c) { return !c.resolution; });
      if (unresolvedConflicts.length > 0) {
        alert('存在未处理的冲突，请先在第二步处理完所有冲突后再生成说明。');
        return;
      }

      record.fieldNote = generateFieldNote(record);
      record.step3Done = true;

      addAudit({
        type: 'update',
        what: '生成现场班组说明：' + record.sketch.sectionName,
        who: OPERATOR,
        why: '第三步：前两步已完成，所有冲突已处理，生成最终说明',
        impact: '现场班组说明已生成，包含完整数据、冲突处理结果和坐标复核标记',
      });

      renderFieldNotes();
      renderStepStatus();
    },
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
