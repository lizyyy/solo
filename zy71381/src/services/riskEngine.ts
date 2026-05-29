import dayjs from 'dayjs';
import type {
  Dependency,
  RiskAssessment,
  RiskLevel,
  Waiver,
  LicenseDefinition,
} from '../types';
import { DIRTY_TYPE_LABELS } from '../types';
import { db } from '../db';
import { licenseMatcher } from './licenseMatcher';

export class RiskEngine {
  async assess(dep: Dependency): Promise<RiskAssessment> {
    const reasons: string[] = [];
    const suggestions: string[] = [];

    const licenseStr = Array.isArray(dep.license) ? dep.license.join(' OR ') : dep.license;
    const licenseMatch = licenseMatcher.match(licenseStr);
    const license = licenseMatch.license;

    if (license && license.spdxId !== 'UNKNOWN') {
      const riskFromLicense = this.assessLicenseRisk(license);
      if (riskFromLicense) {
        reasons.push(riskFromLicense);
        suggestions.push(
          license.riskLevel === 'critical'
            ? '考虑更换为许可证风险较低的替代组件，或申请豁免'
            : '需法务复核许可证使用场景是否合规'
        );
      }
    } else {
      reasons.push('许可证信息缺失或无法识别，无法判定合规性');
      suggestions.push('请人工确认许可证信息后补全');
    }

    const transitiveRisks = await this.checkTransitiveDependencies(dep);
    reasons.push(...transitiveRisks);
    if (transitiveRisks.length > 0) {
      suggestions.push('建议审查传递依赖的许可证合规性');
    }

    if (dep.waiverId) {
      const waiver = await db.waivers.get(dep.waiverId);
      if (waiver) {
        const waiverRisk = this.checkWaiverStatus(waiver);
        if (waiverRisk) {
          reasons.push(waiverRisk);
          suggestions.push('请及时处理豁免续期或重新申请');
        }
      }
    }

    if (dep.dirtyData && !dep.dirtyData.fixed) {
      const dirtyTypeLabel =
        DIRTY_TYPE_LABELS?.[dep.dirtyData.dirtyType] || dep.dirtyData.dirtyType;
      reasons.push(`数据质量问题: ${dirtyTypeLabel} - ${dep.dirtyData.description}`);
      suggestions.push('请修复脏数据后重新进行风险评估');
    }

    const level = this.determineLevel(reasons, license?.riskLevel || 'unknown');

    if (level === 'critical' && dep.status !== 'blocked' && dep.status !== 'waiver_approved') {
      suggestions.push('该依赖已触发拦截条件，请处理后再继续发版流程');
    }

    return { level, reasons, suggestions };
  }

  private assessLicenseRisk(license: LicenseDefinition): string | null {
    if (license.riskLevel === 'critical') {
      if (license.copyleftStrength === 'strong') {
        return `使用强传染许可证 ${license.fullName}，衍生作品需以相同许可证开源，可能导致源代码泄露`;
      }
      if (license.copyleftStrength === 'network') {
        return `使用网络服务传染许可证 ${license.fullName}，通过网络提供服务时需公开源代码`;
      }
      return `使用高风险许可证 ${license.fullName}，请法务复核`;
    }

    if (license.riskLevel === 'warning') {
      if (license.isCopyleft) {
        return `使用弱传染许可证 ${license.fullName}，需注意静态链接/修改文件时的开源义务`;
      }
      return `使用中等风险许可证 ${license.fullName}，建议法务复核`;
    }

    return null;
  }

  private async checkTransitiveDependencies(dep: Dependency): Promise<string[]> {
    const reasons: string[] = [];

    if (dep.transitiveDependencies.length > 0) {
      const transitiveDeps = await db.dependencies
        .where('id')
        .anyOf(dep.transitiveDependencies)
        .toArray();

      const highRiskTransitives = transitiveDeps.filter(
        (td) => td.riskLevel === 'critical' || td.riskLevel === 'warning'
      );

      if (highRiskTransitives.length > 0) {
        const names = highRiskTransitives.map((td) => td.packageName).join(', ');
        reasons.push(
          `传递依赖中存在 ${highRiskTransitives.length} 个风险组件: ${names}`
        );
      }

      const missingLicenseTransitives = transitiveDeps.filter(
        (td) => !td.license || td.riskLevel === 'unknown'
      );

      if (missingLicenseTransitives.length > 0) {
        const names = missingLicenseTransitives.map((td) => td.packageName).join(', ');
        reasons.push(
          `${missingLicenseTransitives.length} 个传递依赖许可证信息待确认: ${names}`
        );
      }
    }

    return reasons;
  }

  private checkWaiverStatus(waiver: Waiver): string | null {
    const now = Date.now();

    if (waiver.status === 'expired' || waiver.expiryDate < now) {
      return `豁免已于 ${dayjs(waiver.expiryDate).format('YYYY-MM-DD')} 过期`;
    }

    const thirtyDaysLater = dayjs().add(30, 'day').valueOf();
    if (waiver.expiryDate < thirtyDaysLater) {
      const daysLeft = Math.ceil(
        dayjs(waiver.expiryDate).diff(dayjs(), 'day', true)
      );
      return `豁免将在 ${daysLeft} 天后过期（${dayjs(waiver.expiryDate).format('YYYY-MM-DD')}）`;
    }

    if (waiver.status === 'pending') {
      return '豁免正在审批中，尚未生效';
    }

    if (waiver.status === 'rejected') {
      return '豁免申请已被驳回';
    }

    return null;
  }

  private determineLevel(reasons: string[], licenseRisk: RiskLevel): RiskLevel {
    if (reasons.length === 0) {
      return 'safe';
    }

    const hasCritical = reasons.some((r) =>
      r.includes('强传染') ||
      r.includes('网络服务传染') ||
      r.includes('高风险') ||
      r.includes('过期') ||
      r.includes('已触发拦截')
    );

    if (hasCritical || licenseRisk === 'critical') {
      return 'critical';
    }

    const hasWarning = reasons.some((r) =>
      r.includes('弱传染') ||
      r.includes('中等风险') ||
      r.includes('待确认') ||
      r.includes('传递依赖中存在') ||
      r.includes('数据质量问题') ||
      r.includes('30天后过期') ||
      r.includes('审批中') ||
      r.includes('已被驳回')
    );

    if (hasWarning || licenseRisk === 'warning') {
      return 'warning';
    }

    const hasUnknown = reasons.some((r) =>
      r.includes('无法识别') || r.includes('缺失')
    );

    if (hasUnknown || licenseRisk === 'unknown') {
      return 'unknown';
    }

    return 'safe';
  }

  generateBlockReason(assessment: RiskAssessment): string {
    if (assessment.level !== 'critical') return '';

    const criticalReasons = assessment.reasons.filter(
      (r) =>
        r.includes('强传染') ||
        r.includes('网络服务传染') ||
        r.includes('高风险') ||
        r.includes('过期') ||
        r.includes('已触发拦截')
    );

    return criticalReasons.join('；') || '存在高风险合规问题';
  }
}

export const riskEngine = new RiskEngine();
