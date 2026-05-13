const RuleEngine = require('./ruleEngine');
const RuleVersion = require('../models/RuleVersion');
const SampleSet = require('../models/SampleSet');
const SandboxRun = require('../models/SandboxRun');

class SandboxService {
  async runSandbox(runId, oldVersion, newVersion, sampleSetId) {
    const sandboxRun = await SandboxRun.findOne({ runId });
    if (!sandboxRun) {
      throw new Error(`Sandbox run ${runId} not found`);
    }

    try {
      sandboxRun.status = 'running';
      sandboxRun.startTime = new Date();
      await sandboxRun.save();

      const [oldRuleVersion, newRuleVersion, sampleSet] = await Promise.all([
        RuleVersion.findOne({ version: oldVersion }),
        RuleVersion.findOne({ version: newVersion }),
        SampleSet.findOne({ setId: sampleSetId })
      ]);

      if (!oldRuleVersion) {
        throw new Error(`Old rule version ${oldVersion} not found`);
      }
      if (!newRuleVersion) {
        throw new Error(`New rule version ${newVersion} not found`);
      }
      if (!sampleSet) {
        throw new Error(`Sample set ${sampleSetId} not found`);
      }
      if (sampleSet.samples.length === 0) {
        throw new Error(`Sample set ${sampleSetId} is empty`);
      }

      const oldEngine = new RuleEngine(oldRuleVersion.rules);
      const newEngine = new RuleEngine(newRuleVersion.rules);

      const results = {
        affectedUsers: 0,
        blockedOrders: 0,
        unblockedOrders: 0,
        increasedDiscount: 0,
        decreasedDiscount: 0,
        totalOrderAmountChange: 0,
        falsePositives: 0,
        falseNegatives: 0,
        affectedSegments: {},
        conflicts: 0
      };

      const sampleResults = [];
      const processedUserIds = new Set();

      for (const sample of sampleSet.samples) {
        const oldResult = oldEngine.evaluateSample(sample);
        const newResult = newEngine.evaluateSample(sample);

        const sampleResult = {
          sampleId: sample.sampleId,
          userId: sample.userId,
          userSegment: sample.userSegment,
          oldResult: {
            blocked: oldResult.blocked,
            discountApplied: oldResult.discountApplied,
            membershipBenefits: oldResult.membershipBenefits,
            hitRules: oldResult.hitRules
          },
          newResult: {
            blocked: newResult.blocked,
            discountApplied: newResult.discountApplied,
            membershipBenefits: newResult.membershipBenefits,
            hitRules: newResult.hitRules
          },
          isConflicting: false,
          conflictReason: ''
        };

        const hasConflict = newResult.conflicts.length > 0;
        if (hasConflict) {
          sampleResult.isConflicting = true;
          sampleResult.conflictReason = newResult.conflicts
            .map(c => `Group ${c.groupName}: ${c.rules.map(r => r.ruleName).join(', ')}`)
            .join('; ');
          results.conflicts++;
        }

        const isAffected = this._isResultDifferent(oldResult, newResult);
        if (isAffected) {
          if (!processedUserIds.has(sample.userId)) {
            results.affectedUsers++;
            processedUserIds.add(sample.userId);
          }

          if (!results.affectedSegments[sample.userSegment]) {
            results.affectedSegments[sample.userSegment] = 0;
          }
          results.affectedSegments[sample.userSegment]++;

          if (!oldResult.blocked && newResult.blocked) {
            results.blockedOrders++;
            results.totalOrderAmountChange -= sample.orderAmount;
          }

          if (oldResult.blocked && !newResult.blocked) {
            results.unblockedOrders++;
            results.totalOrderAmountChange += sample.orderAmount;
          }

          if (oldResult.discountApplied > newResult.discountApplied) {
            results.decreasedDiscount += (oldResult.discountApplied - newResult.discountApplied);
            results.totalOrderAmountChange += (oldResult.discountApplied - newResult.discountApplied);
          }

          if (oldResult.discountApplied < newResult.discountApplied) {
            results.increasedDiscount += (newResult.discountApplied - oldResult.discountApplied);
            results.totalOrderAmountChange -= (newResult.discountApplied - oldResult.discountApplied);
          }

          if (oldResult.blocked && !newResult.blocked) {
            results.falseNegatives++;
          }

          if (!oldResult.blocked && newResult.blocked) {
            const isFalsePositive = sample.riskScore < 50;
            if (isFalsePositive) {
              results.falsePositives++;
            }
          }
        }

        sampleResults.push(sampleResult);
      }

      sandboxRun.results = results;
      sandboxRun.sampleResults = sampleResults;
      sandboxRun.businessImpact = this._generateBusinessImpact(results, sampleSet.samples.length);
      sandboxRun.recommendation = this._generateRecommendation(results);
      sandboxRun.status = 'completed';
      sandboxRun.endTime = new Date();
      await sandboxRun.save();

      return sandboxRun;
    } catch (error) {
      sandboxRun.status = 'failed';
      sandboxRun.errorMessage = error.message;
      sandboxRun.endTime = new Date();
      await sandboxRun.save();
      throw error;
    }
  }

  _isResultDifferent(oldResult, newResult) {
    if (oldResult.blocked !== newResult.blocked) return true;
    if (oldResult.discountApplied !== newResult.discountApplied) return true;
    if (JSON.stringify(oldResult.membershipBenefits) !== JSON.stringify(newResult.membershipBenefits)) return true;
    if (newResult.conflicts.length > 0) return true;
    return false;
  }

  _generateBusinessImpact(results, totalSamples) {
    const impactParts = [];

    if (results.blockedOrders > 0) {
      impactParts.push(`会多拦截 ${results.blockedOrders} 笔订单`);
    }
    if (results.unblockedOrders > 0) {
      impactParts.push(`会释放 ${results.unblockedOrders} 笔之前被拦截的订单`);
    }
    if (results.increasedDiscount > 0) {
      impactParts.push(`会多发放 ${results.increasedDiscount.toFixed(2)} 元优惠`);
    }
    if (results.decreasedDiscount > 0) {
      impactParts.push(`会少发 ${results.decreasedDiscount.toFixed(2)} 元优惠`);
    }
    if (results.falsePositives > 0) {
      impactParts.push(`可能误伤 ${results.falsePositives} 个正常用户`);
    }
    if (results.conflicts > 0) {
      impactParts.push(`检测到 ${results.conflicts} 个规则冲突`);
    }

    const segmentParts = [];
    for (const [segment, count] of Object.entries(results.affectedSegments)) {
      segmentParts.push(`${segment} 用户群受影响 ${count} 人`);
    }
    if (segmentParts.length > 0) {
      impactParts.push(`影响范围：${segmentParts.join('，')}`);
    }

    return impactParts.length > 0 ? impactParts.join('；') : '规则调整对样本无影响';
  }

  _generateRecommendation(results) {
    const falsePositiveRate = results.falsePositives / Math.max(results.blockedOrders, 1);
    const conflictRate = results.conflicts / Math.max(results.affectedUsers, 1);

    if (results.falsePositives > 0 && falsePositiveRate > 0.1) {
      return 'not_recommended';
    }
    if (results.conflicts > 0 && conflictRate > 0.05) {
      return 'needs_review';
    }
    if (results.blockedOrders > 0 && falsePositiveRate <= 0.05) {
      return 'recommended';
    }

    return 'needs_review';
  }

  async exportReport(runId, format = 'json') {
    const sandboxRun = await SandboxRun.findOne({ runId });
    if (!sandboxRun) {
      throw new Error(`Sandbox run ${runId} not found`);
    }

    if (sandboxRun.status !== 'completed') {
      throw new Error(`Sandbox run ${runId} is not completed yet`);
    }

    const report = {
      runId: sandboxRun.runId,
      name: sandboxRun.name,
      createdAt: sandboxRun.createdAt,
      oldRuleVersion: sandboxRun.oldRuleVersion,
      newRuleVersion: sandboxRun.newRuleVersion,
      sampleSetId: sandboxRun.sampleSetId,
      results: sandboxRun.results,
      businessImpact: sandboxRun.businessImpact,
      recommendation: sandboxRun.recommendation,
      affectedSamples: sandboxRun.sampleResults
        .filter(sr => this._isResultDifferent(sr.oldResult, sr.newResult))
        .map(sr => ({
          sampleId: sr.sampleId,
          userId: sr.userId,
          userSegment: sr.userSegment,
          isConflicting: sr.isConflicting,
          conflictReason: sr.conflictReason,
          oldBlocked: sr.oldResult.blocked,
          newBlocked: sr.newResult.blocked,
          oldDiscount: sr.oldResult.discountApplied,
          newDiscount: sr.newResult.discountApplied
        }))
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      return this._convertToCSV(report);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  _convertToCSV(report) {
    const headers = [
      'sampleId', 'userId', 'userSegment', 'isConflicting',
      'oldBlocked', 'newBlocked', 'oldDiscount', 'newDiscount'
    ];
    
    const rows = [
      `# Business Sandbox Report`,
      `# Run ID: ${report.runId}`,
      `# Business Impact: ${report.businessImpact}`,
      `# Recommendation: ${report.recommendation}`,
      '',
      headers.join(',')
    ];

    for (const sample of report.affectedSamples) {
      rows.push([
        sample.sampleId,
        sample.userId,
        sample.userSegment,
        sample.isConflicting,
        sample.oldBlocked,
        sample.newBlocked,
        sample.oldDiscount,
        sample.newDiscount
      ].join(','));
    }

    return rows.join('\n');
  }
}

module.exports = new SandboxService();
