import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function HistoryViewer({ initialEntity }) {
  const [entityType, setEntityType] = useState('store');
  const [entityId, setEntityId] = useState('');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialEntity) {
      setEntityType(initialEntity.type);
      setEntityId(initialEntity.id);
    }
  }, [initialEntity]);

  const loadHistory = () => {
    if (!entityId.trim()) {
      setError('请输入实体ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    fetch(`${API_BASE}/api/history/${entityType}/${entityId}`)
      .then(r => r.json())
      .then(data => {
        setHistory(data);
        setLoading(false);
      })
      .catch(err => {
        setError('加载失败: ' + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (initialEntity && initialEntity.id) {
      loadHistory();
    }
  }, []);

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('zh-CN');
  };

  const STATUS_LABELS = {
    pending: '待处理',
    submitted: '已提交',
    rectified: '已整改',
    completed: '已完成',
    rejected: '已驳回',
    active: '激活',
    inactive: '停用'
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">📜 历史追踪</h2>
        <p className="text-gray-600 text-sm mt-1">查看状态变化历史和验证记录</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">实体类型</label>
            <select
              value={entityType}
              onChange={e => setEntityType(e.target.value)}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="store">门店</option>
              <option value="inspection">巡店记录</option>
              <option value="problem">问题</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">实体ID</label>
            <input
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              placeholder="输入实体ID查询历史"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '加载中...' : '查询'}
          </button>
        </div>
        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {history && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">🔄 状态变更历史</h3>
            {history.statusHistory && history.statusHistory.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-6">
                  {history.statusHistory.map((sh, idx) => (
                    <div key={sh.id || idx} className="relative pl-10">
                      <div className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow ${
                        idx === 0 ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            {sh.from_status && (
                              <>
                                <span className="text-sm text-gray-500">
                                  {STATUS_LABELS[sh.from_status] || sh.from_status}
                                </span>
                                <span className="text-gray-400">→</span>
                              </>
                            )}
                            <span className="font-medium text-blue-600">
                              {STATUS_LABELS[sh.to_status] || sh.to_status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{formatDate(sh.created_at)}</span>
                        </div>
                        {sh.operator && (
                          <div className="text-sm text-gray-600">操作人: {sh.operator}</div>
                        )}
                        {sh.reason && (
                          <div className="text-sm text-gray-500 mt-1">{sh.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">暂无状态变更记录</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">✅ 验证记录</h3>
            {history.validationHistory && history.validationHistory.length > 0 ? (
              <div className="space-y-4">
                {history.validationHistory.map((vh, idx) => (
                  <div key={idx} className={`rounded-lg p-4 ${
                    vh.result === 'passed' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span>{vh.result === 'passed' ? '✓' : '✗'}</span>
                        <span className="font-medium">
                          {vh.validation_type === 'profile_validation' ? '门店档案' :
                           vh.validation_type === 'reliability_validation' ? '巡店可靠性' :
                           vh.validation_type === 'consistency_validation' ? '整改一致性' : vh.validation_type}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        vh.result === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {vh.result === 'passed' ? '通过' : '失败'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{formatDate(vh.created_at)}</div>
                    
                    {vh.details?.score !== undefined && (
                      <div className="mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-600">评分:</span>
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                vh.details.score >= 80 ? 'bg-green-500' : 
                                vh.details.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${vh.details.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{vh.details.score}</span>
                        </div>
                      </div>
                    )}

                    {vh.details?.currentBlock && (
                      <div className="text-xs text-orange-600 mb-1">
                        🚧 卡点: {vh.details.currentBlock}
                      </div>
                    )}

                    {vh.errors && vh.errors.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-red-700">错误:</div>
                        <ul className="list-disc list-inside mt-1">
                          {vh.errors.map((e, i) => (
                            <li key={i} className="text-xs text-red-600">{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">暂无验证记录</div>
            )}
          </div>
        </div>
      )}

      {!history && !loading && !error && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">📜</div>
          <p className="text-gray-600">输入实体ID查询状态历史和验证记录</p>
          <p className="text-sm text-gray-400 mt-2">可从门店列表、巡店记录、问题追踪中点击"历史"按钮</p>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🎯 业务状态流转说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-2">🏪 门店状态</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span><strong>active</strong> - 激活（可接受巡店）</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <span><strong>inactive</strong> - 停用（不可巡店）</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-700 mb-2">🔍 巡店记录状态</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span><strong>pending</strong> - 待提交</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <span><strong>submitted</strong> - 已提交</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-700 mb-2">⚠️ 问题状态</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span><strong>pending</strong> - 待整改</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                <span><strong>rectified</strong> - 已整改待复查</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span><strong>completed</strong> - 复查通过</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span><strong>rejected</strong> - 复查驳回（需重整改）</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryViewer;
