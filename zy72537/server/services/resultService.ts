import { v4 as uuidv4 } from 'uuid';
import { CheckRecord, ExportDetail } from '../../shared/types';
import { dataStore } from '../store/dataStore';
import { selfCheckService } from './selfCheckService';

export class ResultService {
  getUnifiedResult(recordId: string): CheckRecord | undefined {
    return dataStore.getRecordById(recordId);
  }

  getAllUnifiedResults(): CheckRecord[] {
    return dataStore.getAllRecords();
  }

  generateExportDetails(): ExportDetail[] {
    const records = dataStore.getAllRecords();
    return records.map(record => this.mapToExportDetail(record));
  }

  generateExportSnapshot(): string {
    const exportDetails = this.generateExportDetails();
    const exportId = uuidv4();
    dataStore.saveExportSnapshot(exportId, exportDetails);

    const records = dataStore.getAllRecords();
    records.forEach(record => {
      const updatedSelfCheck = record.selfCheckResults.map(check => {
        if (check.type === 'export_consistency') {
          return selfCheckService.verifyExportConsistency(
            this.generateExportDetails(),
            exportDetails
          );
        }
        return check;
      });
      dataStore.updateRecord(record.id, { selfCheckResults: updatedSelfCheck });
    });

    return exportId;
  }

  getExportDetails(exportId: string): ExportDetail[] | undefined {
    return dataStore.getExportSnapshot(exportId);
  }

  getPageDisplayData(): CheckRecord[] {
    return dataStore.getAllRecords();
  }

  getApiResponseData(recordId?: string): CheckRecord | CheckRecord[] | undefined {
    if (recordId) {
      return dataStore.getRecordById(recordId);
    }
    return dataStore.getAllRecords();
  }

  verifyDataConsistency(): {
    isConsistent: boolean;
    details: {
      pageCount: number;
      apiCount: number;
      exportCount: number;
    };
  } {
    const pageData = this.getPageDisplayData();
    const apiData = this.getApiResponseData() as CheckRecord[];
    const exportData = this.generateExportDetails();

    const isConsistent = 
      pageData.length === apiData.length && 
      pageData.length === exportData.length;

    return {
      isConsistent,
      details: {
        pageCount: pageData.length,
        apiCount: apiData.length,
        exportCount: exportData.length,
      },
    };
  }

  private mapToExportDetail(record: CheckRecord): ExportDetail {
    const warningCount = record.selfCheckResults.filter(r => r.status === 'warning').length;
    const errorCount = record.selfCheckResults.filter(r => r.status === 'error').length;
    
    const modelVersionCheck = record.selfCheckResults.find(r => r.type === 'model_version_changed');
    const hasModelVersionWarning = modelVersionCheck?.status === 'warning';
    const modelVersionWarningDetail = hasModelVersionWarning ? modelVersionCheck?.message : undefined;

    return {
      sampleId: record.sampleId,
      sampleName: record.sampleName,
      imageUrl: record.imageUrl,
      caption: record.caption,
      consistencyScore: record.calculationResult.consistencyScore,
      isConsistent: record.calculationResult.isConsistent,
      status: record.status,
      modelVersion: record.modelVersionInfo.version,
      knowledgeLink: record.knowledgeReference?.link,
      ticketNo: record.feedbackTicket?.ticketNo,
      conflictCount: record.conflicts.length,
      selfCheckWarnings: warningCount,
      selfCheckErrors: errorCount,
      hasModelVersionWarning,
      modelVersionWarningDetail,
      updatedAt: record.updatedAt,
    };
  }
}

export const resultService = new ResultService();
