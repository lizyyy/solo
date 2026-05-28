import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { exportToExcel } from '../services/exportService';
import type { ExportConfig } from '../types';
import { formatDateTime } from '../utils';

export default function ExportPanel() {
  const { state } = useApp();
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<ExportConfig>({
    includeRawData: true,
    includeMatchHistory: true,
    includeConflicts: true,
    format: 'xlsx',
    sheets: ['匹配结果', '银行流水', '凭证', '发票', '冲突明细', '操作日志'],
  });

  const currentBatch = useMemo(() => {
    return state.batches.find((b) => b.id === state.currentBatchId);
  }, [state.batches, state.currentBatchId]);

  const handleToggleSheet = (sheet: string) => {
    setConfig((prev) => ({
      ...prev,
      sheets: prev.sheets.includes(sheet)
        ? prev.sheets.filter((s) => s !== sheet)
        : [...prev.sheets, sheet],
    }));
  };

  const handleExport = async () => {
    if (!state.currentBatchId) return;

    setExporting(true);
    try {
      await exportToExcel(state.currentBatchId, config);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <div className="panel-header">
        <h3>数据导出</h3>
        <button
          className="btn-primary btn-large"
          onClick={handleExport}
          disabled={!state.currentBatchId || exporting}
        >
          {exporting ? '导出中...' : '导出 Excel'}
        </button>
      </div>

      {currentBatch && (
        <div className="batch-summary">
          <h4>当前批次：{currentBatch.name}</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">银行流水</span>
              <span className="stat-value">{currentBatch.statistics.totalTransactions}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">凭证</span>
              <span className="stat-value">{currentBatch.statistics.totalVouchers}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">已匹配</span>
              <span className="stat-value stat-success">{currentBatch.statistics.matchedCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">待确认</span>
              <span className="stat-value stat-warning">{currentBatch.statistics.pendingCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">未匹配</span>
              <span className="stat-value">{currentBatch.statistics.unmatchedCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">冲突数</span>
              <span className="stat-value stat-danger">{currentBatch.statistics.conflictCount}</span>
            </div>
          </div>
          <p className="batch-time">
            创建时间：{formatDateTime(currentBatch.createdAt)}
          </p>
        </div>
      )}

      <div className="export-options">
        <h4>导出选项</h4>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={config.includeRawData}
              onChange={(e) => setConfig((prev) => ({ ...prev, includeRawData: e.target.checked }))}
            />
            包含原始数据
          </label>
          <p className="option-desc">导出银行流水、凭证、发票等原始导入数据</p>
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={config.includeConflicts}
              onChange={(e) => setConfig((prev) => ({ ...prev, includeConflicts: e.target.checked }))}
            />
            包含冲突明细
          </label>
          <p className="option-desc">导出所有冲突记录及其详细信息</p>
        </div>

        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={config.includeMatchHistory}
              onChange={(e) => setConfig((prev) => ({ ...prev, includeMatchHistory: e.target.checked }))}
            />
            包含操作日志
          </label>
          <p className="option-desc">导出所有匹配的操作历史（人工确认、调整等）</p>
        </div>

        <div className="option-group">
          <h5>选择导出工作表：</h5>
          <div className="sheet-checkboxes">
            {[
              { key: '匹配结果', desc: '匹配结果主表' },
              { key: '银行流水', desc: '原始流水数据' },
              { key: '凭证', desc: '原始凭证数据' },
              { key: '发票', desc: '原始发票数据' },
              { key: '冲突明细', desc: '所有冲突记录' },
              { key: '操作日志', desc: '操作历史记录' },
            ].map((sheet) => (
              <label key={sheet.key} className="sheet-option">
                <input
                  type="checkbox"
                  checked={config.sheets.includes(sheet.key)}
                  onChange={() => handleToggleSheet(sheet.key)}
                />
                <span className="sheet-name">{sheet.key}</span>
                <span className="sheet-desc"> - {sheet.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="export-preview">
        <h4>导出内容预览</h4>
        <div className="preview-content">
          <p>
            <strong>匹配结果：</strong>
            {state.matchRecords.length} 条记录，
            其中 <span className="text-success">{state.matchRecords.filter((m) => m.status === 'confirmed').length}</span> 条已确认，
            <span className="text-warning">{state.matchRecords.filter((m) => m.status === 'pending').length}</span> 条待确认
          </p>
          <p>
            <strong>冲突记录：</strong>
            {state.matchRecords.filter((m) => m.conflicts.length > 0).length} 条匹配存在冲突
          </p>
          <p>
            <strong>原始数据：</strong>
            {state.transactions.length} 条流水，{state.vouchers.length} 条凭证
          </p>
        </div>
      </div>

      <div className="export-notice">
        <h4>📋 导出说明</h4>
        <ul>
          <li>导出的 Excel 文件将包含原始数据和处理结果，便于追溯</li>
          <li>匹配结果中标注了匹配状态、匹配分数和冲突信息</li>
          <li>操作日志记录了所有人工干预的时间和内容</li>
          <li>冲突明细工作表专门列出所有需要关注的异常情况</li>
        </ul>
      </div>
    </div>
  );
}
