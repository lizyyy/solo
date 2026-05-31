import React from 'react';
import { DisplayTask, ExportSpec } from '../types';
import { validateExportConsistency, exportToCSV, getAnomalyLabel } from '../utils/helpers';
import { useApp } from '../context/AppContext';

interface ExportValidationModalProps {
  task: DisplayTask;
  specs: ExportSpec[];
  onClose: () => void;
}

const ExportValidationModal: React.FC<ExportValidationModalProps> = ({ task, specs, onClose }) => {
  const { state, dispatch } = useApp();
  const validationResult = validateExportConsistency(task, specs, state.tasks);

  const handleExport = () => {
    exportToCSV(task.items, `${task.name}_${new Date().toISOString().split('T')[0]}`);
    dispatch({ type: 'UPDATE_TASK_STATUS', payload: { taskId: task.id, status: 'exported' } });
    onClose();
  };

  const canExport = validationResult.summary.errorCount === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导出一致性校验</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="validation-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-value">{validationResult.summary.totalItems}</span>
              <span className="summary-label">商品总数</span>
            </div>
            <div className="summary-item">
              <span className="summary-value warning">{validationResult.summary.warningCount}</span>
              <span className="summary-label">警告</span>
            </div>
            <div className="summary-item">
              <span className="summary-value error">{validationResult.summary.errorCount}</span>
              <span className="summary-label">错误</span>
            </div>
          </div>
        </div>

        <div className="validation-issues">
          <h3>检测结果</h3>
          {validationResult.issues.length === 0 ? (
            <div className="validation-success">
              ✓ 所有一致性检查通过，可以安全导出
            </div>
          ) : (
            <div className="issues-list">
              {validationResult.issues.map((issue, idx) => (
                <div key={idx} className={`issue-item ${issue.type === 'spec_mismatch' || issue.type === 'auth_expired' ? 'error' : 'warning'}`}>
                  <div className="issue-header">
                    <span className="issue-icon">
                      {issue.type === 'spec_mismatch' || issue.type === 'auth_expired' ? '✕' : '⚠'}
                    </span>
                    <span className="issue-type">{getAnomalyLabel(issue.type)}</span>
                  </div>
                  <div className="issue-message">{issue.message}</div>
                  <div className="issue-affected">
                    影响商品: {issue.affectedItems.slice(0, 3).join(', ')}
                    {issue.affectedItems.length > 3 && ` 等${issue.affectedItems.length}个`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button 
            className={`btn ${canExport ? 'btn-primary' : 'btn-disabled'}`}
            onClick={handleExport}
            disabled={!canExport}
          >
            {canExport ? '确认导出' : '存在错误，无法导出'}
          </button>
        </div>

        {!canExport && (
          <div className="export-hint">
            提示：请先处理所有错误项后再执行导出操作。警告项可手动确认后继续。
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportValidationModal;
