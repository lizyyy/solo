import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

function CallDetail() {
  const { callId } = useParams();
  const [loading, setLoading] = useState(true);
  const [callData, setCallData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchCallDetail = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/calls/${callId}`);
      setCallData(response.data);
    } catch (error) {
      console.error('获取通话详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallDetail();
  }, [callId]);

  const handleAttributionChange = async (categoryCode) => {
    try {
      setSaving(true);
      await axios.put(`/api/calls/${callId}/attribution`, {
        category_code: categoryCode,
      });
      setMessage({ type: 'success', text: '归因已更新，此修改将作为样本影响后续归因结果' });
      fetchCallDetail();
    } catch (error) {
      setMessage({ type: 'error', text: '更新失败，请重试' });
      console.error('更新归因失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCommitmentStatusChange = async (commitmentId, status) => {
    try {
      setSaving(true);
      await axios.put(`/api/commitments/${commitmentId}`, {
        status,
      });
      setMessage({ type: 'success', text: '承诺状态已更新' });
      fetchCallDetail();
    } catch (error) {
      setMessage({ type: 'error', text: '更新失败，请重试' });
      console.error('更新承诺状态失败:', error);
    } finally {
      setSaving(false);
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

  const isDeadlineSoon = (deadline) => {
    if (!deadline) return false;
    const deadlineDate = dayjs(deadline);
    const now = dayjs();
    const diff = deadlineDate.diff(now, 'day');
    return diff <= 3 && diff >= 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!callData) {
    return (
      <div className="card text-center">
        <p className="text-gray-500">通话记录不存在</p>
        <Link to="/calls" className="text-primary hover:underline mt-4 inline-block">
          返回通话列表
        </Link>
      </div>
    );
  }

  const { call, commitments, otherCalls, categories } = callData;

  return (
    <div>
      <div className="mb-4">
        <Link to="/calls" className="text-primary hover:underline flex items-center">
          <span>←</span>
          <span className="ml-1">返回通话列表</span>
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-800">通话详情</h2>
              <div className="text-sm text-gray-500">
                通话ID: <span className="font-mono">{call.call_id}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">通话时间</label>
                <p className="text-gray-900">
                  {call.call_time
                    ? dayjs(call.call_time).format('YYYY-MM-DD HH:mm:ss')
                    : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">客服</label>
                <p className="text-gray-900">{call.agent_name || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">客户</label>
                <p className="text-gray-900">{call.customer_name || call.customer_id || '未知'}</p>
                {call.customer_phone && (
                  <p className="text-sm text-gray-500">{call.customer_phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">产品</label>
                <p className="text-gray-900">{call.product_name || call.product_category || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">订单号</label>
                <p className="text-gray-900 font-mono">{call.order_id || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">地区</label>
                <p className="text-gray-900">{call.region || call.customer_region || '-'}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 mb-2">原文纪要</label>
              <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-800">
                {call.raw_text || '无'}
              </div>
            </div>

            {call.cleaned_text && call.cleaned_text !== call.raw_text && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">清洗后文本</label>
                <div className="bg-blue-50 p-4 rounded-lg whitespace-pre-wrap text-gray-800">
                  {call.cleaned_text}
                </div>
              </div>
            )}
          </div>

          {otherCalls && otherCalls.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">该客户的其他通话</h3>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>问题分类</th>
                      <th>纪要摘要</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherCalls.map((otherCall) => (
                      <tr key={otherCall.call_id}>
                        <td>
                          {otherCall.call_time
                            ? dayjs(otherCall.call_time).format('YYYY-MM-DD HH:mm')
                            : '-'}
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {otherCall.category_name || '未分类'}
                          </span>
                        </td>
                        <td className="max-w-xs truncate">
                          {otherCall.raw_text?.substring(0, 50) || '-'}
                          {otherCall.raw_text?.length > 50 ? '...' : ''}
                        </td>
                        <td>
                          <Link
                            to={`/calls/${otherCall.call_id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            查看
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">系统归因</h3>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">当前分类</span>
                {call.is_manual && (
                  <span className="badge badge-warning">已人工修改</span>
                )}
              </div>
              <div className="text-xl font-bold text-primary">
                {call.category_name || '未分类'}
              </div>
              {call.confidence !== undefined && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                    <span>置信度</span>
                    <span>{Math.round(call.confidence * 100)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${call.confidence * 100}%`,
                        backgroundColor: call.confidence >= 0.8 ? '#28a745' : call.confidence >= 0.5 ? '#ffc107' : '#dc3545',
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {call.evidence && (
              <div className="mb-4">
                <span className="text-sm text-gray-500">命中依据</span>
                <p className="text-sm text-gray-700 mt-1">{call.evidence}</p>
              </div>
            )}

            {call.attribution_keywords && (
              <div className="mb-4">
                <span className="text-sm text-gray-500">匹配关键词</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {JSON.parse(call.attribution_keywords || '[]').map((kw, idx) => (
                    <span key={idx} className="badge badge-info">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                修改归因（将作为样本影响后续结果）
              </label>
              <select
                className="form-select mb-2"
                value={''}
                onChange={(e) => e.target.value && handleAttributionChange(e.target.value)}
                disabled={saving}
              >
                <option value="">选择新的分类...</option>
                {categories?.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                人工修改后，此条记录将作为样本，影响后续相似内容的自动归因结果。
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">承诺事项</h3>
            
            {commitments && commitments.length > 0 ? (
              <div className="space-y-3">
                {commitments.map((commitment) => (
                  <div
                    key={commitment.id}
                    className={`p-3 rounded-lg border ${
                      commitment.status === 'overdue'
                        ? 'border-red-200 bg-red-50'
                        : isDeadlineSoon(commitment.deadline)
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(commitment.priority)}
                        {getStatusBadge(commitment.status)}
                      </div>
                    </div>
                    <p className="text-sm mb-2">{commitment.content}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        截止日期: {commitment.deadline || '-'}
                      </div>
                      {commitment.status !== 'completed' && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => handleCommitmentStatusChange(commitment.id, 'completed')}
                          disabled={saving}
                        >
                          标记完成
                        </button>
                      )}
                    </div>
                    {commitment.follow_up_note && (
                      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                        跟进备注: {commitment.follow_up_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">未检测到承诺事项</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CallDetail;
