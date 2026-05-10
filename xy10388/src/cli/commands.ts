import { promises as fs } from 'fs';
import chalk from 'chalk';
import { MatchResult, ImportResult } from '../types';
import { dataStore, RawSellerData, RawBuyerData } from '../store/DataStore';
import { matcher } from '../matching/Matcher';

export async function importSellers(filePath: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('📚 正在导入卖家清单...'));
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const records: RawSellerData[] = JSON.parse(content);
    
    const result = await dataStore.importSellers(records);
    printImportResult(result, '卖家');
  } catch (error) {
    console.error(chalk.red(`❌ 导入失败: ${error}`));
    process.exit(1);
  }
}

export async function importBuyers(filePath: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('🛒 正在导入买家需求...'));
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const records: RawBuyerData[] = JSON.parse(content);
    
    const result = await dataStore.importBuyers(records);
    printImportResult(result, '买家');
  } catch (error) {
    console.error(chalk.red(`❌ 导入失败: ${error}`));
    process.exit(1);
  }
}

function printImportResult(result: ImportResult, type: string): void {
  console.log('\n' + chalk.bold(`📊 ${type}导入结果`));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  总计: ${chalk.cyan(result.totalRecords)} 条`);
  console.log(`  成功导入: ${chalk.green(result.imported)} 条`);
  console.log(`  合并更新: ${chalk.yellow(result.merged)} 条`);
  console.log(`  重复跳过: ${chalk.gray(result.duplicates)} 条`);
  console.log(`  错误: ${chalk.red(result.errors)} 条`);
  
  if (result.messages.length > 0) {
    console.log('\n' + chalk.bold('📝 详细信息:'));
    for (const msg of result.messages) {
      if (msg.startsWith('导入:')) {
        console.log('  ' + chalk.green('✓ ') + msg);
      } else if (msg.startsWith('合并:')) {
        console.log('  ' + chalk.yellow('⚠ ') + msg);
      } else if (msg.startsWith('重复:')) {
        console.log('  ' + chalk.gray('› ') + msg);
      } else {
        console.log('  ' + chalk.red('✗ ') + msg);
      }
    }
  }
}

export async function runMatching(buyerId?: string, sellerId?: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('🔍 开始撮合匹配...'));
  console.log('');
  
  let results: MatchResult[];
  
  try {
    if (buyerId) {
      results = await matcher.matchByBuyer(buyerId);
    } else if (sellerId) {
      results = await matcher.matchBySeller(sellerId);
    } else {
      results = await matcher.matchAll();
    }
    
    const matchableResults = results.filter(r => r.canBeMatched);
    const unmatchableResults = results.filter(r => !r.canBeMatched);
    
    console.log(chalk.bold('📊 撮合结果统计'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  可匹配: ${chalk.green(matchableResults.length)} 对`);
    console.log(`  不可匹配: ${chalk.red(unmatchableResults.length)} 对`);
    console.log('');
    
    if (matchableResults.length > 0) {
      console.log(chalk.bold.green('✨ 可匹配推荐'));
      console.log(chalk.gray('─'.repeat(60)));
      
      for (let i = 0; i < Math.min(5, matchableResults.length); i++) {
        printMatchResult(matchableResults[i], i + 1, true);
      }
      
      if (matchableResults.length > 5) {
        console.log(chalk.gray(`\n  ...还有 ${matchableResults.length - 5} 个匹配结果\n`));
      }
    }
    
    if (unmatchableResults.length > 0) {
      console.log(chalk.bold.red('❌ 不可匹配（原因分析）'));
      console.log(chalk.gray('─'.repeat(60)));
      
      for (let i = 0; i < Math.min(3, unmatchableResults.length); i++) {
        printMatchResult(unmatchableResults[i], i + 1, false);
      }
      
      if (unmatchableResults.length > 3) {
        console.log(chalk.gray(`\n  ...还有 ${unmatchableResults.length - 3} 个不匹配结果`));
      }
    }
    
    if (results.length === 0) {
      console.log(chalk.yellow('⚠  没有足够的数据进行撮合。请先导入卖家清单和买家需求。'));
    }
  } catch (error) {
    console.error(chalk.red(`❌ 撮合失败: ${error}`));
    process.exit(1);
  }
}

function printMatchResult(result: MatchResult, index: number, isMatchable: boolean): void {
  const statusColor = isMatchable ? chalk.green : chalk.red;
  const statusIcon = isMatchable ? '✓' : '✗';
  
  console.log('\n' + statusColor(`${statusIcon} #${index}`));
  console.log(`  课程: ${chalk.cyan(result.courseName)}`);
  console.log(`  书名: ${chalk.bold(result.bookTitle)}`);
  console.log(`  买家: ${chalk.blue(result.buyerName)} → 卖家: ${chalk.magenta(result.sellerName)}`);
  console.log(`  价格: ¥${result.sellerPrice} (预算¥${result.buyerPrice})`);
  console.log(`  版本: 买家要第${result.buyerEdition}版 / 卖家有第${result.sellerEdition}版`);
  console.log(`  取书地点: ${result.sellerLocation}`);
  
  if (isMatchable) {
    console.log(`  ${chalk.green(`匹配度: ${result.matchScore}%`)}`);
    console.log('');
    console.log(chalk.gray('  ') + result.explanation.replace(/\n/g, '\n  '));
  } else {
    console.log(`  ${chalk.red('不可交易')}`);
    console.log('');
    console.log(chalk.gray('  ') + result.explanation.replace(/\n/g, '\n  '));
    
    if (result.missingConditions.length > 1) {
      console.log('');
      console.log(chalk.yellow('  ⚠  其他问题:'));
      for (let i = 1; i < result.missingConditions.length; i++) {
        console.log(chalk.gray(`     • ${result.missingConditions[i]}`));
      }
    }
  }
}

export async function lockDeal(sellerId: string, buyerId: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('🔒 正在锁定交易...'));
  
  try {
    const result = await dataStore.lockDeal(sellerId, buyerId);
    
    if (result.success) {
      console.log(chalk.green('✓ ' + result.message));
      console.log(chalk.gray('  该书将为您保留，其他买家暂时无法锁定'));
    } else {
      console.log(chalk.red('✗ ' + result.message));
    }
  } catch (error) {
    console.error(chalk.red(`❌ 锁定失败: ${error}`));
    process.exit(1);
  }
}

export async function unlockDeal(sellerId: string, buyerId: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('🔓 正在取消锁定...'));
  
  try {
    const result = await dataStore.unlockDeal(sellerId, buyerId);
    
    if (result.success) {
      console.log(chalk.green('✓ ' + result.message));
      console.log(chalk.gray('  该书已回到可撮合池，可以重新匹配'));
    } else {
      console.log(chalk.red('✗ ' + result.message));
    }
  } catch (error) {
    console.error(chalk.red(`❌ 取消锁定失败: ${error}`));
    process.exit(1);
  }
}

export async function exportResults(outputPath: string): Promise<void> {
  await dataStore.init();
  
  console.log(chalk.blue('📤 正在导出撮合结果...'));
  
  try {
    const results = await matcher.matchAll();
    
    const exportData = {
      generatedAt: new Date().toISOString(),
      statistics: {
        total: results.length,
        matchable: results.filter(r => r.canBeMatched).length,
        unmatchable: results.filter(r => !r.canBeMatched).length
      },
      matchableResults: results.filter(r => r.canBeMatched),
      unmatchableResults: results.filter(r => !r.canBeMatched)
    };
    
    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    console.log(chalk.green('✓ 导出成功!'));
    console.log(`  文件: ${chalk.cyan(outputPath)}`);
    console.log(`  可匹配: ${chalk.green(exportData.statistics.matchable)} 对`);
    console.log(`  不可匹配: ${chalk.red(exportData.statistics.unmatchable)} 对`);
  } catch (error) {
    console.error(chalk.red(`❌ 导出失败: ${error}`));
    process.exit(1);
  }
}

export async function listSellers(): Promise<void> {
  await dataStore.init();
  
  const sellers = dataStore.getSellers();
  
  console.log(chalk.bold('📚 卖家清单列表'));
  console.log(chalk.gray('─'.repeat(60)));
  
  if (sellers.length === 0) {
    console.log(chalk.yellow('  暂无卖家数据'));
    return;
  }
  
  for (const seller of sellers) {
    const statusText = seller.status === 'locked' 
      ? chalk.red('🔒 已锁定') 
      : chalk.green('✓ 可交易');
    
    console.log('');
    console.log(`  ID: ${chalk.cyan(seller.id)}`);
    console.log(`  课程: ${seller.courseName}`);
    console.log(`  书名: ${chalk.bold(seller.bookTitle)} (第${seller.edition}版)`);
    console.log(`  价格: ¥${seller.price} | 成色: ${getConditionText(seller.condition)}`);
    console.log(`  取书地点: ${seller.pickupLocation}`);
    console.log(`  卖家: ${seller.sellerName} | 状态: ${statusText}`);
  }
}

export async function listBuyers(): Promise<void> {
  await dataStore.init();
  
  const buyers = dataStore.getBuyers();
  
  console.log(chalk.bold('🛒 买家需求列表'));
  console.log(chalk.gray('─'.repeat(60)));
  
  if (buyers.length === 0) {
    console.log(chalk.yellow('  暂无买家数据'));
    return;
  }
  
  for (const buyer of buyers) {
    const statusText = buyer.status === 'locked' 
      ? chalk.red('🔒 已锁定') 
      : chalk.green('✓ 可匹配');
    
    console.log('');
    console.log(`  ID: ${chalk.cyan(buyer.id)}`);
    console.log(`  课程: ${buyer.courseName}`);
    console.log(`  书名: ${chalk.bold(buyer.bookTitle)} (想要第${buyer.desiredEdition}版)`);
    console.log(`  预算: ¥${buyer.maxPrice} | 可接受成色: ${buyer.acceptableConditions.map(getConditionText).join(', ')}`);
    console.log(`  取书地点: ${buyer.preferredPickupLocations.join(', ')}`);
    console.log(`  买家: ${buyer.buyerName} | 状态: ${statusText}`);
  }
}

function getConditionText(condition: string): string {
  const mapping: Record<string, string> = {
    'new': '全新',
    'like_new': '几乎全新',
    'good': '良好',
    'fair': '一般',
    'poor': '较差'
  };
  return mapping[condition] || condition;
}
