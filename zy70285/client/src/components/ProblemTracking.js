import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function ProblemTracking({ onSelect }) {
  const [problems, setProblems] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [showRectifyForm, setShowRectifyForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rectForm, setRectForm] = useState({ rectifier: '', photos: '', description: '' });
  const [reviewForm, setReviewForm] = useState({ reviewer: '', photos: '', comments: '', passed: true, score: '' });
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/stores`).then(r => r.json()),
      fetch(`${API_BASE}/api/problems`).then(r => r.json())
    ]).then(([storesData, problemsData]) => {
      setStores(storesData);
      setProblems(problemsData);
    });
  };

  const validateProblem = async (problemId) => {
    const res = await fetch(`${API_BASE}/api/validate/problem/${problemId}`, { method: 'POST' });
    return res.json();
  };

  const submitRectification = (e) => {
    e.preventDefault();
    if (!selectedProblem) return;

    const photos = rectForm.photos ? rectForm.photos.split('\n').filter(p => p.trim()) : [];

    fetch(`${API_BASE}/api/problems/${selectedProblem.id}/rectify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rectifier: rectForm.rectifier,
        photos,
        description: rectForm.description
      })
    })
      .then(r => r.json())
      .then(async (data) => {
        const validation = await validateProblem(selectedProblem.id);
        setActionResult({
          type: 'rectify',
          data,
          validation,
          timestamp: new Date().toLocaleString()
        });
        loadData();
        setShowRectifyForm(false);
        setRectForm({ rectifier: '', photos: '', description: '' });
      });
  };

  const submitReview = (e) => {
    e.preventDefault();
    if (!selectedProblem) return;

    const photos = reviewForm.photos ? reviewForm.photos.split('\n').filter(p => p.trim()) : [];

    fetch(`${API_BASE}/api/problems/${selectedProblem.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewer: reviewForm.reviewer,
        photos,
        comments: reviewForm.comments,
        passed: reviewForm.passed,
        score: reviewForm.score ? parseFloat(reviewForm.score) : null
      })
    })
      .then(r => r.json())
      .then(data => {
        setActionResult({
          type: 'review',
          data,
          timestamp: new Date().toLocaleString()
        });
        loadData();
        setShowReviewForm(false);
        setReviewForm({ reviewer: '', photos: '', comments: '', passed: true, score: '' });
      });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">⚠️ 问题追踪</h2>
        <p className="text-gray-600 text-sm mt-1">整改任务与原始数据对得上？一致性校验</p>
      </div>

      {actionResult && (
        <div className={`mb-6 p-4 rounded-lg ${actionResult.data.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                {actionResult.type === 'rectify' ? '整改提交' : '复查提交'}
              </div>
              <div className="text-sm mt-1">{actionResult.data.message}</div>
              {actionResult.validation && (
                <div className="mt-2 text-sm">
                  <div>一致性评分: {actionResult.validation.score} 分</div>
                  {actionResult.validation.errors?.length > 0 && (
                    <ul className="list-disc list-inside text-yellow-600 mt-1">
                      {actionResult.validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${actionResult.data.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {actionResult.data.success ? '✓ 成功' : '✗ 失败'}
              </span>
              <div className="text-xs text-gray-500 mt-1">{actionResult.timestamp}</div>
            </div>
          </div>
          <button onClick={() => setActionResult(null)} className="text-xs text-gray-500 mt-2">关闭</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">门店</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">问题类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">描述</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">严重程度</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {problems.map(problem => {
              const store = stores.find(s => s.id === problem.store_id);
              const statusConfig = STATUS_CONFIG[problem.status] || { label: problem.status, color: 'bg-gray-100' };
              const severityColors = {
                high: 'bg-red-100 text-red-800',
                medium: 'bg-yellow-100 text-yellow-800',
                low: 'bg-green-100 text-green-800'
              };
              return (
                <tr key={problem.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{store?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{problem.category}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{problem.description}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[problem.severity] || severityColors.medium}`}>
                      {problem.severity === 'high' ? '高' : problem.severity === 'low' ? '低' : '中'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    {problem.status === 'pending' && (
                      <button
                        onClick={() => { setSelectedProblem(problem); setShowRectifyForm(true); }}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        整改
                      </button>
                    )}
                    {problem.status === 'rectified' && (
                      <button
                        onClick={() => { setSelectedProblem(problem); setShowReviewForm(true); }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        复查
                      </button>
                    )}
                    {problem.status === 'rejected' && (
                      <button
                        onClick={() => { setSelectedProblem(problem); setShowRectifyForm(true); }}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        重新整改
                      </button>
                    )}
                    <button
                      onClick={() => onSelect(problem)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      历史
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {problems.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无问题，请先创建巡店记录并提交</div>
        )}
      </div>

      {showRectifyForm && selectedProblem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">提交整改记录</h3>
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="text-sm font-medium">原始问题:</div>
              <div className="text-sm text-gray-700">{selectedProblem.description}</div>
              <div className="text-xs text-gray-500 mt-1">原始照片: {selectedProblem.photos?.length || 0} 张</div>
            </div>
            <form onSubmit={submitRectification} className="space-y-4">
              <input
                required
                placeholder="整改人"
                value={rectForm.rectifier}
                onChange={e => setRectForm({ ...rectForm, rectifier: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">整改后照片（每行一个 URL）</label>
                <textarea
                  value={rectForm.photos}
                  onChange={e => setRectForm({ ...rectForm, photos: e.target.value })}
                  placeholder="https://example.com/rect1.jpg\nhttps://example.com/rect2.jpg"
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500">建议与原始问题照片数量对应</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">整改描述</label>
                <textarea
                  required
                  value={rectForm.description}
                  onChange={e => setRectForm({ ...rectForm, description: e.target.value })}
                  placeholder="详细描述整改措施..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  提交整改
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRectifyForm(false); setSelectedProblem(null); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReviewForm && selectedProblem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">提交复查意见（总部评分）</h3>
            <form onSubmit={submitReview} className="space-y-4">
              <input
                required
                placeholder="复查人"
                value={reviewForm.reviewer}
                onChange={e => setReviewForm({ ...reviewForm, reviewer: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">复查照片（可选）</label>
                <textarea
                  value={reviewForm.photos}
                  onChange={e => setReviewForm({ ...reviewForm, photos: e.target.value })}
                  placeholder="https://example.com/review1.jpg"
                  rows={2}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">复查意见</label>
                <textarea
                  required
                  value={reviewForm.comments}
                  onChange={e => setReviewForm({ ...reviewForm, comments: e.target.value })}
                  placeholder="详细描述复查结果..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">评分（0-100，可选）</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reviewForm.score}
                  onChange={e => setReviewForm({ ...reviewForm, score: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">复查结论</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="passed"
                      checked={reviewForm.passed}
                      onChange={() => setReviewForm({ ...reviewForm, passed: true })}
                      className="mr-2"
                    />
                    <span className="text-green-700">✓ 通过</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="passed"
                      checked={!reviewForm.passed}
                      onChange={() => setReviewForm({ ...reviewForm, passed: false })}
                      className="mr-2"
                    />
                    <span className="text-red-700">✗ 未通过（需重新整改）</span>
                  </label>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 text-white rounded ${reviewForm.passed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {reviewForm.passed ? '通过复查' : '驳回整改'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReviewForm(false); setSelectedProblem(null); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProblemTracking;
