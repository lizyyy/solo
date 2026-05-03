import { v4 as uuidv4 } from 'uuid';
import {
  Violation,
  MqttMessage,
  ReplayEvent,
  DeviceShadow,
  DeviceConfig,
  AlertRule,
  Session,
  PendingMessage
} from '../types';
import { VersionRegressionRule } from './version-regression-rule';
import { DuplicateCommandRule, DuplicateCommandOptions } from './duplicate-command-rule';
import { ExpiredShadowRule, ExpiredShadowOptions } from './expired-shadow-rule';
import { MissedAlertRule, MissedAlertOptions } from './missed-alert-rule';

export interface RuleEngineOptions {
  duplicateOptions?: DuplicateCommandOptions;
  expiredOptions?: ExpiredShadowOptions;
  missedAlertOptions?: MissedAlertOptions;
}

export class RuleEngine {
  private versionRegressionRule: VersionRegressionRule;
  private duplicateCommandRule: DuplicateCommandRule;
  private expiredShadowRule: ExpiredShadowRule;
  private missedAlertRule: MissedAlertRule;

  constructor(options?: RuleEngineOptions) {
    this.versionRegressionRule = new VersionRegressionRule();
    this.duplicateCommandRule = new DuplicateCommandRule(options?.duplicateOptions);
    this.expiredShadowRule = new ExpiredShadowRule(options?.expiredOptions);
    this.missedAlertRule = new MissedAlertRule(options?.missedAlertOptions);
  }

  checkAll(
    message: MqttMessage,
    context: {
      currentShadow?: DeviceShadow;
      pendingMessages?: PendingMessage[];
      session?: Session;
      deviceConfig?: DeviceConfig;
      alertRules?: AlertRule[];
      currentTimestamp: number;
      existingRetainedMessage?: MqttMessage;
    }
  ): Violation[] {
    const violations: Violation[] = [];

    const versionViolation = this.versionRegressionRule.check(message, context.currentShadow);
    if (versionViolation) {
      violations.push(versionViolation);
    }

    const duplicateViolation = this.duplicateCommandRule.check(message, context.pendingMessages);
    if (duplicateViolation) {
      violations.push(duplicateViolation);
    }

    if (context.deviceConfig) {
      const expiredViolation = this.expiredShadowRule.check(
        message.clientId,
        context.currentTimestamp,
        context.currentShadow,
        context.deviceConfig
      );
      if (expiredViolation) {
        violations.push(expiredViolation);
      }
    }

    if (context.existingRetainedMessage) {
      const retainViolation = this.expiredShadowRule.checkRetainOverride(
        message,
        context.existingRetainedMessage
      );
      if (retainViolation) {
        violations.push(retainViolation);
      }
    }

    if (context.session && context.alertRules) {
      const missedAlertViolation = this.missedAlertRule.check(
        message,
        context.session,
        context.alertRules
      );
      if (missedAlertViolation) {
        violations.push(missedAlertViolation);
      }
    }

    return violations;
  }

  processEvents(events: ReplayEvent[]): Violation[] {
    const violations: Violation[] = [];

    const versionViolations = this.versionRegressionRule.checkFromEvents(events);
    violations.push(...versionViolations);

    const duplicateViolations = this.duplicateCommandRule.checkFromEvents(events);
    violations.push(...duplicateViolations);

    return violations;
  }

  checkVersionRegression(
    message: MqttMessage,
    currentShadow?: DeviceShadow
  ): Violation | null {
    return this.versionRegressionRule.check(message, currentShadow);
  }

  checkDuplicateCommand(
    message: MqttMessage,
    pendingMessages: PendingMessage[] = []
  ): Violation | null {
    return this.duplicateCommandRule.check(message, pendingMessages);
  }

  checkExpiredShadow(
    deviceId: string,
    currentTimestamp: number,
    shadow?: DeviceShadow,
    config?: DeviceConfig
  ): Violation | null {
    return this.expiredShadowRule.check(deviceId, currentTimestamp, shadow, config);
  }

  checkRetainOverride(
    message: MqttMessage,
    existingRetainedMessage?: MqttMessage
  ): Violation | null {
    return this.expiredShadowRule.checkRetainOverride(message, existingRetainedMessage);
  }

  checkOnReconnect(
    deviceId: string,
    connectTime: number,
    retainedShadow?: DeviceShadow,
    config?: DeviceConfig
  ): Violation | null {
    return this.expiredShadowRule.checkOnConnect(deviceId, connectTime, retainedShadow, config);
  }

  checkMissedAlert(
    message: MqttMessage,
    session: Session,
    rules: AlertRule[] = []
  ): Violation | null {
    return this.missedAlertRule.check(message, session, rules);
  }

  addOfflinePeriod(deviceId: string, start: number, end: number | null): void {
    this.missedAlertRule.addOfflinePeriod(deviceId, start, end);
  }

  getAllViolations(): Violation[] {
    return [
      ...this.versionRegressionRule.getViolations(),
      ...this.duplicateCommandRule.getViolations(),
      ...this.expiredShadowRule.getViolations(),
      ...this.missedAlertRule.getViolations()
    ].sort((a, b) => a.timestamp - b.timestamp);
  }

  getViolationsByType(type: Violation['type']): Violation[] {
    switch (type) {
      case 'version_regression':
        return this.versionRegressionRule.getViolations();
      case 'duplicate_command':
        return this.duplicateCommandRule.getViolations();
      case 'expired_shadow':
      case 'retain_override':
        return this.expiredShadowRule.getViolations();
      case 'missed_alert':
        return this.missedAlertRule.getViolations();
      default:
        return [];
    }
  }

  getViolationsByDevice(deviceId: string): Violation[] {
    return this.getAllViolations().filter(v => v.deviceId === deviceId);
  }

  getSummary(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    criticalCount: number;
    devicesWithViolations: number;
  } {
    const allViolations = this.getAllViolations();
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    const devices = new Set<string>();
    let criticalCount = 0;

    for (const violation of allViolations) {
      byType[violation.type] = (byType[violation.type] || 0) + 1;
      bySeverity[violation.severity]++;
      
      if (violation.deviceId) {
        devices.add(violation.deviceId);
      }

      if (violation.severity === 'critical') {
        criticalCount++;
      }
    }

    return {
      total: allViolations.length,
      byType,
      bySeverity,
      criticalCount,
      devicesWithViolations: devices.size
    };
  }

  reset(): void {
    this.versionRegressionRule.reset();
    this.duplicateCommandRule.reset();
    this.expiredShadowRule.reset();
    this.missedAlertRule.reset();
  }
}
