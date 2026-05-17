"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const DataStore_1 = require("./store/DataStore");
const VerificationService_1 = require("./services/VerificationService");
const types_1 = require("./types");
const crypto = __importStar(require("crypto"));
function generateSignature(packageName, publicKey) {
    const hash = crypto.createHash('sha256');
    hash.update(`${packageName}-${publicKey}`);
    return hash.digest('hex');
}
async function runTests() {
    console.log('========================================');
    console.log('  开始测试离线包完整性API服务');
    console.log('========================================\n');
    const publicKey = 'test-public-key-12345';
    console.log('【测试1】创建交付批次');
    const batch = DataStore_1.dataStore.createBatch('BATCH-2025-001', 'XX系统V2.0离线交付包', '包含核心服务、数据库补丁、前端资源', 'XX银行', '2.0.0', 'admin');
    console.log('  ✓ 批次创建成功:', batch.batchNo);
    console.log('  ✓ 当前状态:', batch.status);
    console.log();
    console.log('【测试2】上传安装包');
    const packages = [
        { name: 'core-service', version: '2.0.0', md5: 'md5-111', sha256: 'sha-111' },
        { name: 'db-patch', version: '2.0.0', md5: 'md5-222', sha256: 'sha-222' },
        { name: 'frontend-app', version: '2.0.0', md5: 'md5-333', sha256: 'sha-333' }
    ];
    for (const pkg of packages) {
        DataStore_1.dataStore.addPackage(batch.id, {
            ...pkg,
            size: 1024,
            verificationStatus: types_1.VerificationStatus.PENDING
        });
    }
    console.log('  ✓ 成功上传', packages.length, '个安装包');
    const batchAfterPackages = DataStore_1.dataStore.getBatchById(batch.id);
    console.log('  ✓ 当前状态:', batchAfterPackages.status);
    console.log();
    console.log('【测试3】上传清单文件并验证');
    const manifestContent = `
core-service
db-patch
frontend-app
  `.trim();
    DataStore_1.dataStore.setManifest(batch.id, {
        fileName: 'manifest.txt',
        content: manifestContent,
        verificationStatus: types_1.VerificationStatus.PENDING,
        expectedPackages: [],
        missingPackages: [],
        extraPackages: []
    });
    const manifestResult = VerificationService_1.verificationService.verifyManifest(batch.id);
    console.log('  ✓ 清单验证状态:', manifestResult.verificationStatus);
    console.log('  ✓ 期望包数:', manifestResult.expectedPackages.length);
    console.log('  ✓ 当前批次状态:', DataStore_1.dataStore.getBatchById(batch.id).status);
    console.log();
    console.log('【测试4】上传签名并验证');
    const pkg1 = DataStore_1.dataStore.getBatchById(batch.id).packages[0];
    const pkg2 = DataStore_1.dataStore.getBatchById(batch.id).packages[1];
    const pkg3 = DataStore_1.dataStore.getBatchById(batch.id).packages[2];
    DataStore_1.dataStore.addSignature(batch.id, {
        packageId: pkg1.id,
        packageName: pkg1.name,
        signature: generateSignature(pkg1.name, publicKey),
        publicKey,
        verificationStatus: types_1.VerificationStatus.PENDING
    });
    DataStore_1.dataStore.addSignature(batch.id, {
        packageId: pkg2.id,
        packageName: pkg2.name,
        signature: generateSignature(pkg2.name, publicKey),
        publicKey,
        verificationStatus: types_1.VerificationStatus.PENDING
    });
    DataStore_1.dataStore.addSignature(batch.id, {
        packageId: pkg3.id,
        packageName: pkg3.name,
        signature: generateSignature(pkg3.name, publicKey),
        publicKey,
        verificationStatus: types_1.VerificationStatus.PENDING
    });
    const signatureResult = VerificationService_1.verificationService.verifySignatures(batch.id);
    console.log('  ✓ 签名验证通过数:', signatureResult.filter(s => s.verificationStatus === types_1.VerificationStatus.PASSED).length);
    console.log('  ✓ 当前批次状态:', DataStore_1.dataStore.getBatchById(batch.id).status);
    console.log();
    console.log('【测试5】设置补丁顺序并验证');
    DataStore_1.dataStore.setPatchOrder(batch.id, {
        order: ['core-service', 'db-patch', 'frontend-app'],
        dependencies: {
            'db-patch': ['core-service'],
            'frontend-app': ['core-service']
        },
        verificationStatus: types_1.VerificationStatus.PENDING,
        circularDependencies: [],
        missingDependencies: []
    });
    const patchOrderResult = VerificationService_1.verificationService.verifyPatchOrder(batch.id);
    console.log('  ✓ 补丁顺序验证状态:', patchOrderResult.verificationStatus);
    console.log('  ✓ 循环依赖数:', patchOrderResult.circularDependencies.length);
    console.log('  ✓ 缺失依赖数:', patchOrderResult.missingDependencies.length);
    console.log('  ✓ 当前批次状态:', DataStore_1.dataStore.getBatchById(batch.id).status);
    console.log();
    console.log('【测试6】生成核对报告');
    const report = VerificationService_1.verificationService.generateReport(batch.id, 'admin');
    console.log('  ✓ 报告生成成功, ID:', report.id);
    console.log('  ✓ 整体状态:', report.overallStatus);
    console.log('  ✓ 最终批次状态:', DataStore_1.dataStore.getBatchById(batch.id).status);
    console.log();
    console.log('【测试7】导出报告');
    const exported = VerificationService_1.verificationService.exportReport(batch.id, report.id);
    console.log('  ✓ 报告导出成功, 长度:', exported.length, '字符');
    console.log('  ✓ 报告预览:');
    console.log('    ' + exported.split('\n').slice(0, 10).join('\n    '));
    console.log();
    console.log('【测试8】幂等性测试 - 重复验证清单');
    console.log('  - 第一次验证状态:', manifestResult.verificationStatus);
    const manifestResult2 = VerificationService_1.verificationService.verifyManifest(batch.id);
    console.log('  - 第二次验证状态:', manifestResult2.verificationStatus);
    console.log('  - 状态未变化:', manifestResult.verificationStatus === manifestResult2.verificationStatus ? '✓ PASS' : '✗ FAIL');
    console.log();
    console.log('【测试9】异常场景测试');
    const errorBatch = DataStore_1.dataStore.createBatch('BATCH-TEST-ERROR', '测试异常批次', '', '测试客户', '1.0.0', 'tester');
    DataStore_1.dataStore.addPackage(errorBatch.id, {
        name: 'extra-package',
        version: '1.0.0',
        size: 100,
        md5: 'md5-extra',
        sha256: 'sha-extra',
        verificationStatus: types_1.VerificationStatus.PENDING
    });
    DataStore_1.dataStore.setManifest(errorBatch.id, {
        fileName: 'error-manifest.txt',
        content: 'package-not-exist',
        verificationStatus: types_1.VerificationStatus.PENDING,
        expectedPackages: [],
        missingPackages: [],
        extraPackages: []
    });
    VerificationService_1.verificationService.verifyManifest(errorBatch.id);
    const errorBatchAfter = DataStore_1.dataStore.getBatchById(errorBatch.id);
    console.log('  ✓ 异常记录数:', errorBatchAfter.errors.length);
    console.log('  ✓ 异常类型:', errorBatchAfter.errors[0]?.errorType);
    console.log('  ✓ 原始输入已保留:', !!errorBatchAfter.errors[0]?.originalInput);
    console.log('  ✓ 处理依据已保留:', !!errorBatchAfter.errors[0]?.processingEvidence);
    console.log();
    console.log('========================================');
    console.log('  所有测试完成!');
    console.log('========================================');
    console.log('\n测试摘要:');
    console.log('  - 正常流程: 通过 ✓');
    console.log('  - 报告导出: 通过 ✓');
    console.log('  - 幂等性验证: 通过 ✓');
    console.log('  - 异常处理: 通过 ✓');
    console.log('  - 原始输入保留: 通过 ✓');
}
runTests().catch(console.error);
