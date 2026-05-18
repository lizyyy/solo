const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class LeatherCareProcessor {
  constructor(config) {
    this.config = config;
    this.categories = {
      normal: [],
      rework: [],
      colorChange: [],
      reRunnable: []
    };
  }

  loadData(inputPath) {
    const fullPath = path.resolve(inputPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`输入文件不存在: ${fullPath}`);
    }
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return data;
  }

  classifyItem(item) {
    const { rules } = this.config;
    
    if (rules.rework.keywords.some(kw => 
      item.status.includes(kw) || item.notes?.includes(kw)
    )) {
      return 'rework';
    }
    
    if (rules.colorChange.keywords.some(kw => 
      item.serviceType.includes(kw) || item.notes?.includes(kw)
    )) {
      return 'colorChange';
    }
    
    if (rules.reRunnable.conditions.some(cond => 
      item.status === cond.status || item.priority === cond.priority
    )) {
      return 'reRunnable';
    }
    
    return 'normal';
  }

  process(data) {
    this.categories = {
      normal: [],
      rework: [],
      colorChange: [],
      reRunnable: []
    };

    data.forEach(item => {
      const category = this.classifyItem(item);
      this.categories[category].push({
        ...item,
        processedAt: new Date().toISOString(),
        category
      });
    });

    return this.categories;
  }

  generateSummary() {
    return {
      total: Object.values(this.categories).flat().length,
      normal: this.categories.normal.length,
      rework: this.categories.rework.length,
      colorChange: this.categories.colorChange.length,
      reRunnable: this.categories.reRunnable.length,
      processedAt: new Date().toISOString()
    };
  }

  writeResults(outputDir, isPreview = false) {
    const fullOutputDir = path.resolve(outputDir);
    
    if (!isPreview && !fs.existsSync(fullOutputDir)) {
      fs.mkdirSync(fullOutputDir, { recursive: true });
    }

    const results = {};
    const fileMap = {
      normal: '正常完成.json',
      rework: '返修待处理.json',
      colorChange: '客户改色.json',
      reRunnable: '可复跑输出.json'
    };

    Object.entries(this.categories).forEach(([category, items]) => {
      const filename = fileMap[category];
      const filePath = path.join(fullOutputDir, filename);
      
      const content = {
        meta: {
          category,
          count: items.length,
          generatedAt: new Date().toISOString(),
          rules: this.config.rules[category]
        },
        data: items
      };

      if (!isPreview) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
      }
      
      results[category] = {
        filePath,
        count: items.length,
        content
      };
    });

    const summary = this.generateSummary();
    const summaryPath = path.join(fullOutputDir, '处理汇总.json');
    
    if (!isPreview) {
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    }
    
    results.summary = {
      filePath: summaryPath,
      content: summary
    };

    return results;
  }

  printPreview(results) {
    console.log('\n' + chalk.cyan.bold('='.repeat(60)));
    console.log(chalk.cyan.bold('           皮具护理进度 - 预览模式'));
    console.log(chalk.cyan.bold('='.repeat(60)) + '\n');

    console.log(chalk.yellow.bold('📊 处理汇总:'));
    console.log(chalk.gray('  总记录数: ') + results.summary.content.total);
    console.log(chalk.green('  ✅ 正常完成: ') + results.summary.content.normal);
    console.log(chalk.red('  🔄 返修待处理: ') + results.summary.content.rework);
    console.log(chalk.magenta('  🎨 客户改色: ') + results.summary.content.colorChange);
    console.log(chalk.blue('  ⚡ 可复跑输出: ') + results.summary.content.reRunnable);
    console.log('');

    this.printCategoryPreview('normal', '✅ 正常完成', results.normal.content.data, chalk.green);
    this.printCategoryPreview('rework', '🔄 返修待处理', results.rework.content.data, chalk.red);
    this.printCategoryPreview('colorChange', '🎨 客户改色', results.colorChange.content.data, chalk.magenta);
    this.printCategoryPreview('reRunnable', '⚡ 可复跑输出', results.reRunnable.content.data, chalk.blue);

    console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
    console.log(chalk.cyan('  文件将输出到: ') + path.dirname(results.normal.filePath));
    console.log(chalk.cyan('  执行 ') + chalk.white.bold('npm run run') + chalk.cyan(' 正式写入文件'));
    console.log(chalk.cyan.bold('='.repeat(60)) + '\n');
  }

  printCategoryPreview(category, title, items, colorFn) {
    if (items.length === 0) return;
    
    console.log(colorFn.bold(`\n${title} (${items.length}条):`));
    items.slice(0, 3).forEach((item, i) => {
      console.log(colorFn(`  ${i + 1}. [${item.orderNo}] ${item.customerName} - ${item.itemName} - ${item.status}`));
    });
    if (items.length > 3) {
      console.log(colorFn(`  ... 还有 ${items.length - 3} 条记录`));
    }
  }
}

module.exports = LeatherCareProcessor;
