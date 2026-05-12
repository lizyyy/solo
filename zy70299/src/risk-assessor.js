class RiskAssessor {
  constructor() {
    this.rustScores = {
      'none': 0,
      'minor': 1,
      'moderate': 3,
      'severe': 5
    };
    
    this.lightingScores = {
      'working': 0,
      'partial': 2,
      'failed': 4
    };
  }

  assessAll(signs, inspections) {
    const results = [];
    
    signs.forEach(sign => {
      const latestInspection = this._getLatestInspection(sign.id, inspections);
      const result = this._assessSingle(sign, latestInspection, inspections);
      results.push(result);
    });
    
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  _getLatestInspection(signId, inspections) {
    const signInspections = inspections.filter(i => i.signId === signId);
    if (signInspections.length === 0) return null;
    
    return signInspections.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  }

  _assessSingle(sign, latestInspection, allInspections) {
    const rustScore = this._calculateRustScore(sign, latestInspection);
    const lightingScore = this._calculateLightingScore(sign, latestInspection);
    const contractScore = this._calculateContractScore(sign);
    
    const baseScore = rustScore + lightingScore + contractScore;
    
    const factors = this._getRiskFactors(sign, latestInspection, rustScore, lightingScore, contractScore);
    
    const needsReview = this._needsReview(sign, latestInspection, factors);
    const riskLevel = this._determineRiskLevel(baseScore, needsReview);
    
    const rustLevel = latestInspection?.rustLevel || sign.initialRustLevel || 'none';
    const lightingStatus = latestInspection?.lightingStatus || sign.initialLighting || 'working';
    const daysUntilContractEnd = this._getDaysUntilContractEnd(sign.contractEndDate);
    
    return {
      signId: sign.id,
      location: sign.location,
      owner: sign.owner,
      
      rustLevel,
      lightingStatus,
      contractEndDate: sign.contractEndDate,
      daysUntilContractEnd,
      
      rustScore,
      lightingScore,
      contractScore,
      riskScore: baseScore,
      riskLevel,
      
      riskFactors: factors,
      needsReview,
      reviewReasons: this._getReviewReasons(sign, latestInspection, factors, daysUntilContractEnd),
      
      inspectionDate: latestInspection?.date,
      inspector: latestInspection?.inspector,
      
      recommendations: this._generateRecommendations(rustLevel, lightingStatus, daysUntilContractEnd, riskLevel)
    };
  }

  _calculateRustScore(sign, latestInspection) {
    const rustLevel = latestInspection?.rustLevel || sign.initialRustLevel || 'none';
    return this.rustScores[rustLevel] || 0;
  }

  _calculateLightingScore(sign, latestInspection) {
    const lightingStatus = latestInspection?.lightingStatus || sign.initialLighting || 'working';
    return this.lightingScores[lightingStatus] || 0;
  }

  _calculateContractScore(sign) {
    const daysLeft = this._getDaysUntilContractEnd(sign.contractEndDate);
    
    if (daysLeft < 0) return 5;
    if (daysLeft <= 7) return 4;
    if (daysLeft <= 14) return 3;
    if (daysLeft <= 30) return 2;
    if (daysLeft <= 60) return 1;
    return 0;
  }

  _getDaysUntilContractEnd(endDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  _getRiskFactors(sign, latestInspection, rustScore, lightingScore, contractScore) {
    const factors = [];
    
    if (rustScore >= 3) {
      factors.push({
        type: 'rust',
        severity: rustScore >= 5 ? 'critical' : 'high',
        description: rustScore >= 5 ? '结构严重锈蚀，需紧急处理' : '结构中度锈蚀，需要维修'
      });
    } else if (rustScore >= 1) {
      factors.push({
        type: 'rust',
        severity: 'low',
        description: '存在轻微锈蚀，建议关注'
      });
    }
    
    if (lightingScore >= 2) {
      factors.push({
        type: 'lighting',
        severity: lightingScore >= 4 ? 'critical' : 'high',
        description: lightingScore >= 4 ? '照明系统完全故障' : '照明系统部分故障'
      });
    }
    
    if (contractScore >= 2) {
      factors.push({
        type: 'contract',
        severity: contractScore >= 4 ? 'critical' : 'high',
        description: contractScore < 0 ? '合同已过期' : `合同即将到期（${this._getDaysUntilContractEnd(sign.contractEndDate)}天）`
      });
    } else if (contractScore >= 1) {
      factors.push({
        type: 'contract',
        severity: 'medium',
        description: `合同将在${this._getDaysUntilContractEnd(sign.contractEndDate)}天后到期`
      });
    }
    
    return factors;
  }

  _needsReview(sign, latestInspection, factors) {
    if (!latestInspection) {
      return true;
    }
    
    const criticalFactors = factors.filter(f => f.severity === 'critical').length;
    const highFactors = factors.filter(f => f.severity === 'high').length;
    
    if (criticalFactors > 0) return true;
    
    if (highFactors >= 2) return true;
    
    if (this._getDaysUntilContractEnd(sign.contractEndDate) <= 14) return true;
    
    if (latestInspection.rustLevel === 'severe') return true;
    if (latestInspection.lightingStatus === 'failed') return true;
    
    return false;
  }

  _getReviewReasons(sign, latestInspection, factors, daysUntilContractEnd) {
    const reasons = [];
    
    if (!latestInspection) {
      reasons.push('暂无巡检记录，需要确认状态');
    }
    
    const criticalFactors = factors.filter(f => f.severity === 'critical');
    criticalFactors.forEach(f => reasons.push(f.description));
    
    const highFactors = factors.filter(f => f.severity === 'high');
    if (highFactors.length >= 2) {
      reasons.push(`存在多个高风险因素（${highFactors.length}个），需要综合评估`);
    }
    
    if (daysUntilContractEnd <= 14 && daysUntilContractEnd >= 0) {
      reasons.push(`合同将在 ${daysUntilContractEnd} 天后到期，需要及时处理续约`);
    } else if (daysUntilContractEnd < 0) {
      reasons.push(`合同已过期 ${Math.abs(daysUntilContractEnd)} 天，需要立即处理`);
    }
    
    return reasons;
  }

  _determineRiskLevel(score, needsReview) {
    if (score >= 8) return 'high';
    if (score >= 5) return needsReview ? 'high' : 'medium';
    if (score >= 3) return 'medium';
    return 'low';
  }

  _generateRecommendations(rustLevel, lightingStatus, daysUntilContractEnd, riskLevel) {
    const recommendations = [];
    
    if (rustLevel === 'severe') {
      recommendations.push('立即安排结构检测和锈蚀修复，必要时暂停使用');
    } else if (rustLevel === 'moderate') {
      recommendations.push('近期安排锈蚀处理和防腐维护');
    } else if (rustLevel === 'minor') {
      recommendations.push('下次巡检时重点关注锈蚀进展');
    }
    
    if (lightingStatus === 'failed') {
      recommendations.push('立即修复照明系统，确保夜间安全');
    } else if (lightingStatus === 'partial') {
      recommendations.push('检查并修复故障灯具');
    }
    
    if (daysUntilContractEnd < 0) {
      recommendations.push('立即处理合同续约或拆除事宜');
    } else if (daysUntilContractEnd <= 14) {
      recommendations.push('紧急联系业主确认合同续约');
    } else if (daysUntilContractEnd <= 30) {
      recommendations.push('开始合同续约谈判');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('定期巡检，保持当前维护状态');
    }
    
    return recommendations;
  }
}

module.exports = { RiskAssessor };
