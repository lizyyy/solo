import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { hospitalizationsAPI, careTasksAPI, cagesAPI } from '../services/api';
import TransferRequestModal from './TransferRequestModal';
import CreateTaskModal from './CreateTaskModal';

function HospitalizationDetail({ hospId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [error, setError] = useState(null);
  const [cages, setCages] = useState([]);

  useEffect(() => {
    loadDetail();
    loadCages();
  }, [hospId]);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hospitalizationsAPI.getById(hospId);
      setDetail(response.data);
    } catch (error) {
      console.error('加载住院详情失败:', error);
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const loadCages = async () => {
    try {
      const response = await cagesAPI.getAll();
      setCages(response.data);
    } catch (error) {
      console.error('加载笼位失败:', error);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await careTasksAPI.complete(taskId, {
        completed_by: '当前用户'
      });
      loadDetail();
      if (onRefresh) onRefresh();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDischarge = async () => {
    if (!window.confirm('确认要为该病例办理出院吗？')) return;

    try {
      await hospitalizationsAPI.discharge(hospId, {});
      alert('出院办理成功！');
      loadDetail();
      if (onRefresh) onRefresh();
    } catch (error) {
      const errMsg = error.response?.data?.error || '出院办理失败';
      const pendingTasks = error.response?.data?.pendingTasks;

      if (pendingTasks && pendingTasks.length > 0) {
        alert(`${errMsg}\n\n未完成任务：\n${pendingTasks.map(t => `- ${t.task_type}`).join('\n')}`);
      } else {
        alert(errMsg);
      }
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <div className="loading">加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <div className="empty-state">
              <div className="icon">❌</div>
              <p>{error || '数据加载失败'}</p>
              <button className="btn btn-primary" onClick={onClose}>关闭</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { hospitalization, tasks, transfers, cageHistory } = detail;
  const isActive = hospitalization.status === 'active';
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            住院详情 - {hospitalization.admission_number}
            <span className={`status-badge status-${hospitalization.status}`} style={{ marginLeft: '12px' }}>
              {hospitalization.status === 'active' ? '在院' :
               hospitalization.status === 'discharged' ? '已出院' : hospitalization.status}
            </span>
            {hospitalization.is_infectious && (
              <span className="cage-tag tag-infectious" style={{ marginLeft: '8px' }}>
                传染病隔离
              </span>
            )}
          </h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="detail-section">
            <h3>📋 基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">宠物姓名</span>
                <span className="value">{hospitalization.pet_name}</span>
              </div>
              <div className="info-item">
                <span className="label">动物种类</span>
                <span className="value">{hospitalization.species_name}</span>
              </div>
              <div className="info-item">
                <span className="label">当前笼位</span>
                <span className="value">{hospitalization.cage_number}</span>
              </div>
              <div className="info-item">
                <span className="label">护理等级</span>
                <span className="value">{hospitalization.care_level_name || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">主人</span>
                <span className="value">{hospitalization.owner_name || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">联系电话</span>
                <span className="value">{hospitalization.owner_phone || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">主治医生</span>
                <span className="value">{hospitalization.attending_vet || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">诊断</span>
                <span className="value">{hospitalization.primary_diagnosis}</span>
              </div>
              <div className="info-item">
                <span className="label">入院时间</span>
                <span className="value">{dayjs(hospitalization.admission_date).format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="info-item">
                <span className="label">预计出院</span>
                <span className="value">
                  {hospitalization.expected_discharge_date
                    ? dayjs(hospitalization.expected_discharge_date).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </span>
              </div>
              {hospitalization.actual_discharge_date && (
                <div className="info-item">
                  <span className="label">实际出院</span>
                  <span className="value">{dayjs(hospitalization.actual_discharge_date).format('YYYY-MM-DD HH:mm')}</span>
                </div>
              )}
              {hospitalization.is_infectious && (
                <div className="info-item">
                  <span className="label">传染病类型</span>
                  <span className="value">{hospitalization.infectious_disease || '-'}</span>
                </div>
              )}
            </div>
            {hospitalization.admission_reason && (
              <div className="info-item" style={{ marginTop: '16px' }}>
                <span className="label">入院原因</span>
                <span className="value">{hospitalization.admission_reason}</span>
              </div>
            )}
          </div>

          {isActive && pendingTasks.length > 0 && (
            <div className="alert alert-warning">
              ⚠️ 当前有 {pendingTasks.length} 项护理任务待处理，未完成不能出院
            </div>
          )}

          <div className="detail-section">
            <h3>
              📝 护理任务
              <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                (共 {tasks.length} 项，待处理 {pendingTasks.length} 项)
              </span>
              {isActive && (
                <button
                  className="btn btn-primary"
                  style={{ float: 'right', fontSize: '12px', padding: '4px 12px' }}
                  onClick={() => setShowTaskModal(true)}
                >
                  + 添加任务
                </button>
              )}
            </h3>
            <div style={{ clear: 'both' }}></div>
            {tasks.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>任务类型</th>
                    <th>计划时间</th>
                    <th>状态</th>
                    <th>完成时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id}>
                      <td>{task.task_type}</td>
                      <td>{dayjs(task.scheduled_time).format('MM-DD HH:mm')}</td>
                      <td>
                        <span className={`status-badge status-${task.status}`}>
                          {task.status === 'pending' ? '待处理' :
                           task.status === 'completed' ? '已完成' : task.status}
                        </span>
                      </td>
                      <td>
                        {task.completed_time
                          ? dayjs(task.completed_time).format('MM-DD HH:mm')
                          : '-'}
                      </td>
                      <td>
                        {task.status === 'pending' && isActive && (
                          <button
                            className="btn btn-success"
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            完成
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>暂无护理任务</p>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>🔄 转笼记录</h3>
            {transfers.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>原笼位</th>
                    <th>目标笼位</th>
                    <th>原因</th>
                    <th>申请人</th>
                    <th>状态</th>
                    <th>驳回原因</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map(t => (
                    <tr key={t.id}>
                      <td>{t.from_cage_number}</td>
                      <td>{t.to_cage_number}</td>
                      <td>{t.request_reason || '-'}</td>
                      <td>{t.requested_by || '-'}</td>
                      <td>
                        <span className={`status-badge status-${t.status}`}>
                          {t.status === 'pending' ? '待处理' :
                           t.status === 'approved' ? '已确认' :
                           t.status === 'rejected' ? '已驳回' :
                           t.status === 'closed' ? '已关闭' : t.status}
                        </span>
                      </td>
                      <td>{t.rejection_reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>暂无转笼记录</p>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>📜 笼位历史</h3>
            {cageHistory.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>笼位</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {cageHistory.map((ch, idx) => (
                    <tr key={idx}>
                      <td>{ch.cage_number}</td>
                      <td>{dayjs(ch.start_date).format('MM-DD HH:mm')}</td>
                      <td>
                        {ch.end_date
                          ? dayjs(ch.end_date).format('MM-DD HH:mm')
                          : <span className="status-badge status-active">当前</span>}
                      </td>
                      <td>{ch.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>暂无笼位历史</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          {isActive && (
            <>
              <button className="btn btn-primary" onClick={() => setShowTransferModal(true)}>
                🔄 申请转笼
              </button>
              <button
                className={pendingTasks.length > 0 ? 'btn btn-danger btn:disabled' : 'btn btn-danger'}
                onClick={handleDischarge}
              >
                🏥 办理出院
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>

      {showTransferModal && (
        <TransferRequestModal
          hospitalization={hospitalization}
          cages={cages}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            loadDetail();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {showTaskModal && (
        <CreateTaskModal
          hospitalizationId={hospitalization.id}
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => {
            loadDetail();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

export default HospitalizationDetail;
