import systemStore from '../store/systemStore';
import { ScoringResult, StudentAnswer, ScoringWeightItem } from '../types';

interface ExportRow {
  studentId: string;
  studentName: string;
  submissionId: string;
  totalScore: number;
  isRecalculated: boolean;
  recalculationReason?: string;
  [key: string]: any;
}

export class DataExportService {
  public exportScoringResults(batchId?: string): {
    csvContent: string;
    data: ExportRow[];
  } {
    const results = batchId
      ? systemStore.getScoringResultsByBatch(batchId)
      : systemStore.getScoringResults();

    const data = this.buildExportData(results);
    const csvContent = this.generateCsv(data);

    return { csvContent, data };
  }

  private buildExportData(results: ScoringResult[]): ExportRow[] {
    const allCriteria = this.getAllCriteria(results);

    return results.map(result => {
      const row: ExportRow = {
        studentId: result.studentId,
        studentName: result.studentName,
        submissionId: result.submissionId,
        totalScore: result.totalScore,
        isRecalculated: result.isRecalculated,
        recalculationReason: result.recalculationReason
      };

      allCriteria.forEach(criterion => {
        const detail = result.details.find(d => d.criterionId === criterion.id);
        row[`${criterion.id}_score`] = detail?.score ?? 0;
        row[`${criterion.id}_weighted`] = detail?.weightedScore ?? 0;
        row[`${criterion.id}_maxScore`] = detail?.maxScore ?? criterion.maxScore;
      });

      return row;
    });
  }

  private getAllCriteria(results: ScoringResult[]): Array<{ id: string; name: string; maxScore: number }> {
    const criteriaMap = new Map<string, { id: string; name: string; maxScore: number }>();

    results.forEach(result => {
      result.details.forEach(detail => {
        if (!criteriaMap.has(detail.criterionId)) {
          criteriaMap.set(detail.criterionId, {
            id: detail.criterionId,
            name: detail.criterionName,
            maxScore: detail.maxScore
          });
        }
      });
    });

    return Array.from(criteriaMap.values());
  }

  private generateCsv(data: ExportRow[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');

    const dataRows = data.map(row =>
      headers.map(h => this.escapeCsvValue(row[h])).join(',')
    );

    return [headerRow, ...dataRows].join('\n');
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  }

  public getDisplayData(submissionId?: string): {
    results: ScoringResult[];
    answers: StudentAnswer[];
    weights: ScoringWeightItem[];
  } {
    const weights = systemStore.getActiveScoringWeights();

    if (submissionId) {
      const result = systemStore.getScoringResultBySubmission(submissionId);
      const answer = systemStore.getStudentAnswersBySubmissionId(submissionId);
      return {
        results: result ? [result] : [],
        answers: answer ? [answer] : [],
        weights
      };
    }

    return {
      results: systemStore.getScoringResults(),
      answers: systemStore.getStudentAnswers(),
      weights
    };
  }

  public getApiResponse(submissionId?: string): any {
    const displayData = this.getDisplayData(submissionId);

    if (submissionId) {
      return {
        submissionId,
        result: displayData.results[0] || null,
        answer: displayData.answers[0] || null,
        weights: displayData.weights
      };
    }

    return {
      results: displayData.results,
      weights: displayData.weights,
      summary: {
        totalStudents: displayData.results.length,
        averageScore: this.calculateAverage(displayData.results),
        maxScore: this.calculateMax(displayData.results),
        minScore: this.calculateMin(displayData.results)
      }
    };
  }

  private calculateAverage(results: ScoringResult[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + r.totalScore, 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  private calculateMax(results: ScoringResult[]): number {
    if (results.length === 0) return 0;
    return Math.max(...results.map(r => r.totalScore));
  }

  private calculateMin(results: ScoringResult[]): number {
    if (results.length === 0) return 0;
    return Math.min(...results.map(r => r.totalScore));
  }

  public verifyDataConsistency(submissionId: string): {
    consistent: boolean;
    differences: string[];
  } {
    const { result, answer } = systemStore.getScoringResultBySubmission(submissionId)
      ? {
          result: systemStore.getScoringResultBySubmission(submissionId),
          answer: systemStore.getStudentAnswersBySubmissionId(submissionId)
        }
      : { result: undefined, answer: undefined };

    const differences: string[] = [];

    if (result && answer) {
      if (result.studentId !== answer.studentId) {
        differences.push('学生ID不一致');
      }
      if (result.studentName !== answer.studentName) {
        differences.push('学生姓名不一致');
      }
      if (result.submissionId !== answer.submissionId) {
        differences.push('提交ID不一致');
      }
    }

    const exportData = this.exportScoringResults().data;
    const exportedResult = exportData.find(d => d.submissionId === submissionId);
    const apiResult = this.getApiResponse(submissionId);

    if (exportedResult && result) {
      if (exportedResult.totalScore !== result.totalScore) {
        differences.push('导出数据与存储数据总分不一致');
      }
    }

    if (apiResult.result && result) {
      if (apiResult.result.totalScore !== result.totalScore) {
        differences.push('API返回与存储数据总分不一致');
      }
    }

    return {
      consistent: differences.length === 0,
      differences
    };
  }
}

export default new DataExportService();
