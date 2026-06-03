import type { InspectionRecord, ProcessState, AuditLogEntry } from '../../shared/types';
import { ProcessStep } from '../../shared/types';
import { ImportService } from './ImportService';
import { CadService } from './CadService';
import { CalculationService } from './CalculationService';
import { ExportService } from './ExportService';
import { AuditLogger } from './AuditLogger';
import { DEMO_PHOTO_NOS, DEMO_CAD_LAYERS } from './mockData';

export class CoreService {
  private records: InspectionRecord[] = [];
  private processState: ProcessState = {
    currentStep: ProcessStep.NOT_STARTED,
    importCompleted: false,
    cadCompleted: false,
    exportCompleted: false,
    activeRecordId: null,
  };

  async runImportDemo(): Promise<InspectionRecord[]> {
    this.processState.currentStep = ProcessStep.IMPORT;
    this.records = await ImportService.importPhotoNumbers(DEMO_PHOTO_NOS);
    this.processState.importCompleted = true;
    return this.records;
  }

  async runCadDemo(): Promise<InspectionRecord[]> {
    if (!this.processState.importCompleted) {
      throw new Error('请先完成第一步：导入巡检照片编号');
    }
    this.processState.currentStep = ProcessStep.CAD_SUPPLEMENT;

    for (const record of this.records) {
      const cadName = DEMO_CAD_LAYERS[record.id];
      if (cadName) {
        CadService.updateCadLayerName(record, cadName, '老梁');
      }
    }

    this.processState.cadCompleted = true;
    return this.records;
  }

  async runExportDemo(): Promise<string> {
    if (!this.processState.cadCompleted) {
      throw new Error('请先完成第二步：补录CAD图层名');
    }
    this.processState.currentStep = ProcessStep.EXPORT;

    const fileName = await ExportService.exportScreenshot(this.records);

    this.processState.exportCompleted = true;
    this.processState.currentStep = ProcessStep.COMPLETED;
    return fileName;
  }

  async runFullDemo(): Promise<{
    records: InspectionRecord[];
    fileName: string;
  }> {
    await this.runImportDemo();
    await this.runCadDemo();
    const fileName = await this.runExportDemo();
    return { records: this.records, fileName };
  }

  importPhotoNumbers(photoNos: string[]): Promise<InspectionRecord[]> {
    this.processState.currentStep = ProcessStep.IMPORT;
    return ImportService.importPhotoNumbers(photoNos).then((records) => {
      this.records = records;
      this.processState.importCompleted = true;
      return records;
    });
  }

  updateCadLayerName(
    recordId: string,
    cadLayerName: string,
    operator: string = '老梁'
  ): InspectionRecord | undefined {
    const record = this.records.find((r) => r.id === recordId);
    if (!record) return undefined;

    CadService.updateCadLayerName(record, cadLayerName, operator);

    const allHaveCad = this.records.every((r) => r.cadLayerName);
    if (allHaveCad) {
      this.processState.cadCompleted = true;
    }

    return record;
  }

  manualCorrect(
    recordId: string,
    correctedLength: number,
    operator: string = '老梁'
  ): InspectionRecord | undefined {
    const record = this.records.find((r) => r.id === recordId);
    if (!record) return undefined;

    CalculationService.manualCorrect(record, correctedLength, operator);
    return record;
  }

  forceRecalculate(
    recordId: string,
    operator: string = '老梁'
  ): InspectionRecord | undefined {
    const record = this.records.find((r) => r.id === recordId);
    if (!record) return undefined;

    CalculationService.forceRecalculate(record, operator);
    return record;
  }

  async exportScreenshot(): Promise<string> {
    this.processState.currentStep = ProcessStep.EXPORT;
    const fileName = await ExportService.exportScreenshot(this.records);
    this.processState.exportCompleted = true;
    this.processState.currentStep = ProcessStep.COMPLETED;
    return fileName;
  }

  getRecords(): InspectionRecord[] {
    return [...this.records];
  }

  getRecordById(id: string): InspectionRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  getLogsByRecordId(recordId: string): AuditLogEntry[] {
    return AuditLogger.getLogsByRecordId(recordId);
  }

  getAllLogs(): AuditLogEntry[] {
    return AuditLogger.getAllLogs();
  }

  getProcessState(): ProcessState {
    return { ...this.processState };
  }

  setActiveRecord(id: string | null): void {
    this.processState.activeRecordId = id;
  }

  reset(): void {
    this.records = [];
    this.processState = {
      currentStep: ProcessStep.NOT_STARTED,
      importCompleted: false,
      cadCompleted: false,
      exportCompleted: false,
      activeRecordId: null,
    };
    AuditLogger.clear();
  }

  setRecords(records: InspectionRecord[]): void {
    this.records = records;
  }

  setProcessState(state: Partial<ProcessState>): void {
    this.processState = { ...this.processState, ...state };
  }
}

export const coreService = new CoreService();
