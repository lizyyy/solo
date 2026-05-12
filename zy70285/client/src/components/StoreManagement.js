import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function StoreManagement() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', code: '', address: '', manager: '' });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = () => {
    fetch(`${API_BASE}/api/stores`)
      .then(r => r.json())
      .then(data => setStores(data));
  };

  const validateStore = (storeId) => {
    fetch(`${API_BASE}/api/validate/store/${storeId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setValidationResult(data);
        setSelectedStore(stores.find(s => s.id === storeId));
      });
  };

  const addStore = (e) => {
    e.preventDefault();
    fetch(`${API_BASE}/api/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStore)
    })
      .then(r => r.json())
      .then(() => {
        loadStores();
        setShowAddForm(false);
        setNewStore({ name: '', code: '', address: '', manager: '' });
      });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">🏪 门店档案</h2>
          <p className="text-gray-600 text-sm mt-1">验证门店是否可接受巡店（状态激活、已授权）</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 新增门店
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium mb-4">新增门店</h3>
          <form onSubmit={addStore} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              placeholder="门店名称"
              value={newStore.name}
              onChange={e => setNewStore({ ...newStore, name: e.target.value })}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              required
              placeholder="门店编码"
              value={newStore.code}
              onChange={e => setNewStore({ ...newStore, code: e.target.value })}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="门店地址"
              value={newStore.address}
              onChange={e => setNewStore({ ...newStore, address: e.target.value })}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="门店负责人"
              value={newStore.manager}
              onChange={e => setNewStore({ ...newStore, manager: e.target.value })}
              className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="md:col-span-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">门店编码</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">门店名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">授权</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">负责人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stores.map(store => {
              const statusConfig = STATUS_CONFIG[store.status] || { label: store.status, color: 'bg-gray-100' };
              return (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{store.code}</td>
                  <td className="px-4 py-3 text-sm">{store.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${store.authorized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {store.authorized ? '已授权' : '未授权'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{store.manager || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => validateStore(store.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      验证档案
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {validationResult && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              验证结果 - {selectedStore?.name}
            </h3>
            <span className={`px-3 py-1 rounded-full font-medium ${validationResult.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {validationResult.passed ? '✓ 通过' : '✗ 未通过'}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">验评分:</span>
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

          {validationResult.errors && validationResult.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-700 mb-2">❌ 错误</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-600">{e}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings && validationResult.warnings.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-yellow-700 mb-2">⚠️ 警告</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-600">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.suggestions && validationResult.suggestions.length > 0 && (
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

export default StoreManagement;
