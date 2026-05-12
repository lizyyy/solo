"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reporter = void 0;
const rules_1 = require("./rules");
class Reporter {
    constructor(store) {
        this.IMMEDIATE_DAYS = 7;
        this.THIS_WEEK_DAYS = 30;
        this.store = store;
        this.rules = new rules_1.RuleEngine();
    }
    generateCheckResult(cert) {
        const allCerts = this.store.getCertificates();
        const domains = this.store.getDomainsByCertificate(cert.id);
        const serviceNames = domains.flatMap(d => d.serviceNames);
        const deps = this.store.getDependenciesByServiceNames(serviceNames, cert.environment);
        const windows = this.store.getWindowsByCertificate(cert.id);
        return this.rules.analyzeCertificate(cert, deps, windows, allCerts);
    }
    checkAllCertificates() {
        const certs = this.store.getCertificates();
        return certs.map(cert => this.generateCheckResult(cert));
    }
    checkCertificateById(certId) {
        const cert = this.store.getCertificate(certId);
        if (!cert)
            return null;
        return this.generateCheckResult(cert);
    }
    checkByEnvironment(env) {
        const certs = this.store.getCertificates().filter(c => c.environment === env);
        return certs.map(cert => this.generateCheckResult(cert));
    }
    generateReport() {
        const allResults = this.checkAllCertificates();
        const criticalIssues = [];
        const immediate = allResults.filter(r => r.daysUntilExpiry <= this.IMMEDIATE_DAYS &&
            r.daysUntilExpiry > 0 &&
            r.status !== 'completed');
        const thisWeek = allResults.filter(r => r.daysUntilExpiry > this.IMMEDIATE_DAYS &&
            r.daysUntilExpiry <= this.THIS_WEEK_DAYS &&
            r.status !== 'completed');
        const needsCoordination = allResults.filter(r => {
            const cert = this.store.getCertificate(r.certificateId);
            if (!cert)
                return false;
            const domains = this.store.getDomainsByCertificate(cert.id);
            const serviceNames = domains.flatMap(d => d.serviceNames);
            const deps = this.store.getDependenciesByServiceNames(serviceNames, cert.environment);
            const windows = this.store.getWindowsByCertificate(cert.id);
            return this.rules.needsCoordination(cert, deps, windows);
        });
        const completed = allResults.filter(r => r.status === 'completed');
        for (const r of immediate) {
            if (r.issues.length > 0) {
                criticalIssues.push(`[立即处理] ${r.certificateName}: ${r.issues.join('; ')}`);
            }
        }
        const expired = allResults.filter(r => r.daysUntilExpiry <= 0);
        for (const r of expired) {
            criticalIssues.push(`[已过期] ${r.certificateName}: 已过期 ${Math.abs(r.daysUntilExpiry)} 天`);
        }
        return {
            immediate,
            thisWeek,
            needsCoordination,
            completed,
            totalCount: allResults.length,
            criticalIssues
        };
    }
    formatCheckResult(result, verbose = false) {
        const lines = [];
        lines.push(`📋 ${result.certificateName} (${result.environment})`);
        lines.push(`   证书ID: ${result.certificateId}`);
        lines.push(`   状态: ${this.getStatusEmoji(result.status)} ${result.status}`);
        lines.push(`   过期剩余: ${result.daysUntilExpiry} 天`);
        lines.push(`   域名: ${result.domains.join(', ')}`);
        if (verbose) {
            lines.push(`   维护窗口: ${result.hasMaintenanceWindow ? '✅ 已安排' : '❌ 未安排'}`);
            lines.push(`   回滚包: ${result.hasRollbackPackage ? '✅ 已准备' : '❌ 缺失'}`);
            if (result.dependencies.length > 0) {
                lines.push(`   依赖服务:`);
                for (const dep of result.dependencies) {
                    const critical = dep.isCritical ? '🔴 关键' : '🟡 普通';
                    lines.push(`     - ${dep.serviceName} [${critical}] 状态: ${dep.status}`);
                }
            }
        }
        if (result.issues.length > 0) {
            lines.push(`   ❌ 问题:`);
            for (const issue of result.issues) {
                lines.push(`     - ${issue}`);
            }
        }
        if (result.warnings.length > 0) {
            lines.push(`   ⚠️ 警告:`);
            for (const warning of result.warnings) {
                lines.push(`     - ${warning}`);
            }
        }
        return lines.join('\n');
    }
    formatReport(report) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('📊 证书换发报告');
        lines.push('='.repeat(60));
        lines.push(`总证书数: ${report.totalCount}`);
        lines.push('');
        if (report.criticalIssues.length > 0) {
            lines.push('🚨 紧急问题:');
            for (const issue of report.criticalIssues) {
                lines.push(`  ${issue}`);
            }
            lines.push('');
        }
        lines.push(`🔴 立即处理 (<=7天): ${report.immediate.length} 个`);
        for (const r of report.immediate) {
            lines.push(`  - ${r.certificateName} [${r.environment}] - ${r.daysUntilExpiry}天后过期`);
        }
        lines.push('');
        lines.push(`🟡 本周处理 (8-30天): ${report.thisWeek.length} 个`);
        for (const r of report.thisWeek) {
            lines.push(`  - ${r.certificateName} [${r.environment}] - ${r.daysUntilExpiry}天后过期`);
        }
        lines.push('');
        lines.push(`🔵 需要协调: ${report.needsCoordination.length} 个`);
        for (const r of report.needsCoordination) {
            lines.push(`  - ${r.certificateName} [${r.environment}]`);
            if (r.issues.length > 0) {
                lines.push(`    原因: ${r.issues.join('; ')}`);
            }
        }
        lines.push('');
        lines.push(`✅ 已完成: ${report.completed.length} 个`);
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
    getStatusEmoji(status) {
        const emojiMap = {
            'active': '🟢',
            'expiring_soon': '🟡',
            'expired': '🔴',
            'in_rotation': '🔄',
            'needs_coordination': '🔵',
            'completed': '✅',
            'rolled_back': '↩️',
            'failed': '❌',
            'pending_import': '📥'
        };
        return emojiMap[status] || '❓';
    }
}
exports.Reporter = Reporter;
