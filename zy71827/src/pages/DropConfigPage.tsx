import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  FileUp,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  User,
  Calendar,
  Package,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDate, cn } from '@/utils/helpers';
import type { DropConfig, DropConfigItem, OperationLog } from '@/types';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import OperationTimeline from '@/components/OperationTimeline';

interface DiffItem extends DropConfigItem {
  diff?: 'added' | 'removed' | 'modified';
  oldQuantity?: number;
}

export default function DropConfigPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    dropConfigs,
    rewards,
    operationLogs,
    currentActivity,
    addDropConfigWithLog,
    deleteDropConfigWithLog,
  } = useAppStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DropConfigItem[]>([]);
  const [importVersion, setImportVersion] = useState('');
  const [importRemark, setImportRemark] = useState('');
  const [importFileName, setImportFileName] = useState('');

  const sortedConfigs = [...dropConfigs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const configLogs = operationLogs.filter(
    (log) => log.targetType === 'drop_config'
  );

  const getRewardCountForConfig = (configId: string) => {
    return rewards.filter((r) => r.sourceId === configId).length;
  };

  const getLogsForConfig = (configId: string): OperationLog[] => {
    return operationLogs
      .filter((log) => log.targetType === 'drop_config' && log.targetId === configId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      let data: DropConfigItem[] = [];

      if (extension === 'csv') {
        data = await parseCSV(file);
      } else if (extension === 'xlsx' || extension === 'xls') {
        data = await parseExcel(file);
      } else {
        throw new Error('不支持的文件格式，请上传CSV或Excel文件');
      }

      if (data.length === 0) {
        throw new Error('文件中没有有效数据');
      }

      setPreviewData(data);
      setShowImportDialog(true);
      setImportVersion(`v${sortedConfigs.length + 1}.0`);
    } catch (error) {
      console.error('解析文件失败:', error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseCSV = (file: File): Promise<DropConfigItem[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const items: DropConfigItem[] = results.data
            .map((row: any) => ({
              itemId: String(row.itemId || row['物品ID'] || row.id || ''),
              itemName: String(row.itemName || row['名称'] || row.name || ''),
              dropCondition: String(row.dropCondition || row['掉落条件'] || row.condition || ''),
              quantity: parseInt(row.quantity || row['数量'] || row.count || '0', 10),
            }))
            .filter((item) => item.itemId && item.itemName && !isNaN(item.quantity));
          resolve(items);
        },
        error: reject,
      });
    });
  };

  const parseExcel = (file: File): Promise<DropConfigItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          const items: DropConfigItem[] = jsonData
            .map((row: any) => ({
              itemId: String(row.itemId || row['物品ID'] || row.id || ''),
              itemName: String(row.itemName || row['名称'] || row.name || ''),
              dropCondition: String(row.dropCondition || row['掉落条件'] || row.condition || ''),
              quantity: parseInt(row.quantity || row['数量'] || row.count || '0', 10),
            }))
            .filter((item) => item.itemId && item.itemName && !isNaN(item.quantity));
          resolve(items);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleImport = async () => {
    if (!currentActivity) return;

    try {
      await addDropConfigWithLog({
        activityId: currentActivity.id,
        version: importVersion,
        content: previewData,
        sourceFile: importFileName,
        remark: importRemark,
      });

      setShowImportDialog(false);
      setPreviewData([]);
      setImportRemark('');
    } catch (error) {
      console.error('导入失败:', error);
    }
  };

  const handleCompareToggle = (configId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(configId)) {
        return prev.filter((id) => id !== configId);
      }
      if (prev.length >= 2) {
        return [prev[1], configId];
      }
      return [...prev, configId];
    });
  };

  const getCompareDiff = (): { left: DiffItem[]; right: DiffItem[] } => {
    if (selectedForCompare.length !== 2) return { left: [], right: [] };

    const leftConfig = dropConfigs.find((d) => d.id === selectedForCompare[0]);
    const rightConfig = dropConfigs.find((d) => d.id === selectedForCompare[1]);

    if (!leftConfig || !rightConfig) return { left: [], right: [] };

    const leftItems = new Map(leftConfig.content.map((i) => [i.itemId, i]));
    const rightItems = new Map(rightConfig.content.map((i) => [i.itemId, i]));

    const allIds = new Set([...leftItems.keys(), ...rightItems.keys()]);

    const leftDiff: DiffItem[] = [];
    const rightDiff: DiffItem[] = [];

    allIds.forEach((id) => {
      const left = leftItems.get(id);
      const right = rightItems.get(id);

      if (left && !right) {
        leftDiff.push({ ...left, diff: 'removed' });
        rightDiff.push({ itemId: '', itemName: '', dropCondition: '', quantity: 0, diff: 'removed' });
      } else if (!left && right) {
        leftDiff.push({ itemId: '', itemName: '', dropCondition: '', quantity: 0, diff: 'added' });
        rightDiff.push({ ...right, diff: 'added' });
      } else if (left && right) {
        if (left.quantity !== right.quantity || left.dropCondition !== right.dropCondition) {
          leftDiff.push({ ...left, diff: 'modified', oldQuantity: right.quantity });
          rightDiff.push({ ...right, diff: 'modified', oldQuantity: left.quantity });
        } else {
          leftDiff.push(left);
          rightDiff.push(right);
        }
      }
    });

    return { left: leftDiff, right: rightDiff };
  };

  const { left: leftDiff, right: rightDiff } = getCompareDiff();
  const selectedConfigs = selectedForCompare.map((id) => dropConfigs.find((d) => d.id === id)).filter(Boolean) as DropConfig[];

  if (!currentActivity) {
    return (
      <EmptyState
        title="请先选择活动"
        description="在顶部下拉菜单中选择一个活动开始管理"
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">掉落配置管理</h1>
            <p className="text-sm text-slate-500">
              管理物品掉落配置，支持版本对比、撤回和来源追溯
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCompareMode(!compareMode)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                compareMode
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              )}
            >
              <GitCompare className="w-4 h-4" />
              版本对比
              {compareMode && selectedForCompare.length > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {selectedForCompare.length}/2
                </span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-medium rounded-lg shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30 transition-all"
            >
              <FileUp className="w-4 h-4" />
              导入配置
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </motion.div>

      {compareMode && selectedForCompare.length === 2 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">版本对比</h2>
            <button
              onClick={() => {
                setCompareMode(false);
                setSelectedForCompare([]);
              }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              退出对比
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {selectedConfigs.map((config) => (
              <div key={config.id} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">版本 {config.version}</p>
                    <p className="text-xs text-slate-500">{config.sourceFile}</p>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(config.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 w-1/2">旧版本</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 w-1/2">新版本</th>
                </tr>
              </thead>
              <tbody>
                {leftDiff.map((leftItem, index) => {
                  const rightItem = rightDiff[index];
                  return (
                    <tr key={index} className="border-b border-slate-100">
                      <td className={cn(
                        'py-3 px-4',
                        leftItem.diff === 'removed' && 'bg-red-50',
                        leftItem.diff === 'modified' && 'bg-amber-50',
                        leftItem.diff === 'added' && 'opacity-30'
                      )}>
                        {leftItem.itemId && (
                          <div className="flex items-start gap-3">
                            <div>
                              <p className="font-medium text-slate-800">{leftItem.itemName}</p>
                              <p className="text-xs text-slate-500">ID: {leftItem.itemId}</p>
                              <p className="text-xs text-slate-400">{leftItem.dropCondition}</p>
                            </div>
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              leftItem.diff === 'removed' && 'bg-red-100 text-red-700',
                              leftItem.diff === 'modified' && 'bg-amber-100 text-amber-700'
                            )}>
                              数量: {leftItem.quantity}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={cn(
                        'py-3 px-4',
                        rightItem.diff === 'added' && 'bg-green-50',
                        rightItem.diff === 'modified' && 'bg-amber-50',
                        rightItem.diff === 'removed' && 'opacity-30'
                      )}>
                        {rightItem.itemId && (
                          <div className="flex items-start gap-3">
                            <div>
                              <p className="font-medium text-slate-800">{rightItem.itemName}</p>
                              <p className="text-xs text-slate-500">ID: {rightItem.itemId}</p>
                              <p className="text-xs text-slate-400">{rightItem.dropCondition}</p>
                            </div>
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              rightItem.diff === 'added' && 'bg-green-100 text-green-700',
                              rightItem.diff === 'modified' && 'bg-amber-100 text-amber-700'
                            )}>
                              数量: {rightItem.quantity}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {sortedConfigs.length === 0 ? (
            <EmptyState
              title="暂无掉落配置"
              description="点击右上角的导入配置按钮开始添加"
              actionText="导入配置"
              onAction={() => fileInputRef.current?.click()}
            />
          ) : (
            sortedConfigs.map((config, index) => {
              const isExpanded = expandedId === config.id;
              const rewardCount = getRewardCountForConfig(config.id);
              const isSelected = selectedForCompare.includes(config.id);
              const configLogs = getLogsForConfig(config.id);

              return (
                <motion.div
                  key={config.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <div
                    className={cn(
                      'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all',
                      isSelected && 'ring-2 ring-sky-500 ring-offset-2'
                    )}
                  >
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() => {
                        if (compareMode) {
                          handleCompareToggle(config.id);
                        } else {
                          setExpandedId(isExpanded ? null : config.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                              v{config.version}
                            </span>
                            <span className="text-sm font-medium text-slate-800">
                              {config.sourceFile}
                            </span>
                            {rewardCount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/rewards?source=drop_config&id=${config.id}`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-600 text-xs font-medium rounded-md hover:bg-sky-100 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {rewardCount} 条奖励记录
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <User className="w-4 h-4" />
                              {config.operator}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatDate(config.createdAt)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Package className="w-4 h-4" />
                              {config.content.length} 项配置
                            </span>
                          </div>
                          {config.remark && (
                            <p className="mt-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                              {config.remark}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!compareMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetId(config.id);
                              }}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!compareMode && (
                            isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )
                          )}
                          {compareMode && (
                            <div className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-sky-500 border-sky-500'
                                : 'border-slate-300'
                            )}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && !compareMode && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-200 p-5 bg-slate-50/50">
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">物品ID</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">名称</th>
                                    <th className="text-left py-3 px-4 font-medium text-slate-600">掉落条件</th>
                                    <th className="text-right py-3 px-4 font-medium text-slate-600">数量</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {config.content.map((item, idx) => (
                                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{item.itemId}</td>
                                      <td className="py-3 px-4 font-medium text-slate-800">{item.itemName}</td>
                                      <td className="py-3 px-4 text-slate-600">{item.dropCondition}</td>
                                      <td className="py-3 px-4 text-right font-semibold text-slate-800">{item.quantity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sticky top-24"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">操作历史</h3>
            <OperationTimeline logs={configLogs.slice(0, 10)} />
          </motion.div>
        </div>
      </div>

      <ConfirmDialog
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          setPreviewData([]);
        }}
        onConfirm={handleImport}
        title="确认导入配置"
        confirmText="确认导入"
        variant="info"
        message={undefined}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">版本号</label>
              <input
                type="text"
                value={importVersion}
                onChange={(e) => setImportVersion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
              <textarea
                value={importRemark}
                onChange={(e) => setImportRemark(e.target.value)}
                placeholder="可选：填写本次导入的说明"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              预览 ({previewData.length} 条数据)
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">物品</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">条件</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="py-2 px-3">
                        <p className="font-medium text-slate-800">{item.itemName}</p>
                        <p className="text-slate-400">{item.itemId}</p>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{item.dropCondition}</td>
                      <td className="py-2 px-3 text-right font-semibold">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <div className="text-center py-2 text-xs text-slate-400 bg-slate-50">
                  还有 {previewData.length - 10} 条数据...
                </div>
              )}
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteDropConfigWithLog(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        title="确认撤回此版本"
        message="撤回操作将记录在操作日志中，相关的奖励记录不会被删除。此操作不可撤销。"
        confirmText="确认撤回"
        variant="danger"
      />
    </div>
  );
}
