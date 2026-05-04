import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

function CommitmentList() {
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState(null);

  const fetchCommitments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard');
      setCommitments(response.data.pendingCommitments || []);
    } catch (error) {
      console.error('获取承诺列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitments();
  }, []);

  const handleMarkComplete = async (commitmentId) => {
    try {
      await axios.put(`/api/commitments/${commitmentId}`, {
        status: 'completed',
      });
      setMessage({ type: 'success', text: '已标记为完成' });
      fetchCommitments();
    } catch (error) {
      setMessage({ type: 'error', text: '操作失败，请重试' });
      console.error('更新承诺状态失败:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">已完成</span>;
      case 'pending':
        return <span className="badge badge-warning">待跟进</span>;
      case 'overdue':
        return <span className="badge badge-danger">已逾期</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="badge badge-danger">高优先级</span>;
      case 'medium':
        return <span className="badge badge-warning">中优先级</span>;
      case 'low':
        return <span className="badge badge-success">低优先级</span>;
      default:
        return <span className="badge badge-secondary">{priority}</span>;
    }
  };

  const getRowClass = (commitment) => {
    if (commitment.status === 'overdue') {
      return 'bg-red-50';
    }
    if (commitment.priority === 'high') {
      return 'bg-yellow-50';
    }
    return '';
  };

  const filteredCommitments = commitments.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'overdue') return c.status === 'overdue';
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'high') return c.priority === 'high';
    return true;
  });

  const overdueCount = commitments.filter((c) => c.status === 'overdue').length;
  const highPriorityCount = commitments.filter((c) => c.priority === 'high').length;
  const pendingCount = commitments.filter((c) => c.status === 'pending').length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">承诺跟进</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-gray-800">{commitments.length}</div>
            <div className="text-gray-600 text-sm">全部待处理</div>
          </div>
          <div className="card text-center border-red-200">
            <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
            <div className="text-gray-600 text-sm">已逾期</div>
          </div>
          <div className="card text-center border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600">{highPriorityCount}</div>
            <div className="text-gray-600 text-sm">高优先级</div>
          </div>
          <div className="card text-center border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{pendingCount}</div>
            <div className="text-gray-600 text-sm">待跟进</div>
          </div>
        </div>

        {message && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'} mb-4`}>
            {message.text}
            <button
              className="float-right ml-4"
              onClick={() => setMessage(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="card mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('all')}
            >
              全部 ({commitments.length})
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                filter === 'overdue' ? 'bg-danger text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('overdue')}
            >
              已逾期 ({overdueCount})
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                filter === 'high' ? 'bg-warning text-gray-800' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('high')}
            >
              高优先级 ({highPriorityCount})
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                filter === 'pending' ? 'bg-info text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setFilter('pending')}
            >
              待跟进 ({pendingCount})
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-xl text-gray-500">加载中...</div>
          </div>
        ) : filteredCommitments.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg">暂无承诺事项</p>
            <p className="text-sm mt-2">导入通话数据后，系统将自动识别承诺</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>承诺内容</th>
                  <th>截止日期</th>
                  <th>客户</th>
                  <th>客服</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommitments.map((commitment) => (
                  <tr key={commitment.id} className={getRowClass(commitment)}>
                    <td>{getPriorityBadge(commitment.priority)}</td>
                    <td>{getStatusBadge(commitment.status)}</td>
                    <td className="max-w-xs">
                      <div className="truncate" title={commitment.content}>
                        {commitment.content}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${
                          commitment.status === 'overdue' ? 'text-red-600 font-bold' : ''
                        }`}
                      >
                        {commitment.deadline
                          ? dayjs(commitment.deadline).format('YYYY-MM-DD')
                          : '-'}
                      </span>
                    </td>
                    <td>{commitment.customer_name || commitment.customer_id || '未知'}</td>
                    <td>{commitment.agent_name || '-'}</td>
                    <td>
                      <div className="flex space-x-2">
                        <Link
                          to={`/calls/${commitment.call_id}`}
                          className="text-primary hover:underline text-sm"
                        >
                          查看通话
                        </Link>
                        {commitment.status !== 'completed' && (
                          <button
                            className="text-green-600 hover:underline text-sm"
                            onClick={() => handleMarkComplete(commitment.id)}
                          >
                            标记完成
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {overdueCount > 0 && (
        <div className="card mt-6 border-red-300 bg-red-50">
          <h3 className="text-lg font-semibold text-red-700 mb-4">
            ⚠️ 风险提示 - 已逾期承诺
          </h3>
          <p className="text-red-600 text-sm mb-4">
            以下承诺已超过截止日期，请优先处理以避免客户不满。
          </p>
          <div className="space-y-2">
            {commitments
              .filter((c) => c.status === 'overdue')
              .map((commitment) => (
                <div
                  key={commitment.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
                >
                  <div>
                    <p className="font-medium text-gray-800">{commitment.content}</p>
                    <p className="text-sm text-gray-500">
                      客户: {commitment.customer_name || commitment.customer_id || '未知'} | 
                      截止日期: {commitment.deadline} | 
                      客服: {commitment.agent_name || '-'}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/calls/${commitment.call_id}`}
                      className="btn-primary text-sm"
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommitmentList;
