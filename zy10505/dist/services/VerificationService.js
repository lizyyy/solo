"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationService = exports.VerificationService = void 0;
const DataStore_1 = require("../store/DataStore");
const types_1 = require("../types");
class VerificationService {
    verifyManifestContent(content) {
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
            const parts = line.split(/\s+/);
            return parts[parts.length - 1];
        }).filter(name => name && name.length > 0);
    }
    verifySignature(packageName, signature, publicKey) {
        const expectedSignature = this.generateExpectedSignature(packageName, publicKey);
        return signature === expectedSignature;
    }
    generateExpectedSignature(packageName, publicKey) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256');
        hash.update(`${packageName}-${publicKey}`);
        return hash.digest('hex');
    }
    findCircularDependencies(order, dependencies) {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const dfs = (pkg, path) => {
            if (recursionStack.has(pkg)) {
                const cycleStart = path.indexOf(pkg);
                if (cycleStart !== -1) {
                    const cycle = path.slice(cycleStart);
                    cycles.push(cycle.join(' -> ') + ' -> ' + pkg);
                }
                return true;
            }
            if (visited.has(pkg)) {
                return false;
            }
            visited.add(pkg);
            recursionStack.add(pkg);
            path.push(pkg);
            const deps = dependencies[pkg] || [];
            for (const dep of deps) {
                if (dfs(dep, [...path])) {
                    return true;
                }
            }
            recursionStack.delete(pkg);
            return false;
        };
        for (const pkg of order) {
            dfs(pkg, []);
        }
        return cycles;
    }
    findMissingDependencies(order, dependencies) {
        const allPackages = new Set(order);
        const missing = [];
        for (const pkg of order) {
            const deps = dependencies[pkg] || [];
            for (const dep of deps) {
                if (!allPackages.has(dep)) {
                    missing.push(`${pkg} 依赖的 ${dep} 不存在`);
                }
            }
        }
        return [...new Set(missing)];
    }
    verifyManifest(batchId) {
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        if (!batch.manifest) {
            throw new Error('清单文件未上传');
        }
        if (batch.manifest.verificationStatus !== types_1.VerificationStatus.PENDING) {
            return batch.manifest;
        }
        const expectedPackages = this.verifyManifestContent(batch.manifest.content);
        const actualPackages = batch.packages.map(p => p.name);
        const missingPackages = expectedPackages.filter(p => !actualPackages.includes(p));
        const extraPackages = actualPackages.filter(p => !expectedPackages.includes(p));
        batch.manifest.expectedPackages = expectedPackages;
        batch.manifest.missingPackages = missingPackages;
        batch.manifest.extraPackages = extraPackages;
        if (missingPackages.length === 0 && extraPackages.length === 0) {
            batch.manifest.verificationStatus = types_1.VerificationStatus.PASSED;
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.MANIFEST_VERIFIED);
        }
        else {
            batch.manifest.verificationStatus = types_1.VerificationStatus.FAILED;
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.ERROR);
            DataStore_1.dataStore.addError(batchId, {
                errorType: 'MANIFEST_MISMATCH',
                errorMessage: `清单校验失败: 缺少 ${missingPackages.length} 个包, 多出 ${extraPackages.length} 个包`,
                originalInput: { expected: expectedPackages, actual: actualPackages },
                processingEvidence: { missing: missingPackages, extra: extraPackages },
                resolved: false
            });
        }
        return batch.manifest;
    }
    verifySignatures(batchId) {
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const unverifiedSignatures = batch.signatures.filter(s => s.verificationStatus === types_1.VerificationStatus.PENDING);
        if (unverifiedSignatures.length === 0) {
            return batch.signatures;
        }
        for (const signature of unverifiedSignatures) {
            const isValid = this.verifySignature(signature.packageName, signature.signature, signature.publicKey);
            if (isValid) {
                signature.verificationStatus = types_1.VerificationStatus.PASSED;
            }
            else {
                signature.verificationStatus = types_1.VerificationStatus.FAILED;
                signature.errorMessage = '签名校验失败';
                DataStore_1.dataStore.addError(batchId, {
                    errorType: 'SIGNATURE_INVALID',
                    errorMessage: `包 ${signature.packageName} 签名校验失败`,
                    originalInput: { packageName: signature.packageName, signature: signature.signature },
                    processingEvidence: { expected: this.generateExpectedSignature(signature.packageName, signature.publicKey), actual: signature.signature },
                    resolved: false
                });
            }
        }
        const allPassed = batch.signatures.every(s => s.verificationStatus === types_1.VerificationStatus.PASSED ||
            s.verificationStatus === types_1.VerificationStatus.MANUALLY_FIXED);
        if (allPassed && batch.signatures.length > 0) {
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.SIGNATURE_VERIFIED);
        }
        else if (batch.signatures.some(s => s.verificationStatus === types_1.VerificationStatus.FAILED)) {
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.ERROR);
        }
        return batch.signatures;
    }
    verifyPatchOrder(batchId) {
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        if (!batch.patchOrder) {
            throw new Error('补丁顺序未设置');
        }
        if (batch.patchOrder.verificationStatus !== types_1.VerificationStatus.PENDING) {
            return batch.patchOrder;
        }
        const circularDeps = this.findCircularDependencies(batch.patchOrder.order, batch.patchOrder.dependencies);
        const missingDeps = this.findMissingDependencies(batch.patchOrder.order, batch.patchOrder.dependencies);
        batch.patchOrder.circularDependencies = circularDeps;
        batch.patchOrder.missingDependencies = missingDeps;
        if (circularDeps.length === 0 && missingDeps.length === 0) {
            batch.patchOrder.verificationStatus = types_1.VerificationStatus.PASSED;
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.PATCH_ORDER_VERIFIED);
        }
        else {
            batch.patchOrder.verificationStatus = types_1.VerificationStatus.FAILED;
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.ERROR);
            DataStore_1.dataStore.addError(batchId, {
                errorType: 'PATCH_ORDER_INVALID',
                errorMessage: `补丁顺序校验失败: 循环依赖 ${circularDeps.length} 个, 缺失依赖 ${missingDeps.length} 个`,
                originalInput: { order: batch.patchOrder.order, dependencies: batch.patchOrder.dependencies },
                processingEvidence: { circularDeps, missingDeps },
                resolved: false
            });
        }
        return batch.patchOrder;
    }
    generateReport(batchId, generatedBy) {
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const allChecksPassed = batch.manifest?.verificationStatus === types_1.VerificationStatus.PASSED &&
            batch.signatures.every(s => s.verificationStatus === types_1.VerificationStatus.PASSED ||
                s.verificationStatus === types_1.VerificationStatus.MANUALLY_FIXED) &&
            batch.patchOrder?.verificationStatus === types_1.VerificationStatus.PASSED;
        const report = {
            generatedBy,
            overallStatus: allChecksPassed ? types_1.VerificationStatus.PASSED : types_1.VerificationStatus.FAILED,
            packageCount: batch.packages.length,
            manifestCheck: batch.manifest?.verificationStatus || types_1.VerificationStatus.PENDING,
            signatureCheck: batch.signatures.length > 0
                ? (batch.signatures.every(s => s.verificationStatus === types_1.VerificationStatus.PASSED)
                    ? types_1.VerificationStatus.PASSED
                    : types_1.VerificationStatus.FAILED)
                : types_1.VerificationStatus.PENDING,
            patchOrderCheck: batch.patchOrder?.verificationStatus || types_1.VerificationStatus.PENDING,
            details: {
                packages: batch.packages.map(p => ({
                    name: p.name,
                    version: p.version,
                    md5: p.md5,
                    signatureStatus: batch.signatures.find(s => s.packageId === p.id)?.verificationStatus || types_1.VerificationStatus.PENDING
                })),
                manifest: {
                    expected: batch.manifest?.expectedPackages.length || 0,
                    found: batch.packages.length,
                    missing: batch.manifest?.missingPackages || [],
                    extra: batch.manifest?.extraPackages || []
                },
                patchOrder: {
                    order: batch.patchOrder?.order || [],
                    issues: [
                        ...(batch.patchOrder?.circularDependencies || []),
                        ...(batch.patchOrder?.missingDependencies || [])
                    ]
                }
            }
        };
        if (allChecksPassed) {
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.COMPLETED);
        }
        return DataStore_1.dataStore.addReport(batchId, report);
    }
    exportReport(batchId, reportId) {
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const report = batch.reports.find(r => r.id === reportId);
        if (!report) {
            throw new Error(`报告 ${reportId} 不存在`);
        }
        const exportContent = `
================================================================================
                          离线包完整性核对报告
================================================================================

批次信息:
  批次号: ${batch.batchNo}
  批次名称: ${batch.name}
  客户: ${batch.customer}
  版本: ${batch.version}
  生成时间: ${report.generatedAt.toISOString()}
  生成人: ${report.generatedBy}
  整体状态: ${report.overallStatus}

--------------------------------------------------------------------------------
1. 安装包清单 (共 ${report.packageCount} 个)
--------------------------------------------------------------------------------
${report.details.packages.map((p, i) => `
  ${i + 1}. ${p.name} (${p.version})
      MD5: ${p.md5}
      签名状态: ${p.signatureStatus}
`).join('')}

--------------------------------------------------------------------------------
2. 清单校验
--------------------------------------------------------------------------------
  状态: ${report.manifestCheck}
  期望包数: ${report.details.manifest.expected}
  实际包数: ${report.details.manifest.found}
  缺少的包: ${report.details.manifest.missing.length > 0 ? report.details.manifest.missing.join(', ') : '无'}
  多出的包: ${report.details.manifest.extra.length > 0 ? report.details.manifest.extra.join(', ') : '无'}

--------------------------------------------------------------------------------
3. 签名校验
--------------------------------------------------------------------------------
  状态: ${report.signatureCheck}

--------------------------------------------------------------------------------
4. 补丁顺序校验
--------------------------------------------------------------------------------
  状态: ${report.patchOrderCheck}
  安装顺序: ${report.details.patchOrder.order.join(' -> ')}
  问题: ${report.details.patchOrder.issues.length > 0 ? report.details.patchOrder.issues.join('; ') : '无'}

--------------------------------------------------------------------------------
异常记录 (共 ${batch.errors.length} 条)
--------------------------------------------------------------------------------
${batch.errors.map((e, i) => `
  ${i + 1}. [${e.errorType}] ${e.errorMessage}
      时间: ${e.occurredAt.toISOString()}
      状态: ${e.resolved ? '已解决' : '未解决'}
      ${e.resolutionNote ? `解决说明: ${e.resolutionNote}` : ''}
`).join('')}

================================================================================
                              报告结束
================================================================================
    `.trim();
        report.exportedContent = exportContent;
        return exportContent;
    }
}
exports.VerificationService = VerificationService;
exports.verificationService = new VerificationService();
