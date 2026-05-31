import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Download,
  FileJson,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { parseJsonContent, parseCsvContent, formatDateTime } from '@/utils';
import type { RecordStatus, RecordSource, InventoryRecord } from '@/types';

export default function Records() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const records = useAppStore(state => state.records);
  const getFilteredRecords = useAppStore(state => state.getFilteredRecords);
  const setFilters = useAppStore(state => state.setFilters);
  const filters = useAppStore(state => state.filters);
  const importRecords = useAppStore(state => state.importRecords);
  const currentUser = useAppStore(state => state.currentUser);
  const addRecord = useAppStore(state => state.addRecord);

  const [searchKeyword, setSearchKeyword] = useState(filters.keyword || '');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newRecord, setNewRecord] = useState<Partial<InventoryRecord>>({
    interfaceName: '',
    stockCode: '',
    preOccupyQty: 0,
    releaseQty: 0,
    operator: currentUser,
    source: 'manual',
    status: 'pending',
    rawData: {},
  });

  const filteredRecords = useMemo(() => {
    return getFilteredRecords();
  }, [records, filters]);

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setFilters({ ...filters, keyword: value });
  };

  const handleStatusFilter = (status: RecordStatus | undefined) => {
    setFilters({ ...filters, status });
  };

  const handleSourceFilter = (source: RecordSource | undefined) => {
    setFilters({ ...filters, source });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    const allRecords: any[] = [];

    for (const file of files) {
      const content = await file.text();
      try {
        if (file.name.endsWith('.json')) {
          const parsed = parseJsonContent(content);
          allRecords.push(...parsed);
        } else if (file.name.endsWith('.csv')) {
          const parsed = parseCsvContent(content);
          allRecords.push(...parsed);
        }
      } catch (err) {
        console.error('解析文件失败:', file.name, err);
      }
    }

    if (allRecords.length > 0) {
      const result = importRecords(allRecords, currentUser);
      setImportResult(result);
    }
  };

  const handleAddRecord = () => {
    const result = addRecord(newRecord as any);
    if (result.success) {
      setShowAddModal(false);
      setNewRecord({
        interfaceName: '',
        stockCode: '',
        preOccupyQty: 0,
        releaseQty: 0,
        operator: currentUser,
        source: 'manual',
        status: 'pending',
        rawData: {},
      });
    } else {
      alert(result.errors?.join('\n'));
    }
  };

  const resetFilters = () => {
    setFilters({});
    setSearchKeyword('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">数据管理</h1>
          <p className="mt-1 text-slate-400 text-sm">
            导入、查看和管理库存预占释放记录
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            导入数据
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            手动创建
          </button>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索库存编码、接口名称、操作人、幂等键..."
              value={searchKeyword}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filters.status || ''}
              onChange={e => handleStatusFilter((e.target.value as RecordStatus) || undefined)}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="completed">已完成</option>
              <option value="error">异常</option>
            </select>
            <select
              value={filters.source || ''}
              onChange={e => handleSourceFilter((e.target.value as RecordSource) || undefined)}
              className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">全部来源</option>
              <option value="api_doc">接口文档</option>
              <option value="call_log">调用日志</option>
              <option value="manual">手动创建</option>
            </select>
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-slate-400 hover:text-white text-sm"
            >
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  库存编码
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  接口名称
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  来源
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  预占/释放
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  操作人
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  幂等键
                </th>
                <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  创建时间
                </th>
                <th className="text-right px-4 py-3 text-slate-400 text-xs font-medium uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-white font-mono text-sm">{record.stockCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 font-mono text-sm">{record.interfaceName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={record.source} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">
                        {record.preOccupyQty} / {record.releaseQty}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">{record.operator}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${record.idempotentValid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {record.idempotentKey.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-xs">
                        {formatDateTime(record.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/records/${record.id}`)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/review`)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="复核修正"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportResult(null);
        }}
        title="导入数据"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-slate-400 text-sm mb-4">
              支持 JSON 和 CSV 格式文件。导入时会自动检查幂等键，避免重复导入。
            </p>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
              <p className="text-white font-medium mb-1">
                拖拽文件到此处或点击选择
              </p>
              <p className="text-slate-500 text-sm">
                支持 .json 和 .csv 格式
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-5 h-5 text-cyan-400" />
                <span className="text-white text-sm font-medium">JSON 格式示例</span>
              </div>
              <pre className="text-xs text-slate-400 font-mono overflow-x-auto">
{`[
  {
    "interfaceName": "preOccupyStock",
    "stockCode": "STK-001",
    "preOccupyQty": 100,
    "releaseQty": 0,
    "rawData": {...}
  }
]`}
              </pre>
            </div>
            <div className="flex-1 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span className="text-white text-sm font-medium">CSV 格式示例</span>
              </div>
              <pre className="text-xs text-slate-400 font-mono overflow-x-auto">
{`interfaceName,stockCode,preOccupyQty,releaseQty
preOccupyStock,STK-001,100,0
releaseStock,STK-002,50,50`}
              </pre>
            </div>
          </div>

          {importResult && (
            <div className={`p-4 rounded-lg border ${
              importResult.failed > 0
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {importResult.failed > 0 ? (
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <span className="text-white font-medium">导入完成</span>
              </div>
              <p className="text-sm text-slate-300">
                成功 {importResult.success} 条，失败 {importResult.failed} 条
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx} className="text-xs text-amber-400">
                      {err}
                    </li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li className="text-xs text-amber-400">
                      还有 {importResult.errors.length - 5} 条错误...
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowImportModal(false);
                setImportResult(null);
              }}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              关闭
            </button>
            {importResult && (
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="手动创建记录"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">接口名称 *</label>
              <input
                type="text"
                value={newRecord.interfaceName}
                onChange={e => setNewRecord({ ...newRecord, interfaceName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="如 preOccupyStock"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">库存编码 *</label>
              <input
                type="text"
                value={newRecord.stockCode}
                onChange={e => setNewRecord({ ...newRecord, stockCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="如 STK-2024-001"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">预占数量 *</label>
              <input
                type="number"
                min="0"
                value={newRecord.preOccupyQty}
                onChange={e => setNewRecord({ ...newRecord, preOccupyQty: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">已释放数量 *</label>
              <input
                type="number"
                min="0"
                value={newRecord.releaseQty}
                onChange={e => setNewRecord({ ...newRecord, releaseQty: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">状态</label>
              <select
                value={newRecord.status}
                onChange={e => setNewRecord({ ...newRecord, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="error">异常</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">来源</label>
              <select
                value={newRecord.source}
                onChange={e => setNewRecord({ ...newRecord, source: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="manual">手动创建</option>
                <option value="api_doc">接口文档</option>
                <option value="call_log">调用日志</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">待处理原因</label>
            <input
              type="text"
              value={newRecord.pendingReason || ''}
              onChange={e => setNewRecord({ ...newRecord, pendingReason: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
              placeholder="选填，说明为什么进入待处理"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">原始数据 (JSON)</label>
            <textarea
              value={JSON.stringify(newRecord.rawData, null, 2)}
              onChange={e => {
                try {
                  setNewRecord({ ...newRecord, rawData: JSON.parse(e.target.value) });
                } catch {}
              }}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 h-24"
              placeholder='{"orderNo": "ORD-001", "skuId": "SKU-001"}'
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddRecord}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
            >
              创建记录
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
