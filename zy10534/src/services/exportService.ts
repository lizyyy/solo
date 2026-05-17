import { createObjectCsvStringifier } from 'csv-writer';
import { ReviewReport, ReviewRecord, EvaluationSample } from '../types';
import { ReviewService } from './reviewService';

export class ExportService {
  static generateBusinessFriendlyReport(report: ReviewReport): any {
    return {
      reportTitle: `模型评测复核报告 - ${report.batchId}`,
      generatedAt: report.generatedAt,
      generatedBy: report.generatedBy,
      统计概览: {
        样本总数: report.summary.totalSamples,
        已复核样本: report.summary.reviewedCount,
        已改判样本: report.summary.revisedCount,
        待复核样本: report.summary.pendingCount,
        原始平均分: Number(report.summary.averageOriginalScore.toFixed(2)),
        改判后平均分: Number(report.summary.averageRevisedScore.toFixed(2)),
        分数变化率: `${(report.summary.scoreChangeRate * 100).toFixed(2)}%`,
        整体分数变化: Number((report.summary.averageRevisedScore - report.summary.averageOriginalScore).toFixed(2))
      },
      改判明细: report.details.map(d => ({
        样本编号: d.sampleId,
        原始分数: d.originalScore,
        改判分数: d.revisedScore,
        分数变化: d.scoreDifference > 0 ? `+${d.scoreDifference}` : d.scoreDifference,
        变化方向: d.scoreDifference > 0 ? '提高' : d.scoreDifference < 0 ? '降低' : '不变',
        改判人: d.reviewer,
        复核意见: d.reviewOpinion,
        改判时间: d.reviewTime
      }))
    };
  }

  static async generateCSVReport(report: ReviewReport): Promise<string> {
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'sampleId', title: '样本编号' },
        { id: 'originalScore', title: '原始分数' },
        { id: 'revisedScore', title: '改判分数' },
        { id: 'scoreDifference', title: '分数变化' },
        { id: 'changeDirection', title: '变化方向' },
        { id: 'reviewer', title: '改判人' },
        { id: 'reviewOpinion', title: '复核意见' },
        { id: 'reviewTime', title: '改判时间' }
      ]
    });

    const records = report.details.map(d => ({
      sampleId: d.sampleId,
      originalScore: d.originalScore,
      revisedScore: d.revisedScore,
      scoreDifference: d.scoreDifference > 0 ? `+${d.scoreDifference}` : d.scoreDifference,
      changeDirection: d.scoreDifference > 0 ? '提高' : d.scoreDifference < 0 ? '降低' : '不变',
      reviewer: d.reviewer,
      reviewOpinion: d.reviewOpinion,
      reviewTime: d.reviewTime.toISOString()
    }));

    const header = `模型评测复核报告,${report.batchId}\n` +
      `生成时间,${report.generatedAt.toISOString()}\n` +
      `生成人,${report.generatedBy}\n` +
      `样本总数,${report.summary.totalSamples}\n` +
      `已复核样本,${report.summary.reviewedCount}\n` +
      `已改判样本,${report.summary.revisedCount}\n` +
      `待复核样本,${report.summary.pendingCount}\n` +
      `原始平均分,${report.summary.averageOriginalScore.toFixed(2)}\n` +
      `改判后平均分,${report.summary.averageRevisedScore.toFixed(2)}\n` +
      `分数变化率,${(report.summary.scoreChangeRate * 100).toFixed(2)}%\n` +
      '\n';

    return header + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  static async exportBatchReport(batchId: string, format: 'json' | 'csv', generatedBy: string) {
    const report = await ReviewService.generateReport(batchId, generatedBy);

    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `评测复核报告_${batchId}_${new Date().toISOString().split('T')[0]}.csv`,
        content: await this.generateCSVReport(report)
      };
    } else {
      return {
        contentType: 'application/json; charset=utf-8',
        filename: `评测复核报告_${batchId}_${new Date().toISOString().split('T')[0]}.json`,
        content: this.generateBusinessFriendlyReport(report)
      };
    }
  }

  static async exportSampleWithReviews(sampleId: string, format: 'json' | 'csv', generatedBy: string) {
    const data = ReviewService.getSampleWithReviews(sampleId);
    if (!data) {
      throw new Error('样本不存在');
    }

    const result = {
      exportTitle: `样本复核详情导出`,
      exportedAt: new Date(),
      exportedBy: generatedBy,
      样本信息: {
        样本编号: data.sample.sampleId,
        所属批次: data.sample.batchId,
        样本内容: data.sample.content,
        模型输出: data.sample.modelOutput,
        期望输出: data.sample.expectedOutput || '无',
        原始分数: data.sample.originalScore,
        当前分数: data.sample.currentScore,
        分数变化: data.sample.currentScore - data.sample.originalScore
      },
      复核记录: data.reviews.map(r => ({
        复核编号: r.reviewId,
        改判人: r.reviewerName,
        复核意见: r.reviewOpinion,
        改判分数: r.revisedScore,
        分数变化: r.scoreDifference,
        变化类型: r.scoreChangeType,
        状态: r.status,
        处理依据: r.processingBasis || '无',
        异常信息: r.exceptionMessage || '无',
        复核时间: r.createdAt
      }))
    };

    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `样本复核详情_${sampleId}_${new Date().toISOString().split('T')[0]}.csv`,
        content: this.sampleDataToCSV(result)
      };
    } else {
      return {
        contentType: 'application/json; charset=utf-8',
        filename: `样本复核详情_${sampleId}_${new Date().toISOString().split('T')[0]}.json`,
        content: result
      };
    }
  }

  private static sampleDataToCSV(data: any): string {
    let csv = '样本复核详情导出\n';
    csv += `导出时间,${data.exportedAt.toISOString()}\n`;
    csv += `导出人,${data.exportedBy}\n\n`;

    csv += '样本信息\n';
    Object.entries(data.样本信息).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });

    csv += '\n复核记录\n';
    csv += '复核编号,改判人,复核意见,改判分数,分数变化,状态,处理依据,异常信息,复核时间\n';

    data.复核记录.forEach((r: any) => {
      csv += `${r.复核编号},${r.改判人},"${r.复核意见}",${r.改判分数 || ''},${r.分数变化 || ''},${r.状态},${r.处理依据},"${r.异常信息}",${r.复核时间.toISOString()}\n`;
    });

    return csv;
  }
}
