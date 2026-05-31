import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, CheckCircle, AlertTriangle, FileText, Eye, Monitor } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { ExportConfig } from '@/types';

export default function ExportCenter() {
  const { currentTask, screenRange, filters, exportReport } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<ExportConfig>({
    format: 'markdown',
    includeScreenRange: true,
    includeFilters: true,
    template: 'standard',
    timestamp: Date.now(),
  });

  const handleExport = async () => {
    setExporting(true);
    await exportReport({ ...config, timestamp: Date.now() });
    setExporting(false);
  };

  if (!currentTask) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500">请先选择一个校对任务</p>
      </div>
    );
  }

  const isScreenRangeSynced =
    screenRange.visibleEnd > 0 && Date.now() - screenRange.timestamp < 60000;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">导出中心</h2>
          <p className="text-slate-500">生成交付说明，确保屏幕范围和导出内容一致</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Monitor size={20} className="text-primary-500" />
            一致性校验
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-lg border ${
                isScreenRangeSynced
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {isScreenRangeSynced ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <AlertTriangle size={18} className="text-amber-500" />
                )}
                <span className="font-medium text-slate-700">屏幕范围</span>
              </div>
              <p className="text-sm text-slate-600">
                {isScreenRangeSynced
                  ? `当前可见范围: ${Math.round(screenRange.visibleStart)} - ${Math.round(screenRange.visibleEnd)}px`
                  : '请滚动页面以捕获当前屏幕范围'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                最后更新: {new Date(screenRange.timestamp).toLocaleTimeString('zh-CN')}
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-blue-500" />
                <span className="font-medium text-slate-700">筛选条件</span>
              </div>
              <p className="text-sm text-slate-600">
                {filters.searchText ? `搜索: ${filters.searchText}` : '无搜索条件'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {filters.changeTypes.length > 0
                  ? `变更类型: ${filters.changeTypes.join(', ')}`
                  : '显示全部变更类型'}
              </p>
            </div>
          </div>

          {!isScreenRangeSynced && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>
                  💡 提示：导出前请滚动一下页面，确保导出的交付说明与您当前看到的屏幕范围一致。
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">导出配置</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">导出格式</label>
              <div className="flex gap-3">
                {[
                  { value: 'markdown', label: 'Markdown', icon: FileText },
                  { value: 'pdf', label: 'PDF', icon: FileText },
                  { value: 'docx', label: 'Word', icon: FileText },
                ].map((format) => (
                  <button
                    key={format.value}
                    onClick={() => setConfig({ ...config, format: format.value as ExportConfig['format'] })}
                    className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                      config.format === format.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <format.icon size={18} className="mx-auto mb-1" />
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">包含内容</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={config.includeScreenRange}
                    onChange={(e) => setConfig({ ...config, includeScreenRange: e.target.checked })}
                    className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">包含屏幕范围信息</p>
                    <p className="text-xs text-slate-500">在报告中记录导出时的可见范围</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={config.includeFilters}
                    onChange={(e) => setConfig({ ...config, includeFilters: e.target.checked })}
                    className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700">包含筛选条件</p>
                    <p className="text-xs text-slate-500">在报告中记录当前的筛选条件</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Eye size={20} className="text-primary-500" />
            导出预览
          </h3>

          <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm text-slate-600 max-h-64 overflow-auto">
            <pre>{`# 展板文案校对报告

## 任务信息
- 任务名称: ${currentTask.name}
- 导出时间: ${new Date().toLocaleString('zh-CN')}
- 导出格式: ${config.format}

## 变更统计
- 总变更数: ${currentTask.changes.length}
- 补材料: ${currentTask.changes.filter((c) => c.type === 'material').length} 处
- 结论变更: ${currentTask.changes.filter((c) => c.type === 'conclusion').length} 处

## 问题统计
- 总问题数: ${currentTask.issues.length}
- 已解决: ${currentTask.issues.filter((i) => i.resolved).length}
- 待处理: ${currentTask.issues.filter((i) => !i.resolved).length}

${config.includeScreenRange ? `
## 屏幕状态
- 滚动位置: ${Math.round(screenRange.scrollTop)}px
- 可见范围: ${Math.round(screenRange.visibleStart)} - ${Math.round(screenRange.visibleEnd)}px
` : ''}

${config.includeFilters ? `
## 筛选条件
- 搜索文本: ${filters.searchText || '(无)'}
- 变更类型: ${filters.changeTypes.join(', ') || '(全部)'}
` : ''}`}</pre>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 transition-all"
        >
          {exporting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Download size={20} />
              导出交付说明
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
