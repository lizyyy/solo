import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  Settings2,
  AlertOctagon,
  ArrowRight,
  Zap,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  EXPORT_FIELD_LABEL,
  type ExportField,
  type ExportConfig,
} from '@/types';
import { performExport } from '@/utils/exporter';
import { getHandoverDetailItems } from '@/utils/handoverSummary';

const ALL_FIELDS: ExportField[] = [
  'id',
  'petName',
  'aliases',
  'petCategory',
  'species',
  'ownerName',
  'ownerPhone',
  'weightRaw',
  'weightNormalized',
  'weightUnitFlag',
  'temperature',
  'measureTime',
  'status',
  'anomalyTags',
  'wechatNote',
  'judgments',
  'supplementaryNotes',
];

type ToastState = {
  show: boolean;
  type: 'success' | 'error';
  message: string;
};

export default function ExportConfigPanel() {
  const {
    ui: { showExportPanel },
    setShowExportPanel,
    setShowMergeModal,
    setFilter,
    records,
    confirmedIds,
    mergeGroups,
    lastSavedAt,
    lastOperator,
    lastAction,
  } = useAppStore();

  const [selectedFields, setSelectedFields] =
    useState<ExportField[]>(ALL_FIELDS);
  const [normalizeWeight, setNormalizeWeight] = useState(true);
  const [includeFlagColumns, setIncludeFlagColumns] = useState(true);
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: 'success',
    message: '',
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExportPanel(false);
    };
    if (showExportPanel) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showExportPanel, setShowExportPanel]);

  const gapItems = getHandoverDetailItems({
    records,
    mergeGroups,
    lastOperator,
    lastSavedAt,
    lastAction,
  });

  const toggleField = (field: ExportField) => {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  };

  const selectAllFields = () => setSelectedFields(ALL_FIELDS);
  const clearAllFields = () => setSelectedFields([]);

  const handleGapClick = (category: string) => {
    switch (category) {
      case '体重单位异常':
        setFilter({
          anomaly: 'weight_unit_mixed',
          weightAbnormal: 'abnormal',
        });
        setShowExportPanel(false);
        break;
      case '疑似同宠异名':
        setShowMergeModal(true);
        setShowExportPanel(false);
        break;
      case '温度异常':
        setFilter({ anomaly: 'temp_out_of_range' });
        setShowExportPanel(false);
        break;
      case '后补说明缺失':
        setFilter({ status: 'pending' });
        setShowExportPanel(false);
        break;
    }
  };

  const expectedCount = onlyConfirmed
    ? records.filter((r) => r.status === 'confirmed').length
    : records.length;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  };

  const handleExport = () => {
    const config: ExportConfig = {
      format,
      fields: selectedFields.length > 0 ? selectedFields : ALL_FIELDS,
      normalizeWeight,
      includeFlagColumns,
      onlyConfirmed,
    };

    const result = performExport(records, config);

    if (result.success && result.fileName) {
      showToast(
        'success',
        `导出成功！文件：${result.fileName}（共 ${expectedCount} 条记录）`
      );
    } else {
      showToast('error', `导出失败：${result.error || '未知错误'}`);
    }
  };

  return (
    <>
      <AnimatePresence>
        {toast.show && (
          <motion.div
            className="fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl"
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            style={{
              background:
                toast.type === 'success'
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              color: 'white',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportPanel && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowExportPanel(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              className="relative bg-white rounded-t-3xl shadow-2xl w-full flex flex-col overflow-hidden"
              style={{ height: '75vh' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="w-12 h-1.5 rounded-full bg-ink-200 mx-auto mt-3 mb-1 shrink-0" />

              <div className="px-8 py-4 border-b border-ink-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-clinic-50 to-cyan-50">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-clinic-500/10 flex items-center justify-center">
                    <Download className="w-5 h-5 text-clinic-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink-800 flex items-center gap-2">
                      导出配置
                      <Settings2 className="w-4 h-4 text-clinic-500" />
                    </h2>
                    <p className="text-xs text-ink-500">
                      配置导出字段与格式，检查缺口清单后一键导出
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportPanel(false)}
                  className="w-9 h-9 rounded-lg hover:bg-white/80 flex items-center justify-center text-ink-500 hover:text-ink-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-ink-50/40">
                {gapItems.length > 0 && (
                  <div className="card overflow-hidden border-0 ring-2 ring-rose-200/70">
                    <div className="px-5 py-4 bg-gradient-to-r from-rose-50 to-red-50 border-b border-rose-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
                        <AlertOctagon className="w-5 h-5 text-rose-600 animate-warnSpin" />
                      </div>
                      <div>
                        <h3 className="font-bold text-rose-700 text-sm">
                          缺口清单（{gapItems.reduce((s, g) => s + g.count, 0)}项待处理）
                        </h3>
                        <p className="text-xs text-rose-500/80">
                          建议先处理下列问题后再导出，避免报告包含异常数据
                        </p>
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {gapItems.map((item) => (
                        <div
                          key={item.category}
                          className="card-flat p-4 bg-gradient-to-br from-white to-rose-50/30 hover:shadow-md transition-shadow group cursor-pointer"
                          onClick={() => handleGapClick(item.category)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-semibold text-ink-700">
                              {item.category}
                            </span>
                            <span className="chip bg-rose-500 text-white text-[11px] animate-gapBeat">
                              {item.count}
                            </span>
                          </div>
                          <p className="text-xs text-ink-500 mb-3 leading-relaxed">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-1 text-xs font-medium text-clinic-600 group-hover:text-clinic-700 group-hover:translate-x-1 transition-all">
                            <span>去处理</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card">
                  <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-violet-500" />
                      <h3 className="font-bold text-ink-800 text-sm">
                        导出字段配置
                      </h3>
                      <span className="chip chip-status-pending text-[11px]">
                        {selectedFields.length}/{ALL_FIELDS.length} 个字段
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllFields}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        全选
                      </button>
                      <button
                        onClick={clearAllFields}
                        className="btn-ghost text-xs py-1 px-2"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-5">
                      {(Object.keys(EXPORT_FIELD_LABEL) as ExportField[]).map(
                        (field) => {
                          const checked = selectedFields.includes(field);
                          return (
                            <label
                              key={field}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${
                                checked
                                  ? 'bg-clinic-50/60 border-clinic-200'
                                  : 'bg-ink-50/50 border-transparent hover:bg-ink-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleField(field)}
                                className="hidden"
                              />
                              {checked ? (
                                <CheckSquare className="w-4.5 h-4.5 text-clinic-600 shrink-0" />
                              ) : (
                                <Square className="w-4.5 h-4.5 text-ink-400 shrink-0" />
                              )}
                              <span className="text-sm text-ink-700 truncate">
                                {EXPORT_FIELD_LABEL[field]}
                              </span>
                            </label>
                          );
                        }
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-ink-100">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={normalizeWeight}
                          onChange={(e) => setNormalizeWeight(e.target.checked)}
                          className="w-4 h-4 rounded text-clinic-500 focus:ring-clinic-400"
                        />
                        <span className="text-sm text-ink-700">
                          规范化体重双列
                        </span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeFlagColumns}
                          onChange={(e) =>
                            setIncludeFlagColumns(e.target.checked)
                          }
                          className="w-4 h-4 rounded text-clinic-500 focus:ring-clinic-400"
                        />
                        <span className="text-sm text-ink-700">
                          保留单位异常标记列
                        </span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyConfirmed}
                          onChange={(e) => setOnlyConfirmed(e.target.checked)}
                          className="w-4 h-4 rounded text-clinic-500 focus:ring-clinic-400"
                        />
                        <span className="text-sm text-ink-700">
                          仅导出已确认记录
                          <span className="text-ink-400 ml-1">
                            ({confirmedIds.length}条)
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="px-5 py-4 border-b border-ink-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-ink-800 text-sm">
                      格式选择与导出执行
                    </h3>
                  </div>
                  <div className="p-5 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink-600 font-medium">
                        导出格式：
                      </span>
                      <div className="flex rounded-lg overflow-hidden ring-1 ring-ink-200">
                        <button
                          onClick={() => setFormat('xlsx')}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                            format === 'xlsx'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white text-ink-600 hover:bg-ink-50'
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          Excel
                        </button>
                        <button
                          onClick={() => setFormat('csv')}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-l border-ink-200 ${
                            format === 'csv'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-ink-600 hover:bg-ink-50'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                          CSV
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">字段数</span>
                        <span className="font-bold text-ink-700">
                          {selectedFields.length || ALL_FIELDS.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">格式</span>
                        <span className="font-bold text-ink-700 uppercase">
                          {format}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">预计记录数</span>
                        <span className="font-bold text-clinic-600 text-base">
                          {expectedCount}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleExport}
                      disabled={expectedCount === 0}
                      className="btn-primary text-base px-6 py-2.5 bg-gradient-to-r from-clinic-500 to-cyan-500 hover:from-clinic-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-5 h-5" />
                      执行导出
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
