"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = void 0;
const rules_1 = require("./rules");
class Executor {
    constructor(store) {
        this.store = store;
        this.rules = new rules_1.RuleEngine();
    }
    importData(data, operator, options = {}) {
        const startTime = new Date();
        const idempotencyKey = options.idempotencyKey ||
            this.rules.generateIdempotencyKey('import', 'batch', startTime.getTime().toString());
        const existingRecord = this.store.getExecutionRecordsByIdempotencyKey(idempotencyKey);
        if (existingRecord) {
            return {
                success: existingRecord.status === 'success',
                imported: { certificates: 0, domains: 0, dependencies: 0, windows: 0 },
                duplicates: { serialNumbers: [], domains: [] },
                errors: ['该导入操作已执行过（幂等检查）'],
                executionRecord: existingRecord
            };
        }
        const errors = [];
        const duplicates = { serialNumbers: [], domains: [] };
        const imported = { certificates: 0, domains: 0, dependencies: 0, windows: 0 };
        const existingSerials = new Set(this.store.getCertificates().map(c => c.serialNumber));
        const existingDomains = new Set(this.store.getDomains().map(d => d.name));
        const beforeState = {
            certCount: this.store.getCertificates().length,
            domainCount: this.store.getDomains().length
        };
        for (const certData of data.certificates) {
            if (existingSerials.has(certData.serialNumber)) {
                if (options.overwrite) {
                    const existing = this.store.getCertificateBySerial(certData.serialNumber);
                    if (existing) {
                        this.store.updateCertificate(existing.id, {
                            ...certData,
                            status: 'pending_import',
                            hasRollbackPackage: false
                        });
                        imported.certificates++;
                        continue;
                    }
                }
                else {
                    duplicates.serialNumbers.push(certData.serialNumber);
                    errors.push(`序列号重复: ${certData.serialNumber} (${certData.name})`);
                    continue;
                }
            }
            const newCert = this.store.addCertificate({
                ...certData,
                status: 'pending_import',
                hasRollbackPackage: false
            });
            imported.certificates++;
            existingSerials.add(certData.serialNumber);
        }
        const allCerts = this.store.getCertificates();
        for (const domainData of data.domains) {
            const cert = allCerts.find(c => c.domains.includes(domainData.name) ||
                domainData.certificateId === c.id);
            if (!cert) {
                errors.push(`域名 ${domainData.name} 未找到对应证书`);
                continue;
            }
            if (existingDomains.has(domainData.name)) {
                duplicates.domains.push(domainData.name);
                continue;
            }
            this.store.addDomain({
                ...domainData,
                certificateId: cert.id
            });
            imported.domains++;
            existingDomains.add(domainData.name);
        }
        for (const depData of data.dependencies) {
            this.store.addDependency(depData);
            imported.dependencies++;
        }
        for (const windowData of data.windows) {
            this.store.addWindow(windowData);
            imported.windows++;
        }
        const endTime = new Date();
        const success = options.overwrite ? true : errors.length === 0;
        const executionRecord = this.store.addExecutionRecord({
            action: 'import',
            targetType: 'system',
            status: success ? 'success' : 'partial',
            startedAt: startTime.toISOString(),
            completedAt: endTime.toISOString(),
            durationMs: endTime.getTime() - startTime.getTime(),
            operator,
            details: {
                before: beforeState,
                after: {
                    certCount: this.store.getCertificates().length,
                    domainCount: this.store.getDomains().length
                },
                changes: [
                    `导入 ${imported.certificates} 个证书`,
                    `导入 ${imported.domains} 个域名`,
                    `导入 ${imported.dependencies} 个依赖关系`,
                    `导入 ${imported.windows} 个维护窗口`
                ],
                errorMessage: errors.length > 0 ? errors.join('; ') : undefined
            },
            idempotencyKey
        });
        return {
            success,
            imported,
            duplicates,
            errors,
            executionRecord
        };
    }
    rotateCertificate(certId, operator, newCertData, options = {}) {
        const startTime = new Date();
        const cert = this.store.getCertificate(certId);
        const errors = [];
        if (!cert) {
            errors.push('证书不存在');
            const record = this.store.addExecutionRecord({
                action: 'rotate',
                targetType: 'certificate',
                targetId: certId,
                status: 'failed',
                startedAt: startTime.toISOString(),
                completedAt: new Date().toISOString(),
                durationMs: 0,
                operator,
                details: {
                    errorMessage: '证书不存在'
                }
            });
            return { success: false, cert: null, errors, executionRecord: record };
        }
        const idempotencyKey = options.idempotencyKey ||
            this.rules.generateIdempotencyKey('rotate', certId, startTime.getTime().toString());
        const existingRecord = this.store.getExecutionRecordsByIdempotencyKey(idempotencyKey);
        if (existingRecord) {
            return {
                success: existingRecord.status === 'success',
                cert: this.store.getCertificate(certId) || null,
                errors: ['该轮换操作已执行过（幂等检查）'],
                executionRecord: existingRecord
            };
        }
        const domains = this.store.getDomainsByCertificate(certId);
        const serviceNames = domains.flatMap(d => d.serviceNames);
        const deps = this.store.getDependenciesByServiceNames(serviceNames, cert.environment);
        const windows = this.store.getWindowsByCertificate(certId);
        const { canRotate, reasons } = this.rules.canRotate(cert, deps, windows);
        if (!canRotate) {
            errors.push(...reasons);
        }
        const beforeCert = { ...cert };
        let updatedCert = cert;
        if (errors.length === 0) {
            this.store.updateCertificate(certId, { status: 'in_rotation' });
            if (newCertData) {
                updatedCert = this.store.updateCertificate(certId, {
                    ...newCertData,
                    status: 'completed'
                }) || cert;
            }
            else {
                updatedCert = this.store.updateCertificate(certId, { status: 'completed' }) || cert;
            }
        }
        const endTime = new Date();
        const success = errors.length === 0;
        const executionRecord = this.store.addExecutionRecord({
            action: 'rotate',
            targetType: 'certificate',
            targetId: certId,
            status: success ? 'success' : 'failed',
            startedAt: startTime.toISOString(),
            completedAt: endTime.toISOString(),
            durationMs: endTime.getTime() - startTime.getTime(),
            operator,
            details: {
                before: beforeCert,
                after: updatedCert,
                changes: success ? ['证书状态更新为 completed'] : undefined,
                errorMessage: errors.length > 0 ? errors.join('; ') : undefined
            },
            idempotencyKey
        });
        return {
            success,
            cert: updatedCert,
            errors,
            executionRecord
        };
    }
    manualEdit(targetType, targetId, updates, operator, reason) {
        const startTime = new Date();
        const errors = [];
        let before;
        let after;
        switch (targetType) {
            case 'certificate': {
                const cert = this.store.getCertificate(targetId);
                if (!cert) {
                    errors.push('证书不存在');
                    break;
                }
                before = { ...cert };
                const updated = this.store.updateCertificate(targetId, updates);
                after = updated ? { ...updated } : undefined;
                break;
            }
            case 'dependency': {
                const dep = this.store.getDependencies().find(d => d.id === targetId);
                if (!dep) {
                    errors.push('依赖不存在');
                    break;
                }
                before = { ...dep };
                const updated = this.store.updateDependency(targetId, updates);
                after = updated ? { ...updated } : undefined;
                break;
            }
            default:
                errors.push('不支持的目标类型');
        }
        const endTime = new Date();
        const success = errors.length === 0;
        const executionRecord = this.store.addExecutionRecord({
            action: 'manual_edit',
            targetType,
            targetId,
            status: success ? 'success' : 'failed',
            startedAt: startTime.toISOString(),
            completedAt: endTime.toISOString(),
            durationMs: endTime.getTime() - startTime.getTime(),
            operator,
            details: {
                before,
                after,
                changes: success ? [`人工修正: ${reason}`] : undefined,
                errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
                metadata: { reason }
            }
        });
        return { success, errors, executionRecord };
    }
    rollbackCertificate(certId, operator) {
        const startTime = new Date();
        const cert = this.store.getCertificate(certId);
        const errors = [];
        if (!cert) {
            errors.push('证书不存在');
        }
        else if (!cert.hasRollbackPackage) {
            errors.push('缺少回滚包，无法回滚');
        }
        else if (cert.status !== 'completed' && cert.status !== 'in_rotation') {
            errors.push(`当前状态 ${cert.status} 不支持回滚`);
        }
        const beforeCert = cert ? { ...cert } : undefined;
        let updatedCert = cert;
        if (errors.length === 0 && cert) {
            updatedCert = this.store.updateCertificate(certId, { status: 'rolled_back' }) || cert;
        }
        const endTime = new Date();
        const success = errors.length === 0;
        const executionRecord = this.store.addExecutionRecord({
            action: 'rollback',
            targetType: 'certificate',
            targetId: certId,
            status: success ? 'success' : 'failed',
            startedAt: startTime.toISOString(),
            completedAt: endTime.toISOString(),
            durationMs: endTime.getTime() - startTime.getTime(),
            operator,
            details: {
                before: beforeCert,
                after: updatedCert,
                changes: success ? ['证书状态更新为 rolled_back'] : undefined,
                errorMessage: errors.length > 0 ? errors.join('; ') : undefined
            }
        });
        return {
            success,
            cert: updatedCert || null,
            errors,
            executionRecord
        };
    }
}
exports.Executor = Executor;
