(function () {
    'use strict';

    var dataStore = [];
    var charts = {};

    var THRESHOLDS = {
        irradiance: { max: 1200, unit: 'W/m\u00b2', label: '\u592a\u9633\u8f90\u7167\u5ea6' },
        batteryTemp: { max: 45, unit: '\u00b0C', label: '\u7535\u6c60\u6e29\u5ea6' },
        waveHeight: { max: 2, unit: 'm', label: '\u6d6a\u9ad8' },
        windSpeed: { max: 15, unit: 'm/s', label: '\u98ce\u901f' }
    };

    var EXTREME_MULTIPLIER = 2.0;

    function genId() {
        return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    function nowISO() { return new Date().toISOString(); }

    function fmtTime(iso) {
        if (!iso) return '--';
        var d = new Date(iso);
        var pad = function (n) { return n < 10 ? '0' + n : n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function parseNumberWithUnit(raw) {
        if (raw === null || raw === undefined || String(raw).trim() === '') return null;
        var s = String(raw).trim().replace(/,/g, '');
        var numMatch = s.match(/([-+]?[\d.]+(?:[eE][-+]?\d+)?)/);
        if (!numMatch) return null;
        var val = parseFloat(numMatch[1]);
        if (isNaN(val)) return null;
        var unit = s.replace(numMatch[1], '').trim().toLowerCase();
        return { value: val, unit: unit };
    }

    var unitConverters = {
        irradiance: function (p) {
            if (!p) return null;
            return p.unit.indexOf('kw') >= 0 ? p.value * 1000 : p.value;
        },
        panelArea: function (p) { return p ? p.value : null; },
        panelEfficiency: function (p) {
            if (!p) return null;
            return (p.unit.indexOf('%') >= 0 || p.value > 1) ? p.value / 100 : p.value;
        },
        batteryCapacity: function (p) {
            if (!p) return null;
            if (p.unit.indexOf('ah') >= 0) {
                var vm = p.unit.match(/(\d+)\s*v/);
                return p.value * (vm ? parseFloat(vm[1]) : 48) / 1000;
            }
            if (p.unit.indexOf('wh') >= 0) return p.value / 1000;
            return p.value;
        },
        batteryTemp: function (p) {
            if (!p) return null;
            return p.unit.indexOf('f') >= 0 ? (p.value - 32) * 5 / 9 : p.value;
        },
        motorPower: function (p) {
            if (!p) return null;
            return (p.unit.indexOf('w') >= 0 && p.unit.indexOf('kw') < 0) ? p.value / 1000 : p.value;
        },
        boatSpeed: function (p) {
            if (!p) return null;
            if (p.unit.indexOf('kn') >= 0 || p.unit.indexOf('knot') >= 0) return p.value * 1.852;
            if (p.unit.indexOf('mph') >= 0) return p.value * 1.60934;
            return p.value;
        },
        windSpeed: function (p) {
            if (!p) return null;
            if (p.unit.indexOf('km') >= 0) return p.value / 3.6;
            if (p.unit.indexOf('kn') >= 0 || p.unit.indexOf('knot') >= 0) return p.value * 0.514444;
            return p.value;
        },
        waveHeight: function (p) { return p ? p.value : null; },
        waterTemp: function (p) {
            if (!p) return null;
            return p.unit.indexOf('f') >= 0 ? (p.value - 32) * 5 / 9 : p.value;
        }
    };

    function convertField(field, rawValue) {
        var parsed = parseNumberWithUnit(rawValue);
        if (!parsed) return null;
        var conv = unitConverters[field];
        return conv ? conv(parsed) : parsed.value;
    }

    function calcSolarPower(irradiance, area, efficiency, lossFactor) {
        lossFactor = lossFactor || 0.85;
        return (irradiance * area * efficiency * lossFactor) / 1000;
    }

    function calcRange(solarPowerKw, batteryKWh, motorPowerKw, speedKmh, sunHours) {
        sunHours = sunHours || 6;
        if (motorPowerKw <= 0 || speedKmh <= 0) return 0;
        var totalEnergy = solarPowerKw * sunHours + batteryKWh;
        return (totalEnergy / motorPowerKw) * speedKmh;
    }

    function isExtreme(values, value) {
        if (!values || values.length < 3) return false;
        var sorted = values.filter(function (v) { return v !== null && v !== undefined; }).slice().sort(function (a, b) { return a - b; });
        if (sorted.length < 3) return false;
        var q1 = sorted[Math.floor(sorted.length * 0.25)];
        var q3 = sorted[Math.floor(sorted.length * 0.75)];
        var iqr = q3 - q1;
        return value > q3 + EXTREME_MULTIPLIER * iqr || value < q1 - EXTREME_MULTIPLIER * iqr;
    }

    function checkThresholds(rec) {
        var violations = [];
        Object.keys(THRESHOLDS).forEach(function (k) {
            if (rec[k] !== null && rec[k] !== undefined && rec[k] > THRESHOLDS[k].max) {
                violations.push({ field: k, label: THRESHOLDS[k].label, value: rec[k], threshold: THRESHOLDS[k].max, unit: THRESHOLDS[k].unit });
            }
        });
        return violations;
    }

    function detectGaps(records) {
        if (records.length < 2) return [];
        var sorted = records.slice().sort(function (a, b) { return new Date(a.sampleTime) - new Date(b.sampleTime); });
        var gaps = [];
        for (var i = 1; i < sorted.length; i++) {
            var diffMin = (new Date(sorted[i].sampleTime) - new Date(sorted[i - 1].sampleTime)) / 60000;
            if (diffMin > 120) {
                gaps.push({ from: sorted[i - 1].sampleTime, to: sorted[i].sampleTime, gapMinutes: Math.round(diffMin), fromId: sorted[i - 1].id, toId: sorted[i].id });
            }
        }
        return gaps;
    }

    function detectConflicts(records) {
        var conflicts = [];
        var photoRecs = records.filter(function (r) { return r.dataSource === '\u73b0\u573a\u7167\u7247' && r.photoNote; });
        var otherRecs = records.filter(function (r) { return r.dataSource !== '\u73b0\u573a\u7167\u7247'; });

        photoRecs.forEach(function (photo) {
            otherRecs.forEach(function (other) {
                if (Math.abs(new Date(photo.sampleTime) - new Date(other.sampleTime)) > 1800000) return;
                var pp = parseNumberWithUnit(photo.photoNote);
                if (!pp) return;
                var fields = ['irradiance', 'batteryTemp', 'motorPower', 'boatSpeed', 'windSpeed'];
                fields.forEach(function (f) {
                    if (other[f] !== null && other[f] !== undefined) {
                        var ratio = Math.abs(pp.value - other[f]) / Math.max(Math.abs(other[f]), 0.01);
                        if (ratio > 0.15) {
                            conflicts.push({ photoRecord: photo, dataRecord: other, field: f, photoValue: pp.value, dataValue: other[f] });
                        }
                    }
                });
            });
        });

        var manualRecs = records.filter(function (r) { return r.dataSource === '\u4eba\u5de5\u5907\u6ce8' && r.remarks; });
        manualRecs.forEach(function (manual) {
            records.forEach(function (other) {
                if (other.id === manual.id) return;
                if (Math.abs(new Date(manual.sampleTime) - new Date(other.sampleTime)) > 1800000) return;
                if (manual.remarks && other.remarks && manual.remarks !== other.remarks) {
                    var dup = conflicts.some(function (c) {
                        return c.photoRecord && ((c.photoRecord.id === manual.id && c.dataRecord.id === other.id) || (c.photoRecord.id === other.id && c.dataRecord.id === manual.id));
                    });
                    if (!dup) {
                        conflicts.push({ manualRecord: manual, dataRecord: other, field: 'remarks', manualValue: manual.remarks, dataValue: other.remarks, isRemark: true });
                    }
                }
            });
        });
        return conflicts;
    }

    function addRecord(raw) {
        var rec = {
            id: genId(),
            dataSource: raw.dataSource,
            sampleTime: raw.sampleTime,
            processingTime: nowISO(),
            originalRaw: {},
            irradiance: convertField('irradiance', raw.irradiance),
            panelArea: convertField('panelArea', raw.panelArea),
            panelEfficiency: convertField('panelEfficiency', raw.panelEfficiency),
            batteryCapacity: convertField('batteryCapacity', raw.batteryCapacity),
            batteryTemp: convertField('batteryTemp', raw.batteryTemp),
            motorPower: convertField('motorPower', raw.motorPower),
            boatSpeed: convertField('boatSpeed', raw.boatSpeed),
            windSpeed: convertField('windSpeed', raw.windSpeed),
            waveHeight: convertField('waveHeight', raw.waveHeight),
            waterTemp: convertField('waterTemp', raw.waterTemp),
            remarks: raw.remarks || '',
            photoNote: raw.photoNote || ''
        };
        Object.keys(raw).forEach(function (k) { if (raw[k]) rec.originalRaw[k] = raw[k]; });

        rec.thresholdViolations = checkThresholds(rec);

        var fieldVals = {};
        dataStore.forEach(function (r) {
            Object.keys(THRESHOLDS).forEach(function (k) {
                if (r[k] !== null && r[k] !== undefined) {
                    if (!fieldVals[k]) fieldVals[k] = [];
                    fieldVals[k].push(r[k]);
                }
            });
        });
        rec.extremeFields = {};
        Object.keys(THRESHOLDS).forEach(function (k) {
            if (rec[k] !== null && rec[k] !== undefined && fieldVals[k] && isExtreme(fieldVals[k], rec[k])) {
                rec.extremeFields[k] = rec[k];
            }
        });

        dataStore.push(rec);
        return rec;
    }

    function getLatest() { return dataStore.length ? dataStore[dataStore.length - 1] : null; }

    function renderRecentEntries() {
        var el = document.getElementById('recentEntries');
        if (!dataStore.length) { el.innerHTML = '<p class="empty-hint">\u6682\u65e0\u6570\u636e\uff0c\u8bf7\u5f55\u5165\u6216\u52a0\u8f7d\u6f14\u793a\u6570\u636e</p>'; return; }
        var html = '';
        dataStore.slice().reverse().slice(0, 20).forEach(function (r) {
            var sc = r.dataSource === '\u73b0\u573a\u7167\u7247' ? 'source-photo' : r.dataSource === '\u5bfc\u5165\u6570\u636e' ? 'source-import' : r.dataSource === '\u4eba\u5de5\u5907\u6ce8' ? 'source-manual' : 'source-device';
            var ec = 'recent-entry';
            if (Object.keys(r.extremeFields).length) ec += ' entry-extreme';
            if (r.thresholdViolations.length) ec += ' entry-threshold';
            var parts = [];
            if (r.irradiance !== null) parts.push('\u8f90\u7167 ' + r.irradiance.toFixed(0) + ' W/m\u00b2');
            if (r.batteryCapacity !== null) parts.push('\u7535\u6c60 ' + r.batteryCapacity.toFixed(1) + ' kWh');
            if (r.motorPower !== null) parts.push('\u7535\u673a ' + r.motorPower.toFixed(1) + ' kW');
            if (r.boatSpeed !== null) parts.push('\u822a\u901f ' + r.boatSpeed.toFixed(1) + ' km/h');
            html += '<div class="' + ec + '"><div class="entry-header"><span class="entry-source ' + sc + '">' + r.dataSource + '</span><span class="entry-time">' + fmtTime(r.sampleTime) + '</span></div><div class="entry-data">' + parts.join(' | ') + '</div>';
            r.thresholdViolations.forEach(function (v) {
                html += '<div style="color:var(--danger);font-size:12px;margin-top:2px">\u26a0 ' + v.label + ' ' + v.value.toFixed(1) + v.unit + ' \u8d85\u8fc7\u5b89\u5168\u9608\u503c ' + v.threshold + v.unit + '</div>';
            });
            Object.keys(r.extremeFields).forEach(function (k) {
                html += '<div style="color:var(--extreme);font-size:12px;margin-top:2px">\ud83d\udd0d ' + THRESHOLDS[k].label + ' ' + r.extremeFields[k].toFixed(1) + ' \u4e3a\u6781\u7aef\u503c</div>';
            });
            if (r.photoNote) html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">\ud83d\udcf7 \u7167\u7247\u5907\u6ce8: ' + r.photoNote + '</div>';
            html += '<div style="font-size:10px;color:#a0aec0;margin-top:2px"><span class="trace-tag trace-source">' + r.dataSource + '</span><span class="trace-tag trace-time">' + fmtTime(r.processingTime) + ' \u5904\u7406</span></div></div>';
        });
        el.innerHTML = html;
    }

    function renderConflicts() {
        var el = document.getElementById('conflictList');
        var conflicts = detectConflicts(dataStore);
        if (!conflicts.length) { el.innerHTML = '<p class="empty-hint">\u6682\u65e0\u5f02\u5e38</p>'; return; }
        var html = '';
        conflicts.forEach(function (c) {
            if (c.isRemark) {
                html += '<div class="conflict-item"><div class="conflict-title">\u26a0 \u5907\u6ce8\u51b2\u7a81</div><div class="conflict-evidence"><div class="evidence-box evidence-photo"><div class="evidence-label">\u4eba\u5de5\u5907\u6ce8</div>' + c.manualValue + '</div><div class="evidence-box evidence-import"><div class="evidence-label">\u5176\u4ed6\u6765\u6e90</div>' + c.dataValue + '</div></div><div class="conflict-suggestion">\ud83d\udca1 \u4e24\u6761\u5907\u6ce8\u5185\u5bb9\u4e0d\u4e00\u81f4\uff0c\u5efa\u8bae\u6838\u5bf9\u539f\u59cb\u8bb0\u5f55\u518d\u786e\u8ba4\u4ee5\u54ea\u6761\u4e3a\u51c6</div></div>';
            } else {
                var fl = THRESHOLDS[c.field] ? THRESHOLDS[c.field].label : c.field;
                html += '<div class="conflict-item"><div class="conflict-title">\u26a0 \u6570\u636e\u51b2\u7a81: ' + fl + '</div><div class="conflict-evidence"><div class="evidence-box evidence-photo"><div class="evidence-label">\ud83d\udcf7 \u73b0\u573a\u7167\u7247</div>' + c.photoValue + '</div><div class="evidence-box evidence-import"><div class="evidence-label">\ud83d\udccb \u5bfc\u5165\u6570\u636e</div>' + c.dataValue + '</div></div><div class="conflict-suggestion">\ud83d\udca1 \u7167\u7247\u548c\u5bfc\u5165\u6570\u636e\u5bf9\u4e0d\u4e0a\uff0c\u5efa\u8bae\u56de\u770b\u539f\u59cb\u7167\u7247\u786e\u8ba4\u8bfb\u6570\uff0c\u518d\u51b3\u5b9a\u4ee5\u54ea\u8fb9\u4e3a\u51c6</div></div>';
            }
        });
        el.innerHTML = html;
    }

    function updateDashboard() {
        var latest = getLatest();
        var dI = document.getElementById('dashIrradiance');
        var dSP = document.getElementById('dashSolarPower');
        var dB = document.getElementById('dashBattery');
        var dR = document.getElementById('dashRange');
        var dS = document.getElementById('dashSafety');
        var aC = document.getElementById('alertCard');
        var dA = document.getElementById('dashAlerts');

        if (!latest) {
            dI.textContent = '--'; dSP.textContent = '--'; dB.textContent = '--'; dR.textContent = '--';
            dS.textContent = '\u65e0\u6570\u636e'; aC.className = 'card metric-card alert-card'; dA.innerHTML = ''; return;
        }

        if (latest.irradiance !== null) dI.textContent = latest.irradiance.toFixed(0);
        if (latest.irradiance !== null && latest.panelArea !== null && latest.panelEfficiency !== null) {
            dSP.textContent = calcSolarPower(latest.irradiance, latest.panelArea, latest.panelEfficiency).toFixed(2);
        }
        if (latest.batteryCapacity !== null) dB.textContent = latest.batteryCapacity.toFixed(1);

        if (latest.irradiance !== null && latest.panelArea !== null && latest.panelEfficiency !== null && latest.motorPower !== null && latest.boatSpeed !== null) {
            var sp = calcSolarPower(latest.irradiance, latest.panelArea, latest.panelEfficiency);
            var rng = calcRange(sp, latest.batteryCapacity || 0, latest.motorPower, latest.boatSpeed);
            dR.textContent = rng.toFixed(1);
        }

        var allViolations = [];
        dataStore.forEach(function (r) { allViolations = allViolations.concat(r.thresholdViolations); });
        var latestViolations = latest.thresholdViolations;

        if (latestViolations.length > 0) {
            dS.textContent = '\u26a0 \u6709\u8d85\u9608';
            aC.className = 'card metric-card alert-card has-alert';
            var alertHtml = '';
            latestViolations.forEach(function (v) {
                alertHtml += '<div class="alert-item">\u26a0 ' + v.label + ' ' + v.value.toFixed(1) + v.unit + ' (\u9608\u503c ' + v.threshold + v.unit + ')</div>';
            });
            dA.innerHTML = alertHtml;
        } else {
            var warnings = [];
            Object.keys(THRESHOLDS).forEach(function (k) {
                if (latest[k] !== null && latest[k] !== undefined) {
                    var ratio = latest[k] / THRESHOLDS[k].max;
                    if (ratio > 0.8 && ratio <= 1) {
                        warnings.push(THRESHOLDS[k].label + ' ' + latest[k].toFixed(1) + ' \u63a5\u8fd1\u9608\u503c');
                    }
                }
            });
            if (warnings.length) {
                dS.textContent = '\u63a5\u8fd1\u9608\u503c';
                aC.className = 'card metric-card alert-card has-warning';
                var whtml = '';
                warnings.forEach(function (w) { whtml += '<div class="alert-item warning">\u26a0 ' + w + '</div>'; });
                dA.innerHTML = whtml;
            } else {
                dS.textContent = '\u6b63\u5e38';
                aC.className = 'card metric-card alert-card';
                dA.innerHTML = '';
            }
        }

        renderTrendChart();
        renderThresholdChart();
        renderExtremeValues();
        renderGapDetection();
    }

    function renderTrendChart() {
        var ctx = document.getElementById('trendChart');
        if (!ctx) return;
        if (charts.trend) charts.trend.destroy();

        var sorted = dataStore.slice().sort(function (a, b) { return new Date(a.sampleTime) - new Date(b.sampleTime); });
        var labels = sorted.map(function (r) { return fmtTime(r.sampleTime); });
        var irrData = sorted.map(function (r) { return r.irradiance; });
        var spdData = sorted.map(function (r) { return r.boatSpeed; });

        charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '\u8f90\u7167\u5ea6 (W/m\u00b2)', data: irrData, borderColor: '#e53e3e', backgroundColor: 'rgba(229,62,62,0.1)', yAxisID: 'y', tension: 0.3, fill: false },
                    { label: '\u822a\u901f (km/h)', data: spdData, borderColor: '#3182ce', backgroundColor: 'rgba(49,130,206,0.1)', yAxisID: 'y1', tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { type: 'linear', position: 'left', title: { display: true, text: 'W/m\u00b2' } },
                    y1: { type: 'linear', position: 'right', title: { display: true, text: 'km/h' }, grid: { drawOnChartArea: false } }
                },
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    function renderThresholdChart() {
        var ctx = document.getElementById('thresholdChart');
        if (!ctx) return;
        if (charts.threshold) charts.threshold.destroy();

        var latest = getLatest();
        if (!latest) return;

        var fields = Object.keys(THRESHOLDS);
        var labels = fields.map(function (k) { return THRESHOLDS[k].label; });
        var values = fields.map(function (k) { return latest[k] !== null && latest[k] !== undefined ? (latest[k] / THRESHOLDS[k].max * 100) : 0; });
        var bgColors = fields.map(function (k, i) {
            var v = values[i];
            if (v > 100) return 'rgba(197,48,48,0.7)';
            if (v > 80) return 'rgba(192,86,33,0.7)';
            return 'rgba(39,103,73,0.7)';
        });

        charts.threshold = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: '\u5f53\u524d\u503c/\u9608\u503c (%)', data: values, backgroundColor: bgColors },
                    { label: '\u5b89\u5168\u9608\u503c\u7ebf', data: fields.map(function () { return 100; }), type: 'line', borderColor: '#c53030', borderDash: [5, 5], pointRadius: 0, fill: false }
                ]
            },
            options: {
                responsive: true,
                scales: { y: { title: { display: true, text: '% \u9608\u503c' }, min: 0, max: 150 } },
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    function renderExtremeValues() {
        var el = document.getElementById('extremeValues');
        var html = '';
        dataStore.forEach(function (r) {
            Object.keys(r.extremeFields).forEach(function (k) {
                var label = THRESHOLDS[k] ? THRESHOLDS[k].label : k;
                html += '<div class="extreme-item"><span class="extreme-field">' + label + '</span>: <span class="extreme-val">' + r.extremeFields[k].toFixed(1) + (THRESHOLDS[k] ? THRESHOLDS[k].unit : '') + '</span><div class="extreme-source">\u6765\u6e90: ' + r.dataSource + ' | ' + fmtTime(r.sampleTime) + ' | ' + fmtTime(r.processingTime) + ' \u5904\u7406</div></div>';
            });
        });
        el.innerHTML = html || '<p class="empty-hint">\u6682\u65e0\u6781\u7aef\u503c</p>';
    }

    function renderGapDetection() {
        var el = document.getElementById('gapDetection');
        var gaps = detectGaps(dataStore);
        if (!gaps.length) { el.innerHTML = dataStore.length ? '<p style="color:var(--success);font-size:13px">\u2713 \u91c7\u6837\u95f4\u9694\u6b63\u5e38\uff0c\u672a\u53d1\u73b0\u7f3a\u53e3</p>' : '<p class="empty-hint">\u6682\u65e0\u6570\u636e</p>'; return; }
        var html = '';
        gaps.forEach(function (g) {
            html += '<div class="gap-item">\u26a0 ' + fmtTime(g.from) + ' \u2192 ' + fmtTime(g.to) + ' \u7f3a\u53e3 ' + g.gapMinutes + ' \u5206\u949f</div>';
        });
        el.innerHTML = html;
    }

    window.runEstimation = function () {
        var irr = parseFloat(document.getElementById('estIrradiance').value);
        var area = parseFloat(document.getElementById('estArea').value);
        var eff = parseFloat(document.getElementById('estEfficiency').value) / 100;
        var bat = parseFloat(document.getElementById('estBattery').value);
        var motor = parseFloat(document.getElementById('estMotor').value);
        var speed = parseFloat(document.getElementById('estSpeed').value);
        var sunH = parseFloat(document.getElementById('estSunHours').value);
        var loss = parseFloat(document.getElementById('estLossFactor').value);

        if ([irr, area, eff, bat, motor, speed, sunH, loss].some(isNaN)) {
            alert('\u8bf7\u586b\u5b8c\u6240\u6709\u53c2\u6570'); return;
        }

        var solarPower = calcSolarPower(irr, area, eff, loss);
        var pureBatRange = bat > 0 && motor > 0 && speed > 0 ? (bat / motor) * speed : 0;
        var totalRange = calcRange(solarPower, bat, motor, speed, sunH);
        var enduranceH = motor > 0 ? (solarPower * sunH + bat) / motor : 0;
        var energyBalance = solarPower * sunH - motor * speed / speed * enduranceH;
        var dailySolarEnergy = solarPower * sunH;

        var el = document.getElementById('estResults');
        var statusClass = 'success';
        var statusText = '\u6b63\u5e38';
        if (totalRange < 20) { statusClass = 'danger'; statusText = '\u7eed\u822a\u4e0d\u8db3'; }
        else if (totalRange < 50) { statusClass = 'warning'; statusText = '\u7eed\u822a\u504f\u77ed'; }

        var notes = [];
        if (solarPower < motor) notes.push('\u592a\u9633\u80fd\u53d1\u7535\u529f\u7387 (' + solarPower.toFixed(2) + ' kW) \u4f4e\u4e8e\u7535\u673a\u529f\u7387 (' + motor + ' kW)\uff0c\u822a\u884c\u4f1a\u6d88\u8017\u7535\u6c60\u50a8\u80fd');
        if (eff < 0.15) notes.push('\u9762\u677f\u6548\u7387\u504f\u4f4e\uff0c\u5efa\u8bae\u6e05\u6d01\u9762\u677f\u6216\u68c0\u67e5\u8001\u5316\u60c5\u51b5');
        if (loss < 0.8) notes.push('\u7cfb\u7edf\u635f\u8017\u7cfb\u6570\u504f\u4f4e\uff0c\u53ef\u80fd\u6709\u7ebf\u7f06\u53d1\u70ed\u6216\u8f6c\u6362\u5668\u635f\u8017\uff0c\u5efa\u8bae\u68c0\u67e5');

        el.innerHTML =
            '<div class="est-result-item"><span class="est-result-label">\u592a\u9633\u80fd\u53d1\u7535\u529f\u7387</span><span class="est-result-value">' + solarPower.toFixed(2) + ' kW</span></div>' +
            '<div class="est-result-item"><span class="est-result-label">\u65e5\u5747\u592a\u9633\u80fd\u53d1\u7535\u91cf</span><span class="est-result-value">' + dailySolarEnergy.toFixed(1) + ' kWh</span></div>' +
            '<div class="est-result-item"><span class="est-result-label">\u7eaf\u7535\u6c60\u7eed\u822a\u91cc\u7a0b</span><span class="est-result-value">' + pureBatRange.toFixed(1) + ' km</span></div>' +
            '<div class="est-result-item"><span class="est-result-label">\u7efc\u5408\u7eed\u822a\u91cc\u7a0b\uff08\u592a\u9633\u80fd+\u7535\u6c60\uff09</span><span class="est-result-value ' + statusClass + '">' + totalRange.toFixed(1) + ' km</span></div>' +
            '<div class="est-result-item"><span class="est-result-label">\u7eed\u822a\u65f6\u95f4</span><span class="est-result-value">' + enduranceH.toFixed(1) + ' h</span></div>' +
            '<div class="est-result-item"><span class="est-result-label">\u5b89\u5168\u72b6\u6001</span><span class="est-result-value ' + statusClass + '">' + statusText + '</span></div>' +
            (notes.length ? '<div class="est-note">\ud83d\udca1 \u63d0\u793a\uff1a<br>' + notes.join('<br>') + '</div>' : '');

        renderRangeSpeedChart(irr, area, eff, bat, sunH, loss);
    };

    function renderRangeSpeedChart(irr, area, eff, bat, sunH, loss) {
        var ctx = document.getElementById('rangeSpeedChart');
        if (!ctx) return;
        if (charts.rangeSpeed) charts.rangeSpeed.destroy();

        var speeds = [];
        var ranges = [];
        for (var v = 2; v <= 20; v += 0.5) {
            speeds.push(v);
            var sp = calcSolarPower(irr, area, eff, loss);
            var powerAtSpeed = sp * v / 8;
            var rng = calcRange(sp, bat, Math.max(powerAtSpeed, 0.5), v, sunH);
            ranges.push(rng);
        }

        charts.rangeSpeed = new Chart(ctx, {
            type: 'line',
            data: {
                labels: speeds.map(function (v) { return v.toFixed(1); }),
                datasets: [{
                    label: '\u7eed\u822a\u91cc\u7a0b (km)',
                    data: ranges,
                    borderColor: '#2b6cb0',
                    backgroundColor: 'rgba(43,108,176,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: '\u822a\u901f (km/h)' } },
                    y: { title: { display: true, text: '\u7eed\u822a km' }, min: 0 }
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            title: function (items) { return '\u822a\u901f: ' + items[0].label + ' km/h'; },
                            label: function (item) { return '\u7eed\u822a: ' + item.raw.toFixed(1) + ' km'; }
                        }
                    }
                }
            }
        });
    }

    window.fillFromLatest = function () {
        var latest = getLatest();
        if (!latest) { alert('\u6682\u65e0\u6570\u636e'); return; }
        if (latest.irradiance !== null) document.getElementById('estIrradiance').value = latest.irradiance.toFixed(0);
        if (latest.panelArea !== null) document.getElementById('estArea').value = latest.panelArea;
        if (latest.panelEfficiency !== null) document.getElementById('estEfficiency').value = (latest.panelEfficiency * 100).toFixed(1);
        if (latest.batteryCapacity !== null) document.getElementById('estBattery').value = latest.batteryCapacity;
        if (latest.motorPower !== null) document.getElementById('estMotor').value = latest.motorPower;
        if (latest.boatSpeed !== null) document.getElementById('estSpeed').value = latest.boatSpeed.toFixed(1);
    };

    window.generateReport = function () {
        document.getElementById('reportTime').textContent = fmtTime(nowISO());
        document.getElementById('reportCount').textContent = dataStore.length;

        if (!dataStore.length) return;

        renderReportSummary();
        renderReportThreshold();
        renderReportExtreme();
        renderReportConflicts();
        renderReportChart();
        renderReportDetail();
    };

    function renderReportSummary() {
        var el = document.getElementById('reportSummary');
        var sorted = dataStore.slice().sort(function (a, b) { return new Date(a.sampleTime) - new Date(b.sampleTime); });
        var irrVals = sorted.filter(function (r) { return r.irradiance !== null; }).map(function (r) { return r.irradiance; });
        var spdVals = sorted.filter(function (r) { return r.boatSpeed !== null; }).map(function (r) { return r.boatSpeed; });
        var batVals = sorted.filter(function (r) { return r.batteryCapacity !== null; }).map(function (r) { return r.batteryCapacity; });
        var gaps = detectGaps(dataStore);
        var conflicts = detectConflicts(dataStore);
        var allViolations = [];
        dataStore.forEach(function (r) { allViolations = allViolations.concat(r.thresholdViolations); });

        var avgIrr = irrVals.length ? (irrVals.reduce(function (a, b) { return a + b; }, 0) / irrVals.length).toFixed(0) : '--';
        var avgSpd = spdVals.length ? (spdVals.reduce(function (a, b) { return a + b; }, 0) / spdVals.length).toFixed(1) : '--';
        var latest = getLatest();
        var latestSP = (latest && latest.irradiance !== null && latest.panelArea !== null && latest.panelEfficiency !== null) ? calcSolarPower(latest.irradiance, latest.panelArea, latest.panelEfficiency).toFixed(2) : '--';
        var latestRange = '--';
        if (latest && latest.irradiance !== null && latest.panelArea !== null && latest.panelEfficiency !== null && latest.motorPower !== null && latest.boatSpeed !== null) {
            latestRange = calcRange(calcSolarPower(latest.irradiance, latest.panelArea, latest.panelEfficiency), latest.batteryCapacity || 0, latest.motorPower, latest.boatSpeed).toFixed(1);
        }

        var html = '' +
            '<div class="report-summary-item">\u6570\u636e\u65f6\u95f4\u8303\u56f4: ' + fmtTime(sorted[0].sampleTime) + ' \u2192 ' + fmtTime(sorted[sorted.length - 1].sampleTime) + '</div>' +
            '<div class="report-summary-item">\u603b\u91c7\u6837\u6761\u6570: ' + dataStore.length + '</div>' +
            '<div class="report-summary-item">\u91c7\u6837\u7f3a\u53e3: ' + gaps.length + ' \u5904' + (gaps.length ? ' (\u6700\u957f ' + Math.max.apply(null, gaps.map(function (g) { return g.gapMinutes; })) + ' \u5206\u949f)' : '') + '</div>' +
            '<div class="report-summary-item">\u5e73\u5747\u8f90\u7167\u5ea6: ' + avgIrr + ' W/m\u00b2</div>' +
            '<div class="report-summary-item">\u5e73\u5747\u822a\u901f: ' + avgSpd + ' km/h</div>' +
            '<div class="report-summary-item">\u5f53\u524d\u592a\u9633\u80fd\u529f\u7387: ' + latestSP + ' kW</div>' +
            '<div class="report-summary-item">\u5f53\u524d\u4f30\u7b97\u7eed\u822a: ' + latestRange + ' km</div>' +
            '<div class="report-summary-item">\u5b89\u5168\u9608\u503c\u8d85\u9650: ' + allViolations.length + ' \u6761</div>' +
            '<div class="report-summary-item">\u6570\u636e\u51b2\u7a81: ' + conflicts.length + ' \u6761</div>';

        var sources = {};
        dataStore.forEach(function (r) { sources[r.dataSource] = (sources[r.dataSource] || 0) + 1; });
        var sourceStr = Object.keys(sources).map(function (k) { return k + ' (' + sources[k] + '\u6761)'; }).join('\u3001');
        html += '<div class="report-summary-item">\u6570\u636e\u6765\u6e90\u5206\u5e03: ' + sourceStr + '</div>';

        el.innerHTML = html;
    }

    function renderReportThreshold() {
        var el = document.getElementById('reportThreshold');
        var html = '';
        dataStore.forEach(function (r) {
            if (r.thresholdViolations.length === 0) return;
            r.thresholdViolations.forEach(function (v) {
                html += '<div class="report-summary-item" style="background:var(--danger-light);padding:6px 8px;border-radius:4px;margin-bottom:4px">' +
                    '\u26a0 <strong>' + v.label + '</strong> \u8fbe\u5230 ' + v.value.toFixed(1) + v.unit + '\uff0c\u8d85\u8fc7\u5b89\u5168\u9608\u503c ' + v.threshold + v.unit +
                    '<br><span style="font-size:11px;color:var(--text-secondary)">\u6765\u6e90: ' + r.dataSource + ' | \u91c7\u6837: ' + fmtTime(r.sampleTime) + ' | \u5904\u7406: ' + fmtTime(r.processingTime) + '</span>' +
                    '</div>';
            });
        });
        el.innerHTML = html || '<p style="color:var(--success)">\u2713 \u65e0\u8d85\u9608\u8bb0\u5f55</p>';
    }

    function renderReportExtreme() {
        var el = document.getElementById('reportExtreme');
        var html = '';
        dataStore.forEach(function (r) {
            Object.keys(r.extremeFields).forEach(function (k) {
                var label = THRESHOLDS[k] ? THRESHOLDS[k].label : k;
                html += '<div class="report-summary-item" style="background:var(--extreme-light);padding:6px 8px;border-radius:4px;margin-bottom:4px">' +
                    '\ud83d\udd0d <strong>' + label + '</strong> \u6781\u7aef\u503c ' + r.extremeFields[k].toFixed(1) + (THRESHOLDS[k] ? THRESHOLDS[k].unit : '') +
                    '<br><span style="font-size:11px;color:var(--text-secondary)">\u6765\u6e90: ' + r.dataSource + ' | \u91c7\u6837: ' + fmtTime(r.sampleTime) + ' | \u5904\u7406: ' + fmtTime(r.processingTime) + '</span>' +
                    '<br><span style="font-size:11px;color:var(--extreme)">\u8be5\u503c\u672a\u88ab\u5e73\u5747\u503c\u8986\u76d6\uff0c\u5df2\u5355\u72ec\u6807\u8bb0</span></div>';
            });
        });
        el.innerHTML = html || '<p style="color:var(--success)">\u2713 \u65e0\u6781\u7aef\u503c</p>';
    }

    function renderReportConflicts() {
        var el = document.getElementById('reportConflicts');
        var conflicts = detectConflicts(dataStore);
        if (!conflicts.length) { el.innerHTML = '<p style="color:var(--success)">\u2713 \u65e0\u51b2\u7a81</p>'; return; }
        var html = '';
        conflicts.forEach(function (c) {
            if (c.isRemark) {
                html += '<div class="report-summary-item" style="background:var(--warning-light);padding:6px 8px;border-radius:4px;margin-bottom:4px">' +
                    '\u26a0 <strong>\u5907\u6ce8\u51b2\u7a81</strong>' +
                    '<br>\u4eba\u5de5\u5907\u6ce8: ' + c.manualValue + ' vs \u5176\u4ed6\u6765\u6e90: ' + c.dataValue +
                    '<br><span style="font-size:11px;color:var(--text-secondary)">\u5efa\u8bae: \u6838\u5bf9\u539f\u59cb\u8bb0\u5f55\u518d\u786e\u8ba4\u4ee5\u54ea\u6761\u4e3a\u51c6</span></div>';
            } else {
                var fl = THRESHOLDS[c.field] ? THRESHOLDS[c.field].label : c.field;
                html += '<div class="report-summary-item" style="background:var(--warning-light);padding:6px 8px;border-radius:4px;margin-bottom:4px">' +
                    '\u26a0 <strong>' + fl + ' \u6570\u636e\u51b2\u7a81</strong>' +
                    '<br>\u73b0\u573a\u7167\u7247: ' + c.photoValue + ' vs \u5bfc\u5165\u6570\u636e: ' + c.dataValue +
                    '<br><span style="font-size:11px;color:var(--text-secondary)">\u5efa\u8bae: \u56de\u770b\u539f\u59cb\u7167\u7247\u786e\u8ba4\u8bfb\u6570\uff0c\u518d\u51b3\u5b9a\u4ee5\u54ea\u8fb9\u4e3a\u51c6</span></div>';
            }
        });
        el.innerHTML = html;
    }

    function renderReportChart() {
        var ctx = document.getElementById('reportChart');
        if (!ctx) return;
        if (charts.report) charts.report.destroy();

        var sorted = dataStore.slice().sort(function (a, b) { return new Date(a.sampleTime) - new Date(b.sampleTime); });
        var labels = sorted.map(function (r) { return fmtTime(r.sampleTime); });

        var irrData = sorted.map(function (r) { return r.irradiance; });
        var bgColors = sorted.map(function (r) {
            if (r.thresholdViolations.length > 0 || Object.keys(r.extremeFields).length > 0) return 'rgba(197,48,48,0.7)';
            return 'rgba(43,108,176,0.7)';
        });

        charts.report = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '\u8f90\u7167\u5ea6 (W/m\u00b2)',
                    data: irrData,
                    backgroundColor: bgColors
                }]
            },
            options: {
                responsive: true,
                scales: { y: { title: { display: true, text: 'W/m\u00b2' } } },
                plugins: {
                    legend: { position: 'top' },
                    annotation: {}
                }
            }
        });
    }

    function renderReportDetail() {
        var el = document.getElementById('reportDetail');
        if (!dataStore.length) { el.innerHTML = '<p class="empty-hint">\u6682\u65e0\u6570\u636e</p>'; return; }

        var html = '<table class="detail-table"><thead><tr>' +
            '<th>\u91c7\u6837\u65f6\u95f4</th><th>\u6765\u6e90</th><th>\u8f90\u7167\u5ea6</th><th>\u9762\u677f\u9762\u79ef</th><th>\u6548\u7387</th>' +
            '<th>\u7535\u6c60\u5bb9\u91cf</th><th>\u7535\u6c60\u6e29\u5ea6</th><th>\u7535\u673a\u529f\u7387</th><th>\u822a\u901f</th><th>\u98ce\u901f</th><th>\u6d6a\u9ad8</th>' +
            '<th>\u5904\u7406\u65f6\u95f4</th><th>\u72b6\u6001</th>' +
            '</tr></thead><tbody>';

        dataStore.forEach(function (r) {
            var rowClass = '';
            if (Object.keys(r.extremeFields).length > 0) rowClass = 'extreme-row';
            else if (r.thresholdViolations.length > 0) rowClass = 'threshold-row';

            var statusTags = '';
            r.thresholdViolations.forEach(function (v) { statusTags += '<span class="trace-tag" style="background:var(--danger-bg);color:var(--danger)">\u8d85\u9608:' + v.label + '</span>'; });
            Object.keys(r.extremeFields).forEach(function (k) { statusTags += '<span class="trace-tag trace-extreme">\u6781\u7aef:' + (THRESHOLDS[k] ? THRESHOLDS[k].label : k) + '</span>'; });
            if (!statusTags) statusTags = '<span style="color:var(--success)">\u6b63\u5e38</span>';

            html += '<tr class="' + rowClass + '">' +
                '<td>' + fmtTime(r.sampleTime) + '</td>' +
                '<td><span class="trace-tag trace-source">' + r.dataSource + '</span></td>' +
                '<td>' + (r.irradiance !== null ? r.irradiance.toFixed(0) : '-') + '</td>' +
                '<td>' + (r.panelArea !== null ? r.panelArea : '-') + '</td>' +
                '<td>' + (r.panelEfficiency !== null ? (r.panelEfficiency * 100).toFixed(1) + '%' : '-') + '</td>' +
                '<td>' + (r.batteryCapacity !== null ? r.batteryCapacity.toFixed(1) : '-') + '</td>' +
                '<td>' + (r.batteryTemp !== null ? r.batteryTemp.toFixed(1) : '-') + '</td>' +
                '<td>' + (r.motorPower !== null ? r.motorPower.toFixed(1) : '-') + '</td>' +
                '<td>' + (r.boatSpeed !== null ? r.boatSpeed.toFixed(1) : '-') + '</td>' +
                '<td>' + (r.windSpeed !== null ? r.windSpeed.toFixed(1) : '-') + '</td>' +
                '<td>' + (r.waveHeight !== null ? r.waveHeight.toFixed(2) : '-') + '</td>' +
                '<td>' + fmtTime(r.processingTime) + '</td>' +
                '<td>' + statusTags + '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        el.innerHTML = html;
    }

    window.exportReport = function () {
        window.generateReport();
        var content = document.getElementById('reportContent');
        var text = content.innerText;
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = '\u592a\u9633\u80fd\u8239\u822a\u7a0b\u4f30\u7b97\u62a5\u544a_' + fmtTime(nowISO()).replace(/[ :]/g, '_') + '.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    window.printReport = function () {
        window.generateReport();
        window.print();
    };

    window.clearForm = function () {
        document.getElementById('dataForm').reset();
    };

    window.loadDemoData = function () {
        var baseTime = new Date();
        baseTime.setHours(6, 0, 0, 0);

        var demoData = [
            { offset: 0, dataSource: '\u73b0\u573a\u7167\u7247', irradiance: '150 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '22%', batteryCapacity: '50 kWh', batteryTemp: '22\u00b0C', motorPower: '2 kW', boatSpeed: '6 km/h', windSpeed: '3 m/s', waveHeight: '0.2 m', waterTemp: '20\u00b0C', remarks: '\u65e9\u6668\u8d77\u822a', photoNote: '' },
            { offset: 60, dataSource: '\u5bfc\u5165\u6570\u636e', irradiance: '0.35 kW/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '0.22', batteryCapacity: '50 kWh', batteryTemp: '25\u00b0C', motorPower: '3000 W', boatSpeed: '8 km/h', windSpeed: '4 m/s', waveHeight: '0.3 m', waterTemp: '21\u00b0C', remarks: '', photoNote: '' },
            { offset: 120, dataSource: '\u8bbe\u5907\u8bfb\u6570', irradiance: '600 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '21%', batteryCapacity: '45 kWh', batteryTemp: '30\u00b0C', motorPower: '3 kW', boatSpeed: '9 km/h', windSpeed: '5 m/s', waveHeight: '0.4 m', waterTemp: '22\u00b0C', remarks: '\u8f90\u7167\u4e0a\u5347\u4e2d', photoNote: '' },
            { offset: 180, dataSource: '\u73b0\u573a\u7167\u7247', irradiance: '850 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '22%', batteryCapacity: '48 kWh', batteryTemp: '35\u00b0C', motorPower: '3 kW', boatSpeed: '10 km/h', windSpeed: '6 m/s', waveHeight: '0.5 m', waterTemp: '23\u00b0C', remarks: '', photoNote: '\u8f90\u7167\u5ea6 650 \u7535\u6c60\u6e29\u5ea6 42' },
            { offset: 240, dataSource: '\u5bfc\u5165\u6570\u636e', irradiance: '950 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '22%', batteryCapacity: '50 kWh', batteryTemp: '38\u00b0C', motorPower: '3 kW', boatSpeed: '10 km/h', windSpeed: '7 m/s', waveHeight: '0.6 m', waterTemp: '24\u00b0C', remarks: '', photoNote: '' },
            { offset: 300, dataSource: '\u8bbe\u5907\u8bfb\u6570', irradiance: '1050 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '21%', batteryCapacity: '52 kWh', batteryTemp: '42\u00b0C', motorPower: '4 kW', boatSpeed: '11 km/h', windSpeed: '8 m/s', waveHeight: '0.8 m', waterTemp: '25\u00b0C', remarks: '\u7535\u6c60\u6e29\u5ea6\u504f\u9ad8', photoNote: '' },
            { offset: 360, dataSource: '\u73b0\u573a\u7167\u7247', irradiance: '1100 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '20%', batteryCapacity: '48 kWh', batteryTemp: '48\u00b0C', motorPower: '4 kW', boatSpeed: '10 km/h', windSpeed: '12 m/s', waveHeight: '1.2 m', waterTemp: '26\u00b0C', remarks: '', photoNote: '\u7535\u6c60\u6e29\u5ea6 38 \u98ce\u901f 8' },
            { offset: 420, dataSource: '\u5bfc\u5165\u6570\u636e', irradiance: '1.3 kW/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '19%', batteryCapacity: '45 kWh', batteryTemp: '50\u00b0C', motorPower: '5 kW', boatSpeed: '8 km/h', windSpeed: '16 m/s', waveHeight: '2.5 m', waterTemp: '26\u00b0C', remarks: '\u8bbe\u5907\u62a5\u8b66:\u7535\u6c60\u8fc7\u70ed', photoNote: '' },
            { offset: 480, dataSource: '\u4eba\u5de5\u5907\u6ce8', irradiance: '', panelArea: '', panelEfficiency: '', batteryCapacity: '', batteryTemp: '', motorPower: '', boatSpeed: '', windSpeed: '', waveHeight: '', waterTemp: '', remarks: '\u98ce\u6d6a\u8fc7\u5927\uff0c\u5efa\u8bae\u505c\u822a', photoNote: '' },
            { offset: 540, dataSource: '\u73b0\u573a\u7167\u7247', irradiance: '900 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '21%', batteryCapacity: '40 kWh', batteryTemp: '44\u00b0C', motorPower: '3 kW', boatSpeed: '7 km/h', windSpeed: '10 m/s', waveHeight: '1.0 m', waterTemp: '25\u00b0C', remarks: '', photoNote: '\u98ce\u901f 10 m/s \u6d6a\u9ad8 1.0m' },
            { offset: 720, dataSource: '\u8bbe\u5907\u8bfb\u6570', irradiance: '700 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '22%', batteryCapacity: '35 kWh', batteryTemp: '38\u00b0C', motorPower: '2.5 kW', boatSpeed: '8 km/h', windSpeed: '6 m/s', waveHeight: '0.5 m', waterTemp: '24\u00b0C', remarks: '\u5904\u7406\u5b8c\u6bd5\u6062\u590d\u822a\u884c', photoNote: '' },
            { offset: 780, dataSource: '\u5bfc\u5165\u6570\u636e', irradiance: '500 W/m\u00b2', panelArea: '12 m\u00b2', panelEfficiency: '22%', batteryCapacity: '30 kWh', batteryTemp: '34\u00b0C', motorPower: '2 kW', boatSpeed: '7 km/h', windSpeed: '4 m/s', waveHeight: '0.3 m', waterTemp: '23\u00b0C', remarks: '', photoNote: '' }
        ];

        dataStore = [];
        demoData.forEach(function (d) {
            var t = new Date(baseTime.getTime() + d.offset * 60000);
            var pad = function (n) { return n < 10 ? '0' + n : n; };
            var timeStr = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes());
            addRecord({
                dataSource: d.dataSource,
                sampleTime: timeStr,
                irradiance: d.irradiance,
                panelArea: d.panelArea,
                panelEfficiency: d.panelEfficiency,
                batteryCapacity: d.batteryCapacity,
                batteryTemp: d.batteryTemp,
                motorPower: d.motorPower,
                boatSpeed: d.boatSpeed,
                windSpeed: d.windSpeed,
                waveHeight: d.waveHeight,
                waterTemp: d.waterTemp,
                remarks: d.remarks,
                photoNote: d.photoNote
            });
        });

        refreshAll();
    };

    function refreshAll() {
        renderRecentEntries();
        renderConflicts();
        updateDashboard();
    }

    function init() {
        var clockEl = document.getElementById('clock');
        function tickClock() {
            var now = new Date();
            var pad = function (n) { return n < 10 ? '0' + n : n; };
            clockEl.textContent = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
        }
        tickClock();
        setInterval(tickClock, 1000);

        var sampleTimeInput = document.getElementById('sampleTime');
        var now = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : n; };
        sampleTimeInput.value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());

        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
                document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
                btn.classList.add('active');
                document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
                if (btn.dataset.tab === 'dashboard') updateDashboard();
            });
        });

        document.getElementById('dataForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var raw = {
                dataSource: document.getElementById('dataSource').value,
                sampleTime: document.getElementById('sampleTime').value,
                irradiance: document.getElementById('irradiance').value,
                panelArea: document.getElementById('panelArea').value,
                panelEfficiency: document.getElementById('panelEfficiency').value,
                batteryCapacity: document.getElementById('batteryCapacity').value,
                batteryTemp: document.getElementById('batteryTemp').value,
                motorPower: document.getElementById('motorPower').value,
                boatSpeed: document.getElementById('boatSpeed').value,
                windSpeed: document.getElementById('windSpeed').value,
                waveHeight: document.getElementById('waveHeight').value,
                waterTemp: document.getElementById('waterTemp').value,
                remarks: document.getElementById('remarks').value,
                photoNote: document.getElementById('photoNote').value
            };
            addRecord(raw);
            refreshAll();
            document.getElementById('dataForm').reset();
            var n2 = new Date();
            sampleTimeInput.value = n2.getFullYear() + '-' + pad(n2.getMonth() + 1) + '-' + pad(n2.getDate()) + 'T' + pad(n2.getHours()) + ':' + pad(n2.getMinutes());
        });

        document.getElementById('irradiance').addEventListener('input', function (e) {
            var parsed = parseNumberWithUnit(e.target.value);
            var hint = document.getElementById('irradianceUnit');
            if (parsed) {
                hint.textContent = parsed.unit.indexOf('kw') >= 0 ? '= ' + (parsed.value * 1000).toFixed(0) + ' W/m\u00b2' : 'W/m\u00b2';
            } else {
                hint.textContent = '\u81ea\u52a8\u8bc6\u522b\u5355\u4f4d';
            }
        });
    }

    init();
})();
