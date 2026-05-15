const fs = require('fs');
const path = require('path');

class ParamValidator {
  constructor() {
    this.validationErrors = [];
    this.missingCombinations = [];
    this.blockedReasons = [];
  }

  validate(options) {
    this.validationErrors = [];
    this.missingCombinations = [];
    this.blockedReasons = [];

    this.checkRequiredParams(options);
    this.checkParamCombinations(options);
    this.checkDangerousParams(options);
    this.checkInputFiles(options);

    return {
      isValid: this.validationErrors.length === 0 && this.missingCombinations.length === 0,
      errors: this.validationErrors,
      missingCombinations: this.missingCombinations,
      blockedReasons: this.blockedReasons
    };
  }

  checkRequiredParams(options) {
    const required = ['cacheDirs'];
    
    for (const param of required) {
      if (!options[param] || options[param].length === 0) {
        this.validationErrors.push({
          param,
          reason: '必填参数缺失',
          suggestion: `请提供 --${param} 参数`
        });
      }
    }
  }

  checkParamCombinations(options) {
    const combinations = [
      {
        name: '安全执行组合',
        required: ['dryRun'],
        when: () => !options.force,
        explanation: '未使用 --force 时，建议始终使用 --dry-run 预览操作'
      },
      {
        name: '生产环境保护',
        required: ['output'],
        when: () => !options.dryRun,
        explanation: '真实执行清理前必须指定 --output 保存报告'
      },
      {
        name: '回滚前置条件',
        required: ['backup'],
        when: () => options.rollback,
        explanation: '使用 --rollback 必须先指定 --backup 目录'
      }
    ];

    for (const combo of combinations) {
      if (combo.when()) {
        const missing = combo.required.filter(p => !options[p]);
        if (missing.length > 0) {
          this.missingCombinations.push({
            combination: combo.name,
            missingParams: missing,
            explanation: combo.explanation,
            blocked: true
          });
          this.blockedReasons.push({
            type: 'combination_missing',
            combination: combo.name,
            detail: `缺少参数: ${missing.join(', ')}`,
            impact: '操作被拦截，防止误操作'
          });
        }
      }
    }
  }

  checkDangerousParams(options) {
    if (options.force && !options.dryRun) {
      this.blockedReasons.push({
        type: 'dangerous_combination',
        detail: '--force 与 --no-dry-run 同时使用',
        impact: '高危操作，建议先执行 --dry-run 确认',
        requiresConfirmation: true
      });
    }

    if (options.cacheDirs && options.cacheDirs.some(d => 
      d === '/' || d === '/root' || d === '/home' || d.includes('system32')
    )) {
      this.blockedReasons.push({
        type: 'dangerous_path',
        detail: '包含系统关键目录',
        impact: '操作被拦截，防止系统文件被误删',
        blocked: true
      });
    }
  }

  checkInputFiles(options) {
    if (options.input) {
      if (!fs.existsSync(options.input)) {
        this.validationErrors.push({
          param: 'input',
          reason: '输入文件不存在',
          suggestion: `请检查路径: ${options.input}`
        });
      } else {
        const content = fs.readFileSync(options.input, 'utf-8');
        if (content.length < 10) {
          this.blockedReasons.push({
            type: 'suspicious_input',
            detail: '输入文件内容过短',
            impact: '可能是无效输入，请确认'
          });
        }
      }
    }
  }

  explainBlockedReasons() {
    if (this.blockedReasons.length === 0) {
      return '无拦截原因，参数验证通过';
    }

    return this.blockedReasons.map((reason, idx) => {
      let explanation = `\n[拦截原因 ${idx + 1}] ${reason.type.toUpperCase()}\n`;
      explanation += `  详情: ${reason.detail}\n`;
      explanation += `  影响: ${reason.impact}\n`;
      if (reason.requiresConfirmation) {
        explanation += `  注意: 此操作需要额外确认才能执行\n`;
      }
      return explanation;
    }).join('');
  }

  generateValidationReport(options) {
    const result = this.validate(options);
    
    return {
      timestamp: new Date().toISOString(),
      inputOptions: this.sanitizeOptions(options),
      validationResult: result,
      blockedExplanation: this.explainBlockedReasons(),
      recommendations: this.generateRecommendations(result)
    };
  }

  sanitizeOptions(options) {
    const sanitized = {};
    for (const [key, value] of Object.entries(options)) {
      if (key === 'password' || key === 'secret') {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  generateRecommendations(result) {
    const recommendations = [];

    if (result.missingCombinations.length > 0) {
      recommendations.push({
        priority: 'high',
        action: '补充缺失的参数组合',
        detail: result.missingCombinations.map(c => 
          `${c.combination}: 需要 ${c.missingParams.join(', ')}`
        ).join('; ')
      });
    }

    if (result.errors.length > 0) {
      recommendations.push({
        priority: 'high',
        action: '修复验证错误',
        detail: result.errors.map(e => `${e.param}: ${e.reason}`).join('; ')
      });
    }

    recommendations.push({
      priority: 'medium',
      action: '先执行 dry-run',
      detail: '始终建议使用 --dry-run 预览操作效果'
    });

    return recommendations;
  }
}

module.exports = ParamValidator;
