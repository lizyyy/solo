import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { v4 as uuidv4 } from 'uuid';
import {
  CorrectionRecord,
  CorrectionStatus,
  SourceSystem,
  ImportBadRow,
  VideoInfo,
  UserInfo,
  TrialRule
} from '../types';
import { memoryStorage } from '../storage/memory';
import { correctionService } from './correction';

class ImportExportService {
  async importFromCsv(csvContent: string): Promise<{
    success: number;
    failed: number;
    badRows: ImportBadRow[];
    batchId: string;
  }> {
    const batchId = uuidv4();
    const results: Record<string, unknown>[] = [];
    const badRows: ImportBadRow[] = [];
    let successCount = 0;
    let rowNumber = 0;

    const stream = Readable.from(csvContent);

    await new Promise<void>((resolve) => {
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          rowNumber++;
          results.push({ ...data, rowNumber });
        })
        .on('end', () => {
          resolve();
        });
    });

    for (const row of results) {
      try {
        const { video, user, trialRule, sourceSystem } = this.parseRow(row);

        await correctionService.createCorrection({
          video,
          user,
          trialRule,
          sourceSystem,
          sourceRecordId: String(row.sourceRecordId || ''),
          operatorId: 'system',
          operatorName: '批量导入'
        });

        successCount++;
      } catch (error) {
        const badRow: ImportBadRow = {
          rowNumber: row.rowNumber as number,
          rowData: row,
          errorMessage: error instanceof Error ? error.message : '未知错误',
          importedAt: new Date().toISOString(),
          batchId,
          id: uuidv4()
        };
        badRows.push(badRow);
        await memoryStorage.addBadRow(badRow);
      }
    }

    return {
      success: successCount,
      failed: badRows.length,
      badRows,
      batchId
    };
  }

  private parseRow(row: Record<string, unknown>): {
    video: VideoInfo;
    user: UserInfo;
    trialRule: TrialRule;
    sourceSystem: SourceSystem;
  } {
    const requiredFields = [
      'videoId', 'videoTitle',
      'userId', 'userName', 'userType',
      'ruleId', 'ruleName', 'ruleVersion', 'effectiveTime',
      'sourceSystem'
    ];

    for (const field of requiredFields) {
      if (!row[field]) {
        throw new Error(`缺失必填字段: ${field}`);
      }
    }

    const video: VideoInfo = {
      videoId: String(row.videoId),
      videoTitle: String(row.videoTitle),
      videoDuration: row.videoDuration ? Number(row.videoDuration) : undefined,
      videoCategory: row.videoCategory ? String(row.videoCategory) : undefined
    };

    const userType = String(row.userType) as 'free' | 'paid' | 'vip';
    if (!['free', 'paid', 'vip'].includes(userType)) {
      throw new Error(`无效的用户类型: ${userType}`);
    }

    const user: UserInfo = {
      userId: String(row.userId),
      userName: String(row.userName),
      userType,
      isPaid: userType !== 'free'
    };

    const trialRule: TrialRule = {
      ruleId: String(row.ruleId),
      ruleName: String(row.ruleName),
      ruleVersion: String(row.ruleVersion),
      trialDuration: row.trialDuration ? Number(row.trialDuration) : undefined,
      trialCount: row.trialCount ? Number(row.trialCount) : undefined,
      effectiveTime: String(row.effectiveTime)
    };

    const sourceSystem = String(row.sourceSystem) as SourceSystem;
    if (!Object.values(SourceSystem).includes(sourceSystem)) {
      throw new Error(`无效的来源系统: ${sourceSystem}`);
    }

    return { video, user, trialRule, sourceSystem };
  }

  async exportToCsv(status?: CorrectionStatus, sourceSystem?: SourceSystem): Promise<string> {
    const records = await this.getRecordsForExport(status, sourceSystem);
    const flattenedRecords = records.map(record => this.flattenRecord(record));

    const fields = [
      'id',
      'video.videoId',
      'video.videoTitle',
      'video.videoDuration',
      'video.videoCategory',
      'user.userId',
      'user.userName',
      'user.userType',
      'user.isPaid',
      'trialRule.ruleId',
      'trialRule.ruleName',
      'trialRule.ruleVersion',
      'trialRule.trialDuration',
      'trialRule.trialCount',
      'trialRule.effectiveTime',
      'status',
      'correctionReason',
      'readableReason',
      'sourceSystem',
      'sourceRecordId',
      'conflictInfo.hasConflict',
      'operatorId',
      'operatorName',
      'createdAt',
      'updatedAt',
      'remark'
    ];

    const parser = new Parser({ fields });
    return parser.parse(flattenedRecords);
  }

  private async getRecordsForExport(
    status?: CorrectionStatus,
    sourceSystem?: SourceSystem
  ): Promise<CorrectionRecord[]> {
    const allRecords = await memoryStorage.getAllRecords();
    return allRecords.filter(record => {
      if (status && record.status !== status) return false;
      if (sourceSystem && record.sourceSystem !== sourceSystem) return false;
      return true;
    });
  }

  private flattenRecord(record: CorrectionRecord): Record<string, unknown> {
    return {
      id: record.id,
      'video.videoId': record.video.videoId,
      'video.videoTitle': record.video.videoTitle,
      'video.videoDuration': record.video.videoDuration ?? '',
      'video.videoCategory': record.video.videoCategory ?? '',
      'user.userId': record.user.userId,
      'user.userName': record.user.userName,
      'user.userType': record.user.userType,
      'user.isPaid': record.user.isPaid,
      'trialRule.ruleId': record.trialRule.ruleId,
      'trialRule.ruleName': record.trialRule.ruleName,
      'trialRule.ruleVersion': record.trialRule.ruleVersion,
      'trialRule.trialDuration': record.trialRule.trialDuration ?? '',
      'trialRule.trialCount': record.trialRule.trialCount ?? '',
      'trialRule.effectiveTime': record.trialRule.effectiveTime,
      status: record.status,
      correctionReason: record.correctionReason,
      readableReason: record.readableReason,
      sourceSystem: record.sourceSystem,
      sourceRecordId: record.sourceRecordId ?? '',
      'conflictInfo.hasConflict': record.conflictInfo?.hasConflict ?? false,
      operatorId: record.operatorId ?? '',
      operatorName: record.operatorName ?? '',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      remark: record.remark ?? ''
    };
  }
}

export const importExportService = new ImportExportService();
