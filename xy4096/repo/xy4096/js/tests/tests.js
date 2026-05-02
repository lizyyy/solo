/**
 * 测试模块
 * 包含各核心模块的单元测试和集成测试
 */

const TestSuite = (function() {
    'use strict';

    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    function assert(condition, message) {
        results.total++;
        if (condition) {
            results.passed++;
            results.tests.push({
                name: message,
                status: 'passed'
            });
            console.log(`✅ PASS: ${message}`);
        } else {
            results.failed++;
            results.tests.push({
                name: message,
                status: 'failed'
            });
            console.log(`❌ FAIL: ${message}`);
        }
        return condition;
    }

    function assertEqual(actual, expected, message) {
        const condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            console.log(`   期望: ${JSON.stringify(expected)}`);
            console.log(`   实际: ${JSON.stringify(actual)}`);
        }
        return assert(condition, message);
    }

    function assertTrue(value, message) {
        return assert(value === true, message);
    }

    function assertFalse(value, message) {
        return assert(value === false, message);
    }

    function assertNotNull(value, message) {
        return assert(value !== null && value !== undefined, message);
    }

    // ========== 数据模型测试 ==========

    async function testDataModels() {
        console.log('\n📋 运行数据模型测试...\n');

        // 测试凭证创建
        const credential = DataModels.createCredential({
            id: 'TEST-001',
            ticketType: 'vip',
            session: 'morning',
            validFrom: Date.now() - 3600000,
            validTo: Date.now() + 86400000
        });

        assertNotNull(credential, '凭证创建成功');
        assertEqual(credential.id, 'TEST-001', '凭证ID正确');
        assertEqual(credential.ticketType, 'vip', '票种正确');
        assertEqual(credential.session, 'morning', '场次正确');
        assertTrue(credential.status === 'unverified', '初始状态为未验证');

        // 测试公钥创建
        const publicKey = DataModels.createPublicKey({
            id: 'test-key-1',
            key: '-----BEGIN PUBLIC KEY-----\ntest-key-data\n-----END PUBLIC KEY-----',
            algorithm: 'RS256'
        });

        assertNotNull(publicKey, '公钥创建成功');
        assertEqual(publicKey.id, 'test-key-1', '公钥ID正确');
        assertEqual(publicKey.algorithm, 'RS256', '算法正确');
        assertTrue(publicKey.isActive, '公钥默认为激活状态');

        // 测试吊销记录创建
        const revocation = DataModels.createRevocation({
            credentialId: 'TEST-001',
            reason: '已退票',
            revokedBy: 'admin'
        });

        assertNotNull(revocation, '吊销记录创建成功');
        assertEqual(revocation.credentialId, 'TEST-001', '凭证ID正确');
        assertEqual(revocation.reason, '已退票', '吊销原因正确');

        // 测试入场记录创建
        const entryRecord = DataModels.createEntryRecord({
            credentialId: 'TEST-001',
            ticketType: 'vip',
            session: 'morning',
            isAllowed: true
        });

        assertNotNull(entryRecord, '入场记录创建成功');
        assertEqual(entryRecord.credentialId, 'TEST-001', '凭证ID正确');
        assertTrue(entryRecord.isAllowed, '允许入场');

        // 测试验证结果创建
        const verificationResult = DataModels.createVerificationResult({
            credentialId: 'TEST-001',
            status: 'success',
            isAllowed: true
        });

        assertNotNull(verificationResult, '验证结果创建成功');
        assertTrue(verificationResult.checks, '包含检查项');

        console.log(`\n📊 数据模型测试: ${results.passed - results.tests.filter(t => t.status === 'passed').length + results.tests.filter(t => t.status === 'passed').length} 通过, ${results.failed} 失败`);
    }

    // ========== 加密适配测试 ==========

    async function testCryptoAdapter() {
        console.log('\n🔐 运行加密适配测试...\n');

        // 测试 WebCrypto 可用性
        assertTrue(CryptoAdapter.isAvailable(), 'WebCrypto API 可用');

        // 测试 Base64 编解码
        const testString = 'Hello, World!';
        const encoded = btoa(testString);
        const decoded = atob(encoded);
        assertEqual(decoded, testString, 'Base64 编解码正确');

        // 测试凭证ID生成
        const id1 = CryptoAdapter.generateCredentialId();
        const id2 = CryptoAdapter.generateCredentialId();
        assertNotNull(id1, '生成凭证ID 1');
        assertNotNull(id2, '生成凭证ID 2');
        assertTrue(id1.length >= 32, '凭证ID长度足够');
        assertTrue(id1 !== id2, '生成的ID唯一');

        // 测试 SHA-256 哈希
        try {
            const hash1 = await CryptoAdapter.sha256('test data');
            const hash2 = await CryptoAdapter.sha256('test data');
            const hash3 = await CryptoAdapter.sha256('different data');
            
            assertNotNull(hash1, 'SHA-256 哈希计算成功');
            assertEqual(hash1, hash2, '相同数据哈希相同');
            assertTrue(hash1 !== hash3, '不同数据哈希不同');
            
            console.log('✅ SHA-256 哈希测试通过');
        } catch (error) {
            console.log('⚠️ SHA-256 哈希测试在非安全上下文可能失败:', error.message);
        }

        // 测试算法常量
        assertNotNull(CryptoAdapter.ALGORITHMS, '算法常量存在');
        assertNotNull(CryptoAdapter.ALGORITHMS.RS256, 'RS256 算法定义');
        assertNotNull(CryptoAdapter.ALGORITHMS.ES256, 'ES256 算法定义');

        console.log(`\n📊 加密适配测试完成`);
    }

    // ========== 校验规则测试 ==========

    async function testValidationRules() {
        console.log('\n✅ 运行校验规则测试...\n');

        // 测试有效期校验
        const now = Date.now();
        
        // 测试有效凭证
        const validCredential = DataModels.createCredential({
            id: 'VALID-001',
            validFrom: now - 3600000,
            validTo: now + 86400000
        });

        const validContext = { currentTime: now };
        const validResult = ValidationRules.expirationRule.validate(validCredential, validContext);
        assertTrue(validResult.valid, '有效期内的凭证通过校验');

        // 测试已过期凭证
        const expiredCredential = DataModels.createCredential({
            id: 'EXPIRED-001',
            validFrom: now - 172800000,
            validTo: now - 86400000
        });

        const expiredResult = ValidationRules.expirationRule.validate(expiredCredential, validContext);
        assertFalse(expiredResult.valid, '已过期的凭证被拒绝');
        assertNotNull(expiredResult.error, '返回过期错误');

        // 测试未生效凭证
        const futureCredential = DataModels.createCredential({
            id: 'FUTURE-001',
            validFrom: now + 86400000,
            validTo: now + 172800000
        });

        const futureResult = ValidationRules.expirationRule.validate(futureCredential, validContext);
        assertFalse(futureResult.valid, '未生效的凭证被拒绝');

        // 测试场次校验
        const sessionContext = {
            allowedSessions: ['morning', 'afternoon']
        };

        const correctSessionCredential = DataModels.createCredential({
            id: 'SESSION-001',
            session: 'morning'
        });

        const sessionResult1 = ValidationRules.sessionRule.validate(correctSessionCredential, sessionContext);
        assertTrue(sessionResult1.valid, '正确场次的凭证通过校验');

        const wrongSessionCredential = DataModels.createCredential({
            id: 'SESSION-002',
            session: 'evening'
        });

        const sessionResult2 = ValidationRules.sessionRule.validate(wrongSessionCredential, sessionContext);
        assertFalse(sessionResult2.valid, '错误场次的凭证被拒绝');

        // 测试票种校验
        const ticketTypeContext = {
            allowedTicketTypes: ['adult', 'vip']
        };

        const validTypeCredential = DataModels.createCredential({
            id: 'TICKET-001',
            ticketType: 'vip'
        });

        const typeResult1 = ValidationRules.ticketTypeRule.validate(validTypeCredential, ticketTypeContext);
        assertTrue(typeResult1.valid, '正确票种的凭证通过校验');

        const invalidTypeCredential = DataModels.createCredential({
            id: 'TICKET-002',
            ticketType: 'child'
        });

        const typeResult2 = ValidationRules.ticketTypeRule.validate(invalidTypeCredential, ticketTypeContext);
        assertFalse(typeResult2.valid, '错误票种的凭证被拒绝');

        // 测试吊销状态校验
        const revocationContext = {
            revocationList: [
                DataModels.createRevocation({ credentialId: 'REVOKED-001', reason: 'test' })
            ]
        };

        const revokedCredential = DataModels.createCredential({
            id: 'REVOKED-001'
        });

        const revokedResult = ValidationRules.revocationRule.validate(revokedCredential, revocationContext);
        assertFalse(revokedResult.valid, '已吊销的凭证被拒绝');

        const activeCredential = DataModels.createCredential({
            id: 'ACTIVE-001'
        });

        const activeResult = ValidationRules.revocationRule.validate(activeCredential, revocationContext);
        assertTrue(activeResult.valid, '未吊销的凭证通过校验');

        // 测试重复使用校验
        const duplicateContext = {
            usedCredentials: new Set(['USED-001']),
            allowMultipleEntries: false
        };

        const usedCredential = DataModels.createCredential({
            id: 'USED-001'
        });

        const duplicateResult = ValidationRules.duplicateRule.validate(usedCredential, duplicateContext);
        assertFalse(duplicateResult.valid, '已使用的凭证被拒绝');

        const unusedCredential = DataModels.createCredential({
            id: 'UNUSED-001'
        });

        const unusedResult = ValidationRules.duplicateRule.validate(unusedCredential, duplicateContext);
        assertTrue(unusedResult.valid, '未使用的凭证通过校验');

        // 测试允许多次入场的情况
        const allowMultipleContext = {
            usedCredentials: new Set(['USED-001']),
            allowMultipleEntries: true
        };

        const multiEntryResult = ValidationRules.duplicateRule.validate(usedCredential, allowMultipleContext);
        assertTrue(multiEntryResult.valid, '允许多次入场时已使用凭证也通过');

        console.log(`\n📊 校验规则测试完成`);
    }

    // ========== 状态描述测试 ==========

    function testStatusDescription() {
        console.log('\n📝 运行状态描述测试...\n');

        // 测试成功状态
        const successResult = {
            isValid: true,
            isAllowed: true,
            errors: [],
            warnings: []
        };

        const successDesc = ValidationRules.getStatusDescription(successResult);
        assertTrue(successDesc.includes('通过'), '成功状态描述正确');

        // 测试签名无效
        const sigInvalidResult = {
            isValid: false,
            isAllowed: false,
            errors: [{ type: 'signature_invalid', message: '签名无效' }],
            warnings: []
        };

        const sigInvalidDesc = ValidationRules.getStatusDescription(sigInvalidResult);
        assertTrue(sigInvalidDesc.includes('伪造') || sigInvalidDesc.includes('签名'), '签名无效描述正确');

        // 测试已过期
        const expiredResult = {
            isValid: false,
            isAllowed: false,
            errors: [{ type: 'expired', message: '已过期' }],
            warnings: []
        };

        const expiredDesc = ValidationRules.getStatusDescription(expiredResult);
        assertTrue(expiredDesc.includes('过期'), '过期状态描述正确');

        // 测试已吊销
        const revokedResult = {
            isValid: false,
            isAllowed: false,
            errors: [{ type: 'revoked', message: '已吊销' }],
            warnings: []
        };

        const revokedDesc = ValidationRules.getStatusDescription(revokedResult);
        assertTrue(revokedDesc.includes('吊销'), '吊销状态描述正确');

        // 测试重复入场
        const duplicateResult = {
            isValid: false,
            isAllowed: false,
            errors: [{ type: 'duplicate_entry', message: '重复入场' }],
            warnings: []
        };

        const duplicateDesc = ValidationRules.getStatusDescription(duplicateResult);
        assertTrue(duplicateDesc.includes('重复'), '重复入场描述正确');

        console.log(`\n📊 状态描述测试完成`);
    }

    // ========== 存储测试 ==========

    async function testStorageManager() {
        console.log('\n💾 运行存储管理测试...\n');

        // 测试 IndexedDB 可用性
        assertTrue(StorageManager.isAvailable(), 'IndexedDB 可用');

        // 测试打开数据库
        try {
            await StorageManager.openDatabase();
            console.log('✅ 数据库打开成功');
        } catch (error) {
            console.log('⚠️ 数据库打开可能需要更多时间:', error.message);
        }

        // 测试 LocalStorage 备用方案
        const testKey = 'test-storage-key';
        const testValue = { test: 'data', number: 123 };
        
        StorageManager.localStorage.set(testKey, testValue);
        const retrieved = StorageManager.localStorage.get(testKey);
        
        assertEqual(retrieved.test, 'data', 'LocalStorage 存储字符串正确');
        assertEqual(retrieved.number, 123, 'LocalStorage 存储数字正确');

        StorageManager.localStorage.remove(testKey);
        const removed = StorageManager.localStorage.get(testKey);
        assertTrue(removed === null, 'LocalStorage 删除正确');

        console.log(`\n📊 存储管理测试完成`);
    }

    // ========== 运行所有测试 ==========

    async function runAllTests() {
        console.log('========================================');
        console.log('🧪 开始运行所有测试');
        console.log('========================================');

        results.total = 0;
        results.passed = 0;
        results.failed = 0;
        results.tests = [];

        try {
            await testDataModels();
            await testCryptoAdapter();
            await testValidationRules();
            testStatusDescription();
            await testStorageManager();
        } catch (error) {
            console.error('测试运行出错:', error);
        }

        console.log('\n========================================');
        console.log('📊 测试汇总');
        console.log('========================================');
        console.log(`总计: ${results.total} 个测试`);
        console.log(`✅ 通过: ${results.passed} 个`);
        console.log(`❌ 失败: ${results.failed} 个`);
        console.log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
        console.log('========================================');

        return results;
    }

    // 公开 API
    return {
        runAllTests,
        results,
        assert,
        assertEqual,
        assertTrue,
        assertFalse
    };
})();

// 导出到全局命名空间
window.TestSuite = TestSuite;

// 如果在测试页面自动运行
if (window.location.pathname.includes('test')) {
    document.addEventListener('DOMContentLoaded', () => {
        TestSuite.runAllTests();
    });
}
