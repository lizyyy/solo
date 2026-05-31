import { BeatRecord, ChangeLog, RecordStatus, RehearsalSummary, SummaryItem } from '../types';
import { generateId } from '../utils/mockData';

export class SummaryService {
  categorizeRecords(records: BeatRecord[]): {
    confirmed: BeatRecord[];
    toFill: BeatRecord[];
    manualEdited: BeatRecord[];
  } {
    return {
      confirmed: records.filter((r) => r.status === RecordStatus.CONFIRMED),
      toFill: records.filter((r) => r.status === RecordStatus.TO_FILL),
      manualEdited: records.filter((r) => r.status === RecordStatus.MANUAL_EDITED),
    };
  }

  generateHandlingCaliber(record: BeatRecord, changeLogs: ChangeLog[]): string {
    switch (record.status) {
      case RecordStatus.CONFIRMED:
        if (changeLogs.length > 0) {
          const lastChange = changeLogs[0];
          return `数据已确认。${lastChange.reason ? `最后变更：${lastChange.reason}` : ''}`;
        }
        return '数据已确认，来源可靠，可作为排练依据。';

      case RecordStatus.TO_FILL:
        if (record.remarks) {
          return `待补充材料：${record.remarks}。请相关人员尽快补全，以免影响排练进度。`;
        }
        return '待补充材料。请核对小节范围、速度等信息，确认后提交。';

      case RecordStatus.MANUAL_EDITED:
        const manualChanges = changeLogs.filter((c) => c.changeType === 'manual');
        if (manualChanges.length > 0) {
          const lastChange = manualChanges[0];
          return `人工修改记录：${lastChange.changedBy} 将${this.getFieldLabel(lastChange.fieldName)}从"${lastChange.oldValue}"改为"${lastChange.newValue}"。原因：${lastChange.reason || '未说明'}。`;
        }
        return '记录有人工修改痕迹，请核对修改内容是否符合实际演奏情况。';

      case RecordStatus.PENDING:
        return '待确认。请声部长或指挥核对数据准确性后确认。';

      default:
        return '请核对记录状态。';
    }
  }

  generateSummary(date: string, records: BeatRecord[], changeLogs: ChangeLog[]): RehearsalSummary {
    const dayRecords = records.filter((r) => r.rehearsalDate === date);
    const categorized = this.categorizeRecords(dayRecords);

    const items: SummaryItem[] = [
      ...categorized.confirmed.map((r) => ({
        id: generateId(),
        recordId: r.id,
        category: RecordStatus.CONFIRMED,
        handlingCaliber: this.generateHandlingCaliber(
          r,
          changeLogs.filter((c) => c.recordId === r.id)
        ),
        remarks: r.remarks,
      })),
      ...categorized.toFill.map((r) => ({
        id: generateId(),
        recordId: r.id,
        category: RecordStatus.TO_FILL,
        handlingCaliber: this.generateHandlingCaliber(
          r,
          changeLogs.filter((c) => c.recordId === r.id)
        ),
        remarks: r.remarks,
      })),
      ...categorized.manualEdited.map((r) => ({
        id: generateId(),
        recordId: r.id,
        category: RecordStatus.MANUAL_EDITED,
        handlingCaliber: this.generateHandlingCaliber(
          r,
          changeLogs.filter((c) => c.recordId === r.id)
        ),
        remarks: r.remarks,
      })),
    ];

    return {
      id: generateId(),
      date,
      totalRecords: dayRecords.length,
      confirmedCount: categorized.confirmed.length,
      toFillCount: categorized.toFill.length,
      manualEditedCount: categorized.manualEdited.length,
      items,
      generatedAt: new Date().toISOString(),
    };
  }

  getStatusLabel(status: RecordStatus): string {
    const labels: Record<RecordStatus, string> = {
      [RecordStatus.CONFIRMED]: '已确认',
      [RecordStatus.PENDING]: '待确认',
      [RecordStatus.TO_FILL]: '待补',
      [RecordStatus.MANUAL_EDITED]: '人工修改',
    };
    return labels[status];
  }

  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      measureStart: '起始小节',
      measureEnd: '结束小节',
      tempo: '速度',
      status: '状态',
      source: '来源',
      remarks: '备注',
    };
    return labels[fieldName] || fieldName;
  }

  exportToMarkdown(summary: RehearsalSummary, records: BeatRecord[]): string {
    const getRecordById = (id: string) => records.find((r) => r.id === id);

    let content = `# 排练小结\n\n`;
    content += `**日期**：${summary.date}\n\n`;
    content += `**生成时间**：${new Date(summary.generatedAt).toLocaleString('zh-CN')}\n\n`;
    
    content += `## 统计概览\n\n`;
    content += `- 总记录数：${summary.totalRecords}\n`;
    content += `- 已确认：${summary.confirmedCount}\n`;
    content += `- 待补：${summary.toFillCount}\n`;
    content += `- 人工修改：${summary.manualEditedCount}\n\n`;

    const byStatus: Record<string, SummaryItem[]> = {
      confirmed: summary.items.filter((i) => i.category === RecordStatus.CONFIRMED),
      toFill: summary.items.filter((i) => i.category === RecordStatus.TO_FILL),
      manual: summary.items.filter((i) => i.category === RecordStatus.MANUAL_EDITED),
    };

    if (byStatus.confirmed.length > 0) {
      content += `## 已确认记录\n\n`;
      byStatus.confirmed.forEach((item) => {
        const r = getRecordById(item.recordId);
        if (r) {
          content += `### ${r.studentName}（${r.sectionName}）\n\n`;
          content += `- 小节范围：${r.measureStart}-${r.measureEnd}\n`;
          content += `- 速度：${r.tempo}\n`;
          content += `- 处理口径：${item.handlingCaliber}\n\n`;
        }
      });
    }

    if (byStatus.toFill.length > 0) {
      content += `## 待补记录\n\n`;
      byStatus.toFill.forEach((item) => {
        const r = getRecordById(item.recordId);
        if (r) {
          content += `### ${r.studentName}（${r.sectionName}）\n\n`;
          content += `- 小节范围：${r.measureStart}-${r.measureEnd}\n`;
          content += `- 处理口径：${item.handlingCaliber}\n\n`;
        }
      });
    }

    if (byStatus.manual.length > 0) {
      content += `## 人工修改记录\n\n`;
      byStatus.manual.forEach((item) => {
        const r = getRecordById(item.recordId);
        if (r) {
          content += `### ${r.studentName}（${r.sectionName}）\n\n`;
          content += `- 小节范围：${r.measureStart}-${r.measureEnd}\n`;
          content += `- 处理口径：${item.handlingCaliber}\n\n`;
        }
      });
    }

    return content;
  }
}

export const summaryService = new SummaryService();
