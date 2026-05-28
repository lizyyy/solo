import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { importFile, saveImportedData, resolveImportConflict } from '../services/importService';
import { formatDateTime, getSourceTypeLabel } from '../utils';
import { generateSampleData } from '../utils/sampleData';
import { dbOperations } from '../db';
import { updateBatchStatistics } from '../services/matchService';
import type { ImportConflict } from '../types';

export default function ImportPanel() {
  const { state, refreshBatch } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Array<{
    fileName: string;
    type: string;
    count: number;
    duplicates: number;
  }>>([]);

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
    const results: Array<{
      fileName: string;
      type: string;
      count: number;
      duplicates: number;
    }> = [];

    try {
      for (const file of files) {
        try {
          const { source, data, duplicateCount } = await importFile(file, state.currentBatchId);
          await saveImportedData(source, data);
          
          results.push({
            fileName: file.name,
            type: getSourceTypeLabel(source.type),
            count: data.transactions.length + data.vouchers.length + 
                   data.invoices.length + data.contracts.length,
            duplicates: duplicateCount,
          });
        } catch (error) {
          results.push({
            fileName: file.name,
            type: '错误',
            count: 0,
            duplicates: 0,
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
    await resolveImportConflict(conflictId, resolution);
    await refreshBatch();
  }, [refreshBatch]);

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
                <th>导入数量</th>
                <th>重复数量</th>
              </tr>
            </thead>
            <tbody>
              {importResults.map((result, index) => (
                <tr key={index}>
                  <td>{result.fileName}</td>
                  <td>{result.type}</td>
                  <td>{result.count}</td>
                  <td className={result.duplicates > 0 ? 'text-warning' : ''}>
                    {result.duplicates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <h4>导入冲突（需要处理）</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>新记录标识</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.importConflicts.map((conflict: ImportConflict) => (
                <tr key={conflict.id}>
                  <td>{getSourceTypeLabel(conflict.sourceType)}</td>
                  <td>
                    {(conflict.newRecord as any).transactionNo || 
                     (conflict.newRecord as any).voucherNo}
                  </td>
                  <td>
                    <button 
                      className="btn-sm btn-secondary"
                      onClick={() => handleResolveConflict(conflict.id, 'skip')}
                    >
                      跳过
                    </button>
                    <button 
                      className="btn-sm btn-warning"
                      onClick={() => handleResolveConflict(conflict.id, 'overwrite')}
                    >
                      覆盖
                    </button>
                    <button 
                      className="btn-sm btn-primary"
                      onClick={() => handleResolveConflict(conflict.id, 'append')}
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
