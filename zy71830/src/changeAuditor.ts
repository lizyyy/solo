import { ChangeRecord, ChangeType, ErrorSource } from './types.js';

export interface ChangeAnalysis {
  totalChanges: number;
  materialOnlyChanges: ChangeRecord[];
  conclusionChanges: ChangeRecord[];
  bySource: Record<ErrorSource, ChangeRecord[]>;
  summary: string;
}

export class ChangeAuditor {
  private changes: ChangeRecord[] = [];
  private materialOnlyFields: Set<string> = new Set([
    'name',
    'description',
    'title',
    'date',
    'id'
  ]);

  setMaterialOnlyFields(fields: string[]): void {
    this.materialOnlyFields = new Set(fields);
  }

  addMaterialOnlyField(field: string): void {
    this.materialOnlyFields.add(field);
  }

  recordChange(change: Omit<ChangeRecord, 'id' | 'timestamp' | 'changeType' | 'affectsConclusion'>): ChangeRecord {
    const affectsConclusion = this.doesAffectConclusion(change.field);
    const changeType: ChangeType = affectsConclusion ? 'conclusion_changed' : 'material_only';

    const record: ChangeRecord = {
      ...change,
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      changeType,
      affectsConclusion
    };

    this.changes.push(record);
    return record;
  }

  private doesAffectConclusion(field: string): boolean {
    const fields = field.split(',').map(f => f.trim());
    return !fields.every(f => this.materialOnlyFields.has(f));
  }

  getAllChanges(): ChangeRecord[] {
    return [...this.changes];
  }

  getChangesByType(changeType: ChangeType): ChangeRecord[] {
    return this.changes.filter(c => c.changeType === changeType);
  }

  getChangesBySource(source: ErrorSource): ChangeRecord[] {
    return this.changes.filter(c => c.source === source);
  }

  getChangesByCategory(category: string): ChangeRecord[] {
    return this.changes.filter(c => c.category === category);
  }

  analyzeChanges(): ChangeAnalysis {
    const materialOnlyChanges = this.getChangesByType('material_only');
    const conclusionChanges = this.getChangesByType('conclusion_changed');

    const bySource: Record<ErrorSource, ChangeRecord[]> = {
      unit_table: [],
      terrain_rule: [],
      battle_report: [],
      system: []
    };

    for (const change of this.changes) {
      bySource[change.source].push(change);
    }

    const summary = this.generateSummary(materialOnlyChanges, conclusionChanges);

    return {
      totalChanges: this.changes.length,
      materialOnlyChanges,
      conclusionChanges,
      bySource,
      summary
    };
  }

  private generateSummary(
    materialOnly: ChangeRecord[],
    conclusion: ChangeRecord[]
  ): string {
    if (this.changes.length === 0) {
      return '暂无变更记录';
    }

    const parts: string[] = [];
    parts.push(`共 ${this.changes.length} 条变更记录`);

    if (materialOnly.length > 0) {
      parts.push(`其中 ${materialOnly.length} 条只是补充材料（不影响结论）`);
    }

    if (conclusion.length > 0) {
      parts.push(`${conclusion.length} 条改动会影响推演结论`);
    }

    return parts.join('，');
  }

  getChangeImpactDescription(change: ChangeRecord): string {
    if (change.changeType === 'material_only') {
      return `【补充材料】${change.description} - 仅完善信息，不影响推演结论`;
    }
    return `【影响结论】${change.description} - 推演结果可能发生变化`;
  }

  explainChange(changeId: string): string | null {
    const change = this.changes.find(c => c.id === changeId);
    if (!change) return null;

    const sourceNames: Record<ErrorSource, string> = {
      unit_table: '单位表',
      terrain_rule: '地形规则',
      battle_report: '战报',
      system: '系统'
    };

    const lines = [
      `变更编号：${change.id}`,
      `变更时间：${new Date(change.timestamp).toLocaleString('zh-CN')}`,
      `变更来源：${sourceNames[change.source]}`,
      `变更类型：${change.changeType === 'material_only' ? '补充材料' : '影响结论'}`,
      `变更字段：${change.field}`,
      `变更描述：${change.description}`,
      `变更人：${change.author}`,
      `旧值：${change.oldValue}`,
      `新值：${change.newValue}`,
      `是否影响结论：${change.affectsConclusion ? '是' : '否'}`
    ];

    return lines.join('\n');
  }

  compareWithBaseline(baselineChanges: ChangeRecord[]): {
    newChanges: ChangeRecord[];
    modifiedInPlace: ChangeRecord[];
  } {
    const baselineIds = new Set(baselineChanges.map(c => c.id));
    
    const newChanges = this.changes.filter(c => !baselineIds.has(c.id));
    const modifiedInPlace: ChangeRecord[] = [];

    return { newChanges, modifiedInPlace };
  }

  getConclusionChangingChanges(): ChangeRecord[] {
    return this.changes.filter(c => c.affectsConclusion);
  }

  hasConclusionChanged(): boolean {
    return this.changes.some(c => c.affectsConclusion);
  }

  clear(): void {
    this.changes = [];
  }

  exportChanges(): ChangeRecord[] {
    return [...this.changes];
  }

  importChanges(changes: ChangeRecord[]): void {
    this.changes = [...changes];
  }
}
