import { PileAlarmImporter } from './pileAlarmImporter';
import { InspectionImporter } from './inspectionImporter';
import { ComplaintImporter } from './complaintImporter';
import { DataSource, ImportResult } from '../models/types';

export { PileAlarmImporter, InspectionImporter, ComplaintImporter };

const importers: Record<DataSource, any> = {
  [DataSource.PILE_ALARM]: PileAlarmImporter,
  [DataSource.INSPECTION_FORM]: InspectionImporter,
  [DataSource.CUSTOMER_COMPLAINT]: ComplaintImporter,
  [DataSource.MANUAL_SUPPLEMENT]: null,
  [DataSource.SHIFT_RECORD]: null
};

export function getImporter(sourceType: DataSource) {
  const ImporterClass = importers[sourceType];
  if (!ImporterClass) {
    throw new Error(`不支持的数据源类型: ${sourceType}`);
  }
  return new ImporterClass();
}

export async function importFromSource(
  sourceType: DataSource,
  filePath: string,
  operator: string
): Promise<ImportResult> {
  const importer = getImporter(sourceType);
  return importer.importFile(filePath, operator);
}

export async function importData(
  sourceType: DataSource,
  data: Record<string, any>[],
  sourceName: string,
  operator: string
): Promise<ImportResult> {
  const importer = getImporter(sourceType);
  return importer.importData(data, sourceName, operator);
}
