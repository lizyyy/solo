import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Image,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  History,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ExportRecord, HistoryCompareResult } from '@/types';
import {
  captureScreenshot,
  createExportRecord,
  generateWatermark,
  generateVersion,
  generateExportFilename,
  downloadImage,
  compareWithHistory,
  generateChangeLog,
} from '@/utils/exportUtils';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface ExportPanelProps {
  visualizationElementId: string;
  onExported?: () => void;
}

export default function ExportPanel({
  visualizationElementId,
  onExported,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedExport, setSelectedExport] = useState<ExportRecord | null>(null);
  const [compareResult, setCompareResult] = useState<HistoryCompareResult | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [exportRemark, setExportRemark] = useState('');

  const operator = useAppStore((s) => s.operator);
  const pointCloudLog = useAppStore((s) => s.pointCloudLog);
  const safetyRadiusTable = useAppStore((s) => s.safetyRadiusTable);
  const routes = useAppStore((s) => s.routes);
  const conflicts = useAppStore((s) => s.conflicts);
  const exports = useAppStore((s) => s.exports);
  const addExport = useAppStore((s) => s.addExport);
  const setLastCompareResult = useAppStore((s) => s.setLastCompareResult);
  const selfChecks = useAppStore((s) => s.selfChecks);

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const pendingReviews = routes.filter((r) => r.reviewStatus === 'pending').length;
  const hasBlockingIssues = selfChecks.some((c) => c.status === 'fail');

  const handleExport = async () => {
    if (hasBlockingIssues) {
      alert('存在未通过的自检项，请先处理后再导出');
      return;
    }

    if (!pointCloudLog) {
      alert('请先导入点云抽稀日志');
      return;
    }

    setIsExporting(true);
    try {
      const now = new Date().toISOString();
      const version = generateVersion(exports);
      const watermark = generateWatermark(operator, now, version);

      const imageDataUrl = await captureScreenshot(
        visualizationElementId,
        watermark
      );

      const exportRecord = await createExportRecord({
        imageDataUrl,
        watermark,
        version,
        operator,
        pointCloudLog,
        safetyRadiusTable,
        routes,
        conflicts,
        remark: exportRemark || undefined,
      });

      addExport(exportRecord);

      const compare = await compareWithHistory(exportRecord, exports);
      setCompareResult(compare);
      setLastCompareResult(compare);
      setSelectedExport(exportRecord);
      setShowCompare(true);

      downloadImage(
        imageDataUrl,
        generateExportFilename(version)
      );

      setExportRemark('');
      onExported?.();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败：' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCompare = async (exportRecord: ExportRecord) => {
    setSelectedExport(exportRecord);
    const compare = await compareWithHistory(exportRecord, exports);
    setCompareResult(compare);
    setShowCompare(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-survey-600" />
          导出动线图
        </h3>

        {(pendingConflicts > 0 || pendingReviews > 0) && (
          <div className="bg-warning-50 border border-warning-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning-800">
                  导出前请注意
                </p>
                <p className="text-warning-700">
                  {pendingConflicts > 0 && (
                    <span>还有 {pendingConflicts} 个数据冲突待处理。</span>
                  )}
                  {pendingReviews > 0 && (
                    <span>还有 {pendingReviews} 条补录路线待客户复核。</span>
                  )}
                  <span>这些问题不会阻止导出，但会在导出结果中标记。</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              导出备注（可选）
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="填写本次导出的说明或变更内容..."
              value={exportRemark}
              onChange={(e) => setExportRemark(e.target.value)}
            />
          </div>

          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={handleExport}
            disabled={isExporting || hasBlockingIssues || !pointCloudLog}
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                正在导出...
              </>
            ) : (
              <>
                <Image className="w-5 h-5" />
                导出截图（带水印版本号）
              </>
            )}
          </button>

          {hasBlockingIssues && (
            <p className="text-xs text-danger-600 text-center">
              存在未通过的自检项，请先处理后再导出
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCompare && compareResult && selectedExport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <History className="w-4 h-4" />
                历史版本对比
              </h4>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowCompare(false)}
              >
                关闭
              </button>
            </div>
            <div className="p-4">
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">当前版本</p>
                  <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={selectedExport.imageDataUrl}
                      alt="当前版本"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-sm font-medium text-center mt-2">
                    {selectedExport.version}
                  </p>
                </div>
                {compareResult.previousExportId && (
                  <>
                    <div className="flex items-center">
                      <ArrowRight className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">上一版本</p>
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={
                            exports.find(
                              (e) => e.id === compareResult.previousExportId
                            )?.imageDataUrl
                          }
                          alt="上一版本"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-sm font-medium text-center mt-2">
                        {
                          exports.find(
                            (e) => e.id === compareResult.previousExportId
                          )?.version
                        }
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div
                className={cn(
                  'rounded-lg p-4',
                  compareResult.isConsistent
                    ? 'bg-success-50 border border-success-200'
                    : 'bg-warning-50 border border-warning-200'
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  {compareResult.isConsistent ? (
                    <CheckCircle className="w-5 h-5 text-success-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-warning-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {compareResult.isConsistent
                        ? '与上一版本内容一致'
                        : '与上一版本存在差异'}
                    </p>
                    <pre className="text-sm text-gray-600 mt-2 whitespace-pre-wrap font-sans">
                      {generateChangeLog(compareResult)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <History className="w-4 h-4" />
            历史导出记录
          </h4>
        </div>
        {exports.length > 0 ? (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {exports.map((exp, idx) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  'p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors',
                  selectedExport?.id === exp.id && 'bg-survey-50'
                )}
                onClick={() => handleCompare(exp)}
              >
                <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
                  <img
                    src={exp.imageDataUrl}
                    alt={exp.version}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      {exp.version}
                    </span>
                    {exp.conflictCount > 0 && (
                      <span className="status-badge status-error">
                        {exp.conflictCount}个冲突
                      </span>
                    )}
                    {exp.pendingReviewCount > 0 && (
                      <span className="status-badge status-warning">
                        {exp.pendingReviewCount}项待复核
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(exp.exportTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {exp.operator}
                    </span>
                    <span className="data-mono">
                      总长 {exp.routeLength.toFixed(2)}m
                    </span>
                  </div>
                  {exp.remark && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {exp.remark}
                    </p>
                  )}
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Image className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">暂无导出记录</p>
            <p className="text-sm mt-1">完成以上步骤后即可导出</p>
          </div>
        )}
      </div>
    </div>
  );
}
