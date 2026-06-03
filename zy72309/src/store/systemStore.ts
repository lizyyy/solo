import {
  SystemState,
  ImportBatch,
  ScoringWeightItem,
  FormulaScreenshot,
  StudentAnswer,
  ScoringResult,
  ConflictRecord,
  ErrorExplanation
} from '../types';

class SystemStore {
  private state: SystemState;
  private static instance: SystemStore;

  private constructor() {
    this.state = {
      weightBatches: [],
      scoringWeights: [],
      formulaScreenshots: [],
      studentAnswers: [],
      scoringResults: [],
      conflictRecords: [],
      errorExplanations: []
    };
  }

  public static getInstance(): SystemStore {
    if (!SystemStore.instance) {
      SystemStore.instance = new SystemStore();
    }
    return SystemStore.instance;
  }

  public getState(): SystemState {
    return { ...this.state };
  }

  public addWeightBatch(batch: ImportBatch): void {
    this.state.weightBatches.push(batch);
  }

  public getWeightBatches(): ImportBatch[] {
    return [...this.state.weightBatches];
  }

  public addScoringWeights(weights: ScoringWeightItem[]): void {
    this.state.scoringWeights.push(...weights);
  }

  public getScoringWeights(): ScoringWeightItem[] {
    return [...this.state.scoringWeights];
  }

  public getActiveScoringWeights(batchId?: string): ScoringWeightItem[] {
    if (batchId) {
      return this.state.scoringWeights.filter(w => w.importBatchId === batchId);
    }
    const latestBatch = this.getLatestWeightBatch();
    if (!latestBatch) return [];
    return this.state.scoringWeights.filter(w => w.importBatchId === latestBatch.id);
  }

  public getLatestWeightBatch(): ImportBatch | undefined {
    const sorted = [...this.state.weightBatches].sort(
      (a, b) => b.importedAt.getTime() - a.importedAt.getTime()
    );
    return sorted[0];
  }

  public addFormulaScreenshot(screenshot: FormulaScreenshot): void {
    this.state.formulaScreenshots.push(screenshot);
  }

  public getFormulaScreenshots(): FormulaScreenshot[] {
    return [...this.state.formulaScreenshots];
  }

  public getActiveFormulaScreenshot(): FormulaScreenshot | undefined {
    return this.state.formulaScreenshots.find(s => s.isActive);
  }

  public setActiveFormulaScreenshot(id: string): void {
    this.state.formulaScreenshots.forEach(s => {
      s.isActive = s.id === id;
    });
  }

  public addStudentAnswer(answer: StudentAnswer): void {
    this.state.studentAnswers.push(answer);
  }

  public getStudentAnswers(): StudentAnswer[] {
    return [...this.state.studentAnswers];
  }

  public getStudentAnswersByStudentId(studentId: string): StudentAnswer[] {
    return this.state.studentAnswers.filter(a => a.studentId === studentId);
  }

  public getStudentAnswersBySubmissionId(submissionId: string): StudentAnswer | undefined {
    return this.state.studentAnswers.find(a => a.submissionId === submissionId);
  }

  public updateStudentAnswer(answer: StudentAnswer): void {
    const index = this.state.studentAnswers.findIndex(a => a.id === answer.id);
    if (index !== -1) {
      this.state.studentAnswers[index] = answer;
    }
  }

  public addScoringResult(result: ScoringResult): void {
    this.state.scoringResults.push(result);
  }

  public getScoringResults(): ScoringResult[] {
    return [...this.state.scoringResults];
  }

  public getScoringResultsByBatch(batchId: string): ScoringResult[] {
    return this.state.scoringResults.filter(r => r.calculationBatchId === batchId);
  }

  public getScoringResultBySubmission(submissionId: string): ScoringResult | undefined {
    return this.state.scoringResults.find(r => r.submissionId === submissionId);
  }

  public updateScoringResult(result: ScoringResult): void {
    const index = this.state.scoringResults.findIndex(r => r.id === result.id);
    if (index !== -1) {
      this.state.scoringResults[index] = result;
    }
  }

  public addConflictRecord(conflict: ConflictRecord): void {
    this.state.conflictRecords.push(conflict);
  }

  public getConflictRecords(): ConflictRecord[] {
    return [...this.state.conflictRecords];
  }

  public getPendingConflicts(): ConflictRecord[] {
    return this.state.conflictRecords.filter(c => c.status === 'pending');
  }

  public updateConflictRecord(conflict: ConflictRecord): void {
    const index = this.state.conflictRecords.findIndex(c => c.id === conflict.id);
    if (index !== -1) {
      this.state.conflictRecords[index] = conflict;
    }
  }

  public addErrorExplanation(explanation: ErrorExplanation): void {
    this.state.errorExplanations.push(explanation);
  }

  public getErrorExplanations(): ErrorExplanation[] {
    return [...this.state.errorExplanations];
  }

  public updateErrorExplanation(explanation: ErrorExplanation): void {
    const index = this.state.errorExplanations.findIndex(e => e.id === explanation.id);
    if (index !== -1) {
      this.state.errorExplanations[index] = explanation;
    }
  }

  public clearAll(): void {
    this.state = {
      weightBatches: [],
      scoringWeights: [],
      formulaScreenshots: [],
      studentAnswers: [],
      scoringResults: [],
      conflictRecords: [],
      errorExplanations: []
    };
  }
}

export default SystemStore.getInstance();
