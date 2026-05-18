import { loadRecords, normalizeRecord } from './parser.js';
import { validateRecord, validateReviewRound } from './validator.js';

export class Rechecker {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.records = [];
    this.results = [];
    this.summary = null;
  }

  async load(filePath) {
    const rawRecords = await loadRecords(filePath);
    this.records = rawRecords.map(normalizeRecord);
    return this.records.length;
  }

  run() {
    this.results = this.records.map(validateRecord);
    const roundResult = validateReviewRound(this.records);

    if (!roundResult.passed) {
      for (const detail of roundResult.details) {
        const result = this.results.find(r => r.质检编号 === detail.质检编号 && r.复议轮次 === detail.当前轮次);
        if (result) {
          result.轮次继承问题 = roundResult.issues.filter(i => i.includes(detail.质检编号));
          result.通过 = false;
        }
      }
    }

    this.summary = this.generateSummary();
    return this.results;
  }

  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.通过).length;
    const failed = total - passed;
    const hasReview = this.results.filter(r => r.复议状态 && r.复议状态 !== 'pending').length;
    const multiRound = this.results.filter(r => r.复议轮次 > 1).length;

    const scoreIssues = this.results.flatMap(r => r.得分问题 || []);
    const deductionIssues = this.results.flatMap(r => r.扣分项问题 || []);
    const roundIssues = this.results.flatMap(r => r.轮次继承问题 || []);

    return {
      总记录数: total,
      通过数: passed,
      未通过数: failed,
      通过率: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%',
      有复议记录数: hasReview,
      多轮复议记录数: multiRound,
      问题统计: {
        得分不一致问题: scoreIssues.length,
        扣分项同步问题: deductionIssues.length,
        轮次继承问题: roundIssues.length
      },
      未通过编号列表: this.results.filter(r => !r.通过).map(r => r.质检编号)
    };
  }

  getDiffableResults() {
    return this.results.map(r => ({
      质检编号: r.质检编号,
      客服工号: r.客服工号,
      复议轮次: r.复议轮次,
      复议状态: r.复议状态,
      通过: r.通过,
      得分核对: r.得分核对,
      扣分项核对: r.扣分项核对,
      问题数: (r.得分问题?.length || 0) + (r.扣分项问题?.length || 0) + (r.轮次继承问题?.length || 0)
    }));
  }

  getVerboseDetails() {
    return this.results.map(r => ({
      ...r,
      原始记录: undefined,
      得分详情: r.得分详情,
      扣分项详情: r.扣分项详情
    }));
  }
}
