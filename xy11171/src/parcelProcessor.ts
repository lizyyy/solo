import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import { ParcelRecord, ValidationError, AnomalyRecord, ProcessingResult } from './types';

const REQUIRED_COLUMNS = ['trackingNumber', 'recipient', 'phone', 'status', 'location', 'courier'];

export class ParcelProcessor {
  private seenTrackingNumbers: Set<string> = new Set();

  async processFile(filePath: string): Promise<ProcessingResult> {
    const fileName = path.basename(filePath);
    const result: ProcessingResult = {
      fileName,
      success: false,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      anomalies: [],
      errors: [],
      processedAt: new Date().toISOString(),
    };

    try {
      if (!fs.existsSync(filePath)) {
        result.errors.push({
          type: 'parse_error',
          message: `文件不存在: ${filePath}`,
        });
        return result;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        result.errors.push({
          type: 'empty_file',
          message: '文件为空，没有任何数据',
        });
        return result;
      }

      let content: string;
      try {
        const buffer = fs.readFileSync(filePath);
        content = this.detectAndDecode(buffer);
      } catch (encodingError) {
        result.errors.push({
          type: 'encoding_error',
          message: '文件编码异常，无法解析，请确保使用 UTF-8 或 GBK 编码',
        });
        return result;
      }

      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        result.errors.push({
          type: 'empty_file',
          message: '文件为空，没有任何数据',
        });
        return result;
      }

      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);

      const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        result.errors.push({
          type: 'missing_column',
          message: `缺少必要列: ${missingColumns.join(', ')}`,
        });
        return result;
      }

      const headerIndexMap: Record<string, number> = {};
      headers.forEach((header, index) => {
        headerIndexMap[header] = index;
      });

      this.seenTrackingNumbers.clear();

      for (let i = 1; i < lines.length; i++) {
        result.totalRecords++;
        const line = lines[i];
        const rowNumber = i + 1;

        try {
          const values = this.parseCSVLine(line);
          const record = this.mapToParcelRecord(values, headerIndexMap);

          if (this.seenTrackingNumbers.has(record.trackingNumber)) {
            result.errors.push({
              type: 'duplicate',
              message: `重复的快递单号: ${record.trackingNumber}`,
              row: rowNumber,
              trackingNumber: record.trackingNumber,
            });
            result.invalidRecords++;
            continue;
          }

          this.seenTrackingNumbers.add(record.trackingNumber);

          const anomalies = this.detectAnomalies(record);
          result.anomalies.push(...anomalies);

          result.validRecords++;
        } catch (parseError) {
          result.errors.push({
            type: 'parse_error',
            message: `第 ${rowNumber} 行解析失败: ${(parseError as Error).message}`,
            row: rowNumber,
          });
          result.invalidRecords++;
        }
      }

      result.success = result.errors.filter(e => e.type !== 'parse_error' || result.totalRecords === 0).length === 0;
    } catch (error) {
      result.errors.push({
        type: 'parse_error',
        message: `处理失败: ${(error as Error).message}`,
      });
    }

    return result;
  }

  private detectAndDecode(buffer: Buffer): string {
    const encodings = ['utf-8', 'gbk', 'gb2312', 'big5'];
    
    for (const encoding of encodings) {
      try {
        const decoded = iconv.decode(buffer, encoding);
        if (this.isValidDecoding(decoded)) {
          return decoded;
        }
      } catch {
        continue;
      }
    }

    throw new Error('无法识别文件编码');
  }

  private isValidDecoding(text: string): boolean {
    const badChars = text.match(/[\uFFFD\uFFFE\uFFFF]/g);
    return !badChars || badChars.length / text.length < 0.01;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private mapToParcelRecord(values: string[], headerMap: Record<string, number>): ParcelRecord {
    const getValue = (key: string) => values[headerMap[key]] || '';

    const trackingNumber = getValue('trackingNumber');
    if (!trackingNumber) {
      throw new Error('快递单号不能为空');
    }

    return {
      trackingNumber,
      recipient: getValue('recipient'),
      phone: getValue('phone'),
      pickupTime: getValue('pickupTime'),
      pickupPerson: getValue('pickupPerson'),
      pickupMethod: getValue('pickupMethod'),
      status: getValue('status'),
      location: getValue('location'),
      courier: getValue('courier'),
      notes: getValue('notes'),
    };
  }

  private detectAnomalies(record: ParcelRecord): AnomalyRecord[] {
    const anomalies: AnomalyRecord[] = [];

    if (record.pickupPerson && record.pickupPerson !== record.recipient) {
      const familyKeywords = ['爸', '妈', '哥', '姐', '弟', '妹', '夫', '妻', '儿子', '女儿', '父亲', '母亲', '家人', '家属'];
      const isFamilyPickup = familyKeywords.some(keyword => 
        (record.pickupPerson || '').includes(keyword) || 
        (record.notes || '').includes(keyword) ||
        (record.pickupMethod || '').includes(keyword)
      );

      if (isFamilyPickup || record.pickupPerson !== record.recipient) {
        anomalies.push({
          type: 'family_pickup',
          trackingNumber: record.trackingNumber,
          recipient: record.recipient,
          details: `包裹由 "${record.pickupPerson}" 代取，与收件人 "${record.recipient}" 不一致`,
          suggestion: '建议核实代取人身份信息，补充身份证号或授权证明，完善代取登记流程',
          severity: 'medium',
        });
      }
    }

    if (record.notes && (record.notes.includes('遮挡') || record.notes.includes('模糊') || record.notes.includes('看不清') || record.notes.includes('损坏'))) {
      anomalies.push({
        type: 'label_obscured',
        trackingNumber: record.trackingNumber,
        recipient: record.recipient,
        details: `面单异常: ${record.notes}`,
        suggestion: '建议重新打印面单或使用电子面单，对已损坏的面单进行拍照存档备查',
        severity: 'high',
      });
    }

    if (record.status === '待处理' || record.status === '异常' || !record.pickupTime) {
      anomalies.push({
        type: 'rerun_required',
        trackingNumber: record.trackingNumber,
        recipient: record.recipient,
        details: `当前状态: ${record.status}，缺少取件时间，需要后续跟进`,
        suggestion: '标记为可复跑任务，建议每日定时扫描待处理包裹，更新状态后重新处理',
        severity: 'low',
      });
    }

    return anomalies;
  }

  generateSummaryReport(results: ProcessingResult[]): string {
    const totalFiles = results.length;
    const failedFiles = results.filter(r => !r.success).map(r => r.fileName);
    const processedFiles = totalFiles - failedFiles.length;
    const totalRecords = results.reduce((sum, r) => sum + r.totalRecords, 0);
    const validRecords = results.reduce((sum, r) => sum + r.validRecords, 0);
    const allAnomalies = results.flatMap(r => r.anomalies);
    const allErrors = results.flatMap(r => r.errors);

    const errorsByType: Record<string, number> = {};
    allErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    const familyPickups = allAnomalies.filter(a => a.type === 'family_pickup');
    const labelObscured = allAnomalies.filter(a => a.type === 'label_obscured');
    const rerunRequired = allAnomalies.filter(a => a.type === 'rerun_required');

    let report = '\n';
    report += '═══════════════════════════════════════════════════════════════\n';
    report += '              快递驿站包裹找回 - 处理汇总报告                    \n';
    report += '═══════════════════════════════════════════════════════════════\n\n';

    report += '📊 总体统计\n';
    report += '───────────────────────────────────────────────────────────────\n';
    report += `  总文件数:     ${totalFiles}\n`;
    report += `  成功处理:     ${processedFiles} 个文件\n`;
    report += `  处理失败:     ${failedFiles.length} 个文件\n`;
    if (failedFiles.length > 0) {
      report += `    未处理文件: ${failedFiles.join(', ')}\n`;
    }
    report += `  总记录数:     ${totalRecords}\n`;
    report += `  有效记录:     ${validRecords}\n`;
    report += `  无效记录:     ${totalRecords - validRecords}\n\n`;

    report += '⚠️  异常统计\n';
    report += '───────────────────────────────────────────────────────────────\n';
    report += `  家人代取:     ${familyPickups.length} 条\n`;
    report += `  面单遮挡:     ${labelObscured.length} 条\n`;
    report += `  可复跑任务:   ${rerunRequired.length} 条\n\n`;

    if (Object.keys(errorsByType).length > 0) {
      report += '❌ 错误类型统计\n';
      report += '───────────────────────────────────────────────────────────────\n';
      const errorTypeNames: Record<string, string> = {
        missing_column: '缺少列',
        duplicate: '重复行',
        encoding_error: '编码异常',
        empty_file: '空文件',
        parse_error: '解析错误',
      };
      Object.entries(errorsByType).forEach(([type, count]) => {
        report += `  ${errorTypeNames[type] || type}: ${count} 次\n`;
      });
      report += '\n';
    }

    if (allAnomalies.length > 0) {
      report += '🔍 异常详情及修复建议\n';
      report += '───────────────────────────────────────────────────────────────\n\n';

      if (familyPickups.length > 0) {
        report += '👨‍👩‍👧 家人代取异常 (' + familyPickups.length + '条)\n';
        report += '  问题描述: 包裹由非收件人本人领取，存在代取情况\n';
        report += '  修复建议:\n';
        report += '    1. 完善代取登记制度，要求代取人提供身份证并拍照留证\n';
        report += '    2. 系统中增加"代取人"字段，记录与收件人关系\n';
        report += '    3. 对大额或贵重物品，需电话联系收件人确认授权\n\n';
        report += '  涉及快递单号:\n';
        familyPickups.slice(0, 5).forEach(a => {
          report += `    - ${a.trackingNumber} (${a.recipient} -> ${a.details.split('"')[1]})\n`;
        });
        if (familyPickups.length > 5) {
          report += `    ... 还有 ${familyPickups.length - 5} 条\n`;
        }
        report += '\n';
      }

      if (labelObscured.length > 0) {
        report += '📋 面单遮挡/损坏异常 (' + labelObscured.length + '条)\n';
        report += '  问题描述: 快递面单存在遮挡、模糊或损坏情况\n';
        report += '  修复建议:\n';
        report += '    1. 对所有异常面单进行拍照存档，作为追责依据\n';
        report += '    2. 建议使用电子面单或提高面单打印质量\n';
        report += '    3. 入库时增加面单检查环节，异常情况及时反馈\n\n';
        report += '  涉及快递单号:\n';
        labelObscured.slice(0, 5).forEach(a => {
          report += `    - ${a.trackingNumber} (${a.recipient})\n`;
        });
        if (labelObscured.length > 5) {
          report += `    ... 还有 ${labelObscured.length - 5} 条\n`;
        }
        report += '\n';
      }

      if (rerunRequired.length > 0) {
        report += '🔄 可复跑输出 (' + rerunRequired.length + '条)\n';
        report += '  问题描述: 部分包裹状态异常或缺少关键信息，需要后续跟进\n';
        report += '  修复建议:\n';
        report += '    1. 将这些包裹标记为待处理任务，支持批量复跑\n';
        report += '    2. 建立每日定时扫描机制，自动更新包裹状态\n';
        report += '    3. 导出可复跑清单，交接给当班人员处理\n\n';
        report += '  涉及快递单号:\n';
        rerunRequired.slice(0, 5).forEach(a => {
          report += `    - ${a.trackingNumber} (${a.recipient})\n`;
        });
        if (rerunRequired.length > 5) {
          report += `    ... 还有 ${rerunRequired.length - 5} 条\n`;
        }
        report += '\n';
      }
    }

    report += '═══════════════════════════════════════════════════════════════\n';
    report += '  📌 追责与复盘建议:\n';
    report += '     1. 所有异常记录已包含时间戳和单号信息，可溯源\n';
    report += '     2. 建议每周导出异常报告，进行复盘分析\n';
    report += '     3. 对高频异常问题，优化驿站操作流程\n';
    report += '═══════════════════════════════════════════════════════════════\n';

    return report;
  }
}
