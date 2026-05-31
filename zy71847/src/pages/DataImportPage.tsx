import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, SkipForward, Check, X, Wand2 } from 'lucide-react';
import { FileUploadZone } from '@/components/import/FileUploadZone';
import { ConflictResolutionCard } from '@/components/import/ConflictResolutionCard';
import { useCableStore } from '@/store/cableStore';
import { ParsedExcelRow, DataSource, CableRecord, SuggestedAction, ImportConflict } from '@/types';
import { generateHumanMessage } from '@/utils/humanMessageGenerator';
import { HumanMessageCard } from '@/components/common/HumanMessageCard';

export const DataImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { detectImportConflicts, conflicts, setConflicts, resolveConflict, resolveAllConflicts, importRecords } = useCableStore();
  
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[] | null>(null);
  const [parsedRecords, setParsedRecords] = useState<Partial<CableRecord>[] | null>(null);
  const [currentSource, setCurrentSource] = useState<DataSource | null>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParseComplete = useCallback((rows: ParsedExcelRow[], records: Partial<CableRecord>[], source: DataSource) => {
    setParsedRows(rows);
    setParsedRecords(records);
    setCurrentSource(source);
    const foundConflicts = detectImportConflicts(records, source);
    setConflicts(foundConflicts);
    setStep('review');
  }, [detectImportConflicts, setConflicts]);

  const handleResolveConflict = (index: number, action: SuggestedAction) => {
    resolveConflict(index, action, '张伟');
  };

  const handleResolveAll = (action: SuggestedAction) => {
    resolveAllConflicts(action, '张伟');
  };

  const handleConfirmImport = () => {
    if (!parsedRecords || !currentSource) return;
    
    const unresolved = conflicts.filter(c => !c.resolved);
    if (unresolved.length > 0) {
      setError(`还有 ${unresolved.length} 条冲突未处理，请先处理所有冲突`);
      return;
    }

    const result = importRecords(parsedRecords, currentSource, '张伟');
    setImportResult({ added: result.added, skipped: result.skipped });
    setStep('complete');
  };

  const unresolvedCount = conflicts.filter(c => !c.resolved).length;
  const duplicateCount = conflicts.filter(c => c.conflictType === 'duplicate').length;
  const flippedCount = conflicts.filter(c => c.conflictType === 'coordinate_flipped').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">数据导入</h1>
                <p className="text-xs text-gray-500">
                  步骤 {step === 'upload' ? '1/3' : step === 'review' ? '2/3' : '3/3'} - 
                  {step === 'upload' ? ' 上传文件' : step === 'review' ? ' 冲突处理' : ' 完成'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === 'upload' ? 'bg-signal-blue text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                上传
              </div>
              <div className={`w-8 h-0.5 ${step !== 'upload' ? 'bg-signal-green' : 'bg-gray-200'}`} />
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === 'review' ? 'bg-signal-blue text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                处理
              </div>
              <div className={`w-8 h-0.5 ${step === 'complete' ? 'bg-signal-green' : 'bg-gray-200'}`} />
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === 'complete' ? 'bg-signal-green text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                完成
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6">
            <HumanMessageCard
              message={{
                level: 'error',
                title: '操作无法继续',
                description: error,
                reason: '所有冲突必须处理完毕才能确认导入',
                nextSteps: [{ text: '知道了' }],
              }}
              onAction={() => setError(null)}
            />
          </div>
        )}

        {step === 'upload' && (
          <FileUploadZone
            onParseComplete={handleParseComplete}
            onError={(msg) => setError(msg)}
          />
        )}

        {step === 'review' && parsedRows && parsedRecords && currentSource && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">数据概览</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800 font-mono">{parsedRows.length}</p>
                  <p className="text-xs text-gray-500">解析记录</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600 font-mono">{duplicateCount}</p>
                  <p className="text-xs text-amber-600">重复记录</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600 font-mono">{flippedCount}</p>
                  <p className="text-xs text-red-600">坐标翻转</p>
                </div>
                <div className={`rounded-lg p-4 text-center ${unresolvedCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <p className={`text-2xl font-bold font-mono ${unresolvedCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {unresolvedCount}
                  </p>
                  <p className={`text-xs ${unresolvedCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>待处理</p>
                </div>
              </div>

              {conflicts.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-signal-orange" />
                      需要处理的冲突 ({conflicts.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveAll('skip')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        全部跳过
                      </button>
                      <button
                        onClick={() => handleResolveAll('overwrite')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-signal-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        全部覆盖
                      </button>
                      <button
                        onClick={() => handleResolveAll('keep')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-signal-green text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        全部智能处理
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {conflicts.length > 0 && (
              <div className="space-y-4">
                {conflicts.map((conflict, index) => (
                  <ConflictResolutionCard
                    key={index}
                    conflict={conflict}
                    index={index}
                    onResolve={handleResolveConflict}
                  />
                ))}
              </div>
            )}

            {conflicts.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircle className="w-12 h-12 text-signal-green mx-auto mb-3" />
                <h4 className="font-semibold text-green-800 mb-1">太棒了！没有发现冲突</h4>
                <p className="text-sm text-green-600">所有数据都可以直接导入</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                重新上传
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={unresolvedCount > 0}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  unresolvedCount > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-signal-green text-white hover:bg-green-600'
                }`}
              >
                <Check className="w-4 h-4" />
                确认导入
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-signal-green" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">导入完成！</h2>
            <p className="text-gray-600 mb-8">
              成功导入 <span className="font-semibold text-signal-green">{importResult.added}</span> 条记录
              {importResult.skipped > 0 && (
                <span>，跳过 <span className="font-semibold text-gray-500">{importResult.skipped}</span> 条</span>
              )}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setStep('upload');
                  setParsedRows(null);
                  setParsedRecords(null);
                  setCurrentSource(null);
                  setConflicts([]);
                  setImportResult(null);
                }}
                className="px-6 py-2 text-sm text-signal-blue hover:bg-blue-50 rounded-lg transition-colors"
              >
                继续导入
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 text-sm bg-industrial-800 text-white rounded-lg hover:bg-industrial-700 transition-colors"
              >
                返回列表
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
