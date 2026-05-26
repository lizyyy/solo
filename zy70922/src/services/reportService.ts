import * as XLSX from 'xlsx';
import { getOne, getAll } from '../database';
import { Reconciliation, SampleRecord, InspectionItem, Discrepancy, ReviewRecord, ReportData } from '../types';

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  matched: '比对通过',
  mismatch: '比对不通过',
  reviewing: '复核中',
  approved: '已放行',
  rejected: '已退回',
  supplement: '需补材料',
};

const ACTION_LABELS: Record<string, string> = {
  approve: '放行',
  reject: '退回',
  supplement: '要求补材料',
};

const DISCREPANCY_TYPE_LABELS: Record<string, string> = {
  mixed_batch: '样品混批',
  retest_window: '复检窗口超时',
  report_withdrawn: '报告撤回',
  project_mismatch: '检测项目不匹配',
  value_out_of_range: '检测值超标',
  duplicate_sample: '重复样品',
  missing_data: '数据缺失',
};

export async function generateReportData(reconciliationId: string): Promise<ReportData> {
  const reconciliation = await getOne<Reconciliation>(
    `SELECT * FROM reconciliations WHERE id = ?`,
    [reconciliationId]
  );

  if (!reconciliation) {
    throw new Error(`对账记录 ${reconciliationId} 不存在`);
  }

  const samples = await getAll<SampleRecord>(
    `SELECT * FROM sample_records WHERE batch_id = ? ORDER BY sample_no`,
    [reconciliation.batch_id]
  );

  const allItems = await getAll<InspectionItem>(
    `SELECT * FROM inspection_items WHERE batch_id = ? ORDER BY sample_no, item_code`,
    [reconciliation.batch_id]
  );

  const allDiscrepancies = await getAll<Discrepancy>(
    `SELECT * FROM discrepancies WHERE reconciliation_id = ? ORDER BY sample_no, severity DESC`,
    [reconciliationId]
  );

  const allReviews = await getAll<ReviewRecord>(
    `SELECT * FROM review_records WHERE reconciliation_id = ? ORDER BY sample_no, created_at DESC`,
    [reconciliationId]
  );

  const reportSamples = samples.map(sample => {
    const items = allItems.filter(i => i.sample_no === sample.sample_no);
    const discrepancies = allDiscrepancies.filter(d => d.sample_no === sample.sample_no);
    const reviews = allReviews.filter(r => r.sample_no === sample.sample_no);

    return {
      sample_no: sample.sample_no,
      status: STATUS_LABELS[sample.status] || sample.status,
      items: items.map(item => ({
        item_name: item.item_name,
        result: item.result === 'pass' ? '合格' : item.result === 'fail' ? '不合格' : '待检',
        is_retest: !!item.is_retest,
      })),
      discrepancies: discrepancies.map(d => ({
        type: DISCREPANCY_TYPE_LABELS[d.type] || d.type,
        description: d.description,
        resolved: !!d.resolved,
      })),
      review_history: reviews.map(r => ({
        action: ACTION_LABELS[r.action] || r.action,
        reviewer: r.reviewer,
        comment: r.comment || '',
        date: r.created_at,
      })),
    };
  });

  const passCount = samples.filter(s => s.status === 'approved' || s.status === 'matched').length;
  const pendingReview = samples.filter(s => s.status === 'mismatch' || s.status === 'reviewing').length;

  return {
    reconciliation_id: reconciliationId,
    generated_at: new Date().toISOString(),
    summary: {
      total_samples: reconciliation.total_samples,
      pass_rate: reconciliation.total_samples > 0
        ? Math.round((passCount / reconciliation.total_samples) * 100)
        : 0,
      discrepancies: reconciliation.discrepancies_count,
      resolved: reconciliation.resolved_discrepancies,
      pending_review: pendingReview,
    },
    samples: reportSamples,
  };
}

export function generateSummaryHtml(reportData: ReportData): string {
  const { summary, samples } = reportData;

  const statusCounts = samples.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>检测对账报告 - ${reportData.reconciliation_id}</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #0066cc; margin-top: 30px; }
    .summary-box { background: #f5f7fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; }
    .summary-item { text-align: center; padding: 15px; background: white; border-radius: 6px; }
    .summary-item .number { font-size: 28px; font-weight: bold; color: #0066cc; }
    .summary-item .label { font-size: 14px; color: #666; margin-top: 5px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-matched { background: #d1ecf1; color: #0c5460; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .status-supplement { background: #fff3cd; color: #856404; }
    .status-mismatch { background: #ffeeba; color: #856404; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px 15px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #0066cc; color: white; }
    tr:hover { background: #f5f7fa; }
    .discrepancy { padding: 8px; margin: 5px 0; border-radius: 4px; font-size: 12px; }
    .discrepancy-high { background: #fdecea; border-left: 3px solid #e74c3c; }
    .discrepancy-medium { background: #fff4e5; border-left: 3px solid #f39c12; }
    .discrepancy-low { background: #e8f4fd; border-left: 3px solid #3498db; }
    .resolved { opacity: 0.6; text-decoration: line-through; }
    .review-history { margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
    .review-entry { margin: 8px 0; padding: 8px; border-left: 3px solid #0066cc; background: white; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h1>检测站对账报告</h1>
  <p><strong>对账ID:</strong> ${reportData.reconciliation_id}</p>
  <p><strong>生成时间:</strong> ${new Date(reportData.generated_at).toLocaleString('zh-CN')}</p>

  <div class="summary-box">
    <h2>汇总统计</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="number">${summary.total_samples}</div>
        <div class="label">样品总数</div>
      </div>
      <div class="summary-item">
        <div class="number">${summary.pass_rate}%</div>
        <div class="label">合格率</div>
      </div>
      <div class="summary-item">
        <div class="number">${summary.discrepancies}</div>
        <div class="label">差异总数</div>
      </div>
      <div class="summary-item">
        <div class="number">${summary.resolved}</div>
        <div class="label">已解决差异</div>
      </div>
      <div class="summary-item">
        <div class="number">${summary.pending_review}</div>
        <div class="label">待复核</div>
      </div>
    </div>
  </div>

  <h2>样品详情</h2>
  <table>
    <thead>
      <tr>
        <th>样品编号</th>
        <th>状态</th>
        <th>检测项目</th>
        <th>差异记录</th>
        <th>复核历史</th>
      </tr>
    </thead>
    <tbody>
      ${samples.map(s => `
      <tr>
        <td><strong>${s.sample_no}</strong></td>
        <td>
          <span class="status-badge status-${s.status === '比对通过' ? 'matched' : s.status === '已放行' ? 'approved' : s.status === '已退回' ? 'rejected' : s.status === '需补材料' ? 'supplement' : 'mismatch'}">
            ${s.status}
          </span>
        </td>
        <td>
          ${s.items.map(i => `
            <div style="margin: 4px 0;">
              ${i.item_name}: 
              <span style="color: ${i.result === '合格' ? '#28a745' : '#dc3545'}; font-weight: bold;">${i.result}</span>
              ${i.is_retest ? '<span style="background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-size: 10px;">复检</span>' : ''}
            </div>
          `).join('')}
        </td>
        <td>
          ${s.discrepancies.length === 0 ? '<span style="color: #28a745;">无差异</span>' : 
            s.discrepancies.map(d => `
              <div class="discrepancy discrepancy-high ${d.resolved ? 'resolved' : ''}">
                <strong>${d.type}:</strong> ${d.description}
                ${d.resolved ? ' <span style="color: #28a745;">(已解决)</span>' : ''}
              </div>
            `).join('')
          }
        </td>
        <td>
          ${s.review_history.length === 0 ? '无复核记录' : `
            <div class="review-history">
              ${s.review_history.map(r => `
                <div class="review-entry">
                  <strong>${r.action}</strong> - ${r.reviewer}
                  <div style="font-size: 11px; color: #999;">${new Date(r.date).toLocaleString('zh-CN')}</div>
                  ${r.comment ? `<div style="margin-top: 4px; font-size: 12px;">${r.comment}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>本报告由检测站对账系统自动生成 | 生成时间: ${new Date(reportData.generated_at).toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>
  `;
}

export function generateExcelReport(reportData: ReportData): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['对账报告汇总'],
    ['对账ID', reportData.reconciliation_id],
    ['生成时间', new Date(reportData.generated_at).toLocaleString('zh-CN')],
    [],
    ['统计项', '数值'],
    ['样品总数', reportData.summary.total_samples],
    ['合格率', `${reportData.summary.pass_rate}%`],
    ['差异总数', reportData.summary.discrepancies],
    ['已解决差异', reportData.summary.resolved],
    ['待复核', reportData.summary.pending_review],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');

  const detailData = [
    ['样品编号', '状态', '检测项目', '结果', '是否复检', '差异类型', '差异描述', '是否已解决', '复核操作', '复核人', '复核备注', '复核时间'],
  ];

  for (const sample of reportData.samples) {
    for (let i = 0; i < Math.max(sample.items.length, sample.discrepancies.length, 1); i++) {
      const item = sample.items[i];
      const discrepancy = sample.discrepancies[i];
      const review = sample.review_history[i];

      detailData.push([
        i === 0 ? sample.sample_no : '',
        i === 0 ? sample.status : '',
        item ? item.item_name : '',
        item ? item.result : '',
        item ? (item.is_retest ? '是' : '否') : '',
        discrepancy ? discrepancy.type : '',
        discrepancy ? discrepancy.description : '',
        discrepancy ? (discrepancy.resolved ? '是' : '否') : '',
        review ? review.action : '',
        review ? review.reviewer : '',
        review ? review.comment : '',
        review ? new Date(review.date).toLocaleString('zh-CN') : '',
      ]);
    }
  }

  const detailWs = XLSX.utils.aoa_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, detailWs, '明细');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateCsvReport(reportData: ReportData): string {
  const headers = ['样品编号', '状态', '检测项目', '结果', '是否复检', '差异类型', '差异描述', '是否已解决'];
  const rows: string[][] = [headers];

  for (const sample of reportData.samples) {
    for (let i = 0; i < Math.max(sample.items.length, sample.discrepancies.length, 1); i++) {
      const item = sample.items[i];
      const discrepancy = sample.discrepancies[i];

      rows.push([
        i === 0 ? sample.sample_no : '',
        i === 0 ? sample.status : '',
        item ? item.item_name : '',
        item ? item.result : '',
        item ? (item.is_retest ? '是' : '否') : '',
        discrepancy ? discrepancy.type : '',
        discrepancy ? discrepancy.description : '',
        discrepancy ? (discrepancy.resolved ? '是' : '否') : '',
      ]);
    }
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
