import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, RefreshCw, BarChart3, Users, ShieldCheck, Layers } from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore.js';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  'DRAFT': { label: '草稿', color: 'text-navy-500', bg: 'bg-navy-100' },
  'IMPORTED': { label: '已导入', color: 'text-navy-600', bg: 'bg-navy-100' },
  'RISK_REVIEWED': { label: '风控已复核', color: 'text-audit-orange', bg: 'bg-audit-orange/10' },
  'AUDITED': { label: '审计已完成', color: 'text-navy-600', bg: 'bg-navy-100' },
  'COMPLETED': { label: '已完成', color: 'text-audit-green', bg: 'bg-audit-green/10' }
};

const roleLabels: Record<string, { name: string; icon: React.ReactNode }> = {
  'trustee': { name: '托管对接人', icon: <Users size={16} /> },
  'risk_control': { name: '风控值班', icon: <ShieldCheck size={16} /> },
  'auditor': { name: '审计人员', icon: <Layers size={16} /> }
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { batches, currentUser, loadBatches, loading } = useSettlementStore();

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const roleInfo = roleLabels[currentUser.role] || roleLabels.trustee;

  const stats = {
    total: batches.length,
    pending: batches.filter(b => b.status !== 'COMPLETED').length,
    hasWarning: batches.filter(b => b.warningCount > 0).length,
    completed: batches.filter(b => b.status === 'COMPLETED').length
  };

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="bg-white border-b border-navy-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-navy-800">保险佣金阶梯结算</h1>
            <p className="text-sm text-navy-500 mt-1">三步工作流 · 四类自检 · 审计追踪 · 单一数据源</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-navy-800 flex items-center gap-2">
                {roleInfo.icon}
                {currentUser.name}
              </p>
              <p className="text-xs text-navy-500">{roleInfo.name}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-semibold">
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-navy-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-navy-500">总批次</p>
              <FileText size={20} className="text-navy-400" />
            </div>
            <p className="text-3xl font-bold text-navy-800 font-mono">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border border-navy-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-navy-500">处理中</p>
              <RefreshCw size={20} className="text-navy-400" />
            </div>
            <p className="text-3xl font-bold text-navy-700 font-mono">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg border border-navy-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-navy-500">有异常</p>
              <BarChart3 size={20} className="text-audit-orange" />
            </div>
            <p className="text-3xl font-bold text-audit-orange font-mono">{stats.hasWarning}</p>
          </div>
          <div className="bg-white rounded-lg border border-navy-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-navy-500">已完成</p>
              <ShieldCheck size={20} className="text-audit-green" />
            </div>
            <p className="text-3xl font-bold text-audit-green font-mono">{stats.completed}</p>
          </div>
        </div>

        {(currentUser.role === 'risk_control' || currentUser.role === 'auditor') && (
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => navigate('/import')}
              className="flex items-center gap-2 px-6 py-3 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium shadow-lg hover:shadow-xl"
            >
              <Plus size={20} />
              新建批次（导入除权日截图）
            </button>
            <button
              onClick={() => navigate('/replay')}
              className="flex items-center gap-2 px-6 py-3 bg-white text-navy-800 border border-navy-300 rounded-lg hover:bg-navy-50 transition-colors font-medium"
            >
              <RefreshCw size={20} />
              复盘控制台
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg border border-navy-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-200 flex items-center justify-between">
            <h2 className="font-display text-xl text-navy-800">批次列表</h2>
            <button
              onClick={() => loadBatches()}
              className="text-sm text-navy-600 hover:text-navy-800 flex items-center gap-1"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          <div className="divide-y divide-navy-100">
            {batches.map(batch => {
              const status = statusConfig[batch.status] || statusConfig.DRAFT;
              return (
                <div
                  key={batch.id}
                  onClick={() => navigate(`/batch/${batch.id}`)}
                  className="px-6 py-4 hover:bg-navy-50 cursor-pointer transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-navy-100 flex items-center justify-center text-navy-600 font-semibold font-mono">
                      {batch.batchNo.slice(-3)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-800 group-hover:text-navy-600">
                        {batch.batchNo}
                      </h3>
                      <p className="text-sm text-navy-500 font-mono">
                        {batch.sourceFile} · {batch.totalCount} 条明细
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {batch.warningCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-audit-orange/10 text-audit-orange text-xs font-medium rounded">
                        {batch.warningCount} 项异常
                      </span>
                    )}
                    {batch.hasMixedCurrency > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-audit-orange/10 text-audit-orange text-xs font-medium rounded">
                        {batch.hasMixedCurrency} 条混币
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    <div className="text-right">
                      <p className="text-sm text-navy-600 font-mono">
                        ¥ {batch.totalNetAmount.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-navy-400">{batch.importedAt.slice(0, 10)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {batches.length === 0 && !loading && (
            <div className="p-16 text-center">
              <FileText size={48} className="mx-auto text-navy-300 mb-4" />
              <p className="text-navy-500 font-display text-lg mb-2">暂无结算批次</p>
              <p className="text-sm text-navy-400 mb-6">点击上方按钮导入除权日截图开始新的结算</p>
              {(currentUser.role === 'risk_control' || currentUser.role === 'auditor') && (
                <button
                  onClick={() => navigate('/import')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
                >
                  <Plus size={20} />
                  新建批次
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
