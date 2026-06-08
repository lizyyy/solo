import React from 'react';
import { UnifiedResult } from '../types';

interface SummaryPanelProps {
  result: UnifiedResult;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ result }) => {
  return (
    <div className="summary-panel">
      <h3>数据概览 <span className="version-tag">v{result.dataVersion}</span></h3>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-value">{result.summary.totalRows}</div>
          <div className="card-label">总行数</div>
        </div>
        <div className="summary-card normal">
          <div className="card-value">{result.summary.normalCount}</div>
          <div className="card-label">正常</div>
        </div>
        <div className="summary-card warning">
          <div className="card-value">{result.summary.warningCount}</div>
          <div className="card-label">警告</div>
        </div>
        <div className="summary-card error">
          <div className="card-value">{result.summary.errorCount}</div>
          <div className="card-label">错误</div>
        </div>
        <div className="summary-card review">
          <div className="card-value">{result.summary.needsReviewCount}</div>
          <div className="card-label">待复核</div>
        </div>
        <div className="summary-card modified">
          <div className="card-value">{result.summary.modifiedCount}</div>
          <div className="card-label">已修改</div>
        </div>
      </div>
      <div className="export-time">
        数据版本：v{result.dataVersion} · 生成时间：{new Date(result.exportTime!).toLocaleString()}
      </div>
    </div>
  );
};
