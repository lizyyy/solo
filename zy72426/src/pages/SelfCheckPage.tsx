import { useEffect } from 'react';
import { Card } from '@/components/common/Card';
import { CheckCard } from '@/components/self-check/CheckCard';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { ShieldCheck, RefreshCw, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export const SelfCheckPage = () => {
  const { selfCheckResults, lastSelfCheckAt, runSelfCheck, resolveIssue } = useEmotionLabelStore();

  useEffect(() => {
    if (selfCheckResults.length === 0) {
      runSelfCheck();
    }
  }, []);

  const totalIssues = selfCheckResults.reduce(
    (sum, r) => sum + r.issues.filter((i) => !i.resolved).length,
    0
  );
  const passedCount = selfCheckResults.filter((r) => r.passed).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            自检中心
          </h1>
          <p className="text-gray-500 mt-1">
            系统自动检测四项核心风险：重复导入、同名映射、补录重算、导出一致性
          </p>
        </div>
        <button
          onClick={runSelfCheck}
          className="flex items-center gap-2 px-5 py-2.5 text-white bg-[#1e3a5f] rounded hover:bg-[#2c5282] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          立即运行自检
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
            <ShieldCheck className="w-5 h-5 text-[#1e3a5f]" />
            四项核心自检
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

      <Card title="自检说明" subtitle="四项自检的检查逻辑">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">1. 重复导入检测</h4>
            <p className="text-sm text-gray-600">
              检查是否存在相同「现场名+版权名」组合跨多个导入版本重复出现的情况，避免数据冗余。
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
