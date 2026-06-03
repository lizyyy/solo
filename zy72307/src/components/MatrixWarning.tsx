import React from 'react';
import { MatrixConditionResult } from '../types';

interface MatrixWarningProps {
  result: MatrixConditionResult | null;
}

export const MatrixWarning: React.FC<MatrixWarningProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="matrix-warning empty">
        <h3>矩阵条件数预警</h3>
        <p className="no-data">暂无数据</p>
      </div>
    );
  }

  return (
    <div className={`matrix-warning ${result.isWarning ? 'warning' : 'normal'}`}>
      <h3>矩阵条件数预警</h3>
      <div className="warning-content">
        <div className="condition-number">
          <span className="label">条件数：</span>
          <span className={`value ${result.isWarning ? 'warning' : ''}`}>
            {result.conditionNumber.toFixed(2)}
          </span>
        </div>
        <div className="threshold">
          <span className="label">预警阈值：</span>
          <span className="value">{result.threshold}</span>
        </div>
        <div className="status">
          <span className="label">状态：</span>
          <span className={`status-value ${result.isWarning ? 'warning' : 'normal'}`}>
            {result.isWarning ? '⚠️ 已触发预警' : '✓ 正常'}
          </span>
        </div>
        {result.isWarning && (
          <div className="warning-alert">
            <strong>预警说明：</strong>
            <p>矩阵条件数超过阈值，权重分配可能存在问题。建议检查各指标权重的合理性，避免出现权重差异过大的情况。</p>
            <p className="note">此状态需要活动负责人复核后才能确认。</p>
          </div>
        )}
        <div className="details">
          <details>
            <summary>查看计算详情</summary>
            <div className="detail-content">
              <p>最大特征值：{result.details.maxEigenvalue.toFixed(4)}</p>
              <p>最小特征值：{result.details.minEigenvalue.toFixed(4)}</p>
              <p>特征值列表：{result.details.eigenvalues.map(e => e.toFixed(4)).join(', ')}</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
