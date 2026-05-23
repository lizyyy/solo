const store = require("../store");

class ReportService {
  async generateReconciliationReport() {
    const recons = store.getAllReconciliations();
    const summary = this.calculateSummary(recons);
    return {
      generatedAt: new Date().toISOString(),
      summary,
      details: recons.map(r => r.toJSON())
    };
  }

  async generateCSVReport() {
    const { Parser } = require('json2csv');
    const report = await this.generateReconciliationReport();
    const fields = ['receiptNo', 'memberNo', 'expectedPoints', 'actualPoints', 'pointsDiff', 'status', 'discrepancyTypes', 'reviewer', 'reviewRemark'];
    const parser = new Parser({ fields });
    return parser.parse(report.details);
  }

  calculateSummary(recons) {
    const summary = {
      totalRecords: 0,
      matched: 0,
      discrepancy: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      totalExpectedPoints: 0,
      totalActualPoints: 0,
      totalDifference: 0
    };
    for (const r of recons) {
      summary.totalRecords++;
      summary.totalExpectedPoints += r.expectedPoints;
      summary.totalActualPoints += r.actualPoints;
      summary.totalDifference += r.pointsDiff;
      switch (r.status) {
        case "matched": summary.matched++; break;
        case "discrepancy": summary.discrepancy++; break;
        case "approved": summary.approved++; break;
        case "rejected": summary.rejected++; break;
        default: summary.pending++;
      }
    }
    return summary;
  }
}

module.exports = new ReportService();
