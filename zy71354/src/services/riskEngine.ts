import fs from 'fs';
import path from 'path';
import {
  installationDao,
  materialDao,
  signatureDao,
  riskCheckDao,
} from '../database/dao';
import type {
  RiskCheck,
  RiskLevel,
  RiskType,
  Installation,
  LiftingPlan,
  WindLoadParams,
  Material,
} from '../types';

interface CheckResult {
  type: RiskType;
  level: RiskLevel;
  description: string;
  details: Record<string, any>;
}

export class RiskEngine {
  private MIN_LIFTING_POINTS = 2;
  private WIND_LOAD_THRESHOLD = 0.85;

  async runAllChecks(installationId: string): Promise<RiskCheck[]> {
    const installation = await installationDao.getById(installationId);
    if (!installation) {
      throw new Error(`Installation ${installationId} not found`);
    }

    await riskCheckDao.deleteByInstallationId(installationId);

    const results: CheckResult[] = [];

    results.push(await this.checkLiftingPoints(installationId));
    results.push(await this.checkWindLoad(installationId));
    results.push(await this.checkSignatureTiming(installation));

    const savedChecks: RiskCheck[] = [];
    for (const result of results) {
      const check = await riskCheckDao.create({
        installationId,
        ...result,
      });
      savedChecks.push(check);
    }

    const hasCritical = results.some((r) => r.level === 'critical');
    const hasWarning = results.some((r) => r.level === 'warning');

    if (hasCritical) {
      await installationDao.update(installationId, { status: 'risk_detected' });
    } else if (hasWarning && installation.status === 'draft') {
      await installationDao.update(installationId, { status: 'pending' });
    }

    return savedChecks;
  }

  private async checkLiftingPoints(installationId: string): Promise<CheckResult> {
    const material = await materialDao.getByType(installationId, 'lifting_plan');

    if (!material) {
      return {
        type: 'lifting_point_missing',
        level: 'critical',
        description: '吊装计划未上传，无法确认吊点配置',
        details: {
          reason: 'missing_lifting_plan',
          required: '必须提供吊装计划文件',
          suggestion: '请上传包含吊点详细信息的吊装计划',
        },
      };
    }

    try {
      const liftingPlan = this.parseLiftingPlan(material);

      if (!liftingPlan.points || liftingPlan.points.length === 0) {
        return {
          type: 'lifting_point_missing',
          level: 'critical',
          description: '吊装计划中未配置吊点信息',
          details: {
            reason: 'no_lifting_points',
            required: `至少需要 ${this.MIN_LIFTING_POINTS} 个吊点`,
            found: 0,
            suggestion: '请在吊装计划中添加吊点位置和承重信息',
          },
        };
      }

      if (liftingPlan.points.length < this.MIN_LIFTING_POINTS) {
        return {
          type: 'lifting_point_missing',
          level: 'warning',
          description: `吊点数量不足，建议至少 ${this.MIN_LIFTING_POINTS} 个`,
          details: {
            reason: 'insufficient_lifting_points',
            required: this.MIN_LIFTING_POINTS,
            found: liftingPlan.points.length,
            points: liftingPlan.points.map((p) => ({
              location: p.location,
              capacity: p.capacity,
            })),
            suggestion: '建议增加吊点数量以分散承重',
          },
        };
      }

      const insufficientCapacity = liftingPlan.points.filter(
        (p) => p.capacity < 1000
      );
      if (insufficientCapacity.length > 0) {
        return {
          type: 'lifting_point_missing',
          level: 'warning',
          description: '部分吊点承重能力不足',
          details: {
            reason: 'low_capacity_points',
            minCapacityRequired: 1000,
            insufficientPoints: insufficientCapacity.map((p) => ({
              location: p.location,
              capacity: p.capacity,
            })),
            suggestion: '请检查吊点设计承重是否满足雕塑重量要求',
          },
        };
      }

      return {
        type: 'lifting_point_missing',
        level: 'safe',
        description: '吊点配置检查通过',
        details: {
          pointsCount: liftingPlan.points.length,
          points: liftingPlan.points.map((p) => ({
            location: p.location,
            capacity: p.capacity,
          })),
          equipment: liftingPlan.equipment,
        },
      };
    } catch (error) {
      return {
        type: 'lifting_point_missing',
        level: 'warning',
        description: '无法解析吊装计划文件内容',
        details: {
          reason: 'parse_error',
          error: (error as Error).message,
          suggestion: '请确保吊装计划格式正确',
        },
      };
    }
  }

  private async checkWindLoad(installationId: string): Promise<CheckResult> {
    const material = await materialDao.getByType(installationId, 'wind_load_params');

    if (!material) {
      return {
        type: 'wind_load_exceed',
        level: 'critical',
        description: '风载参数未上传，无法评估风载风险',
        details: {
          reason: 'missing_wind_params',
          required: '必须提供风载计算参数',
          suggestion: '请上传风载计算报告或参数表',
        },
      };
    }

    try {
      const windParams = this.parseWindLoadParams(material);
      const ratio = windParams.windSpeed / windParams.maxAllowedWindSpeed;

      if (ratio >= 1.0) {
        return {
          type: 'wind_load_exceed',
          level: 'critical',
          description: `风速 ${windParams.windSpeed}m/s 超过最大允许值 ${windParams.maxAllowedWindSpeed}m/s`,
          details: {
            reason: 'wind_speed_exceeded',
            currentWindSpeed: windParams.windSpeed,
            maxAllowed: windParams.maxAllowedWindSpeed,
            ratio: ratio.toFixed(2),
            windPressure: windParams.windPressure,
            safetyFactor: windParams.safetyFactor,
            suggestion: '禁止在当前风速条件下进行安装作业',
          },
        };
      }

      if (ratio >= this.WIND_LOAD_THRESHOLD) {
        return {
          type: 'wind_load_exceed',
          level: 'warning',
          description: `风速接近阈值（${(ratio * 100).toFixed(1)}%），需谨慎作业`,
          details: {
            reason: 'wind_speed_warning',
            currentWindSpeed: windParams.windSpeed,
            maxAllowed: windParams.maxAllowedWindSpeed,
            threshold: this.WIND_LOAD_THRESHOLD,
            ratio: ratio.toFixed(2),
            windPressure: windParams.windPressure,
            safetyFactor: windParams.safetyFactor,
            suggestion: '建议加强监控，风速持续升高时立即停止作业',
          },
        };
      }

      return {
        type: 'wind_load_exceed',
        level: 'safe',
        description: '风载参数检查通过',
        details: {
          windSpeed: windParams.windSpeed,
          maxAllowed: windParams.maxAllowedWindSpeed,
          ratio: ratio.toFixed(2),
          windPressure: windParams.windPressure,
          safetyFactor: windParams.safetyFactor,
        },
      };
    } catch (error) {
      return {
        type: 'wind_load_exceed',
        level: 'warning',
        description: '无法解析风载参数文件内容',
        details: {
          reason: 'parse_error',
          error: (error as Error).message,
          suggestion: '请确保风载参数格式正确',
        },
      };
    }
  }

  private async checkSignatureTiming(installation: Installation): Promise<CheckResult> {
    const signatures = await signatureDao.getByInstallationId(installation.id);

    if (signatures.length === 0) {
      return {
        type: 'signature_late',
        level: 'warning',
        description: '尚未获取现场签字确认',
        details: {
          reason: 'no_signature',
          required: '需要项目经理和现场负责人签字',
          suggestion: '请完成签字流程后再进行安装',
        },
      };
    }

    if (!installation.actualInstallationDate) {
      return {
        type: 'signature_late',
        level: 'safe',
        description: '签字有效，等待安装实施',
        details: {
          signatures: signatures.map((s) => ({
            signer: s.signerName,
            role: s.signerRole,
            date: s.signatureDate,
          })),
        },
      };
    }

    const installDate = new Date(installation.actualInstallationDate);
    const lateSignatures = signatures.filter((s) => {
      const signatureDate = new Date(s.signatureDate);
      return signatureDate > installDate;
    });

    if (lateSignatures.length > 0) {
      return {
        type: 'signature_late',
        level: 'critical',
        description: `发现 ${lateSignatures.length} 份签字日期晚于安装日期`,
        details: {
          reason: 'signature_after_install',
          installationDate: installation.actualInstallationDate,
          lateSignatures: lateSignatures.map((s) => ({
            signer: s.signerName,
            role: s.signerRole,
            signatureDate: s.signatureDate,
            daysLate: Math.ceil(
              (new Date(s.signatureDate).getTime() - installDate.getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          })),
          suggestion: '签字应在安装前完成，请核实流程合规性',
        },
      };
    }

    return {
      type: 'signature_late',
      level: 'safe',
      description: '所有签字均在安装前完成，流程合规',
      details: {
        installationDate: installation.actualInstallationDate,
        signatures: signatures.map((s) => ({
          signer: s.signerName,
          role: s.signerRole,
          date: s.signatureDate,
        })),
      },
    };
  }

  private parseLiftingPlan(material: Material): LiftingPlan {
    const filePath = path.join(process.cwd(), material.filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const data = JSON.parse(content);
      return data as LiftingPlan;
    } catch {
      return {
        points: [],
        equipment: '未知',
        operator: '未知',
        date: new Date().toISOString().split('T')[0],
      };
    }
  }

  private parseWindLoadParams(material: Material): WindLoadParams {
    const filePath = path.join(process.cwd(), material.filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const data = JSON.parse(content);
      return data as WindLoadParams;
    } catch {
      return {
        windSpeed: 0,
        windPressure: 0,
        safetyFactor: 1.0,
        maxAllowedWindSpeed: 15,
      };
    }
  }

  getOverallRiskLevel(checks: RiskCheck[]): RiskLevel {
    if (checks.some((c) => c.level === 'critical')) return 'critical';
    if (checks.some((c) => c.level === 'warning')) return 'warning';
    return 'safe';
  }

  async getRiskSummary(installationId: string) {
    const checks = await riskCheckDao.getByInstallationId(installationId);
    return {
      overallLevel: this.getOverallRiskLevel(checks),
      checks,
      statistics: {
        total: checks.length,
        safe: checks.filter((c) => c.level === 'safe').length,
        warning: checks.filter((c) => c.level === 'warning').length,
        critical: checks.filter((c) => c.level === 'critical').length,
      },
    };
  }
}

export const riskEngine = new RiskEngine();
