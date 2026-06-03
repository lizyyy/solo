import React from 'react';
import { UnifiedResult } from '../types';

interface SummaryPanelProps {
  result: UnifiedResult;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ result }) => {
  return (
    <div className="summary-panel">
      <h3>数据概览</h3>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-value">{result.summary.totalRows}</div>
          <div className="card-label">总行数</div>
        </div>
        <div className="summary-card warning">
          <div className="card-value">{result.summary.warningCount}</div>
          <div className="card-label">警告数</div>
        </div>
        <div className="summary-card error">
          <div className="card-value">{result.summary.errorCount}</div>
          <div className="card-label">错误数</div>
        </div>
        <div className="summary-card review">
          <div className="card-value">{result.summary.needsReviewCount}</div>
          <div className="card-label">待复核</div>
        </div>
      </div>
      {result.exportTime && (
        <div className="export-time">
          数据更新时间：{new Date(result.exportTime).toLocaleString()}
        </div>
      )}
    </div>
  );
};
