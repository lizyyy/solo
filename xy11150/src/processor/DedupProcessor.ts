import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { stringify } from 'csv-stringify/sync';
import {
  ShuttleRegistration,
  DuplicateRecord,
  TransferRecord,
  SharedPhoneRecord,
  ProcessResult
} from '../models/ShuttleRegistration';
import { dedupEngine } from '../models/DedupRules';

interface RunHistory {
  runId: string;
  processedAt: string;
  inputFiles: string[];
  recordHashes: string[];
  outputFingerprint: string;
}

export class DedupProcessor {
  private historyDir: string;
  private runId: string;

  constructor(outputDir: string) {
    this.historyDir = path.join(outputDir, '.history');
    this.ensureDirectory(this.historyDir);
    this.runId = this.generateRunId();
  }

  process(records: ShuttleRegistration[], outputDir: string): ProcessResult {
    const transfers = this.detectTransfers(records);
    const sharedPhones = this.detectSharedPhones(records);
    const dedupResult = this.performDeduplication(records);

    this.ensureDirectory(outputDir);
    const outputPath = this.writeOutput(dedupResult.uniqueRecords, outputDir);
    const reportPath = this.writeReport(
      dedupResult.uniqueRecords,
      dedupResult.duplicates,
      transfers,
      sharedPhones,
      outputDir
    );

    this.saveRunHistory(records, outputPath, outputDir);

    return {
      totalRecords: records.length,
      validRecords: dedupResult.uniqueRecords.length,
      duplicateRecords: dedupResult.duplicates,
      transferRecords: transfers,
      sharedPhoneRecords: sharedPhones,
      invalidRecords: [],
      outputPath,
      reportPath,
      runId: this.runId,
      processedAt: new Date()
    };
  }

  private performDeduplication(records: ShuttleRegistration[]): {
    uniqueRecords: ShuttleRegistration[];
    duplicates: DuplicateRecord[];
  } {
    const processedIndices = new Set<number>();
    const uniqueRecords: ShuttleRegistration[] = [];
    const duplicates: DuplicateRecord[] = [];
    const groups = dedupEngine.groupByKey(records);

    for (const [keyStr, group] of groups) {
      if (group.length <= 1) continue;

      const [type, value] = keyStr.split(':');
      const key = { type: type as 'employeeId' | 'phone' | 'nameAndPhone', value };

      const groupIndices = group.map(r => records.indexOf(r));
      const unprocessedCount = groupIndices.filter(i => !processedIndices.has(i)).length;
      if (unprocessedCount <= 1) continue;

      const unprocessedRecords = group.filter((_, idx) => !processedIndices.has(groupIndices[idx]));
      const bestRecord = dedupEngine.selectBestRecord(unprocessedRecords);
      const bestIndex = records.indexOf(bestRecord);

      if (!processedIndices.has(bestIndex)) {
        uniqueRecords.push(bestRecord);
        processedIndices.add(bestIndex);
      }

      const duplicateRecords = unprocessedRecords.filter(r => records.indexOf(r) !== bestIndex);

      if (duplicateRecords.length > 0) {
        duplicates.push({
          original: bestRecord,
          duplicates: duplicateRecords,
          reason: this.getDuplicateReason(key.type),
          key
        });

        for (const dup of duplicateRecords) {
          processedIndices.add(records.indexOf(dup));
        }
      }
    }

    for (let i = 0; i < records.length; i++) {
      if (!processedIndices.has(i)) {
        uniqueRecords.push(records[i]);
        processedIndices.add(i);
      }
    }

    return { uniqueRecords, duplicates };
  }

  private detectTransfers(records: ShuttleRegistration[]): TransferRecord[] {
    const transfers: TransferRecord[] = [];
    const employeeRecords = new Map<string, ShuttleRegistration[]>();

    for (const record of records) {
      const key = dedupEngine.generateEmployeeIdKey(record);
      if (key) {
        if (!employeeRecords.has(key.value)) {
          employeeRecords.set(key.value, []);
        }
        employeeRecords.get(key.value)!.push(record);
      }
    }

    for (const [employeeId, empRecords] of employeeRecords) {
      if (empRecords.length < 2) continue;

      const sorted = [...empRecords].sort((a, b) => {
        const dateA = a.registrationDate || '';
        const dateB = b.registrationDate || '';
        return dateA.localeCompare(dateB);
      });

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];

        if (dedupEngine.detectTransfer(prev, curr)) {
          transfers.push({
            employeeId,
            employeeName: curr.employeeName,
            oldRoute: prev.routeName,
            newRoute: curr.routeName,
            oldBoardingPoint: prev.boardingPoint,
            newBoardingPoint: curr.boardingPoint,
            transferDate: curr.registrationDate || new Date().toISOString().split('T')[0]
          });
        }
      }
    }

    return transfers;
  }

  private detectSharedPhones(records: ShuttleRegistration[]): SharedPhoneRecord[] {
    const phoneGroups = new Map<string, ShuttleRegistration[]>();

    for (const record of records) {
      const phoneKey = dedupEngine.generatePhoneKey(record);
      if (phoneKey) {
        if (!phoneGroups.has(phoneKey.value)) {
          phoneGroups.set(phoneKey.value, []);
        }
        phoneGroups.get(phoneKey.value)!.push(record);
      }
    }

    const sharedPhones: SharedPhoneRecord[] = [];
    for (const [phone, group] of phoneGroups) {
      if (group.length < 2) continue;

      const uniqueEmployees = new Map<string, {
        employeeId: string;
        employeeName: string;
        department: string;
        routeName: string;
      }>();

      for (const record of group) {
        const empId = record.employeeId || `${record.employeeName}:${record.department}`;
        if (!uniqueEmployees.has(empId)) {
          uniqueEmployees.set(empId, {
            employeeId: record.employeeId,
            employeeName: record.employeeName,
            department: record.department,
            routeName: record.routeName
          });
        }
      }

      if (uniqueEmployees.size >= 2) {
        sharedPhones.push({
          phone,
          employees: Array.from(uniqueEmployees.values())
        });
      }
    }

    return sharedPhones;
  }

  private getDuplicateReason(type: string): string {
    const reasons: Record<string, string> = {
      employeeId: '员工编号重复',
      phone: '手机号码重复',
      nameAndPhone: '姓名+手机号码重复'
    };
    return reasons[type] || '重复记录';
  }

  private recordToHash(record: ShuttleRegistration): string {
    const keyData = {
      employeeId: record.employeeId?.trim().toUpperCase(),
      employeeName: record.employeeName?.trim(),
      phone: dedupEngine.normalizePhone(record.phone),
      routeName: record.routeName?.trim().toLowerCase(),
      boardingPoint: record.boardingPoint?.trim().toLowerCase()
    };
    return crypto
      .createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `shuttle_${timestamp}_${random}`;
  }

  private writeOutput(records: ShuttleRegistration[], outputDir: string): string {
    const outputPath = path.join(outputDir, `去重结果_${this.runId}.csv`);
    const csvData = records.map(r => ({
      '员工编号': r.employeeId,
      '员工姓名': r.employeeName,
      '部门': r.department,
      '手机号': r.phone,
      '线路名称': r.routeName,
      '上车点': r.boardingPoint,
      '发车时间': r.boardingTime,
      '报名日期': r.registrationDate,
      '状态': r.status,
      '来源文件': r.sourceFile,
      '行号': r.rowNumber
    }));

    const csv = stringify(csvData, { header: true });
    fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf8');
    return outputPath;
  }

  private writeReport(
    uniqueRecords: ShuttleRegistration[],
    duplicates: DuplicateRecord[],
    transfers: TransferRecord[],
    sharedPhones: SharedPhoneRecord[],
    outputDir: string
  ): string {
    const reportPath = path.join(outputDir, `复核报告_${this.runId}.txt`);
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('企业班车报名去重复核报告');
    lines.push(`运行ID: ${this.runId}`);
    lines.push(`处理时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('【一、总体统计】');
    lines.push(`总记录数: ${uniqueRecords.length + duplicates.reduce((sum, d) => sum + d.duplicates.length, 0)}`);
    lines.push(`去重后有效记录数: ${uniqueRecords.length}`);
    lines.push(`发现重复记录数: ${duplicates.length} 组，共 ${duplicates.reduce((sum, d) => sum + d.duplicates.length, 0)} 条`);
    lines.push(`发现调岗记录数: ${transfers.length} 条`);
    lines.push(`发现多人共用手机号数: ${sharedPhones.length} 个`);
    lines.push('');

    if (duplicates.length > 0) {
      lines.push('【二、重复记录明细】');
      lines.push('');
      for (let i = 0; i < duplicates.length; i++) {
        const dup = duplicates[i];
        lines.push(`第 ${i + 1} 组: ${dup.reason} (${dup.key.value})`);
        lines.push(`  保留记录: ${dup.original.employeeName} (${dup.original.employeeId}) - ${dup.original.routeName} - ${dup.original.sourceFile}:${dup.original.rowNumber}`);
        for (const d of dup.duplicates) {
          lines.push(`  重复记录: ${d.employeeName} (${d.employeeId}) - ${d.routeName} - ${d.sourceFile}:${d.rowNumber}`);
        }
        lines.push('');
      }
    }

    if (transfers.length > 0) {
      lines.push('【三、调岗记录明细】');
      lines.push('');
      for (let i = 0; i < transfers.length; i++) {
        const t = transfers[i];
        lines.push(`${i + 1}. ${t.employeeName} (${t.employeeId})`);
        lines.push(`   原线路: ${t.oldRoute} - ${t.oldBoardingPoint}`);
        lines.push(`   新线路: ${t.newRoute} - ${t.newBoardingPoint}`);
        lines.push(`   调岗日期: ${t.transferDate}`);
        lines.push('');
      }
    }

    if (sharedPhones.length > 0) {
      lines.push('【四、多人共用手机号明细】');
      lines.push('');
      for (let i = 0; i < sharedPhones.length; i++) {
        const sp = sharedPhones[i];
        lines.push(`${i + 1}. 手机号: ${sp.phone}`);
        for (const emp of sp.employees) {
          lines.push(`   - ${emp.employeeName} (${emp.employeeId || '无编号'}) - ${emp.department} - ${emp.routeName}`);
        }
        lines.push('');
      }
    }

    lines.push('【五、线路统计】');
    const routeStats = new Map<string, number>();
    for (const r of uniqueRecords) {
      routeStats.set(r.routeName, (routeStats.get(r.routeName) || 0) + 1);
    }
    for (const [route, count] of Array.from(routeStats.entries()).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${route}: ${count} 人`);
    }
    lines.push('');

    lines.push('='.repeat(60));
    lines.push('报告结束');
    lines.push('='.repeat(60));

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    return reportPath;
  }

  private saveRunHistory(records: ShuttleRegistration[], outputPath: string, outputDir: string): void {
    const historyPath = path.join(this.historyDir, 'run_history.json');
    const recordHashes = records.map(r => this.recordToHash(r));
    const outputFingerprint = fs.existsSync(outputPath)
      ? crypto.createHash('md5').update(fs.readFileSync(outputPath)).digest('hex')
      : '';

    const history: RunHistory = {
      runId: this.runId,
      processedAt: new Date().toISOString(),
      inputFiles: [...new Set(records.map(r => r.sourceFile))],
      recordHashes,
      outputFingerprint
    };

    let allHistory: RunHistory[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        allHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch {
        allHistory = [];
      }
    }

    allHistory.push(history);
    fs.writeFileSync(historyPath, JSON.stringify(allHistory, null, 2), 'utf8');
  }

  findPreviousRun(records: ShuttleRegistration[]): RunHistory | null {
    const historyPath = path.join(this.historyDir, 'run_history.json');
    if (!fs.existsSync(historyPath)) return null;

    try {
      const allHistory: RunHistory[] = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      const currentHashes = new Set(records.map(r => this.recordToHash(r)));

      for (const history of allHistory.reverse()) {
        const historyHashes = new Set(history.recordHashes);
        const intersection = [...currentHashes].filter(h => historyHashes.has(h));
        if (intersection.length / currentHashes.size > 0.7) {
          return history;
        }
      }
    } catch {
    }

    return null;
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
