import { 
  Permission, 
  CapabilityCall, 
  PluginRunResult, 
  PluginManifest, 
  PluginAuditReport, 
  PermissionAudit, 
  AuditFinding,
  EventRecord 
} from './types';

const ALL_PERMISSIONS: Permission[] = [
  'fs:read',
  'fs:write',
  'fs:delete',
  'network:fetch',
  'network:http',
  'env:read',
  'env:write',
  'event:subscribe',
  'event:publish',
  'process:spawn',
  'process:exec',
];

export class PermissionAuditor {
  private declaredPermissions: Permission[];
  private capabilityCalls: CapabilityCall[];
  private events: EventRecord[];
  private runResult: PluginRunResult;
  private manifest: PluginManifest;

  constructor(
    runResult: PluginRunResult,
    manifest: PluginManifest
  ) {
    this.runResult = runResult;
    this.manifest = manifest;
    this.declaredPermissions = manifest.permissions || [];
    this.capabilityCalls = runResult.capabilityCalls || [];
    this.events = runResult.events || [];
  }

  audit(): PluginAuditReport {
    const permissionAudits = this.generatePermissionAudits();
    const findings = this.generateFindings(permissionAudits);
    const statistics = this.generateStatistics(permissionAudits);

    return {
      runId: this.runResult.runId,
      generatedAt: Date.now(),
      pluginName: this.runResult.pluginName,
      pluginVersion: this.manifest.version,
      manifest: this.manifest,
      
      runSummary: {
        success: this.runResult.success,
        crashed: this.runResult.crashed,
        timeout: this.runResult.timeout,
        startTime: this.runResult.startTime,
        endTime: this.runResult.endTime,
        duration: this.runResult.duration,
        errorMessage: this.runResult.errorMessage,
      },
      
      permissionAudits,
      statistics,
      findings,
      
      capabilityCalls: this.capabilityCalls,
      events: this.events,
      consoleOutput: this.runResult.consoleOutput,
    };
  }

  private generatePermissionAudits(): PermissionAudit[] {
    const audits: PermissionAudit[] = [];
    
    const usedPermissions = new Map<Permission, CapabilityCall[]>();
    
    for (const call of this.capabilityCalls) {
      if (!usedPermissions.has(call.capability)) {
        usedPermissions.set(call.capability, []);
      }
      usedPermissions.get(call.capability)!.push(call);
    }

    for (const perm of ALL_PERMISSIONS) {
      const declared = this.declaredPermissions.includes(perm);
      const calls = usedPermissions.get(perm) || [];
      const used = calls.length > 0;
      
      let status: PermissionAudit['status'];
      if (declared && used) {
        status = 'declared_used';
      } else if (declared && !used) {
        status = 'declared_unused';
      } else if (!declared && used) {
        status = 'undeclared_used';
      } else {
        continue;
      }

      audits.push({
        permission: perm,
        declared,
        used,
        callCount: calls.length,
        calls,
        status,
      });
    }

    return audits;
  }

  private generateFindings(permissionAudits: PermissionAudit[]): AuditFinding[] {
    const findings: AuditFinding[] = [];

    for (const audit of permissionAudits) {
      if (audit.status === 'undeclared_used') {
        findings.push({
          type: 'violation',
          severity: 'critical',
          category: 'permission_violation',
          message: `插件尝试使用未声明的权限: ${audit.permission}`,
          details: {
            permission: audit.permission,
            callCount: audit.callCount,
            calls: audit.calls.map(c => ({
              method: c.method,
              args: c.args,
              timestamp: c.timestamp,
            })),
          },
          capability: audit.permission,
          timestamp: Date.now(),
        });
      }

      if (audit.status === 'declared_unused') {
        findings.push({
          type: 'warning',
          severity: 'low',
          category: 'permission_warning',
          message: `插件声明了权限但未使用: ${audit.permission}`,
          details: {
            permission: audit.permission,
          },
          capability: audit.permission,
          timestamp: Date.now(),
        });
      }
    }

    for (const call of this.capabilityCalls) {
      if (!call.success) {
        findings.push({
          type: 'warning',
          severity: 'medium',
          category: 'capability_failure',
          message: `能力调用失败: ${call.method}`,
          details: {
            method: call.method,
            capability: call.capability,
            error: call.error,
            args: call.args,
          },
          capability: call.capability,
          timestamp: call.timestamp,
        });
      }
    }

    if (this.runResult.timeout) {
      findings.push({
        type: 'violation',
        severity: 'high',
        category: 'runtime_error',
        message: `插件运行超时 (${this.manifest.timeout || 30000}ms)`,
        details: {
          timeout: this.manifest.timeout || 30000,
          actualDuration: this.runResult.duration,
        },
        timestamp: Date.now(),
      });
    }

    if (this.runResult.crashed) {
      findings.push({
        type: 'violation',
        severity: 'critical',
        category: 'runtime_error',
        message: `插件运行崩溃`,
        details: {
          errorMessage: this.runResult.errorMessage,
          errorStack: this.runResult.errorStack,
        },
        timestamp: Date.now(),
      });
    }

    const eventSubscribeCount = this.events.filter(e => e.type === 'subscribe').length;
    const eventPublishCount = this.events.filter(e => e.type === 'publish' || e.type === 'emit').length;

    if (eventSubscribeCount > 0 && !this.declaredPermissions.includes('event:subscribe')) {
      findings.push({
        type: 'violation',
        severity: 'high',
        category: 'permission_violation',
        message: `插件尝试订阅事件但未声明 event:subscribe 权限`,
        details: {
          subscribeCount: eventSubscribeCount,
        },
        capability: 'event:subscribe',
        timestamp: Date.now(),
      });
    }

    if (eventPublishCount > 0 && !this.declaredPermissions.includes('event:publish')) {
      findings.push({
        type: 'violation',
        severity: 'high',
        category: 'permission_violation',
        message: `插件尝试发布事件但未声明 event:publish 权限`,
        details: {
          publishCount: eventPublishCount,
        },
        capability: 'event:publish',
        timestamp: Date.now(),
      });
    }

    if (findings.length === 0) {
      findings.push({
        type: 'info',
        severity: 'low',
        category: 'audit_result',
        message: '插件审计通过，未发现权限违规',
        timestamp: Date.now(),
      });
    }

    return findings.sort((a, b) => {
      const severityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999);
    });
  }

  private generateStatistics(permissionAudits: PermissionAudit[]) {
    let declaredUsed = 0;
    let declaredUnused = 0;
    let undeclaredUsed = 0;
    let totalCapabilityCalls = 0;

    for (const audit of permissionAudits) {
      totalCapabilityCalls += audit.callCount;
      if (audit.status === 'declared_used') declaredUsed++;
      if (audit.status === 'declared_unused') declaredUnused++;
      if (audit.status === 'undeclared_used' && audit.used) undeclaredUsed++;
    }

    const eventsPublished = this.events.filter(e => e.type === 'publish' || e.type === 'emit').length;
    const eventsSubscribed = this.events.filter(e => e.type === 'subscribe').length;

    return {
      totalCapabilityCalls,
      declaredUsed,
      declaredUnused,
      undeclaredUsed,
      eventsPublished,
      eventsSubscribed,
    };
  }

  static hasViolations(report: PluginAuditReport): boolean {
    return report.findings.some(f => f.type === 'violation');
  }

  static getSeverityCount(report: PluginAuditReport, severity: AuditFinding['severity']): number {
    return report.findings.filter(f => f.severity === severity).length;
  }

  static getViolations(report: PluginAuditReport): AuditFinding[] {
    return report.findings.filter(f => f.type === 'violation');
  }

  static getWarnings(report: PluginAuditReport): AuditFinding[] {
    return report.findings.filter(f => f.type === 'warning');
  }
}

export default PermissionAuditor;
