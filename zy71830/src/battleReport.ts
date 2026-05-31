import { BattleReport, BattlePhase, ValidationError, ChangeRecord } from './types.js';

export class BattleReportManager {
  private reports: Map<string, BattleReport> = new Map();
  private reportHistory: Map<string, BattleReport[]> = new Map();
  private changeRecords: Map<string, ChangeRecord[]> = new Map();

  createReport(report: BattleReport): ValidationError | null {
    const validation = this.validateReport(report);
    if (validation) {
      return validation;
    }

    this.reports.set(report.id, report);
    this.reportHistory.set(report.id, [{ ...report }]);
    this.changeRecords.set(report.id, []);
    return null;
  }

  getReport(id: string): BattleReport | undefined {
    return this.reports.get(id);
  }

  getAllReports(): BattleReport[] {
    return Array.from(this.reports.values());
  }

  getReportHistory(id: string): BattleReport[] | undefined {
    return this.reportHistory.get(id);
  }

  getChangeRecords(id: string): ChangeRecord[] | undefined {
    return this.changeRecords.get(id);
  }

  updateReport(
    id: string,
    updates: Partial<BattleReport>,
    author: string,
    isManualEdit: boolean = false
  ): { success: boolean; error?: ValidationError; changeRecord?: ChangeRecord } {
    const report = this.reports.get(id);
    if (!report) {
      return {
        success: false,
        error: {
          code: 'BATTLE_REPORT_NOT_FOUND',
          message: `Battle report ${id} not found`,
          userMessage: `找不到编号为「${id}」的战报，是不是编号写错了？`,
          source: 'battle_report',
          field: 'id',
          actual: id,
          suggestion: '核对战报编号是否正确',
          responsiblePerson: '玩法策划'
        }
      };
    }

    const oldReport = { ...report };
    const updatedReport = { ...report, ...updates, updatedAt: Date.now() };
    
    if (isManualEdit) {
      updatedReport.isManuallyEdited = true;
    }

    const validation = this.validateReport(updatedReport);
    if (validation) {
      return { success: false, error: validation };
    }

    this.reports.set(id, updatedReport);

    const history = this.reportHistory.get(id);
    if (history) {
      history.push({ ...updatedReport });
    }

    const changeRecord = this.createChangeRecord(oldReport, updatedReport, author, isManualEdit);
    if (changeRecord) {
      const records = this.changeRecords.get(id);
      if (records) {
        records.push(changeRecord);
      }
    }

    return { success: true, changeRecord };
  }

  addPhase(
    reportId: string,
    phase: BattlePhase,
    author: string
  ): { success: boolean; error?: ValidationError } {
    const report = this.reports.get(reportId);
    if (!report) {
      return {
        success: false,
        error: {
          code: 'BATTLE_REPORT_NOT_FOUND',
          message: `Battle report ${reportId} not found`,
          userMessage: `找不到编号为「${reportId}」的战报，没法添加战斗阶段`,
          source: 'battle_report',
          field: 'id',
          actual: reportId,
          suggestion: '先创建战报，再添加战斗阶段',
          responsiblePerson: '玩法策划'
        }
      };
    }

    const oldReport = { ...report };
    report.phases.push(phase);
    report.updatedAt = Date.now();

    const history = this.reportHistory.get(reportId);
    if (history) {
      history.push({ ...report });
    }

    const changeRecord: ChangeRecord = {
      id: `change_${Date.now()}`,
      timestamp: Date.now(),
      changeType: 'conclusion_changed',
      category: 'battle_phase',
      field: 'phases',
      oldValue: `共${oldReport.phases.length}个阶段`,
      newValue: `共${report.phases.length}个阶段`,
      description: `添加了第${phase.phaseNumber}阶段：${phase.action}`,
      source: 'battle_report',
      author,
      affectsConclusion: true
    };

    const records = this.changeRecords.get(reportId);
    if (records) {
      records.push(changeRecord);
    }

    return { success: true };
  }

  private createChangeRecord(
    oldReport: BattleReport,
    newReport: BattleReport,
    author: string,
    isManualEdit: boolean
  ): ChangeRecord | null {
    const changedFields: string[] = [];
    let affectsConclusion = false;

    if (oldReport.title !== newReport.title) {
      changedFields.push('title');
    }
    if (oldReport.winner !== newReport.winner) {
      changedFields.push('winner');
      affectsConclusion = true;
    }
    if (oldReport.summary !== newReport.summary) {
      changedFields.push('summary');
      affectsConclusion = true;
    }

    if (changedFields.length === 0) {
      return null;
    }

    return {
      id: `change_${Date.now()}`,
      timestamp: Date.now(),
      changeType: isManualEdit ? 'conclusion_changed' : 'material_only',
      category: 'battle_report',
      field: changedFields.join(', '),
      oldValue: this.getFieldSummary(oldReport, changedFields),
      newValue: this.getFieldSummary(newReport, changedFields),
      description: isManualEdit ? '玩法策划手动修改了战报内容' : '系统自动更新战报',
      source: 'battle_report',
      author,
      affectsConclusion
    };
  }

  private getFieldSummary(report: BattleReport, fields: string[]): string {
    const summaries: string[] = [];
    if (fields.includes('title')) summaries.push(`标题:${report.title}`);
    if (fields.includes('winner')) summaries.push(`胜者:${report.winner || '未决出'}`);
    if (fields.includes('summary')) summaries.push(`摘要:${report.summary.substring(0, 30)}...`);
    return summaries.join('; ');
  }

  private validateReport(report: BattleReport): ValidationError | null {
    if (!report.id || report.id.trim() === '') {
      return {
        code: 'BATTLE_REPORT_ID_EMPTY',
        message: 'Battle report id is empty',
        userMessage: '战报编号不能为空哦，得给每个战报一个唯一的标识',
        source: 'battle_report',
        field: 'id',
        suggestion: '按照「战役_日期_序号」的格式填写，比如 BATTLE_20240101_001',
        responsiblePerson: '玩法策划'
      };
    }

    if (!report.title || report.title.trim() === '') {
      return {
        code: 'BATTLE_REPORT_TITLE_EMPTY',
        message: 'Battle report title is empty',
        userMessage: `战报「${report.id}」还没有标题，得给它起个名字让大家认识`,
        source: 'battle_report',
        field: 'title',
        suggestion: '比如「赤壁之战」「夷陵突围战」这样有辨识度的名字',
        responsiblePerson: '玩法策划'
      };
    }

    if (!report.date || report.date.trim() === '') {
      return {
        code: 'BATTLE_REPORT_DATE_EMPTY',
        message: 'Battle report date is empty',
        userMessage: `战报「${report.title}」还没有日期，得填上战斗发生的时间`,
        source: 'battle_report',
        field: 'date',
        suggestion: '按照 YYYY-MM-DD 格式填写，比如 2024-01-15',
        responsiblePerson: '玩法策划'
      };
    }

    return null;
  }

  compareVersions(reportId: string, version1: number, version2: number): {
    field: string;
    oldValue: string;
    newValue: string;
    affectsConclusion: boolean;
  }[] | null {
    const history = this.reportHistory.get(reportId);
    if (!history || version1 >= history.length || version2 >= history.length) {
      return null;
    }

    const v1 = history[version1];
    const v2 = history[version2];
    const differences: { field: string; oldValue: string; newValue: string; affectsConclusion: boolean }[] = [];

    if (v1.title !== v2.title) {
      differences.push({ field: '标题', oldValue: v1.title, newValue: v2.title, affectsConclusion: false });
    }
    if (v1.winner !== v2.winner) {
      differences.push({ field: '胜者', oldValue: v1.winner || '未决出', newValue: v2.winner || '未决出', affectsConclusion: true });
    }
    if (v1.summary !== v2.summary) {
      differences.push({ field: '战报摘要', oldValue: v1.summary, newValue: v2.summary, affectsConclusion: true });
    }
    if (v1.phases.length !== v2.phases.length) {
      differences.push({ field: '战斗阶段数', oldValue: `${v1.phases.length}个`, newValue: `${v2.phases.length}个`, affectsConclusion: true });
    }

    return differences;
  }

  getManualEdits(reportId: string): ChangeRecord[] {
    const records = this.changeRecords.get(reportId);
    if (!records) return [];
    return records.filter(r => r.changeType === 'conclusion_changed');
  }

  clear(): void {
    this.reports.clear();
    this.reportHistory.clear();
    this.changeRecords.clear();
  }
}
