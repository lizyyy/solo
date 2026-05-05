const CentrifugeTool = {
    state: {
        samples: [],
        rotors: [],
        calibration: null,
        selectedRotor: null,
        selectedTubeType: '',
        targetType: 'rcf',
        targetValue: 0,
        centrifugeTime: 0,
        calculationResults: null,
        overrideNotes: '',
        handoverNotes: '',
        lastUpdate: null
    },

    STORAGE_KEY: 'centrifuge_tool_state',

    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.updateUI();
    },

    bindEvents() {
        document.getElementById('sampleCsv').addEventListener('change', (e) => this.handleSampleCsv(e));
        document.getElementById('rotorJson').addEventListener('change', (e) => this.handleRotorJson(e));
        document.getElementById('calibrationJson').addEventListener('change', (e) => this.handleCalibrationJson(e));
        
        document.getElementById('rotorSelect').addEventListener('change', (e) => this.handleRotorSelect(e));
        document.getElementById('tubeType').addEventListener('change', (e) => this.handleTubeTypeSelect(e));
        document.getElementById('targetType').addEventListener('change', (e) => this.handleTargetTypeChange(e));
        document.getElementById('targetValue').addEventListener('input', (e) => this.handleTargetValueChange(e));
        document.getElementById('centrifugeTime').addEventListener('input', (e) => this.handleTimeChange(e));
        
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());
        document.getElementById('saveNotesBtn').addEventListener('click', () => this.saveNotes());
        document.getElementById('exportMarkdownBtn').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('exportJsonBtn').addEventListener('click', () => this.exportJson());
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());
    },

    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
                console.log('已从本地存储加载数据');
            }
        } catch (error) {
            console.error('加载存储数据失败:', error);
        }
    },

    saveToStorage() {
        try {
            this.state.lastUpdate = new Date().toISOString();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            console.log('数据已保存到本地存储');
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    },

    updateUI() {
        this.updateRotorSelect();
        this.updateTubeTypeSelect();
        this.updateInputs();
        this.updateNotes();
        this.displayResults();
        this.displaySamples();
    },

    updateInputs() {
        document.getElementById('targetType').value = this.state.targetType;
        document.getElementById('targetValue').value = this.state.targetValue || '';
        document.getElementById('centrifugeTime').value = this.state.centrifugeTime || '';
    },

    updateNotes() {
        document.getElementById('overrideNotes').value = this.state.overrideNotes || '';
        document.getElementById('handoverNotes').value = this.state.handoverNotes || '';
    },

    handleSampleCsv(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.state.samples = this.parseCsv(e.target.result);
                this.saveToStorage();
                this.displaySamples();
                alert(`成功导入 ${this.state.samples.length} 个样本`);
            } catch (error) {
                alert('解析CSV文件失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    },

    handleRotorJson(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.state.rotors = JSON.parse(e.target.result);
                this.saveToStorage();
                this.updateRotorSelect();
                alert(`成功导入 ${this.state.rotors.length} 个转子规格`);
            } catch (error) {
                alert('解析JSON文件失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    },

    handleCalibrationJson(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.state.calibration = JSON.parse(e.target.result);
                this.saveToStorage();
                alert('机器校准记录已导入');
            } catch (error) {
                alert('解析JSON文件失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    },

    parseCsv(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const samples = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const sample = {};

            headers.forEach((header, index) => {
                const value = values[index] || '';
                const numValue = parseFloat(value);
                sample[header] = isNaN(numValue) ? value : numValue;
            });

            if (sample.sampleId || sample.id) {
                samples.push({
                    id: sample.sampleId || sample.id || `Sample_${i}`,
                    weight: sample.weight || sample.mass || 0,
                    tubeType: sample.tubeType || sample.tube || 'default',
                    urgent: sample.urgent === '是' || sample.urgent === 'true' || sample.urgent === true,
                    notes: sample.notes || sample.remark || ''
                });
            }
        }

        return samples;
    },

    updateRotorSelect() {
        const select = document.getElementById('rotorSelect');
        select.innerHTML = '<option value="">-- 请选择转子 --</option>';

        if (this.state.rotors.length === 0) {
            select.innerHTML = '<option value="">-- 请先导入转子数据 --</option>';
            return;
        }

        this.state.rotors.forEach((rotor, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${rotor.name} (${rotor.holes}孔, 最大${rotor.maxRpm}RPM)`;
            if (this.state.selectedRotor && this.state.selectedRotor.name === rotor.name) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    updateTubeTypeSelect() {
        const select = document.getElementById('tubeType');
        select.innerHTML = '<option value="">-- 请选择 --</option>';

        const tubeTypes = new Set(['默认']);
        this.state.samples.forEach(s => {
            if (s.tubeType) tubeTypes.add(s.tubeType);
        });

        if (this.state.selectedRotor && this.state.selectedRotor.tubeTypes) {
            this.state.selectedRotor.tubeTypes.forEach(t => tubeTypes.add(t));
        }

        tubeTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === this.state.selectedTubeType) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    },

    handleRotorSelect(event) {
        const index = event.target.value;
        if (index !== '' && this.state.rotors[index]) {
            this.state.selectedRotor = this.state.rotors[index];
            this.saveToStorage();
            this.updateTubeTypeSelect();
        }
    },

    handleTubeTypeSelect(event) {
        this.state.selectedTubeType = event.target.value;
        this.saveToStorage();
    },

    handleTargetTypeChange(event) {
        this.state.targetType = event.target.value;
        this.saveToStorage();
    },

    handleTargetValueChange(event) {
        this.state.targetValue = parseFloat(event.target.value) || 0;
        this.saveToStorage();
    },

    handleTimeChange(event) {
        this.state.centrifugeTime = parseFloat(event.target.value) || 0;
        this.saveToStorage();
    },

    calculate() {
        if (!this.state.selectedRotor) {
            alert('请先选择转子');
            return;
        }

        if (this.state.samples.length === 0) {
            alert('请先导入样本数据');
            return;
        }

        if (!this.state.targetValue || this.state.targetValue <= 0) {
            alert('请输入有效的目标参数值');
            return;
        }

        const results = {
            rpmRcfConversion: this.calculateRpmRcfConversion(),
            balancePlan: this.calculateBalancePlan(),
            risks: this.analyzeRisks(),
            timestamp: new Date().toISOString()
        };

        this.state.calculationResults = results;
        this.saveToStorage();
        this.displayResults();

        alert('计算完成！');
    },

    calculateRpmRcfConversion() {
        const rotor = this.state.selectedRotor;
        const radius = rotor.radius;
        const maxRpm = rotor.maxRpm;
        const maxRcf = this.rpmToRcf(maxRpm, radius);

        let result = {
            targetType: this.state.targetType,
            targetValue: this.state.targetValue,
            radius: radius,
            maxRpm: maxRpm,
            maxRcf: maxRcf,
            recommendedRpm: 0,
            recommendedRcf: 0,
            isWithinLimit: true,
            warning: ''
        };

        if (this.state.targetType === 'rcf') {
            result.recommendedRcf = this.state.targetValue;
            result.recommendedRpm = this.rcfToRpm(this.state.targetValue, radius);

            if (result.recommendedRpm > maxRpm) {
                result.isWithinLimit = false;
                result.warning = `警告：所需转速 ${result.recommendedRpm.toFixed(0)} RPM 超过转子最大转速 ${maxRpm} RPM`;
                result.recommendedRpm = maxRpm;
                result.recommendedRcf = maxRcf;
            }
        } else {
            result.recommendedRpm = this.state.targetValue;
            result.recommendedRcf = this.rpmToRcf(this.state.targetValue, radius);

            if (result.recommendedRpm > maxRpm) {
                result.isWithinLimit = false;
                result.warning = `警告：设置转速 ${result.recommendedRpm} RPM 超过转子最大转速 ${maxRpm} RPM`;
                result.recommendedRpm = maxRpm;
                result.recommendedRcf = maxRcf;
            }
        }

        return result;
    },

    rpmToRcf(rpm, radius) {
        return 1.118 * 0.001 * radius * Math.pow(rpm, 2);
    },

    rcfToRpm(rcf, radius) {
        return Math.sqrt(rcf / (1.118 * 0.001 * radius));
    },

    calculateBalancePlan() {
        const rotor = this.state.selectedRotor;
        const holes = rotor.holes;
        const samples = [...this.state.samples];

        samples.sort((a, b) => b.weight - a.weight);

        const balancePlan = {
            totalSamples: samples.length,
            totalWeight: samples.reduce((sum, s) => sum + s.weight, 0),
            positions: [],
            pairs: [],
            unbalancedWeight: 0,
            isBalanced: true
        };

        const usedPositions = new Set();
        let positionIndex = 0;

        for (let i = 0; i < samples.length; i += 2) {
            if (i + 1 < samples.length) {
                const sample1 = samples[i];
                const sample2 = samples[i + 1];

                const pos1 = positionIndex % holes;
                const pos2 = (pos1 + holes / 2) % holes;

                if (!usedPositions.has(pos1) && !usedPositions.has(pos2)) {
                    balancePlan.positions.push({
                        sample: sample1,
                        position: pos1 + 1,
                        weight: sample1.weight
                    });
                    balancePlan.positions.push({
                        sample: sample2,
                        position: pos2 + 1,
                        weight: sample2.weight
                    });

                    balancePlan.pairs.push({
                        position1: pos1 + 1,
                        sample1: sample1.id,
                        weight1: sample1.weight,
                        position2: pos2 + 1,
                        sample2: sample2.id,
                        weight2: sample2.weight,
                        difference: Math.abs(sample1.weight - sample2.weight)
                    });

                    usedPositions.add(pos1);
                    usedPositions.add(pos2);
                    positionIndex++;
                }
            } else {
                const sample = samples[i];
                balancePlan.positions.push({
                    sample: sample,
                    position: (positionIndex % holes) + 1,
                    weight: sample.weight,
                    isOdd: true
                });
                balancePlan.isBalanced = false;
                balancePlan.unbalancedWeight += sample.weight;
            }
        }

        let maxDifference = 0;
        balancePlan.pairs.forEach(pair => {
            if (pair.difference > maxDifference) {
                maxDifference = pair.difference;
            }
        });

        const threshold = this.state.calibration?.balanceThreshold || 0.5;
        if (maxDifference > threshold) {
            balancePlan.isBalanced = false;
        }

        balancePlan.maxWeightDifference = maxDifference;
        balancePlan.balanceThreshold = threshold;

        return balancePlan;
    },

    analyzeRisks() {
        const risks = [];
        const rotor = this.state.selectedRotor;
        const conversion = this.state.calculationResults?.rpmRcfConversion;
        const balance = this.state.calculationResults?.balancePlan;

        if (conversion && !conversion.isWithinLimit) {
            risks.push({
                type: 'error',
                category: '转速超限',
                message: conversion.warning
            });
        }

        if (balance) {
            if (balance.totalWeight > rotor.maxWeight) {
                risks.push({
                    type: 'error',
                    category: '超载风险',
                    message: `总重量 ${balance.totalWeight.toFixed(2)}g 超过转子最大承重 ${rotor.maxWeight}g`
                });
            }

            if (!balance.isBalanced) {
                risks.push({
                    type: 'warning',
                    category: '配平问题',
                    message: balance.unbalancedWeight > 0 
                        ? `存在奇数个样本，可能需要配平管。最大重量差: ${balance.maxWeightDifference.toFixed(2)}g`
                        : `重量差异较大 (${balance.maxWeightDifference.toFixed(2)}g)，超过阈值 ${balance.balanceThreshold}g`
                });
            }

            if (balance.totalSamples > rotor.holes) {
                risks.push({
                    type: 'error',
                    category: '孔位不足',
                    message: `样本数量 ${balance.totalSamples} 超过转子孔数 ${rotor.holes}`
                });
            }
        }

        if (this.state.samples.some(s => s.urgent)) {
            risks.push({
                type: 'info',
                category: '加急样本',
                message: `包含 ${this.state.samples.filter(s => s.urgent).length} 个加急样本，请优先处理`
            });
        }

        if (risks.length === 0) {
            risks.push({
                type: 'success',
                category: '正常',
                message: '所有参数检查通过，可以安全离心'
            });
        }

        return risks;
    },

    displayResults() {
        this.displayRpmRcfResult();
        this.displayBalanceResult();
        this.displayRiskResult();
    },

    displayRpmRcfResult() {
        const content = document.getElementById('rpmRcfContent');
        const conversion = this.state.calculationResults?.rpmRcfConversion;

        if (!conversion) {
            content.innerHTML = '<p class="empty-message">请先输入参数并计算</p>';
            return;
        }

        let html = `
            <div class="result-item">
                <strong>转子半径:</strong> ${conversion.radius} mm
            </div>
            <div class="result-item">
                <strong>最大转速:</strong> ${conversion.maxRpm} RPM (约 ${conversion.maxRcf.toFixed(1)} ×g)
            </div>
            <div class="result-item" style="margin-top: 15px; padding: 15px; background: #e7f3ff; border-radius: 4px;">
                <strong>推荐参数:</strong><br>
                &nbsp;&nbsp;• 转速: <strong>${conversion.recommendedRpm.toFixed(0)} RPM</strong><br>
                &nbsp;&nbsp;• 离心力: <strong>${conversion.recommendedRcf.toFixed(1)} ×g</strong>
            </div>
        `;

        if (conversion.warning) {
            html += `
                <div class="risk-warning" style="margin-top: 15px;">
                    ⚠️ ${conversion.warning}
                </div>
            `;
        }

        if (this.state.centrifugeTime) {
            html += `
                <div class="result-item" style="margin-top: 15px;">
                    <strong>离心时间:</strong> ${this.state.centrifugeTime} 分钟
                </div>
            `;
        }

        content.innerHTML = html;
    },

    displayBalanceResult() {
        const content = document.getElementById('balanceContent');
        const balance = this.state.calculationResults?.balancePlan;

        if (!balance) {
            content.innerHTML = '<p class="empty-message">请先导入样本数据并计算</p>';
            return;
        }

        let html = `
            <div class="result-item">
                <strong>样本总数:</strong> ${balance.totalSamples} 个
            </div>
            <div class="result-item">
                <strong>总重量:</strong> ${balance.totalWeight.toFixed(2)} g
            </div>
            <div class="result-item">
                <strong>最大重量差:</strong> ${balance.maxWeightDifference.toFixed(2)} g
                (阈值: ${balance.balanceThreshold} g)
            </div>
            <div class="result-item">
                <strong>配平状态:</strong> 
                <span style="color: ${balance.isBalanced ? '#28a745' : '#ffc107'}; font-weight: bold;">
                    ${balance.isBalanced ? '✓ 已配平' : '⚠ 需注意'}
                </span>
            </div>
        `;

        if (balance.pairs.length > 0) {
            html += `<div style="margin-top: 20px;"><strong>配平方案:</strong></div>`;
            balance.pairs.forEach((pair, index) => {
                const isBalancedPair = pair.difference <= balance.balanceThreshold;
                html += `
                    <div class="balance-pair" style="margin-top: 10px;">
                        <strong>配对 ${index + 1}:</strong><br>
                        &nbsp;&nbsp;孔位 ${pair.position1}: ${pair.sample1} (${pair.weight1}g)<br>
                        &nbsp;&nbsp;孔位 ${pair.position2}: ${pair.sample2} (${pair.weight2}g)<br>
                        &nbsp;&nbsp;重量差: <span style="color: ${isBalancedPair ? '#28a745' : '#ffc107'};">${pair.difference.toFixed(2)}g</span>
                    </div>
                `;
            });
        }

        if (balance.unbalancedWeight > 0) {
            html += `
                <div class="risk-warning" style="margin-top: 15px;">
                    ⚠️ 存在未配对样本 (重量: ${balance.unbalancedWeight}g)，建议使用配平管
                </div>
            `;
        }

        content.innerHTML = html;
    },

    displayRiskResult() {
        const content = document.getElementById('riskContent');
        const risks = this.state.calculationResults?.risks;

        if (!risks || risks.length === 0) {
            content.innerHTML = '<p class="empty-message">暂无风险提示</p>';
            return;
        }

        let html = '';
        risks.forEach(risk => {
            let className = '';
            let icon = '';

            switch (risk.type) {
                case 'error':
                    className = 'risk-error';
                    icon = '❌';
                    break;
                case 'warning':
                    className = 'risk-warning';
                    icon = '⚠️';
                    break;
                case 'success':
                    className = 'risk-success';
                    icon = '✓';
                    break;
                case 'info':
                    className = 'risk-warning';
                    icon = 'ℹ️';
                    break;
            }

            html += `
                <div class="${className}">
                    ${icon} <strong>[${risk.category}]</strong> ${risk.message}
                </div>
            `;
        });

        content.innerHTML = html;
    },

    displaySamples() {
        const content = document.getElementById('sampleContent');

        if (this.state.samples.length === 0) {
            content.innerHTML = '<p class="empty-message">请先导入样本数据</p>';
            return;
        }

        let html = `
            <p><strong>共 ${this.state.samples.length} 个样本</strong></p>
            <table class="sample-table">
                <thead>
                    <tr>
                        <th>样本ID</th>
                        <th>重量 (g)</th>
                        <th>离心管类型</th>
                        <th>加急</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.state.samples.forEach(sample => {
            html += `
                <tr>
                    <td>${sample.id}</td>
                    <td>${sample.weight}</td>
                    <td>${sample.tubeType || '-'}</td>
                    <td>${sample.urgent ? '是' : '否'}</td>
                    <td>${sample.notes || '-'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        content.innerHTML = html;
    },

    saveNotes() {
        this.state.overrideNotes = document.getElementById('overrideNotes').value;
        this.state.handoverNotes = document.getElementById('handoverNotes').value;
        this.saveToStorage();
        alert('备注已保存');
    },

    exportMarkdown() {
        if (!this.state.calculationResults) {
            alert('请先计算配平方案');
            return;
        }

        const conversion = this.state.calculationResults.rpmRcfConversion;
        const balance = this.state.calculationResults.balancePlan;
        const risks = this.state.calculationResults.risks;
        const rotor = this.state.selectedRotor;

        let md = `# 离心交接单

## 基本信息
- **生成时间**: ${new Date(this.state.calculationResults.timestamp).toLocaleString('zh-CN')}
- **转子类型**: ${rotor.name}
- **转子孔数**: ${rotor.holes} 孔
- **转子半径**: ${rotor.radius} mm

## 离心参数
- **推荐转速**: ${conversion.recommendedRpm.toFixed(0)} RPM
- **推荐离心力**: ${conversion.recommendedRcf.toFixed(1)} ×g
- **离心时间**: ${this.state.centrifugeTime || '未设置'} 分钟

## 样本信息
- **样本总数**: ${balance.totalSamples} 个
- **总重量**: ${balance.totalWeight.toFixed(2)} g
- **加急样本**: ${this.state.samples.filter(s => s.urgent).length} 个

## 配平方案
`;

        if (balance.pairs.length > 0) {
            balance.pairs.forEach((pair, index) => {
                md += `
### 配对 ${index + 1}
- 孔位 ${pair.position1}: ${pair.sample1} (${pair.weight1}g)
- 孔位 ${pair.position2}: ${pair.sample2} (${pair.weight2}g)
- 重量差: ${pair.difference.toFixed(2)}g
`;
            });
        }

        if (balance.unbalancedWeight > 0) {
            md += `\n**⚠️ 注意**: 存在未配对样本，重量 ${balance.unbalancedWeight}g，建议使用配平管\n`;
        }

        md += `\n## 风险提示\n`;
        risks.forEach(risk => {
            const icon = risk.type === 'error' ? '❌' : risk.type === 'warning' ? '⚠️' : risk.type === 'success' ? '✓' : 'ℹ️';
            md += `${icon} [${risk.category}] ${risk.message}\n\n`;
        });

        if (this.state.overrideNotes) {
            md += `\n## 人工改判说明\n${this.state.overrideNotes}\n`;
        }

        if (this.state.handoverNotes) {
            md += `\n## 交接备注\n${this.state.handoverNotes}\n`;
        }

        md += `\n---\n*此交接单由检验科离心计算工具生成*`;

        this.downloadFile(md, `离心交接单_${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
    },

    exportJson() {
        const exportData = {
            timestamp: new Date().toISOString(),
            rotor: this.state.selectedRotor,
            samples: this.state.samples,
            calibration: this.state.calibration,
            calculationResults: this.state.calculationResults,
            parameters: {
                targetType: this.state.targetType,
                targetValue: this.state.targetValue,
                centrifugeTime: this.state.centrifugeTime
            },
            notes: {
                overrideNotes: this.state.overrideNotes,
                handoverNotes: this.state.handoverNotes
            }
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        this.downloadFile(jsonStr, `离心明细_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    clearAllData() {
        if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
            this.state = {
                samples: [],
                rotors: [],
                calibration: null,
                selectedRotor: null,
                selectedTubeType: '',
                targetType: 'rcf',
                targetValue: 0,
                centrifugeTime: 0,
                calculationResults: null,
                overrideNotes: '',
                handoverNotes: '',
                lastUpdate: null
            };
            localStorage.removeItem(this.STORAGE_KEY);
            location.reload();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CentrifugeTool.init();
});
