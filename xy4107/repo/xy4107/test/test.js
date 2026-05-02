const storage = require('../src/storage');
const stateMachine = require('../src/stateMachine');
const importExport = require('../src/importExport');

console.log('========================================');
console.log('  无密码登录彩排台 - 测试脚本');
console.log('========================================\n');

async function runTests() {
    console.log('🧹 清理测试数据...\n');
    storage.resetAll();

    let allPassed = true;

    try {
        console.log('📝 测试 1: 用户创建...');
        const user = await stateMachine.startUserRegistration(
            'testuser',
            '测试用户',
            'test@example.com'
        );
        
        if (user && user.username === 'testuser') {
            console.log('✅ 测试 1 通过: 用户创建成功\n');
        } else {
            console.log('❌ 测试 1 失败: 用户创建失败\n');
            allPassed = false;
        }

        console.log('📝 测试 2: 凭证注册 (模拟模式)...');
        const regStart = await stateMachine.startCredentialRegistration(
            user.id,
            { name: '测试设备', type: 'platform' },
            true
        );
        
        if (regStart && regStart.challenge) {
            console.log('✅ 测试 2a 通过: 注册挑战生成成功');
        } else {
            console.log('❌ 测试 2a 失败: 注册挑战生成失败');
            allPassed = false;
        }

        const regComplete = await stateMachine.completeCredentialRegistration(
            user.id,
            null,
            true
        );
        
        if (regComplete.success && regComplete.credential && regComplete.backupCodes.length === 10) {
            console.log('✅ 测试 2b 通过: 凭证注册成功，生成 10 个备用码\n');
        } else {
            console.log('❌ 测试 2b 失败: 凭证注册失败');
            allPassed = false;
        }

        console.log('📝 测试 3: 登录认证 (模拟模式)...');
        const loginStart = await stateMachine.startAuthentication('testuser', true);
        
        if (loginStart && loginStart.challenge) {
            console.log('✅ 测试 3a 通过: 登录挑战生成成功');
        } else {
            console.log('❌ 测试 3a 失败: 登录挑战生成失败');
            allPassed = false;
        }

        const credentials = storage.getCredentialsByUserId(user.id);
        const loginComplete = await stateMachine.completeAuthentication(
            user.id,
            null,
            credentials[0].id,
            true
        );
        
        if (loginComplete.success) {
            console.log('✅ 测试 3b 通过: 登录认证成功\n');
        } else {
            console.log('❌ 测试 3b 失败: 登录认证失败');
            allPassed = false;
        }

        console.log('📝 测试 4: 备用码登录...');
        const backupCodes = storage.getBackupCodesByUserId(user.id);
        const backupLogin = await stateMachine.authenticateWithBackupCode(
            user.id,
            backupCodes[0].code
        );
        
        if (backupLogin.success) {
            console.log('✅ 测试 4a 通过: 备用码登录成功');
        } else {
            console.log('❌ 测试 4a 失败: 备用码登录失败');
            allPassed = false;
        }

        const usedCode = storage.getBackupCodes().find(c => c.id === backupCodes[0].id);
        if (usedCode.used) {
            console.log('✅ 测试 4b 通过: 备用码已标记为已使用\n');
        } else {
            console.log('❌ 测试 4b 失败: 备用码未标记为已使用');
            allPassed = false;
        }

        console.log('📝 测试 5: 凭证撤销...');
        const credentialToRevoke = storage.getCredentialsByUserId(user.id)[0];
        const revoked = await stateMachine.revokeCredential(
            credentialToRevoke.id,
            '测试撤销'
        );
        
        if (revoked && !revoked.isActive) {
            console.log('✅ 测试 5a 通过: 凭证已撤销');
        } else {
            console.log('❌ 测试 5a 失败: 凭证撤销失败');
            allPassed = false;
        }

        const updatedCred = storage.getCredentialById(credentialToRevoke.id);
        if (!updatedCred.isActive) {
            console.log('✅ 测试 5b 通过: 凭证状态已更新为非活跃\n');
        } else {
            console.log('❌ 测试 5b 失败: 凭证状态未更新');
            allPassed = false;
        }

        console.log('📝 测试 6: 备用码重新生成...');
        const newCodes = await stateMachine.regenerateBackupCodes(user.id);
        
        if (newCodes.length === 10) {
            console.log('✅ 测试 6a 通过: 生成了 10 个新备用码');
        } else {
            console.log('❌ 测试 6a 失败: 备用码生成失败');
            allPassed = false;
        }

        const oldCodes = storage.getBackupCodes().filter(c => c.id === backupCodes[1].id);
        if (oldCodes[0].used) {
            console.log('✅ 测试 6b 通过: 旧备用码已失效\n');
        } else {
            console.log('❌ 测试 6b 失败: 旧备用码未失效');
            allPassed = false;
        }

        console.log('📝 测试 7: CSV 用户导入...');
        const sampleCsv = importExport.generateSampleCSV();
        const importResult = await importExport.importUsersFromCSV(sampleCsv);
        
        if (importResult.success && importResult.imported === 3) {
            console.log('✅ 测试 7 通过: CSV 导入成功，导入了 3 个用户\n');
        } else {
            console.log('❌ 测试 7 失败: CSV 导入失败');
            allPassed = false;
        }

        console.log('📝 测试 8: 审计日志记录...');
        const auditLogs = stateMachine.getAuditLogs({});
        
        const requiredActions = [
            'REGISTRATION_STARTED',
            'REGISTRATION_CHALLENGE_ISSUED',
            'REGISTRATION_COMPLETED',
            'AUTHENTICATION_CHALLENGE_ISSUED',
            'AUTHENTICATION_COMPLETED',
            'BACKUP_CODE_USED',
            'CREDENTIAL_REVOKED',
            'BACKUP_CODES_REGENERATED',
            'USER_IMPORTED'
        ];

        let allActionsLogged = true;
        requiredActions.forEach(action => {
            const found = auditLogs.find(l => l.action === action);
            if (!found) {
                console.log(`❌ 缺少审计日志: ${action}`);
                allActionsLogged = false;
            }
        });

        if (allActionsLogged) {
            console.log('✅ 测试 8 通过: 所有操作都有审计日志记录\n');
        } else {
            console.log('❌ 测试 8 失败: 缺少审计日志\n');
            allPassed = false;
        }

        console.log('📝 测试 9: Markdown 报告导出...');
        const report = importExport.exportMarkdownReport({});
        
        if (report && report.includes('# 无密码登录安全演练报告') && report.includes('用户统计')) {
            console.log('✅ 测试 9 通过: Markdown 报告生成成功\n');
        } else {
            console.log('❌ 测试 9 失败: Markdown 报告生成失败\n');
            allPassed = false;
        }

        console.log('📝 测试 10: JSON 审计包导出...');
        const auditPackage = importExport.exportAuditPackage({});
        const packageData = JSON.parse(auditPackage);
        
        if (packageData.metadata && packageData.statistics && packageData.auditLogs) {
            console.log('✅ 测试 10 通过: JSON 审计包生成成功\n');
        } else {
            console.log('❌ 测试 10 失败: JSON 审计包生成失败\n');
            allPassed = false;
        }

        console.log('📝 测试 11: 统计数据...');
        const stats = stateMachine.getStatistics();
        
        if (stats.users.total === 4 &&  // testuser + 3 imported
            stats.credentials.total >= 1 &&
            stats.audit.total > 0) {
            console.log('✅ 测试 11 通过: 统计数据正确\n');
        } else {
            console.log('❌ 测试 11 失败: 统计数据不正确');
            console.log('  统计结果:', JSON.stringify(stats, null, 2));
            allPassed = false;
        }

        console.log('📝 测试 12: 数据持久化验证...');
        const usersFromFile = storage.getUsers();
        const credentialsFromFile = storage.getCredentials();
        const auditFromFile = storage.getAuditLogs();
        
        if (usersFromFile.length > 0 && 
            credentialsFromFile.length > 0 && 
            auditFromFile.length > 0) {
            console.log('✅ 测试 12 通过: 数据已持久化到文件\n');
        } else {
            console.log('❌ 测试 12 失败: 数据持久化失败');
            allPassed = false;
        }

    } catch (error) {
        console.log('\n❌ 测试执行出错:', error.message);
        console.log(error.stack);
        allPassed = false;
    }

    console.log('========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    
    if (allPassed) {
        console.log('\n✅ 所有测试通过！\n');
    } else {
        console.log('\n❌ 部分测试失败，请检查错误信息\n');
        process.exit(1);
    }

    console.log('\n🧹 清理测试数据...\n');
    storage.resetAll();
}

runTests();
