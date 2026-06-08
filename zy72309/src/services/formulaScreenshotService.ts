import systemStore from '../store/systemStore';
import { generateId } from '../utils/idGenerator';
import { createAuditLog, appendChangeHistory } from '../utils/auditTrail';
import {
  FormulaScreenshot,
  ErrorExplanation,
  KeyNoteItem,
  DataSource,
  ConflictRecord,
  ConflictType,
  ConflictStatus,
  ConflictEvidence,
  AuditAction
} from '../types';

export class FormulaScreenshotService {
  public uploadFormulaScreenshot(
    batchId: string,
    imageUrl: string,
    description: string,
    formulaText: string,
    uploadedBy: string,
    extractedRemarks: string = '',
    initialKeyNotes: Array<{ content: string; referencedCriterionId?: string }> = []
  ): FormulaScreenshot {
    const keyNotes: KeyNoteItem[] = initialKeyNotes.map(kn => ({
      id: generateId(),
      content: kn.content,
      referencedCriterionId: kn.referencedCriterionId,
      createdBy: uploadedBy,
      createdAt: new Date()
    }));

    const screenshot: FormulaScreenshot = {
      id: generateId(),
      batchId,
      imageUrl,
      description,
      formulaText,
      keyNotes,
      extractedRemarks,
      uploadedBy,
      uploadedAt: new Date(),
      isActive: false
    };

    systemStore.addFormulaScreenshot(screenshot);

    createAuditLog(
      'screenshot',
      screenshot.id,
      AuditAction.UPLOAD,
      uploadedBy,
      `上传旧公式截图: ${description}，包含 ${keyNotes.length} 条关键备注`,
      []
    );

    return screenshot;
  }

  public addKeyNote(
    screenshotId: string,
    content: string,
    createdBy: string,
    referencedCriterionId?: string
  ): KeyNoteItem | null {
    const screenshot = systemStore.getFormulaScreenshotById(screenshotId);
    if (!screenshot) return null;

    const keyNote: KeyNoteItem = {
      id: generateId(),
      content,
      referencedCriterionId,
      createdBy,
      createdAt: new Date()
    };

    systemStore.addKeyNoteToScreenshot(screenshotId, keyNote);

    createAuditLog(
      'screenshot',
      screenshotId,
      AuditAction.UPDATE,
      createdBy,
      `补充关键备注: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
      []
    );

    return keyNote;
  }

  public setActiveScreenshot(id: string, operator: string): void {
    systemStore.setActiveFormulaScreenshot(id);
    createAuditLog(
      'screenshot',
      id,
      AuditAction.UPDATE,
      operator,
      '设置为活跃公式截图',
      []
    );
  }

  public reviewScreenshot(
    id: string,
    reviewedBy: string,
    notes?: string
  ): FormulaScreenshot | null {
    const screenshot = systemStore.getFormulaScreenshotById(id);
    if (!screenshot) return null;

    screenshot.reviewedBy = reviewedBy;
    screenshot.reviewedAt = new Date();
    systemStore.updateFormulaScreenshot(screenshot);

    createAuditLog(
      'screenshot',
      id,
      AuditAction.REVIEW,
      reviewedBy,
      notes || '公式截图已复核',
      []
    );

    return screenshot;
  }

  public getActiveScreenshot(): FormulaScreenshot | undefined {
    return systemStore.getActiveFormulaScreenshot();
  }

  public getAllScreenshots(): FormulaScreenshot[] {
    return systemStore.getFormulaScreenshots();
  }

  public extractKeyNotesFromRemarks(screenshotId: string, operator: string): KeyNoteItem[] {
    const screenshot = systemStore.getFormulaScreenshotById(screenshotId);
    if (!screenshot || !screenshot.extractedRemarks) return [];

    const lines = screenshot.extractedRemarks.split(/[\n；;]/).filter(l => l.trim());
    const newNotes: KeyNoteItem[] = [];

    for (const line of lines) {
      const criterionMatch = line.match(/^\s*\[?([A-Za-z0-9]+)\]?[:：\s]*(.+)$/);
      let referencedCriterionId: string | undefined;
      let content = line.trim();

      if (criterionMatch) {
        referencedCriterionId = criterionMatch[1];
        content = criterionMatch[2].trim();
      }

      if (content.length > 0) {
        const note = this.addKeyNote(screenshotId, content, operator, referencedCriterionId);
        if (note) newNotes.push(note);
      }
    }

    return newNotes;
  }

  public createErrorExplanation(
    batchId: string,
    title: string,
    content: string,
    createdBy: string,
    relatedConflictIds: string[] = []
  ): ErrorExplanation {
    const explanation: ErrorExplanation = {
      id: generateId(),
      batchId,
      title,
      content,
      relatedConflictIds,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      changeHistory: []
    };

    systemStore.addErrorExplanation(explanation);

    createAuditLog(
      'explanation',
      explanation.id,
      AuditAction.CREATE,
      createdBy,
      `创建误差说明: ${title}`,
      []
    );

    return explanation;
  }

  public updateErrorExplanation(
    explanationId: string,
    title: string,
    content: string,
    operator: string
  ): ErrorExplanation | null {
    const explanations = systemStore.getErrorExplanations();
    const explanation = explanations.find(e => e.id === explanationId);
    if (!explanation) return null;

    const changes: any[] = [];
    if (explanation.title !== title) {
      explanation.changeHistory = appendChangeHistory(
        explanation.changeHistory,
        'title',
        explanation.title,
        title,
        operator,
        '更新误差说明标题'
      );
      changes.push({ field: 'title', old: explanation.title, new: title });
    }
    if (explanation.content !== content) {
      explanation.changeHistory = appendChangeHistory(
        explanation.changeHistory,
        'content',
        explanation.content,
        content,
        operator,
        '更新误差说明内容'
      );
      changes.push({ field: 'content' });
    }

    explanation.title = title;
    explanation.content = content;
    explanation.updatedAt = new Date();

    systemStore.updateErrorExplanation(explanation);

    createAuditLog(
      'explanation',
      explanationId,
      AuditAction.UPDATE,
      operator,
      `更新误差说明: ${title}`,
      explanation.changeHistory
    );

    return explanation;
  }

  public getErrorExplanations(): ErrorExplanation[] {
    return systemStore.getErrorExplanations();
  }

  public getErrorExplanationsByBatch(batchId: string): ErrorExplanation[] {
    return systemStore.getErrorExplanationsByBatch(batchId);
  }

  public getKeyNotesByCriterion(criterionId: string): Array<{
    note: KeyNoteItem;
    screenshot: FormulaScreenshot;
  }> {
    const result: Array<{ note: KeyNoteItem; screenshot: FormulaScreenshot }> = [];
    const screenshots = systemStore.getFormulaScreenshots();

    for (const screenshot of screenshots) {
      for (const note of screenshot.keyNotes) {
        if (note.referencedCriterionId === criterionId) {
          result.push({ note, screenshot });
        }
      }
    }

    return result;
  }

  public buildWeightConflictsFromKeyNotes(
    batchId: string,
    weightItems: Array<{ id: string; criterionId: string; criterionName: string; formula?: string }>,
    operator: string
  ): ConflictRecord[] {
    const activeScreenshot = systemStore.getActiveFormulaScreenshot();
    if (!activeScreenshot) return [];

    const conflicts: ConflictRecord[] = [];

    for (const weight of weightItems) {
      const keyNoteHits = activeScreenshot.keyNotes.filter(
        n => n.referencedCriterionId === weight.criterionId
      );

      if (keyNoteHits.length > 0 && weight.formula) {
        const noteContents = keyNoteHits.map(n => n.content).join('; ');
        const conflict: ConflictRecord = {
          id: generateId(),
          type: ConflictType.WEIGHT_FORMULA_MISMATCH,
          relatedEntityType: 'weight',
          relatedEntityId: weight.id,
          title: `${weight.criterionName} 公式备注冲突`,
          description: `评分标准公式与旧公式截图关键备注存在出入，需要确认`,
          originalStatement: `公式表：${weight.formula}；截图备注：${noteContents}`,
          evidence: [
            {
              source: DataSource.WEIGHT_TABLE,
              fieldName: 'formula',
              originalValue: weight.formula,
              currentValue: weight.formula,
              expectedValue: weight.formula,
              actualValue: weight.formula,
              location: `批次: ${batchId}`
            },
            {
              source: DataSource.FORMULA_SCREENSHOT,
              fieldName: 'keyNote',
              originalValue: noteContents,
              currentValue: noteContents,
              expectedValue: noteContents,
              actualValue: noteContents,
              location: `截图: ${activeScreenshot.id}`,
              keyNoteRef: keyNoteHits[0].id
            }
          ],
          status: ConflictStatus.PENDING,
          createdAt: new Date(),
          changeHistory: [],
          nextStepContact: '请联系业务运营确认口径'
        };

        systemStore.addConflictRecord(conflict);
        conflicts.push(conflict);

        createAuditLog(
          'conflict',
          conflict.id,
          AuditAction.CREATE,
          operator,
          `检测到公式备注冲突: ${weight.criterionName}`,
          [],
          conflict.nextStepContact
        );
      }
    }

    return conflicts;
  }
}

export default new FormulaScreenshotService();
