import React, { useState } from 'react';
import { WeightRow, WeightRowStatus, WarningType } from '../types';

interface ReviewDetailPanelProps {
  rows: WeightRow[];
  onSubmitReview: (params: {
    rowId: string;
    reason: string;
    nextHandler: string;
    reviewedBy: string;
    finalizeStatus?: WeightRowStatus;
  }) => void;
}

const warningLabels: Record<WarningType, string> = {
  percent_decimal_mixed: '百分数小数混合(不归正常)',
  duplicate_row: '重复行(同指标名称)',
  duplicate_import: '重复导入(文件指纹匹配历史批次)',
  invalid_value: '无效值',
  high_condition_number: '高条件数预警'
};

export const ReviewDetailPanel: React.FC<ReviewDetailPanelProps> = ({ rows, onSubmitReview }) => {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [nextHandler, setNextHandler] = useState('活动负责人');
  const [reviewedBy, setReviewedBy] = useState('吴老师');
  const [finalize, setFinalize] = useState(false);

  const needsReviewRows = rows.filter(r => 
    r.status === 'needs_review' || r.status === 'warning' || r.reviewInfo
  );

  const toggleRow = (id: string) => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
      setReviewReason('');
      setFinalize(false);
    } else {
      setExpandedRowId(id);
      const row = rows.find(r => r.id === id);
      if (row && (row.warnings.includes('percent_decimal_mixed') || row.warnings.includes('duplicate_import'))) {
        const reason = row.warnings.includes('percent_decimal_mixed') 
          ? '检测到百分数和小数混着出现，提交活动负责人复核确认口径'
          : '检测到重复导入，与历史批次数据一致，需活动负责人确认是否沿用历史处理结果';
        setReviewReason(reason);
        setFinalize(false);
      } else {
        setReviewReason('');
        setFinalize(false);
      }
    }
  };

  const handleSubmit = (rowId: string) => {
    onSubmitReview({
      rowId,
      reason: reviewReason,
      nextHandler,
      reviewedBy,
      finalizeStatus: finalize ? 'normal' : undefined
    });
    setExpandedRowId(null);
    setReviewReason('');
    setFinalize(false);
  };

  if (needsReviewRows.length === 0) {
    return (
      <div className="review-panel">
        <h3>复核详情</h3>
        <p className="no-review">目前没有需要复核的记录 ✅</p>
      </div>
    );
  }

  return (
    <div className="review-panel">
      <h3>复核详情 ({needsReviewRows.length} 条待处理)</h3>
      <div className="review-list">
        {needsReviewRows.map(row => (
          <div key={row.id} className={`review-item ${expandedRowId === row.id ? 'expanded' : ''}`}>
            <div 
              className="review-header"
              onClick={() => toggleRow(row.id)}
            >
              <div className="review-main">
                <span className="review-row-num">[行{row.originalRowNumber}]</span>
                <span className="review-criterion">{row.criterionName}</span>
                <span className="review-original">原始：{row.originalImportValue}</span>
                {row.modifiedValue && (
                  <span className="review-modified">改后：{row.modifiedValue}</span>
                )}
                <span className={`review-badge status-${row.status}`}>
                  {row.status === 'needs_review' ? '待复核' :
                   row.status === 'warning' ? '警告' : row.reviewInfo ? '已复核' : row.status}
                </span>
              </div>
              <span className="toggle-icon">{expandedRowId === row.id ? '▲' : '▼'}</span>
            </div>

            <div className="review-warnings">
              {row.warnings.map((w, i) => (
                <span key={i} className={`review-wtag ${w}`}>
                  ⚠ {warningLabels[w]}
                </span>
              ))}
            </div>

            {row.reviewInfo && (
              <div className="review-existing">
                <div className="existing-title">上次复核记录：</div>
                <ul>
                  <li><strong>原始说法：</strong>{row.reviewInfo.previousValue}</li>
                  <li><strong>改后值：</strong>{row.reviewInfo.newValue}</li>
                  <li><strong>处理原因：</strong>{row.reviewInfo.reason}</li>
                  <li><strong>下一步找谁：</strong>{row.reviewInfo.nextHandler}</li>
                  <li><strong>复核人：</strong>{row.reviewInfo.reviewedBy} · {new Date(row.reviewInfo.reviewedAt).toLocaleString()}</li>
                  <li><strong>最终确认：</strong>{row.reviewInfo.finalized ? '是' : '否(不归正常)'}</li>
                </ul>
              </div>
            )}

            {expandedRowId === row.id && (
              <div className="review-form">
                <div className="form-row">
                  <label>复核人：</label>
                  <input
                    type="text"
                    value={reviewedBy}
                    onChange={(e) => setReviewedBy(e.target.value)}
                    placeholder="吴老师"
                  />
                </div>
                <div className="form-row">
                  <label>处理原因：</label>
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="请说明处理原因，如：百分数和小数混合需活动负责人确认口径"
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <label>下一步找谁：</label>
                  <select
                    value={nextHandler}
                    onChange={(e) => setNextHandler(e.target.value)}
                  >
                    <option value="活动负责人">活动负责人</option>
                    <option value="教研负责人吴老师">教研负责人吴老师</option>
                    <option value="评分录入员">评分录入员</option>
                    <option value="项目主管">项目主管</option>
                  </select>
                </div>
                <div className="form-row checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={finalize}
                      onChange={(e) => setFinalize(e.target.checked)}
                      disabled={row.warnings.includes('percent_decimal_mixed') || row.warnings.includes('duplicate_import')}
                    />
                    最终确认后归为正常
                    {(row.warnings.includes('percent_decimal_mixed') || row.warnings.includes('duplicate_import')) && (
                      <span className="disabled-hint">(百分数混合/重复导入需保留待复核，不归正常)</span>
                    )}
                  </label>
                </div>
                <div className="form-actions">
                  <button className="btn-submit-review" onClick={() => handleSubmit(row.id)}>
                    提交复核记录（不归入正常，保留证据）
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
