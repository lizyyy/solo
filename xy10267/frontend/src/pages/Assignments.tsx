import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Assignment,
  Aunt,
  Order,
  SKILL_LABELS,
  TABOO_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS
} from '../types';

const Assignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [aunts, setAunts] = useState<Aunt[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [assignmentsRes, auntsRes, ordersRes] = await Promise.all([
      api.assignments.getAll(),
      api.aunts.getAll(),
      api.orders.getAll()
    ]);

    if (assignmentsRes.success) {
      setAssignments(assignmentsRes.data as Assignment[]);
    }
    if (auntsRes.success) {
      setAunts(auntsRes.data as Aunt[]);
    }
    if (ordersRes.success) {
      setOrders(ordersRes.data as Order[]);
    }
    setLoading(false);
  };

  const getAuntName = (auntId: string) => {
    const aunt = aunts.find(a => a.id === auntId);
    return aunt ? aunt.name : '未知阿姨';
  };

  const getOrderNo = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    return order ? order.orderNo : '未知订单';
  };

  const getOrderStatus = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    return order ? order.status : '';
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      pending: 'status-tag status-warning',
      accepted: 'status-tag status-info',
      rejected: 'status-tag status-danger',
      in_progress: 'status-tag status-processing',
      completed: 'status-tag status-success',
      cancelled: 'status-tag'
    };
    return classMap[status] || 'status-tag';
  };

  const handleUpdateStatus = async (assignmentId: string, newStatus: string) => {
    const response = await api.assignments.update(assignmentId, { status: newStatus });
    if (response.success) {
      loadData();
    } else {
      alert(response.error || '更新状态失败');
    }
  };

  const getAvailableActions = (status: string) => {
    const actions: { status: string; label: string; className: string }[] = [];

    switch (status) {
      case 'pending':
        actions.push({ status: 'accepted', label: '接受', className: 'btn-success' });
        actions.push({ status: 'rejected', label: '拒绝', className: 'btn-danger' });
        actions.push({ status: 'cancelled', label: '取消', className: 'btn-default' });
        break;
      case 'accepted':
        actions.push({ status: 'in_progress', label: '开始服务', className: 'btn-primary' });
        actions.push({ status: 'cancelled', label: '取消', className: 'btn-default' });
        break;
      case 'in_progress':
        actions.push({ status: 'completed', label: '完成', className: 'btn-success' });
        actions.push({ status: 'cancelled', label: '取消', className: 'btn-danger' });
        break;
    }

    return actions;
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📋 派单记录</h1>
        <button className="btn btn-primary" onClick={loadData}>
          刷新
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">暂无派单记录</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>阿姨</th>
                <th>匹配技能</th>
                <th>距离</th>
                <th>匹配分数</th>
                <th>禁忌冲突</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(assignment => {
                const actions = getAvailableActions(assignment.status);
                const orderStatus = getOrderStatus(assignment.orderId);

                return (
                  <tr key={assignment.id}>
                    <td>
                      {getOrderNo(assignment.orderId)}
                      <div>
                        <span
                          className={
                            orderStatus === 'reassigned'
                              ? 'status-tag status-danger'
                              : 'status-tag'
                          }
                          style={{ fontSize: '10px' }}
                        >
                          {ORDER_STATUS_LABELS[orderStatus as keyof typeof ORDER_STATUS_LABELS] || orderStatus}
                        </span>
                      </div>
                    </td>
                    <td>{getAuntName(assignment.auntId)}</td>
                    <td>
                      {assignment.matchedSkills.map(skill => (
                        <span key={skill} className="tag tag-skill">
                          {SKILL_LABELS[skill]}
                        </span>
                      ))}
                    </td>
                    <td>{assignment.distanceKm.toFixed(2)} km</td>
                    <td>
                      <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                        {assignment.score} 分
                      </span>
                    </td>
                    <td>
                      {assignment.tabooConflicts.length > 0 ? (
                        assignment.tabooConflicts.map(taboo => (
                          <span key={taboo} className="tag tag-taboo">
                            {TABOO_LABELS[taboo]}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#52c41a' }}>无</span>
                      )}
                    </td>
                    <td>
                      <span className={getStatusClass(assignment.status)}>
                        {ASSIGNMENT_STATUS_LABELS[assignment.status as keyof typeof ASSIGNMENT_STATUS_LABELS]}
                      </span>
                    </td>
                    <td>{new Date(assignment.createdAt).toLocaleString()}</td>
                    <td>
                      {actions.length > 0 && (
                        <div className="flex gap-2">
                          {actions.map(action => (
                            <button
                              key={action.status}
                              className={`btn btn-sm ${action.className}`}
                              onClick={() =>
                                handleUpdateStatus(assignment.id, action.status)
                              }
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Assignments;
