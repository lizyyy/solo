/**
 * 应用程序主界面模块
 * 连接所有核心模块，实现用户界面交互
 */

const App = (function() {
    'use strict';

    const state = {
        currentTab: 'import',
        publicKeys: {},
        usedCredentials: new Set(),
        stats: { total: 0, success: 0, failed: 0, warning: 0 }
    };

    async function init() {
        console.log('离线凭证验签沙盒 初始化...');
        
        if (!CryptoAdapter.isAvailable()) {
            alert('您的浏览器不支持 WebCrypto API，部分功能可能无法正常工作。');
        }
        
        if (!StorageManager.isAvailable()) {
            alert('您的浏览器不支持 IndexedDB，数据将无法持久化存储。');
        }

        try {
            await StorageManager.openDatabase();
            console.log('数据库初始化完成');
        } catch (error) {
            console.error('数据库初始化失败:', error);
        }

        await loadUsedCredentials();
        bindEvents();
        await updateAllStats();
        
        console.log('应用程序初始化完成');
    }

    async function loadUsedCredentials() {
        try {
            state.usedCredentials = await StorageManager.entryRecords.getUsedCredentialIds();
            console.log(`已加载 ${state.usedCredentials.size} 条已使用的凭证记录`);
        } catch (error) {
            console.error('加载已使用凭证失败:', error);
        }
    }

    function bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        document.getElementById('publicKeyFile').addEventListener('change', handlePublicKeyUpload);
        document.getElementById('credentialFile').addEventListener('change', handleCredentialUpload);
        document.getElementById('revocationFile').addEventListener('change', handleRevocationUpload);

        document.getElementById('clearAllData').addEventListener('click', handleClearAllData);
        document.getElementById('loadSampleData').addEventListener('click', handleLoadSampleData);

        document.getElementById('scanMode').addEventListener('click', () => switchInputMode('scan'));
        document.getElementById('manualMode').addEventListener('click', () => switchInputMode('manual'));

        document.getElementById('verifyManual').addEventListener('click', handleManualVerify);
        document.getElementById('startScanner').addEventListener('click', handleStartScanner);
        document.getElementById('qrImageFile').addEventListener('change', handleQRImageUpload);

        document.getElementById('batchVerifyAll').addEventListener('click', handleBatchVerify);
        document.getElementById('batchIsolate').addEventListener('click', handleBatchIsolate);
        document.getElementById('batchClearIsolated').addEventListener('click', handleBatchClearIsolated);

        document.getElementById('batchFilter').addEventListener('change', () => updateBatchTable());
        document.getElementById('batchSearch').addEventListener('input', () => updateBatchTable());
        document.getElementById('recordsFilter').addEventListener('change', () => updateRecordsTable());
        document.getElementById('recordsSearch').addEventListener('input', () => updateRecordsTable());

        document.getElementById('refreshRecords').addEventListener('click', () => updateRecordsTable());
        document.getElementById('clearRecords').addEventListener('click', handleClearRecords);

        document.getElementById('exportMarkdown').addEventListener('click', handleExportMarkdown);
        document.getElementById('exportCSV').addEventListener('click', handleExportCSV);
    }

    async function switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
        state.currentTab = tabName;

        switch (tabName) {
            case 'batch':
                await updateBatchTable();
                await updateBatchStats();
                break;
            case 'records':
                await updateRecordsTable();
                await updateRecordsStats();
                break;
            case 'export':
                updateExportPreview();
                break;
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    async function handlePublicKeyUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const statusEl = document.getElementById('publicKeyStatus');

        try {
            const content = await readFileAsText(file);
            let publicKeys;

            try {
                const data = JSON.parse(content);
                if (data.keys && Array.isArray(data.keys)) {
                    publicKeys = data.keys.map(k => DataModels.createPublicKey(k));
                } else if (data.kty || data.key) {
                    publicKeys = [DataModels.createPublicKey(data)];
                } else {
                    publicKeys = Object.entries(data).map(([id, keyData]) => 
                        DataModels.createPublicKey({ id, ...keyData })
                    );
                }
            } catch {
                if (content.includes('-----BEGIN')) {
                    publicKeys = [DataModels.createPublicKey({
                        id: 'default',
                        key: content,
                        algorithm: 'RS256',
                        format: 'pem'
                    })];
                } else {
                    throw new Error('无法解析公钥格式');
                }
            }

            await StorageManager.publicKeys.saveBatch(publicKeys);
            state.publicKeys = {};
            publicKeys.forEach(k => {
                state.publicKeys[k.id] = { key: k.key, algorithm: k.algorithm };
            });

            statusEl.className = 'status-info success';
            statusEl.textContent = `成功导入 ${publicKeys.length} 个公钥`;
            await updateAllStats();

        } catch (error) {
            statusEl.className = 'status-info error';
            statusEl.textContent = `导入失败: ${error.message}`;
            console.error('公钥导入失败:', error);
        }
    }

    async function handleCredentialUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const statusEl = document.getElementById('credentialStatus');

        try {
            const content = await readFileAsText(file);
            let credentials;

            if (file.name.toLowerCase().endsWith('.csv')) {
                credentials = DataModels.parseCredentialsFromCSV(content);
            } else {
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    credentials = data.map(c => DataModels.createCredential(c));
                } else if (data.credentials && Array.isArray(data.credentials)) {
                    credentials = data.credentials.map(c => DataModels.createCredential(c));
                } else {
                    credentials = [DataModels.createCredential(data)];
                }
            }

            await StorageManager.credentials.saveBatch(credentials);
            statusEl.className = 'status-info success';
            statusEl.textContent = `成功导入 ${credentials.length} 条凭证`;
            await updateAllStats();

        } catch (error) {
            statusEl.className = 'status-info error';
            statusEl.textContent = `导入失败: ${error.message}`;
            console.error('凭证导入失败:', error);
        }
    }

    async function handleRevocationUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const statusEl = document.getElementById('revocationStatus');

        try {
            const content = await readFileAsText(file);
            let revocations;

            if (file.name.toLowerCase().endsWith('.csv')) {
                const lines = content.trim().split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                revocations = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const data = {};
                    headers.forEach((h, idx) => { if (values[idx]) data[h] = values[idx]; });
                    revocations.push(DataModels.createRevocation(data));
                }
            } else {
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    revocations = data.map(r => DataModels.createRevocation(r));
                } else if (data.revocations && Array.isArray(data.revocations)) {
                    revocations = data.revocations.map(r => DataModels.createRevocation(r));
                } else {
                    revocations = [DataModels.createRevocation(data)];
                }
            }

            await StorageManager.revocations.saveBatch(revocations);
            statusEl.className = 'status-info success';
            statusEl.textContent = `成功导入 ${revocations.length} 条吊销记录`;
            await updateAllStats();

        } catch (error) {
            statusEl.className = 'status-info error';
            statusEl.textContent = `导入失败: ${error.message}`;
            console.error('吊销名单导入失败:', error);
        }
    }

    async function handleClearAllData() {
        if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
        try {
            await StorageManager.clearAll();
            state.usedCredentials.clear();
            state.stats = { total: 0, success: 0, failed: 0, warning: 0 };
            state.publicKeys = {};

            document.getElementById('publicKeyStatus').textContent = '';
            document.getElementById('credentialStatus').textContent = '';
            document.getElementById('revocationStatus').textContent = '';

            document.getElementById('verifyResult').innerHTML = '<p class="placeholder">请扫描或输入凭证进行验签</p>';
            document.getElementById('verifyResult').className = 'result-box placeholder';

            await updateAllStats();
            alert('所有数据已清空');
        } catch (error) {
            alert(`清空数据失败: ${error.message}`);
            console.error('清空数据失败:', error);
        }
    }

    async function handleLoadSampleData() {
        try {
            const sampleCredentials = [
                {
                    id: 'CRED-001',
                    ticketType: 'adult',
                    session: 'morning',
                    validFrom: Date.now() - 3600000,
                    validTo: Date.now() + 86400000,
                    status: 'unverified'
                },
                {
                    id: 'CRED-002',
                    ticketType: 'vip',
                    session: 'morning',
                    validFrom: Date.now() - 3600000,
                    validTo: Date.now() + 86400000,
                    status: 'unverified'
                },
                {
                    id: 'CRED-003',
                    ticketType: 'child',
                    session: 'afternoon',
                    validFrom: Date.now() - 3600000,
                    validTo: Date.now() + 86400000,
                    status: 'unverified'
                }
            ];

            const credentials = sampleCredentials.map(c => DataModels.createCredential(c));
            await StorageManager.credentials.saveBatch(credentials);

            const sampleRevocations = [
                {
                    credentialId: 'CRED-003',
                    reason: '已退票',
                    revokedAt: Date.now()
                }
            ];

            const revocations = sampleRevocations.map(r => DataModels.createRevocation(r));
            await StorageManager.revocations.saveBatch(revocations);

            await updateAllStats();
            alert('示例数据已加载！\n\n凭证: 3条\n吊销: 1条 (CRED-003)');
        } catch (error) {
            alert(`加载示例数据失败: ${error.message}`);
            console.error('加载示例数据失败:', error);
        }
    }

    function switchInputMode(mode) {
        const scanBtn = document.getElementById('scanMode');
        const manualBtn = document.getElementById('manualMode');
        const scanSection = document.getElementById('scanInputSection');
        const manualSection = document.getElementById('manualInputSection');

        scanBtn.classList.toggle('active', mode === 'scan');
        manualBtn.classList.toggle('active', mode === 'manual');
        scanSection.style.display = mode === 'scan' ? 'block' : 'none';
        manualSection.style.display = mode === 'manual' ? 'block' : 'none';
    }

    async function handleManualVerify() {
        const input = document.getElementById('manualCredentialInput').value.trim();
        if (!input) {
            alert('请输入凭证内容');
            return;
        }

        let credential;
        try {
            const data = JSON.parse(input);
            credential = DataModels.createCredential(data);
        } catch {
            credential = DataModels.createCredential({ id: input });
        }

        await verifyAndDisplayCredential(credential);
    }

    async function handleStartScanner() {
        alert('摄像头扫描功能需要额外的 QR 码扫描库支持。\n\n您可以：\n1. 选择二维码图片进行识别\n2. 或者手动输入凭证ID');
    }

    async function handleQRImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        alert('图片二维码识别功能需要额外的 QR 码解析库支持。\n\n请手动输入凭证内容。');
    }

    async function verifyAndDisplayCredential(credential) {
        const resultEl = document.getElementById('verifyResult');
        
        try {
            const publicKeys = await StorageManager.publicKeys.getAll();
            const keyMap = {};
            publicKeys.forEach(k => {
                keyMap[k.id] = { key: k.key, algorithm: k.algorithm };
            });

            const revocations = await StorageManager.revocations.getAll();

            const context = {
                publicKeys: keyMap,
                revocationList: revocations,
                usedCredentials: state.usedCredentials,
                allowUnsignedCredentials: true
            };

            const validationResult = await ValidationRules.validateCredential(credential, context);
            
            state.stats.total++;
            if (validationResult.isAllowed) {
                state.stats.success++;
            } else if (validationResult.errors.length > 0) {
                const criticalError = validationResult.errors.find(e => 
                    e.type === 'signature_invalid' || 
                    e.type === 'revoked' ||
                    e.type === 'duplicate_entry'
                );
                if (criticalError) {
                    state.stats.failed++;
                } else {
                    state.stats.warning++;
                }
            }

            const entryRecord = DataModels.createEntryRecord({
                credentialId: credential.id,
                ticketType: credential.ticketType,
                session: credential.session,
                verificationStatus: validationResult.status,
                verificationDetails: validationResult,
                isAllowed: validationResult.isAllowed,
                denyReason: validationResult.denyReason
            });

            await StorageManager.entryRecords.save(entryRecord);

            if (validationResult.isAllowed) {
                state.usedCredentials.add(credential.id);
            }

            displayVerificationResult(credential, validationResult);
            updateQuickStats();

        } catch (error) {
            resultEl.className = 'result-box failed';
            resultEl.innerHTML = `<h4>验签出错</h4><p>${error.message}</p>`;
            console.error('验签过程出错:', error);
        }
    }

    function displayVerificationResult(credential, result) {
        const resultEl = document.getElementById('verifyResult');
        
        let statusClass = 'failed';
        let statusText = '验签失败';
        let statusIcon = '❌';

        if (result.isAllowed) {
            statusClass = 'success';
            statusText = '验签通过，允许入场';
            statusIcon = '✅';
        } else if (result.warnings.length > 0 && result.errors.length === 0) {
            statusClass = 'warning';
            statusText = '验签通过，但存在警告';
            statusIcon = '⚠️';
        }

        resultEl.className = `result-box ${statusClass}`;
        
        let html = `
            <h4>${statusIcon} ${statusText}</h4>
            <div class="result-details">
                <p><strong>凭证ID:</strong> ${credential.id}</p>
                <p><strong>票种:</strong> ${credential.ticketType}</p>
                <p><strong>场次:</strong> ${credential.session}</p>
                <p><strong>状态:</strong> ${result.status}</p>
            </div>
        `;

        if (result.checks) {
            html += '<div class="result-details"><h5>检查项:</h5><ul>';
            Object.entries(result.checks).forEach(([rule, valid]) => {
                const icon = valid ? '✅' : '❌';
                html += `<li>${icon} ${rule}: ${valid ? '通过' : '失败'}</li>`;
            });
            html += '</ul></div>';
        }

        if (result.errors.length > 0) {
            html += '<div class="result-details"><h5>错误:</h5><ul>';
            result.errors.forEach(err => {
                html += `<li>❌ ${err.message}</li>`;
            });
            html += '</ul></div>';
        }

        if (result.warnings.length > 0) {
            html += '<div class="result-details"><h5>警告:</h5><ul>';
            result.warnings.forEach(warn => {
                html += `<li>⚠️ ${warn.message}</li>`;
            });
            html += '</ul></div>';
        }

        resultEl.innerHTML = html;
    }

    function updateQuickStats() {
        document.getElementById('statTotal').textContent = state.stats.total;
        document.getElementById('statSuccess').textContent = state.stats.success;
        document.getElementById('statFailed').textContent = state.stats.failed;
        document.getElementById('statWarning').textContent = state.stats.warning;
    }

    async function updateAllStats() {
        updateQuickStats();
        if (state.currentTab === 'batch') {
            await updateBatchStats();
        }
        if (state.currentTab === 'records') {
            await updateRecordsStats();
        }
    }

    async function handleBatchVerify() {
        const credentials = await StorageManager.credentials.getAll();
        if (credentials.length === 0) {
            alert('没有可验证的凭证');
            return;
        }

        const publicKeys = await StorageManager.publicKeys.getAll();
        const keyMap = {};
        publicKeys.forEach(k => {
            keyMap[k.id] = { key: k.key, algorithm: k.algorithm };
        });

        const revocations = await StorageManager.revocations.getAll();

        const context = {
            publicKeys: keyMap,
            revocationList: revocations,
            usedCredentials: state.usedCredentials,
            allowUnsignedCredentials: true
        };

        let verified = 0;
        let valid = 0;
        let invalid = 0;

        for (const credential of credentials) {
            const result = await ValidationRules.validateCredential(credential, context);
            credential.verificationResult = result;
            credential.verificationTime = Date.now();
            credential.status = result.isAllowed ? 
                DataModels.CREDENTIAL_STATUS.VALID : 
                DataModels.CREDENTIAL_STATUS.INVALID;

            if (result.isAllowed) valid++;
            else invalid++;
            verified++;

            await StorageManager.credentials.save(credential);
        }

        alert(`批量验证完成!\n\n总计: ${credentials.length}\n已验证: ${verified}\n有效: ${valid}\n无效: ${invalid}`);
        
        await updateBatchTable();
        await updateBatchStats();
    }

    async function handleBatchIsolate() {
        const credentials = await StorageManager.credentials.getAll();
        const invalidCredentials = credentials.filter(c => 
            c.status === DataModels.CREDENTIAL_STATUS.INVALID ||
            c.status === DataModels.CREDENTIAL_STATUS.REVOKED ||
            c.status === DataModels.CREDENTIAL_STATUS.SIGNATURE_INVALID
        );

        if (invalidCredentials.length === 0) {
            alert('没有需要隔离的异常凭证');
            return;
        }

        for (const credential of invalidCredentials) {
            credential.isIsolated = true;
            credential.isolationReason = '批量隔离 - 验签失败';
            await StorageManager.credentials.save(credential);
        }

        alert(`已隔离 ${invalidCredentials.length} 条异常凭证`);
        await updateBatchTable();
        await updateBatchStats();
    }

    async function handleBatchClearIsolated() {
        if (!confirm('确定要清空隔离区吗？')) return;

        const credentials = await StorageManager.credentials.getAll();
        const isolatedCredentials = credentials.filter(c => c.isIsolated);

        for (const credential of isolatedCredentials) {
            await StorageManager.credentials.delete(credential.id);
        }

        alert(`已清除 ${isolatedCredentials.length} 条隔离凭证`);
        await updateBatchTable();
        await updateBatchStats();
    }

    async function updateBatchTable() {
        const filter = document.getElementById('batchFilter').value;
        const search = document.getElementById('batchSearch').value.toLowerCase();
        const credentials = await StorageManager.credentials.getAll();

        let filtered = credentials;

        if (filter !== 'all') {
            filtered = filtered.filter(c => {
                switch (filter) {
                    case 'valid':
                        return c.status === DataModels.CREDENTIAL_STATUS.VALID;
                    case 'invalid':
                        return c.status === DataModels.CREDENTIAL_STATUS.INVALID;
                    case 'isolated':
                        return c.isIsolated;
                    case 'unverified':
                        return c.status === DataModels.CREDENTIAL_STATUS.UNVERIFIED;
                    default:
                        return true;
                }
            });
        }

        if (search) {
            filtered = filtered.filter(c => 
                c.id.toLowerCase().includes(search)
            );
        }

        const tbody = document.querySelector('#batchTable tbody');
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="placeholder">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.ticketType}</td>
                <td>${c.session}</td>
                <td><span class="status-badge ${getStatusBadgeClass(c.status)}">${c.status}</span></td>
                <td>${c.verificationResult ? (c.verificationResult.isAllowed ? '通过' : '失败') : '未验证'}</td>
                <td>
                    <button onclick="App.isolateCredential('${c.id}')" class="btn btn-warning" style="padding: 4px 8px; font-size: 12px;">隔离</button>
                </td>
            </tr>
        `).join('');
    }

    function getStatusBadgeClass(status) {
        switch (status) {
            case DataModels.CREDENTIAL_STATUS.VALID:
                return 'success';
            case DataModels.CREDENTIAL_STATUS.INVALID:
            case DataModels.CREDENTIAL_STATUS.REVOKED:
            case DataModels.CREDENTIAL_STATUS.EXPIRED:
            case DataModels.CREDENTIAL_STATUS.SIGNATURE_INVALID:
                return 'failed';
            case DataModels.CREDENTIAL_STATUS.DUPLICATE:
                return 'warning';
            default:
                return 'info';
        }
    }

    async function updateBatchStats() {
        const credentials = await StorageManager.credentials.getAll();
        
        const total = credentials.length;
        const verified = credentials.filter(c => c.status !== DataModels.CREDENTIAL_STATUS.UNVERIFIED).length;
        const valid = credentials.filter(c => c.status === DataModels.CREDENTIAL_STATUS.VALID).length;
        const invalid = credentials.filter(c => 
            c.status === DataModels.CREDENTIAL_STATUS.INVALID ||
            c.status === DataModels.CREDENTIAL_STATUS.REVOKED ||
            c.status === DataModels.CREDENTIAL_STATUS.EXPIRED
        ).length;
        const isolated = credentials.filter(c => c.isIsolated).length;

        document.getElementById('batchTotal').textContent = total;
        document.getElementById('batchVerified').textContent = verified;
        document.getElementById('batchValid').textContent = valid;
        document.getElementById('batchInvalid').textContent = invalid;
        document.getElementById('batchIsolated').textContent = isolated;
    }

    async function handleClearRecords() {
        if (!confirm('确定要清空所有入场流水吗？')) return;
        try {
            await StorageManager.entryRecords.clear();
            state.usedCredentials.clear();
            state.stats = { total: 0, success: 0, failed: 0, warning: 0 };
            
            await updateRecordsTable();
            await updateRecordsStats();
            updateQuickStats();
            
            alert('入场流水已清空');
        } catch (error) {
            alert(`清空失败: ${error.message}`);
        }
    }

    async function updateRecordsTable() {
        const filter = document.getElementById('recordsFilter').value;
        const search = document.getElementById('recordsSearch').value.toLowerCase();
        const records = await StorageManager.entryRecords.getAll();

        records.sort((a, b) => b.timestamp - a.timestamp);

        let filtered = records;

        if (filter !== 'all') {
            filtered = filtered.filter(r => {
                switch (filter) {
                    case 'success':
                        return r.isAllowed;
                    case 'failed':
                        return !r.isAllowed;
                    case 'duplicate':
                        return r.denyReason && r.denyReason.includes('重复');
                    default:
                        return true;
                }
            });
        }

        if (search) {
            filtered = filtered.filter(r => 
                r.credentialId.toLowerCase().includes(search)
            );
        }

        const tbody = document.querySelector('#recordsTable tbody');
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="placeholder">暂无流水记录</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.slice(0, 100).map(r => `
            <tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.credentialId}</td>
                <td>${r.ticketType || '-'}</td>
                <td>${r.session || '-'}</td>
                <td><span class="status-badge ${r.isAllowed ? 'success' : 'failed'}">${r.isAllowed ? '通过' : '拒绝'}</span></td>
                <td>${r.denyReason || r.verificationStatus || '-'}</td>
            </tr>
        `).join('');
    }

    async function updateRecordsStats() {
        const stats = await StorageManager.entryRecords.getStats();
        
        document.getElementById('recordsTotal').textContent = stats.total;
        document.getElementById('recordsToday').textContent = stats.today;
        document.getElementById('recordsDuplicate').textContent = stats.duplicates;
    }

    function updateExportPreview() {
        const preview = document.getElementById('exportPreview');
        preview.textContent = '选择导出选项后，点击导出按钮生成文件。\n\nMarkdown复盘报告将包含：\n- 统计信息\n- 异常记录\n- 关键数据\n\nCSV流水将包含：\n- 所有入场记录\n- 验签结果\n- 时间戳';
    }

    async function handleExportMarkdown() {
        const includeStats = document.getElementById('includeStats').checked;
        const includeAnomalies = document.getElementById('includeAnomalies').checked;
        const includeSample = document.getElementById('includeSample').checked;

        const credentials = await StorageManager.credentials.getAll();
        const records = await StorageManager.entryRecords.getAll();
        const revocations = await StorageManager.revocations.getAll();
        const publicKeys = await StorageManager.publicKeys.getAll();

        let markdown = `# 离线凭证验签复盘报告\n\n`;
        markdown += `生成时间: ${new Date().toLocaleString()}\n\n`;
        markdown += `---\n\n`;

        if (includeStats) {
            markdown += `## 统计信息\n\n`;
            markdown += `### 凭证统计\n\n`;
            markdown += `- 总凭证数: ${credentials.length}\n`;
            const verified = credentials.filter(c => c.status !== DataModels.CREDENTIAL_STATUS.UNVERIFIED).length;
            markdown += `- 已验证: ${verified}\n`;
            const valid = credentials.filter(c => c.status === DataModels.CREDENTIAL_STATUS.VALID).length;
            markdown += `- 有效: ${valid}\n`;
            const invalid = credentials.length - verified - valid;
            markdown += `- 无效/未验证: ${invalid}\n\n`;

            markdown += `### 入场统计\n\n`;
            markdown += `- 总验签次数: ${records.length}\n`;
            const allowed = records.filter(r => r.isAllowed).length;
            markdown += `- 通过: ${allowed}\n`;
            markdown += `- 拒绝: ${records.length - allowed}\n\n`;

            markdown += `### 系统配置\n\n`;
            markdown += `- 公钥数量: ${publicKeys.length}\n`;
            markdown += `- 吊销记录: ${revocations.length}\n\n`;
        }

        if (includeAnomalies) {
            markdown += `## 异常记录\n\n`;
            
            const revokedCredentials = credentials.filter(c => 
                c.status === DataModels.CREDENTIAL_STATUS.REVOKED
            );
            const duplicateAttempts = records.filter(r => 
                r.denyReason && r.denyReason.includes('重复')
            );
            const isolatedCredentials = credentials.filter(c => c.isIsolated);

            if (revokedCredentials.length > 0) {
                markdown += `### 已吊销凭证\n\n`;
                revokedCredentials.forEach(c => {
                    markdown += `- ${c.id} (票种: ${c.ticketType}, 场次: ${c.session})\n`;
                });
                markdown += `\n`;
            }

            if (duplicateAttempts.length > 0) {
                markdown += `### 重复入场尝试\n\n`;
                markdown += `共 ${duplicateAttempts.length} 次重复入场尝试\n\n`;
            }

            if (isolatedCredentials.length > 0) {
                markdown += `### 隔离区凭证\n\n`;
                isolatedCredentials.forEach(c => {
                    markdown += `- ${c.id}: ${c.isolationReason || '未知原因'}\n`;
                });
                markdown += `\n`;
            }

            if (revokedCredentials.length === 0 && 
                duplicateAttempts.length === 0 && 
                isolatedCredentials.length === 0) {
                markdown += `无异常记录。\n\n`;
            }
        }

        if (includeSample && records.length > 0) {
            markdown += `## 样本数据\n\n`;
            markdown += `### 最近入场记录\n\n`;
            
            const recentRecords = records
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);

            recentRecords.forEach(r => {
                markdown += `- **${new Date(r.timestamp).toLocaleString()}**\n`;
                markdown += `  - 凭证ID: ${r.credentialId}\n`;
                markdown += `  - 结果: ${r.isAllowed ? '通过' : '拒绝'}\n`;
                if (r.denyReason) {
                    markdown += `  - 原因: ${r.denyReason}\n`;
                }
                markdown += `\n`;
            });
        }

        markdown += `---\n\n`;
        markdown += `*此报告由离线凭证验签沙盒生成*\n`;
        markdown += `*数据完全本地存储，保护隐私安全*\n`;

        downloadFile(markdown, `复盘报告_${new Date().toISOString().split('T')[0]}.md`, 'text/markdown');
    }

    async function handleExportCSV() {
        const records = await StorageManager.entryRecords.getAll();
        records.sort((a, b) => b.timestamp - a.timestamp);

        const includeAllFields = document.getElementById('includeAllFields').checked;

        let csv = '';
        
        if (includeAllFields) {
            csv = '时间,凭证ID,票种,场次,验签状态,是否允许,拒绝原因,操作人\n';
            records.forEach(r => {
                csv += `${new Date(r.timestamp).toISOString()},`;
                csv += `"${r.credentialId}",`;
                csv += `"${r.ticketType || ''}",`;
                csv += `"${r.session || ''}",`;
                csv += `"${r.verificationStatus || ''}",`;
                csv += `${r.isAllowed},`;
                csv += `"${r.denyReason || ''}",`;
                csv += `"${r.operator || ''}"\n`;
            });
        } else {
            csv = '时间,凭证ID,是否允许,拒绝原因\n';
            records.forEach(r => {
                csv += `${new Date(r.timestamp).toISOString()},`;
                csv += `"${r.credentialId}",`;
                csv += `${r.isAllowed},`;
                csv += `"${r.denyReason || ''}"\n`;
            });
        }

        downloadFile(csv, `入场流水_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
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

    async function isolateCredential(credentialId) {
        const credential = await StorageManager.credentials.getById(credentialId);
        if (credential) {
            credential.isIsolated = !credential.isIsolated;
            credential.isolationReason = credential.isIsolated ? '手动隔离' : null;
            await StorageManager.credentials.save(credential);
            await updateBatchTable();
            await updateBatchStats();
        }
    }

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', init);

    // 公开 API
    return {
        init,
        isolateCredential,
        state
    };
})();

window.App = App;
