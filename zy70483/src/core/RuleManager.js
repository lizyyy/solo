const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

class RuleManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.rulesFile = path.join(this.dataDir, 'rules.json');
    this.batchRulesFile = path.join(this.dataDir, 'batch-rules.json');
    this.ensureDataDir();
    this.rules = this.loadRules();
    this.batchRules = this.loadBatchRules();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadRules() {
    if (fs.existsSync(this.rulesFile)) {
      return JSON.parse(fs.readFileSync(this.rulesFile, 'utf8'));
    }
    return this.getDefaultRules();
  }

  saveRules() {
    fs.writeFileSync(this.rulesFile, JSON.stringify(this.rules, null, 2));
  }

  loadBatchRules() {
    if (fs.existsSync(this.batchRulesFile)) {
      return JSON.parse(fs.readFileSync(this.batchRulesFile, 'utf8'));
    }
    return {};
  }

  saveBatchRules() {
    fs.writeFileSync(this.batchRulesFile, JSON.stringify(this.batchRules, null, 2));
  }

  getDefaultRules() {
    return [
      {
        version: 'v1.0',
        effectiveDate: '2024-01-01',
        description: '初始版本规则',
        criteria: {
          evidenceRequired: true,
          maxRiskPerBatch: 2,
          approvalLevel: {
            low: 'operator',
            medium: 'manager',
            high: 'director'
          }
        },
        rollbackPolicy: {
          requireDualApproval: true,
          evidenceMandatory: true,
          notifySecurityTeam: true
        }
      },
      {
        version: 'v1.1',
        effectiveDate: '2024-03-15',
        description: '增加高风险自动复核机制',
        criteria: {
          evidenceRequired: true,
          maxRiskPerBatch: 1,
          approvalLevel: {
            low: 'operator',
            medium: 'manager',
            high: 'vp'
          }
        },
        rollbackPolicy: {
          requireDualApproval: true,
          evidenceMandatory: true,
          notifySecurityTeam: true,
          autoReviewHighRisk: true
        }
      },
      {
        version: 'v2.0',
        effectiveDate: '2024-06-01',
        description: '支持批量签发，引入风险评分机制',
        criteria: {
          evidenceRequired: true,
          maxRiskPerBatch: 3,
          approvalLevel: {
            low: 'operator',
            medium: 'manager',
            high: 'director',
            critical: 'vp'
          },
          riskScoringEnabled: true
        },
        rollbackPolicy: {
          requireDualApproval: true,
          evidenceMandatory: true,
          notifySecurityTeam: true,
          autoReviewHighRisk: true,
          candidateListRequired: true
        }
      }
    ];
  }

  listRules() {
    return this.rules;
  }

  explainBatchRules(batchId) {
    const certsFile = path.join(this.dataDir, 'certificates.json');
    let ruleVersion = 'v1.0';
    
    if (fs.existsSync(certsFile)) {
      const certificates = JSON.parse(fs.readFileSync(certsFile, 'utf8'));
      const batchCert = certificates.find(c => c.batchId === batchId);
      if (batchCert) {
        ruleVersion = batchCert.ruleVersion;
      }
    }

    const rule = this.rules.find(r => r.version === ruleVersion);
    
    if (!rule) {
      return {
        success: false,
        message: `未找到版本 ${ruleVersion} 的规则`
      };
    }

    return {
      success: true,
      batchId,
      ruleVersion: rule.version,
      effectiveDate: rule.effectiveDate,
      description: rule.description,
      criteria: rule.criteria,
      rollbackPolicy: rule.rollbackPolicy,
      changes: this.getChangesFromPrevious(rule.version)
    };
  }

  getChangesFromPrevious(version) {
    const index = this.rules.findIndex(r => r.version === version);
    if (index <= 0) return '无历史版本，为初始规则';

    const current = this.rules[index];
    const previous = this.rules[index - 1];
    const changes = [];

    if (current.criteria.maxRiskPerBatch !== previous.criteria.maxRiskPerBatch) {
      changes.push(`每批次最大风险数: ${previous.criteria.maxRiskPerBatch} → ${current.criteria.maxRiskPerBatch}`);
    }

    if (current.criteria.approvalLevel.high !== previous.criteria.approvalLevel.high) {
      changes.push(`高风险审批级别: ${previous.criteria.approvalLevel.high} → ${current.criteria.approvalLevel.high}`);
    }

    if (current.rollbackPolicy.autoReviewHighRisk && !previous.rollbackPolicy.autoReviewHighRisk) {
      changes.push('新增: 高风险自动复核机制');
    }

    if (current.criteria.riskScoringEnabled) {
      changes.push('新增: 风险评分机制');
    }

    return changes.length > 0 ? changes : ['无显著变更'];
  }

  printRules(rules) {
    console.log(chalk.green(`✅ 共 ${rules.length} 个规则版本\n`));

    const table = new Table({
      head: ['版本', '生效日期', '说明', '每批最大风险'],
      colWidths: [10, 15, 35, 15]
    });

    rules.forEach(rule => {
      table.push([
        rule.version,
        rule.effectiveDate,
        rule.description,
        rule.criteria.maxRiskPerBatch
      ]);
    });

    console.log(table.toString());
  }

  printExplanation(explanation) {
    if (!explanation.success) {
      console.log(chalk.red('❌ '), explanation.message);
      return;
    }

    console.log(chalk.green(`✅ 批次 ${explanation.batchId} 规则口径解释\n`));
    console.log(chalk.blue('规则版本:'), explanation.ruleVersion);
    console.log(chalk.blue('生效日期:'), explanation.effectiveDate);
    console.log(chalk.blue('版本说明:'), explanation.description);
    console.log('');

    console.log(chalk.yellow('📋 签发标准:'));
    console.log(`  - 需要证据: ${explanation.criteria.evidenceRequired ? '是' : '否'}`);
    console.log(`  - 每批次最大风险数: ${explanation.criteria.maxRiskPerBatch}`);
    console.log(`  - 审批级别:`);
    Object.entries(explanation.criteria.approvalLevel).forEach(([level, approver]) => {
      console.log(`    * ${level}: ${approver}`);
    });
    console.log('');

    console.log(chalk.yellow('🔄 回滚策略:'));
    Object.entries(explanation.rollbackPolicy).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
    console.log('');

    console.log(chalk.yellow('📝 版本变更:'));
    explanation.changes.forEach((change, i) => {
      console.log(`  ${i + 1}. ${change}`);
    });
  }
}

module.exports = RuleManager;
