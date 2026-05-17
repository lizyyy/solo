const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class RegressionEngine {
  constructor(options) {
    this.options = options;
    this.rules = [];
    this.samples = [];
    this.expectedLabels = {};
    this.results = {
      summary: {},
      matches: [],
      differences: [],
      falsePositives: [],
      falseNegatives: [],
      errors: [],
      statistics: {}
    };
  }

  async run() {
    console.log(chalk.blue('📋 加载规则文件...'));
    await this.loadRules();
    
    console.log(chalk.blue('📂 加载样本文件...'));
    await this.loadSamples();
    
    if (this.options.expected) {
      console.log(chalk.blue('🏷️  加载预期标签...'));
      await this.loadExpectedLabels();
    }
    
    console.log(chalk.blue('🔍 执行正则匹配...'));
    await this.executeRegex();
    
    if (this.options.expected) {
      console.log(chalk.blue('⚖️  对比预期结果...'));
      this.compareResults();
    }
    
    this.calculateStatistics();
    
    return this.results;
  }

  async loadRules() {
    const content = await fs.readFile(this.options.rules, 'utf-8');
    const ruleData = JSON.parse(content);
    
    this.rules = Array.isArray(ruleData) ? ruleData : (ruleData.rules || []);
    
    this.rules = this.rules.map((rule, index) => {
      if (typeof rule === 'string') {
        return {
          id: `rule_${index}`,
          pattern: rule,
          name: `Rule ${index}`,
          flags: 'g'
        };
      }
      return {
        id: rule.id || `rule_${index}`,
        pattern: rule.pattern || rule.regex,
        name: rule.name || rule.description || `Rule ${index}`,
        flags: rule.flags || rule.options || 'g',
        category: rule.category || 'default'
      };
    });
    
    console.log(chalk.gray(`  已加载 ${this.rules.length} 条规则`));
  }

  async loadSamples() {
    const sampleDir = this.options.samples;
    const files = await fs.readdir(sampleDir);
    const sampleFiles = files.filter(f => 
      f.endsWith('.txt') || f.endsWith('.json') || f.endsWith('.csv') || f.endsWith('.log')
    );
    
    for (const file of sampleFiles) {
      const filePath = path.join(sampleDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      const lines = content.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line.trim()) {
          this.samples.push({
            id: `${file}:${lineIndex + 1}`,
            file: file,
            line: lineIndex + 1,
            content: line,
            raw: line
          });
        }
      });
    }
    
    console.log(chalk.gray(`  已加载 ${this.samples.length} 个样本`));
  }

  async loadExpectedLabels() {
    const content = await fs.readFile(this.options.expected, 'utf-8');
    this.expectedLabels = JSON.parse(content);
    console.log(chalk.gray(`  已加载 ${Object.keys(this.expectedLabels).length} 个预期标签`));
  }

  async executeRegex() {
    for (const sample of this.samples) {
      try {
        const sampleMatches = [];
        
        for (const rule of this.rules) {
          try {
            const regex = new RegExp(rule.pattern, rule.flags);
            const matches = [...sample.content.matchAll(regex)];
            
            if (matches.length > 0) {
              sampleMatches.push({
                ruleId: rule.id,
                ruleName: rule.name,
                category: rule.category,
                matches: matches.map(m => ({
                  text: m[0],
                  index: m.index,
                  groups: m.groups
                }))
              });
            }
          } catch (regexError) {
            this.results.errors.push({
              type: 'regex_error',
              ruleId: rule.id,
              ruleName: rule.name,
              sampleId: sample.id,
              error: regexError.message
            });
          }
        }
        
        if (sampleMatches.length > 0) {
          this.results.matches.push({
            sample: sample,
            matchedRules: sampleMatches
          });
        }
      } catch (error) {
        this.results.errors.push({
          type: 'sample_error',
          sampleId: sample.id,
          content: sample.content.substring(0, 100),
          error: error.message
        });
      }
    }
    
    console.log(chalk.gray(`  完成匹配: ${this.results.matches.length} 个样本命中规则`));
  }

  compareResults() {
    const matchedSampleIds = new Set(this.results.matches.map(m => m.sample.id));
    
    for (const sampleId in this.expectedLabels) {
      const expected = this.expectedLabels[sampleId];
      const actualMatch = this.results.matches.find(m => m.sample.id === sampleId);
      
      if (expected.shouldMatch && !actualMatch) {
        this.results.falseNegatives.push({
          sampleId,
          expectedRules: expected.rules || ['any'],
          reason: '预期命中但未命中任何规则',
          sampleContent: this.samples.find(s => s.id === sampleId)?.content || sampleId
        });
      } else if (!expected.shouldMatch && actualMatch) {
        this.results.falsePositives.push({
          sampleId,
          matchedRules: actualMatch.matchedRules.map(r => r.ruleName),
          reason: '预期不命中但实际命中了规则',
          sampleContent: actualMatch.sample.content
        });
      } else if (expected.shouldMatch && actualMatch) {
        const expectedRuleIds = expected.rules || [];
        const actualRuleIds = actualMatch.matchedRules.map(r => r.ruleId);
        
        const missingRules = expectedRuleIds.filter(r => !actualRuleIds.includes(r));
        const extraRules = actualRuleIds.filter(r => !expectedRuleIds.includes(r) && expectedRuleIds.length > 0);
        
        if (missingRules.length > 0 || extraRules.length > 0) {
          this.results.differences.push({
            sampleId,
            type: 'rule_mismatch',
            expectedRules: expectedRuleIds,
            actualRules: actualRuleIds,
            missingRules,
            extraRules,
            sampleContent: actualMatch.sample.content
          });
        }
      }
    }
    
    for (const match of this.results.matches) {
      if (!this.expectedLabels.hasOwnProperty(match.sample.id)) {
        this.results.differences.push({
          sampleId: match.sample.id,
          type: 'unexpected_match',
          matchedRules: match.matchedRules.map(r => r.ruleName),
          reason: '样本未在预期标签中定义',
          sampleContent: match.sample.content
        });
      }
    }
    
    console.log(chalk.gray(`  误报: ${this.results.falsePositives.length}, 漏报: ${this.results.falseNegatives.length}, 差异: ${this.results.differences.length}`));
  }

  calculateStatistics() {
    const stats = this.results.statistics;
    
    stats.totalSamples = this.samples.length;
    stats.totalRules = this.rules.length;
    stats.matchedSamples = this.results.matches.length;
    stats.matchRate = ((stats.matchedSamples / stats.totalSamples) * 100).toFixed(2) + '%';
    
    stats.falsePositives = this.results.falsePositives.length;
    stats.falseNegatives = this.results.falseNegatives.length;
    stats.differences = this.results.differences.length;
    stats.errors = this.results.errors.length;
    
    if (Object.keys(this.expectedLabels).length > 0) {
      const totalTested = Object.keys(this.expectedLabels).length;
      const correct = totalTested - stats.falsePositives - stats.falseNegatives - stats.differences;
      stats.accuracy = totalTested > 0 ? ((correct / totalTested) * 100).toFixed(2) + '%' : 'N/A';
    }
    
    stats.ruleHitCount = {};
    for (const match of this.results.matches) {
      for (const ruleMatch of match.matchedRules) {
        stats.ruleHitCount[ruleMatch.ruleId] = (stats.ruleHitCount[ruleMatch.ruleId] || 0) + 1;
      }
    }
    
    this.results.summary = {
      pass: stats.falsePositives === 0 && stats.falseNegatives === 0 && stats.errors === 0,
      timestamp: new Date().toISOString(),
      rulesFile: this.options.rules,
      samplesDir: this.options.samples
    };
  }
}

module.exports = RegressionEngine;
