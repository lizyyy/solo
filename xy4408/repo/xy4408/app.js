(function() {
    'use strict';

    const STORAGE_KEY = 'dry_dock_painting_release_tool';
    const DEW_POINT_MIN_DIFF = 3;
    const MAX_CONTINUOUS_WORK_HOURS = 8;

    let appState = {
        zones: [],
        paints: [],
        wftRecords: [],
        envRecords: [],
        schedule: [],
        reviews: {},
        currentZoneId: null
    };

    const templates = {
        zones: `id,name,location,area,required_thickness_min,required_thickness_max,process_order
Z001,船首外板,船首区域,50,200,280,1
Z002,船中左舷外板,船中区域,80,200,280,1
Z003,船中右舷外板,船中区域,80,200,280,1
Z004,船尾外板,船尾区域,60,200,280,2
Z005,主甲板,主甲板区域,120,150,200,2`,

        paints: `batch_no,paint_name,manufacture_date,expiry_date,min_thickness,max_thickness
P001,环氧底漆EP-100,2025-01-15,2025-12-15,200,280
P002,聚氨酯面漆PU-200,2025-02-20,2025-08-20,150,200
P003,环氧富锌底漆EP-Zn,2024-06-10,2024-12-10,80,120`,

        wft: `zone_id,record_time,measurement_point,wet_thickness,inspector
Z001,2025-05-04 09:30,1#,220,张工
Z001,2025-05-04 09:35,2#,190,张工
Z001,2025-05-04 09:40,3#,290,张工
Z002,2025-05-04 10:15,1#,250,李工
Z002,2025-05-04 10:20,2#,265,李工
Z003,2025-05-04 14:00,1#,210,张工
Z003,2025-05-04 14:05,2#,205,张工`,

        schedule: `zone_id,worker_name,start_time,end_time,process_step
Z001,张三,2025-05-04 08:00,2025-05-04 12:00,喷涂
Z001,张三,2025-05-04 13:00,2025-05-04 18:00,喷涂
Z001,李四,2025-05-04 18:30,2025-05-04 20:30,检查
Z002,王五,2025-05-04 08:00,2025-05-04 16:00,喷涂
Z003,赵六,2025-05-04 13:00,2025-05-04 18:00,喷涂
Z004,张三,2025-05-04 16:00,2025-05-04 20:00,准备`,

        env: `{
  "records": [
    {
      "time": "2025-05-04 08:00",
      "temperature": 25,
      "humidity": 65,
      "dew_point": 18
    },
    {
      "time": "2025-05-04 12:00",
      "temperature": 28,
      "humidity": 70,
      "dew_point": 22
    },
    {
      "time": "2025-05-04 16:00",
      "temperature": 26,
      "humidity": 75,
      "dew_point": 21
    },
    {
      "time": "2025-05-04 20:00",
      "temperature": 22,
      "humidity": 80,
      "dew_point": 19
    }
  ]
}`
    };

    function init() {
        loadFromStorage();
        bindEvents();
        renderAll();
    }

    function loadFromStorage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                appState = JSON.parse(saved);
            }
        } catch (e) {
            console.error('加载存储数据失败:', e);
        }
    }

    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    }

    function resetAllData() {
        if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
            appState = {
                zones: [],
                paints: [],
                wftRecords: [],
                envRecords: [],
                schedule: [],
                reviews: {},
                currentZoneId: null
            };
            localStorage.removeItem(STORAGE_KEY);
            renderAll();
        }
    }

    function bindEvents() {
        document.getElementById('zonesFile').addEventListener('change', (e) => handleFileImport(e, 'zones'));
        document.getElementById('paintsFile').addEventListener('change', (e) => handleFileImport(e, 'paints'));
        document.getElementById('wftFile').addEventListener('change', (e) => handleFileImport(e, 'wft'));
        document.getElementById('envFile').addEventListener('change', (e) => handleFileImport(e, 'env'));
        document.getElementById('scheduleFile').addEventListener('change', (e) => handleFileImport(e, 'schedule'));

        document.getElementById('resetAllBtn').addEventListener('click', resetAllData);
        document.getElementById('exportMarkdownBtn').addEventListener('click', exportMarkdown);
        document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
        document.getElementById('refreshBtn').addEventListener('click', () => {
            validateAllZones();
            renderAll();
        });

        document.getElementById('statusFilter').addEventListener('change', renderZones);

        document.getElementById('saveReviewBtn').addEventListener('click', saveReview);
        document.getElementById('closeModalBtn').addEventListener('click', closeZoneModal);
        document.querySelector('#zoneModal .modal-close').addEventListener('click', closeZoneModal);

        document.getElementById('copyTemplateBtn').addEventListener('click', copyTemplate);
        document.getElementById('closeTemplateBtn').addEventListener('click', closeTemplateModal);
        document.querySelector('#templateModal .modal-close').addEventListener('click', closeTemplateModal);

        document.getElementById('zoneModal').addEventListener('click', (e) => {
            if (e.target.id === 'zoneModal') closeZoneModal();
        });
        document.getElementById('templateModal').addEventListener('click', (e) => {
            if (e.target.id === 'templateModal') closeTemplateModal();
        });
    }

    function handleFileImport(event, dataType) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                let parsedData;

                if (dataType === 'env') {
                    parsedData = parseEnvJson(content);
                } else {
                    parsedData = parseCsv(content);
                }

                appState[dataType === 'env' ? 'envRecords' : 
                         dataType === 'wft' ? 'wftRecords' :
                         dataType] = parsedData;

                validateAllZones();
                saveToStorage();
                renderAll();
                showImportSummary(dataType, parsedData.length);
            } catch (err) {
                showImportError(dataType, err.message);
            }
        };
        reader.readAsText(file);
    }

    function parseCsv(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] || '';
                if (!isNaN(value) && value !== '') {
                    value = parseFloat(value);
                    if (Number.isInteger(value)) value = parseInt(value);
                }
                row[header] = value;
            });
            data.push(row);
        }

        return data;
    }

    function parseEnvJson(jsonText) {
        const parsed = JSON.parse(jsonText);
        return parsed.records || [];
    }

    function showImportSummary(dataType, count) {
        const names = {
            zones: '船体分区',
            paints: '涂料批号',
            wft: '湿膜厚度',
            env: '温湿度记录',
            schedule: '人员排班'
        };
        const summaryId = dataType === 'env' ? 'envSummary' : 
                          dataType === 'wft' ? 'wftSummary' :
                          `${dataType}Summary`;
        const el = document.getElementById(summaryId);
        el.textContent = `✓ 已导入 ${count} 条${names[dataType]}数据`;
        el.className = 'import-summary has-data';
    }

    function showImportError(dataType, message) {
        const summaryId = dataType === 'env' ? 'envSummary' : 
                          dataType === 'wft' ? 'wftSummary' :
                          `${dataType}Summary`;
        const el = document.getElementById(summaryId);
        el.textContent = `✗ 导入失败: ${message}`;
        el.className = 'import-summary has-data error';
    }

    function validateAllZones() {
        const today = new Date();

        appState.zones.forEach(zone => {
            zone.issues = [];

            const zoneWft = appState.wftRecords.filter(r => r.zone_id === zone.id);
            if (zoneWft.length > 0) {
                zoneWft.forEach(record => {
                    const wft = record.wet_thickness;
                    const min = zone.required_thickness_min || 0;
                    const max = zone.required_thickness_max || Infinity;
                    
                    if (wft < min) {
                        zone.issues.push({
                            type: 'error',
                            category: 'thickness_low',
                            message: `测点${record.measurement_point}: 湿膜厚度${wft}μm低于最小值${min}μm`
                        });
                    }
                    if (wft > max) {
                        zone.issues.push({
                            type: 'error',
                            category: 'thickness_high',
                            message: `测点${record.measurement_point}: 湿膜厚度${wft}μm超过最大值${max}μm`
                        });
                    }
                });
            }

            if (appState.envRecords.length > 0) {
                appState.envRecords.forEach(record => {
                    const temp = record.temperature;
                    const dewPoint = record.dew_point;
                    const diff = temp - dewPoint;
                    
                    if (diff < DEW_POINT_MIN_DIFF) {
                        zone.issues.push({
                            type: 'warning',
                            category: 'dew_point',
                            message: `${record.time}: 露点差${diff.toFixed(1)}℃低于要求的${DEW_POINT_MIN_DIFF}℃`
                        });
                    }
                });
            }

            const zoneSchedule = appState.schedule.filter(s => s.zone_id === zone.id);
            const workerHours = {};
            zoneSchedule.forEach(s => {
                if (s.worker_name && s.start_time && s.end_time) {
                    if (!workerHours[s.worker_name]) workerHours[s.worker_name] = 0;
                    const start = new Date(s.start_time);
                    const end = new Date(s.end_time);
                    const hours = (end - start) / (1000 * 60 * 60);
                    workerHours[s.worker_name] += hours;
                }
            });

            Object.entries(workerHours).forEach(([worker, hours]) => {
                if (hours > MAX_CONTINUOUS_WORK_HOURS) {
                    zone.issues.push({
                        type: 'warning',
                        category: 'overtime',
                        message: `喷涂员${worker}连续工作${hours.toFixed(1)}小时，超过${MAX_CONTINUOUS_WORK_HOURS}小时限制`
                    });
                }
            });
        });

        appState.paints.forEach(paint => {
            if (paint.expiry_date) {
                const expiryDate = new Date(paint.expiry_date);
                if (expiryDate < today) {
                    const relatedZones = appState.zones.filter(zone => {
                        return appState.wftRecords.some(wft => 
                            wft.zone_id === zone.id && 
                            wft.paint_batch === paint.batch_no
                        );
                    });
                    
                    relatedZones.forEach(zone => {
                        zone.issues.push({
                            type: 'error',
                            category: 'paint_expired',
                            message: `涂料${paint.paint_name}(批号${paint.batch_no})已过期(有效期至${paint.expiry_date})`
                        });
                    });
                }
            }
        });

        const unreviewedZones = appState.zones.filter(z => {
            const review = appState.reviews[z.id];
            return !review || review.status !== 'approved';
        });

        unreviewedZones.forEach(zone => {
            const nextZones = appState.zones.filter(z => 
                z.process_order && z.process_order > (zone.process_order || 0)
            );
            
            nextZones.forEach(nextZone => {
                const hasNextSchedule = appState.schedule.some(s => 
                    s.zone_id === nextZone.id && s.process_step !== '准备'
                );
                
                if (hasNextSchedule) {
                    zone.issues.push({
                        type: 'warning',
                        category: 'unapproved_next',
                        message: `本分区未放行，但下道工序分区${nextZone.name}已安排施工`
                    });
                }
            });
        });

        saveToStorage();
    }

    function renderAll() {
        renderZones();
        renderAlerts();
        updateImportSummaries();
    }

    function updateImportSummaries() {
        const summaries = [
            { key: 'zones', el: 'zonesSummary', name: '船体分区' },
            { key: 'paints', el: 'paintsSummary', name: '涂料批号' },
            { key: 'wftRecords', el: 'wftSummary', name: '湿膜厚度' },
            { key: 'envRecords', el: 'envSummary', name: '温湿度记录' },
            { key: 'schedule', el: 'scheduleSummary', name: '人员排班' }
        ];

        summaries.forEach(item => {
            const el = document.getElementById(item.el);
            const count = appState[item.key].length;
            if (count > 0) {
                el.textContent = `✓ 已导入 ${count} 条${item.name}数据`;
                el.className = 'import-summary has-data';
            } else {
                el.textContent = '';
                el.className = 'import-summary';
            }
        });
    }

    function renderZones() {
        const container = document.getElementById('zonesContainer');
        const filter = document.getElementById('statusFilter').value;

        if (appState.zones.length === 0) {
            container.innerHTML = '<div class="zones-placeholder">请先导入船体分区数据</div>';
            return;
        }

        let filteredZones = appState.zones;
        if (filter !== 'all') {
            filteredZones = appState.zones.filter(zone => {
                const review = appState.reviews[zone.id];
                const status = review ? review.status : 'unreviewed';
                return status === filter;
            });
        }

        if (filteredZones.length === 0) {
            container.innerHTML = '<div class="zones-placeholder">没有符合条件的分区</div>';
            return;
        }

        container.innerHTML = filteredZones.map(zone => {
            const review = appState.reviews[zone.id];
            const status = review ? review.status : 'unreviewed';
            const hasIssues = zone.issues && zone.issues.length > 0;
            const issueCount = hasIssues ? zone.issues.length : 0;

            const statusText = {
                unreviewed: '待复核',
                approved: '已放行',
                rejected: '需整改'
            };

            return `
                <div class="zone-card ${status} ${hasIssues ? 'has-issues' : ''}" 
                     onclick="openZoneModal('${zone.id}')" data-zone-id="${zone.id}">
                    <div class="zone-name">${zone.name || zone.id}</div>
                    <div class="zone-status">${statusText[status]}</div>
                    ${hasIssues ? `<span class="issue-badge">${issueCount}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    function renderAlerts() {
        const container = document.getElementById('alertsContainer');
        const allIssues = [];

        appState.zones.forEach(zone => {
            if (zone.issues) {
                zone.issues.forEach(issue => {
                    allIssues.push({
                        zone: zone,
                        ...issue
                    });
                });
            }
        });

        if (allIssues.length === 0) {
            container.innerHTML = '<div class="alert-placeholder">暂无问题告警</div>';
            return;
        }

        const errors = allIssues.filter(i => i.type === 'error');
        const warnings = allIssues.filter(i => i.type === 'warning');

        container.innerHTML = `
            <div class="alert-item alert-info">
                <h4>问题统计</h4>
                <p>错误: ${errors.length} 项 | 警告: ${warnings.length} 项</p>
            </div>
            ${[...errors, ...warnings].slice(0, 15).map(issue => `
                <div class="alert-item ${issue.type === 'error' ? 'alert-error' : 'alert-warning'}"
                     onclick="openZoneModal('${issue.zone.id}')" style="cursor:pointer;">
                    <h4>${issue.zone.name || issue.zone.id}</h4>
                    <p>${issue.message}</p>
                </div>
            `).join('')}
            ${allIssues.length > 15 ? `
                <div class="alert-item alert-info">
                    <p>...还有 ${allIssues.length - 15} 项问题未显示</p>
                </div>
            ` : ''}
        `;
    }

    function openZoneModal(zoneId) {
        const zone = appState.zones.find(z => z.id === zoneId);
        if (!zone) return;

        appState.currentZoneId = zoneId;
        const review = appState.reviews[zoneId];

        document.getElementById('modalZoneTitle').textContent = `分区复核 - ${zone.name || zoneId}`;

        const zoneWft = appState.wftRecords.filter(r => r.zone_id === zoneId);
        const zoneSchedule = appState.schedule.filter(s => s.zone_id === zoneId);

        document.getElementById('zoneInfo').innerHTML = `
            <h4>基本信息</h4>
            <div class="zone-info-grid">
                <div class="info-item"><label>分区ID</label><value>${zone.id}</value></div>
                <div class="info-item"><label>分区名称</label><value>${zone.name || '-'}</value></div>
                <div class="info-item"><label>位置</label><value>${zone.location || '-'}</value></div>
                <div class="info-item"><label>面积</label><value>${zone.area || '-'} ㎡</value></div>
                <div class="info-item"><label>要求厚度范围</label><value>${zone.required_thickness_min || '-'} - ${zone.required_thickness_max || '-'} μm</value></div>
                <div class="info-item"><label>工序顺序</label><value>${zone.process_order || '-'}</value></div>
            </div>
            ${zoneWft.length > 0 ? `
                <h4 style="margin-top:1rem;">湿膜厚度记录</h4>
                <table style="width:100%;font-size:0.8rem;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#e2e8f0;">
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">时间</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">测点</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">厚度</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">检验员</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${zoneWft.map(r => `
                            <tr>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${r.record_time || '-'}</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${r.measurement_point || '-'}</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${r.wet_thickness || '-'} μm</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${r.inspector || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
            ${zoneSchedule.length > 0 ? `
                <h4 style="margin-top:1rem;">施工排班</h4>
                <table style="width:100%;font-size:0.8rem;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#e2e8f0;">
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">施工人员</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">开始时间</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">结束时间</th>
                            <th style="padding:0.25rem;border:1px solid #cbd5e1;">工序</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${zoneSchedule.map(s => `
                            <tr>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${s.worker_name || '-'}</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${s.start_time || '-'}</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${s.end_time || '-'}</td>
                                <td style="padding:0.25rem;border:1px solid #e2e8f0;">${s.process_step || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        `;

        const issuesContainer = document.getElementById('zoneIssues');
        if (zone.issues && zone.issues.length > 0) {
            issuesContainer.innerHTML = `
                <h4>检测到的问题 (${zone.issues.length}项)</h4>
                <div class="issue-list">
                    ${zone.issues.map(issue => `
                        <div class="issue-item ${issue.type}">
                            <strong>${issue.type === 'error' ? '【错误】' : '【警告】'}</strong>
                            ${issue.message}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            issuesContainer.innerHTML = '<div class="no-issues">✓ 未检测到问题</div>';
        }

        document.getElementById('reviewStatus').value = review ? review.status : 'unreviewed';
        document.getElementById('reviewNotes').value = review ? (review.notes || '') : '';
        document.getElementById('reviewerName').value = review ? (review.reviewer || '') : '';

        document.getElementById('zoneModal').classList.remove('hidden');
    }

    function closeZoneModal() {
        document.getElementById('zoneModal').classList.add('hidden');
        appState.currentZoneId = null;
    }

    function saveReview() {
        if (!appState.currentZoneId) return;

        const status = document.getElementById('reviewStatus').value;
        const notes = document.getElementById('reviewNotes').value.trim();
        const reviewer = document.getElementById('reviewerName').value.trim();

        appState.reviews[appState.currentZoneId] = {
            status: status,
            notes: notes,
            reviewer: reviewer,
            reviewedAt: new Date().toISOString()
        };

        saveToStorage();
        validateAllZones();
        renderAll();
        closeZoneModal();
    }

    function showCsvTemplate(type) {
        const titles = {
            zones: '船体分区 CSV 模板',
            paints: '涂料批号 CSV 模板',
            wft: '湿膜厚度抽检 CSV 模板',
            schedule: '施工人员排班 CSV 模板'
        };

        document.getElementById('templateTitle').textContent = titles[type];
        document.getElementById('templateContent').textContent = templates[type];
        document.getElementById('templateModal').classList.remove('hidden');
    }

    function showJsonTemplate() {
        document.getElementById('templateTitle').textContent = '温湿度/露点 JSON 模板';
        document.getElementById('templateContent').textContent = templates.env;
        document.getElementById('templateModal').classList.remove('hidden');
    }

    function closeTemplateModal() {
        document.getElementById('templateModal').classList.add('hidden');
    }

    function copyTemplate() {
        const content = document.getElementById('templateContent').textContent;
        navigator.clipboard.writeText(content).then(() => {
            alert('模板已复制到剪贴板');
        }).catch(() => {
            alert('复制失败，请手动选择复制');
        });
    }

    function exportMarkdown() {
        const today = new Date().toLocaleDateString('zh-CN');
        
        let md = `# 干船坞涂装放行单

**生成日期**: ${today}

---

## 统计概览

| 项目 | 数量 |
|------|------|
| 总分区数 | ${appState.zones.length} |
| 已放行 | ${appState.zones.filter(z => appState.reviews[z.id]?.status === 'approved').length} |
| 待复核 | ${appState.zones.filter(z => !appState.reviews[z.id] || appState.reviews[z.id].status === 'unreviewed').length} |
| 需整改 | ${appState.zones.filter(z => appState.reviews[z.id]?.status === 'rejected').length} |

---

## 分区详情

`;

        appState.zones.forEach(zone => {
            const review = appState.reviews[zone.id];
            const statusText = {
                unreviewed: '待复核',
                approved: '已放行',
                rejected: '需整改'
            };
            const status = review ? statusText[review.status] : '待复核';
            const hasIssues = zone.issues && zone.issues.length > 0;

            md += `### ${zone.name || zone.id}

**状态**: ${status}
${review ? `**复核人**: ${review.reviewer || '-'}` : ''}
${review?.notes ? `**复核备注**: ${review.notes}` : ''}

| 项目 | 内容 |
|------|------|
| 分区ID | ${zone.id} |
| 位置 | ${zone.location || '-'} |
| 面积 | ${zone.area || '-'} ㎡ |
| 要求厚度 | ${zone.required_thickness_min || '-'} - ${zone.required_thickness_max || '-'} μm |

`;

            if (hasIssues) {
                md += `**检测到的问题**:\n\n`;
                zone.issues.forEach(issue => {
                    md += `- [${issue.type === 'error' ? '错误' : '警告'}] ${issue.message}\n`;
                });
                md += '\n';
            }

            md += `---\n\n`;
        });

        downloadFile(md, `涂装放行单_${today.replace(/\//g, '-')}.md`, 'text/markdown');
    }

    function exportJson() {
        const exportData = {
            exportTime: new Date().toISOString(),
            data: {
                zones: appState.zones,
                paints: appState.paints,
                wftRecords: appState.wftRecords,
                envRecords: appState.envRecords,
                schedule: appState.schedule,
                reviews: appState.reviews
            },
            validation: {
                dewPointMinDiff: DEW_POINT_MIN_DIFF,
                maxContinuousWorkHours: MAX_CONTINUOUS_WORK_HOURS,
                totalIssues: appState.zones.reduce((sum, z) => sum + (z.issues?.length || 0), 0)
            }
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const today = new Date().toISOString().slice(0, 10);
        downloadFile(jsonStr, `审计包_${today}.json`, 'application/json');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    window.openZoneModal = openZoneModal;
    window.showCsvTemplate = showCsvTemplate;
    window.showJsonTemplate = showJsonTemplate;

    document.addEventListener('DOMContentLoaded', init);
})();
