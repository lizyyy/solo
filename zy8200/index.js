#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');

const Parser = require('./src/parser');
const Rules = require('./src/rules');
const Reporter = require('./src/reporter');

program
  .name('cosmetic-label-auditor')
  .description('化妆品配方标签一致性预检工具')
  .version('1.0.0')
  .option('-f, --formula <path>', '配方 CSV 文件路径')
  .option('-i, --inci-dict <path>', 'INCI 字典 YAML 文件路径')
  .option('-p, --pack-label <path>', '包装标签文本文件路径')
  .option('-a, --allergen-rules <path>', '过敏原规则 JSON 文件路径')
  .option('-o, --output <path>', '输出目录路径', './output')
  .parse(process.argv);

const options = program.opts();

if (!options.formula || !options.inciDict || !options.packLabel || !options.allergenRules) {
  console.error('错误：缺少必需参数');
  console.log('使用示例:');
  console.log('  node index.js --formula formula.csv --inci-dict inci_dictionary.yaml --pack-label pack_label.txt --allergen-rules allergen_rules.json');
  process.exit(1);
}

async function main() {
  try {
    console.log('========================================');
    console.log('  化妆品配方标签一致性预检工具');
    console.log('========================================');
    console.log('');
    
    console.log('📂 正在解析输入文件...');
    console.log('   - 配方文件:', options.formula);
    console.log('   - INCI 字典:', options.inciDict);
    console.log('   - 包装标签:', options.packLabel);
    console.log('   - 过敏原规则:', options.allergenRules);
    console.log('');
    
    const formula = await Parser.parseFormulaCsv(options.formula);
    console.log(`✅ 配方解析完成，共 ${formula.length} 个成分`);
    
    const inciDict = Parser.parseInciDictionary(options.inciDict);
    console.log(`✅ INCI 字典解析完成，共 ${inciDict.inciMap.size} 个标准名称，${inciDict.aliases.size} 个别名`);
    
    const packLabel = Parser.parsePackLabel(options.packLabel);
    console.log(`✅ 包装标签解析完成，共 ${packLabel.ingredients.length} 个标签成分`);
    
    const allergenRules = Parser.parseAllergenRules(options.allergenRules);
    console.log(`✅ 过敏原规则解析完成，共 ${allergenRules.allergens.length} 种过敏原，${allergenRules.restrictedIngredients.length} 种禁限用成分`);
    console.log('');
    
    console.log('🔍 正在执行规则检查...');
    const rules = new Rules(formula, inciDict, packLabel, allergenRules);
    const auditResults = rules.checkAll();
    console.log(`✅ 检查完成，发现 ${auditResults.issues.length} 个问题，${auditResults.suggestions.length} 条建议`);
    console.log('');
    
    const severityCount = {
      critical: auditResults.issues.filter(i => i.severity === 'critical').length,
      high: auditResults.issues.filter(i => i.severity === 'high').length,
      medium: auditResults.issues.filter(i => i.severity === 'medium').length,
      low: auditResults.issues.filter(i => i.severity === 'low').length
    };
    
    console.log('📊 问题严重程度分布:');
    console.log(`   - Critical (严重): ${severityCount.critical}`);
    console.log(`   - High (高): ${severityCount.high}`);
    console.log(`   - Medium (中): ${severityCount.medium}`);
    console.log(`   - Low (低): ${severityCount.low}`);
    console.log('');
    
    console.log('📄 正在生成报告...');
    const outputDir = path.isAbsolute(options.output) 
      ? options.output 
      : path.join(process.cwd(), options.output);
    
    const reporter = new Reporter(formula, inciDict, packLabel, allergenRules, auditResults, outputDir);
    const outputFiles = reporter.generateAll();
    
    console.log('✅ 报告生成完成!');
    console.log('');
    console.log('📁 输出文件:');
    console.log(`   - ${outputFiles.markdownReport}`);
    console.log(`   - ${outputFiles.issuesCsv}`);
    console.log(`   - ${outputFiles.suggestionsReport}`);
    console.log('');
    console.log('========================================');
    console.log('  检查完成!');
    console.log('========================================');
    
    if (auditResults.issues.length > 0) {
      console.log(`\n⚠️  发现 ${auditResults.issues.length} 个问题，请查看报告详情。`);
      
      const criticalIssues = auditResults.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        console.log(`\n🚨 严重问题 (${criticalIssues.length} 个):`);
        criticalIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
      }
      
      const highIssues = auditResults.issues.filter(i => i.severity === 'high');
      if (highIssues.length > 0) {
        console.log(`\n⚠️  高优先级问题 (${highIssues.length} 个):`);
        highIssues.slice(0, 5).forEach(issue => {
          console.log(`   - ${issue.message}`);
        });
        if (highIssues.length > 5) {
          console.log(`   ... 还有 ${highIssues.length - 5} 个高优先级问题`);
        }
      }
    } else {
      console.log('\n✅ 未发现任何问题!');
    }
    
  } catch (error) {
    console.error('\n❌ 执行过程中发生错误:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
