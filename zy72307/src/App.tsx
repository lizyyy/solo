import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { WeightTableData, UnifiedResult, WeightRowStatus, ChangeHistoryEntry } from './types';
import {
  processImportedData,
  updateWeightRow as updateWeightRowFn,
  recalculateAfterEdit,
  advanceProcessStep,
  markRowReviewed,
  updateRowNote
} from './utils/dataProcessor';
import { buildUnifiedResult, setGlobalDataVersion } from './utils/resultSource';
import { exportToExcel, exportForAPI } from './utils/excelHandler';
import { FileUpload, FileLoadResult } from './components/FileUpload';
import { ProcessSteps } from './components/ProcessSteps';
import { WeightTable } from './components/WeightTable';
import { MatrixWarning } from './components/MatrixWarning';
import { SummaryPanel } from './components/SummaryPanel';
import { FormulaReviewModal } from './components/FormulaReviewModal';
import { ChangeHistoryPanel } from './components/ChangeHistoryPanel';
import { ReviewDetailPanel } from './components/ReviewDetailPanel';
import './styles.css';

const App: React.FC = () => {
  const [tableData, setTableData] = useState<WeightTableData | null>(null);
  const [historicalBatches, setHistoricalBatches] = useState<WeightTableData['importBatches']>([]);
  const [historicalRows, setHistoricalRows] = useState<WeightTableData['rows']>([]);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'table' | 'review' | 'history'>('table');

  const unifiedResult: UnifiedResult | null = useMemo(() => {
    if (!tableData) return null;
    return buildUnifiedResult(tableData);
  }, [tableData]);

  useEffect(() => {
    if (tableData) {
      setGlobalDataVersion(tableData.dataVersion);
    }
  }, [tableData?.dataVersion, tableData]);

  const handleFileLoaded = useCallback((data: FileLoadResult) => {
    const newData = processImportedData({
      rawData: data.rows,
      importedBy: '吴老师',
      fileName: data.fileName,
      fileSize: data.fileSize,
      existingBatches: historicalBatches,
      existingRows: historicalRows
    });

    if (!newData.importBatches.some(b => b.id === newData.currentBatchId)) {
      setHistoricalBatches([...historicalBatches, ...newData.importBatches.filter(b => 
        !historicalBatches.some(hb => hb.id === b.id)
      )]);
    }
    
    const allRows = [...historicalRows];
    newData.rows.forEach(row => {
      const existingIdx = allRows.findIndex(r => r.id === row.id);
      if (existingIdx === -1) {
        allRows.push(row);
      } else {
        allRows[existingIdx] = row;
      }
    });
    setHistoricalRows(allRows);
    
    setTableData(newData);
    setActiveRightTab('table');
  }, [historicalBatches, historicalRows]);

  const handleRowUpdate = useCallback((id: string, newValue: string) => {
    if (!tableData) return;

    let newHistoryEntries: ChangeHistoryEntry[] = [];

    const updatedRows = tableData.rows.map(row => {
      if (row.id === id) {
        const { row: updatedRow, historyEntry } = updateWeightRowFn(row, newValue);
        newHistoryEntries.push(historyEntry);
        return updatedRow;
      }
      return row;
    });

    const newData: WeightTableData = { ...tableData, rows: updatedRows };
    const recalculatedData = recalculateAfterEdit(newData, newHistoryEntries);
    
    setHistoricalRows(prev => {
      const updated = [...prev];
      recalculatedData.rows.forEach(row => {
        const idx = updated.findIndex(r => r.id === row.id);
        if (idx > -1) {
          updated[idx] = row;
        } else {
          updated.push(row);
        }
      });
      return updated;
    });

    setTableData(recalculatedData);
  }, [tableData]);

  const handleNoteUpdate = useCallback((id: string, note: string) => {
    if (!tableData) return;

    let noteHistory: ChangeHistoryEntry | undefined;
    const updatedRows = tableData.rows.map(row => {
      if (row.id === id) {
        const res = updateRowNote(row, note);
        if (res.historyEntry) {
          noteHistory = res.historyEntry;
        }
        return res.row;
      }
      return row;
    });

    const extraHistory = noteHistory ? [noteHistory] : [];
    const newData = {
      ...tableData,
      rows: updatedRows,
      history: extraHistory.length > 0 ? [...tableData.history, ...extraHistory] : tableData.history,
      dataVersion: extraHistory.length > 0 ? tableData.dataVersion + 1 : tableData.dataVersion
    };

    if (noteHistory) {
      setHistoricalRows(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(r => r.id === id);
        if (idx > -1) {
          updated[idx] = updatedRows.find(r => r.id === id) || updated[idx];
        }
        return updated;
      });
    }

    setTableData(newData);
  }, [tableData]);

  const handleSubmitReview = useCallback((params: {
    rowId: string;
    reason: string;
    nextHandler: string;
    reviewedBy: string;
    finalizeStatus?: WeightRowStatus;
  }) => {
    if (!tableData) return;

    const allHistoryEntries: ChangeHistoryEntry[] = [];

    const updatedRows = tableData.rows.map(row => {
      if (row.id === params.rowId) {
        const { row: newRow, historyEntries } = markRowReviewed(row, {
          reason: params.reason,
          nextHandler: params.nextHandler,
          reviewedBy: params.reviewedBy,
          finalizeStatus: params.finalizeStatus
        });
        allHistoryEntries.push(...historyEntries);
        return newRow;
      }
      return row;
    });

    const newData: WeightTableData = {
      ...tableData,
      rows: updatedRows,
      history: [...tableData.history, ...allHistoryEntries],
      dataVersion: tableData.dataVersion + 1
    };

    const recalculatedData = recalculateAfterEdit(newData);

    setHistoricalRows(prev => {
      const updated = [...prev];
      recalculatedData.rows.forEach(row => {
        const idx = updated.findIndex(r => r.id === row.id);
        if (idx > -1) {
          updated[idx] = row;
        }
      });
      return updated;
    });

    setTableData(recalculatedData);
  }, [tableData]);

  const handleNextStep = useCallback(() => {
    if (!tableData) return;

    if (tableData.processStep === 'step1_imported') {
      setShowFormulaModal(true);
    } else if (tableData.processStep === 'step2_formula_review') {
      const newData = advanceProcessStep(tableData);
      const recalculatedData = recalculateAfterEdit(newData);
      setTableData(recalculatedData);
    }
  }, [tableData]);

  const handleFormulaConfirm = useCallback(() => {
    setShowFormulaModal(false);
    if (tableData) {
      const newData = advanceProcessStep(tableData);
      setTableData(newData);
    }
  }, [tableData]);

  const handleExport = useCallback(() => {
    if (unifiedResult) {
      exportToExcel(unifiedResult);
    }
  }, [unifiedResult]);

  const handlePrintAPIResult = useCallback(() => {
    if (unifiedResult) {
      const apiPayload = exportForAPI(unifiedResult);
      console.log('='.repeat(80));
      console.log('[接口返回 - 与页面展示、导出文件 100% 同源]');
      console.log('='.repeat(80));
      console.log('数据版本:', apiPayload.dataVersion);
      console.log('导入批次:', apiPayload.currentBatchId);
      console.log('总览:', JSON.stringify(apiPayload.summary, null, 2));
      console.log('\n■ 明细数据 - 以"教学内容"为例(30% → 0.30):');
      const sampleRow = apiPayload.rows.find(r => r.criterionName === '教学内容');
      if (sampleRow) {
        console.log('  原始说法(永不覆盖):', sampleRow.originalImportValue);
        console.log('  改后值(补录):', sampleRow.modifiedValue || '(未修改)');
        console.log('  当前状态:', sampleRow.status);
        console.log('  警告:', sampleRow.warnings.join(', '));
      }
      console.log('\n■ 复核信息(如果有):');
      if (sampleRow?.reviewInfo) {
        console.log('  原始说法(复核):', sampleRow.reviewInfo.previousValue);
        console.log('  改后值(复核):', sampleRow.reviewInfo.newValue);
        console.log('  处理原因:', sampleRow.reviewInfo.reason);
        console.log('  下一步找谁:', sampleRow.reviewInfo.nextHandler);
        console.log('  是否最终确认:', sampleRow.reviewInfo.finalized ? '是' : '否(不归入正常)');
      }
      console.log('\n■ 变更历史(最后3条):');
      apiPayload.history.slice(-3).forEach((h, i) => {
        console.log(`  ${i+1}. [${new Date(h.changedAt).toLocaleTimeString()}] ${h.criterionName} | ${h.field}: ${h.oldValue} → ${h.newValue}`);
        console.log(`     原因: ${h.reason}`);
      });
      console.log('='.repeat(80));
      alert('接口数据已打印到浏览器控制台。请查看！接口、页面、导出三者同源。');
    }
  }, [unifiedResult]);

  const handleRecalculate = useCallback(() => {
    if (tableData) {
      const recalculatedData = recalculateAfterEdit(tableData);
      setTableData(recalculatedData);
    }
  }, [tableData]);

  const handleReset = useCallback(() => {
    setTableData(null);
    setHistoricalBatches([]);
    setHistoricalRows([]);
    setActiveRightTab('table');
  }, []);

  const canProceed = tableData !== null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>矩阵条件数预警系统</h1>
          <p className="subtitle">
            评分权重表校验 · 30% 补录为 0.30 时保留原始说法 · 同文件再次上传识别为重复导入 · 展示/导出/接口同源
          </p>
        </div>
        {unifiedResult && (
          <div className="header-version">
            <div>数据版本 v{unifiedResult.dataVersion}</div>
            <div className="step-badge">{
              unifiedResult.processStep === 'step1_imported' ? '步骤1' :
              unifiedResult.processStep === 'step2_formula_review' ? '步骤2' : '步骤3'
            }</div>
            <div className="batch-id" title={unifiedResult.currentBatchId}>
              批次: {unifiedResult.currentBatchId.slice(-12)}
            </div>
          </div>
        )}
      </header>

      <main className="app-main">
        {!tableData || !unifiedResult ? (
          <div className="upload-section">
            <FileUpload onFileLoaded={handleFileLoaded} />
          </div>
        ) : (
          <>
            <ProcessSteps 
              currentStep={tableData.processStep}
              onNext={handleNextStep}
              canProceed={canProceed}
            />

            <div className="action-bar">
              <button className="btn-export" onClick={handleExport}>
                📥 导出Excel
              </button>
              <button className="btn-api" onClick={handlePrintAPIResult}>
                🔌 查看接口数据(同源)
              </button>
              <button className="btn-recalculate" onClick={handleRecalculate}>
                🔄 重新计算
              </button>
              <button 
                className="btn-reimport" 
                onClick={handleReset}
              >
                � 重置(清空所有批次)
              </button>
            </div>

            <div className="content-grid">
              <div className="left-panel">
                <SummaryPanel result={unifiedResult} />
                <MatrixWarning result={tableData.matrixResult} />
                <ReviewDetailPanel 
                  rows={tableData.rows}
                  onSubmitReview={handleSubmitReview}
                />
                <div className="import-info">
                  <h4>导入批次追踪</h4>
                  <p>当前批次ID：{tableData.currentBatchId}</p>
                  <p>历史批次数量：{unifiedResult.importBatches.length}</p>
                  <p>导入人：{tableData.importedBy}</p>
                  <p>导入时间：{new Date(tableData.importTime).toLocaleString()}</p>
                  <p>审核状态：{
                    tableData.hasReviewStatus === 'not_viewed' ? '未查看' :
                    tableData.hasReviewStatus === 'viewed' ? '已查看(吴老师)' : '已确认'
                  }</p>
                  <div className="batch-list">
                    <h5>批次列表：</h5>
                    {unifiedResult.importBatches.map(b => (
                      <div key={b.id} className={`batch-item ${b.isDuplicate ? 'duplicate' : ''}`}>
                        <span className="batch-name">{b.fileName}</span>
                        <span className={`batch-status ${b.isDuplicate ? 'dup' : 'new'}`}>
                          {b.isDuplicate ? '🔁 重复' : '✅ 新'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="data-consistency-note">
                    ✅ 左侧总览、中间表格、右侧历史、导出文件、接口返回 &mdash; <strong>同读一份 unifiedResult 数据</strong>
                  </p>
                </div>
              </div>
              
              <div className="right-panel">
                <div className="tabs">
                  <button 
                    className={`tab ${activeRightTab === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveRightTab('table')}
                  >
                    📊 明细表格
                  </button>
                  <button 
                    className={`tab ${activeRightTab === 'review' ? 'active' : ''}`}
                    onClick={() => setActiveRightTab('review')}
                  >
                    🧐 复核证据
                    {unifiedResult.summary.needsReviewCount > 0 && (
                      <span className="tab-badge">{unifiedResult.summary.needsReviewCount}</span>
                    )}
                  </button>
                  <button 
                    className={`tab ${activeRightTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveRightTab('history')}
                  >
                    📜 变更历史 ({unifiedResult.history.length})
                  </button>
                </div>

                {activeRightTab === 'table' && (
                  <>
                    <div className="table-header">
                      <h2>评分权重表明细（与导出/接口同源）</h2>
                      <div className="warning-notice">
                        {tableData.rows.some(r => r.warnings.includes('percent_decimal_mixed')) && (
                          <div className="notice-item review">
                            ⚠️ 检测到百分数和小数混合出现 → 状态<strong>保留"待复核"</strong>，不归入正常 → 需活动负责人最终确认
                          </div>
                        )}
                        {tableData.rows.some(r => r.warnings.includes('duplicate_import')) && (
                          <div className="notice-item warning">
                            🔁 检测到重复导入 → 已匹配历史批次数据，保留原始说法和改后值
                          </div>
                        )}
                      </div>
                    </div>
                    <WeightTable 
                      rows={unifiedResult.rows}
                      onRowUpdate={handleRowUpdate}
                      onNoteUpdate={handleNoteUpdate}
                    />
                  </>
                )}

                {activeRightTab === 'review' && (
                  <div className="review-tab-content">
                    <ReviewDetailPanel 
                      rows={unifiedResult.rows}
                      onSubmitReview={handleSubmitReview}
                    />
                  </div>
                )}

                {activeRightTab === 'history' && (
                  <ChangeHistoryPanel history={unifiedResult.history} />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <FormulaReviewModal 
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        onConfirm={handleFormulaConfirm}
      />
    </div>
  );
};

export default App;
