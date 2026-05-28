export function buildFullReport(data, enrichedItems, diversityMetrics, preferenceMetrics, exposureResult, explanations, explanationSummary, pipelineTrace) {
  const diversityScore = diversityMetrics.normalized_entropy * 0.4 + diversityMetrics.coverage * 0.3 + diversityMetrics.freshness.score * 0.3;
  const preferenceScore = preferenceMetrics.match.cosine_similarity;
  const exposureScore = exposureResult.summary.overall_score;
  const overallScore = Math.round((diversityScore * 0.4 + preferenceScore * 0.3 + exposureScore * 0.3) * 1000) / 1000;
  return {
    report_id: `rpt_${Date.now().toString(36)}`,
    generated_at: new Date().toISOString(),
    window: data.timeWindow,
    overall_score: overallScore,
    scores: {
      diversity: Math.round(diversityScore * 1000) / 1000,
      preference: Math.round(preferenceScore * 1000) / 1000,
      exposure: Math.round(exposureScore * 1000) / 1000
    },
    diversity_metrics: diversityMetrics,
    preference_metrics: preferenceMetrics,
    exposure_result: exposureResult,
    explanation_summary: explanationSummary,
    pipeline_trace: pipelineTrace,
    _raw_data: {
      songs: data.songs,
      user_listening: data.userListening,
      rec_list: data.recList,
      skip_records: data.skipRecords,
      enriched_items: enrichedItems,
      explanations: explanations
    },
    _meta: data._meta
  };
}

export function exportReportJSON(report) {
  return JSON.stringify(report, null, 2);
}

export function exportReportCSV(report) {
  const lines = [];
  lines.push('类型,指标,值,来源步骤');
  lines.push(`总分,overall_score,${report.overall_score},综合`);
  lines.push(`多样性,diversity_score,${report.scores.diversity},diversity_metrics`);
  lines.push(`偏好匹配,preference_score,${report.scores.preference},preference_matching`);
  lines.push(`曝光约束,exposure_score,${report.scores.exposure},exposure_constraints`);
  lines.push('');
  lines.push('--- 多样性指标 ---,,,');
  lines.push(`熵值,entropy,${report.diversity_metrics.entropy},diversity_metrics`);
  lines.push(`归一化熵,normalized_entropy,${report.diversity_metrics.normalized_entropy},diversity_metrics`);
  lines.push(`风格覆盖率,coverage,${report.diversity_metrics.coverage},diversity_metrics`);
  lines.push(`新歌比例,freshness_score,${report.diversity_metrics.freshness.score},diversity_metrics`);
  lines.push('');
  lines.push('--- 曝光告警 ---,,,');
  report.exposure_result.warnings.forEach(w => {
    lines.push(`${w.severity},${w.code},${w.title},exposure_constraints`);
  });
  lines.push('');
  lines.push('--- 推荐列表明细 ---,,,');
  lines.push('排名,歌曲ID,标题,风格,热度,推荐原因,用户行为,相关度');
  if (report.explanation_summary) {
    report.pipeline_trace.forEach(step => {
      if (step.step === 'list_explanation' && step.detail_rows) {
        step.detail_rows.forEach(row => {
          lines.push(`${row.rank},${row.song_id},${row.title || ''},${row.reason_code || ''},,${row.reason_text || ''},${row.user_action || ''},${row.relevance_score || ''}`);
        });
      }
    });
  }
  return lines.join('\n');
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildReportTrace(report) {
  return {
    step: 'report_export',
    computed_at: new Date().toISOString(),
    input_refs: report.pipeline_trace.map(s => s.step),
    output: {
      report_id: report.report_id,
      overall_score: report.overall_score,
      scores: report.scores
    }
  };
}
