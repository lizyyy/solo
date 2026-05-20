import { v4 as uuidv4 } from 'uuid';
import { getAll, getOne, runQuery } from '../database';
import { RiskLevel, EventStatus, RuleType, PromoCodeStatus } from '../types';

export interface RiskCheckRequest {
  promoCode: string;
  deviceId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
}

export interface RiskCheckResult {
  allowed: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  triggeredRules: string[];
  reason: string;
  promoCodeId?: string;
}

export class RiskEngine {
  private rules: any[] = [];

  async loadRules() {
    this.rules = await getAll('SELECT * FROM risk_rules WHERE enabled = 1');
    return this.rules;
  }

  async checkRisk(request: RiskCheckRequest): Promise<RiskCheckResult> {
    await this.loadRules();
    
    const promoCode = await getOne(
      'SELECT * FROM promo_codes WHERE code = ? AND status = ?',
      [request.promoCode, PromoCodeStatus.ACTIVE]
    );

    if (!promoCode) {
      return {
        allowed: false,
        riskScore: 0,
        riskLevel: RiskLevel.LOW,
        triggeredRules: [],
        reason: '优惠码不存在或已失效'
      };
    }

    let device = await getOne(
      'SELECT * FROM user_devices WHERE device_id = ?',
      [request.deviceId]
    );

    const now = new Date();
    if (!device) {
      await runQuery(
        `INSERT INTO user_devices (id, device_id, user_id, ip_address, user_agent, risk_score, attempt_count, last_attempt_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
        [uuidv4(), request.deviceId, request.userId || null, request.ipAddress, request.userAgent, now.toISOString(), now.toISOString(), now.toISOString()]
      );
      device = await getOne('SELECT * FROM user_devices WHERE device_id = ?', [request.deviceId]);
    } else {
      await runQuery(
        `UPDATE user_devices SET attempt_count = attempt_count + 1, last_attempt_at = ?, updated_at = ?, ip_address = ?, user_agent = ?, user_id = COALESCE(?, user_id)
         WHERE device_id = ?`,
        [now.toISOString(), now.toISOString(), request.ipAddress, request.userAgent, request.userId || null, request.deviceId]
      );
    }

    let riskScore = 0;
    const triggeredRules: string[] = [];
    const reasons: string[] = [];

    const frequencyRule = this.rules.find(r => r.type === RuleType.FREQUENCY_LIMIT);
    if (frequencyRule) {
      const config = JSON.parse(frequencyRule.config);
      const recentAttempts = await this.getRecentAttempts(request.deviceId, config.timeWindowMinutes);
      if (recentAttempts >= config.maxAttempts) {
        riskScore += config.penaltyPoints;
        triggeredRules.push(frequencyRule.name);
        reasons.push(`${config.timeWindowMinutes}分钟内尝试次数超过${config.maxAttempts}次`);
      }
    }

    const duplicateRule = this.rules.find(r => r.type === RuleType.DUPLICATE_USAGE);
    if (duplicateRule) {
      const config = JSON.parse(duplicateRule.config);
      const usageByDevice = await this.getPromoCodeUsageByDevice(request.promoCode, request.deviceId);
      if (usageByDevice >= config.maxUsagePerDevice) {
        riskScore += config.penaltyPoints;
        triggeredRules.push(duplicateRule.name);
        reasons.push(`该设备已使用此优惠码${usageByDevice}次`);
      }
    }

    const deviceFingerprintRule = this.rules.find(r => r.type === RuleType.DEVICE_FINGERPRINT);
    if (deviceFingerprintRule) {
      const config = JSON.parse(deviceFingerprintRule.config);
      const deviceAttempts = await this.getDeviceTotalAttempts(request.deviceId);
      if (deviceAttempts >= config.suspiciousAttemptThreshold) {
        riskScore += config.penaltyPoints;
        triggeredRules.push(deviceFingerprintRule.name);
        reasons.push(`该设备累计尝试${deviceAttempts}次，行为可疑`);
      }
    }

    const riskScoreRule = this.rules.find(r => r.type === RuleType.RISK_SCORE);
    let allowed = true;
    if (riskScoreRule) {
      const config = JSON.parse(riskScoreRule.config);
      if (riskScore >= config.blockThreshold) {
        allowed = false;
        triggeredRules.push(riskScoreRule.name);
        reasons.push(`风险评分${riskScore}超过拦截阈值${config.blockThreshold}`);
      }
    }

    const riskLevel = this.calculateRiskLevel(riskScore);

    await this.logAttempt({
      promoCodeId: promoCode.id,
      promoCode: request.promoCode,
      deviceId: request.deviceId,
      userId: request.userId,
      ipAddress: request.ipAddress,
      success: allowed,
      errorCode: allowed ? null : 'RISK_BLOCKED',
      errorMessage: allowed ? null : reasons.join('; ')
    });

    return {
      allowed,
      riskScore,
      riskLevel,
      triggeredRules,
      reason: reasons.join('; ') || '正常放行',
      promoCodeId: promoCode.id
    };
  }

  private async getRecentAttempts(deviceId: string, timeWindowMinutes: number): Promise<number> {
    const result = await getOne<any>(
      `SELECT COUNT(*) as count FROM attempt_logs 
       WHERE device_id = ? AND created_at >= datetime('now', ?)`,
      [deviceId, `-${timeWindowMinutes} minutes`]
    );
    return result?.count || 0;
  }

  private async getPromoCodeUsageByDevice(promoCode: string, deviceId: string): Promise<number> {
    const result = await getOne<any>(
      `SELECT COUNT(*) as count FROM allow_records 
       WHERE promo_code = ? AND device_id = ?`,
      [promoCode, deviceId]
    );
    return result?.count || 0;
  }

  private async getDeviceTotalAttempts(deviceId: string): Promise<number> {
    const result = await getOne<any>(
      `SELECT COUNT(*) as count FROM attempt_logs WHERE device_id = ?`,
      [deviceId]
    );
    return result?.count || 0;
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 50) return RiskLevel.HIGH;
    if (score >= 20) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private async logAttempt(logData: {
    promoCodeId: string;
    promoCode: string;
    deviceId: string;
    userId?: string;
    ipAddress: string;
    success: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) {
    await runQuery(
      `INSERT INTO attempt_logs (id, promo_code_id, promo_code, device_id, user_id, ip_address, success, error_code, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        logData.promoCodeId,
        logData.promoCode,
        logData.deviceId,
        logData.userId || null,
        logData.ipAddress,
        logData.success ? 1 : 0,
        logData.errorCode,
        logData.errorMessage,
        new Date().toISOString()
      ]
    );
  }

  async recordBlockEvent(data: {
    promoCodeId: string;
    promoCode: string;
    deviceId: string;
    userId?: string;
    ipAddress: string;
    riskScore: number;
    riskLevel: RiskLevel;
    triggeredRules: string[];
    reason: string;
  }) {
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO block_events (id, promo_code_id, promo_code, device_id, user_id, ip_address, risk_score, risk_level, triggered_rules, status, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        data.promoCodeId,
        data.promoCode,
        data.deviceId,
        data.userId || null,
        data.ipAddress,
        data.riskScore,
        data.riskLevel,
        JSON.stringify(data.triggeredRules),
        EventStatus.BLOCKED,
        data.reason,
        now,
        now
      ]
    );
  }

  async recordAllowRecord(data: {
    promoCodeId: string;
    promoCode: string;
    deviceId: string;
    userId?: string;
    ipAddress: string;
    riskScore: number;
    isManual: boolean;
    approvedBy?: string;
  }) {
    await runQuery(
      `INSERT INTO allow_records (id, promo_code_id, promo_code, device_id, user_id, ip_address, risk_score, is_manual, approved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        data.promoCodeId,
        data.promoCode,
        data.deviceId,
        data.userId || null,
        data.ipAddress,
        data.riskScore,
        data.isManual ? 1 : 0,
        data.approvedBy || null,
        new Date().toISOString()
      ]
    );
  }
}

export default new RiskEngine();
