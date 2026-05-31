import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Palette, FileText, RotateCcw, Play, CheckCircle2, Layers } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsPage() {
  const { resetState, loadSampleData, runBatchProofread, tasks, batchProcessing } = useAppStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleBatchRun = () => {
    const taskIds = tasks.map((t) => t.id);
    runBatchProofread(taskIds);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">设置中心</h2>
          <p className="text-slate-500">配置校对规则，管理模板，进行批量操作</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Layers size={20} className="text-primary-500" />
            批量处理
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            对所有任务重新运行校对。系统会自动去重，重复处理不会产生额外结果。
          </p>
          <button
            onClick={handleBatchRun}
            disabled={batchProcessing || tasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white rounded-lg font-medium transition-all"
          >
            {batchProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <Play size={16} />
                批量运行校对 ({tasks.length} 个任务)
              </>
            )}
          </button>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                ✅ 批量处理采用任务队列机制，避免并发冲突，保证重复运行结果一致。
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Palette size={20} className="text-primary-500" />
            色卡配置
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: '主色调', color: '#1e3a5f', desc: '深蓝色' },
              { name: '补材料', color: '#3b82f6', desc: '蓝色' },
              { name: '结论变更', color: '#f97316', desc: '橙色' },
              { name: '错误提示', color: '#ef4444', desc: '红色' },
            ].map((item) => (
              <div key={item.name} className="text-center">
                <div
                  className="w-full h-16 rounded-lg mb-2 shadow-inner"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium text-slate-700">{item.name}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText size={20} className="text-primary-500" />
            提示语模板
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-1">补材料提示</p>
              <p className="text-sm text-slate-600">这是补充内容，不影响原有结论，可以直接确认</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-1">结论变更提示</p>
              <p className="text-sm text-slate-600">请注意！这是重要的内容变更，需要核对后确认</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-1">建议格式</p>
              <p className="text-sm text-slate-600">💡 建议：[具体可操作的建议]</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <SettingsIcon size={20} className="text-primary-500" />
            示例数据
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            加载示例数据可以快速体验所有功能，包含预设的素材包、变更记录和问题提示。
          </p>
          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all"
          >
            <FileText size={16} />
            加载示例数据
          </button>
        </div>

        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="font-semibold text-red-600 mb-4 flex items-center gap-2">
            <RotateCcw size={20} />
            重置数据
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            清除所有任务和数据，恢复到初始状态。此操作不可撤销。
          </p>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-all"
            >
              <RotateCcw size={16} />
              重置所有数据
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              <p className="text-sm text-red-600 font-medium">确定要重置所有数据吗？此操作不可撤销。</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    resetState();
                    setShowResetConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
                >
                  确认重置
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
