const UIController = (function() {

    function getStatusClass(status) {
        const classMap = {
            'PENDING': 'status-pending',
            'CURVE_VERIFICATION': 'status-curve',
            'MODEL_VERIFICATION': 'status-model',
            'BATCH_COMPARISON': 'status-comparison',
            'PASSED': 'status-passed',
            'NEEDS_REVIEW': 'status-review',
            'FAILED': 'status-failed',
            'RE_CALIBRATION': 'status-recalibration'
        };
        return classMap[status] || 'status-pending';
    }

    function getResultClass(result) {
        if (!result) return 'result-pending';
        const classMap = {
            'PASSED': 'result-pass',
            'NEEDS_REVIEW': 'result-review',
            'FAILED': 'result-fail'
        };
        return classMap[result] || 'result-pending';
    }

    function getResultLabel(result) {
        if (!result) return '待验证';
        const labelMap = {
            'PASSED': '通过',
            'NEEDS_REVIEW': '需复核',
            'FAILED': '失败'
        };
        return labelMap[result] || '未知';
    }

    function getValueClass(value, passThreshold, reviewThreshold, isHigherBetter = false) {
        if (isHigherBetter) {
            if (value >= passThreshold) return 'pass';
            if (value >= reviewThreshold) return 'warn';
            return 'fail';
        } else {
            if (value <= passThreshold) return 'pass';
            if (value <= reviewThreshold) return 'warn';
            return 'fail';
        }
    }

    function renderStats() {
        const data = WoodDryingApp.getData();
        
        const stats = {
            total: data.length,
            passed: data.filter(b => b.status === 'PASSED').length,
            review: data.filter(b => b.status === 'NEEDS_REVIEW').length,
            failed: data.filter(b => b.status === 'FAILED').length,
            pending: data.filter(b => ['PENDING', 'CURVE_VERIFICATION', 'MODEL_VERIFICATION', 'BATCH_COMPARISON', 'RE_CALIBRATION'].includes(b.status)).length
        };

        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statPassed').textContent = stats.passed;
        document.getElementById('statReview').textContent = stats.review;
        document.getElementById('statFailed').textContent = stats.failed;
        document.getElementById('statPending').textContent = stats.pending;
    }

    function getFilteredData() {
        const data = WoodDryingApp.getData();
        const statusFilter = document.getElementById('filterStatus').value;
        const woodTypeFilter = document.getElementById('filterWoodType').value;
        const searchText = document.getElementById('searchInput').value.toLowerCase();

        return data.filter(batch => {
            if (statusFilter && batch.status !== statusFilter) return false;
            if (woodTypeFilter && batch.woodType !== woodTypeFilter) return false;
            if (searchText) {
                const inBatchNo = batch.batchNo.toLowerCase().includes(searchText);
                const inRemarks = (batch.remarks || '').toLowerCase().includes(searchText);
                if (!inBatchNo && !inRemarks) return false;
            }
            return true;
        });
    }

    function renderBatchList() {
        const filteredData = getFilteredData();
        const tbody = document.getElementById('batchTableBody');
        const emptyState = document.getElementById('emptyState');
        const table = document.getElementById('batchTable');

        if (filteredData.length === 0) {
            tbody.innerHTML = '';
            table.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyState.style.display = 'none';

        const sortedData = [...filteredData].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        tbody.innerHTML = sortedData.map(batch => `
            <tr>
                <td><strong>${batch.batchNo}</strong></td>
                <td><span class="wood-type-badge">${WoodDryingApp.WoodTypeLabels[batch.woodType] || batch.woodType}</span></td>
                <td>${batch.initialMC}%</td>
                <td>${batch.targetMC}%</td>
                <td>${WoodDryingApp.formatDate(batch.createdAt)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(batch.status)}">
                        ${WoodDryingApp.StatusLabels[batch.status]}
                    </span>
                </td>
                <td>
                    <span class="result-badge ${getResultClass(batch.finalResult)}">
                        ${getResultLabel(batch.finalResult)}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="App.showDetail('${batch.id}')">详情</button>
                        ${['PENDING', 'CURVE_VERIFICATION', 'NEEDS_REVIEW', 'FAILED', 'RE_CALIBRATION'].includes(batch.status) ? 
                            `<button class="btn btn-sm btn-primary" onclick="App.openCalibration('${batch.id}')">校准</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderBatchDetail(batch) {
        const detailBody = document.getElementById('detailBody');
        
        const curveVerificationHTML = batch.curveVerification ? `
            <div class="verification-section">
                <h3>曲线导入验证</h3>
                <div class="verification-result">
                    <div class="result-item">
                        <div class="label">数据点数</div>
                        <div class="value ${batch.curveVerification.dataPoints >= 10 ? 'pass' : batch.curveVerification.dataPoints >= 5 ? 'warn' : 'fail'}">
                            ${batch.curveVerification.dataPoints} 个
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">时间间隔</div>
                        <div class="value ${batch.curveVerification.timeIntervalConsistent ? 'pass' : 'fail'}">
                            ${batch.curveVerification.timeIntervalConsistent ? '一致' : '不一致'}
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">验证结果</div>
                        <div class="value ${batch.curveVerification.passed ? 'pass' : 'fail'}">
                            ${batch.curveVerification.passed ? '通过' : '失败'}
                        </div>
                    </div>
                </div>
                <div class="validation-messages">
                    ${batch.curveVerification.messages.map(msg => `
                        <div class="message-item message-${msg.type}">${msg.text}</div>
                    `).join('')}
                </div>
            </div>
        ` : '<p class="help-text">曲线验证尚未执行</p>';

        const modelVerificationHTML = batch.modelVerification ? `
            <div class="verification-section">
                <h3>含水率模型验证</h3>
                <div class="verification-result">
                    <div class="result-item">
                        <div class="label">平均偏差</div>
                        <div class="value ${getValueClass(batch.modelVerification.avgDeviation, 1.5, 3.0)}">
                            ${batch.modelVerification.avgDeviation.toFixed(2)}%
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">最大偏差</div>
                        <div class="value ${getValueClass(batch.modelVerification.maxDeviation, 3.0, 5.0)}">
                            ${batch.modelVerification.maxDeviation.toFixed(2)}%
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">相关系数</div>
                        <div class="value ${getValueClass(batch.modelVerification.correlationCoefficient, 0.95, 0.80, true)}">
                            ${batch.modelVerification.correlationCoefficient.toFixed(3)}
                        </div>
                    </div>
                </div>
                <div class="validation-messages">
                    ${batch.modelVerification.messages.map(msg => `
                        <div class="message-item message-${msg.type}">${msg.text}</div>
                    `).join('')}
                </div>
            </div>
        ` : '<p class="help-text">模型验证尚未执行</p>';

        const comparisonHTML = batch.batchComparison ? `
            <div class="verification-section">
                <h3>批次对比校准</h3>
                <div class="verification-result">
                    <div class="result-item">
                        <div class="label">温度偏差均值</div>
                        <div class="value ${getValueClass(batch.batchComparison.tempDeviationAvg, 2.0, 4.0)}">
                            ${batch.batchComparison.tempDeviationAvg.toFixed(2)}℃
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">湿度偏差均值</div>
                        <div class="value ${getValueClass(batch.batchComparison.humidityDeviationAvg, 3.0, 6.0)}">
                            ${batch.batchComparison.humidityDeviationAvg.toFixed(2)}%RH
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">最终含水率</div>
                        <div class="value">
                            ${batch.batchComparison.finalMC.toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div class="validation-messages">
                    ${batch.batchComparison.messages.map(msg => `
                        <div class="message-item message-${msg.type}">${msg.text}</div>
                    `).join('')}
                </div>
            </div>
        ` : '<p class="help-text">批次对比尚未执行</p>';

        const timelineHTML = batch.timeline && batch.timeline.length > 0 ? `
            <div class="detail-section">
                <h3>操作记录</h3>
                ${batch.timeline.map(event => {
                    const typeClass = event.status === 'PASSED' ? 'success' : 
                                     ['FAILED', 'NEEDS_REVIEW'].includes(event.status) ? 'warning' : 'error';
                    return `
                        <div class="timeline-item ${typeClass}">
                            <div class="timeline-time">${WoodDryingApp.formatDate(event.time)}</div>
                            <div class="timeline-content">
                                <strong>${WoodDryingApp.StatusLabels[event.status] || event.status}</strong>
                                <br>${event.note}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';

        const curveDataPreview = batch.curveData ? `
            <div class="detail-section">
                <h3>烘干曲线数据预览</h3>
                <div class="data-preview">
                    <table>
                        <thead>
                            <tr>
                                <th>时间(h)</th>
                                <th>温度(℃)</th>
                                <th>湿度(%)</th>
                                <th>目标含水率(%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${batch.curveData.slice(0, 10).map(p => `
                                <tr>
                                    <td>${p.time}</td>
                                    <td>${p.temperature}</td>
                                    <td>${p.humidity}</td>
                                    <td>${p.targetMC}</td>
                                </tr>
                            `).join('')}
                            ${batch.curveData.length > 10 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">... 还有 ${batch.curveData.length - 10} 个数据点</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : '';

        const actualDataPreview = batch.actualData ? `
            <div class="detail-section">
                <h3>实测数据预览</h3>
                <div class="data-preview">
                    <table>
                        <thead>
                            <tr>
                                <th>时间(h)</th>
                                <th>实测温度(℃)</th>
                                <th>实测湿度(%)</th>
                                <th>实测含水率(%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${batch.actualData.slice(0, 10).map(p => `
                                <tr>
                                    <td>${p.time}</td>
                                    <td>${p.temperature.toFixed(1)}</td>
                                    <td>${p.humidity.toFixed(1)}</td>
                                    <td>${p.moistureContent.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                            ${batch.actualData.length > 10 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">... 还有 ${batch.actualData.length - 10} 个数据点</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : '';

        detailBody.innerHTML = `
            <div class="detail-section">
                <h3>基本信息</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">批次号</span>
                        <span class="value">${batch.batchNo}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">木材种类</span>
                        <span class="value">${WoodDryingApp.WoodTypeLabels[batch.woodType] || batch.woodType}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">初始含水率</span>
                        <span class="value">${batch.initialMC}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">目标含水率</span>
                        <span class="value">${batch.targetMC}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">木材厚度</span>
                        <span class="value">${batch.woodThickness}mm</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">批次数量</span>
                        <span class="value">${batch.batchSize}m³</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">当前状态</span>
                        <span class="value">
                            <span class="status-badge ${getStatusClass(batch.status)}">
                                ${WoodDryingApp.StatusLabels[batch.status]}
                            </span>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="label">验证结果</span>
                        <span class="value">
                            <span class="result-badge ${getResultClass(batch.finalResult)}">
                                ${getResultLabel(batch.finalResult)}
                            </span>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="label">创建时间</span>
                        <span class="value">${WoodDryingApp.formatDate(batch.createdAt)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">更新时间</span>
                        <span class="value">${WoodDryingApp.formatDate(batch.updatedAt)}</span>
                    </div>
                </div>
                ${batch.remarks ? `
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <span class="label">备注</span>
                        <span class="value">${batch.remarks}</span>
                    </div>
                ` : ''}
            </div>

            ${curveVerificationHTML}
            ${modelVerificationHTML}
            ${comparisonHTML}
            ${curveDataPreview}
            ${actualDataPreview}
            ${timelineHTML}
        `;
    }

    function updateImportBatchSelect() {
        const data = WoodDryingApp.getData();
        const select = document.getElementById('importBatchSelect');
        
        const pendingBatches = data.filter(b => 
            ['PENDING', 'CURVE_VERIFICATION', 'NEEDS_REVIEW', 'FAILED', 'RE_CALIBRATION'].includes(b.status)
        );

        select.innerHTML = '<option value="">-- 请选择批次 --</option>' + 
            pendingBatches.map(b => `<option value="${b.id}">${b.batchNo} - ${WoodDryingApp.WoodTypeLabels[b.woodType]}</option>`).join('');
    }

    function refreshAll() {
        renderStats();
        renderBatchList();
        updateImportBatchSelect();
    }

    return {
        getStatusClass,
        getResultClass,
        getResultLabel,
        getValueClass,
        renderStats,
        renderBatchList,
        renderBatchDetail,
        updateImportBatchSelect,
        refreshAll,
        getFilteredData
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
