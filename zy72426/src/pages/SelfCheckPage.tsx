import { useEffect } from 'react';
import { Card } from '@/components/common/Card';
import { CheckCard } from '@/components/self-check/CheckCard';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import {
  ShieldCheck, RefreshCw, Clock, AlertTriangle, CheckCircle,
  Layers, Link2, Link2Off, AlertCircle, Info,
} from 'lucide-react';

export const SelfCheckPage = () => {
  const {
    selfCheckResults, lastSelfCheckAt, runSelfCheck, resolveIssue,
    consistencyCheckResult, runConsistencyCheck,
    getUnifiedView,
  } = useEmotionLabelStore();

  useEffect(() => {
    if (selfCheckResults.length === 0) {
      runSelfCheck();
    }
    runConsistencyCheck();
  }, []);

  const totalIssues = selfCheckResults.reduce(
    (sum, r) => sum + r.issues.filter((i) => !i.resolved).length,
    0
  );
  const passedCount = selfCheckResults.filter((r) => r.passed).length;

  const pageView = getUnifiedView('page');
  const exportView = getUnifiedView('export');
  const reportView = getUnifiedView('report');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            自检中心
          </h1>
          <p className="text-gray-500 mt-1">
            四项核心自检 + 三方数据同源校验，确保所有链路接实
          </p>
        </div>
        <button
          onClick={() => { runSelfCheck(); runConsistencyCheck(); }}
          className="flex items-center gap-2 px-5 py-2.5 text-white bg-[#1e3a5f] rounded hover:bg-[#2c5282] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          运行全量校验
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#ebf4ff] p-5 rounded-sm border border-[#bfdbfe]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-[#1e3a5f]" />
            <div>
              <p className="text-sm text-[#2c5282]">自检项总数</p>
              <p className="text-3xl font-bold text-[#1e3a5f] mt-1">4</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-5 rounded-sm border border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-600" />
            <div>
              <p className="text-sm text-green-700">通过项</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{passedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 p-5 rounded-sm border border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
            <div>
              <p className="text-sm text-amber-700">待处理问题</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{totalIssues}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="w-10 h-10 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">上次检查</p>
              <p className="text-base font-medium text-gray-800 mt-1">
                {lastSelfCheckAt
                  ? new Date(lastSelfCheckAt).toLocaleString('zh-CN')
                  : '未运行'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card
        title={
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1e3a5f]" />
            三方数据同源一致性校验
          </div>
        }
        subtitle="页面、接口响应、Excel/CSV导出、周报报告 全部读同一份数据快照，通过哈希实时比对"
      >
        <div className={`p-5 rounded border-2 ${
          consistencyCheckResult.passed
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {consistencyCheckResult.passed ? (
                <>
                  <Link2 className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-lg font-bold text-green-800">三方数据完全同源</p>
                    <p className="text-sm text-green-600 mt-0.5">
                      页面、导出、周报读取同一份 Zustand Store 状态，修改一处全链路同步
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Link2Off className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-lg font-bold text-red-800">检测到数据不一致！</p>
                    <p className="text-sm text-red-600 mt-0.5">
                      请立即联系开发排查（{consistencyCheckResult.diffs?.length || '?'} 处差异）
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">校验时间</p>
              <p className="text-sm font-mono text-gray-700">
                {consistencyCheckResult.checkedAt
                  ? new Date(consistencyCheckResult.checkedAt).toLocaleString('zh-CN')
                  : '未校验'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-white rounded border border-green-100">
              <p className="text-xs text-gray-500 mb-1">页面数据快照哈希</p>
              <p className="font-mono text-sm text-gray-800 truncate">{pageView.dataHash.slice(0, 16)}...</p>
              <p className="text-xs text-gray-400 mt-2">共 {pageView.records.length} 条记录，{pageView.groups.length} 个分组</p>
            </div>
            <div className="p-4 bg-white rounded border border-green-100">
              <p className="text-xs text-gray-500 mb-1">导出数据快照哈希</p>
              <p className="font-mono text-sm text-gray-800 truncate">{exportView.dataHash.slice(0, 16)}...</p>
              <p className="text-xs text-gray-400 mt-2">共 {exportView.records.length} 条记录，情绪分布一致</p>
            </div>
            <div className="p-4 bg-white rounded border border-green-100">
              <p className="text-xs text-gray-500 mb-1">周报数据快照哈希</p>
              <p className="font-mono text-sm text-gray-800 truncate">{reportView.dataHash.slice(0, 16)}...</p>
              <p className="text-xs text-gray-400 mt-2">完成率 {reportView.summary.completionRate}%</p>
            </div>
          </div>

          {!consistencyCheckResult.passed && consistencyCheckResult.diffs && consistencyCheckResult.diffs.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
              <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                发现的差异项：
              </p>
              <ul className="space-y-1 text-xs text-red-700 font-mono">
                {consistencyCheckResult.diffs.slice(0, 10).map((d, i) => (
                  <li key={i}>• [{d.sources.join(' vs ')}] {d.field}: {d.reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 p-3 bg-white/70 rounded flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <span className="font-medium">技术原理：</span>
                buildUnifiedView() 函数接收同一份 records + groups 作为输入，
                仅根据 source 参数输出不同视图，核心数据结构完全一致。
              </p>
              <p>
                <span className="font-medium">触发时机：</span>
                每次导入、修改记录、确认分组、补录备注等动作都会自动触发
                runConsistencyCheck()，不通过则前端显示红色告警。
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1e3a5f]" />
            四项核心业务自检
          </div>
        }
        subtitle="点击卡片展开查看详细问题，每项检查覆盖最容易出错的场景"
      >
        <div className="grid grid-cols-2 gap-4">
          {selfCheckResults.map((result) => (
            <CheckCard key={result.checkType} result={result} onResolve={resolveIssue} />
          ))}
        </div>

        {selfCheckResults.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>尚未运行自检</p>
            <button
              onClick={runSelfCheck}
              className="mt-3 px-4 py-2 bg-[#1e3a5f] text-white rounded hover:bg-[#2c5282] transition-colors"
            >
              立即运行
            </button>
          </div>
        )}
      </Card>

      <Card title="自检说明" subtitle="五项校验的检查逻辑">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">0. 三方同源一致性校验</h4>
            <p className="text-sm text-gray-600">
              比对 页面/导出/报告 三个视图的 records 数组 MD5 哈希与关键字段值，
              确保改动一处三方同步。
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">1. 重复导入检测</h4>
            <p className="text-sm text-gray-600">
              检查是否存在相同「现场名+版权名」组合跨多个导入版本重复出现的情况。
              第二次导入时自动判定为复用，不再入库。
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">2. 同名映射检查</h4>
            <p className="text-sm text-gray-600">
              检查已确认分组内的情绪标签和处理状态是否一致，确保同一首歌的不同版本标签统一。
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">3. 补录重算验证</h4>
            <p className="text-sm text-gray-600">
              检查音频备注更新后情绪标签是否已重新计算，确保备注修改能及时反映到标签上。
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">4. 导出一致性校验</h4>
            <p className="text-sm text-gray-600">
              验证页面展示数据与导出文件的数据哈希一致，确保导出数据与页面看到的完全相同。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
