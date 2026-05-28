import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  PlayCircle,
  FileText,
  MapPin,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useDataImport } from '../hooks/useDataImport';
import { NeonButton, NeonCard, DataTable } from '../components/ui';
import { ProcessingLogPanel } from '../components/game';
import type { Tour, Stop, MerchItem, ProcessingLogEntry, ValidationError } from '../types/tour';

interface Column<T> {
  key: keyof T | string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  isNote?: boolean;
  className?: string;
  headerClassName?: string;
}

type TabType = 'tour' | 'stops' | 'merch';

interface LocationState {
  sampleType?: 'normal' | 'critical' | 'dirty';
}

const tourColumns: Column<Partial<Tour>>[] = [
  { key: 'name', header: '巡演名称' },
  { key: 'bandName', header: '乐队名称' },
  { key: 'initialBudget', header: '初始预算', render: (row) => row.initialBudget !== undefined ? `¥${row.initialBudget.toLocaleString()}` : '-' },
  { key: 'startDate', header: '开始日期' },
  { key: 'endDate', header: '结束日期' },
  { key: 'notes', header: '备注', isNote: true },
];

const stopsColumns: Column<Partial<Stop>>[] = [
  { key: 'city', header: '城市' },
  { key: 'venue', header: '场馆' },
  { key: 'date', header: '日期' },
  { key: 'distanceFromPrev', header: '距上一站(km)', render: (row) => row.distanceFromPrev !== undefined ? row.distanceFromPrev : '-' },
  { key: 'venueRent', header: '场地租金', render: (row) => row.venueRent !== undefined ? `¥${row.venueRent.toLocaleString()}` : '-' },
  { key: 'venueSplit', header: '票房分成(%)', render: (row) => row.venueSplit !== undefined ? `${row.venueSplit * 100}%` : '-' },
  { key: 'ticketPrice', header: '票价', render: (row) => row.ticketPrice !== undefined ? `¥${row.ticketPrice}` : '-' },
  { key: 'predictedAttendance', header: '预计观众', render: (row) => row.predictedAttendance !== undefined ? row.predictedAttendance : '-' },
  { key: 'transportType', header: '交通方式' },
  { key: 'transportCost', header: '交通费用', render: (row) => row.transportCost !== undefined ? `¥${row.transportCost.toLocaleString()}` : '-' },
  { key: 'notes', header: '备注', isNote: true },
];

const merchColumns: Column<Partial<MerchItem>>[] = [
  { key: 'name', header: '商品名称' },
  { key: 'sku', header: 'SKU' },
  { key: 'costPrice', header: '成本价', render: (row) => row.costPrice !== undefined ? `¥${row.costPrice}` : '-' },
  { key: 'sellingPrice', header: '售价', render: (row) => row.sellingPrice !== undefined ? `¥${row.sellingPrice}` : '-' },
  { key: 'initialStock', header: '初始库存', render: (row) => row.initialStock !== undefined ? row.initialStock : '-' },
  { key: 'notes', header: '备注', isNote: true },
];

export default function DataImport() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('tour');
  const [isDragging, setIsDragging] = useState(false);

  const {
    rawFiles,
    parsedData,
    processingLog,
    validationErrors,
    isProcessing,
    importFiles,
    importSampleData,
    canStartGame,
    startGameWithData,
    resolveLogEntry,
    dismissError,
    clearData,
    getProcessingLogByPriority,
    getErrorsBySeverity,
  } = useDataImport();

  useEffect(() => {
    if (locationState?.sampleType && !parsedData.tour.name) {
      importSampleData(locationState.sampleType);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      importFiles(files);
    }
  }, [importFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      importFiles(files);
    }
  }, [importFiles]);

  const handleStartGame = useCallback(() => {
    if (startGameWithData()) {
      navigate('/game');
    }
  }, [startGameWithData, navigate]);

  const handleCancel = useCallback(() => {
    clearData();
    navigate('/');
  }, [clearData, navigate]);

  const handleReimport = useCallback(() => {
    clearData();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [clearData]);

  const hasData = parsedData.tour.name || parsedData.stops.length > 0 || parsedData.merch.length > 0;
  const errors = getErrorsBySeverity('error');
  const warnings = getErrorsBySeverity('warning');
  const sortedLogs = getProcessingLogByPriority();

  const getRowIsDirty = useCallback((type: TabType) => {
    return (_row: unknown, index: number): boolean => {
      return sortedLogs.some(
        (log: ProcessingLogEntry) =>
          log.rowIndex === index &&
          ((type === 'stops' && log.field.includes('stop')) ||
           (type === 'merch' && log.field.includes('merch')) ||
           (type === 'tour' && log.rowIndex === undefined))
      );
    };
  }, [sortedLogs]);

  const sampleButtons = [
    { type: 'normal' as const, label: '✓ 正常数据', variant: 'success' as const, description: '数据完整、格式正确、数值合理' },
    { type: 'critical' as const, label: '⚠ 临界数据', variant: 'warning' as const, description: '预算紧张、风险系数高' },
    { type: 'dirty' as const, label: '✗ 脏数据', variant: 'danger' as const, description: '含缺失值、格式错误、异常值' },
  ];

  const tabs = [
    { id: 'tour' as const, label: '巡演信息', icon: FileText, count: parsedData.tour.name ? 1 : 0 },
    { id: 'stops' as const, label: '站点列表', icon: MapPin, count: parsedData.stops.length },
    { id: 'merch' as const, label: '周边商品', icon: ShoppingBag, count: parsedData.merch.length },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tour':
        return (
          <DataTable
            columns={tourColumns}
            data={parsedData.tour.name ? [parsedData.tour] : []}
            getRowIsDirty={getRowIsDirty('tour')}
            getRowKey={(_, index) => `tour-${index}`}
            emptyMessage="暂无巡演信息"
          />
        );
      case 'stops':
        return (
          <DataTable
            columns={stopsColumns}
            data={parsedData.stops}
            getRowIsDirty={getRowIsDirty('stops')}
            getRowKey={(row, index) => (row as Partial<Stop>).city || `stop-${index}`}
            emptyMessage="暂无站点数据"
          />
        );
      case 'merch':
        return (
          <DataTable
            columns={merchColumns}
            data={parsedData.merch}
            getRowIsDirty={getRowIsDirty('merch')}
            getRowKey={(row, index) => (row as Partial<MerchItem>).name || `merch-${index}`}
            emptyMessage="暂无周边商品数据"
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-rock-dark relative">
      <div className="absolute inset-0 bg-grid opacity-20" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-rock text-4xl text-white neon-glow-pink">
              数据导入
            </h1>
            {rawFiles.length > 0 && (
              <span className="text-sm text-gray-400">
                已选择 {rawFiles.length} 个文件
              </span>
            )}
          </div>
          <p className="text-gray-400">
            上传巡演数据或选择样例数据，开始你的预算挑战
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!hasData && !isProcessing && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-neon-cyan bg-neon-cyan/10 shadow-neon-cyan'
                    : 'border-rock-light hover:border-neon-pink hover:bg-neon-pink/5'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-neon-cyan' : 'text-neon-pink'}`} />
                <h3 className="font-rock text-2xl text-white mb-2">
                  拖拽文件到此处
                </h3>
                <p className="text-gray-400 mb-4">
                  或点击选择文件，支持 CSV / Excel 格式
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>tour.csv, stops.csv, merch.csv</span>
                </div>
              </motion.div>

              <div className="my-12 flex items-center gap-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-rock-light" />
                <span className="text-gray-500 font-rock tracking-widest text-sm">或选择样例数据</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-rock-light" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sampleButtons.map((sample, index) => (
                  <motion.div
                    key={sample.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => importSampleData(sample.type)}
                    className="cursor-pointer"
                  >
                    <NeonCard
                      borderColor={
                        sample.variant === 'success'
                          ? 'success-green'
                          : sample.variant === 'warning'
                          ? 'warning-orange'
                          : 'danger-red'
                      }
                      className="h-full group"
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex-1">
                          <div
                            className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                              sample.variant === 'success'
                                ? 'bg-success-green/20'
                                : sample.variant === 'warning'
                                ? 'bg-warning-orange/20'
                                : 'bg-danger-red/20'
                            }`}
                          >
                            <FileSpreadsheet
                              className={`w-6 h-6 ${
                                sample.variant === 'success'
                                  ? 'text-success-green'
                                  : sample.variant === 'warning'
                                  ? 'text-warning-orange'
                                  : 'text-danger-red'
                              }`}
                            />
                          </div>
                          <h4 className="font-rock text-lg text-white mb-2">
                            {sample.label}
                          </h4>
                          <p className="text-gray-400 text-sm">
                            {sample.description}
                          </p>
                        </div>
                        <NeonButton
                          variant={sample.variant}
                          size="sm"
                          className="mt-4 w-full"
                          loading={isProcessing && locationState?.sampleType === sample.type}
                        >
                          导入
                        </NeonButton>
                      </div>
                    </NeonCard>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <RefreshCw className="w-16 h-16 text-neon-cyan animate-spin mb-6" />
              <h3 className="font-rock text-2xl text-white mb-2">正在处理数据...</h3>
              <p className="text-gray-400">解析、校验、清洗中，请稍候</p>
            </motion.div>
          )}

          {hasData && !isProcessing && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {(errors.length > 0 || warnings.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  {errors.length > 0 && (
                    <div className="bg-danger-red/10 border border-danger-red rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-danger-red flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-rock text-danger-red mb-2">
                            错误 ({errors.length})
                          </h4>
                          <div className="space-y-2">
                            {errors.map((error: ValidationError) => (
                              <div
                                key={error.id}
                                className="flex items-start justify-between gap-4 text-sm"
                              >
                                <div>
                                  <span className="text-danger-red font-mono">
                                    {error.field}
                                    {error.rowIndex !== undefined && ` (行 ${error.rowIndex + 1})`}
                                  </span>
                                  <span className="text-gray-400 ml-2">
                                    {error.message}
                                  </span>
                                </div>
                                <button
                                  onClick={() => dismissError(error.id)}
                                  className="text-gray-500 hover:text-danger-red transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="bg-warning-orange/10 border border-warning-orange rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-warning-orange flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-rock text-warning-orange mb-2">
                            警告 ({warnings.length})
                          </h4>
                          <div className="space-y-2">
                            {warnings.map((error: ValidationError) => (
                              <div
                                key={error.id}
                                className="flex items-start justify-between gap-4 text-sm"
                              >
                                <div>
                                  <span className="text-warning-orange font-mono">
                                    {error.field}
                                    {error.rowIndex !== undefined && ` (行 ${error.rowIndex + 1})`}
                                  </span>
                                  <span className="text-gray-400 ml-2">
                                    {error.message}
                                  </span>
                                </div>
                                <button
                                  onClick={() => dismissError(error.id)}
                                  className="text-gray-500 hover:text-warning-orange transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-rock text-sm tracking-wide transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'bg-neon-pink text-white shadow-neon-pink'
                          : 'bg-rock-darker text-gray-400 hover:text-white hover:bg-rock-light/50'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          activeTab === tab.id
                            ? 'bg-white/20'
                            : 'bg-rock-light/50'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {canStartGame() ? (
                    <span className="flex items-center gap-2 text-success-green">
                      <CheckCircle2 className="w-4 h-4" />
                      数据校验通过
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500">
                      <AlertCircle className="w-4 h-4" />
                      请完成数据校验和清洗
                    </span>
                  )}
                </div>
              </div>

              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {renderTabContent()}
              </motion.div>

              {sortedLogs.length > 0 && (
                <ProcessingLogPanel
                  logs={sortedLogs}
                  onResolve={resolveLogEntry}
                />
              )}

              <div className="flex items-center justify-between pt-6 border-t border-rock-light/30">
                <div className="flex gap-4">
                  <NeonButton
                    variant="secondary"
                    onClick={handleCancel}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    取消
                  </NeonButton>
                  <NeonButton
                    variant="warning"
                    onClick={handleReimport}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新导入
                  </NeonButton>
                </div>

                <NeonButton
                  variant="primary"
                  size="lg"
                  onClick={handleStartGame}
                  disabled={!canStartGame()}
                  loading={isProcessing}
                  className="gap-3"
                >
                  <PlayCircle className="w-5 h-5" />
                  开始游戏
                </NeonButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
