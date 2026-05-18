import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { EquityTransaction, ReconciliationResult, ReconciliationType, ProcessSummary, ProcessLog, CliOptions } from '../types';

const ISSUANCE_DELAY_HOURS = 24;

export class ReconciliationService {
  private processLogs: ProcessLog[] = [];
  private verbose: boolean = false;

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  private addLog(兑换码: string, 步骤: string, 详情: string) {
    const log: ProcessLog = {
      兑换码,
      步骤,
      详情,
      时间: new Date().toISOString()
    };
    this.processLogs.push(log);
    if (this.verbose) {
      console.log(`[${log.时间}] ${兑换码} - ${步骤}: ${详情}`);
    }
  }

  async readTransactionsFromDirectory(dirPath: string): Promise<EquityTransaction[]> {
    const allTransactions: EquityTransaction[] = [];
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const transactions = await this.readTransactionsFromFile(filePath);
      allTransactions.push(...transactions);
    }

    return allTransactions;
  }

  private async readTransactionsFromFile(filePath: string): Promise<EquityTransaction[]> {
    const transactions: EquityTransaction[] = [];
    const fileName = path.basename(filePath);
    let lineNumber = 1;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          lineNumber++;
          const transaction: EquityTransaction = {
            兑换码: row['兑换码'] || row['code'] || '',
            用户ID: row['用户ID'] || row['userId'] || '',
            用户名: row['用户名'] || row['userName'] || '',
            兑换时间: row['兑换时间'] || row['exchangeTime'] || '',
            权益名称: row['权益名称'] || row['equityName'] || '',
            权益类型: row['权益类型'] || row['equityType'] || '',
            发放状态: row['发放状态'] || row['issuanceStatus'] || '',
            发放时间: row['发放时间'] || row['issuanceTime'],
            转赠状态: row['转赠状态'] || row['transferStatus'] || '',
            转赠时间: row['转赠时间'] || row['transferTime'],
            冲正状态: row['冲正状态'] || row['reversalStatus'] || '',
            冲正时间: row['冲正时间'] || row['reversalTime'],
            原始文件名: fileName,
            原始行号: lineNumber
          };
          transactions.push(transaction);
        })
        .on('end', () => {
          this.addLog(fileName, '文件读取', `成功读取 ${transactions.length} 条记录`);
          resolve(transactions);
        })
        .on('error', reject);
    });
  }

  checkIssuanceDelay(transaction: EquityTransaction): ReconciliationResult | null {
    this.addLog(transaction.兑换码, '发放延迟检查', `发放状态: ${transaction.发放状态}, 兑换时间: ${transaction.兑换时间}`);

    if (transaction.发放状态 !== '已发放') {
      const exchangeTime = new Date(transaction.兑换时间);
      const now = new Date();
      const hoursDiff = (now.getTime() - exchangeTime.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > ISSUANCE_DELAY_HOURS) {
        this.addLog(transaction.兑换码, '发放延迟检查', `检测到发放延迟: ${hoursDiff.toFixed(1)}小时 > ${ISSUANCE_DELAY_HOURS}小时`);
        return {
          兑换码: transaction.兑换码,
          用户ID: transaction.用户ID,
          用户名: transaction.用户名,
          权益名称: transaction.权益名称,
          冲正类型: ReconciliationType.发放延迟,
          问题描述: `兑换后超过${ISSUANCE_DELAY_HOURS}小时仍未发放，当前状态：${transaction.发放状态}`,
          兑换时间: transaction.兑换时间,
          原始文件名: transaction.原始文件名,
          原始行号: transaction.原始行号,
          核对时间: new Date().toISOString(),
          处理建议: '建议人工确认发放情况，如确认发放失败则执行冲正操作'
        };
      }
    }
    return null;
  }

  checkCodeTransferred(transaction: EquityTransaction): ReconciliationResult | null {
    this.addLog(transaction.兑换码, '转赠检查', `转赠状态: ${transaction.转赠状态}`);

    if (transaction.转赠状态 === '已转赠') {
      this.addLog(transaction.兑换码, '转赠检查', '检测到兑换码已被转赠');
      return {
        兑换码: transaction.兑换码,
        用户ID: transaction.用户ID,
        用户名: transaction.用户名,
        权益名称: transaction.权益名称,
        冲正类型: ReconciliationType.码被转赠,
        问题描述: `兑换码已被转赠，转赠时间：${transaction.转赠时间 || '未知'}`,
        兑换时间: transaction.兑换时间,
        原始文件名: transaction.原始文件名,
        原始行号: transaction.原始行号,
        核对时间: new Date().toISOString(),
        处理建议: '建议核实转赠是否合规，如存在异常则执行冲正操作'
      };
    }
    return null;
  }

  checkDuplicateReversal(transactions: EquityTransaction[]): ReconciliationResult[] {
    const results: ReconciliationResult[] = [];
    const codeCount = new Map<string, EquityTransaction[]>();

    for (const tx of transactions) {
      if (tx.冲正状态 === '已冲正') {
        if (!codeCount.has(tx.兑换码)) {
          codeCount.set(tx.兑换码, []);
        }
        codeCount.get(tx.兑换码)!.push(tx);
      }
    }

    for (const [code, txList] of codeCount.entries()) {
      if (txList.length > 1) {
        this.addLog(code, '重复冲正检查', `检测到 ${txList.length} 次冲正记录`);
        for (let i = 1; i < txList.length; i++) {
          const tx = txList[i];
          results.push({
            兑换码: tx.兑换码,
            用户ID: tx.用户ID,
            用户名: tx.用户名,
            权益名称: tx.权益名称,
            冲正类型: ReconciliationType.重复冲正,
            问题描述: `该兑换码已被冲正 ${txList.length} 次，此为第 ${i + 1} 次重复冲正`,
            兑换时间: tx.兑换时间,
            原始文件名: tx.原始文件名,
            原始行号: tx.原始行号,
            核对时间: new Date().toISOString(),
            处理建议: '建议核查重复冲正原因，撤销多余的冲正记录'
          });
        }
      }
    }

    return results;
  }

  reconcile(transactions: EquityTransaction[]): { results: ReconciliationResult[], summary: ProcessSummary } {
    const startTime = Date.now();
    const results: ReconciliationResult[] = [];

    this.addLog('系统', '核对开始', `开始核对 ${transactions.length} 条记录`);

    for (const tx of transactions) {
      const delayResult = this.checkIssuanceDelay(tx);
      if (delayResult) results.push(delayResult);

      const transferResult = this.checkCodeTransferred(tx);
      if (transferResult) results.push(transferResult);
    }

    const duplicateResults = this.checkDuplicateReversal(transactions);
    results.push(...duplicateResults);

    const summary: ProcessSummary = {
      输入文件数: new Set(transactions.map(t => t.原始文件名)).size,
      总记录数: transactions.length,
      需冲正记录数: results.length,
      发放延迟数: results.filter(r => r.冲正类型 === ReconciliationType.发放延迟).length,
      码被转赠数: results.filter(r => r.冲正类型 === ReconciliationType.码被转赠).length,
      重复冲正数: results.filter(r => r.冲正类型 === ReconciliationType.重复冲正).length,
      核对时间: new Date().toISOString(),
      耗时毫秒: Date.now() - startTime
    };

    this.addLog('系统', '核对完成', `发现 ${results.length} 条需要冲正的记录`);
    return { results, summary };
  }

  async writeResults(results: ReconciliationResult[], summary: ProcessSummary, outputDir: string, force: boolean = false) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const resultFile = path.join(outputDir, `冲正核对结果_${timestamp}.csv`);
    const summaryFile = path.join(outputDir, `核对摘要_${timestamp}.json`);
    const logFile = path.join(outputDir, `处理日志_${timestamp}.json`);

    if (fs.existsSync(resultFile) && !force) {
      const existingResults = await this.readExistingResults(resultFile);
      const existingCodes = new Set(existingResults.map(r => `${r.兑换码}-${r.冲正类型}-${r.原始文件名}-${r.原始行号}`));
      
      const newResults = results.filter(r => {
        const key = `${r.兑换码}-${r.冲正类型}-${r.原始文件名}-${r.原始行号}`;
        return !existingCodes.has(key);
      });

      this.addLog('系统', '幂等性检查', `已存在 ${existingResults.length} 条记录，新增 ${newResults.length} 条记录`);
      
      if (newResults.length > 0) {
        const allResults = [...existingResults, ...newResults];
        await this.writeResultsToCsv(allResults, resultFile);
      }
    } else {
      await this.writeResultsToCsv(results, resultFile);
    }

    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
    fs.writeFileSync(logFile, JSON.stringify(this.processLogs, null, 2), 'utf-8');

    return { resultFile, summaryFile, logFile };
  }

  private async readExistingResults(filePath: string): Promise<ReconciliationResult[]> {
    const results: ReconciliationResult[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => results.push(row as ReconciliationResult))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private async writeResultsToCsv(results: ReconciliationResult[], filePath: string) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: '兑换码', title: '兑换码' },
        { id: '用户ID', title: '用户ID' },
        { id: '用户名', title: '用户名' },
        { id: '权益名称', title: '权益名称' },
        { id: '冲正类型', title: '冲正类型' },
        { id: '问题描述', title: '问题描述' },
        { id: '兑换时间', title: '兑换时间' },
        { id: '原始文件名', title: '原始文件名' },
        { id: '原始行号', title: '原始行号' },
        { id: '核对时间', title: '核对时间' },
        { id: '处理建议', title: '处理建议' }
      ]
    });
    await csvWriter.writeRecords(results);
  }

  printSummary(summary: ProcessSummary) {
    console.log('\n' + '='.repeat(60));
    console.log('        权益兑换流水兑换码冲正核对报告');
    console.log('='.repeat(60));
    console.log(`核对时间: ${new Date(summary.核对时间).toLocaleString('zh-CN')}`);
    console.log(`处理耗时: ${summary.耗时毫秒} 毫秒`);
    console.log('-'.repeat(60));
    console.log(`输入文件数: ${summary.输入文件数} 个`);
    console.log(`总记录数: ${summary.总记录数} 条`);
    console.log(`需冲正记录: ${summary.需冲正记录数} 条`);
    console.log('-'.repeat(60));
    console.log(`  发放延迟: ${summary.发放延迟数} 条`);
    console.log(`  码被转赠: ${summary.码被转赠数} 条`);
    console.log(`  重复冲正: ${summary.重复冲正数} 条`);
    console.log('='.repeat(60));
    
    if (summary.需冲正记录数 > 0) {
      console.log('\n【重要提示】');
      console.log('请查看输出目录中的冲正核对结果文件，根据处理建议进行人工处理。');
    } else {
      console.log('\n【核对完成】');
      console.log('未发现需要冲正的记录。');
    }
    console.log();
  }

  getProcessLogs(): ProcessLog[] {
    return [...this.processLogs];
  }
}
