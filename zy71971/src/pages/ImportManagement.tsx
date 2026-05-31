import { useState, useCallback, useRef } from 'react';
import { useStore } from '@/store';
import { parseCSVFile, parseExcelFile, generateId, formatDateTime } from '@/utils/fileUtils';
import type { ContractClause, DuplicateStrategy, ImportStatus } from '@/types';
import PageHeader from '@/components/PageHeader';
import { Upload, FileSpreadsheet, RotateCcw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const IMPORT_STATUS_CONFIG: Record<ImportStatus, { label: string; icon: React.ReactNode; className: string }> = {
  success: { label: '导入成功', icon: <CheckCircle2 className="w-3.5 h-3.5" />, className: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
  partial: { label: '部分导入', icon: <AlertCircle className="w-3.5 h-3.5" />, className: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  failed: { label: '导入失败', icon: <XCircle className="w-3.5 h-3.5" />, className: 'bg-rose-400/15 text-rose-400 border-rose-400/30' },
  rolled_back: { label: '已撤回', icon: <RotateCcw className="w-3.5 h-3.5" />, className: 'bg-gray-400/15 text-gray-500 border-gray-400/30' },
};

interface ParsedClause {
  clauseNumber: string;
  content: string;
  source: string;
  sourceLink: string;
  existing?: ContractClause;
}

export default function ImportManagement() {
  const clauses = useStore((s) => s.clauses);
  const addClauses = useStore((s) => s.addClauses);
  const detectIssues = useStore((s) => s.detectIssues);
  const addImportLog = useStore((s) => s.addImportLog);
  const rollbackImport = useStore((s) => s.rollbackImport);
  const importLogs = useStore((s) => s.importLogs);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<ParsedClause[]>([]);
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [showModal, setShowModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingParsed, setPendingParsed] = useState<ParsedClause[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    setParseError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: Partial<ContractClause>[];
      if (ext === 'csv') {
        parsed = await parseCSVFile(file);
      } else if (ext === 'xlsx') {
        parsed = await parseExcelFile(file);
      } else {
        throw new Error('不支持的文件格式，请上传 .csv 或 .xlsx 文件');
      }

      const enriched: ParsedClause[] = parsed.map((p) => ({
        clauseNumber: p.clauseNumber || '',
        content: p.content || '',
        source: p.source || '',
        sourceLink: p.sourceLink || '',
        existing: clauses.find((c) => c.clauseNumber === p.clauseNumber),
      }));

      const dups = enriched.filter((c) => c.existing);
      setPendingParsed(enriched);
      setPendingFile(file);

      if (dups.length > 0) {
        setDuplicates(dups);
        setShowModal(true);
      } else {
        handleImport(enriched, 'skip', file);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : '文件解析失败');
    } finally {
      setParsing(false);
    }
  }, [clauses]);

  const handleImport = useCallback(
    (parsed: ParsedClause[], selectedStrategy: DuplicateStrategy, file: File) => {
      const batchId = generateId();
      const now = new Date().toISOString();

      const newClauses: ContractClause[] = parsed.map((p) => ({
        id: generateId(),
        clauseNumber: p.clauseNumber,
        content: p.content,
        source: p.source,
        sourceLink: p.sourceLink,
        importDate: now,
        importBatchId: batchId,
      }));

      const result = addClauses(newClauses, selectedStrategy);

      const addedClauseIds: string[] = [];
      const currentClauses = useStore.getState().clauses;
      for (const nc of newClauses) {
        const found = currentClauses.find((c) => c.clauseNumber === nc.clauseNumber && c.importBatchId === batchId);
        if (found) addedClauseIds.push(found.id);
      }

      for (const clauseId of addedClauseIds) {
        const clause = currentClauses.find((c) => c.id === clauseId);
        if (!clause) continue;
        const record = {
          id: generateId(),
          clauseId,
          question: `${clause.clauseNumber}条款内容是什么？`,
          answer: clause.content,
          status: 'normal' as const,
          judgmentReason: '',
          grayConclusion: '',
          reportConclusion: '',
          isGrayConflict: false,
          isSourceBroken: false,
          isSensitiveLeak: false,
          sensitiveWordsFound: [],
          createdAt: now,
          reviewedAt: null,
          reviewedBy: null,
        };
        const detection = detectIssues(record);
        useStore.setState((s) => ({
          qaRecords: [
            ...s.qaRecords,
            {
              ...record,
              status: detection.overallStatus,
              judgmentReason: detection.judgmentReason,
              isGrayConflict: detection.isGrayConflict,
              isSourceBroken: detection.isSourceBroken,
              isSensitiveLeak: detection.isSensitiveLeak,
              sensitiveWordsFound: detection.sensitiveWordsFound,
            },
          ],
        }));
      }

      let status: ImportStatus = 'success';
      if (result.duplicateCount > 0 && result.newCount > 0) status = 'partial';
      if (result.newCount === 0 && result.duplicateCount > 0) status = 'failed';

      addImportLog({
        id: generateId(),
        batchId,
        fileName: file.name,
        totalCount: parsed.length,
        duplicateCount: result.duplicateCount,
        newCount: result.newCount,
        status,
        importDate: now,
        operator: '当前用户',
        snapshot: addedClauseIds,
      });

      setShowModal(false);
      setDuplicates([]);
      setPendingFile(null);
      setPendingParsed([]);
      setStrategy('skip');
    },
    [addClauses, detectIssues, addImportLog]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [parseFile]
  );

  const onConfirmDuplicate = useCallback(() => {
    if (pendingParsed.length > 0 && pendingFile) {
      handleImport(pendingParsed, strategy, pendingFile);
    }
  }, [pendingParsed, pendingFile, strategy, handleImport]);

  const onCancelDuplicate = useCallback(() => {
    setShowModal(false);
    setDuplicates([]);
    setPendingFile(null);
    setPendingParsed([]);
    setStrategy('skip');
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="导入管理" subtitle="上传合同条款文件，自动解析并生成问答记录" />

      <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">文件上传</h2>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors',
            isDragOver ? 'border-blue-400 bg-blue-400/5' : 'border-[#2a3548] hover:border-[#3a4a5e] hover:bg-[#1e2a3a]'
          )}
        >
          <Upload className={cn('w-10 h-10 mb-3', isDragOver ? 'text-blue-400' : 'text-gray-500')} />
          <p className="text-sm text-gray-300 mb-1">
            {parsing ? '正在解析文件...' : '拖拽文件到此处，或点击选择文件'}
          </p>
          <p className="text-xs text-gray-500">支持 .csv、.xlsx 格式</p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={onFileSelect} className="hidden" />
        </div>

        {parseError && (
          <div className="mt-3 flex items-center gap-2 text-rose-400 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {parseError}
          </div>
        )}
      </div>

      <div className="bg-[#1a2332] border border-[#2a3548] rounded-xl p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">导入历史</h2>
        {importLogs.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">暂无导入记录</div>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#2a3548]" />
            <div className="space-y-0">
              {importLogs.map((log) => {
                const config = IMPORT_STATUS_CONFIG[log.status];
                const isRolledBack = log.status === 'rolled_back';
                return (
                  <div key={log.id} className="relative pl-8 pb-5 last:pb-0">
                    <div className={cn(
                      'absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-[#1a2332]',
                      isRolledBack ? 'border-gray-600' : 'border-[#2a3548]'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        isRolledBack ? 'bg-gray-600' : 'bg-blue-400'
                      )} />
                    </div>
                    <div className={cn(
                      'bg-[#0f1724] border border-[#2a3548] rounded-lg p-4',
                      isRolledBack && 'opacity-60'
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                          <span className={cn(
                            'text-sm font-medium',
                            isRolledBack ? 'text-gray-500 line-through' : 'text-gray-200'
                          )}>
                            {log.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium',
                            config.className
                          )}>
                            {config.icon}
                            {config.label}
                          </span>
                          {!isRolledBack && (
                            <button
                              onClick={() => rollbackImport(log.batchId)}
                              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-rose-400 transition-colors ml-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              撤回
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        'flex flex-wrap gap-x-5 gap-y-1 text-xs',
                        isRolledBack ? 'text-gray-600' : 'text-gray-400'
                      )}>
                        <span>导入时间：{formatDateTime(log.importDate)}</span>
                        <span>操作人：{log.operator}</span>
                        <span>总条数：{log.totalCount}</span>
                        <span>重复：{log.duplicateCount}</span>
                        <span>新增：{log.newCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancelDuplicate}>
          <div
            className="bg-[#1a2332] border border-[#2a3548] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[#2a3548]">
              <h3 className="text-base font-semibold text-gray-100">检测到重复条款</h3>
              <p className="text-xs text-gray-400 mt-1">以下条款编号与已有记录冲突，请选择处理策略</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {duplicates.map((dup, idx) => (
                <div key={idx} className="bg-[#0f1724] border border-[#2a3548] rounded-lg p-4">
                  <div className="text-xs font-medium text-blue-400 mb-3">条款编号：{dup.clauseNumber}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">已有条款</div>
                      <div className="text-sm text-gray-300 bg-[#1a2332] border border-[#2a3548] rounded p-2">
                        <div className="text-gray-400 text-xs mb-1">来源：{dup.existing?.source || '-'}</div>
                        <div>{dup.existing?.content || '-'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">新导入条款</div>
                      <div className="text-sm text-gray-300 bg-[#1a2332] border border-[#2a3548] rounded p-2">
                        <div className="text-gray-400 text-xs mb-1">来源：{dup.source || '-'}</div>
                        <div>{dup.content || '-'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-[#2a3548]">
              <div className="text-xs text-gray-400 mb-3">选择冲突处理策略（将应用于所有重复条款）</div>
              <div className="flex gap-3 mb-4">
                {([
                  { value: 'skip' as DuplicateStrategy, label: '跳过', desc: '保留已有条款，忽略新导入' },
                  { value: 'overwrite' as DuplicateStrategy, label: '覆盖', desc: '用新条款替换已有条款' },
                  { value: 'keep_both' as DuplicateStrategy, label: '保留两份', desc: '同时保留已有和新导入条款' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStrategy(opt.value)}
                    className={cn(
                      'flex-1 border rounded-lg p-3 text-left transition-colors',
                      strategy === opt.value
                        ? 'border-blue-400 bg-blue-400/10'
                        : 'border-[#2a3548] hover:border-[#3a4a5e]'
                    )}
                  >
                    <div className={cn(
                      'text-sm font-medium mb-0.5',
                      strategy === opt.value ? 'text-blue-400' : 'text-gray-300'
                    )}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={onCancelDuplicate}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 border border-[#2a3548] rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={onConfirmDuplicate}
                  className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  确认导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
