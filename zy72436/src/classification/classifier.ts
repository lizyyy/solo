import { dataStore } from '../store/data-store';
import { TicketRow, ClassificationResult, ProcessingStatus } from '../types';

function determineClass(instrument: string, trackId: string, hasRework: boolean): string {
  const instrumentMap: Record<string, string> = {
    '钢琴': 'A班',
    '小提琴': 'B班',
    '大提琴': 'B班',
    '吉他': 'C班',
    '鼓': 'D班',
    '声乐': 'E班',
    '长笛': 'F班',
    '萨克斯': 'F班',
  };
  
  const baseClass = instrumentMap[instrument] || '待定班';
  
  if (hasRework) {
    return `${baseClass}(待复核)`;
  }
  
  return baseClass;
}

function calculateConfidence(row: TicketRow): number {
  let score = 100;
  
  if (!row.audioFileRemark) score -= 20;
  if (row.trackRemarks.length === 0) score -= 10;
  if (row.trackRemarks.some(r => r.isReworkReason)) score -= 30;
  if (row.rehearsalChanges.length > 0) score -= 5;
  
  return Math.max(0, score);
}

function getBasedOn(row: TicketRow): string[] {
  const basedOn: string[] = [];
  basedOn.push(`乐器: ${row.instrument}`);
  basedOn.push(`轨道: ${row.trackId}`);
  
  if (row.audioFileRemark) {
    basedOn.push(`音频备注: ${row.audioFileRemark}`);
  }
  if (row.trackRemarks.some(r => r.isReworkReason)) {
    basedOn.push('含返工原因，需版权运营复核');
  }
  
  return basedOn;
}

export function recalculateClassification(updatedBy: string): { recalculated: number; skipped: number } {
  const allRows = dataStore.getAllTicketRows();
  let recalculated = 0;
  let skipped = 0;
  
  for (const row of allRows) {
    const hasRework = row.trackRemarks.some(r => r.isReworkReason) ||
      !!(row.audioFileRemark?.includes('返工') || row.audioFileRemark?.includes('重录'));
    
    const className = determineClass(row.instrument, row.trackId, hasRework);
    const confidence = calculateConfidence(row);
    const basedOn = getBasedOn(row);
    
    const result: ClassificationResult = {
      trackId: row.trackId,
      className,
      confidence,
      basedOn,
    };
    
    dataStore.setClassificationResult(row.trackId, result);
    
    let newStatus: ProcessingStatus = row.processingStatus;
    if (row.processingStatus === 'rehearsal_updated' || row.processingStatus === 'audio_remark_added') {
      newStatus = hasRework ? 'pending_review' : 'finalized';
    }
    
    dataStore.updateTicketRow(row.id, {
      currentClass: className,
      processingStatus: newStatus,
      lastUpdatedBy: updatedBy,
    });
    
    recalculated++;
  }
  
  return { recalculated, skipped };
}

export function getClassificationForTrack(trackId: string): ClassificationResult | undefined {
  return dataStore.getClassificationResult(trackId);
}
