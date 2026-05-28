const STORAGE_KEY = 'music_diversity_reports';

function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function saveReport(report) {
  const reports = loadReports();
  const entry = {
    report_id: report.report_id,
    generated_at: report.generated_at,
    window_label: report.window?.label || '未命名窗口',
    overall_score: report.overall_score,
    scores: report.scores,
    warning_count: report.exposure_result?.summary?.total || 0,
    critical_count: report.exposure_result?.summary?.critical || 0,
    report_data: report
  };
  reports.unshift(entry);
  if (reports.length > 20) reports.length = 20;
  saveReports(reports);
  return entry;
}

export function listReports() {
  return loadReports().map(entry => ({
    report_id: entry.report_id,
    generated_at: entry.generated_at,
    window_label: entry.window_label,
    overall_score: entry.overall_score,
    warning_count: entry.warning_count,
    critical_count: entry.critical_count
  }));
}

export function loadReport(reportId) {
  const reports = loadReports();
  const entry = reports.find(r => r.report_id === reportId);
  return entry ? entry.report_data : null;
}

export function deleteReport(reportId) {
  const reports = loadReports();
  const filtered = reports.filter(r => r.report_id !== reportId);
  saveReports(filtered);
  return filtered.length < reports.length;
}

export function buildReviewTrace(report) {
  return {
    step: 'review_replay',
    computed_at: new Date().toISOString(),
    input_refs: { report_id: report.report_id },
    output: {
      overall_score: report.overall_score,
      loaded_from: 'localStorage',
      original_generated_at: report.generated_at
    }
  };
}
