import Dexie, { Table } from 'dexie';
import { GISPoint, ResidentFeedback, InspectionRecord, MergedRecord, Anomaly, ImportFile } from '@/types';

export class InspectionDatabase extends Dexie {
  gisPoints!: Table<GISPoint>;
  residentFeedbacks!: Table<ResidentFeedback>;
  inspectionRecords!: Table<InspectionRecord>;
  mergedRecords!: Table<MergedRecord>;
  anomalies!: Table<Anomaly>;
  importFiles!: Table<ImportFile>;

  constructor() {
    super('CityLightInspectionDB');
    
    this.version(1).stores({
      gisPoints: 'id, lamp_id, address, street, district',
      residentFeedbacks: 'id, feedback_id, lamp_id, address',
      inspectionRecords: 'id, record_id, lamp_id, address',
      mergedRecords: 'id, lamp_id, review_status, match_confidence, merged_at',
      anomalies: 'id, merged_record_id, type, severity',
      importFiles: 'id, type, uploaded_at'
    });
  }

  async clearAllData() {
    await Promise.all([
      this.gisPoints.clear(),
      this.residentFeedbacks.clear(),
      this.inspectionRecords.clear(),
      this.mergedRecords.clear(),
      this.anomalies.clear(),
      this.importFiles.clear()
    ]);
  }
}

export const db = new InspectionDatabase();
