import React from 'react';
import { useQuery } from 'react-query';
import { getHealth, getStats } from '../services/api';

function Settings() {
  const { data: health } = useQuery('health', () => getHealth());
  const { data: stats } = useQuery('stats', () => getStats(), {
    refetchInterval: 30000,
  });

  const systemInfo = [
    { label: '系统名称', value: '理财收益到账核对台' },
    { label: '数据存储', value: 'SQLite (本地文件)' },
    { label: '后端框架', value: 'Node.js + Express' },
    { label: '前端框架', value: 'React + Vite' },
    { label: '服务器状态', value: health?.data?.status === 'ok' ? '运行中' : '未连接', status: health?.data?.status === 'ok' ? 'success' : 'error' },
  ];

  const dataStats = [
    { label: '产品数量', value: stats?.data?.products || 0, icon: '📦' },
    { label: '账户数量', value: stats?.data?.accounts || 0, icon: '🏦' },
    { label: '持有人数量', value: stats?.data?.holders || 0, icon: '👥' },
    { label: '认购记录', value: stats?.data?.subscriptions || 0, icon: '📊' },
    { label: '交易流水', value: stats?.data?.transactions || 0, icon: '📄' },
    { label: '应到账计划', value: stats?.data?.expectedPayouts || 0, icon: '💰' },
    { label: '核对记录', value: stats?.data?.reconciliations || 0, icon: '✅' },
    { label: '分摊记录', value: stats?.data?.allocations || 0, icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-gray-500 mt-1">查看系统信息和数据统计</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">系统信息</h2>
          <div className="space-y-3">
            {systemInfo.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-medium ${
                  item.status === 'success' ? 'text-green-600' : 
                  item.status === 'error' ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">数据统计</h2>
          <div className="grid grid-cols-2 gap-4">
            {dataStats.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">快速开始</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li>在 <strong>数据导入</strong> 页面导入产品数据 (products.csv)</li>
              <li>导入交易流水 (transactions.csv)</li>
              <li>导入认购份额 (subscriptions.csv) - 支持多人合买份额分摊</li>
              <li>可选：导入收益规则 (payout-rules.json)</li>
              <li>在 <strong>仪表板</strong> 点击"计算应到账计划"生成预期收益</li>
              <li>点击"自动匹配流水"将银行流水与应到账计划进行匹配</li>
              <li>点击"生成分摊记录"按份额比例计算每人应得金额</li>
              <li>在 <strong>核对看板</strong> 查看匹配结果，处理异常记录</li>
              <li>在 <strong>导出报告</strong> 页面导出核对报告和分摊明细</li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">状态说明</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="badge status-badge-matched">已匹配</span>
                <span className="text-sm text-gray-600">金额完全匹配</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge status-badge-unmatched">未到账</span>
                <span className="text-sm text-gray-600">未找到对应流水</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge status-badge-underpaid">少到账</span>
                <span className="text-sm text-gray-600">实际金额少于预期</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge status-badge-overpaid">多到账</span>
                <span className="text-sm text-gray-600">实际金额多于预期</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge status-badge-pending">待处理</span>
                <span className="text-sm text-gray-600">等待确认</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge status-badge-manual">手工调整</span>
                <span className="text-sm text-gray-600">人工确认调整</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">常见问题</h3>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-800">Q: 为什么有些流水无法自动匹配？</p>
                <p className="text-sm text-gray-600 mt-1">
                  A: 自动匹配基于金额和日期范围。如果金额不完全一致，或日期差距较大，需要在核对看板中手工匹配。
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-800">Q: 分摊比例如何计算？</p>
                <p className="text-sm text-gray-600 mt-1">
                  A: 分摊比例基于认购份额自动计算。如果同一产品有多个持有人，系统会按每人的份额比例自动分摊本金、利息、费用和差额。
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-800">Q: 数据存储在哪里？</p>
                <p className="text-sm text-gray-600 mt-1">
                  A: 所有数据存储在本地 SQLite 数据库文件中，不会上传到任何服务器。数据库文件位于 backend/data/finance.db。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">本地启动方式</h2>
        
        <div className="bg-gray-800 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
          <p className="text-gray-400"># 1. 进入后端目录并安装依赖</p>
          <p>cd backend</p>
          <p>npm install</p>
          <p className="mt-4 text-gray-400"># 2. 启动后端服务器 (端口 3001)</p>
          <p>npm run dev</p>
          <p className="mt-4 text-gray-400"># 3. 打开新终端，进入前端目录并安装依赖</p>
          <p>cd frontend</p>
          <p>npm install</p>
          <p className="mt-4 text-gray-400"># 4. 启动前端开发服务器 (端口 5173)</p>
          <p>npm run dev</p>
          <p className="mt-4 text-gray-400"># 5. 打开浏览器访问</p>
          <p>open http://localhost:5173</p>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>提示：</strong> 首次运行时，数据库会自动初始化。可以在数据导入页面使用样例数据测试功能。
          </p>
        </div>
      </div>
    </div>
  );
}

export default Settings;
