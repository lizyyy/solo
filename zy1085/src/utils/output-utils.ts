import chalk from 'chalk';
import { 
  ReleasePlan,
  ValidationResult,
  RollbackReadiness,
  BreakingChange,
  RiskFactor,
  OwnerResponsibility,
  MissingRollbackPlan,
  RollbackChecklistItem
} from '../types';

/**
 * 输出工具类
 */
export class OutputUtils {
  /**
   * 输出成功信息
   */
  static success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  /**
   * 输出错误信息
   */
  static error(message: string): void {
    console.error(chalk.red(`✗ ${message}`));
  }

  /**
   * 输出警告信息
   */
  static warning(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * 输出信息
   */
  static info(message: string): void {
    console.log(chalk.blue(`ℹ ${message}`));
  }

  /**
   * 输出标题
   */
  static title(title: string): void {
    console.log('');
    console.log(chalk.bold.underline(title));
    console.log('');
  }

  /**
   * 输出分隔线
   */
  static separator(): void {
    console.log(chalk.dim('─'.repeat(60)));
  }

  /**
   * 格式化并输出校验结果
   */
  static printValidationResult(result: ValidationResult): void {
    this.title('校验结果');

    const criticalErrors = result.errors.filter(e => e.severity === 'critical');
    const normalErrors = result.errors.filter(e => e.severity === 'error');
    const warnings = result.warnings;
    const info = result.info;

    if (criticalErrors.length > 0) {
      console.log(chalk.bold.red(`\n严重错误 (${criticalErrors.length}):`));
      criticalErrors.forEach(err => {
        console.log(chalk.red(`  • [${err.field}] ${err.message}`));
      });
    }

    if (normalErrors.length > 0) {
      console.log(chalk.bold.red(`\n错误 (${normalErrors.length}):`));
      normalErrors.forEach(err => {
        console.log(chalk.red(`  • [${err.field}] ${err.message}`));
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.bold.yellow(`\n警告 (${warnings.length}):`));
      warnings.forEach(warn => {
        console.log(chalk.yellow(`  • [${warn.field}] ${warn.message}`));
      });
    }

    if (info.length > 0) {
      console.log(chalk.bold.blue(`\n信息 (${info.length}):`));
      info.forEach(i => {
        console.log(chalk.blue(`  • [${i.field}] ${i.message}`));
      });
    }

    console.log('');
    if (result.valid) {
      this.success('校验通过！所有必要的检查已完成。');
    } else {
      this.error(`校验失败！发现 ${result.errors.length} 个错误，${result.warnings.length} 个警告。`);
    }
  }

  /**
   * 输出计划汇总
   */
  static printReleasePlan(plan: ReleasePlan): void {
    this.title(`发版计划 - v${plan.version}`);
    
    console.log(`📅 日期: ${plan.date}`);
    console.log(`📝 摘要: ${plan.summary}`);
    console.log('');
    
    // 统计信息
    this.printSectionHeader('变更统计');
    console.log(`  提交记录: ${plan.commits.length} 条`);
    console.log(`  关联Issue: ${plan.issues.length} 个`);
    console.log(`  数据库迁移: ${plan.migrations.length} 个`);
    console.log(`  配置变更: ${plan.configChanges.length} 项`);
    console.log('');

    // 破坏性变更
    if (plan.analysis.breakingChanges.length > 0) {
      this.printSectionHeader('破坏性变更');
      plan.analysis.breakingChanges.forEach((change: BreakingChange, index: number) => {
        const severityColor = this.getSeverityColor(change.severity);
        console.log(chalk.bold(`  ${index + 1}. [${change.type.toUpperCase()}] ${change.description}`));
        console.log(chalk.dim(`     严重程度: ${severityColor(change.severity.toUpperCase())}`));
        console.log(chalk.dim(`     影响区域: ${change.affectedAreas.join(', ')}`));
        if (change.mitigation) {
          console.log(chalk.dim(`     缓解措施: ${change.mitigation}`));
        }
        console.log('');
      });
    }

    // 风险评估
    this.printSectionHeader('风险评估');
    const riskColor = this.getSeverityColor(plan.analysis.riskAssessment.overallRisk);
    console.log(`  整体风险等级: ${riskColor(plan.analysis.riskAssessment.overallRisk.toUpperCase())}`);
    console.log('');
    
    if (plan.analysis.riskAssessment.riskFactors.length > 0) {
      console.log('  风险因素:');
      plan.analysis.riskAssessment.riskFactors.forEach((factor: RiskFactor, index: number) => {
        const impactColor = this.getSeverityColor(factor.impact);
        console.log(`    ${index + 1}. ${factor.category}: ${factor.description}`);
        console.log(chalk.dim(`       可能性: ${factor.likelihood.toUpperCase()}, 影响: ${impactColor(factor.impact.toUpperCase())}, 分数: ${factor.score}`));
      });
    }
    
    if (plan.analysis.riskAssessment.mitigationPlan.length > 0) {
      console.log('\n  缓解计划:');
      plan.analysis.riskAssessment.mitigationPlan.forEach((step: string, index: number) => {
        console.log(`    ${index + 1}. ${step}`);
      });
    }
    console.log('');

    // 影响分析
    this.printSectionHeader('影响分析');
    console.log(`  需要停机: ${plan.analysis.impactAnalysis.downtimeRequired ? chalk.red('是') : chalk.green('否')}`);
    if (plan.analysis.impactAnalysis.downtimeEstimate) {
      console.log(`  预计停机时间: ${plan.analysis.impactAnalysis.downtimeEstimate}`);
    }
    
    if (plan.analysis.impactAnalysis.affectedCustomers.length > 0) {
      console.log(`\n  受影响客户 (${plan.analysis.impactAnalysis.affectedCustomers.length}):`);
      plan.analysis.impactAnalysis.affectedCustomers.forEach((customer: string) => {
        console.log(`    • ${customer}`);
      });
    }
    
    if (plan.analysis.impactAnalysis.affectedModules.length > 0) {
      console.log(`\n  受影响模块 (${plan.analysis.impactAnalysis.affectedModules.length}):`);
      plan.analysis.impactAnalysis.affectedModules.forEach((module: string) => {
        console.log(`    • ${module}`);
      });
    }
    
    if (plan.analysis.impactAnalysis.dependentServices.length > 0) {
      console.log(`\n  依赖服务 (${plan.analysis.impactAnalysis.dependentServices.length}):`);
      plan.analysis.impactAnalysis.dependentServices.forEach((service: string) => {
        console.log(`    • ${service}`);
      });
    }
    console.log('');

    // 负责人责任
    if (plan.analysis.ownerResponsibility.length > 0) {
      this.printSectionHeader('负责人职责');
      plan.analysis.ownerResponsibility.forEach((owner: OwnerResponsibility) => {
        console.log(chalk.bold(`  ${owner.owner}:`));
        if (owner.modules.length > 0) console.log(`    模块: ${owner.modules.join(', ')}`);
        if (owner.issues.length > 0) console.log(`    Issue: ${owner.issues.length} 个`);
        if (owner.commits.length > 0) console.log(`    提交: ${owner.commits.length} 条`);
        if (owner.migrations.length > 0) console.log(`    迁移: ${owner.migrations.length} 个`);
        console.log('');
      });
    }

    // 回滚准备状态
    this.printSectionHeader('回滚准备状态');
    const rollbackStatus = plan.analysis.rollbackReadiness.isReady 
      ? chalk.green('已准备就绪') 
      : chalk.red('未准备就绪');
    console.log(`  状态: ${rollbackStatus}`);
    
    if (plan.analysis.rollbackReadiness.missingRollbackPlans.length > 0) {
      console.log(chalk.bold.red(`\n  缺失回滚计划 (${plan.analysis.rollbackReadiness.missingRollbackPlans.length}):`));
      plan.analysis.rollbackReadiness.missingRollbackPlans.forEach((missing: MissingRollbackPlan) => {
        console.log(chalk.red(`    • [${missing.type.toUpperCase()}] ${missing.description}`));
        console.log(chalk.dim(`      建议: ${missing.suggestedAction}`));
      });
    }
    console.log('');
  }

  /**
   * 输出回滚核对清单
   */
  static printRollbackChecklist(checklist: RollbackReadiness): void {
    this.title('回滚核对清单');

    const status = checklist.isReady ? chalk.green('✅ 回滚准备就绪') : chalk.red('⚠️  回滚未准备就绪');
    console.log(`整体状态: ${status}`);
    console.log('');

    if (checklist.missingRollbackPlans.length > 0) {
      console.log(chalk.bold.red(`❌ 缺失回滚计划 (${checklist.missingRollbackPlans.length}):`));
      checklist.missingRollbackPlans.forEach((missing: MissingRollbackPlan, index: number) => {
        console.log(chalk.red(`\n  ${index + 1}. [${missing.type.toUpperCase()}] ${missing.description}`));
        console.log(chalk.yellow(`     建议: ${missing.suggestedAction}`));
      });
      console.log('');
    }

    console.log(chalk.bold.blue('📋 回滚步骤:'));
    console.log('');

    const groupedChecklist: Record<string, RollbackChecklistItem[]> = {};
    checklist.rollbackChecklist.forEach((item: RollbackChecklistItem) => {
      if (!groupedChecklist[item.category]) {
        groupedChecklist[item.category] = [];
      }
      groupedChecklist[item.category].push(item);
    });

    Object.entries(groupedChecklist).forEach(([category, items]: [string, RollbackChecklistItem[]]) => {
      console.log(chalk.bold(`  [${category}]`));
      items.forEach((item: RollbackChecklistItem, index: number) => {
        const statusIcon = item.completed ? chalk.green('✅') : chalk.yellow('⬜');
        const statusLabel = item.status === 'required' 
          ? chalk.red('[必需]') 
          : item.status === 'optional' 
            ? chalk.yellow('[可选]') 
            : chalk.gray('[不适用]');
        
        console.log(`    ${index + 1}. ${statusIcon} ${statusLabel} ${item.task}`);
        if (item.notes) {
          console.log(chalk.dim(`       备注: ${item.notes}`));
        }
      });
      console.log('');
    });
  }

  /**
   * 打印小节标题
   */
  private static printSectionHeader(title: string): void {
    console.log(chalk.bold.cyan(`📌 ${title}`));
    console.log(chalk.dim('─'.repeat(50)));
  }

  /**
   * 获取严重程度对应的颜色
   */
  private static getSeverityColor(severity: string): (text: string) => string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return chalk.red.bold;
      case 'high':
        return chalk.red;
      case 'medium':
        return chalk.yellow;
      case 'low':
        return chalk.green;
      default:
        return chalk.white;
    }
  }
}
