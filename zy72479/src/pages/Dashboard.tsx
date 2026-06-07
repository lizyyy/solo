import { CaseList } from '../components/CaseList';
import { useCaseStore } from '../store/useCaseStore';
import { Volume2, AlertTriangle, CheckCircle, Clock, RefreshCw, FileText } from 'lucide-react';

export function Dashboard() {
  const { cases, resetToInitialData } = useCaseStore();

  const stats = {
    total: cases.length,
    normal: cases.filter(c => c.status === 'normal').length,
    pending: cases.filter(c => c.status === 'pending_review').length,
    conflict: cases.filter(c => c.status === 'conflict').length,
    supplemented: cases.filter(c => c.status === 'supplemented').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Volume2 className="w-7 h-7" />
              <div>
                <h1 className="text-lg font-bold">夜间经济噪声调解系统</h1>
                <p className="text-xs text-primary-200">路口照片 + 公交刷卡时段 证据整合平台</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={resetToInitialData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重置演示数据
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
                  姜
                </div>
                <span className="text-sm">街道规划员 小姜</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">全部案件</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.normal}</p>
                <p className="text-xs text-gray-500">正常结案</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-xs text-gray-500">待书记复核</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-danger-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.conflict}</p>
                <p className="text-xs text-gray-500">冲突待处理</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CaseList />
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">处理结果说明</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-success-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">顺利记录</p>
                    <p className="text-xs text-gray-500">路口照片与公交刷卡时段证据一致，居民意见完整</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-warning-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">居民意见仅汇总</p>
                    <p className="text-xs text-gray-500">居民意见只剩汇总没有原文，需社区书记复核</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">旧口径补录</p>
                    <p className="text-xs text-gray-500">从公交刷卡时段补录的历史口径，与主流程有时间差</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-danger-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">冲突待复核</p>
                    <p className="text-xs text-gray-500">两类证据互相矛盾，需人工确认或驳回</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 rounded-lg border border-primary-200 p-5">
              <h3 className="text-sm font-semibold text-primary-800 mb-3">操作提示</h3>
              <ul className="space-y-2 text-xs text-primary-700">
                <li className="flex items-start gap-1.5">
                  <span className="font-medium">1.</span>
                  点击左侧案件进入详情页查看完整证据
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-medium">2.</span>
                  系统不会自动拍板冲突，需小姜人工选择确认/驳回
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-medium">3.</span>
                  居民意见只剩汇总时，不会自动归正常，留给社区书记复核
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-medium">4.</span>
                  所有操作都会记录在历史时间线中，可追溯
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">样例案件速查</h3>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-success-50 rounded border border-success-100">
                  <p className="font-medium text-success-700">case-001：顺利记录</p>
                  <p className="text-success-600 mt-0.5">证据一致，居民意见完整</p>
                </div>
                <div className="p-2 bg-warning-50 rounded border border-warning-100">
                  <p className="font-medium text-warning-700">case-002：仅汇总待复核</p>
                  <p className="text-warning-600 mt-0.5">居民意见无原文，待书记复核</p>
                </div>
                <div className="p-2 bg-primary-50 rounded border border-primary-100">
                  <p className="font-medium text-primary-700">case-003：旧口径补录</p>
                  <p className="text-primary-600 mt-0.5">公交刷卡时段补录历史数据</p>
                </div>
                <div className="p-2 bg-danger-50 rounded border border-danger-100">
                  <p className="font-medium text-danger-700">case-004：冲突待处理</p>
                  <p className="text-danger-600 mt-0.5">照片与刷卡时段证据矛盾</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
