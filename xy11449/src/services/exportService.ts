import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import { LedgerRecord, ExportOptions, ViewFilter, Role, ChangeLog, SourceEvidence } from '../models/types';
import { anonymizeValue } from '../utils/crypto';
import { LedgerService } from './ledgerService';
import { store } from '../store/fileStore';

export class ExportService {
  private static anonymizeRecord(record: LedgerRecord & { evidences?: SourceEvidence[]; changeLogs?: ChangeLog[] }): any {
    const result: any = { ...record };

    if (record.handler) {
      result.handler = anonymizeValue(record.handler, 'name');
    }
    if (record.processor) {
      result.processor = anonymizeValue(record.processor, 'name');
    }

    if (result.evidences) {
      result.evidences = result.evidences.map((e: any) => ({
        ...e,
        importedBy: anonymizeValue(e.importedBy, 'name'),
        rawData: e.rawData?.customerId ? {
          ...e.rawData,
          customerId: anonymizeValue(e.rawData.customerId, 'id')
        } : e.rawData
      }));
    }

    if (result.changeLogs) {
      result.changeLogs = result.changeLogs.map((c: any) => ({
        ...c,
        changedBy: anonymizeValue(c.changedBy, 'name')
      }));
    }

    return result;
  }

  private static filterByRole(records: LedgerRecord[], role: Role): LedgerRecord[] {
    switch (role) {
      case Role.AREA_MANAGER:
        return records;
      case Role.TEAM_LEADER:
        return records;
      case Role.OPERATOR:
        return records.map(r => ({
          ...r,
          sensitiveFields: []
        }));
      case Role.AUDITOR:
        return records;
      default:
        return records;
    }
  }

  static export(
    options: ExportOptions,
    viewFilter?: ViewFilter,
    role?: Role
  ): {
    data: any[];
    format: string;
    filename: string;
  } {
    let records = LedgerService.listRecords(viewFilter);

    records = records.filter(r => r.status === 'frozen' || r.status === 'archived');

    if (role) {
      records = this.filterByRole(records, role);
    }

    let exportData = records.map(record => {
      const details = LedgerService.getRecordWithDetails(record.id);
      const result: any = { ...record };

      if (options.includeEvidence && details) {
        result.evidences = details.evidences;
      }
      if (options.includeChangeLogs && details) {
        result.changeLogs = details.changeLogs;
      }

      return result;
    });

    if (options.anonymize) {
      exportData = exportData.map(this.anonymizeRecord);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let filename = `ledger_export_${timestamp}`;
    let formattedData: any[] = exportData;

    if (options.format === 'csv') {
      const parser = new Parser();
      const csvData = exportData.map((r: any) => ({
        id: r.id,
        factKey: r.factKey,
        pileId: r.pileId,
        status: r.status,
        faultStatus: r.faultStatus,
        faultStartTime: r.faultStartTime,
        faultEndTime: r.faultEndTime,
        faultDuration: r.faultDuration,
        faultType: r.faultType,
        faultDescription: r.faultDescription,
        handler: r.handler,
        area: r.area,
        evidenceCount: r.evidences?.length || 0,
        createdAt: r.createdAt,
        isManuallyModified: r.isManuallyModified,
        version: r.version
      }));
      filename += '.csv';
      formattedData = [parser.parse(csvData)];
    } else {
      filename += '.json';
    }

    return {
      data: formattedData,
      format: options.format,
      filename
    };
  }

  static exportToFile(
    options: ExportOptions,
    outputDir: string,
    viewFilter?: ViewFilter,
    role?: Role
  ): string {
    const exportResult = this.export(options, viewFilter, role);
    const filePath = path.join(outputDir, exportResult.filename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (exportResult.format === 'csv') {
      fs.writeFileSync(filePath, exportResult.data[0]);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(exportResult.data, null, 2));
    }

    return filePath;
  }

  static generateReport(viewFilter?: ViewFilter): {
    summary: any;
    topFaults: Array<{ type: string; count: number; duration: number }>;
    byArea: any;
    changes: Array<{ recordId: string; field: string; reason: string; changedAt: string }>;
  } {
    const records = LedgerService.listRecords(viewFilter);
    const stats = LedgerService.getStatistics(viewFilter);

    const faultTypeStats: Record<string, { count: number; duration: number }> = {};
    for (const record of records) {
      if (!faultTypeStats[record.faultType]) {
        faultTypeStats[record.faultType] = { count: 0, duration: 0 };
      }
      faultTypeStats[record.faultType].count += 1;
      faultTypeStats[record.faultType].duration += record.faultDuration;
    }

    const topFaults = Object.entries(faultTypeStats)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const manualChanges: Array<{ recordId: string; field: string; reason: string; changedAt: string }> = [];
    for (const record of records) {
      if (record.isManuallyModified) {
        const changeLogs = store.getChangeLogsForRecord(record.id);
        for (const log of changeLogs) {
          if (log.isManualOverride) {
            manualChanges.push({
              recordId: record.id,
              field: log.field,
              reason: log.changeReason,
              changedAt: log.changedAt
            });
          }
        }
      }
    }

    return {
      summary: {
        ...stats,
        manuallyModified: records.filter(r => r.isManuallyModified).length
      },
      topFaults,
      byArea: stats.byArea,
      changes: manualChanges.sort((a, b) => 
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
      )
    };
  }

  static getRecordForView(id: string, role: Role): any {
    const details = LedgerService.getRecordWithDetails(id);
    if (!details) return undefined;

    let result: any = { ...details };

    if (role === Role.OPERATOR) {
      result.record = {
        ...result.record,
        handler: result.record.handler ? anonymizeValue(result.record.handler, 'name') : undefined,
        processor: result.record.processor ? anonymizeValue(result.record.processor, 'name') : undefined
      };
    }

    if (role === Role.AREA_MANAGER) {
      result.diffSummary = result.changeLogs
        .filter((c: ChangeLog) => c.isManualOverride)
        .map((c: ChangeLog) => ({
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          reason: c.changeReason,
          changedBy: c.changedBy,
          changedAt: c.changedAt
        }));
    }

    return result;
  }
}
