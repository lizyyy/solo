import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function InspectionManagement({ onSelect }) {
  const [inspections, setInspections] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [newInspection, setNewInspection] = useState({
    store_id: '',
    inspector: '',
    inspection_date: '',
    photos: '',
    problems: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/stores`).then(r => r.json()),
      fetch(`${API_BASE}/api/inspections`).then(r => r.json())
    ]).then(([storesData, inspectionsData]) => {
      setStores(storesData);
      setInspections(inspectionsData);
    });
  };

  const createInspection = (e) => {
    e.preventDefault();
    const photos = newInspection.photos ? newInspection.photos.split('\n').filter(p => p.trim()) : [];
    let problems = [];
    try {
      if (newInspection.problems.trim()) {
        problems = JSON.parse(newInspection.problems);
      }
    } catch (e) {
      alert('问题格式错误，请使用 JSON 格式');
      return;
    }

    fetch(`${API_BASE}/api/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newInspection,
        photos,
        problems,
        inspection_date: newInspection.inspection_date || new Date().toISOString().split('T')[0]
      })
    })
      .then(r => r.json())
      .then(() => {
        loadData();
        setShowAddForm(false);
        setNewInspection({ store_id: '', inspector: '', inspection_date: '', photos: '', problems: '' });
      });
  };

  const validateInspection = (inspectionId) => {
    fetch(`${API_BASE}/api/validate/inspection/${inspectionId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setValidationResult(data);
        setSelectedInspection(inspections.find(i => i.id === inspectionId));
      });
  };

  const submitInspection = (inspectionId) => {
    fetch(`${API_BASE}/api/inspections/${inspectionId}/submit`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSubmitResult(data);
        loadData();
      });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">🔍 巡店记录</h2>
          <p className="text-gray-600 text-sm mt-1">验证巡店数据可靠性（照片完整、问题规范）</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新增巡店
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">新增巡店记录</h3>
          <form onSubmit={createInspection} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                required
                value={newInspection.store_id}
                onChange={e => setNewInspection({ ...newInspection, store_id: e.target.value })}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择门店</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
              <input
                required
                placeholder="巡店人"
                value={newInspection.inspector}
                onChange={e => setNewInspection({ ...newInspection, inspector: e.target.value })}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={newInspection.inspection_date}
                onChange={e => setNewInspection({ ...newInspection, inspection_date: e.target.value })}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                巡店照片（每行一个 URL）
              </label>
              <textarea
                value={newInspection.photos}
                onChange={e => setNewInspection({ ...newInspection, photos: e.target.value })}
                placeholder="https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg"
                rows={3}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发现问题（JSON 格式）
              </label>
              <textarea
                value={newInspection.problems}
                onChange={e => setNewInspection({ ...newInspection, problems: e.target.value })}
                placeholder={JSON.stringify([
                  { category: "卫生", description: "地面有污渍", photos: ["https://..."], severity: "high" }
                ], null, 2)}
                rows={6}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                每个问题包含: category, description, photos[] (可选), severity (low/medium/high)
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              保存
            </button>
          </form>
        </div>
      )}

      {submitResult && (
        <div className={`mb-6 p-4 rounded-lg ${submitResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="font-medium">{submitResult.message}</div>
          {submitResult.validation && (
            <div className="mt-2 text-sm">
              评分: {submitResult.validation.score} 分
              {!submitResult.success && submitResult.validation.errors && (
                <ul className="list-disc list-inside mt-1 text-red-600">
                  {submitResult.validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          <button onClick={() => setSubmitResult(null)} className="text-xs text-gray-500 mt-2">关闭</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">门店</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">巡店人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">日期</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">照片数</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">问题数</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inspections.map(inspection => {
              const store = stores.find(s => s.id === inspection.store_id);
              const statusConfig = STATUS_CONFIG[inspection.status] || { label: inspection.status, color: 'bg-gray-100' };
              return (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{store?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{inspection.inspector}</td>
                  <td className="px-4 py-3 text-sm">{inspection.inspection_date}</td>
                  <td className="px-4 py-3 text-sm">{inspection.photos?.length || 0}</td>
                  <td className="px-4 py-3 text-sm">{inspection.problems?.length || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => validateInspection(inspection.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      验证
                    </button>
                    {inspection.status === 'pending' && (
                      <button
                        onClick={() => submitInspection(inspection.id)}
                        className="text-green-600 hover:text-green-800"
                      >
                        提交
                      </button>
                    )}
                    <button
                      onClick={() => onSelect(inspection)}
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
        {inspections.length === 0 && (
          <div className="text-center py-8 text-gray-500">暂无巡店记录</div>
        )}
      </div>

      {validationResult && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              可靠性验证结果
            </h3>
            <span className={`px-3 py-1 rounded-full font-medium ${validationResult.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {validationResult.passed ? '✓ 可靠' : '✗ 不可靠'}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">可靠性评分:</span>
              <div className="w-64 h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${validationResult.score >= 80 ? 'bg-green-500' : validationResult.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${validationResult.score}%` }}
                />
              </div>
              <span className="font-bold">{validationResult.score}</span>
            </div>
          </div>

          {validationResult.currentBlock && (
            <div className="mb-4 p-3 bg-orange-50 border-l-4 border-orange-500">
              <div className="font-medium text-orange-800">🚧 当前卡点</div>
              <p className="text-sm text-orange-700">{validationResult.currentBlock}</p>
            </div>
          )}

          {validationResult.errors?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-700 mb-2">❌ 错误</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-600">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-yellow-700 mb-2">⚠️ 警告</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-600">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.suggestions?.length > 0 && (
            <div>
              <h4 className="font-medium text-blue-700 mb-2">💡 处理建议</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-blue-600">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InspectionManagement;
