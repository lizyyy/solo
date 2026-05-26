const { json2csv } = require('json-2-csv');
const { getBatch, listRecords, getSummary } = require('./reconcile');

function buildReport(batchId) {
  const batch = getBatch(batchId);
  if (!batch) throw new Error('批次不存在');

  const records = listRecords(batchId);
  const summary = getSummary(batchId);

  const detailRows = records.map((r) => {
    const violations = JSON.parse(r.raw_violations || '[]');
    const unfixed = violations.filter((v) => !v.fixed).length;
    const recheckPending = violations.filter((v) => v.requires_review && !v.review_pass).length;

    let reviewText = '';
    if (r.review_status === 'pass') {
      reviewText = '复查通过：所有需复验违规已完成复验';
    } else {
      reviewText = `待复查：${recheckPending} 项需复验未通过`;
    }

    let refundText = '';
    if (r.refund_status === 'approve') {
      refundText = `全额退款 ${r.refund_amount} 元`;
    } else if (r.refund_status === 'partial') {
      refundText = `部分退款 ${r.refund_amount} 元（冻结 ${r.freeze_amount} 元）`;
    } else {
      refundText = `驳回：${reviewText}`;
    }

    return {
      apply_no: r.apply_no,
      owner_name: r.owner_name,
      room_no: r.room_no,
      deposit_amount: r.deposit_amount,
      review_status: r.review_status,
      review_explanation: reviewText,
      freeze_amount: r.freeze_amount,
      freeze_explanation: unfixed > 0 ? `${unfixed} 项未整改违规` : '无冻结',
      refund_status: r.refund_status,
      refund_amount: r.refund_amount,
      refund_explanation: refundText,
      diff_explanation: r.diff_explanation,
      review_note: r.review_note || '',
      refund_note: r.refund_note || '',
    };
  });

  return {
    batch,
    summary,
    detail: detailRows,
  };
}

async function exportCsv(batchId) {
  const report = buildReport(batchId);
  const csv = await json2csv(report.detail, {
    keys: [
      'apply_no', 'owner_name', 'room_no', 'deposit_amount',
      'review_status', 'review_explanation',
      'freeze_amount', 'freeze_explanation',
      'refund_status', 'refund_amount', 'refund_explanation',
      'diff_explanation', 'review_note', 'refund_note',
    ],
  });

  const summaryLines = [
    `批次: ${report.batch.name}`,
    `状态: ${report.batch.status}`,
    `总数: ${report.summary.total}`,
    `复查通过: ${report.summary.review.pass}`,
    `待复查: ${report.summary.review.recheck}`,
    `总押金: ${report.summary.amounts.total_deposit}`,
    `总冻结: ${report.summary.amounts.total_freeze}`,
    `总退款: ${report.summary.amounts.total_refund}`,
    `退款通过: ${report.summary.refund.approve}`,
    `部分退款: ${report.summary.refund.partial}`,
    `退款驳回: ${report.summary.refund.reject}`,
    '',
    '=== 明细 ===',
  ];

  return summaryLines.join('\n') + '\n' + csv;
}

async function exportSummaryCsv(batchId) {
  const report = buildReport(batchId);
  const rows = [
    { item: '批次名称', value: report.batch.name },
    { item: '批次状态', value: report.batch.status },
    { item: '记录总数', value: report.summary.total },
    { item: '复查通过', value: report.summary.review.pass },
    { item: '待复查', value: report.summary.review.recheck },
    { item: '总押金', value: report.summary.amounts.total_deposit },
    { item: '总冻结', value: report.summary.amounts.total_freeze },
    { item: '总拟退款', value: report.summary.amounts.total_refund },
    { item: '全额退款户数', value: report.summary.refund.approve },
    { item: '部分退款户数', value: report.summary.refund.partial },
    { item: '退款驳回家数', value: report.summary.refund.reject },
  ];
  return json2csv(rows);
}

module.exports = { buildReport, exportCsv, exportSummaryCsv };
