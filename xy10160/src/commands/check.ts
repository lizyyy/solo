import chalk from 'chalk';
import {
  isInitialized,
  getSnapshotById,
  getSourceById,
  getSnapshotProducts,
  getSourceProducts,
  saveCheckResult,
  addHistoryEntry,
  getSnapshots,
  getSources,
} from '../storage/store';
import { compareAllProducts } from '../services/checker';

export const listSnapshotsCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const snapshots = getSnapshots();
  if (snapshots.length === 0) {
    console.log(chalk.yellow('暂无索引快照'));
    return;
  }

  console.log(chalk.blue('📸 索引快照列表:\n'));
  snapshots.forEach((s, i) => {
    console.log(chalk.white(`${i + 1}. ${s.name}`));
    console.log(chalk.gray(`   ID: ${s.id}`));
    console.log(chalk.gray(`   商品数: ${s.productCount}`));
    console.log(chalk.gray(`   创建时间: ${s.createdAt}`));
    if (s.description) {
      console.log(chalk.gray(`   描述: ${s.description}`));
    }
    console.log();
  });
};

export const listSourcesCommand = (): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    return;
  }

  const sources = getSources();
  if (sources.length === 0) {
    console.log(chalk.yellow('暂无源数据'));
    return;
  }

  console.log(chalk.blue('📂 源数据列表:\n'));
  sources.forEach((s, i) => {
    console.log(chalk.white(`${i + 1}. ${s.name}`));
    console.log(chalk.gray(`   ID: ${s.id}`));
    console.log(chalk.gray(`   商品数: ${s.productCount}`));
    console.log(chalk.gray(`   来源: ${s.sourceType}`));
    console.log(chalk.gray(`   创建时间: ${s.createdAt}`));
    if (s.description) {
      console.log(chalk.gray(`   描述: ${s.description}`));
    }
    console.log();
  });
};

export const checkCommand = (
  snapshotId: string,
  sourceId: string,
  options: { verbose?: boolean; limit?: number }
): void => {
  if (!isInitialized()) {
    console.log(chalk.red('✗ 项目未初始化'));
    console.log(chalk.gray('   请先运行: sir init'));
    addHistoryEntry('check', '检查失败', 'failed', '项目未初始化');
    return;
  }

  if (!snapshotId || !sourceId) {
    console.log(chalk.red('✗ 必须指定快照 ID 和源数据 ID'));
    console.log(chalk.gray('   用法: sir check <快照ID> <源数据ID>'));
    addHistoryEntry('check', '检查失败', 'failed', '缺少参数');
    return;
  }

  const snapshot = getSnapshotById(snapshotId);
  if (!snapshot) {
    console.log(chalk.red(`✗ 快照不存在: ${snapshotId}`));
    console.log(chalk.gray('   可运行: sir list snapshots 查看可用快照'));
    addHistoryEntry('check', '检查失败', 'failed', `快照不存在: ${snapshotId}`);
    return;
  }

  const source = getSourceById(sourceId);
  if (!source) {
    console.log(chalk.red(`✗ 源数据不存在: ${sourceId}`));
    console.log(chalk.gray('   可运行: sir list sources 查看可用源数据'));
    addHistoryEntry('check', '检查失败', 'failed', `源数据不存在: ${sourceId}`);
    return;
  }

  try {
    console.log(chalk.blue('🔍 开始比对索引快照和源数据...'));
    console.log(chalk.gray(`   快照: ${snapshot.name} (${snapshot.productCount} 商品)`));
    console.log(chalk.gray(`   源数据: ${source.name} (${source.productCount} 商品)`));

    const indexProducts = getSnapshotProducts(snapshotId);
    const sourceProducts = getSourceProducts(sourceId);

    if (!indexProducts || !sourceProducts) {
      console.log(chalk.red('✗ 无法读取数据文件'));
      addHistoryEntry('check', '检查失败', 'failed', '无法读取数据文件');
      return;
    }

    console.log(chalk.blue('⚙️  正在执行字段比对...'));
    const result = compareAllProducts(indexProducts, sourceProducts);

    console.log(chalk.blue('💾 正在保存检查结果...'));
    const checkResult = saveCheckResult({
      snapshotId,
      sourceId,
      totalProducts: sourceProducts.length,
      missingFieldsCount: result.missingFieldsCount,
      mismatchedFieldsCount: result.mismatchedFieldsCount,
      productDiffs: result.productDiffs,
      summary: result.summary,
    });

    console.log(chalk.green('✓ 检查完成'));
    console.log();
    console.log(chalk.white('📊 检查结果概要:'));
    console.log(chalk.gray(`   结果 ID: ${checkResult.id}`));
    console.log(chalk.gray(`   总检查商品: ${result.summary.totalChecked}`));
    console.log(
      chalk.gray(`   有问题商品: ${result.summary.withIssues} / ${result.summary.totalChecked}`)
    );
    console.log(chalk.gray(`   缺失字段总数: ${result.summary.missingFieldsTotal}`));
    console.log(chalk.gray(`   不一致字段总数: ${result.summary.mismatchedFieldsTotal}`));

    if (result.summary.mostCommonMissingFields.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠️  最常缺失的字段:'));
      result.summary.mostCommonMissingFields.forEach(({ field, count }) => {
        console.log(chalk.gray(`   - ${field}: ${count} 次`));
      });
    }

    if (options.verbose) {
      const issues = result.productDiffs.filter((p) => p.hasIssue);
      const limit = options.limit || 10;
      console.log();
      console.log(chalk.white('🔎 问题详情 (最多显示 ' + limit + ' 个):'));
      issues.slice(0, limit).forEach((diff, index) => {
        console.log();
        console.log(
          chalk.white(
            `  ${index + 1}. ${diff.productName} (ID: ${diff.productId})`
          )
        );
        if (diff.missingFields.length > 0) {
          console.log(chalk.red(`     缺失: ${diff.missingFields.join(', ')}`));
        }
        if (diff.mismatchedFields.length > 0) {
          console.log(chalk.yellow(`     不一致: ${diff.mismatchedFields.map((m) => m.fieldName).join(', ')}`));
        }
      });
    }

    addHistoryEntry(
      'check',
      `执行检查: ${snapshot.name} vs ${source.name}`,
      'success',
      `问题商品: ${result.summary.withIssues}/${result.summary.totalChecked}, 结果ID: ${checkResult.id}`
    );
  } catch (e) {
    console.log(chalk.red(`✗ 检查失败: ${(e as Error).message}`));
    addHistoryEntry('check', '检查失败', 'failed', (e as Error).message);
  }
};
