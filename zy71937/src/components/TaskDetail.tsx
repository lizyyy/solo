import React, { useState } from 'react';
import { DisplayTask } from '../types';
import { getStatusLabel, getStatusColor, getDepartmentLabel, formatDate, validateExportConsistency } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import AnomalyPanel from './AnomalyPanel';
import TaskHistoryPanel from './TaskHistory';
import ExportValidationModal from './ExportValidationModal';

interface TaskDetailProps {
  task: DisplayTask;
  onClose: () => void;
}

const TaskDetail: React.FC<TaskDetailProps> = ({ task, onClose }) => {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<'items' | 'anomalies' | 'history'>('anomalies');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState(task.exportSpecId);

  const currentSpec = state.exportSpecs.find(s => s.id === task.exportSpecId);
  const activeSpec = state.exportSpecs.find(s => s.isActive);
  const validationResult = validateExportConsistency(task, state.exportSpecs, state.tasks);
  const hasUnresolvedErrors = task.anomalies.some(a => !a.isResolved && a.severity !== 'warning');

  const handleConfirm = () => {
    dispatch({ type: 'UPDATE_TASK_STATUS', payload: { taskId: task.id, status: 'confirmed' } });
  };

  const handleWithdraw = () => {
    if (withdrawReason.trim()) {
      dispatch({ type: 'WITHDRAW_TASK', payload: { taskId: task.id, reason: withdrawReason } });
      setShowWithdrawModal(false);
      setWithdrawReason('');
    }
  };

  const handleUpdateSpec = () => {
    if (selectedSpecId !== task.exportSpecId) {
      dispatch({ type: 'UPDATE_EXPORT_SPEC', payload: { taskId: task.id, specId: selectedSpecId } });
    }
  };

  const canConfirm = task.status === 'pending' && !hasUnresolvedErrors;
  const canExport = task.status === 'confirmed' && validationResult.summary.errorCount === 0;

  return (
    <>
      <div className="task-detail">
        <div className="detail-header">
          <div className="detail-title">
            <h2>{task.name}</h2>
            <span 
              className="status-badge large"
              style={{ backgroundColor: getStatusColor(task.status) }}
            >
              {getStatusLabel(task.status)}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="detail-info-grid">
          <div className="info-item">
            <label>季节/年份</label>
            <span>{task.season} {task.year}</span>
          </div>
          <div className="info-item">
            <label>负责部门</label>
            <span>{getDepartmentLabel(task.department)}</span>
          </div>
          <div className="info-item">
            <label>创建人</label>
            <span>{task.createdBy}</span>
          </div>
          <div className="info-item">
            <label>创建时间</label>
            <span>{formatDate(task.createdAt)}</span>
          </div>
          <div className="info-item">
            <label>商品数量</label>
            <span>{task.items.length} 个SKU</span>
          </div>
          <div className="info-item">
            <label>更新时间</label>
            <span>{formatDate(task.updatedAt)}</span>
          </div>
        </div>

        <div className="export-spec-section">
          <div className="section-title">
            <h4>导出规格</h4>
            {currentSpec?.id !== activeSpec?.id && task.status !== 'exported' && (
              <span className="spec-warning">⚠ 当前使用的不是最新版本</span>
            )}
          </div>
          <div className="spec-info">
            {currentSpec && (
              <>
                <div className="spec-item">
                  <span className="spec-label">规格名称</span>
                  <span className="spec-value">{currentSpec.name}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">版本</span>
                  <span className="spec-value">v{currentSpec.version}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">DPI</span>
                  <span className="spec-value">{currentSpec.dpi}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">格式</span>
                  <span className="spec-value">{currentSpec.format}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">颜色模式</span>
                  <span className="spec-value">{currentSpec.colorMode}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">出血</span>
                  <span className="spec-value">{currentSpec.bleed}mm</span>
                </div>
              </>
            )}
          </div>
          {task.status !== 'exported' && (
            <div className="spec-update">
              <select
                value={selectedSpecId}
                onChange={(e) => setSelectedSpecId(e.target.value)}
              >
                {state.exportSpecs.map(spec => (
                  <option key={spec.id} value={spec.id}>
                    {spec.name} (v{spec.version}) {spec.isActive ? '[最新]' : ''}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-small btn-secondary"
                onClick={handleUpdateSpec}
                disabled={selectedSpecId === task.exportSpecId}
              >
                更新规格
              </button>
            </div>
          )}
        </div>

        <div className="detail-tabs">
          <button 
            className={`tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            商品清单 ({task.items.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
            onClick={() => setActiveTab('anomalies')}
          >
            异常检测 
            {task.anomalies.filter(a => !a.isResolved).length > 0 && (
              <span className="tab-badge">
                {task.anomalies.filter(a => !a.isResolved).length}
              </span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            操作历史 ({task.history.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'items' && (
            <div className="items-list">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>商品名称</th>
                    <th>分类</th>
                    <th>颜色版本</th>
                    <th>数量</th>
                    <th>门店范围</th>
                  </tr>
                </thead>
                <tbody>
                  {task.items.map(item => (
                    <tr key={item.id}>
                      <td className="sku-code">{item.sku}</td>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td className="color-version">{item.colorVersion}</td>
                      <td>{item.quantity}</td>
                      <td>{item.storeIds.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'anomalies' && (
            <AnomalyPanel anomalies={task.anomalies} taskId={task.id} />
          )}

          {activeTab === 'history' && (
            <TaskHistoryPanel history={task.history} />
          )}
        </div>

        <div className="detail-actions">
          {task.status === 'pending' && (
            <>
              <button 
                className={`btn ${canConfirm ? 'btn-primary' : 'btn-disabled'}`}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {canConfirm ? '确认通过' : '请先处理异常'}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowWithdrawModal(true)}
              >
                撤回修正
              </button>
            </>
          )}
          
          {task.status === 'confirmed' && (
            <>
              <button 
                className={`btn ${canExport ? 'btn-primary' : 'btn-disabled'}`}
                onClick={() => setShowExportModal(true)}
                disabled={!canExport}
              >
                执行导出
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => dispatch({ 
                  type: 'UPDATE_TASK_STATUS', 
                  payload: { taskId: task.id, status: 'pending' } 
                })}
              >
                退回待确认
              </button>
            </>
          )}

          {task.status === 'exported' && (
            <button 
              className="btn btn-secondary"
              onClick={() => setShowExportModal(true)}
            >
              重新导出
            </button>
          )}

          {task.status === 'withdrawn' && (
            <button 
              className="btn btn-primary"
              onClick={() => dispatch({ 
                type: 'UPDATE_TASK_STATUS', 
                payload: { taskId: task.id, status: 'pending' } 
              })}
            >
              重新提交
            </button>
          )}
        </div>
      </div>

      {showExportModal && (
        <ExportValidationModal
          task={task}
          specs={state.exportSpecs}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>撤回任务</h3>
              <button className="close-btn" onClick={() => setShowWithdrawModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <label>撤回原因：</label>
              <textarea
                placeholder="请说明撤回原因..."
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowWithdrawModal(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleWithdraw}
                disabled={!withdrawReason.trim()}
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskDetail;
