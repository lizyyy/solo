const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class Reporter {
  constructor(formula, inciDict, packLabel, allergenRules, auditResults, outputDir) {
    this.formula = formula;
    this.inciDict = inciDict;
    this.packLabel = packLabel;
    this.allergenRules = allergenRules;
    this.auditResults = auditResults;
    this.outputDir = outputDir;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  generateAll() {
    this.generateMarkdownReport();
    this.generateIssuesCsv();
    this.generateSuggestionsReport();
    
    return {
      markdownReport: path.join(this.outputDir, 'label_audit.md'),
      issuesCsv: path.join(this.outputDir, 'issues.csv'),
      suggestionsReport: path.join(this.outputDir, 'suggestions.md')
    };
  }

  generateMarkdownReport() {
    const { issues, suggestions } = this.auditResults;
    
    let report = `# 化妆品配方标签一致性审计报告

**生成时间**: ${new Date().toLocaleString('zh-CN')}

## 摘要

- **总检查项**: 5 (INCI名称、含量排序、禁限用成分、香精过敏原、标签匹配)
- **问题数量**: ${issues.length}
- **建议数量**: ${suggestions.length}

### 问题严重程度分布

| 严重程度 | 数量 |
|---------|------|
| Critical (严重) | ${issues.filter(i => i.severity === 'critical').length} |
| High (高) | ${issues.filter(i => i.severity === 'high').length} |
| Medium (中) | ${issues.filter(i => i.severity === 'medium').length} |
| Low (低) | ${issues.filter(i => i.severity === 'low').length} |

---

## 1. 配方信息

### 1.1 成分列表 (按配方顺序)

| 序号 | 成分名称 | INCI名称 | 含量 (%) | 作用 | 是否香精 |
|-----|---------|---------|---------|------|---------|
`;

    this.formula.forEach((ingredient, index) => {
      report += `| ${index + 1} | ${ingredient.name} | ${ingredient.inciName || '-'} | ${ingredient.percentage} | ${ingredient.role || '-'} | ${ingredient.isFragrance ? '是' : '否'} |\n`;
    });

    report += `
---

## 2. 检查结果

### 2.1 INCI 名称检查

`;

    const inciIssues = issues.filter(i => 
      i.type === 'INCI_NAME_ERROR' || i.type === 'INCI_ALIAS_WARNING'
    );

    if (inciIssues.length > 0) {
      report += `**发现问题: ${inciIssues.length} 个**

| 严重程度 | 类型 | 成分 | 问题描述 |
|---------|------|------|---------|
`;

      inciIssues.forEach(issue => {
        const severityText = this.getSeverityText(issue.severity);
        const typeText = this.getTypeText(issue.type);
        report += `| ${severityText} | ${typeText} | ${issue.ingredient} | ${issue.message} |\n`;
      });
    } else {
      report += `✅ **所有 INCI 名称检查通过**\n`;
    }

    report += `
### 2.2 含量排序检查

`;

    const orderIssues = issues.filter(i => i.type === 'PERCENTAGE_ORDER_ERROR');

    if (orderIssues.length > 0) {
      report += `**发现问题: ${orderIssues.length} 个**

| 严重程度 | 位置 | 当前成分 | 当前含量 | 前一成分 | 前一含量 | 问题描述 |
|---------|------|---------|---------|---------|---------|---------|
`;

      orderIssues.forEach(issue => {
        const severityText = this.getSeverityText(issue.severity);
        report += `| ${severityText} | 第 ${issue.position + 1} 位 | ${issue.currentIngredient} | ${issue.currentPercentage}% | ${issue.previousIngredient} | ${issue.previousPercentage}% | ${issue.message} |\n`;
      });
    } else {
      report += `✅ **含量排序检查通过**\n`;
    }

    const samePercentageGroups = suggestions.filter(s => s.type === 'same_percentage_group');
    if (samePercentageGroups.length > 0) {
      report += `
**注意: 发现含量相同的成分组**

`;
      samePercentageGroups.forEach((group, index) => {
        report += `#### 组 ${index + 1} (含量: ${group.percentage}%)

- ${group.group.join('\n- ')}

${group.note}

`;
      });
    }

    report += `
### 2.3 禁限用成分检查

`;

    const restrictedIssues = issues.filter(i => 
      i.type === 'BANNED_INGREDIENT' || i.type === 'RESTRICTED_INGREDIENT_EXCEEDED'
    );

    if (restrictedIssues.length > 0) {
      report += `**发现问题: ${restrictedIssues.length} 个**

| 严重程度 | 类型 | 成分 | 当前含量 | 限制 | 问题描述 |
|---------|------|------|---------|------|---------|
`;

      restrictedIssues.forEach(issue => {
        const severityText = this.getSeverityText(issue.severity);
        const typeText = this.getTypeText(issue.type);
        const limit = issue.maxPercentage ? `最大 ${issue.maxPercentage}%` : '禁用';
        report += `| ${severityText} | ${typeText} | ${issue.ingredient} | ${issue.percentage || issue.currentPercentage}% | ${limit} | ${issue.message} |\n`;
      });
    } else {
      const withinLimit = suggestions.filter(s => s.type === 'restricted_within_limit');
      if (withinLimit.length > 0) {
        report += `**限用成分在允许范围内**

| 成分 | 当前含量 | 最大允许 |
|------|---------|---------|
`;
        withinLimit.forEach(s => {
          report += `| ${s.ingredient} | ${s.currentPercentage}% | ${s.maxPercentage}% |\n`;
        });
      } else {
        report += `✅ **未发现禁限用成分问题**\n`;
      }
    }

    report += `
### 2.4 香精过敏原标注检查

`;

    const allergenIssues = issues.filter(i => i.type === 'ALLERGEN_NOT_LABELED');

    if (allergenIssues.length > 0) {
      report += `**发现问题: ${allergenIssues.length} 个**

| 严重程度 | 过敏原 | 含量 | 阈值 | 问题描述 |
|---------|--------|------|------|---------|
`;

      allergenIssues.forEach(issue => {
        const severityText = this.getSeverityText(issue.severity);
        report += `| ${severityText} | ${issue.allergen} | ${issue.percentage}% | ${issue.threshold}% | ${issue.message} |\n`;
      });
    } else {
      const allergenSummary = suggestions.filter(s => s.type === 'fragrance_allergens_summary');
      if (allergenSummary.length > 0 && allergenSummary[0].allergens.length > 0) {
        report += `**香精过敏原标注情况**

| 过敏原 | 含量 | 是否已标注 |
|--------|------|-----------|
`;
        allergenSummary[0].allergens.forEach(allergen => {
          const isLabeled = allergenSummary[0].labeled.includes(allergen.name);
          report += `| ${allergen.name} | ${allergen.percentage}% | ${isLabeled ? '✅ 是' : '❌ 否'} |\n`;
        });
      } else {
        report += `✅ **未发现香精过敏原标注问题**\n`;
      }
    }

    report += `
### 2.5 标签成分匹配检查

`;

    const labelMatchIssues = issues.filter(i => i.type === 'LABEL_INGREDIENT_NOT_IN_FORMULA');

    if (labelMatchIssues.length > 0) {
      report += `**发现问题: ${labelMatchIssues.length} 个**

| 严重程度 | 标签成分 | 问题描述 |
|---------|---------|---------|
`;

      labelMatchIssues.forEach(issue => {
        const severityText = this.getSeverityText(issue.severity);
        report += `| ${severityText} | ${issue.labelIngredient} | ${issue.message} |\n`;
      });
    } else {
      report += `✅ **标签成分与配方匹配**\n`;
    }

    report += `
---

## 3. 修正建议

`;

    const aliasSuggestions = suggestions.filter(s => s.type === 'alias_normalization');
    if (aliasSuggestions.length > 0) {
      report += `### 3.1 INCI 名称归一化建议

| 原始名称 | 标准 INCI 名称 |
|---------|---------------|
`;
      aliasSuggestions.forEach(s => {
        report += `| ${s.original} | ${s.standard} |\n`;
      });
      report += `\n`;
    }

    if (orderIssues.length > 0) {
      report += `### 3.2 成分排序修正建议

建议按照含量从高到低重新排列成分顺序。以下是正确的排序:

`;
      const sortedFormula = [...this.formula].sort((a, b) => b.percentage - a.percentage);
      sortedFormula.forEach((ing, index) => {
        report += `${index + 1}. ${ing.name} (${ing.percentage}%)\n`;
      });
      report += `\n`;
    }

    if (restrictedIssues.length > 0) {
      report += `### 3.3 禁限用成分处理建议

`;
      restrictedIssues.forEach(issue => {
        if (issue.type === 'BANNED_INGREDIENT') {
          report += `- **${issue.ingredient}**: 立即移除该禁用成分\n`;
        } else if (issue.type === 'RESTRICTED_INGREDIENT_EXCEEDED') {
          report += `- **${issue.ingredient}**: 将含量从 ${issue.currentPercentage}% 降低至 ${issue.maxPercentage}% 以下\n`;
        }
      });
      report += `\n`;
    }

    if (allergenIssues.length > 0) {
      report += `### 3.4 香精过敏原标注建议

请在标签中添加以下香精过敏原标注:

`;
      allergenIssues.forEach(issue => {
        report += `- 标注 "${issue.allergen}"，例如: "香精(${issue.allergen})"\n`;
      });
      report += `\n`;
    }

    if (labelMatchIssues.length > 0) {
      report += `### 3.5 标签成分修正建议

`;
      labelMatchIssues.forEach(issue => {
        report += `- 确认 "${issue.labelIngredient}" 是否应该在配方中，或修正标签\n`;
      });
      report += `\n`;
    }

    report += `
---

## 4. 原始标签内容

\`\`\`
${this.packLabel.rawContent}
\`\`\`

---

**报告生成完毕**
`;

    const reportPath = path.join(this.outputDir, 'label_audit.md');
    fs.writeFileSync(reportPath, report, 'utf8');
    return reportPath;
  }

  generateIssuesCsv() {
    const { issues } = this.auditResults;
    
    if (issues.length === 0) {
      const emptyPath = path.join(this.outputDir, 'issues.csv');
      fs.writeFileSync(emptyPath, 'id,type,severity,ingredient,message,suggestion\n', 'utf8');
      return emptyPath;
    }

    const csvWriter = createCsvWriter({
      path: path.join(this.outputDir, 'issues.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'type', title: '类型' },
        { id: 'severity', title: '严重程度' },
        { id: 'ingredient', title: '成分' },
        { id: 'message', title: '问题描述' },
        { id: 'suggestion', title: '修正建议' }
      ]
    });

    const records = issues.map((issue, index) => ({
      id: index + 1,
      type: this.getTypeText(issue.type),
      severity: this.getSeverityText(issue.severity),
      ingredient: issue.ingredient || issue.currentIngredient || issue.allergen || issue.labelIngredient || '-',
      message: issue.message,
      suggestion: issue.suggestion
    }));

    csvWriter.writeRecords(records);
    return path.join(this.outputDir, 'issues.csv');
  }

  generateSuggestionsReport() {
    const { suggestions } = this.auditResults;
    
    let report = `# 修正建议详情

**生成时间**: ${new Date().toLocaleString('zh-CN')}

---

## 1. INCI 名称归一化建议

`;

    const aliasSuggestions = suggestions.filter(s => s.type === 'alias_normalization');
    if (aliasSuggestions.length > 0) {
      report += `以下成分使用了别名，建议替换为标准 INCI 名称:

| 原始名称 | 标准 INCI 名称 |
|---------|---------------|
`;
      aliasSuggestions.forEach(s => {
        report += `| ${s.original} | ${s.standard} |\n`;
      });
    } else {
      report += `✅ 所有成分名称均已使用标准 INCI 名称\n`;
    }

    report += `
---

## 2. 含量相同成分组说明

`;

    const samePercentageGroups = suggestions.filter(s => s.type === 'same_percentage_group');
    if (samePercentageGroups.length > 0) {
      report += `以下成分组含量相同，顺序可以互换，但建议保持一致性:

`;
      samePercentageGroups.forEach((group, index) => {
        report += `### 组 ${index + 1} (含量: ${group.percentage}%)

- ${group.group.join('\n- ')}

${group.note}

`;
      });
    } else {
      report += `ℹ️ 未发现含量完全相同的成分\n`;
    }

    report += `
---

## 3. 限用成分合规情况

`;

    const withinLimit = suggestions.filter(s => s.type === 'restricted_within_limit');
    if (withinLimit.length > 0) {
      report += `以下限用成分含量在允许范围内:

| 成分 | 当前含量 | 最大允许 |
|------|---------|---------|
`;
      withinLimit.forEach(s => {
        report += `| ${s.ingredient} | ${s.currentPercentage}% | ${s.maxPercentage}% |\n`;
      });
    } else {
      report += `ℹ️ 未使用限用成分\n`;
    }

    report += `
---

## 4. 香精过敏原汇总

`;

    const allergenSummary = suggestions.filter(s => s.type === 'fragrance_allergens_summary');
    if (allergenSummary.length > 0 && allergenSummary[0].allergens.length > 0) {
      report += `配方中检测到以下香精过敏原:

| 过敏原 | 含量 | 阈值 | 是否已标注 |
|--------|------|------|-----------|
`;
      allergenSummary[0].allergens.forEach(allergen => {
        const isLabeled = allergenSummary[0].labeled.includes(allergen.name);
        report += `| ${allergen.name} | ${allergen.percentage}% | ${allergen.threshold}% | ${isLabeled ? '✅ 是' : '❌ 否'} |\n`;
      });
    } else {
      report += `✅ 未检测到需要标注的香精过敏原\n`;
    }

    report += `
---

**建议报告生成完毕**
`;

    const reportPath = path.join(this.outputDir, 'suggestions.md');
    fs.writeFileSync(reportPath, report, 'utf8');
    return reportPath;
  }

  getSeverityText(severity) {
    const severityMap = {
      'critical': 'Critical (严重)',
      'high': 'High (高)',
      'medium': 'Medium (中)',
      'low': 'Low (低)'
    };
    return severityMap[severity] || severity;
  }

  getTypeText(type) {
    const typeMap = {
      'INCI_NAME_ERROR': 'INCI名称错误',
      'INCI_ALIAS_WARNING': 'INCI别名警告',
      'PERCENTAGE_ORDER_ERROR': '含量排序错误',
      'BANNED_INGREDIENT': '禁用成分',
      'RESTRICTED_INGREDIENT_EXCEEDED': '限用成分超标',
      'ALLERGEN_NOT_LABELED': '过敏原未标注',
      'LABEL_INGREDIENT_NOT_IN_FORMULA': '标签成分未在配方中'
    };
    return typeMap[type] || type;
  }
}

module.exports = Reporter;
