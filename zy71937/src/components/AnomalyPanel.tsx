import React, { useState } from 'react';
import { AnomalyRecord } from '../types';
import { getAnomalyLabel, getSeverityColor, formatDate } from '../utils/helpers';
import { useApp } from '../context/AppContext';

interface AnomalyPanelProps {
  anomalies: AnomalyRecord[];
  taskId: string;
}

const AnomalyPanel: React.FC<AnomalyPanelProps> = ({ anomalies, taskId }) => {
  const { dispatch } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const unresolvedAnomalies = anomalies.filter(a => !a.isResolved);
  const resolvedAnomalies = anomalies.filter(a => a.isResolved);

  const handleResolve = (anomalyId: string) => {
    const note = reviewNotes[anomalyId] || '已确认，无问题';
    dispatch({
      type: 'RESOLVE_ANOMALY',
      payload: { taskId, anomalyId, reviewNote: note }
    });
    setExpandedId(null);
  };

  const getAnomalyExplanation = (type: string): string => {
    const explanations: Record<string, string> = {
      color_mismatch: '系统检测到同一任务中存在多种颜色标准混用（如Pantone色值与CMYK并存）。这可能导致不同批次印刷品出现色差。建议统一颜色标准后再导出。',
      spec_mismatch: '当前使用的导出规格不是系统中标记的最新版本。请确认是否有特殊原因使用旧规格，否则建议更新到最新版本以保证与印刷厂参数一致。',
      auth_expired: '该供应商的授权资质已过期，继续合作存在合规风险。请联系采购部门更新授权文件后再进行下一步操作。',
      duplicate_import: '相同SKU在同一季节的其他任务中已存在。请确认是否为重复下单，若为分批制作请注明原因后继续。',
      filter_inconsistent: '本次筛选条件与历史同类型任务存在差异，可能导致导出数据口径不一致。建议与历史任务核对筛选条件。',
    };
    return explanations[type] || '请核查该异常情况。';
  };

  const getSuggestedActions = (type: string): string[] => {
    const actions: Record<string, string[]> = {
      color_mismatch: [
        '联系设计部确认配色方案是否为刻意设计',
        '统一所有商品颜色版本为同一标准',
        '在备注中说明颜色差异原因后确认通过'
      ],
      spec_mismatch: [
        '点击"更新规格"按钮切换到最新版本',
        '若必须使用旧规格，请在备注中说明原因',
        '联系印刷厂确认旧规格兼容性'
      ],
      auth_expired: [
        '联系采购部更新供应商授权文件',
        '更换为有有效授权的供应商',
        '获得特批后手动确认通过'
      ],
      duplicate_import: [
        '核查是否为重复导入数据',
        '若为分批制作，注明批次信息',
        '删除重复的SKU条目'
      ],
      filter_inconsistent: [
        '对比历史任务的筛选条件',
        '调整筛选条件保持口径一致',
        '确认本次筛选为特殊需求后继续'
      ],
    };
    return actions[type] || ['请仔细核查该异常'];
  };

  const renderAnomalyCard = (anomaly: AnomalyRecord, isResolved: boolean) => (
    <div 
      key={anomaly.id} 
      className={`anomaly-card ${isResolved ? 'resolved' : ''}`}
    >
      <div 
        className="anomaly-header"
        onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
      >
        <div className="anomaly-title">
          <span 
            className="severity-dot"
            style={{ backgroundColor: getSeverityColor(anomaly.severity) }}
          />
          <span className="anomaly-type">{getAnomalyLabel(anomaly.type)}</span>
          {isResolved && <span className="resolved-badge">已处理</span>}
        </div>
        <span className="expand-icon">{expandedId === anomaly.id ? '−' : '+'}</span>
      </div>

      <div className="anomaly-time">
        检测时间: {formatDate(anomaly.createdAt)} | 检测者: {anomaly.createdBy}
      </div>

      {expandedId === anomaly.id && (
        <div className="anomaly-detail">
          <div className="anomaly-description">
            <strong>异常描述：</strong>{anomaly.description}
          </div>

          {!isResolved && (
            <>
              <div className="anomaly-explanation">
                <strong>为什么这是个问题：</strong>
                <p>{getAnomalyExplanation(anomaly.type)}</p>
              </div>

              <div className="anomaly-actions">
                <strong>建议操作：</strong>
                <ul>
                  {getSuggestedActions(anomaly.type).map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>

              <div className="review-section">
                <label>复核说明：</label>
                <textarea
                  placeholder="请输入复核意见..."
                  value={reviewNotes[anomaly.id] || ''}
                  onChange={(e) => setReviewNotes({
                    ...reviewNotes,
                    [anomaly.id]: e.target.value
                  })}
                />
                <button 
                  className="btn btn-primary"
                  onClick={() => handleResolve(anomaly.id)}
                >
                  标记为已处理
                </button>
              </div>
            </>
          )}

          {isResolved && (
            <div className="resolved-info">
              <strong>处理结果：</strong>
              <p>{anomaly.reviewNote}</p>
              <div className="resolved-meta">
                处理人: {anomaly.resolvedBy} | 处理时间: {formatDate(anomaly.resolvedAt!)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="anomaly-panel">
      <div className="panel-header">
        <h3>异常检测记录</h3>
        {unresolvedAnomalies.length > 0 && (
          <span className="unresolved-count">
            {unresolvedAnomalies.length} 项待确认
          </span>
        )}
      </div>

      {unresolvedAnomalies.length > 0 && (
        <div className="anomaly-section">
          <h4>待处理异常</h4>
          {unresolvedAnomalies.map(a => renderAnomalyCard(a, false))}
        </div>
      )}

      {resolvedAnomalies.length > 0 && (
        <div className="anomaly-section">
          <h4>已处理异常 ({resolvedAnomalies.length})</h4>
          {resolvedAnomalies.map(a => renderAnomalyCard(a, true))}
        </div>
      )}

      {anomalies.length === 0 && (
        <div className="no-anomalies">
          暂无异常记录，该任务数据一致性检查通过
        </div>
      )}
    </div>
  );
};

export default AnomalyPanel;
