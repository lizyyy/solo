import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { importFile, resolveImportConflict, resolveAllConflicts } from '../services/importService';
import type { ImportResult } from '../services/importService';
import { formatDateTime, getSourceTypeLabel } from '../utils';
import { generateSampleData } from '../utils/sampleData';
import { dbOperations } from '../db';
import { updateBatchStatistics } from '../services/matchService';
import type { ImportConflict } from '../types';

export default function ImportPanel() {
  const { state, refreshBatch } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      setFiles(Array.from(fileList));
      setImportResults([]);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!state.currentBatchId || files.length === 0) return;

    setImporting(true);
    const results: ImportResult[] = [];

    try {
      for (const file of files) {
        try {
          const result = await importFile(file, state.currentBatchId);
          results.push(result);
        } catch (error) {
          results.push({
            source: {
              id: '',
              name: file.name,
              type: 'bank',
              importTime: Date.now(),
              fileHash: '',
              recordCount: 0,
              batchId: state.currentBatchId,
            },
            data: { transactions: [], vouchers: [], invoices: [], contracts: [] },
            conflicts: [],
            sameFileDetected: false,
            cleanCount: 0,
            conflictCount: 0,
          });
        }
      }

      setImportResults(results);
      await refreshBatch();
    } finally {
      setImporting(false);
    }
  }, [state.currentBatchId, files, refreshBatch]);

  const handleResolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'skip' | 'overwrite' | 'append'
  ) => {
    if (!state.currentBatchId) return;
    await resolveImportConflict(conflictId, resolution, state.currentBatchId);
    await refreshBatch();
  }, [state.currentBatchId, refreshBatch]);

  const handleResolveAll = useCallback(async (
    resolution: 'skip' | 'overwrite' | 'append'
  ) => {
    if (!state.currentBatchId) return;
    setImporting(true);
    try {
      await resolveAllConflicts(state.currentBatchId, resolution);
      await refreshBatch();
    } finally {
      setImporting(false);
    }
  }, [state.currentBatchId, refreshBatch]);

  const handleLoadSample = useCallback(async () => {
    if (!state.currentBatchId) return;

    setImporting(true);
    try {
      const { transactions, vouchers, invoices, contracts, sources } = generateSampleData(state.currentBatchId);

      for (const source of sources) {
        await dbOperations.sources.add(source);
      }
      await dbOperations.transactions.addMany(transactions);
      await dbOperations.vouchers.addMany(vouchers);
      await dbOperations.invoices.addMany(invoices);
      await dbOperations.contracts.addMany(contracts);

      await updateBatchStatistics(state.currentBatchId);
      await refreshBatch();
    } finally {
      setImporting(false);
    }
  }, [state.currentBatchId, refreshBatch]);

  return (
    <div className="import-panel">
      <div className="import-section">
        <h3>数据导入</h3>
        <div className="file-upload">
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={!state.currentBatchId || importing}
          />
          {files.length > 0 && (
            <div className="file-list">
              <p>已选择 {files.length} 个文件：</p>
              <ul>
                {files.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={handleImport}
          disabled={!state.currentBatchId || files.length === 0 || importing}
        >
          {importing ? '导入中...' : '开始导入'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleLoadSample}
          disabled={!state.currentBatchId || importing}
          style={{ marginLeft: '12px' }}
        >
          📋 加载样例数据
        </button>
      </div>

      {importResults.length > 0 && (
        <div className="import-results">
          <h4>导入结果</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>类型</th>
                <th>成功导入</th>
                <th>重复待处理</th>
                <th>同文件重复</th>
              </tr>
            </thead>
            <tbody>
              {importResults.map((result, index) => (
                <tr key={index}>
                  <td>{result.source.name}</td>
                  <td>{getSourceTypeLabel(result.source.type)}</td>
                  <td className="text-success">{result.cleanCount}</td>
                  <td className={result.conflictCount > 0 ? 'text-warning' : ''}>
                    {result.conflictCount}
                  </td>
                  <td className={result.sameFileDetected ? 'text-danger' : ''}>
                    {result.sameFileDetected ? '是' : '否'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {importResults.some(r => r.sameFileDetected) && (
            <div className="import-hint" style={{ marginTop: '8px', padding: '8px 12px', background: '#fff7e6', borderRadius: '4px', fontSize: '13px' }}>
              ⚠️ 检测到同文件重复导入，重复记录已进入下方冲突队列，请选择跳过/覆盖/追加
            </div>
          )}
        </div>
      )}

      {state.sources.length > 0 && (
        <div className="sources-section">
          <h4>已导入数据源</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>类型</th>
                <th>记录数</th>
                <th>导入时间</th>
              </tr>
            </thead>
            <tbody>
              {state.sources.map((source) => (
                <tr key={source.id}>
                  <td>{source.name}</td>
                  <td>{getSourceTypeLabel(source.type)}</td>
                  <td>{source.recordCount}</td>
                  <td>{formatDateTime(source.importTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state.importConflicts.length > 0 && (
        <div className="conflicts-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>导入冲突（需要处理） — {state.importConflicts.length} 条</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-sm btn-secondary"
                onClick={() => handleResolveAll('skip')}
                disabled={importing}
              >
                全部跳过
              </button>
              <button
                className="btn-sm btn-warning"
                onClick={() => handleResolveAll('overwrite')}
                disabled={importing}
              >
                全部覆盖
              </button>
              <button
                className="btn-sm btn-primary"
                onClick={() => handleResolveAll('append')}
                disabled={importing}
              >
                全部追加
              </button>
            </div>
          </div>
          <div className="conflict-hint" style={{ marginBottom: '12px', padding: '8px 12px', background: '#fff2f0', borderRadius: '4px', fontSize: '13px' }}>
            <strong>跳过</strong>：保留旧记录，丢弃新记录 &nbsp;|&nbsp;
            <strong>覆盖</strong>：删除旧记录，写入新记录 &nbsp;|&nbsp;
            <strong>追加</strong>：保留旧记录，新记录以"副本"后缀写入
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>记录标识</th>
                <th>来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.importConflicts.map((conflict: ImportConflict) => (
                <tr key={conflict.id} className={conflict.isSameFile ? 'row-conflict' : ''}>
                  <td>{getSourceTypeLabel(conflict.sourceType)}</td>
                  <td>{conflict.recordKey}</td>
                  <td>
                    {conflict.isSameFile ? (
                      <span className="text-danger">同文件重复</span>
                    ) : (
                      <span className="text-warning">跨文件重复</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-sm btn-secondary"
                      onClick={() => handleResolveConflict(conflict.id, 'skip')}
                      disabled={importing}
                    >
                      跳过
                    </button>
                    <button
                      className="btn-sm btn-warning"
                      onClick={() => handleResolveConflict(conflict.id, 'overwrite')}
                      disabled={importing}
                    >
                      覆盖
                    </button>
                    <button
                      className="btn-sm btn-primary"
                      onClick={() => handleResolveConflict(conflict.id, 'append')}
                      disabled={importing}
                    >
                      追加
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
