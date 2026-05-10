const App = (function() {
    let currentCalibrationStep = 1;
    let currentCalibrationBatch = null;

    function init() {
        bindEvents();
        UIController.refreshAll();
    }

    function bindEvents() {
        document.getElementById('createBatchBtn').addEventListener('click', () => {
            openModal('createModal');
            document.getElementById('createBatchForm').reset();
            document.getElementById('batchNo').value = `BATCH-${new Date().getFullYear()}-${String(WoodDryingApp.getData().length + 1).padStart(3, '0')}`;
        });

        document.getElementById('emptyCreateBtn').addEventListener('click', () => {
            document.getElementById('createBatchBtn').click();
        });

        document.getElementById('closeCreateModal').addEventListener('click', () => closeModal('createModal'));
        document.getElementById('cancelCreateBtn').addEventListener('click', () => closeModal('createModal'));
        document.getElementById('confirmCreateBtn').addEventListener('click', handleCreateBatch);

        document.getElementById('importBatchBtn').addEventListener('click', () => {
            UIController.updateImportBatchSelect();
            openModal('importModal');
        });
        document.getElementById('closeImportModal').addEventListener('click', () => closeModal('importModal'));
        document.getElementById('cancelImportBtn').addEventListener('click', () => closeModal('importModal'));
        document.getElementById('confirmImportBtn').addEventListener('click', handleImportData);

        document.getElementById('closeDetailModal').addEventListener('click', () => closeModal('detailModal'));
        document.getElementById('closeDetailBtn').addEventListener('click', () => closeModal('detailModal'));

        document.getElementById('closeCalibrationModal').addEventListener('click', () => {
            closeModal('calibrationModal');
            UIController.refreshAll();
        });

        document.getElementById('showDocBtn').addEventListener('click', () => openModal('docModal'));
        document.getElementById('closeDocModal').addEventListener('click', () => closeModal('docModal'));
        document.getElementById('closeDocBtn').addEventListener('click', () => closeModal('docModal'));

        document.getElementById('filterStatus').addEventListener('change', UIController.renderBatchList);
        document.getElementById('filterWoodType').addEventListener('change', UIController.renderBatchList);
        document.getElementById('searchInput').addEventListener('input', UIController.renderBatchList);
        document.getElementById('resetFilterBtn').addEventListener('click', () => {
            document.getElementById('filterStatus').value = '';
            document.getElementById('filterWoodType').value = '';
            document.getElementById('searchInput').value = '';
            UIController.renderBatchList();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            WoodDryingApp.exportData();
        });

        document.querySelectorAll('.modal-content').forEach(modal => {
            modal.addEventListener('click', e => e.stopPropagation());
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal) {
                    closeModal(modal.id);
                }
            });
        });

        document.getElementById('createBatchForm').addEventListener('submit', e => {
            e.preventDefault();
            handleCreateBatch();
        });
    }

    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    function handleCreateBatch() {
        const form = document.getElementById('createBatchForm');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const batchNo = document.getElementById('batchNo').value.trim();
        const existingBatch = WoodDryingApp.getBatchByNo(batchNo);
        
        if (existingBatch) {
            alert('批次号已存在，请使用其他批次号');
            return;
        }

        const batchData = {
            batchNo: batchNo,
            woodType: document.getElementById('woodType').value,
            initialMC: document.getElementById('initialMC').value,
            targetMC: document.getElementById('targetMC').value,
            woodThickness: document.getElementById('woodThickness').value,
            batchSize: document.getElementById('batchSize').value,
            remarks: document.getElementById('remarks').value
        };

        if (parseFloat(batchData.targetMC) >= parseFloat(batchData.initialMC)) {
            alert('目标含水率必须小于初始含水率');
            return;
        }

        const newBatch = WoodDryingApp.createBatch(batchData);
        
        closeModal('createModal');
        UIController.refreshAll();
        
        openCalibration(newBatch.id);
    }

    function handleImportData() {
        const batchId = document.getElementById('importBatchSelect').value;
        if (!batchId) {
            alert('请选择要导入的批次');
            return;
        }

        const curveText = document.getElementById('curveDataInput').value.trim();
        if (!curveText) {
            alert('请输入曲线数据');
            return;
        }

        const curveData = WoodDryingApp.parseCSV(curveText);
        if (curveData.length < 3) {
            alert('曲线数据格式错误或数据点不足，请检查CSV格式');
            return;
        }

        let actualData = null;
        const actualText = document.getElementById('actualDataInput').value.trim();
        if (actualText) {
            actualData = WoodDryingApp.parseActualCSV(actualText);
            if (actualData.length < 3) {
                alert('实测数据格式错误，请检查CSV格式');
                return;
            }
        }

        const batch = WoodDryingApp.getBatchById(batchId);
        const updates = {
            curveData: curveData,
            status: 'CURVE_VERIFICATION'
        };

        if (actualData) {
            updates.actualData = actualData;
        }

        WoodDryingApp.updateBatch(batchId, updates);
        WoodDryingApp.addTimelineEvent(batchId, 'CURVE_VERIFICATION', '曲线数据已导入，开始验证');

        closeModal('importModal');
        UIController.refreshAll();
        openCalibration(batchId);
    }

    function showDetail(batchId) {
        const batch = WoodDryingApp.getBatchById(batchId);
        if (!batch) return;

        UIController.renderBatchDetail(batch);
        openModal('detailModal');
    }

    function openCalibration(batchId) {
        const batch = WoodDryingApp.getBatchById(batchId);
        if (!batch) return;

        currentCalibrationBatch = batch;
        WoodDryingApp.setCurrentBatch(batchId);

        determineCurrentStep(batch);
        renderCalibrationHeader(batch);
        updateStepperUI();
        renderCalibrationContent();
        renderCalibrationFooter();

        openModal('calibrationModal');
    }

    function determineCurrentStep(batch) {
        switch (batch.status) {
            case 'PENDING':
            case 'CURVE_VERIFICATION':
            case 'RE_CALIBRATION':
                currentCalibrationStep = 1;
                break;
            case 'MODEL_VERIFICATION':
                currentCalibrationStep = 2;
                break;
            case 'BATCH_COMPARISON':
                currentCalibrationStep = 3;
                break;
            default:
                currentCalibrationStep = 3;
        }
    }

    function renderCalibrationHeader(batch) {
        const header = document.getElementById('calibrationHeader');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>批次号：</strong>${batch.batchNo}
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    <strong>木材种类：</strong>${WoodDryingApp.WoodTypeLabels[batch.woodType]}
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    <strong>目标含水率：</strong>${batch.targetMC}%
                </div>
                <span class="status-badge ${UIController.getStatusClass(batch.status)}">
                    ${WoodDryingApp.StatusLabels[batch.status]}
                </span>
            </div>
        `;
    }

    function updateStepperUI() {
        const steps = document.querySelectorAll('.calibration-stepper .step');
        const lines = document.querySelectorAll('.calibration-stepper .step-line');

        steps.forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNum < currentCalibrationStep) {
                step.classList.add('completed');
            } else if (stepNum === currentCalibrationStep) {
                step.classList.add('active');
            }
        });

        lines.forEach((line, index) => {
            line.classList.remove('completed');
            if (index + 1 < currentCalibrationStep) {
                line.classList.add('completed');
            }
        });
    }

    function renderCalibrationContent() {
        const content = document.getElementById('calibrationContent');
        const batch = currentCalibrationBatch;

        switch (currentCalibrationStep) {
            case 1:
                content.innerHTML = renderCurveVerificationStep(batch);
                bindCurveStepEvents();
                break;
            case 2:
                content.innerHTML = renderModelVerificationStep(batch);
                bindModelStepEvents();
                break;
            case 3:
                content.innerHTML = renderBatchComparisonStep(batch);
                bindComparisonStepEvents();
                break;
        }
    }

    function renderCurveVerificationStep(batch) {
        const hasCurveData = batch.curveData && batch.curveData.length > 0;
        const hasVerification = batch.curveVerification;

        if (!hasCurveData) {
            return `
                <div class="verification-section">
                    <h3>步骤1：导入烘干曲线</h3>
                    <p class="help-text">请先在导入界面粘贴曲线数据，或使用以下示例数据格式：</p>
                    <div class="data-preview">
                        <table>
                            <thead>
                                <tr><th>时间(h)</th><th>温度(℃)</th><th>湿度(%)</th><th>目标含水率(%)</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>0</td><td>20</td><td>60</td><td>55.0</td></tr>
                                <tr><td>2</td><td>35</td><td>75</td><td>53.5</td></tr>
                                <tr><td>4</td><td>45</td><td>78</td><td>51.8</td></tr>
                                <tr><td>6</td><td>50</td><td>80</td><td>49.5</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-primary" id="goToImportBtn">去导入曲线数据</button>
                    </div>
                </div>
            `;
        }

        let verificationHTML = '';
        if (hasVerification) {
            verificationHTML = `
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
            `;
        }

        return `
            <div class="verification-section">
                <h3>步骤1：曲线导入验证</h3>
                ${hasVerification ? verificationHTML : '<p class="help-text">点击下方按钮开始验证曲线数据</p>'}
                
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" id="verifyCurveBtn">
                        ${hasVerification ? '重新验证曲线' : '开始验证曲线'}
                    </button>
                </div>

                <div class="detail-section" style="margin-top: 20px;">
                    <h4>曲线数据预览</h4>
                    <div class="data-preview">
                        <table>
                            <thead>
                                <tr><th>时间(h)</th><th>温度(℃)</th><th>湿度(%)</th><th>目标含水率(%)</th></tr>
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
            </div>
        `;
    }

    function renderModelVerificationStep(batch) {
        const hasActualData = batch.actualData && batch.actualData.length > 0;
        const hasVerification = batch.modelVerification;

        if (!hasActualData) {
            return `
                <div class="verification-section">
                    <h3>步骤2：含水率模型验证</h3>
                    <p class="help-text">需要实测数据才能进行模型验证。请在导入界面粘贴实测数据，或使用以下示例：</p>
                    <div class="data-preview">
                        <table>
                            <thead>
                                <tr><th>时间(h)</th><th>实测温度(℃)</th><th>实测湿度(%)</th><th>实测含水率(%)</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>0</td><td>19.5</td><td>61.2</td><td>54.8</td></tr>
                                <tr><td>2</td><td>34.8</td><td>74.5</td><td>53.2</td></tr>
                                <tr><td>4</td><td>44.5</td><td>77.8</td><td>51.5</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="margin-top: 20px;">
                        <button class="btn btn-primary" id="goToImportBtn">去导入实测数据</button>
                        <button class="btn btn-secondary" id="skipModelBtn">跳过模型验证（无实测数据）</button>
                    </div>
                </div>
            `;
        }

        let verificationHTML = '';
        if (hasVerification) {
            verificationHTML = `
                <div class="verification-result">
                    <div class="result-item">
                        <div class="label">平均偏差</div>
                        <div class="value ${UIController.getValueClass(batch.modelVerification.avgDeviation, 1.5, 3.0)}">
                            ${batch.modelVerification.avgDeviation.toFixed(2)}%
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">最大偏差</div>
                        <div class="value ${UIController.getValueClass(batch.modelVerification.maxDeviation, 3.0, 5.0)}">
                            ${batch.modelVerification.maxDeviation.toFixed(2)}%
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">相关系数</div>
                        <div class="value ${UIController.getValueClass(batch.modelVerification.correlationCoefficient, 0.95, 0.80, true)}">
                            ${batch.modelVerification.correlationCoefficient.toFixed(3)}
                        </div>
                    </div>
                </div>
                <div class="validation-messages">
                    ${batch.modelVerification.messages.map(msg => `
                        <div class="message-item message-${msg.type}">${msg.text}</div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="verification-section">
                <h3>步骤2：含水率模型验证</h3>
                ${hasVerification ? verificationHTML : '<p class="help-text">点击下方按钮开始验证含水率模型</p>'}
                
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" id="verifyModelBtn">
                        ${hasVerification ? '重新验证模型' : '开始验证模型'}
                    </button>
                </div>

                <div class="detail-section" style="margin-top: 20px;">
                    <h4>实测数据预览</h4>
                    <div class="data-preview">
                        <table>
                            <thead>
                                <tr><th>时间(h)</th><th>实测温度(℃)</th><th>实测湿度(%)</th><th>实测含水率(%)</th></tr>
                            </thead>
                            <tbody>
                                ${batch.actualData.slice(0, 8).map(p => `
                                    <tr>
                                        <td>${p.time}</td>
                                        <td>${p.temperature.toFixed(1)}</td>
                                        <td>${p.humidity.toFixed(1)}</td>
                                        <td>${p.moistureContent.toFixed(1)}</td>
                                    </tr>
                                `).join('')}
                                ${batch.actualData.length > 8 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">... 还有 ${batch.actualData.length - 8} 个数据点</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBatchComparisonStep(batch) {
        const hasComparison = batch.batchComparison;
        const hasFinalResult = batch.finalResult;

        let comparisonHTML = '';
        if (hasComparison) {
            comparisonHTML = `
                <div class="verification-result">
                    <div class="result-item">
                        <div class="label">温度偏差均值</div>
                        <div class="value ${UIController.getValueClass(batch.batchComparison.tempDeviationAvg, 2.0, 4.0)}">
                            ${batch.batchComparison.tempDeviationAvg.toFixed(2)}℃
                        </div>
                    </div>
                    <div class="result-item">
                        <div class="label">湿度偏差均值</div>
                        <div class="value ${UIController.getValueClass(batch.batchComparison.humidityDeviationAvg, 3.0, 6.0)}">
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
            `;
        }

        let finalResultHTML = '';
        if (hasFinalResult) {
            const resultClass = batch.finalResult === 'PASSED' ? 'passed' : 
                               batch.finalResult === 'NEEDS_REVIEW' ? 'review' : 'failed';
            const resultText = batch.finalResult === 'PASSED' ? '正常通过' :
                              batch.finalResult === 'NEEDS_REVIEW' ? '需人工处理' : '校准失败';
            
            finalResultHTML = `
                <div class="criteria-box ${resultClass}" style="margin-top: 20px;">
                    <h4>最终判定结果：${resultText}</h4>
                    ${renderRecommendations(batch)}
                </div>
            `;
        }

        return `
            <div class="verification-section">
                <h3>步骤3：批次对比校准</h3>
                ${hasComparison ? comparisonHTML : '<p class="help-text">点击下方按钮开始批次对比</p>'}
                
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary" id="runComparisonBtn">
                        ${hasComparison ? '重新执行对比' : '开始批次对比'}
                    </button>
                </div>

                ${finalResultHTML}
            </div>
        `;
    }

    function renderRecommendations(batch) {
        const recommendations = [];

        if (batch.curveVerification && !batch.curveVerification.passed) {
            recommendations.push('• 检查曲线数据格式，确保时间间隔一致、温湿度在合理范围');
        }

        if (batch.modelVerification) {
            if (batch.modelVerification.avgDeviation > 3.0) {
                recommendations.push('• 含水率模型偏差较大，建议检查传感器校准或调整模型参数');
            } else if (batch.modelVerification.avgDeviation > 1.5) {
                recommendations.push('• 含水率模型存在中等偏差，建议复核关键时间点的实测数据');
            }
        }

        if (batch.batchComparison) {
            if (batch.batchComparison.tempDeviationAvg > 4.0) {
                recommendations.push('• 温度控制偏差过大，检查加热系统或重新校准温度传感器');
            } else if (batch.batchComparison.tempDeviationAvg > 2.0) {
                recommendations.push('• 温度存在中等偏差，建议调整升温速率或检查保温效果');
            }

            if (batch.batchComparison.humidityDeviationAvg > 6.0) {
                recommendations.push('• 湿度控制偏差过大，检查喷雾系统或排气扇设置');
            } else if (batch.batchComparison.humidityDeviationAvg > 3.0) {
                recommendations.push('• 湿度存在中等偏差，建议调整湿度设定值或检查密封性');
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('• 所有指标均在可接受范围内，可直接用于生产');
        }

        return `
            <p style="margin-top: 10px;"><strong>建议措施：</strong></p>
            <ul>${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        `;
    }

    function bindCurveStepEvents() {
        const verifyBtn = document.getElementById('verifyCurveBtn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
                const result = ValidationEngine.validateCurveData(batch.curveData, batch);
                
                WoodDryingApp.updateBatch(batch.id, {
                    curveVerification: result,
                    status: result.passed ? 'MODEL_VERIFICATION' : 'FAILED'
                });

                if (result.passed) {
                    WoodDryingApp.addTimelineEvent(batch.id, 'MODEL_VERIFICATION', '曲线验证通过，进入模型验证');
                } else {
                    WoodDryingApp.addTimelineEvent(batch.id, 'FAILED', '曲线验证失败');
                }

                currentCalibrationBatch = WoodDryingApp.getBatchById(batch.id);
                renderCalibrationHeader(currentCalibrationBatch);
                
                if (result.passed) {
                    currentCalibrationStep = 2;
                    updateStepperUI();
                }
                
                renderCalibrationContent();
                renderCalibrationFooter();
            });
        }

        const goToImportBtn = document.getElementById('goToImportBtn');
        if (goToImportBtn) {
            goToImportBtn.addEventListener('click', () => {
                closeModal('calibrationModal');
                UIController.updateImportBatchSelect();
                document.getElementById('importBatchSelect').value = currentCalibrationBatch.id;
                openModal('importModal');
            });
        }
    }

    function bindModelStepEvents() {
        const verifyBtn = document.getElementById('verifyModelBtn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
                const result = ValidationEngine.validateMoistureModel(batch.curveData, batch.actualData, batch);
                
                WoodDryingApp.updateBatch(batch.id, {
                    modelVerification: result,
                    status: 'BATCH_COMPARISON'
                });

                WoodDryingApp.addTimelineEvent(batch.id, 'BATCH_COMPARISON', 
                    result.passed ? '模型验证通过，进入批次对比' : '模型验证存在偏差，继续批次对比');

                currentCalibrationBatch = WoodDryingApp.getBatchById(batch.id);
                renderCalibrationHeader(currentCalibrationBatch);
                currentCalibrationStep = 3;
                updateStepperUI();
                renderCalibrationContent();
                renderCalibrationFooter();
            });
        }

        const skipBtn = document.getElementById('skipModelBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                if (confirm('确定跳过模型验证吗？建议提供实测数据以获得更准确的校准结果。')) {
                    const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
                    WoodDryingApp.updateBatch(batch.id, {
                        status: 'BATCH_COMPARISON'
                    });
                    WoodDryingApp.addTimelineEvent(batch.id, 'BATCH_COMPARISON', '跳过模型验证，进入批次对比');

                    currentCalibrationBatch = WoodDryingApp.getBatchById(batch.id);
                    renderCalibrationHeader(currentCalibrationBatch);
                    currentCalibrationStep = 3;
                    updateStepperUI();
                    renderCalibrationContent();
                    renderCalibrationFooter();
                }
            });
        }

        const goToImportBtn = document.getElementById('goToImportBtn');
        if (goToImportBtn) {
            goToImportBtn.addEventListener('click', () => {
                closeModal('calibrationModal');
                UIController.updateImportBatchSelect();
                document.getElementById('importBatchSelect').value = currentCalibrationBatch.id;
                openModal('importModal');
            });
        }
    }

    function bindComparisonStepEvents() {
        const runBtn = document.getElementById('runComparisonBtn');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
                
                let comparisonResult = null;
                if (batch.actualData) {
                    comparisonResult = ValidationEngine.compareBatchData(batch.curveData, batch.actualData, batch);
                }

                const finalResult = ValidationEngine.determineFinalResult(
                    batch.curveVerification,
                    batch.modelVerification,
                    comparisonResult
                );

                let finalStatus;
                if (finalResult.status === 'PASSED') {
                    finalStatus = 'PASSED';
                } else if (finalResult.status === 'NEEDS_REVIEW') {
                    finalStatus = 'NEEDS_REVIEW';
                } else {
                    finalStatus = 'FAILED';
                }

                const updates = {
                    batchComparison: comparisonResult,
                    finalResult: finalResult.status,
                    status: finalStatus
                };

                WoodDryingApp.updateBatch(batch.id, updates);
                WoodDryingApp.addTimelineEvent(batch.id, finalStatus, 
                    `${finalResult.reason} - 判定结果：${finalResult.status === 'PASSED' ? '正常通过' : 
                     finalResult.status === 'NEEDS_REVIEW' ? '需人工处理' : '校准失败'}`);

                currentCalibrationBatch = WoodDryingApp.getBatchById(batch.id);
                renderCalibrationHeader(currentCalibrationBatch);
                renderCalibrationContent();
                renderCalibrationFooter();
            });
        }
    }

    function renderCalibrationFooter() {
        const footer = document.getElementById('calibrationFooter');
        const batch = currentCalibrationBatch;

        let buttons = '';

        if (batch.status === 'PASSED') {
            buttons = `
                <button class="btn btn-secondary" id="closeCalibBtn">关闭</button>
                <button class="btn btn-success" id="confirmPassBtn">确认通过</button>
            `;
        } else if (batch.status === 'NEEDS_REVIEW') {
            buttons = `
                <button class="btn btn-secondary" id="closeCalibBtn">关闭</button>
                <button class="btn btn-warning" id="markAsPassBtn">人工复核后标记通过</button>
                <button class="btn btn-primary" id="reCalibrateBtn">修正后重跑</button>
            `;
        } else if (batch.status === 'FAILED') {
            buttons = `
                <button class="btn btn-secondary" id="closeCalibBtn">关闭</button>
                <button class="btn btn-danger" id="viewErrorsBtn">查看详细错误</button>
                <button class="btn btn-primary" id="reCalibrateBtn">修正后重跑</button>
            `;
        } else {
            buttons = `
                <button class="btn btn-secondary" id="closeCalibBtn">保存并关闭</button>
            `;
        }

        footer.innerHTML = buttons;

        document.getElementById('closeCalibBtn')?.addEventListener('click', () => {
            closeModal('calibrationModal');
            UIController.refreshAll();
        });

        document.getElementById('confirmPassBtn')?.addEventListener('click', () => {
            closeModal('calibrationModal');
            UIController.refreshAll();
        });

        document.getElementById('markAsPassBtn')?.addEventListener('click', () => {
            if (confirm('确认人工复核后标记为通过？此操作将更新批次状态。')) {
                const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
                WoodDryingApp.updateBatch(batch.id, {
                    status: 'PASSED',
                    finalResult: 'PASSED'
                });
                WoodDryingApp.addTimelineEvent(batch.id, 'PASSED', '人工复核后标记为通过');
                
                closeModal('calibrationModal');
                UIController.refreshAll();
            }
        });

        document.getElementById('reCalibrateBtn')?.addEventListener('click', () => {
            const batch = WoodDryingApp.getBatchById(currentCalibrationBatch.id);
            WoodDryingApp.updateBatch(batch.id, {
                status: 'RE_CALIBRATION'
            });
            WoodDryingApp.addTimelineEvent(batch.id, 'RE_CALIBRATION', '开始重新校准');

            currentCalibrationBatch = WoodDryingApp.getBatchById(batch.id);
            currentCalibrationStep = 1;
            renderCalibrationHeader(currentCalibrationBatch);
            updateStepperUI();
            renderCalibrationContent();
            renderCalibrationFooter();
        });

        document.getElementById('viewErrorsBtn')?.addEventListener('click', () => {
            showDetail(currentCalibrationBatch.id);
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        showDetail,
        openCalibration,
        init
    };
})();

window.App = App;
