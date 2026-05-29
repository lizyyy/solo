import scriptRepository from '../repositories/scriptRepository.js';
import exceptionRepository from '../repositories/exceptionRepository.js';
import permissionService from './permissionService.js';
import parseService from './parseService.js';
import type { RiskDetail, RiskScore } from '../types/index.js';

class RiskService {
  calculateScriptScore(scriptId: number): RiskScore {
    const script = scriptRepository.getById(scriptId);
    if (!script) throw new Error('Script not found');

    const dynamicMiss = parseService.detectDynamicMiss(scriptId);
    const wildcards = permissionService.detectWildcardOver(scriptId);
    const exceptions = exceptionRepository.list(scriptId, 'approved');

    const longRunningExceptions = exceptions.filter(e => {
      if (!e.expires_at) return true;
      const created = new Date(e.created_at);
      const expires = new Date(e.expires_at);
      const now = new Date();
      const daysSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      const daysUntilExpires = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 30 && daysUntilExpires > 30;
    });

    const dynamicScore = dynamicMiss.reason ? Math.min(100, 30 + dynamicMiss.context.length * 15) : 0;
    const wildcardScore = Math.min(100, wildcards.length * 35);
    const exceptionLongScore = Math.min(100, longRunningExceptions.length * 40);

    const totalScore = Math.round((dynamicScore + wildcardScore + exceptionLongScore) / 3);

    const details = {
      dynamic_miss: dynamicMiss,
      wildcards,
      long_running_exceptions: longRunningExceptions.map(e => ({
        id: e.id, reason: e.reason, created_at: e.created_at, expires_at: e.expires_at,
      })),
    };

    return scriptRepository.saveRiskScore({
      script_id: scriptId,
      dynamic_miss_score: dynamicScore,
      wildcard_score: wildcardScore,
      exception_long_score: exceptionLongScore,
      total_score: totalScore,
      details_json: JSON.stringify(details),
    });
  }

  getOverview(): { total_score: number; breakdown: { category: string; score: number; count: number }[] } {
    const scripts = scriptRepository.list();
    let totalDynamic = 0;
    let totalWildcard = 0;
    let totalExceptionLong = 0;
    let count = 0;

    const dynamicRisks: RiskDetail[] = [];
    const wildcardRisks: RiskDetail[] = [];
    const exceptionLongRisks: RiskDetail[] = [];

    for (const s of scripts) {
      const dynamicMiss = parseService.detectDynamicMiss(s.id);
      if (dynamicMiss.reason) {
        totalDynamic += Math.min(100, 30 + dynamicMiss.context.length * 15);
        dynamicRisks.push({
          id: `dyn-${s.id}`,
          type: 'dynamic_miss',
          script_id: s.id,
          script_name: s.name,
          reason: dynamicMiss.reason,
          impact: dynamicMiss.impact,
          next_action: dynamicMiss.nextAction,
          score: Math.min(100, 30 + dynamicMiss.context.length * 15),
        });
      }

      const wildcards = permissionService.detectWildcardOver(s.id);
      if (wildcards.length > 0) {
        totalWildcard += Math.min(100, wildcards.length * 35);
        wildcards.forEach((w, i) => {
          wildcardRisks.push({
            id: `wild-${s.id}-${i}`,
            type: 'wildcard_over',
            script_id: s.id,
            script_name: s.name,
            reason: `${w.permission}: ${w.reason}`,
            impact: w.impact,
            next_action: w.nextAction,
            score: 35,
            metadata: { permission: w.permission },
          });
        });
      }

      const exceptions = exceptionRepository.list(s.id, 'approved');
      const longRunning = exceptions.filter(e => !e.expires_at);
      if (longRunning.length > 0) {
        totalExceptionLong += Math.min(100, longRunning.length * 40);
        longRunning.forEach(e => {
          exceptionLongRisks.push({
            id: `exc-${e.id}`,
            type: 'exception_long',
            script_id: s.id,
            script_name: s.name,
            reason: `例外无到期时间: ${e.reason.slice(0, 50)}`,
            impact: '永久例外会导致权限长期过大，违反最小权限原则',
            next_action: '设置例外到期时间，定期复核是否仍有必要',
            score: 40,
            metadata: { exception_id: e.id },
          });
        });
      }

      if (dynamicMiss.reason || wildcards.length > 0 || longRunning.length > 0) {
        count++;
      }
    }

    const avgDynamic = scripts.length > 0 ? Math.round(totalDynamic / scripts.length) : 0;
    const avgWildcard = scripts.length > 0 ? Math.round(totalWildcard / scripts.length) : 0;
    const avgExceptionLong = scripts.length > 0 ? Math.round(totalExceptionLong / scripts.length) : 0;

    return {
      total_score: Math.round((avgDynamic + avgWildcard + avgExceptionLong) / 3),
      breakdown: [
        { category: '动态调用漏识别', score: avgDynamic, count: dynamicRisks.length },
        { category: '通配权限过大', score: avgWildcard, count: wildcardRisks.length },
        { category: '例外长期有效', score: avgExceptionLong, count: exceptionLongRisks.length },
      ],
    };
  }

  getDynamicMissRisks(): RiskDetail[] {
    const scripts = scriptRepository.list();
    const risks: RiskDetail[] = [];

    for (const s of scripts) {
      const dynamicMiss = parseService.detectDynamicMiss(s.id);
      if (dynamicMiss.reason) {
        risks.push({
          id: `dyn-${s.id}`,
          type: 'dynamic_miss',
          script_id: s.id,
          script_name: s.name,
          reason: dynamicMiss.reason,
          impact: dynamicMiss.impact,
          next_action: dynamicMiss.nextAction,
          score: Math.min(100, 30 + dynamicMiss.context.length * 15),
          metadata: { contexts: dynamicMiss.context },
        });
      }
    }

    return risks;
  }

  getWildcardRisks(): RiskDetail[] {
    const scripts = scriptRepository.list();
    const risks: RiskDetail[] = [];

    for (const s of scripts) {
      const wildcards = permissionService.detectWildcardOver(s.id);
      wildcards.forEach((w, i) => {
        risks.push({
          id: `wild-${s.id}-${i}`,
          type: 'wildcard_over',
          script_id: s.id,
          script_name: s.name,
          reason: `${w.permission}: ${w.reason}`,
          impact: w.impact,
          next_action: w.nextAction,
          score: 35,
          metadata: { permission: w.permission },
        });
      });
    }

    return risks;
  }

  getExceptionLongRisks(): RiskDetail[] {
    const longRunning = exceptionRepository.getLongRunningExceptions(30);
    const scripts = scriptRepository.list();
    const scriptMap = new Map(scripts.map(s => [s.id, s.name]));

    return longRunning.map(e => ({
      id: `exc-${e.id}`,
      type: 'exception_long',
      script_id: e.script_id,
      script_name: scriptMap.get(e.script_id) || '未知脚本',
      reason: `例外已生效超过30天: ${e.reason.slice(0, 50)}`,
      impact: e.risk_note || '长期例外可能已不再必要，持续存在权限过大风险',
      next_action: '复核该例外是否仍有必要，调整到期时间或删除',
      score: 40,
      metadata: { exception_id: e.id, created_at: e.created_at, expires_at: e.expires_at },
    }));
  }
}

export default new RiskService();
