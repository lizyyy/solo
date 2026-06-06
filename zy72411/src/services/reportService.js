const { WeeklyReport } = require('../models/WeeklyReport');
const dataStore = require('./dataStore');

class ReportService {
  static generateWeeklyReport(weekStart, weekEnd, generatedBy) {
    const records = dataStore.readRecords();
    const report = WeeklyReport.generateFromRecords(records, weekStart, weekEnd, generatedBy);
    dataStore.addReport(report);
    return report;
  }

  static generateCurrentWeekReport(generatedBy) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return this.generateWeeklyReport(
      weekStart.toISOString().split('T')[0],
      weekEnd.toISOString().split('T')[0],
      generatedBy
    );
  }

  static getLatestReport() {
    return dataStore.getLatestReport();
  }

  static getReportById(id) {
    return dataStore.getReportById(id);
  }

  static getAllReports() {
    return dataStore.readReports();
  }

  static getReportForStoreManager() {
    const latestReport = this.getLatestReport();
    if (!latestReport) {
      return null;
    }

    return {
      reportId: latestReport.id,
      weekRange: `${latestReport.weekStart} 至 ${latestReport.weekEnd}`,
      generatedAt: latestReport.generatedAt,
      summary: {
        total: latestReport.summary.totalRecords,
        normal: latestReport.summary.normalRecords,
        pendingReview: latestReport.summary.needReviewRecords,
        conflicts: latestReport.summary.conflictRecords,
        supplemented: latestReport.summary.supplementedRecords,
        reviewed: latestReport.summary.reviewedRecords
      },
      highlights: latestReport.highlights,
      attentionItems: latestReport.recordSnapshots
        .filter(r => r.hasConflicts || r.status === 'needs_review')
        .map(r => ({
          songName: r.songName,
          status: r.status,
          hasConflicts: r.hasConflicts,
          lastUpdated: r.updatedAt
        })),
      notes: latestReport.notes
    };
  }

  static getHistoricalRecords() {
    const records = dataStore.readRecords();
    return records
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(r => ({
        id: r.id,
        songName: r.songName,
        liveName: r.liveName,
        copyrightName: r.copyrightName,
        status: r.status,
        remarks: r.remarks,
        licenseRemarks: r.licenseRemarks,
        hasConflicts: r.conflicts && r.conflicts.length > 0,
        unresolvedConflicts: r.conflicts ? r.conflicts.filter(c => !c.resolved).length : 0,
        reviewCount: r.reviewHistory ? r.reviewHistory.length : 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        dataSource: r.dataSource
      }));
  }

  static getStatistics() {
    const records = dataStore.readRecords();
    const reports = dataStore.readReports();

    return {
      totalRecords: records.length,
      byStatus: {
        normal: records.filter(r => r.status === 'normal').length,
        needs_review: records.filter(r => r.status === 'needs_review').length,
        conflict: records.filter(r => r.status === 'conflict').length,
        supplemented: records.filter(r => r.status === 'supplemented').length,
        reviewed: records.filter(r => r.status === 'reviewed').length
      },
      byDataSource: {
        audio_import: records.filter(r => r.dataSource === 'audio_import').length,
        license_page: records.filter(r => r.dataSource === 'license_page').length,
        manual_edit: records.filter(r => r.dataSource === 'manual_edit').length
      },
      totalConflicts: records.reduce((sum, r) => sum + (r.conflicts ? r.conflicts.length : 0), 0),
      resolvedConflicts: records.reduce((sum, r) => sum + (r.conflicts ? r.conflicts.filter(c => c.resolved).length : 0), 0),
      totalReports: reports.length,
      lastReportDate: reports.length > 0 
        ? reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0].generatedAt
        : null
    };
  }
}

module.exports = ReportService;
