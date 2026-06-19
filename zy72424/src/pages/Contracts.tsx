import { useState, useRef } from 'react';
import {
  Upload,
  Eye,
  Clock,
  FileText,
  AlertCircle,
  X,
  CheckCircle,
  Download,
  ChevronDown,
  ChevronUp,
  History as HistoryIcon,
  Link as LinkIcon,
  List,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatDate, formatBytes, generateId } from '../utils/boundaryRules';
import { calculateFileHash, checkDuplicate, handleDuplicateImport, DuplicateImportResult } from '../utils/fileHash';
import { ContractScreenshot } from '../types';

interface ImportResultItem {
  fileName: string;
  status: 'new' | 'duplicate' | 'error';
  prevImportCount?: number;
  newImportCount?: number;
  lastImportTime?: Date;
  newImportTime?: Date;
  contractId?: string;
  message?: string;
  errorMessage?: string;
}

export default function Contracts() {
  const navigate = useNavigate();
  const contracts = useStore((state) => state.contracts);
  const history = useStore((state) => state.history);
  const addContract = useStore((state) => state.addContract);
  const updateContract = useStore((state) => state.updateContract);
  const currentUser = useStore((state) => state.currentUser);

  const [isDragging, setIsDragging] = useState(false);
  const [previewContract, setPreviewContract] = useState<ContractScreenshot | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [lastImportResults, setLastImportResults] = useState<ImportResultItem[] | null>(null);
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const results: ImportResultItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        results.push({
          fileName: file.name,
          status: 'error',
          errorMessage: '文件格式不是图片，仅支持 JPG、PNG 等图片格式',
        });
        continue;
      }

      try {
        const hash = await calculateFileHash(file);
        const existing = checkDuplicate(hash, contracts);

        if (existing) {
          const result: DuplicateImportResult = handleDuplicateImport(existing);
          updateContract(existing.id, result.updated, currentUser.name);
          results.push({
            fileName: file.name,
            status: 'duplicate',
            prevImportCount: result.details.prevImportCount,
            newImportCount: result.details.newImportCount,
            lastImportTime: result.details.lastImportTime,
            newImportTime: result.details.newImportTime,
            contractId: existing.id,
            message: result.message,
          });
        } else {
          const newContract: ContractScreenshot = {
            id: generateId('contract'),
            fileName: file.name,
            fileHash: hash,
            fileUrl: URL.createObjectURL(file),
            fileSize: file.size,
            uploadTime: new Date(),
            lastImportTime: new Date(),
            importCount: 1,
          };
          addContract(newContract);
          results.push({
            fileName: file.name,
            status: 'new',
            newImportCount: 1,
            newImportTime: new Date(),
            contractId: newContract.id,
            message: `首次导入成功，记为第 1 次导入，已计入总数`,
          });
        }
      } catch (e) {
        results.push({
          fileName: file.name,
          status: 'error',
          errorMessage: '文件处理失败：' + (e instanceof Error ? e.message : '未知错误'),
        });
      }
    }

    const newCount = results.filter((r) => r.status === 'new').length;
    const dupCount = results.filter((r) => r.status === 'duplicate').length;
    const errCount = results.filter((r) => r.status === 'error').length;

    const summaryParts: string[] = [];
    if (newCount > 0) summaryParts.push(`新导入 ${newCount} 个文件（计入总数）`);
    if (dupCount > 0) summaryParts.push(`${dupCount} 个重复文件（导入次数累加，总数不翻倍）`);
    if (errCount > 0) summaryParts.push(`${errCount} 个失败`);
    if (summaryParts.length > 0) {
      const type = errCount > 0 ? 'error' : dupCount > 0 ? 'warning' : 'success';
      setUploadMessage({ type, text: summaryParts.join('，') + '。下方有每个文件的详细处理信息。' });
    }

    setLastImportResults(results);
    setTimeout(() => setUploadMessage(null), 10000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      operator: currentUser.name,
      summary: {
        totalContracts: contracts.length,
        totalImportAttempts: contracts.reduce((sum, c) => sum + Number(c.importCount || 0), 0),
      },
      contracts: contracts.map((c) => {
        const relatedHistory = history.filter((h) => h.recordId === c.id);
        return {
          id: c.id,
          fileName: c.fileName,
          fileSize: Number(c.fileSize),
          fileSizeFormatted: formatBytes(Number(c.fileSize)),
          sha256Hash: c.fileHash,
          uploadTime: c.uploadTime,
          uploadTimeFormatted: formatDate(c.uploadTime),
          lastImportTime: c.lastImportTime,
          lastImportTimeFormatted: formatDate(c.lastImportTime),
          importCount: Number(c.importCount),
          importCountDataType: typeof Number(c.importCount),
          history: relatedHistory.map((h) => ({
            id: h.id,
            fieldName: h.fieldName,
            oldValue: h.oldValue,
            newValue: h.newValue,
            oldValueDataType: typeof h.oldValue,
            newValueDataType: typeof h.newValue,
            changedBy: h.changedBy,
            changedAt: h.changedAt,
            changedAtFormatted: formatDate(h.changedAt),
            changeType: h.changeType,
          })),
        };
      }),
      verification: {
        importCountIsAlwaysNumber: contracts.every((c) => !isNaN(Number(c.importCount))),
        noStringConcatenation: contracts.every((c) => {
          const n = Number(c.importCount);
          return Number.isInteger(n) && n >= 1;
        }),
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-import-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusTag = (status: ImportResultItem['status']) => {
    switch (status) {
      case 'new':
        return <span className="tag tag-normal">首次导入</span>;
      case 'duplicate':
        return <span className="tag tag-pending">重复导入 · 不翻倍</span>;
      case 'error':
        return <span className="tag tag-rejected">导入失败</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-800">
            合同页截图管理
          </h1>
          <p className="text-gray-600 mt-1">
            导入合同页截图，系统自动 SHA-256 哈希去重，重复导入次数累加、总数不翻倍
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={exportReport}
        >
          <Download className="w-4 h-4" />
          导出导入报告
        </button>
      </div>

      {uploadMessage && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            uploadMessage.type === 'success'
              ? 'bg-success-50 border border-success-200 text-success-800'
              : uploadMessage.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-danger-50 border border-danger-200 text-danger-800'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{uploadMessage.text}</p>
          </div>
        </div>
      )}

      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <p className="text-sm font-medium text-primary-800 mb-2">重复导入边界规则</p>
        <ul className="text-xs text-primary-700 space-y-1 list-disc list-inside">
          <li>同一张图片（相同 SHA-256）再次上传时，<code className="bg-primary-100 px-1 rounded">importCount</code> 按数字类型 <code className="bg-primary-100 px-1 rounded">+1</code> 累加，不执行字符串拼接</li>
          <li>回滚后再次上传，依然从回滚后的数字开始累加，不会变成 "21" 之类的拼接错误</li>
          <li>重复导入只更新时间和次数，排练迟到统计总数不翻倍</li>
        </ul>
      </div>

      {lastImportResults && lastImportResults.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-semibold text-primary-800 flex items-center gap-2">
              <List className="w-5 h-5 text-primary-500" />
              本次导入处理详情（{lastImportResults.length} 个文件）
            </h2>
            <span className="text-xs text-gray-500">
              操作人：{currentUser.name} · {formatDate(new Date())}
            </span>
          </div>
          <div className="space-y-2">
            {lastImportResults.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  item.status === 'new'
                    ? 'bg-success-50/50 border-success-200'
                    : item.status === 'duplicate'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-danger-50/50 border-danger-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusTag(item.status)}
                      <span className="font-medium text-primary-800">{item.fileName}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.message || item.errorMessage}</p>

                    {item.status === 'duplicate' && (
                      <div className="mt-3 grid grid-cols-4 gap-4 text-xs">
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <p className="text-gray-500 mb-0.5">上次导入时间</p>
                          <p className="font-medium text-primary-700">{formatDate(item.lastImportTime!)}</p>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <p className="text-gray-500 mb-0.5">当前导入时间</p>
                          <p className="font-medium text-primary-700">{formatDate(item.newImportTime!)}</p>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <p className="text-gray-500 mb-0.5">之前导入次数</p>
                          <p className="font-medium text-accent-700">第 {item.prevImportCount} 次 · 类型 number</p>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <p className="text-gray-500 mb-0.5">现在导入次数</p>
                          <p className="font-medium text-success-700">第 {item.newImportCount} 次 · +1 数字累加</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {item.contractId && (
                    <div className="flex flex-col gap-1">
                      <button
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        onClick={() => {
                          const c = contracts.find((c2) => c2.id === item.contractId);
                          if (c) setPreviewContract(c);
                        }}
                      >
                        <Eye className="w-3 h-3" /> 预览
                      </button>
                      <button
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        onClick={() => navigate('/history')}
                      >
                        <HistoryIcon className="w-3 h-3" /> 历史
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary-600' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-primary-800 mb-1">
          拖拽合同页截图到此处
        </p>
        <p className="text-sm text-gray-500">
          或点击选择文件，支持 JPG、PNG 格式
        </p>
        <p className="text-xs text-gray-400 mt-2">
          系统基于 SHA-256 哈希自动去重，重复导入不翻倍统计
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-semibold text-primary-800">
            已导入截图（{contracts.length} 个文件，累计 {contracts.reduce((s, c) => s + Number(c.importCount || 0), 0)} 次导入尝试）
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {contracts.map((contract) => {
            const isExpanded = expandedContractId === contract.id;
            const relatedHistory = history.filter((h) => h.recordId === contract.id);
            return (
              <div
                key={contract.id}
                className="group relative bg-gray-50 rounded-lg overflow-hidden border border-gray-100 hover:border-primary-200 transition-all"
              >
                <div className="aspect-video overflow-hidden bg-primary-100">
                  <img
                    src={contract.fileUrl}
                    alt={contract.fileName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-primary-800 truncate">
                    {contract.fileName}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {formatBytes(Number(contract.fileSize))}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      导入 <span className="font-semibold text-accent-700">{Number(contract.importCount)}</span> 次
                      <span className="text-gray-400">· 类型 {typeof Number(contract.importCount)}</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    上次导入：{formatDate(contract.lastImportTime)}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      onClick={() => setExpandedContractId(isExpanded ? null : contract.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? '收起关联信息' : '展开关联信息'}（历史 {relatedHistory.length} 条）
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 text-xs">
                        <div>
                          <p className="text-gray-500 mb-1">SHA-256 哈希</p>
                          <code className="block bg-gray-100 p-2 rounded break-all font-mono text-gray-700">
                            {contract.fileHash}
                          </code>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">变更历史（回滚此变更入口在历史页）</p>
                          {relatedHistory.length === 0 ? (
                            <p className="text-gray-400">暂无变更历史</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {relatedHistory
                                .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                                .slice(0, 5)
                                .map((h) => (
                                  <div
                                    key={h.id}
                                    className="p-2 bg-white rounded border border-gray-100"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-600">
                                        <span className="font-medium text-primary-700">{h.fieldName}</span>
                                        {' '}
                                        {h.oldValue} → {h.newValue}
                                      </span>
                                      <span className="text-gray-400">{formatDate(h.changedAt)}</span>
                                    </div>
                                    <p className="text-gray-400 mt-0.5">操作人：{h.changedBy} · {h.changeType}</p>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            className="px-2 py-1 bg-primary-50 text-primary-700 rounded border border-primary-200 hover:bg-primary-100 flex items-center gap-1"
                            onClick={() => navigate('/aliases')}
                          >
                            <LinkIcon className="w-3 h-3" /> 关联曲目别名备注
                          </button>
                          <button
                            className="px-2 py-1 bg-primary-50 text-primary-700 rounded border border-primary-200 hover:bg-primary-100 flex items-center gap-1"
                            onClick={() => navigate('/history')}
                          >
                            <HistoryIcon className="w-3 h-3" /> 回滚此变更
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewContract(contract);
                  }}
                >
                  <Eye className="w-4 h-4 text-primary-700" />
                </button>

                {Number(contract.importCount) > 1 && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    重复导入 · 第 {Number(contract.importCount)} 次
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {previewContract && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-medium text-primary-800">{previewContract.fileName}</h3>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  导入 {Number(previewContract.importCount)} 次
                  <span className="text-gray-300">|</span>
                  {formatBytes(Number(previewContract.fileSize))}
                  <span className="text-gray-300">|</span>
                  首次 {formatDate(previewContract.uploadTime)}
                  <span className="text-gray-300">|</span>
                  最近 {formatDate(previewContract.lastImportTime)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors flex items-center gap-1"
                  onClick={() => {
                    navigate('/history');
                    setPreviewContract(null);
                  }}
                >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  历史 / 回滚
                </button>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => setPreviewContract(null)}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <img
                src={previewContract.fileUrl}
                alt={previewContract.fileName}
                className="w-full h-auto rounded-lg mb-4 border border-gray-200"
              />
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">SHA-256 哈希</p>
                <code className="block bg-white p-2 rounded border border-gray-200 break-all font-mono text-xs text-gray-700">
                  {previewContract.fileHash}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
