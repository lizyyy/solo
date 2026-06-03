import { WeightRow, MatrixConditionResult, UnifiedResult } from '../types';

export class UnifiedResultSource {
  private rows: WeightRow[] = [];
  private matrixResult: MatrixConditionResult | null = null;

  setData(rows: WeightRow[], matrixResult: MatrixConditionResult | null): void {
    this.rows = rows;
    this.matrixResult = matrixResult;
  }

  getRows(): WeightRow[] {
    return [...this.rows];
  }

  getMatrixResult(): MatrixConditionResult | null {
    return this.matrixResult ? { ...this.matrixResult } : null;
  }

  getUnifiedResult(): UnifiedResult {
    const warningCount = this.rows.filter(r => r.status === 'warning').length;
    const errorCount = this.rows.filter(r => r.status === 'error').length;
    const needsReviewCount = this.rows.filter(r => r.status === 'needs_review').length;

    return {
      rows: this.getRows(),
      matrixResult: this.getMatrixResult(),
      summary: {
        totalRows: this.rows.length,
        warningCount,
        errorCount,
        needsReviewCount
      },
      exportTime: new Date()
    };
  }

  getRowsForDisplay(): WeightRow[] {
    return this.getRows();
  }

  getRowsForExport(): WeightRow[] {
    return this.getRows();
  }

  getRowsForAPI(): WeightRow[] {
    return this.getRows();
  }
}

export const unifiedResultSource = new UnifiedResultSource();
