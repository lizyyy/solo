import { useState, useEffect } from 'react';
import { API_BASE, STATUS_CONFIG } from '../App';

function ValidationDemo() {
  const [stores, setStores] = useState([]);
  const [demoCases, setDemoCases] = useState([]);
  const [runningDemo, setRunningDemo] = useState(null);
  const [demoResults, setDemoResults] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [problems, setProblems] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      fetch(`${API_BASE}/api/stores`).then(r => r.json()),
      fetch(`${API_BASE}/api/inspections`).then(r => r.json()),
      fetch(`${API_BASE}/api/problems`).then(r => r.json())
    ]).then(([s, i, p]) => {
      setStores(s);
      setInspections(i);
      setProblems(p);
      buildDemoCases(s, i, p);
    });
  };

  const buildDemoCases = (s, i, p) => {
    const cases = [];

    const validStore = s.find(store => store.status === 'active' && store.authorized);
    if (validStore) {
      cases.push({
        id: 'case-pass',
        type: '门店档案验证 - 通过',
        description: '状态激活、已授权的门店',
        target: { type: 'store', id: validStore.id, name: validStore.name },
        expected: 'passed',
        icon: '✓'
      });
    }

    const invalidStore = s.find(store => store.status !== 'active' || !store.authorized);
    if (invalidStore) {
      cases.push({
        id: 'case-fail',
        type: '门店档案验证 - 失败',
        description: '状态非激活或未授权的门店',
        target: { type: 'store', id: invalidStore.id, name: invalidStore.name },
        expected: 'failed',
        icon: '✗'
      });
    }

    if (i.length > 0) {
      const insp = i[0];
      const storeName = s.find(st => st.id === insp.store_id)?.name || '';
      cases.push({
        id: 'case-inspection',
        type: '巡店记录可靠性验证',
        description: `检查照片完整性、问题描述规范 (${storeName})`,
        target: { type: 'inspection', id: insp.id },
        expected: 'auto',
        icon: '🔍'
      });
    }

    if (p.length > 0) {
      const prob = p[0];
      const storeName = s.find(st => st.id === prob.store_id)?.name || '';
      cases.push({
        id: 'case-problem',
        type: '整改任务一致性验证',
        description: `整改照片、复查意见与原始问题对齐 (${storeName})`,
        target: { type: 'problem', id: prob.id },
        expected: 'auto',
        icon: '⚖️'
      });
    }

    cases.push({
      id: 'case-invalid',
      type: '边界测试 - 无效ID',
      description: '验证一个不存在的实体',
      target: { type: 'store', id: 'non-existent-id' },
      expected: 'failed',
      icon: '⚠️'
    });

    setDemoCases(cases);
  };

  const runDemo = async (demoCase) => {
    setRunningDemo(demoCase.id);
    const start = Date.now();
    
    const endpoint = demoCase.target.type === 'store' 
      ? `${API_BASE}/api/validate/store/${demoCase.target.id}`
      : demoCase.target.type === 'inspection'
      ? `${API_BASE}/api/validate/inspection/${demoCase.target.id}`
      : `${API_BASE}/api/validate/problem/${demoCase.target.id}`;
    
    const response = await fetch(endpoint, { method: 'POST' });
    const result = await response.json();
    const duration = Date.now() - start;

    const actualStatus = result.passed ? 'passed' : 'failed';
    const matchStatus = demoCase.expected === 'auto' 
      ? 'auto' 
      : (actualStatus === demoCase.expected ? 'match' : 'mismatch');

    const demoResult = {
      ...demoCase,
      result,
      duration,
      actualStatus,
      matchStatus,
      timestamp: new Date().toLocaleTimeString()
    };

    setDemoResults(prev => [demoResult, ...prev]);
    setRunningDemo(null);
  };

  const runAllDemos = async () => {
    for (const demoCase of demoCases) {
      await runDemo(demoCase);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">✅ 验证演示</h2>
          <p className="text-gray-600 text-sm mt-1">验收场景：正常处理 ✓ | 失败原因 ❌ | 修正后重跑 🔄</p>
        </div>
        {demoCases.length > 0 && (
          <button
            onClick={runAllDemos}
            disabled={runningDemo !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            运行全部演示
          </button>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-medium mb-3 text-gray-700">🎯 演示用例</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {demoCases.map(demoCase => (
            <div key={demoCase.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{demoCase.icon}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  demoCase.expected === 'passed' ? 'bg-green-100 text-green-800' :
                  demoCase.expected === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  期望: {demoCase.expected === 'passed' ? '通过' : demoCase.expected === 'failed' ? '失败' : '自动检测'}
                </span>
              </div>
              <h4 className="font-medium text-gray-800">{demoCase.type}</h4>
              <p className="text-sm text-gray-600 mt-1">{demoCase.description}</p>
              {demoCase.target.name && (
                <p className="text-xs text-gray-500 mt-1">目标: {demoCase.target.name}</p>
              )}
              <button
                onClick={() => runDemo(demoCase)}
                disabled={runningDemo === demoCase.id}
                className="mt-3 w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {runningDemo === demoCase.id ? '运行中...' : '运行'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {demoResults.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 text-gray-700">📋 运行结果</h3>
          <div className="space-y-4">
            {demoResults.map((dr, idx) => (
              <div key={`${dr.id}-${idx}`} className="bg-white rounded-lg shadow overflow-hidden">
                <div className={`p-4 ${dr.matchStatus === 'mismatch' ? 'bg-orange-50 border-l-4 border-orange-500' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{dr.icon}</span>
                      <span className="font-medium">{dr.type}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full font-medium ${
                        dr.actualStatus === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {dr.actualStatus === 'passed' ? '✓ 通过' : '✗ 失败'}
                      </span>
                      <span className="text-xs text-gray-500">{dr.duration}ms</span>
                      <span className="text-xs text-gray-500">{dr.timestamp}</span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">评分:</span>
                      <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            dr.result.score >= 80 ? 'bg-green-500' : 
                            dr.result.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${dr.result.score}%` }}
                        />
                      </div>
                      <span className="font-bold text-sm">{dr.result.score}</span>
                    </div>
                  </div>

                  {dr.result.currentBlock && (
                    <div className="mb-3 p-2 bg-orange-50 rounded text-sm text-orange-700">
                      🚧 卡点: {dr.result.currentBlock}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dr.result.errors?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-red-700 mb-1">❌ 错误</h5>
                        <ul className="list-disc list-inside space-y-0.5">
                          {dr.result.errors.map((e, i) => (
                            <li key={i} className="text-sm text-red-600">{e}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dr.result.warnings?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-yellow-700 mb-1">⚠️ 警告</h5>
                        <ul className="list-disc list-inside space-y-0.5">
                          {dr.result.warnings.map((w, i) => (
                            <li key={i} className="text-sm text-yellow-600">{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {dr.result.suggestions?.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-sm font-medium text-blue-700 mb-1">💡 处理建议</h5>
                      <ul className="list-disc list-inside space-y-0.5">
                        {dr.result.suggestions.map((s, i) => (
                          <li key={i} className="text-sm text-blue-600">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">📖 验收标准说明</h3>
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">✓</span>
              <span className="font-semibold text-green-800">正常处理（通过）</span>
            </div>
            <p className="text-sm text-green-700 mb-2">当验证结果满足以下条件时，代表通过验收：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-green-600">
              <li><code className="bg-green-100 px-1 rounded">passed = true</code></li>
              <li><code className="bg-green-100 px-1 rounded">score >= 80</code></li>
              <li><code className="bg-green-100 px-1 rounded">errors</code> 数组为空</li>
              <li>没有 <code className="bg-green-100 px-1 rounded">currentBlock</code>（无卡点）</li>
            </ul>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">❌</span>
              <span className="font-semibold text-red-800">失败原因</span>
            </div>
            <p className="text-sm text-red-700 mb-2">当验证失败时，需要人工处理：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
              <li><code className="bg-red-100 px-1 rounded">passed = false</code></li>
              <li><code className="bg-red-100 px-1 rounded">score {'<'} 50</code>（严重问题）</li>
              <li><code className="bg-red-100 px-1 rounded">errors</code> 数组包含具体错误原因</li>
              <li><code className="bg-red-100 px-1 rounded">currentBlock</code> 指明当前卡点</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">🔄</span>
              <span className="font-semibold text-yellow-800">修正后重跑</span>
            </div>
            <p className="text-sm text-yellow-700 mb-2">存在警告或修正失败后，可重新验证：</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-600">
              <li><code className="bg-yellow-100 px-1 rounded">warnings</code> 数组非空（建议改进）</li>
              <li>{'50 ≤ score < 80'}（可改进空间）</li>
              <li>根据 <code className="bg-yellow-100 px-1 rounded">suggestions</code> 修正后重新验证</li>
              <li>验证历史记录追踪每次运行结果</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValidationDemo;
