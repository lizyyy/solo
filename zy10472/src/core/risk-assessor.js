class RiskAssessor {
  constructor(defaultValue = false) {
    this.defaultValue = defaultValue;
  }

  assess(flags, references) {
    const results = [];
    const riskSummary = {
      safe: 0,
      caution: 0,
      high: 0,
      unknown: 0
    };

    const flagReferences = {};
    for (const ref of references) {
      if (!flagReferences[ref.flagName]) {
        flagReferences[ref.flagName] = [];
      }
      flagReferences[ref.flagName].push(ref);
    }

    for (const flag of flags) {
      const refs = flagReferences[flag.name] || [];
      const assessment = this.assessSingleFlag(flag, refs);
      results.push(assessment);
      riskSummary[assessment.riskLevel]++;
    }

    return { results, riskSummary };
  }

  assessSingleFlag(flag, references) {
    const riskFactors = [];
    let riskScore = 0;

    const referenceCount = references.length;
    const fileCount = new Set(references.map(r => r.file)).size;

    if (referenceCount === 0) {
      return {
        ...flag,
        references: [],
        referenceCount: 0,
        fileCount: 0,
        riskLevel: 'safe',
        riskScore: 0,
        riskFactors: ['代码中无引用，可以安全删除'],
        recommendation: '可以直接删除，代码中无引用'
      };
    }

    const flagDefaultValue = this.parseDefaultValue(flag.defaultValue);

    if (flagDefaultValue !== null && flagDefaultValue !== this.defaultValue) {
      riskScore += 30;
      riskFactors.push(`开关默认值 (${flagDefaultValue}) 与全局默认值 (${this.defaultValue}) 不一致`);
    }

    if (flag.status) {
      const status = flag.status.toLowerCase();
      if (status === 'deprecated' || status === 'off' || status === 'disabled') {
        riskScore -= 20;
        riskFactors.push('开关已标记为下线状态');
      } else if (status === 'active' || status === 'on' || status === 'enabled') {
        riskScore += 10;
        riskFactors.push('开关仍标记为活跃状态');
      }
    }

    if (referenceCount > 10) {
      riskScore += 20;
      riskFactors.push(`引用次数较多 (${referenceCount} 处)`);
    } else if (referenceCount > 5) {
      riskScore += 10;
      riskFactors.push(`引用次数中等 (${referenceCount} 处)`);
    }

    if (fileCount > 5) {
      riskScore += 15;
      riskFactors.push(`涉及文件较多 (${fileCount} 个)`);
    }

    const hasConditionalLogic = this.detectConditionalLogic(references);
    if (hasConditionalLogic) {
      riskScore += 25;
      riskFactors.push('包含条件分支逻辑，删除可能影响代码流');
    }

    const hasNegation = this.detectNegation(references);
    if (hasNegation) {
      riskScore += 15;
      riskFactors.push('包含否定判断 (!flag) 形式，需要特别注意');
    }

    const finalRiskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel, recommendation;
    if (finalRiskScore < 25) {
      riskLevel = 'safe';
      recommendation = '可以安全删除，风险较低';
    } else if (finalRiskScore < 50) {
      riskLevel = 'caution';
      recommendation = '建议谨慎处理，建议人工复核后删除';
    } else if (finalRiskScore < 75) {
      riskLevel = 'high';
      recommendation = '高风险，需要详细评估，建议保留或进行灰度测试';
    } else {
      riskLevel = 'high';
      recommendation = '极高风险，必须详细审查后再决定是否删除';
    }

    return {
      ...flag,
      references,
      referenceCount,
      fileCount,
      riskLevel,
      riskScore: finalRiskScore,
      riskFactors,
      recommendation
    };
  }

  parseDefaultValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'on') return true;
      if (lower === 'false' || lower === '0' || lower === 'off') return false;
    }
    return null;
  }

  detectConditionalLogic(references) {
    return references.some(ref => {
      const context = ref.context.toLowerCase();
      return context.includes('if') || context.includes('else') || context.includes('?');
    });
  }

  detectNegation(references) {
    return references.some(ref => {
      const context = ref.context;
      return context.includes('!' + ref.flagName) || context.includes('! ' + ref.flagName);
    });
  }
}

module.exports = { RiskAssessor };
