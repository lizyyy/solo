var App = (function () {
  var ALGO_VERSION = 'v1.0-lag-xcorr-thermal';
  var THERMAL_K_DEFAULT = 0.08;
  var statusLabel = { processed: '已处理', pending: '待确认', returned: '退回' };
  var riskLabel = { high: '高', medium: '中', low: '低' };

  var store = {
    boxTemps: [], externalTemps: [], openingRecords: [], orders: [], riskReports: [],
    analysisObjects: [], currentView: 'dashboard', statusFilter: 'all',
    selectedObjectId: null, conclusionTargetId: null,
    importBuffers: { boxTemps: null, externalTemps: null, openingRecords: null, orders: null, sensorIds: null, riskReports: null }
  };

  function uid() { return 'ao-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

  function toast(msg, type) {
    type = type || 'info';
    var c = document.getElementById('toastContainer');
    var el = document.createElement('div');
    el.className = 'toast ' + type; el.textContent = msg; c.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  function formatTs(ts) {
    if (!ts) return '-';
    var d = new Date(ts), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function formatTsShort(ts) {
    if (!ts) return '-';
    var d = new Date(ts), p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function crossCorrelation(a, b) {
    var n = Math.min(a.length, b.length);
    if (n < 3) return { lag: 0, confidence: 0 };
    var aS = a.slice(0, n), bS = b.slice(0, n);
    var aM = aS.reduce(function (s, v) { return s + v; }, 0) / n;
    var bM = bS.reduce(function (s, v) { return s + v; }, 0) / n;
    var aN = aS.map(function (v) { return v - aM; }), bN = bS.map(function (v) { return v - bM; });
    var aStd = Math.sqrt(aN.reduce(function (s, v) { return s + v * v; }, 0));
    var bStd = Math.sqrt(bN.reduce(function (s, v) { return s + v * v; }, 0));
    if (aStd === 0 || bStd === 0) return { lag: 0, confidence: 0 };
    var maxLag = Math.min(Math.floor(n / 3), 60);
    var bestLag = 0, bestCorr = -Infinity;
    for (var lag = -maxLag; lag <= maxLag; lag++) {
      var corr = 0, count = 0;
      for (var i = 0; i < n; i++) { var j = i + lag; if (j >= 0 && j < n) { corr += aN[i] * bN[j]; count++; } }
      if (count > 0) corr /= (aStd * bStd * count / n);
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    return { lag: bestLag, confidence: Math.abs(bestCorr) };
  }

  function estimateThermalK(boxTemps, extTemps, intervalMin) {
    if (boxTemps.length < 3 || extTemps.length < 3) return THERMAL_K_DEFAULT;
    var n = Math.min(boxTemps.length, extTemps.length);
    var sumK = 0, count = 0;
    for (var i = 1; i < n; i++) {
      var dT = boxTemps[i] - boxTemps[i - 1];
      var Tdiff = extTemps[i - 1] - boxTemps[i - 1];
      if (Math.abs(Tdiff) > 0.01) { var k = dT / (Tdiff * intervalMin); if (k > 0 && k < 1) { sumK += k; count++; } }
    }
    return count > 0 ? sumK / count : THERMAL_K_DEFAULT;
  }

  function computeRiskScore(lagMin, maxTempDev, openingFreq, sensorGapCount) {
    return Math.round(Math.min(lagMin / 30, 1) * 35 + Math.min(maxTempDev / 5, 1) * 30 + Math.min(openingFreq / 5, 1) * 20 + Math.min(sensorGapCount / 10, 1) * 15);
  }

  function riskLevel(score) { return score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'; }

  function detectAnomalies(orderId, sensorId, boxTemps, extTemps, openings, intervalMin) {
    var anomalies = [];
    var allTsMap = {};
    boxTemps.forEach(function (t) { allTsMap[t.timestamp] = true; });
    extTemps.forEach(function (t) { allTsMap[t.timestamp] = true; });
    var allTs = Object.keys(allTsMap).map(Number).sort(function (a, b) { return a - b; });
    var timeGaps = 0;
    for (var i = 1; i < allTs.length; i++) {
      var gap = allTs[i] - allTs[i - 1];
      if (gap > intervalMin * 3 * 60000) {
        timeGaps++;
        if (timeGaps <= 5) anomalies.push({
          type: 'time_misalign', label: '时间错位',
          description: '时间戳间隙 ' + Math.round(gap / 60000) + ' 分钟（预期 ≤' + (intervalMin * 3) + ' 分钟），位于 ' + formatTs(allTs[i - 1]) + ' ~ ' + formatTs(allTs[i]),
          sourceRef: { type: 'timestamp', timestamp: allTs[i - 1], orderId: orderId, sensorId: sensorId },
          timestamp: allTs[i - 1], severity: gap > intervalMin * 10 * 60000 ? 'high' : 'medium'
        });
      }
    }
    var boxSet = {}, extSet = {};
    boxTemps.forEach(function (t) { boxSet[Math.round(t.timestamp / 60000)] = true; });
    extTemps.forEach(function (t) { extSet[Math.round(t.timestamp / 60000)] = true; });
    var sensorGaps = 0;
    Object.keys(boxSet).forEach(function (m) { if (!extSet[m]) sensorGaps++; });
    Object.keys(extSet).forEach(function (m) { if (!boxSet[m]) sensorGaps++; });
    if (sensorGaps > 0) anomalies.push({
      type: 'sensor_gap', label: '传感器缺口',
      description: '箱内/外部温度传感器存在 ' + sensorGaps + ' 个时间点不匹配，可能存在传感器故障或数据丢失',
      sourceRef: { type: 'sensor_gap', sensorId: sensorId, count: sensorGaps },
      timestamp: allTs[0] || Date.now(), severity: sensorGaps > 20 ? 'high' : 'medium'
    });
    var openingTimes = openings.map(function (o) { return o.timestamp; });
    for (var si = 1; si < boxTemps.length; si++) {
      var delta = boxTemps[si].value - boxTemps[si - 1].value;
      if (delta > 2) {
        var nearOpening = openingTimes.some(function (ot) { return Math.abs(ot - boxTemps[si].timestamp) < 10 * 60000; });
        if (!nearOpening && anomalies.filter(function (a) { return a.type === 'unrecorded_opening'; }).length < 5) anomalies.push({
          type: 'unrecorded_opening', label: '开箱未记录',
          description: '箱内温度骤升 ' + delta.toFixed(1) + '°C 至 ' + boxTemps[si].value.toFixed(1) + '°C，但无对应开箱记录，疑似未记录的开箱操作',
          sourceRef: { type: 'temp_spike', timestamp: boxTemps[si].timestamp, sensorId: sensorId, orderId: orderId },
          timestamp: boxTemps[si].timestamp, severity: delta > 5 ? 'high' : 'medium'
        });
      }
    }
    return anomalies;
  }

  function buildAnalysisObjects() {
    var objects = [];
    store.orders.forEach(function (order) {
      var sensorId = order.sensorId;
      var startTs = new Date(order.startTime).getTime();
      var endTs = new Date(order.endTime).getTime();
      var boxTemps = store.boxTemps.filter(function (t) { return t.sensorId === sensorId && t.timestamp >= startTs && t.timestamp <= endTs; }).sort(function (a, b) { return a.timestamp - b.timestamp; });
      var extTemps = store.externalTemps.filter(function (t) { return t.sensorId === sensorId && t.timestamp >= startTs && t.timestamp <= endTs; }).sort(function (a, b) { return a.timestamp - b.timestamp; });
      var openings = store.openingRecords.filter(function (o) { return (o.orderId === order.orderId || o.sensorId === sensorId) && o.timestamp >= startTs && o.timestamp <= endTs; }).sort(function (a, b) { return a.timestamp - b.timestamp; });
      var intervalMin = boxTemps.length > 1 ? (boxTemps[1].timestamp - boxTemps[0].timestamp) / 60000 : 5;
      var lagResult = { lag: 0, confidence: 0 }, thermalK = THERMAL_K_DEFAULT;
      if (boxTemps.length >= 5 && extTemps.length >= 5) {
        lagResult = crossCorrelation(boxTemps.map(function (t) { return t.value; }), extTemps.map(function (t) { return t.value; }));
        thermalK = estimateThermalK(boxTemps.map(function (t) { return t.value; }), extTemps.map(function (t) { return t.value; }), intervalMin);
      }
      var lagMinutes = lagResult.lag * intervalMin;
      var maxDev = 0;
      if (boxTemps.length > 0 && extTemps.length > 0) maxDev = Math.max.apply(null, boxTemps.map(function (bt) {
        var extAt = extTemps.find(function (et) { return Math.abs(et.timestamp - bt.timestamp) < intervalMin * 60000 * 2; });
        return extAt ? Math.abs(bt.value - extAt.value) : 0;
      }));
      var anomalies = detectAnomalies(order.orderId, sensorId, boxTemps, extTemps, store.openingRecords, intervalMin);
      var sensorGaps = anomalies.filter(function (a) { return a.type === 'sensor_gap'; }).reduce(function (s, a) { return s + (a.sourceRef.count || 1); }, 0);
      var rScore = computeRiskScore(Math.abs(lagMinutes), maxDev, openings.length, sensorGaps);
      var existingObj = store.analysisObjects.find(function (o) { return o.orderId === order.orderId; });
      var timeline = [];
      var maxLen = Math.max(boxTemps.length, extTemps.length);
      for (var ti = 0; ti < maxLen; ti++) {
        var bt = boxTemps[ti] || null, et = extTemps[ti] || null;
        var ts = bt ? bt.timestamp : (et ? et.timestamp : 0);
        var opening = openings.find(function (o) { return Math.abs(o.timestamp - ts) < intervalMin * 60000; });
        var anomaly = anomalies.find(function (a) { return Math.abs(a.timestamp - ts) < intervalMin * 60000 * 2; });
        timeline.push({ timestamp: ts, boxTemp: bt ? bt.value : null, extTemp: et ? et.value : null, delta: bt && et ? (bt.value - et.value).toFixed(2) : null, opening: opening ? { duration: opening.duration, operator: opening.operator } : null, anomaly: anomaly ? anomaly.type : null });
      }
      objects.push({
        id: existingObj ? existingObj.id : uid(), orderId: order.orderId, sensorId: sensorId,
        version: existingObj ? existingObj.version + 1 : 1, algoVersion: ALGO_VERSION,
        lagEstimate: lagMinutes, lagConfidence: lagResult.confidence,
        thermalCoefficient: thermalK, intervalMin: intervalMin,
        riskScore: rScore, riskLevel: riskLevel(rScore), maxTempDeviation: maxDev,
        boxTempCount: boxTemps.length, extTempCount: extTemps.length, openingCount: openings.length,
        anomalies: anomalies, timeline: timeline,
        status: existingObj ? existingObj.status : 'pending',
        conclusions: existingObj ? [].concat(existingObj.conclusions) : [],
        orderInfo: order, createdAt: existingObj ? existingObj.createdAt : Date.now(), updatedAt: Date.now()
      });
    });
    store.analysisObjects = objects;
  }

  function updateHeaderStats() {
    var stats = document.getElementById('headerStats');
    var p = store.analysisObjects.filter(function (o) { return o.status === 'processed'; }).length;
    var pe = store.analysisObjects.filter(function (o) { return o.status === 'pending'; }).length;
    var r = store.analysisObjects.filter(function (o) { return o.status === 'returned'; }).length;
    stats.innerHTML = '<span class="stat-badge processed">已处理 ' + p + '</span><span class="stat-badge pending">待确认 ' + pe + '</span><span class="stat-badge returned">退回补材料 ' + r + '</span>';
  }

  function getFilteredObjects() {
    if (store.statusFilter === 'all') return store.analysisObjects;
    return store.analysisObjects.filter(function (o) { return o.status === store.statusFilter; });
  }

  function renderStatusFilter() {
    return '<div class="status-filter-row"><span>状态筛选:</span>' +
      '<button class="filter-chip ' + (store.statusFilter === 'all' ? 'active' : '') + '" onclick="App.setStatusFilter(\'all\')">全部</button>' +
      '<button class="filter-chip f-processed ' + (store.statusFilter === 'processed' ? 'active' : '') + '" onclick="App.setStatusFilter(\'processed\')">已处理</button>' +
      '<button class="filter-chip f-pending ' + (store.statusFilter === 'pending' ? 'active' : '') + '" onclick="App.setStatusFilter(\'pending\')">待确认</button>' +
      '<button class="filter-chip f-returned ' + (store.statusFilter === 'returned' ? 'active' : '') + '" onclick="App.setStatusFilter(\'returned\')">退回补材料</button></div>';
  }

  function drawTempChart(canvas, timeline, highlightLag) {
    if (!canvas || !timeline || timeline.length === 0) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.parentElement.offsetWidth;
    var H = canvas.height = 220;
    var pad = { top: 20, right: 20, bottom: 30, left: 50 };
    var plotW = W - pad.left - pad.right, plotH = H - pad.top - pad.bottom;
    ctx.clearRect(0, 0, W, H);
    var vp = timeline.filter(function (t) { return t.boxTemp !== null && t.extTemp !== null; });
    if (vp.length < 2) return;
    var temps = vp.reduce(function (a, t) { a.push(t.boxTemp, t.extTemp); return a; }, []);
    var minT = Math.floor(Math.min.apply(null, temps) - 2), maxT = Math.ceil(Math.max.apply(null, temps) + 2);
    var tsMin = vp[0].timestamp, tsRange = (vp[vp.length - 1].timestamp - tsMin) || 1;
    var toX = function (ts) { return pad.left + ((ts - tsMin) / tsRange) * plotW; };
    var toY = function (v) { return pad.top + plotH - ((v - minT) / (maxT - minT)) * plotH; };
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 0.5;
    for (var t = minT; t <= maxT; t += 2) { var y = toY(t); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke(); }
    function drawLine(pts, color, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []); ctx.beginPath();
      var s = false; pts.forEach(function (p) { var x = toX(p.ts), y = toY(p.v); if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    drawLine(vp.map(function (t) { return { ts: t.timestamp, v: t.extTemp }; }), '#60a5fa', []);
    drawLine(vp.map(function (t) { return { ts: t.timestamp, v: t.boxTemp }; }), '#ef4444', []);
    vp.forEach(function (p) {
      if (p.anomaly) { var x = toX(p.timestamp), y = toY(p.boxTemp); ctx.fillStyle = 'rgba(249,115,22,0.3)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5; ctx.stroke(); }
      if (p.opening) { ctx.fillStyle = 'rgba(168,85,247,0.4)'; ctx.fillRect(toX(p.timestamp) - 1, pad.top, 2, plotH); }
    });
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
    for (var tt = minT; tt <= maxT; tt += 2) ctx.fillText(tt + '°C', 4, toY(tt) + 3);
    var step = Math.max(1, Math.floor(vp.length / 6));
    for (var vi = 0; vi < vp.length; vi += step) ctx.fillText(formatTsShort(vp[vi].timestamp), toX(vp[vi].timestamp) - 25, H - 6);
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(pad.left + 10, pad.top, 12, 3); ctx.fillStyle = '#94a3b8'; ctx.fillText('外部温度', pad.left + 26, pad.top + 5);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(pad.left + 90, pad.top, 12, 3); ctx.fillText('箱内温度', pad.left + 106, pad.top + 5);
  }

  function renderCurrentView() {
    var v = store.currentView;
    var fnMap = { dashboard: renderDashboard, order: renderOrderView, sensor: renderSensorView, timeline: renderTimelineView, risk: renderRiskView, anomalies: renderAnomaliesView, versions: renderVersionsView, export: renderExportView };
    if (fnMap[v]) fnMap[v]();
  }

  function renderAllViews() {
    ['dashboard', 'order', 'sensor', 'timeline', 'risk', 'anomalies', 'versions', 'export'].forEach(function (v) {
      store.currentView = v; renderCurrentView();
    });
    store.currentView = 'dashboard'; renderCurrentView();
  }

  function switchView(viewName) {
    store.currentView = viewName;
    document.querySelectorAll('.nav-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('.view-panel').forEach(function (el) {
      el.classList.toggle('active', el.id === 'view-' + viewName);
    });
    renderCurrentView();
  }

  function setStatusFilter(f) { store.statusFilter = f; renderCurrentView(); }

  function openDetail(objId) {
    var obj = store.analysisObjects.find(function (o) { return o.id === objId; });
    if (!obj) return;
    store.selectedObjectId = objId;
    var body = document.getElementById('drawerBody');
    var h = '<div class="detail-section"><h4>订单信息</h4>';
    h += '<div class="param-row">';
    h += '<div class="param-item"><span class="p-label">订单号</span><span class="p-value">' + obj.orderId + '</span></div>';
    h += '<div class="param-item"><span class="p-label">传感器</span><span class="p-value">' + obj.sensorId + '</span></div>';
    h += '<div class="param-item"><span class="p-label">状态</span><span class="p-value"><span class="status-tag ' + obj.status + '">' + statusLabel[obj.status] + '</span></span></div>';
    h += '</div></div>';
    h += '<div class="detail-section"><h4>分析参数 <span class="algo-badge">' + obj.algoVersion + '</span></h4>';
    h += '<div class="param-row">';
    h += '<div class="param-item"><span class="p-label">滞后估计</span><span class="p-value">' + obj.lagEstimate.toFixed(1) + ' min</span></div>';
    h += '<div class="param-item"><span class="p-label">置信度</span><span class="p-value">' + (obj.lagConfidence * 100).toFixed(0) + '%</span></div>';
    h += '<div class="param-item"><span class="p-label">热传导系数</span><span class="p-value">' + obj.thermalCoefficient.toFixed(4) + '</span></div>';
    h += '</div><div class="param-row">';
    h += '<div class="param-item"><span class="p-label">风险分数</span><span class="p-value"><span class="risk-tag ' + obj.riskLevel + '">' + obj.riskScore + '</span></span></div>';
    h += '<div class="param-item"><span class="p-label">最大偏差</span><span class="p-value">' + obj.maxTempDeviation.toFixed(1) + '°C</span></div>';
    h += '<div class="param-item"><span class="p-label">版本</span><span class="p-value">v' + obj.version + '</span></div>';
    h += '</div></div>';
    h += '<div class="detail-section"><h4>温度曲线</h4><div class="chart-container"><canvas id="detailChart"></canvas></div></div>';
    h += '<div class="detail-section"><h4>异常 (' + obj.anomalies.length + ')</h4>';
    if (obj.anomalies.length > 0) obj.anomalies.forEach(function (a) {
      h += '<div class="anomaly-item ' + a.type + '">';
      h += '<span class="type-label">' + a.label + '</span>';
      h += '<span class="desc">' + a.description + '</span>';
      if (a.sourceRef) h += '<span class="source-link" onclick="App.navigateToSource(' + JSON.stringify(a.sourceRef).replace(/"/g, '&quot;') + ')">→ 溯源</span>';
      h += '</div>';
    }); else h += '<p style="color:var(--text2);font-size:12px;">无异常</p>';
    h += '</div>';
    h += '<div class="detail-section"><h4>结论历史</h4>';
    if (obj.conclusions.length > 0) {
      h += '<div class="version-timeline">';
      obj.conclusions.forEach(function (c, i) {
        h += '<div class="version-node' + (i === obj.conclusions.length - 1 ? ' current' : '') + '">';
        h += '<div class="v-label">' + statusLabel[c.type] + '</div>';
        h += '<div class="v-time">' + formatTs(c.timestamp) + '</div>';
        h += '<div class="v-desc">' + c.text + ' — ' + (c.author || '') + '</div>';
        h += '</div>';
      });
      h += '</div>';
    } else h += '<p style="color:var(--text2);font-size:12px;">暂无结论</p>';
    h += '</div>';
    h += '<button class="btn btn-primary" onclick="App.showConclusionModal(\'' + objId + '\')">添加结论</button>';
    body.innerHTML = h;
    document.getElementById('drawerTitle').textContent = '详情 - ' + obj.orderId;
    document.getElementById('detailDrawer').classList.add('open');
    document.getElementById('overlay').classList.add('show');
    setTimeout(function () { var c = document.getElementById('detailChart'); if (c) drawTempChart(c, obj.timeline, obj.lagEstimate); }, 100);
  }

  function closeDrawer() {
    document.getElementById('detailDrawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
    store.selectedObjectId = null;
  }

  function navigateToSource(ref) {
    if (!ref) return;
    var body = document.getElementById('drawerBody');
    var h = '<div class="detail-section"><h4>溯源结果</h4>';
    if (ref.type === 'timestamp') {
      var ts = ref.timestamp;
      h += '<p style="font-size:12px;color:var(--text2);">时间点：' + formatTs(ts) + '</p>';
      h += '<div class="raw-data-preview">';
      var nearby = store.boxTemps.filter(function (t) { return t.sensorId === ref.sensorId && Math.abs(t.timestamp - ts) < 600000; });
      nearby.forEach(function (t) { h += '箱内 ' + formatTsShort(t.timestamp) + '  ' + t.value.toFixed(1) + '°C\n'; });
      var nearbyExt = store.externalTemps.filter(function (t) { return t.sensorId === ref.sensorId && Math.abs(t.timestamp - ts) < 600000; });
      nearbyExt.forEach(function (t) { h += '外部 ' + formatTsShort(t.timestamp) + '  ' + t.value.toFixed(1) + '°C\n'; });
      h += '</div>';
    } else if (ref.type === 'sensor_gap') {
      h += '<p style="font-size:12px;color:var(--text2);">传感器 ' + ref.sensorId + ' 数据缺口 ' + ref.count + ' 个时间点</p>';
      h += '<div class="raw-data-preview">传感器 ' + ref.sensorId + ' 在箱内温度与外部温度之间有 ' + ref.count + ' 个时间点不匹配，请检查传感器日志。</div>';
    } else if (ref.type === 'temp_spike') {
      h += '<p style="font-size:12px;color:var(--text2);">温度突变点：' + formatTs(ref.timestamp) + '</p>';
      h += '<p style="font-size:12px;color:var(--text2);">关联订单：' + (ref.orderId || '-') + '</p>';
      var targetObj = store.analysisObjects.find(function (o) { return o.orderId === ref.orderId; });
      if (targetObj) h += '<button class="btn btn-secondary btn-sm" onclick="App.openDetail(\'' + targetObj.id + '\')">查看订单详情</button>';
    }
    h += '</div>';
    h += '<button class="btn btn-secondary" onclick="App.openDetail(\'' + (store.selectedObjectId || '') + '\')">← 返回详情</button>';
    body.innerHTML = h;
  }

  function showImportModal() {
    var area = document.getElementById('importArea');
    var types = [
      { key: 'boxTemps', icon: '📦', label: '箱内温度', sub: 'CSV: timestamp,value,sensorId' },
      { key: 'externalTemps', icon: '🌡️', label: '外部温度', sub: 'CSV: timestamp,value,sensorId' },
      { key: 'openingRecords', icon: '📋', label: '开箱记录', sub: 'CSV: timestamp,duration,orderId' },
      { key: 'orders', icon: '🚚', label: '订单信息', sub: 'CSV/JSON: orderId,sensorId,startTime,endTime' },
      { key: 'sensorIds', icon: '📡', label: '传感器编号', sub: '每行一个编号' },
      { key: 'riskReports', icon: '⚠️', label: '风险报告', sub: 'JSON格式' }
    ];
    var h = '';
    types.forEach(function (t) {
      h += '<div class="import-card' + (store.importBuffers[t.key] ? ' loaded' : '') + '" onclick="App._triggerImport(\'' + t.key + '\')">';
      h += '<div class="icon">' + t.icon + '</div><div class="label">' + t.label + '</div><div class="sublabel">' + t.sub + '</div></div>';
    });
    area.innerHTML = h;
    document.getElementById('importModal').classList.add('show');
  }

  var _importType = null;
  function _triggerImport(type) {
    _importType = type;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,.json,.txt';
    inp.onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        store.importBuffers[_importType] = ev.target.result;
        showImportModal();
        toast('已加载: ' + f.name, 'success');
      };
      reader.readAsText(f);
    };
    inp.click();
  }

  function closeImportModal() { document.getElementById('importModal').classList.remove('show'); }

  function executeImport() {
    var b = store.importBuffers;
    var hasData = false;
    for (var k in b) if (b[k]) { hasData = true; break; }
    if (!hasData) { toast('请先选择要导入的数据', 'error'); return; }
    try {
      if (b.boxTemps) store.boxTemps = parseCSVTemps(b.boxTemps, true);
      if (b.externalTemps) store.externalTemps = parseCSVTemps(b.externalTemps, true);
      if (b.openingRecords) store.openingRecords = parseCSVOpenings(b.openingRecords);
      if (b.orders) store.orders = parseOrders(b.orders);
    } catch (err) { toast('解析失败: ' + err.message, 'error'); return; }
    store.analysisObjects = [];
    buildAnalysisObjects();
    updateHeaderStats();
    closeImportModal();
    renderAllViews();
    toast('数据导入成功', 'success');
  }

  function parseCSVTemps(csv, withSensor) {
    var lines = csv.trim().split('\n'); var r = [];
    for (var i = 1; i < lines.length; i++) {
      var c = lines[i].split(','); if (c.length < 2) continue;
      var item = { timestamp: new Date(c[0].trim()).getTime() || parseInt(c[0]), value: parseFloat(c[1]) };
      if (withSensor && c[2]) item.sensorId = c[2].trim();
      if (!isNaN(item.timestamp) && !isNaN(item.value)) r.push(item);
    }
    return r;
  }

  function parseCSVOpenings(csv) {
    var lines = csv.trim().split('\n'); var r = [];
    for (var i = 1; i < lines.length; i++) {
      var c = lines[i].split(','); if (c.length < 2) continue;
      var item = { timestamp: new Date(c[0].trim()).getTime() || parseInt(c[0]), duration: parseInt(c[1]) || 5 };
      if (c[2]) item.orderId = c[2].trim();
      if (!isNaN(item.timestamp)) r.push(item);
    }
    return r;
  }

  function parseOrders(data) {
    if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { /* fall through to CSV */ } }
    if (typeof data === 'string') {
      var lines = data.trim().split('\n'); var r = [];
      for (var i = 1; i < lines.length; i++) {
        var c = lines[i].split(',');
        r.push({ orderId: (c[0] || '').trim(), sensorId: (c[1] || '').trim(), customer: (c[4] || '').trim(), product: (c[5] || '').trim(), startTime: c[2] ? c[2].trim() : '', endTime: c[3] ? c[3].trim() : '' });
      }
      return r;
    }
    return data;
  }

  function loadDemoData() {
    var now = Date.now(); var H = 3600000; var M = 60000;
    var sensors = ['S-001', 'S-002', 'S-003', 'S-004', 'S-005'];
    var orders = [
      { orderId: 'ORD-2026-0501', sensorId: 'S-001', customer: '华联冷链', product: '冻品A', startTime: new Date(now - 24 * H).toISOString(), endTime: new Date(now - 2 * H).toISOString() },
      { orderId: 'ORD-2026-0502', sensorId: 'S-002', customer: '顺丰冷运', product: '生鲜B', startTime: new Date(now - 22 * H).toISOString(), endTime: new Date(now - 1 * H).toISOString() },
      { orderId: 'ORD-2026-0503', sensorId: 'S-003', customer: '京东冷链', product: '医药品C', startTime: new Date(now - 20 * H).toISOString(), endTime: new Date(now).toISOString() },
      { orderId: 'ORD-2026-0504', sensorId: 'S-004', customer: '中冷物流', product: '冻品D', startTime: new Date(now - 18 * H).toISOString(), endTime: new Date(now - 3 * H).toISOString() },
      { orderId: 'ORD-2026-0505', sensorId: 'S-005', customer: '鲜生活冷链', product: '生鲜E', startTime: new Date(now - 16 * H).toISOString(), endTime: new Date(now - 1 * H).toISOString() }
    ];
    store.orders = orders;
    store.boxTemps = []; store.externalTemps = []; store.openingRecords = [];
    sensors.forEach(function (sid, si) {
      var lagMin = 5 + si * 5;
      var baseBox = -18 + si * 0.5, baseExt = -20 + si * 1.5;
      var order = orders[si];
      var startTs = new Date(order.startTime).getTime();
      var endTs = new Date(order.endTime).getTime();
      for (var t = startTs; t <= endTs; t += 5 * M) {
        var idx = (t - startTs) / (5 * M);
        var noise = (Math.random() - 0.5) * 0.6;
        var dayCycle = Math.sin((idx / 288) * Math.PI * 2) * 1.2;
        store.externalTemps.push({ sensorId: sid, timestamp: t, value: parseFloat((baseExt + dayCycle + noise).toFixed(2)) });
        if ((si === 2 && idx > 100 && idx < 112) || (si === 4 && idx > 200 && idx < 210)) continue;
        var boxNoise = (Math.random() - 0.5) * 0.3;
        var unrecOpen = (si === 0 && Math.abs(idx - 60) < 1) ? 4 : (si === 4 && Math.abs(idx - 150) < 1) ? 3.5 : 0;
        store.boxTemps.push({ sensorId: sid, timestamp: t + lagMin * M + Math.round((Math.random() - 0.5) * 2 * M), value: parseFloat((baseBox + dayCycle * 0.6 + boxNoise + unrecOpen).toFixed(2)) });
      }
    });
    store.openingRecords = [
      { timestamp: now - 18 * H, duration: 8, orderId: 'ORD-2026-0501', operator: '张三' },
      { timestamp: now - 12 * H, duration: 12, orderId: 'ORD-2026-0502', operator: '李四' },
      { timestamp: now - 6 * H, duration: 5, orderId: 'ORD-2026-0504', operator: '王五' }
    ];
    store.analysisObjects = [];
    buildAnalysisObjects();
    updateHeaderStats();
    renderAllViews();
    toast('已加载演示数据（5 个订单，24 小时）', 'success');
  }

  function showConclusionModal(objId) { store.conclusionTargetId = objId; document.getElementById('conclusionModal').classList.add('show'); }
  function closeConclusionModal() { document.getElementById('conclusionModal').classList.remove('show'); store.conclusionTargetId = null; }

  function saveConclusion() {
    var objId = store.conclusionTargetId; if (!objId) return;
    var type = document.getElementById('conclusionType').value;
    var text = document.getElementById('conclusionText').value.trim();
    var author = document.getElementById('conclusionAuthor').value.trim() || '匿名';
    if (!text) { toast('请填写结论内容', 'error'); return; }
    var obj = store.analysisObjects.find(function (o) { return o.id === objId; });
    if (!obj) return;
    obj.conclusions.push({ type: type, text: text, author: author, timestamp: Date.now() });
    obj.status = type; obj.version++;
    closeConclusionModal();
    updateHeaderStats(); renderCurrentView();
    toast('结论已保存', 'success');
  }

  function executeExport(format, statuses) {
    var objs = store.analysisObjects;
    var filtered = statuses && statuses.length > 0 ? objs.filter(function (o) { return statuses.indexOf(o.status) !== -1; }) : objs;
    if (filtered.length === 0) { toast('无匹配数据', 'info'); return; }
    var blob, filename;
    if (format === 'csv') {
      var csv = '\uFEFF订单号,传感器,滞后估计(min),置信度,热传导系数,风险分数,风险等级,最大偏差(°C),异常数,状态,版本,算法版本\n';
      filtered.forEach(function (o) {
        csv += [o.orderId, o.sensorId, o.lagEstimate.toFixed(1), o.lagConfidence.toFixed(3), o.thermalCoefficient.toFixed(4), o.riskScore, riskLabel[o.riskLevel], o.maxTempDeviation.toFixed(2), o.anomalies.length, statusLabel[o.status], o.version, o.algoVersion].join(',') + '\n';
      });
      blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); filename = '冷链分析报告_' + formatTsShort(Date.now()).replace(/[ :]/g, '') + '.csv';
    } else {
      blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json;charset=utf-8' }); filename = '冷链分析报告_' + formatTsShort(Date.now()).replace(/[ :]/g, '') + '.json';
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    toast('已导出 ' + filtered.length + ' 条记录', 'success');
  }

  function renderDashboard() {
    var el = document.getElementById('view-dashboard');
    var objs = store.analysisObjects;
    if (objs.length === 0) { el.innerHTML = '<div class="empty-state"><div class="icon">📊</div><div class="title">暂无分析数据</div><div class="desc">请点击「导入数据」或「加载演示数据」开始</div></div>'; return; }
    var total = objs.length;
    var highR = objs.filter(function (o) { return o.riskLevel === 'high'; }).length;
    var medR = objs.filter(function (o) { return o.riskLevel === 'medium'; }).length;
    var lowR = objs.filter(function (o) { return o.riskLevel === 'low'; }).length;
    var avgLag = (objs.reduce(function (s, o) { return s + Math.abs(o.lagEstimate); }, 0) / total).toFixed(1);
    var totalAnom = objs.reduce(function (s, o) { return s + o.anomalies.length; }, 0);
    var p = objs.filter(function (o) { return o.status === 'processed'; }).length;
    var pe = objs.filter(function (o) { return o.status === 'pending'; }).length;
    var r = objs.filter(function (o) { return o.status === 'returned'; }).length;
    var pct = function (v) { return total ? (v / total * 100) : 0; };
    el.innerHTML = '<div class="summary-grid">' +
      '<div class="summary-card accent"><div class="value">' + total + '</div><div class="label">分析订单数</div></div>' +
      '<div class="summary-card red"><div class="value">' + highR + '</div><div class="label">高风险</div></div>' +
      '<div class="summary-card yellow"><div class="value">' + avgLag + ' min</div><div class="label">平均滞后</div></div>' +
      '<div class="summary-card green"><div class="value">' + totalAnom + '</div><div class="label">异常检出</div></div></div>' +
      '<div class="card"><div class="card-header"><div><div class="card-title">风险与状态分布</div><div class="card-subtitle">算法 ' + ALGO_VERSION + '</div></div></div><div style="display:flex;gap:20px;">' +
      '<div style="flex:1;"><div style="margin-bottom:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">高风险</span><span style="font-size:12px;font-weight:700;color:var(--red);">' + highR + '</span></div><div class="risk-bar"><div class="risk-bar-fill high" style="width:' + pct(highR) + '%;"></div></div>' +
      '<div style="margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">中风险</span><span style="font-size:12px;font-weight:700;color:var(--orange);">' + medR + '</span></div><div class="risk-bar"><div class="risk-bar-fill medium" style="width:' + pct(medR) + '%;"></div></div>' +
      '<div style="margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">低风险</span><span style="font-size:12px;font-weight:700;color:var(--green);">' + lowR + '</span></div><div class="risk-bar"><div class="risk-bar-fill low" style="width:' + pct(lowR) + '%;"></div></div></div>' +
      '<div style="flex:1;"><div style="margin-bottom:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">已处理</span><span style="font-size:12px;font-weight:700;color:var(--green);">' + p + '</span></div><div class="risk-bar"><div class="risk-bar-fill low" style="width:' + pct(p) + '%;"></div></div>' +
      '<div style="margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">待确认</span><span style="font-size:12px;font-weight:700;color:var(--yellow);">' + pe + '</span></div><div class="risk-bar"><div class="risk-bar-fill medium" style="width:' + pct(pe) + '%;background:var(--yellow);"></div></div>' +
      '<div style="margin-top:8px;display:flex;justify-content:space-between;"><span style="font-size:12px;color:var(--text2);">退回补材料</span><span style="font-size:12px;font-weight:700;color:var(--orange);">' + r + '</span></div><div class="risk-bar"><div class="risk-bar-fill high" style="width:' + pct(r) + '%;background:var(--orange);"></div></div></div></div></div>' +
      '<div class="card"><div class="card-header"><div><div class="card-title">订单概览 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div><button class="btn btn-secondary btn-sm" onclick="App.switchView(\'order\')">查看全部 →</button></div>' +
      '<div class="scroll-table-wrap"><table><thead><tr><th>订单号</th><th>传感器</th><th>滞后</th><th>风险</th><th>异常</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
      objs.slice(0, 10).map(function (o) { return '<tr><td style="font-weight:600;">' + o.orderId + '</td><td>' + o.sensorId + '</td><td>' + o.lagEstimate.toFixed(1) + ' min</td><td><span class="risk-tag ' + o.riskLevel + '">' + riskLabel[o.riskLevel] + ' ' + o.riskScore + '</span></td><td>' + o.anomalies.length + '</td><td><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></td><td><span class="link-ref" onclick="App.openDetail(\'' + o.id + '\')">详情</span></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  function renderOrderView() {
    var el = document.getElementById('view-order'); var objs = getFilteredObjects();
    if (objs.length === 0) { el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><div class="title">暂无订单数据</div></div>'; return; }
    el.innerHTML = '<div class="perspective-tabs"><button class="perspective-tab active">订单视角</button><button class="perspective-tab" onclick="App.switchView(\'sensor\')">传感器视角</button><button class="perspective-tab" onclick="App.switchView(\'timeline\')">时间线视角</button><button class="perspective-tab" onclick="App.switchView(\'risk\')">风险视角</button></div>' +
      renderStatusFilter() +
      '<div class="card"><div class="card-header"><div class="card-title">订单分析列表 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div>' +
      '<div class="scroll-table-wrap"><table><thead><tr><th>订单号</th><th>客户/产品</th><th>传感器</th><th>温度点(内/外)</th><th>滞后</th><th>热传导系数</th><th>最大偏差</th><th>风险</th><th>异常</th><th>状态</th><th>版本</th><th>操作</th></tr></thead><tbody>' +
      objs.map(function (o) { return '<tr><td style="font-weight:600;">' + o.orderId + '</td><td>' + (o.orderInfo.customer || '-') + '/' + (o.orderInfo.product || '-') + '</td><td>' + o.sensorId + '</td><td>' + o.boxTempCount + '/' + o.extTempCount + '</td><td>' + o.lagEstimate.toFixed(1) + ' min (' + (o.lagConfidence * 100).toFixed(0) + '%)</td><td>' + o.thermalCoefficient.toFixed(4) + '</td><td>' + o.maxTempDeviation.toFixed(1) + '°C</td><td><span class="risk-tag ' + o.riskLevel + '">' + riskLabel[o.riskLevel] + ' ' + o.riskScore + '</span></td><td>' + o.anomalies.length + '</td><td><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></td><td>v' + o.version + '</td><td><span class="link-ref" onclick="App.openDetail(\'' + o.id + '\')">详情</span></td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  function renderSensorView() {
    var el = document.getElementById('view-sensor'); var objs = getFilteredObjects();
    if (objs.length === 0) { el.innerHTML = '<div class="empty-state"><div class="icon">📡</div><div class="title">暂无传感器数据</div></div>'; return; }
    var groups = {}; objs.forEach(function (o) { if (!groups[o.sensorId]) groups[o.sensorId] = []; groups[o.sensorId].push(o); });
    var h = '<div class="perspective-tabs"><button class="perspective-tab" onclick="App.switchView(\'order\')">订单视角</button><button class="perspective-tab active">传感器视角</button><button class="perspective-tab" onclick="App.switchView(\'timeline\')">时间线视角</button><button class="perspective-tab" onclick="App.switchView(\'risk\')">风险视角</button></div>' + renderStatusFilter();
    Object.keys(groups).forEach(function (sid) {
      var g = groups[sid]; var avgL = (g.reduce(function (s, o) { return s + Math.abs(o.lagEstimate); }, 0) / g.length).toFixed(1);
      var maxR = Math.max.apply(null, g.map(function (o) { return o.riskScore; })); var rL = riskLevel(maxR);
      h += '<div style="background:var(--surface2);padding:10px 16px;border-radius:6px;margin:12px 0 8px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;"><span style="color:var(--cyan);">📡</span> 传感器 ' + sid + ' <span style="font-size:11px;color:var(--text2);">(' + g.length + ' 个订单)</span><span style="margin-left:auto;font-size:11px;">平均滞后: ' + avgL + ' min</span><span class="risk-tag ' + rL + '" style="margin-left:8px;">最高风险 ' + maxR + '</span></div>';
      h += '<div class="card" style="margin-bottom:12px;"><div class="scroll-table-wrap"><table><thead><tr><th>订单号</th><th>滞后</th><th>置信度</th><th>热传导系数</th><th>风险</th><th>异常</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      g.forEach(function (o) { h += '<tr><td style="font-weight:600;">' + o.orderId + '</td><td>' + o.lagEstimate.toFixed(1) + ' min</td><td>' + (o.lagConfidence * 100).toFixed(0) + '%</td><td>' + o.thermalCoefficient.toFixed(4) + '</td><td><span class="risk-tag ' + o.riskLevel + '">' + o.riskScore + '</span></td><td>' + o.anomalies.length + '</td><td><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></td><td><span class="link-ref" onclick="App.openDetail(\'' + o.id + '\')">详情</span></td></tr>'; });
      h += '</tbody></table></div></div>';
    });
    el.innerHTML = h;
  }

  function renderTimelineView() {
    var el = document.getElementById('view-timeline'); var objs = store.analysisObjects; var events = [];
    objs.forEach(function (o) {
      events.push({ timestamp: o.createdAt, type: 'analysis', label: '📌 分析创建', desc: '订单 ' + o.orderId + ' 滞后 ' + o.lagEstimate.toFixed(1) + ' min', objId: o.id });
      o.anomalies.forEach(function (a) {
        var icon = a.type === 'time_misalign' ? '⏱' : a.type === 'sensor_gap' ? '📡' : a.type === 'unrecorded_opening' ? '📦' : '⚠️';
        events.push({ timestamp: a.timestamp, type: a.type, label: icon + ' ' + a.label, desc: a.description, sourceRef: a.sourceRef, objId: o.id });
      });
      o.conclusions.forEach(function (c) { events.push({ timestamp: c.timestamp, type: 'conclusion', label: '✅ 处理结论', desc: c.text + ' — ' + c.author, objId: o.id }); });
    });
    events.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    var h = '<div class="perspective-tabs"><button class="perspective-tab" onclick="App.switchView(\'order\')">订单视角</button><button class="perspective-tab" onclick="App.switchView(\'sensor\')">传感器视角</button><button class="perspective-tab active">时间线视角</button><button class="perspective-tab" onclick="App.switchView(\'risk\')">风险视角</button></div>' + renderStatusFilter();
    h += '<div class="card"><div class="card-header"><div class="card-title">事件时间线 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div>';
    events.slice(0, 50).forEach(function (e) {
      h += '<div class="timeline-item"><div class="time-col">' + formatTsShort(e.timestamp) + '</div><div class="content-col"><div style="font-size:12px;">' + e.label + '</div><div style="font-size:12px;color:var(--text2);margin-top:2px;">' + e.desc + '</div>';
      if (e.sourceRef) h += '<span class="link-ref" onclick="App.navigateToSource(' + JSON.stringify(e.sourceRef).replace(/"/g, '&quot;') + ')">→ 溯源</span>';
      h += '</div></div>';
    });
    h += '</div>'; el.innerHTML = h;
  }

  function renderRiskView() {
    var el = document.getElementById('view-risk'); var objs = getFilteredObjects();
    var groups = { high: [], medium: [], low: [] }; objs.forEach(function (o) { if (groups[o.riskLevel]) groups[o.riskLevel].push(o); });
    var h = '<div class="perspective-tabs"><button class="perspective-tab" onclick="App.switchView(\'order\')">订单视角</button><button class="perspective-tab" onclick="App.switchView(\'sensor\')">传感器视角</button><button class="perspective-tab" onclick="App.switchView(\'timeline\')">时间线视角</button><button class="perspective-tab active">风险视角</button></div>' + renderStatusFilter();
    ['high', 'medium', 'low'].forEach(function (lv) {
      h += '<div class="card"><div class="card-header"><div class="card-title" style="color:var(--risk-' + lv + ');">' + riskLabel[lv] + '风险 (' + groups[lv].length + ')</div></div>';
      if (groups[lv].length === 0) { h += '<div style="padding:12px;color:var(--text2);font-size:12px;">暂无' + riskLabel[lv] + '风险订单</div>'; }
      else {
        h += '<div class="scroll-table-wrap"><table><thead><tr><th>订单号</th><th>传感器</th><th>滞后</th><th>最大偏差</th><th>异常</th><th>状态</th><th>操作</th></tr></thead><tbody>';
        groups[lv].forEach(function (o) { h += '<tr><td style="font-weight:600;">' + o.orderId + '</td><td>' + o.sensorId + '</td><td>' + o.lagEstimate.toFixed(1) + ' min</td><td>' + o.maxTempDeviation.toFixed(1) + '°C</td><td>' + o.anomalies.length + '</td><td><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></td><td><span class="link-ref" onclick="App.openDetail(\'' + o.id + '\')">详情</span></td></tr>'; });
        h += '</tbody></table></div>';
      }
      h += '</div>';
    });
    el.innerHTML = h;
  }

  function renderAnomaliesView() {
    var el = document.getElementById('view-anomalies'); var objs = store.analysisObjects; var all = [];
    objs.forEach(function (o) { o.anomalies.forEach(function (a) { all.push(Object.assign({}, a, { orderId: o.orderId, sensorId: o.sensorId, objId: o.id })); }); });
    all.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    var h = '<div class="card"><div class="card-header"><div class="card-title">异常溯源 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div>';
    if (all.length === 0) { h += '<div style="padding:20px;text-align:center;color:var(--text2);">暂无异常</div>'; }
    else all.forEach(function (a) {
      h += '<div class="anomaly-item ' + a.type + '"><span class="type-label">' + a.label + '</span><span class="desc">' + a.description + '<br><span style="color:var(--text2);">订单 ' + a.orderId + ' / 传感器 ' + a.sensorId + '</span></span>';
      if (a.sourceRef) h += '<span class="source-link" onclick="App.navigateToSource(' + JSON.stringify(a.sourceRef).replace(/"/g, '&quot;') + ')">→ 溯源</span>';
      h += '</div>';
    });
    h += '</div>'; el.innerHTML = h;
  }

  function renderVersionsView() {
    var el = document.getElementById('view-versions'); var objs = store.analysisObjects;
    var h = '<div class="card"><div class="card-header"><div class="card-title">版本与结论 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div>';
    if (objs.length === 0) { h += '<div style="padding:20px;text-align:center;color:var(--text2);">暂无数据</div>'; }
    else objs.forEach(function (o) {
      h += '<div class="detail-section"><div class="param-row"><div class="param-item"><span class="p-label">订单号</span><span class="p-value">' + o.orderId + '</span></div><div class="param-item"><span class="p-label">版本</span><span class="p-value">v' + o.version + '</span></div><div class="param-item"><span class="p-label">状态</span><span class="p-value"><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></span></div></div>';
      h += '<div class="version-timeline">';
      if (o.conclusions.length > 0) o.conclusions.forEach(function (c, i) {
        h += '<div class="version-node' + (i === o.conclusions.length - 1 ? ' current' : '') + '"><div class="v-label">' + statusLabel[c.type] + '</div><div class="v-time">' + formatTs(c.timestamp) + '</div><div class="v-desc">' + c.text + ' — ' + (c.author || '') + '</div></div>';
      }); else h += '<div style="padding:8px 0;color:var(--text2);font-size:12px;">暂无结论</div>';
      h += '</div><button class="btn btn-primary btn-sm" onclick="App.showConclusionModal(\'' + o.id + '\')">添加结论</button></div>';
    });
    h += '</div>'; el.innerHTML = h;
  }

  function renderExportView() {
    var el = document.getElementById('view-export'); var objs = store.analysisObjects;
    var h = '<div class="card"><div class="card-header"><div class="card-title">报告导出 <span class="algo-badge">' + ALGO_VERSION + '</span></div></div>';
    h += '<div class="detail-section"><div class="card-subtitle" style="margin-bottom:8px;">导出格式</div><div class="export-format-row"><span class="format-option selected" onclick="App._selFormat(this,\'csv\')">CSV</span><span class="format-option" onclick="App._selFormat(this,\'json\')">JSON</span></div></div>';
    h += '<div class="detail-section"><div class="card-subtitle" style="margin-bottom:8px;">状态筛选（导出哪些状态的订单）</div><div class="export-format-row"><label class="filter-chip f-processed active"><input type="checkbox" class="export-status-cb" value="processed" checked style="margin-right:4px;">已处理</label><label class="filter-chip f-pending active"><input type="checkbox" class="export-status-cb" value="pending" checked style="margin-right:4px;">待确认</label><label class="filter-chip f-returned active"><input type="checkbox" class="export-status-cb" value="returned" checked style="margin-right:4px;">退回补材料</label></div></div>';
    h += '<div class="detail-section"><div class="card-subtitle" style="margin-bottom:8px;">预览（前 20 条）</div><div class="scroll-table-wrap"><table><thead><tr><th>订单号</th><th>传感器</th><th>滞后</th><th>风险</th><th>偏差</th><th>异常</th><th>状态</th></tr></thead><tbody>';
    objs.slice(0, 20).forEach(function (o) { h += '<tr><td>' + o.orderId + '</td><td>' + o.sensorId + '</td><td>' + o.lagEstimate.toFixed(1) + ' min</td><td><span class="risk-tag ' + o.riskLevel + '">' + o.riskScore + '</span></td><td>' + o.maxTempDeviation.toFixed(1) + '°C</td><td>' + o.anomalies.length + '</td><td><span class="status-tag ' + o.status + '">' + statusLabel[o.status] + '</span></td></tr>'; });
    if (objs.length > 20) h += '<tr><td colspan="7" style="text-align:center;color:var(--text2);">... 共 ' + objs.length + ' 条</td></tr>';
    h += '</tbody></table></div></div>';
    h += '<button class="btn btn-primary" onclick="App._doExport()">导出数据</button></div>';
    el.innerHTML = h;
  }

  var _exportFormat = 'csv';
  function _selFormat(el, fmt) {
    _exportFormat = fmt;
    el.parentElement.querySelectorAll('.format-option').forEach(function (e) { e.classList.remove('selected'); });
    el.classList.add('selected');
  }

  function _doExport() {
    var statuses = [];
    document.querySelectorAll('.export-status-cb').forEach(function (cb) { if (cb.checked) statuses.push(cb.value); });
    executeExport(_exportFormat, statuses);
  }

  function init() {
    updateHeaderStats();
    renderDashboard();
  }

  return {
    store: store, ALGO_VERSION: ALGO_VERSION, statusLabel: statusLabel, riskLabel: riskLabel,
    formatTs: formatTs, formatTsShort: formatTsShort, toast: toast,
    getFilteredObjects: getFilteredObjects, renderStatusFilter: renderStatusFilter,
    drawTempChart: drawTempChart, buildAnalysisObjects: buildAnalysisObjects,
    updateHeaderStats: updateHeaderStats, renderCurrentView: renderCurrentView, renderAllViews: renderAllViews,
    switchView: switchView, setStatusFilter: setStatusFilter,
    openDetail: openDetail, closeDrawer: closeDrawer, navigateToSource: navigateToSource,
    showImportModal: showImportModal, closeImportModal: closeImportModal, executeImport: executeImport,
    loadDemoData: loadDemoData, _triggerImport: _triggerImport,
    showConclusionModal: showConclusionModal, closeConclusionModal: closeConclusionModal, saveConclusion: saveConclusion,
    executeExport: executeExport, showExportPanel: function () { switchView('export'); },
    _selFormat: _selFormat, _doExport: _doExport,
    init: init
  };
})();

window.addEventListener('DOMContentLoaded', function () { App.init(); });
