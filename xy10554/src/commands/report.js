const Store = require('../utils/store');
const RuleEngine = require('../rules/engine');
const { STATUS, CHANNEL_TYPE } = require('../models/content');
const chalk = require('chalk');

function reportCommand(options) {
  console.log(chalk.blue('\n=== 撤稿闭环报告 ===\n'));
  
  const store = new Store();
  const contents = store.getAllContents();
  
  if (contents.length === 0) {
    console.log(chalk.yellow('暂无内容记录，无法生成报告'));
    return { success: true, count: 0 };
  }
  
  const report = {
    summary: {
      total: contents.length,
      completed: 0,
      partial: 0,
      blocked: 0,
      active: 0
    },
    byType: {
      news: { total: 0, completed: 0, issues: 0 },
      event: { total: 0, completed: 0, issues: 0 },
      product: { total: 0, completed: 0, issues: 0 }
    },
    issues: {
      missingOwner: 0,
      cacheProblem: 0,
      cooperationUnconfirmed: 0,
      referenceLinks: 0,
      multipleVersions: 0
    },
    channels: {
      total: 0,
      completed: 0,
      byType: {
        official_website: 0,
        wechat: 0,
        cooperation: 0,
        intranet: 0,
        app: 0
      }
    },
    nextActions: [],
    responsiblePersons: new Set()
  };
  
  contents.forEach(content => {
    const rules = RuleEngine.runAllRules(content, store);
    const type = content.type in report.byType ? content.type : 'news';
    
    report.byType[type].total++;
    report.channels.total += content.channels.length;
    
    const completedChannels = content.channels.filter(c => c.status === STATUS.UNPUBLISHED).length;
    report.channels.completed += completedChannels;
    
    content.channels.forEach(c => {
      if (c.channelType in report.channels.byType) {
        report.channels.byType[c.channelType]++;
      }
    });
    
    switch (rules.overallStatus) {
      case STATUS.UNPUBLISHED:
        report.summary.completed++;
        report.byType[type].completed++;
        break;
      case STATUS.PARTIAL:
        report.summary.partial++;
        break;
      case STATUS.FAILED:
        report.summary.blocked++;
        break;
      default:
        report.summary.active++;
    }
    
    rules.issues.forEach(issue => {
      report.byType[type].issues++;
      
      switch (issue.type) {
        case 'missing_owner':
          report.issues.missingOwner++;
          break;
        case 'cache_issue':
          report.issues.cacheProblem++;
          report.nextActions.push({
            priority: 'high',
            action: '清理缓存',
            target: issue.channelName || content.title,
            responsible: getResponsiblePerson(content, issue)
          });
          break;
        case 'cooperation_unconfirmed':
        case 'cooperation_active':
          report.issues.cooperationUnconfirmed++;
          report.nextActions.push({
            priority: 'high',
            action: '确认合作方撤稿',
            target: issue.channelName,
            responsible: getResponsiblePerson(content, issue)
          });
          break;
        case 'reference_has_link':
        case 'reference_unverified':
          report.issues.referenceLinks++;
          report.nextActions.push({
            priority: 'medium',
            action: '检查引用页面',
            target: issue.pageTitle,
            responsible: getResponsiblePerson(content, issue)
          });
          break;
        case 'multiple_versions':
        case 'incomplete_versions':
          report.issues.multipleVersions++;
          break;
      }
      
      if (content.owner) {
        report.responsiblePersons.add(content.owner);
      }
    });
  });
  
  printReport(report);
  
  return { success: true, report };
}

function getResponsiblePerson(content, issue) {
  if (issue.field && issue.field.includes('channels')) {
    const match = issue.field.match(/channels\[(\d+)\]/);
    if (match && content.channels[parseInt(match[1])]) {
      return content.channels[parseInt(match[1])].owner || content.owner || '待定';
    }
  }
  if (issue.field && issue.field.includes('referencePages')) {
    const match = issue.field.match(/referencePages\[(\d+)\]/);
    if (match && content.referencePages[parseInt(match[1])]) {
      return content.referencePages[parseInt(match[1])].owner || content.owner || '待定';
    }
  }
  return content.owner || '待定';
}

function printReport(report) {
  console.log(chalk.bold.yellow('📊 总览'));
  console.log(`  总内容数: ${report.summary.total}`);
  console.log(`  ${chalk.green('✓ 已完成撤稿')}: ${report.summary.completed}`);
  console.log(`  ${chalk.yellow('○ 部分撤稿')}: ${report.summary.partial}`);
  console.log(`  ${chalk.red('✗ 有阻塞问题')}: ${report.summary.blocked}`);
  console.log(`  ${chalk.blue('○ 仍活跃')}: ${report.summary.active}`);
  
  console.log(chalk.bold.yellow('\n📂 按类型分布'));
  Object.entries(report.byType).forEach(([type, data]) => {
    if (data.total > 0) {
      const typeNames = { news: '新闻稿', event: '活动页', product: '产品说明' };
      const completion = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      console.log(`  ${typeNames[type] || type}: ${data.completed}/${data.total} (${completion}%)`);
      if (data.issues > 0) {
        console.log(`    ${chalk.red(`问题数: ${data.issues}`)}`);
      }
    }
  });
  
  console.log(chalk.bold.yellow('\n🌐 渠道覆盖'));
  const channelNames = {
    official_website: '官网',
    wechat: '公众号',
    cooperation: '合作方',
    intranet: '内网',
    app: 'APP'
  };
  console.log(`  总渠道数: ${report.channels.total}`);
  console.log(`  已撤稿: ${report.channels.completed}`);
  console.log(`  渠道分布:`);
  Object.entries(report.channels.byType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`    ${channelNames[type] || type}: ${count}`);
    }
  });
  
  console.log(chalk.bold.yellow('\n⚠ 问题统计'));
  console.log(`  缺少责任人: ${report.issues.missingOwner}`);
  console.log(`  缓存问题: ${report.issues.cacheProblem}`);
  console.log(`  合作方未确认: ${report.issues.cooperationUnconfirmed}`);
  console.log(`  引用链接问题: ${report.issues.referenceLinks}`);
  console.log(`  多版本冲突: ${report.issues.multipleVersions}`);
  
  if (report.nextActions.length > 0) {
    console.log(chalk.bold.yellow('\n📋 下一步负责人'));
    
    const grouped = {};
    report.nextActions.forEach(action => {
      if (!grouped[action.responsible]) {
        grouped[action.responsible] = [];
      }
      grouped[action.responsible].push(action);
    });
    
    Object.entries(grouped).forEach(([person, actions]) => {
      console.log(`\n  ${chalk.bold(person === '待定' ? chalk.red('⚠ 未指定') : person)}:`);
      actions.forEach((action, idx) => {
        const priority = action.priority === 'high' ? chalk.red('[紧急]') : chalk.yellow('[普通]');
        console.log(`    ${idx + 1}. ${priority} ${action.action} - ${action.target}`);
      });
    });
  }
  
  const overallCompletion = report.summary.total > 0 
    ? Math.round((report.summary.completed / report.summary.total) * 100) 
    : 0;
  
  console.log(chalk.bold.yellow('\n✅ 闭环判断'));
  if (report.summary.blocked > 0) {
    console.log(chalk.red(`  ❌ 业务未闭环: 存在 ${report.summary.blocked} 个阻塞问题`));
  } else if (report.summary.active > 0 || report.summary.partial > 0) {
    console.log(chalk.yellow(`  ⚠ 业务部分闭环: 完成度 ${overallCompletion}%`));
  } else {
    console.log(chalk.green(`  ✓ 业务已闭环: 完成度 100%`));
  }
}

module.exports = reportCommand;
