const DrumRoomApp = (function() {
    'use strict';

    const STORAGE_KEYS = {
        EXPERIMENT_DATA: 'drum_room_experiment_data',
        PARAM_VERSIONS: 'drum_room_param_versions',
        CURRENT_PARAMS: 'drum_room_current_params',
        CALC_HISTORY: 'drum_room_calc_history',
        SOURCE_INFO: 'drum_room_source_info'
    };

    const FREQUENCIES = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

    const DEFAULT_PARAMS = {
        version: 'v1.0',
        versionName: '初始默认参数',
        operator: '训练教练老唐',
        saveTime: new Date().toISOString(),
        changeNote: '系统初始化默认参数',
        thresholdPass: 45,
        thresholdWarn: 35,
        thresholdBgNoise: 10,
        wallDensity: 480,
        tlCoefficient: 22,
        roomVolume: 33.6,
        avgAbsorption: 0.15
    };

    let state = {
        experimentData: [],
        paramVersions: [],
        currentParams: null,
        calcHistory: [],
        sourceInfo: {
            dataSource: '',
            workCondition: '',
            photoReference: ''
        },
        currentCalcResult: null,
        charts: {},
        selectedParamVersionId: null,
        selectedHistoryForCompare: [],
        selectedHistoryForReport: null
    };

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function formatDateTime(isoString) {
        const d = new Date(isoString);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }

    function formatTime(isoString) {
        const d = new Date(isoString);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    function createSampleData() {
        const now = new Date();
        const baseTime = now.getTime();

        return [
            { id: generateId(), frequency: 63, indoorLp: 95, outdoorLp: 52, bgNoise: 38, position: '东墙外侧1m', measureTime: new Date(baseTime - 7 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 125, indoorLp: 98, outdoorLp: 55, bgNoise: 35, position: '东墙外侧1m', measureTime: new Date(baseTime - 6 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 250, indoorLp: 102, outdoorLp: 58, bgNoise: 32, position: '东墙外侧1m', measureTime: new Date(baseTime - 5 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 500, indoorLp: 105, outdoorLp: 62, bgNoise: 30, position: '东墙外侧1m', measureTime: new Date(baseTime - 4 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 1000, indoorLp: 108, outdoorLp: 68, bgNoise: 28, position: '东墙外侧1m', measureTime: new Date(baseTime - 3 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 2000, indoorLp: 106, outdoorLp: 72, bgNoise: 26, position: '东墙外侧1m', measureTime: new Date(baseTime - 2 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 4000, indoorLp: 102, outdoorLp: 70, bgNoise: 25, position: '东墙外侧1m', measureTime: new Date(baseTime - 1 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 8000, indoorLp: 98, outdoorLp: 65, bgNoise: 24, position: '东墙外侧1m', measureTime: new Date(baseTime).toISOString(), notes: '' },
            
            { id: generateId(), frequency: 63, indoorLp: null, outdoorLp: 54, bgNoise: 38, position: '西墙外侧1m', measureTime: new Date(baseTime + 1 * 60000).toISOString(), notes: '空值：仪器信号丢失' },
            { id: generateId(), frequency: 125, indoorLp: 97, outdoorLp: 56, bgNoise: 35, position: '西墙外侧1m', measureTime: new Date(baseTime + 2 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 250, indoorLp: 101, outdoorLp: 66, bgNoise: 32, position: '西墙外侧1m', measureTime: new Date(baseTime + 3 * 60000).toISOString(), notes: '边界：TL=35，恰好在预警阈值' },
            { id: generateId(), frequency: 500, indoorLp: 104, outdoorLp: 63, bgNoise: 30, position: '西墙外侧1m', measureTime: new Date(baseTime + 4 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 500, indoorLp: 104, outdoorLp: 63, bgNoise: 30, position: '西墙外侧1m', measureTime: new Date(baseTime + 4 * 60000).toISOString(), notes: '重复项：与上一条完全相同' },
            { id: generateId(), frequency: 1000, indoorLp: 107, outdoorLp: 69, bgNoise: 28, position: '西墙外侧1m', measureTime: new Date(baseTime + 5 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 2000, indoorLp: 105, outdoorLp: 73, bgNoise: 26, position: '西墙外侧1m', measureTime: new Date(baseTime + 6 * 60000).toISOString(), notes: '' },
            { id: generateId(), frequency: 4000, indoorLp: '', outdoorLp: 71, bgNoise: 25, position: '西墙外侧1m', measureTime: new Date(baseTime + 7 * 60000).toISOString(), notes: '空值：空字符串' },
            { id: generateId(), frequency: 8000, indoorLp: 99, outdoorLp: 66, bgNoise: 24, position: '西墙外侧1m', measureTime: new Date(baseTime + 8 * 60000).toISOString(), notes: '' }
        ];
    }

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEYS.EXPERIMENT_DATA, JSON.stringify(state.experimentData));
        localStorage.setItem(STORAGE_KEYS.PARAM_VERSIONS, JSON.stringify(state.paramVersions));
        localStorage.setItem(STORAGE_KEYS.CURRENT_PARAMS, JSON.stringify(state.currentParams));
        localStorage.setItem(STORAGE_KEYS.CALC_HISTORY, JSON.stringify(state.calcHistory));
        localStorage.setItem(STORAGE_KEYS.SOURCE_INFO, JSON.stringify(state.sourceInfo));
    }

    function loadFromStorage() {
        try {
            const expData = localStorage.getItem(STORAGE_KEYS.EXPERIMENT_DATA);
            const paramVers = localStorage.getItem(STORAGE_KEYS.PARAM_VERSIONS);
            const currParams = localStorage.getItem(STORAGE_KEYS.CURRENT_PARAMS);
            const calcHist = localStorage.getItem(STORAGE_KEYS.CALC_HISTORY);
            const srcInfo = localStorage.getItem(STORAGE_KEYS.SOURCE_INFO);

            if (expData) state.experimentData = JSON.parse(expData);
            if (paramVers) state.paramVersions = JSON.parse(paramVers);
            if (currParams) state.currentParams = JSON.parse(currParams);
            if (calcHist) state.calcHistory = JSON.parse(calcHist);
            if (srcInfo) state.sourceInfo = JSON.parse(srcInfo);

            if (state.paramVersions.length === 0) {
                state.paramVersions.push({ ...DEFAULT_PARAMS, id: generateId() });
                state.currentParams = state.paramVersions[0];
            }

            if (!state.currentParams) {
                state.currentParams = state.paramVersions[state.paramVersions.length - 1];
            }
        } catch (e) {
            console.error('加载存储数据失败:', e);
            state.paramVersions = [{ ...DEFAULT_PARAMS, id: generateId() }];
            state.currentParams = state.paramVersions[0];
        }
    }

    function checkDataQuality() {
        const report = [];
        let emptyCount = 0;
        let duplicateCount = 0;
        let boundaryCount = 0;
        let validCount = 0;

        const seen = new Map();

        state.experimentData.forEach((row, index) => {
            const hasEmpty = row.indoorLp === null || row.indoorLp === '' || 
                           row.outdoorLp === null || row.outdoorLp === '' ||
                           row.bgNoise === null || row.bgNoise === '';

            if (hasEmpty) {
                emptyCount++;
            } else {
                validCount++;
            }

            const key = `${row.frequency}-${row.indoorLp}-${row.outdoorLp}-${row.bgNoise}-${row.position}`;
            if (seen.has(key)) {
                duplicateCount++;
                row._isDuplicate = true;
                row._dupOf = seen.get(key) + 1;
            } else {
                seen.set(key, index);
                row._isDuplicate = false;
            }

            if (!hasEmpty && row.indoorLp !== '' && row.outdoorLp !== '') {
                const tl = Number(row.indoorLp) - Number(row.outdoorLp);
                if (Math.abs(tl - state.currentParams.thresholdWarn) < 0.5 ||
                    Math.abs(tl - state.currentParams.thresholdPass) < 0.5) {
                    boundaryCount++;
                    row._isBoundary = true;
                } else {
                    row._isBoundary = false;
                }
            } else {
                row._isBoundary = false;
            }
        });

        report.push({ type: 'info', text: `总记录数：${state.experimentData.length} 条` });
        report.push({ type: 'success', text: `有效记录：${validCount} 条` });
        
        if (emptyCount > 0) {
            report.push({ type: 'warning', text: `空值记录：${emptyCount} 条（已高亮标记）` });
        } else {
            report.push({ type: 'success', text: `空值记录：0 条` });
        }

        if (duplicateCount > 0) {
            report.push({ type: 'error', text: `重复记录：${duplicateCount} 条（已高亮标记）` });
        } else {
            report.push({ type: 'success', text: `重复记录：0 条` });
        }

        if (boundaryCount > 0) {
            report.push({ type: 'warning', text: `边界记录：${boundaryCount} 条（TL接近阈值）` });
        } else {
            report.push({ type: 'success', text: `边界记录：0 条` });
        }

        return report;
    }

    function renderDataQualityReport(report) {
        const container = document.getElementById('qualityReport');
        container.innerHTML = '';
        
        report.forEach(item => {
            const span = document.createElement('span');
            span.className = `quality-item ${item.type}`;
            span.textContent = item.text;
            container.appendChild(span);
        });
    }

    function renderDataTable() {
        const tbody = document.getElementById('dataTableBody');
        tbody.innerHTML = '';

        state.experimentData.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            const isEmpty = row.indoorLp === null || row.indoorLp === '' || 
                          row.outdoorLp === null || row.outdoorLp === '' ||
                          row.bgNoise === null || row.bgNoise === '';

            let rowClass = '';
            if (row._isDuplicate) rowClass = 'duplicate-cell';
            else if (isEmpty) rowClass = 'empty-cell';
            else if (row._isBoundary) rowClass = 'border-cell';

            tr.innerHTML = `
                <td>${index + 1}${row._isDuplicate ? `<br><small style="color:#c0392b">(与第${row._dupOf}条重复)</small>` : ''}</td>
                <td>
                    <select data-field="frequency" data-id="${row.id}">
                        ${FREQUENCIES.map(f => `<option value="${f}" ${row.frequency === f ? 'selected' : ''}>${f}</option>`).join('')}
                    </select>
                </td>
                <td class="${isEmpty && (row.indoorLp === null || row.indoorLp === '') ? 'empty-cell' : ''}">
                    <input type="number" data-field="indoorLp" data-id="${row.id}" value="${row.indoorLp !== null && row.indoorLp !== '' ? row.indoorLp : ''}" placeholder="--">
                </td>
                <td class="${isEmpty && (row.outdoorLp === null || row.outdoorLp === '') ? 'empty-cell' : ''}">
                    <input type="number" data-field="outdoorLp" data-id="${row.id}" value="${row.outdoorLp !== null && row.outdoorLp !== '' ? row.outdoorLp : ''}" placeholder="--">
                </td>
                <td class="${isEmpty && (row.bgNoise === null || row.bgNoise === '') ? 'empty-cell' : ''}">
                    <input type="number" data-field="bgNoise" data-id="${row.id}" value="${row.bgNoise !== null && row.bgNoise !== '' ? row.bgNoise : ''}" placeholder="--">
                </td>
                <td><input type="text" data-field="position" data-id="${row.id}" value="${row.position || ''}"></td>
                <td><input type="text" data-field="measureTime" data-id="${row.id}" value="${row.measureTime ? formatDateTime(row.measureTime) : ''}" readonly></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="DrumRoomApp.deleteRow('${row.id}')">删除</button>
                </td>
            `;

            if (rowClass) {
                tr.querySelectorAll('td').forEach(td => {
                    if (!td.classList.contains('empty-cell') && !td.classList.contains('duplicate-cell')) {
                        td.classList.add(rowClass);
                    }
                });
            }

            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', handleDataChange);
            if (input.type === 'number') {
                input.addEventListener('focus', function() { this.select(); });
            }
        });

        const qualityReport = checkDataQuality();
        renderDataQualityReport(qualityReport);
    }

    function handleDataChange(e) {
        const id = e.target.dataset.id;
        const field = e.target.dataset.field;
        let value = e.target.value;

        if (field === 'indoorLp' || field === 'outdoorLp' || field === 'bgNoise') {
            if (value === '' || value === null) {
                value = '';
            } else {
                value = Number(value);
            }
        }

        const row = state.experimentData.find(r => r.id === id);
        if (row) {
            row[field] = value;
            saveToStorage();
            renderDataTable();
        }
    }

    function calculateNoiseCorrection(snr) {
        if (snr >= 15) return 0;
        if (snr >= 10) return -1;
        if (snr >= 6) return -2;
        if (snr >= 3) return -3;
        return null;
    }

    function calculateTheoreticalTL(frequency, wallDensity, tlCoefficient) {
        return tlCoefficient + 20 * Math.log10(frequency / 500) + 20 * Math.log10(wallDensity / 100);
    }

    function calculateSoundInsulation(params) {
        const logs = [];
        const results = [];
        const startTime = new Date();

        logs.push({
            time: formatTime(startTime.toISOString()),
            level: 'INFO',
            message: `=== 开始"鼓房隔音衰减估算"计算 ===`
        });

        logs.push({
            time: formatTime(startTime.toISOString()),
            level: 'INFO',
            message: `使用参数版本：${params.version} (${params.versionName})`
        });

        logs.push({
            time: formatTime(startTime.toISOString()),
            level: 'INFO',
            message: `合格阈值：${params.thresholdPass}dB，预警阈值：${params.thresholdWarn}dB，背景噪声修正阈值：${params.thresholdBgNoise}dB`
        });

        logs.push({
            time: formatTime(startTime.toISOString()),
            level: 'INFO',
            message: `墙体面密度：${params.wallDensity}kg/m²，TL系数：${params.tlCoefficient}，房间容积：${params.roomVolume}m³`
        });

        logs.push({
            time: formatTime(startTime.toISOString()),
            level: 'CHECK',
            message: `待处理记录共 ${state.experimentData.length} 条，开始逐条校验...`
        });

        let passCount = 0;
        let warnCount = 0;
        let failCount = 0;
        let anomalyCount = 0;
        let tlValues = [];
        let validFrequencies = [];

        state.experimentData.forEach((row, idx) => {
            const rowLogs = [];
            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'INFO',
                message: `--- 处理第 ${idx + 1} 条记录 [${row.frequency}Hz] ---`
            });

            if (row.indoorLp === null || row.indoorLp === '' || 
                row.outdoorLp === null || row.outdoorLp === '' ||
                row.bgNoise === null || row.bgNoise === '') {
                
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ALERT',
                    message: `检测到空值：室内Lp=${row.indoorLp}, 室外Lp=${row.outdoorLp}, 背景噪声=${row.bgNoise}`
                });

                results.push({
                    ...row,
                    rawTL: null,
                    correctedTL: null,
                    theoreticalTL: null,
                    snr: null,
                    bgCorrection: null,
                    deviation: null,
                    judgment: '数据缺失',
                    judgmentClass: 'judgment-fail',
                    basis: '存在空值，无法计算隔声量',
                    anomaly: true,
                    logs: rowLogs
                });

                logs.push(...rowLogs);
                logs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ERROR',
                    message: `第 ${idx + 1} 条：数据缺失，判定为异常`
                });
                anomalyCount++;
                return;
            }

            if (row._isDuplicate) {
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ALERT',
                    message: `检测到重复记录：与第 ${row._dupOf} 条数据完全相同`
                });
            }

            const indoorLp = Number(row.indoorLp);
            const outdoorLp = Number(row.outdoorLp);
            const bgNoise = Number(row.bgNoise);

            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `原始数据：室内Lp=${indoorLp}dB, 室外Lp=${outdoorLp}dB, 背景噪声=${bgNoise}dB`
            });

            const snr = outdoorLp - bgNoise;
            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `信噪比(SNR) = ${outdoorLp} - ${bgNoise} = ${snr.toFixed(1)}dB`
            });

            const bgCorrection = calculateNoiseCorrection(snr);
            let correctedOutdoorLp = outdoorLp;
            let correctionApplied = false;

            if (bgCorrection === null) {
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ALERT',
                    message: `信噪比 ${snr.toFixed(1)}dB < 3dB，背景噪声过大，无法可靠修正`
                });

                results.push({
                    ...row,
                    rawTL: indoorLp - outdoorLp,
                    correctedTL: null,
                    theoreticalTL: calculateTheoreticalTL(row.frequency, params.wallDensity, params.tlCoefficient),
                    snr: snr,
                    bgCorrection: null,
                    deviation: null,
                    judgment: '背景噪声过大',
                    judgmentClass: 'judgment-fail',
                    basis: `SNR=${snr.toFixed(1)}dB < 3dB，无法可靠修正`,
                    anomaly: true,
                    logs: rowLogs
                });

                logs.push(...rowLogs);
                logs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ERROR',
                    message: `第 ${idx + 1} 条：背景噪声过大，判定为异常`
                });
                anomalyCount++;
                return;
            } else if (bgCorrection !== 0) {
                correctedOutdoorLp = outdoorLp + bgCorrection;
                correctionApplied = true;
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ALERT',
                    message: `信噪比 ${snr.toFixed(1)}dB < 15dB，应用背景噪声修正 ${bgCorrection}dB`
                });
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'CHECK',
                    message: `修正后室外Lp = ${outdoorLp} + (${bgCorrection}) = ${correctedOutdoorLp}dB`
                });
            } else {
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'CHECK',
                    message: `信噪比 ${snr.toFixed(1)}dB ≥ 15dB，无需背景噪声修正`
                });
            }

            const rawTL = indoorLp - outdoorLp;
            const correctedTL = indoorLp - correctedOutdoorLp;
            const theoreticalTL = calculateTheoreticalTL(row.frequency, params.wallDensity, params.tlCoefficient);
            const deviation = correctedTL - theoreticalTL;

            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `原始隔声量TL = ${indoorLp} - ${outdoorLp} = ${rawTL.toFixed(1)}dB`
            });
            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `修正后隔声量TL = ${indoorLp} - ${correctedOutdoorLp} = ${correctedTL.toFixed(1)}dB`
            });
            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `理论隔声量TL(质量定律) = ${theoreticalTL.toFixed(1)}dB`
            });
            rowLogs.push({
                time: formatTime(new Date().toISOString()),
                level: 'CHECK',
                message: `实测与理论偏差 = ${correctedTL.toFixed(1)} - ${theoreticalTL.toFixed(1)} = ${deviation.toFixed(1)}dB`
            });

            let judgment, judgmentClass, basis;

            if (correctedTL >= params.thresholdPass) {
                judgment = '合格';
                judgmentClass = 'judgment-pass';
                passCount++;
                basis = `TL=${correctedTL.toFixed(1)}dB ≥ 合格阈值${params.thresholdPass}dB`;
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'DECIDE',
                    message: `判定：合格 (${basis})`
                });
            } else if (correctedTL >= params.thresholdWarn) {
                if (Math.abs(correctedTL - params.thresholdPass) < 0.5) {
                    judgment = '边界-合格';
                    judgmentClass = 'judgment-border';
                    basis = `TL=${correctedTL.toFixed(1)}dB 接近合格阈值${params.thresholdPass}dB，建议复测`;
                } else if (Math.abs(correctedTL - params.thresholdWarn) < 0.5) {
                    judgment = '边界-预警';
                    judgmentClass = 'judgment-border';
                    basis = `TL=${correctedTL.toFixed(1)}dB 接近预警阈值${params.thresholdWarn}dB，建议关注`;
                } else {
                    judgment = '预警';
                    judgmentClass = 'judgment-warn';
                    basis = `预警阈值${params.thresholdWarn}dB ≤ TL=${correctedTL.toFixed(1)}dB < 合格阈值${params.thresholdPass}dB`;
                }
                warnCount++;
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'DECIDE',
                    message: `判定：${judgment} (${basis})`
                });
            } else {
                judgment = '不合格';
                judgmentClass = 'judgment-fail';
                failCount++;
                basis = `TL=${correctedTL.toFixed(1)}dB < 预警阈值${params.thresholdWarn}dB`;
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'DECIDE',
                    message: `判定：不合格 (${basis})`
                });
            }

            if (Math.abs(deviation) > 10) {
                basis += `；注意：与理论值偏差${deviation.toFixed(1)}dB > 10dB，可能存在声学缺陷`;
                rowLogs.push({
                    time: formatTime(new Date().toISOString()),
                    level: 'ALERT',
                    message: `偏差超过10dB，可能存在声学缺陷或测量误差`
                });
            }

            if (correctionApplied) {
                basis += `；已应用背景噪声修正${bgCorrection}dB`;
            }

            if (row._isDuplicate) {
                basis += `；该条为重复记录（与第${row._dupOf}条重复）`;
            }

            if (row.notes) {
                basis += `；备注：${row.notes}`;
            }

            tlValues.push(correctedTL);
            validFrequencies.push(row.frequency);

            results.push({
                ...row,
                rawTL: rawTL,
                correctedTL: correctedTL,
                theoreticalTL: theoreticalTL,
                snr: snr,
                bgCorrection: bgCorrection,
                deviation: deviation,
                judgment: judgment,
                judgmentClass: judgmentClass,
                basis: basis,
                anomaly: judgment === '不合格' || judgment === '背景噪声过大' || judgment === '数据缺失',
                logs: rowLogs
            });

            logs.push(...rowLogs);
        });

        const avgTL = tlValues.length > 0 ? tlValues.reduce((a, b) => a + b, 0) / tlValues.length : 0;
        
        const rw = calculateWeightedTL(validFrequencies, tlValues);

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;

        logs.push({
            time: formatTime(endTime.toISOString()),
            level: 'INFO',
            message: `=== "鼓房隔音衰减估算"计算完成 ===`
        });
        logs.push({
            time: formatTime(endTime.toISOString()),
            level: 'INFO',
            message: `统计结果：合格${passCount}条，预警${warnCount}条，不合格${failCount}条，异常${anomalyCount}条`
        });
        logs.push({
            time: formatTime(endTime.toISOString()),
            level: 'INFO',
            message: `平均隔声量：${avgTL.toFixed(1)}dB，加权隔声量Rw：${rw}dB`
        });
        logs.push({
            time: formatTime(endTime.toISOString()),
            level: 'INFO',
            message: `计算耗时：${duration.toFixed(3)}秒`
        });

        return {
            id: generateId(),
            calcTime: endTime.toISOString(),
            calcDuration: duration,
            params: { ...params },
            sourceInfo: { ...state.sourceInfo },
            rawData: JSON.parse(JSON.stringify(state.experimentData)),
            results: results,
            summary: {
                avgTL: avgTL,
                weightedTL: rw,
                passCount: passCount,
                warnCount: warnCount,
                failCount: failCount,
                anomalyCount: anomalyCount,
                totalCount: state.experimentData.length
            },
            logs: logs
        };
    }

    function calculateWeightedTL(frequencies, tlValues) {
        if (frequencies.length === 0 || tlValues.length === 0) return 0;

        const referenceCurve = {
            63: 22, 125: 28, 250: 34, 500: 40,
            1000: 45, 2000: 50, 4000: 54, 8000: 57
        };

        let rw = 20;
        while (rw <= 80) {
            let deficitSum = 0;
            let maxDeficit = 0;
            
            frequencies.forEach((freq, i) => {
                const ref = referenceCurve[freq] + rw - 50;
                const deficit = Math.max(0, ref - tlValues[i]);
                deficitSum += deficit;
                maxDeficit = Math.max(maxDeficit, deficit);
            });

            if (deficitSum > 32 || maxDeficit > 8) {
                rw--;
                break;
            }
            rw++;
        }

        return rw;
    }

    function renderCalcResult(result) {
        state.currentCalcResult = result;

        document.getElementById('avgTL').textContent = `${result.summary.avgTL.toFixed(1)} dB`;
        document.getElementById('weightedTL').textContent = `${result.summary.weightedTL} dB`;
        document.getElementById('passCount').textContent = `${result.summary.passCount} / ${result.summary.totalCount}`;
        document.getElementById('anomalyCount').textContent = result.summary.anomalyCount;
        document.getElementById('calcTime').textContent = formatDateTime(result.calcTime);

        document.getElementById('calcParamVersion').textContent = `使用参数版本：${result.params.version} (${result.params.versionName})`;

        renderResultTable(result.results);
        renderJudgmentLog(result.logs);
        renderTLChart(result.results);
    }

    function renderResultTable(results) {
        const tbody = document.getElementById('resultTableBody');
        tbody.innerHTML = '';

        results.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.frequency}Hz</td>
                <td>${row.indoorLp !== null && row.indoorLp !== '' ? row.indoorLp : '<span style="color:#c0392b">缺失</span>'}</td>
                <td>${row.outdoorLp !== null && row.outdoorLp !== '' ? row.outdoorLp : '<span style="color:#c0392b">缺失</span>'}</td>
                <td>${row.bgNoise !== null && row.bgNoise !== '' ? row.bgNoise : '<span style="color:#c0392b">缺失</span>'}</td>
                <td>${row.snr !== null ? row.snr.toFixed(1) : '--'}</td>
                <td><strong>${row.correctedTL !== null ? row.correctedTL.toFixed(1) : '--'}</strong></td>
                <td>${row.theoreticalTL !== null ? row.theoreticalTL.toFixed(1) : '--'}</td>
                <td class="${row.deviation !== null && row.deviation > 10 ? 'delta-negative' : row.deviation !== null && row.deviation < -10 ? 'delta-negative' : 'delta-zero'}">
                    ${row.deviation !== null ? (row.deviation > 0 ? '+' : '') + row.deviation.toFixed(1) : '--'}
                </td>
                <td><span class="${row.judgmentClass}">${row.judgment}</span></td>
                <td style="font-size:11px;color:#666;max-width:300px;">${row.basis}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderJudgmentLog(logs) {
        const container = document.getElementById('judgmentLog');
        container.innerHTML = '';

        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = `
                <span class="log-time">[${log.time}]</span>
                <span class="log-level ${log.level}">${log.level}</span>
                <span class="log-message">${log.message}</span>
            `;
            container.appendChild(div);
        });

        container.scrollTop = container.scrollHeight;
    }

    function renderTLChart(results) {
        const validResults = results.filter(r => r.correctedTL !== null);
        const labels = validResults.map(r => r.frequency + 'Hz');
        const tlData = validResults.map(r => r.correctedTL);
        const theoreticalData = validResults.map(r => r.theoreticalTL);

        const params = state.currentParams;

        if (state.charts.tlChart) {
            state.charts.tlChart.destroy();
        }

        const ctx = document.getElementById('tlChart').getContext('2d');
        state.charts.tlChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '实测隔声量 (dB)',
                        data: tlData,
                        borderColor: '#2a5298',
                        backgroundColor: 'rgba(42, 82, 152, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.2,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    },
                    {
                        label: '理论隔声量 (dB)',
                        data: theoreticalData,
                        borderColor: '#e67e22',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        tension: 0.2,
                        pointRadius: 4
                    },
                    {
                        label: `合格阈值 (${params.thresholdPass}dB)`,
                        data: tlData.map(() => params.thresholdPass),
                        borderColor: '#27ae60',
                        borderDash: [10, 5],
                        borderWidth: 1,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: `预警阈值 (${params.thresholdWarn}dB)`,
                        data: tlData.map(() => params.thresholdWarn),
                        borderColor: '#f39c12',
                        borderDash: [10, 5],
                        borderWidth: 1,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        min: 20,
                        max: 80,
                        title: {
                            display: true,
                            text: '隔声量 (dB)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '频率 (Hz)'
                        }
                    }
                }
            }
        });
    }

    function renderParamVersions() {
        const tbody = document.getElementById('paramHistoryBody');
        tbody.innerHTML = '';

        state.paramVersions.slice().reverse().forEach(version => {
            const isCurrent = version.id === state.currentParams.id;
            const tr = document.createElement('tr');
            if (isCurrent) {
                tr.style.background = '#e8f4fd';
            }
            tr.innerHTML = `
                <td>
                    <input type="radio" name="paramVersion" value="${version.id}" 
                           ${state.selectedParamVersionId === version.id ? 'checked' : ''}>
                </td>
                <td><strong>${version.version}</strong></td>
                <td>${formatDateTime(version.saveTime)}</td>
                <td>${version.operator}</td>
                <td>${version.thresholdPass}dB</td>
                <td>${version.thresholdWarn}dB</td>
                <td style="max-width:200px;font-size:12px;color:#666;">${version.changeNote || '-'}</td>
                <td>
                    ${isCurrent ? '<span class="quality-item success">当前使用</span>' : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('input[name="paramVersion"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.selectedParamVersionId = e.target.value;
            });
        });

        updateVersionBadge();
    }

    function updateVersionBadge() {
        const badge = document.getElementById('currentVersionBadge');
        if (state.currentParams) {
            badge.textContent = `当前版本：${state.currentParams.version} (${state.currentParams.versionName})`;
        }
    }

    function readParamsFromForm() {
        return {
            thresholdPass: Number(document.getElementById('thresholdPass').value),
            thresholdWarn: Number(document.getElementById('thresholdWarn').value),
            thresholdBgNoise: Number(document.getElementById('thresholdBgNoise').value),
            wallDensity: Number(document.getElementById('wallDensity').value),
            tlCoefficient: Number(document.getElementById('tlCoefficient').value),
            roomVolume: Number(document.getElementById('roomVolume').value),
            avgAbsorption: Number(document.getElementById('avgAbsorption').value)
        };
    }

    function loadParamsToForm(params) {
        document.getElementById('thresholdPass').value = params.thresholdPass;
        document.getElementById('thresholdWarn').value = params.thresholdWarn;
        document.getElementById('thresholdBgNoise').value = params.thresholdBgNoise;
        document.getElementById('wallDensity').value = params.wallDensity;
        document.getElementById('tlCoefficient').value = params.tlCoefficient;
        document.getElementById('roomVolume').value = params.roomVolume;
        document.getElementById('avgAbsorption').value = params.avgAbsorption;
    }

    function saveNewParamVersion() {
        const formParams = readParamsFromForm();
        const changeNote = document.getElementById('paramChangeNote').value.trim();

        if (!changeNote) {
            showToast('请填写修改说明，这是追溯的重要依据！', 'warning');
            return;
        }

        const lastVersion = state.paramVersions[state.paramVersions.length - 1];
        const versionNum = parseFloat(lastVersion.version.replace('v', '')) + 0.1;
        const newVersion = {
            id: generateId(),
            version: 'v' + versionNum.toFixed(1),
            versionName: changeNote.substring(0, 20) + (changeNote.length > 20 ? '...' : ''),
            operator: '训练教练老唐',
            saveTime: new Date().toISOString(),
            changeNote: changeNote,
            ...formParams
        };

        state.paramVersions.push(newVersion);
        state.currentParams = newVersion;
        saveToStorage();

        document.getElementById('paramChangeNote').value = '';
        renderParamVersions();
        showToast(`参数版本 ${newVersion.version} 已保存，后续计算将使用此版本`, 'success');
    }

    function restoreSelectedParamVersion() {
        if (!state.selectedParamVersionId) {
            showToast('请先选择要恢复的参数版本', 'warning');
            return;
        }

        const version = state.paramVersions.find(v => v.id === state.selectedParamVersionId);
        if (version) {
            state.currentParams = version;
            loadParamsToForm(version);
            saveToStorage();
            renderParamVersions();
            showToast(`已恢复到参数版本 ${version.version}`, 'success');
        }
    }

    function renderCalcHistory() {
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        const select = document.getElementById('reportHistorySelect');
        select.innerHTML = '<option value="">选择计算记录生成报告...</option>';

        state.calcHistory.slice().reverse().forEach((record, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="compare-checkbox" value="${record.id}"
                           ${state.selectedHistoryForCompare.includes(record.id) ? 'checked' : ''}>
                </td>
                <td><strong>#${state.calcHistory.length - idx}</strong></td>
                <td>${formatDateTime(record.calcTime)}</td>
                <td>${record.params.version}</td>
                <td style="max-width:150px;font-size:12px;">${record.sourceInfo.dataSource || '-'}</td>
                <td>${record.summary.avgTL.toFixed(1)}dB</td>
                <td>${record.summary.weightedTL}dB</td>
                <td>
                    <span class="quality-item ${record.summary.anomalyCount > 0 ? 'error' : 'success'}">
                        ${record.summary.anomalyCount}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="DrumRoomApp.loadCalcResult('${record.id}')">查看</button>
                    <button class="btn btn-danger btn-sm" onclick="DrumRoomApp.deleteCalcResult('${record.id}')">删除</button>
                </td>
            `;
            tbody.appendChild(tr);

            const option = document.createElement('option');
            option.value = record.id;
            option.textContent = `#${state.calcHistory.length - idx} - ${formatDateTime(record.calcTime)} - ${record.params.version}`;
            select.appendChild(option);
        });

        tbody.querySelectorAll('.compare-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.value;
                if (e.target.checked) {
                    if (state.selectedHistoryForCompare.length < 2) {
                        state.selectedHistoryForCompare.push(id);
                    } else {
                        e.target.checked = false;
                        showToast('最多只能选择2条记录进行对比', 'warning');
                    }
                } else {
                    state.selectedHistoryForCompare = state.selectedHistoryForCompare.filter(i => i !== id);
                }
            });
        });
    }

    function loadCalcResult(id) {
        const record = state.calcHistory.find(r => r.id === id);
        if (record) {
            state.currentParams = record.params;
            state.experimentData = JSON.parse(JSON.stringify(record.rawData));
            state.sourceInfo = { ...record.sourceInfo };
            
            document.getElementById('dataSource').value = state.sourceInfo.dataSource || '';
            document.getElementById('workCondition').value = state.sourceInfo.workCondition || '';
            document.getElementById('photoReference').value = state.sourceInfo.photoReference || '';
            
            loadParamsToForm(record.params);
            renderDataTable();
            renderParamVersions();
            renderCalcResult(record);
            
            document.querySelector('[data-tab="calculate"]').click();
            showToast('已加载历史计算结果', 'success');
        }
    }

    function deleteCalcResult(id) {
        if (confirm('确定要删除这条计算记录吗？此操作不可恢复。')) {
            state.calcHistory = state.calcHistory.filter(r => r.id !== id);
            state.selectedHistoryForCompare = state.selectedHistoryForCompare.filter(i => i !== id);
            saveToStorage();
            renderCalcHistory();
            showToast('计算记录已删除', 'success');
        }
    }

    function compareSelectedHistory() {
        if (state.selectedHistoryForCompare.length !== 2) {
            showToast('请选择恰好2条记录进行对比', 'warning');
            return;
        }

        const [idA, idB] = state.selectedHistoryForCompare;
        const recordA = state.calcHistory.find(r => r.id === idA);
        const recordB = state.calcHistory.find(r => r.id === idB);

        if (!recordA || !recordB) return;

        document.getElementById('compareArea').classList.remove('hidden');
        document.getElementById('compareTitleA').textContent = `A: ${formatDateTime(recordA.calcTime)} (${recordA.params.version})`;
        document.getElementById('compareTitleB').textContent = `B: ${formatDateTime(recordB.calcTime)} (${recordB.params.version})`;

        renderCompareChart('compareChartA', recordA, 'A');
        renderCompareChart('compareChartB', recordB, 'B');
        renderCompareTable(recordA, recordB);
    }

    function renderCompareChart(canvasId, record, label) {
        if (state.charts[canvasId]) {
            state.charts[canvasId].destroy();
        }

        const validResults = record.results.filter(r => r.correctedTL !== null);
        const labels = validResults.map(r => r.frequency + 'Hz');
        const tlData = validResults.map(r => r.correctedTL);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const color = label === 'A' ? '#2a5298' : '#e74c3c';

        state.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `隔声量${label} (dB)`,
                    data: tlData,
                    borderColor: color,
                    backgroundColor: color.replace(')', ', 0.1)').replace('rgb', 'rgba'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        min: 20,
                        max: 80,
                        title: {
                            display: true,
                            text: '隔声量 (dB)'
                        }
                    }
                }
            }
        });
    }

    function renderCompareTable(recordA, recordB) {
        const tbody = document.getElementById('compareTableBody');
        tbody.innerHTML = '';

        const freqMap = new Map();
        recordA.results.forEach(r => freqMap.set(r.frequency, { a: r }));
        recordB.results.forEach(r => {
            const existing = freqMap.get(r.frequency) || {};
            existing.b = r;
            freqMap.set(r.frequency, existing);
        });

        const versionA = recordA.params.version;
        const versionB = recordB.params.version;

        freqMap.forEach((pair, freq) => {
            const a = pair.a;
            const b = pair.b;
            const tlA = a && a.correctedTL !== null ? a.correctedTL : null;
            const tlB = b && b.correctedTL !== null ? b.correctedTL : null;
            const delta = (tlA !== null && tlB !== null) ? (tlB - tlA) : null;

            let deltaClass = 'delta-zero';
            let deltaText = '--';
            if (delta !== null) {
                if (delta > 0) {
                    deltaClass = 'delta-positive';
                    deltaText = '+' + delta.toFixed(1);
                } else if (delta < 0) {
                    deltaClass = 'delta-negative';
                    deltaText = delta.toFixed(1);
                } else {
                    deltaText = '0.0';
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${freq}Hz</strong></td>
                <td>${tlA !== null ? tlA.toFixed(1) : '--'}</td>
                <td>${a ? `<span class="${a.judgmentClass}">${a.judgment}</span>` : '--'}</td>
                <td>${versionA}</td>
                <td>${tlB !== null ? tlB.toFixed(1) : '--'}</td>
                <td>${b ? `<span class="${b.judgmentClass}">${b.judgment}</span>` : '--'}</td>
                <td>${versionB}</td>
                <td class="${deltaClass}">${deltaText} dB</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function generateReport() {
        const select = document.getElementById('reportHistorySelect');
        const recordId = select.value;

        if (!recordId && !state.currentCalcResult) {
            showToast('请先选择计算记录或进行一次计算', 'warning');
            return;
        }

        const record = recordId ? state.calcHistory.find(r => r.id === recordId) : state.currentCalcResult;
        if (!record) return;

        const container = document.getElementById('reportContent');
        container.innerHTML = '';

        const doc = document.createElement('div');
        doc.className = 'report-document';

        doc.innerHTML = `
            <h1>鼓房隔音衰减估算实验报告</h1>
            
            <div class="report-meta">
                <div class="report-meta-item"><strong>报告编号：</strong>${record.id.substring(0, 8).toUpperCase()}</div>
                <div class="report-meta-item"><strong>计算时间：</strong>${formatDateTime(record.calcTime)}</div>
                <div class="report-meta-item"><strong>参数版本：</strong>${record.params.version} (${record.params.versionName})</div>
                <div class="report-meta-item"><strong>操作员：</strong>${record.params.operator}</div>
                <div class="report-meta-item"><strong>数据来源：</strong>${record.sourceInfo.dataSource || '-'}</div>
                <div class="report-meta-item"><strong>照片记录：</strong>${record.sourceInfo.photoReference || '-'}</div>
            </div>

            <div class="report-section">
                <h2>一、实验工况</h2>
                <p>${record.sourceInfo.workCondition || '未记录工况信息'}</p>
            </div>

            <div class="report-section">
                <h2>二、计算参数</h2>
                <table class="report-table">
                    <tr><th>参数项</th><th>参数值</th><th>说明</th></tr>
                    <tr><td>合格阈值</td><td>${record.params.thresholdPass} dB</td><td>≥此值判定为合格</td></tr>
                    <tr><td>预警阈值</td><td>${record.params.thresholdWarn} dB</td><td>&lt;此值判定为异常</td></tr>
                    <tr><td>背景噪声修正阈值</td><td>${record.params.thresholdBgNoise} dB</td><td>信噪比不足时启用修正</td></tr>
                    <tr><td>墙体面密度</td><td>${record.params.wallDensity} kg/m²</td><td>240mm红砖约480kg/m²</td></tr>
                    <tr><td>隔声量计算系数</td><td>${record.params.tlCoefficient}</td><td>质量定律经验系数</td></tr>
                    <tr><td>房间容积</td><td>${record.params.roomVolume} m³</td><td></td></tr>
                    <tr><td>室内平均吸声系数</td><td>${record.params.avgAbsorption}</td><td></td></tr>
                    <tr><td>参数修改说明</td><td colspan="2">${record.params.changeNote || '初始默认参数'}</td></tr>
                </table>
            </div>

            <div class="report-section">
                <h2>三、原始实验数据</h2>
                <table class="report-table">
                    <tr>
                        <th>序号</th>
                        <th>频率(Hz)</th>
                        <th>室内Lp(dB)</th>
                        <th>室外Lp(dB)</th>
                        <th>背景噪声(dB)</th>
                        <th>测量位置</th>
                        <th>备注</th>
                    </tr>
                    ${record.rawData.map((row, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${row.frequency}</td>
                        <td>${row.indoorLp !== null && row.indoorLp !== '' ? row.indoorLp : '<span style="color:#c0392b">缺失</span>'}</td>
                        <td>${row.outdoorLp !== null && row.outdoorLp !== '' ? row.outdoorLp : '<span style="color:#c0392b">缺失</span>'}</td>
                        <td>${row.bgNoise !== null && row.bgNoise !== '' ? row.bgNoise : '<span style="color:#c0392b">缺失</span>'}</td>
                        <td>${row.position || '-'}</td>
                        <td style="font-size:11px;color:#666;">${row.notes || '-'}</td>
                    </tr>
                    `).join('')}
                </table>
            </div>

            <div class="report-section">
                <h2>四、计算结果汇总</h2>
                <table class="report-table">
                    <tr><th>指标</th><th>数值</th><th>说明</th></tr>
                    <tr><td>平均隔声量</td><td><strong>${record.summary.avgTL.toFixed(1)} dB</strong></td><td>所有有效频率点的平均值</td></tr>
                    <tr><td>加权隔声量 Rw</td><td><strong>${record.summary.weightedTL} dB</strong></td><td>按GB/T 50121-2005标准计算</td></tr>
                    <tr><td>合格频率点</td><td>${record.summary.passCount} / ${record.summary.totalCount}</td><td>TL ≥ 合格阈值</td></tr>
                    <tr><td>预警频率点</td><td>${record.summary.warnCount} / ${record.summary.totalCount}</td><td>预警阈值 ≤ TL < 合格阈值</td></tr>
                    <tr><td>不合格频率点</td><td>${record.summary.failCount} / ${record.summary.totalCount}</td><td>TL < 预警阈值</td></tr>
                    <tr><td>异常记录</td><td>${record.summary.anomalyCount} / ${record.summary.totalCount}</td><td>含数据缺失、背景噪声过大</td></tr>
                    <tr><td>计算耗时</td><td>${record.calcDuration.toFixed(3)} 秒</td><td></td></tr>
                </table>
            </div>

            <div class="report-section">
                <h2>五、详细判定结果</h2>
                <table class="report-table">
                    <tr>
                        <th>频率(Hz)</th>
                        <th>SNR(dB)</th>
                        <th>修正后TL(dB)</th>
                        <th>理论TL(dB)</th>
                        <th>偏差(dB)</th>
                        <th>判定</th>
                        <th>判定依据</th>
                    </tr>
                    ${record.results.map(row => `
                    <tr>
                        <td>${row.frequency}</td>
                        <td>${row.snr !== null ? row.snr.toFixed(1) : '--'}</td>
                        <td><strong>${row.correctedTL !== null ? row.correctedTL.toFixed(1) : '--'}</strong></td>
                        <td>${row.theoreticalTL !== null ? row.theoreticalTL.toFixed(1) : '--'}</td>
                        <td>${row.deviation !== null ? (row.deviation > 0 ? '+' : '') + row.deviation.toFixed(1) : '--'}</td>
                        <td><span class="${row.judgmentClass}">${row.judgment}</span></td>
                        <td style="font-size:11px;color:#666;">${row.basis}</td>
                    </tr>
                    `).join('')}
                </table>
            </div>

            <div class="report-conclusion">
                <h2 style="margin:0 0 10px 0;font-size:16px;color:#2a5298;">六、结论</h2>
                <p>
                    本次鼓房隔音衰减估算共测量 ${record.summary.totalCount} 个频率点，其中有效数据 ${record.summary.totalCount - record.summary.anomalyCount} 个，
                    平均隔声量 <strong>${record.summary.avgTL.toFixed(1)} dB</strong>，加权隔声量 Rw = <strong>${record.summary.weightedTL} dB</strong>。
                </p>
                <p style="margin-top:10px;">
                    ${record.summary.anomalyCount > 0 
                        ? `<span style="color:#c0392b;"><strong>注意：存在 ${record.summary.anomalyCount} 条异常记录</strong>（含数据缺失、背景噪声过大），建议对异常频率点重新测量。</span>`
                        : '所有记录均有效，数据质量良好。'}
                </p>
                <p style="margin-top:10px;">
                    ${record.summary.failCount > 0 
                        ? `<span style="color:#c0392b;"><strong>存在 ${record.summary.failCount} 个频率点隔声量未达标</strong>（TL < ${record.params.thresholdWarn}dB），建议采取隔音改进措施。</span>`
                        : record.summary.warnCount > 0
                            ? `<span style="color:#856404;"><strong>存在 ${record.summary.warnCount} 个频率点隔声量处于预警区间</strong>，建议关注低频隔声性能。</span>`
                            : '<span style="color:#155724;">所有频率点隔声量均达标，隔音性能良好。</span>'}
                </p>
            </div>

            <div class="report-section">
                <h2>七、判断过程追溯（训练教练老唐专用）</h2>
                <div class="report-trail">
                    ${record.logs.map(log => `
                    <div>[${log.time}] <strong style="color:${log.level === 'ERROR' ? '#c0392b' : log.level === 'ALERT' ? '#e67e22' : log.level === 'DECIDE' ? '#8e44ad' : '#2980b9'}">[${log.level}]</strong> ${log.message}</div>
                    `).join('')}
                </div>
            </div>

            <div style="text-align:right;margin-top:40px;padding-top:20px;border-top:1px solid #e8ecef;color:#95a5a6;font-size:12px;">
                <p>本报告由"鼓房隔音衰减估算"实验数据管理系统自动生成</p>
                <p>生成时间：${formatDateTime(new Date().toISOString())}</p>
            </div>
        `;

        container.appendChild(doc);
    }

    function exportData() {
        const exportObj = {
            sourceInfo: state.sourceInfo,
            experimentData: state.experimentData,
            paramVersions: state.paramVersions,
            calcHistory: state.calcHistory,
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `鼓房隔音实验数据_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('数据已导出', 'success');
    }

    function importFromFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(e.target.result);
                    if (data.experimentData) {
                        state.experimentData = data.experimentData;
                    }
                    if (data.sourceInfo) {
                        state.sourceInfo = data.sourceInfo;
                        document.getElementById('dataSource').value = state.sourceInfo.dataSource || '';
                        document.getElementById('workCondition').value = state.sourceInfo.workCondition || '';
                        document.getElementById('photoReference').value = state.sourceInfo.photoReference || '';
                    }
                    if (data.paramVersions) {
                        state.paramVersions = data.paramVersions;
                        state.currentParams = state.paramVersions[state.paramVersions.length - 1];
                    }
                    if (data.calcHistory) {
                        state.calcHistory = data.calcHistory;
                    }
                    saveToStorage();
                    renderDataTable();
                    renderParamVersions();
                    renderCalcHistory();
                    showToast('JSON数据导入成功', 'success');
                } else if (file.name.endsWith('.csv')) {
                    parseCSV(e.target.result);
                }
            } catch (err) {
                showToast('文件解析失败：' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            showToast('CSV文件格式不正确', 'error');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const newData = [];
        const now = new Date();

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {
                id: generateId(),
                frequency: Number(values[0]) || 1000,
                indoorLp: values[1] ? Number(values[1]) : '',
                outdoorLp: values[2] ? Number(values[2]) : '',
                bgNoise: values[3] ? Number(values[3]) : '',
                position: values[4] || '未指定位置',
                measureTime: new Date(now.getTime() + (i - 1) * 60000).toISOString(),
                notes: values[5] || ''
            };
            newData.push(row);
        }

        state.experimentData = newData;
        saveToStorage();
        renderDataTable();
        showToast(`成功导入 ${newData.length} 条CSV数据`, 'success');
    }

    function addRow() {
        const now = new Date();
        state.experimentData.push({
            id: generateId(),
            frequency: 1000,
            indoorLp: '',
            outdoorLp: '',
            bgNoise: '',
            position: '',
            measureTime: now.toISOString(),
            notes: ''
        });
        saveToStorage();
        renderDataTable();
    }

    function deleteRow(id) {
        if (confirm('确定要删除这条记录吗？')) {
            state.experimentData = state.experimentData.filter(r => r.id !== id);
            saveToStorage();
            renderDataTable();
        }
    }

    function clearData() {
        if (confirm('确定要清空所有实验数据吗？此操作不可恢复。')) {
            state.experimentData = [];
            saveToStorage();
            renderDataTable();
            showToast('数据已清空', 'success');
        }
    }

    function clearHistory() {
        if (confirm('确定要清空所有计算历史吗？此操作不可恢复。')) {
            state.calcHistory = [];
            state.selectedHistoryForCompare = [];
            saveToStorage();
            renderCalcHistory();
            showToast('计算历史已清空', 'success');
        }
    }

    function loadSampleData() {
        if (state.experimentData.length > 0) {
            if (!confirm('当前已有数据，加载样例数据将覆盖现有数据，是否继续？')) {
                return;
            }
        }
        state.experimentData = createSampleData();
        state.sourceInfo = {
            dataSource: '鼓房隔音实验-2024-06-15现场测量（实验记录本第37页）',
            workCondition: '鼓房尺寸：4m×3m×2.8m；墙体结构：240mm红砖+双面抹灰；测量仪器：AWA6228+声级计；环境温度：23℃；湿度：55%',
            photoReference: 'IMG_20240615_1423.jpg, IMG_20240615_1445.jpg'
        };

        document.getElementById('dataSource').value = state.sourceInfo.dataSource;
        document.getElementById('workCondition').value = state.sourceInfo.workCondition;
        document.getElementById('photoReference').value = state.sourceInfo.photoReference;

        saveToStorage();
        renderDataTable();
        showToast('鼓房样例数据已加载，包含空值、重复项和边界记录供测试', 'success');
    }

    function updateSourceInfo() {
        state.sourceInfo = {
            dataSource: document.getElementById('dataSource').value,
            workCondition: document.getElementById('workCondition').value,
            photoReference: document.getElementById('photoReference').value
        };
        saveToStorage();
    }

    function handleCalculate() {
        if (state.experimentData.length === 0) {
            showToast('请先录入实验数据或加载样例数据', 'warning');
            return;
        }

        const result = calculateSoundInsulation(state.currentParams);
        
        state.calcHistory.push(result);
        saveToStorage();

        renderCalcResult(result);
        renderCalcHistory();

        showToast('"鼓房隔音衰减估算"计算完成，结果已保存到历史记录', 'success');
    }

    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById('tab-' + tabId).classList.add('active');

                if (tabId === 'history') {
                    renderCalcHistory();
                }
            });
        });
    }

    function initEventListeners() {
        document.getElementById('btnLoadSample').addEventListener('click', loadSampleData);
        document.getElementById('btnAddRow').addEventListener('click', addRow);
        document.getElementById('btnClearData').addEventListener('click', clearData);
        document.getElementById('btnExport').addEventListener('click', exportData);
        document.getElementById('btnImport').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importFromFile(e.target.files[0]);
                e.target.value = '';
            }
        });

        document.getElementById('dataSource').addEventListener('change', updateSourceInfo);
        document.getElementById('workCondition').addEventListener('change', updateSourceInfo);
        document.getElementById('photoReference').addEventListener('change', updateSourceInfo);

        document.getElementById('btnSaveParams').addEventListener('click', saveNewParamVersion);
        document.getElementById('btnRestoreParams').addEventListener('click', restoreSelectedParamVersion);

        document.querySelectorAll('#tab-params input[type="number"]').forEach(input => {
            input.addEventListener('focus', function() { this.select(); });
        });

        document.getElementById('btnCalculate').addEventListener('click', handleCalculate);

        document.getElementById('btnCompare').addEventListener('click', compareSelectedHistory);
        document.getElementById('btnClearHistory').addEventListener('click', clearHistory);

        document.getElementById('btnGenerateReport').addEventListener('click', generateReport);
        document.getElementById('btnPrintReport').addEventListener('click', () => {
            window.print();
        });
    }

    function init() {
        loadFromStorage();
        loadParamsToForm(state.currentParams);
        renderDataTable();
        renderParamVersions();
        renderCalcHistory();
        initTabs();
        initEventListeners();

        if (state.sourceInfo.dataSource) {
            document.getElementById('dataSource').value = state.sourceInfo.dataSource;
        }
        if (state.sourceInfo.workCondition) {
            document.getElementById('workCondition').value = state.sourceInfo.workCondition;
        }
        if (state.sourceInfo.photoReference) {
            document.getElementById('photoReference').value = state.sourceInfo.photoReference;
        }

        console.log('🥁 鼓房隔音衰减估算系统已初始化');
        console.log('📝 当前参数版本:', state.currentParams.version);
        console.log('💡 提示：点击"加载鼓房样例数据"可以快速测试系统功能');
    }

    return {
        init,
        deleteRow,
        loadCalcResult,
        deleteCalcResult
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    DrumRoomApp.init();
});