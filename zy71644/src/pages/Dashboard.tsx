import { useAppStore } from '@/store';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { bonds, curves, reports, importMockData } = useAppStore();

  const statusCounts = {
    processed: reports.filter((r) => r.status === 'PROCESSED').length,
    pending: reports.filter((r) => r.status === 'PENDING_CONFIRM').length,
    returned: reports.filter((r) => r.status === 'RETURNED').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy-800">欢迎使用久期凸性解释器</h1>
          <p className="mt-1 text-navy-500 text-sm">专业的固定收益分析工具，助您轻松解释价格变动</p>
        </div>
        {bonds.length === 0 && curves.length === 0 && (
          <button
            onClick={importMockData}
            className="btn-gold text-sm"
          >
            导入示例数据
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">债券数量</p>
              <p className="mt-2 text-3xl font-bold text-navy-800 font-serif">{bonds.length}</p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
          <Link to="/bonds" className="mt-4 inline-block text-sm text-gold-600 hover:underline">
            管理债券 →
          </Link>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">收益率曲线</p>
              <p className="mt-2 text-3xl font-bold text-navy-800 font-serif">{curves.length}</p>
            </div>
            <span className="text-3xl">📈</span>
          </div>
          <Link to="/curves" className="mt-4 inline-block text-sm text-gold-600 hover:underline">
            管理曲线 →
          </Link>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">分析报告</p>
              <p className="mt-2 text-3xl font-bold text-navy-800 font-serif">{reports.length}</p>
            </div>
            <span className="text-3xl">📑</span>
          </div>
          <Link to="/reports" className="mt-4 inline-block text-sm text-gold-600 hover:underline">
            查看报告 →
          </Link>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-navy-500 text-sm">待确认</p>
              <p className="mt-2 text-3xl font-bold text-yellow-600 font-serif">{statusCounts.pending}</p>
            </div>
            <span className="text-3xl">⏳</span>
          </div>
          <Link to="/calculator" className="mt-4 inline-block text-sm text-gold-600 hover:underline">
            开始计算 →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">快速开始</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 text-xs flex items-center justify-center font-medium shrink-0">1</span>
              <div>
                <p className="text-sm font-medium text-navy-700">导入债券信息</p>
                <p className="text-xs text-navy-500 mt-1">录入债券条款或从Excel导入</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 text-xs flex items-center justify-center font-medium shrink-0">2</span>
              <div>
                <p className="text-sm font-medium text-navy-700">配置收益率曲线</p>
                <p className="text-xs text-navy-500 mt-1">导入市场数据，选择插值方法</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 text-xs flex items-center justify-center font-medium shrink-0">3</span>
              <div>
                <p className="text-sm font-medium text-navy-700">计算久期与凸性</p>
                <p className="text-xs text-navy-500 mt-1">查看分步计算过程，追溯异常</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 text-xs flex items-center justify-center font-medium shrink-0">4</span>
              <div>
                <p className="text-sm font-medium text-navy-700">生成分析报告</p>
                <p className="text-xs text-navy-500 mt-1">导出Excel/PDF，标记状态交接</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">核心概念</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="p-3 bg-navy-50 rounded">
              <p className="text-sm font-medium text-navy-700">久期 (Duration)</p>
              <p className="text-xs text-navy-500 mt-1">
                衡量债券价格对收益率变动的敏感度，是现金流回流时间的加权平均。
              </p>
            </div>
            <div className="p-3 bg-navy-50 rounded">
              <p className="text-sm font-medium text-navy-700">凸性 (Convexity)</p>
              <p className="text-xs text-navy-500 mt-1">
                衡量久期本身对收益率变动的敏感度，用于修正大变动时的价格估计。
              </p>
            </div>
            <div className="p-3 bg-gold-50 rounded border border-gold-200">
              <p className="text-sm font-medium text-gold-700">小变动 vs 大变动</p>
              <p className="text-xs text-gold-600 mt-1">
                收益率小变动（±1bp）时，久期效应为主；大变动（±100bp）时，必须考虑凸性修正才能准确估计价格变动。
              </p>
            </div>
          </div>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-serif font-semibold text-navy-800">最近报告</h3>
            <Link to="/reports" className="text-sm text-navy-500 hover:text-navy-700">
              查看全部
            </Link>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {reports.slice(0, 5).map((report) => {
                const bond = bonds.find((b) => b.id === report.bondId);
                return (
                  <div 
                    key={report.id} 
                    className="flex items-center justify-between p-3 hover:bg-navy-50 rounded transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy-700">
                        {bond?.name || '未知债券'}
                      </p>
                      <p className="text-xs text-navy-500">
                        估值日: {report.params.valuationDate} | 生成于 {report.createdAt.split('T')[0]}
                      </p>
                    </div>
                    <span className={`status-badge ${
                      report.status === 'PROCESSED' ? 'status-processed' :
                      report.status === 'PENDING_CONFIRM' ? 'status-pending' :
                      'status-returned'
                    }`}>
                      {report.status === 'PROCESSED' ? '已处理' :
                       report.status === 'PENDING_CONFIRM' ? '待确认' : '已退回'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
