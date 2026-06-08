import React, { useState, useMemo, useCallback } from 'react';
import { WeightTableData, UnifiedResult, WeightRowStatus, ChangeHistoryEntry } from './types';
import {
  processImportedData,
  updateWeightRow as updateWeightRowFn,
  recalculateAfterEdit,
  advanceProcessStep,
  markRowReviewed,
  updateRowNote
} from './utils/dataProcessor';
import { buildUnifiedResult } from './utils/resultSource';
import { exportToExcel, exportForAPI } from './utils/excelHandler';
import { FileUpload } from './components/FileUpload';
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
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'table' | 'review' | 'history'>('table');

  const unifiedResult: UnifiedResult | null = useMemo(() => {
    if (!tableData) return null;
    return buildUnifiedResult(tableData);
  }, [tableData]);

  const handleFileLoaded = useCallback((rawData: Array<{ criterion: string; weight: string }>) => {
    const data = processImportedData(rawData);
    setTableData(data);
    setActiveRightTab('table');
  }, []);

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
    setTableData({
      ...tableData,
      rows: updatedRows,
      history: extraHistory.length > 0 ? [...tableData.history, ...extraHistory] : tableData.history,
      dataVersion: extraHistory.length > 0 ? tableData.dataVersion + 1 : tableData.dataVersion
    });
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
      console.log('[接口返回(与展示/导出一致)]:', JSON.stringify(apiPayload, null, 2));
      alert('接口数据已打印到控制台，请查看。接口、展示、导出使用的是同一份统一结果。');
    }
  }, [unifiedResult]);

  const handleRecalculate = useCallback(() => {
    if (tableData) {
      const recalculatedData = recalculateAfterEdit(tableData);
      setTableData(recalculatedData);
    }
  }, [tableData]);

  const canProceed = tableData !== null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>矩阵条件数预警系统</h1>
          <p className="subtitle">评分权重表校验 · 统一数据源(展示/导出/接口一致)</p>
        </div>
        {unifiedResult && (
          <div className="header-version">
            <div>数据版本 v{unifiedResult.dataVersion}</div>
            <div className="step-badge">{
              unifiedResult.processStep === 'step1_imported' ? '步骤1' :
              unifiedResult.processStep === 'step2_formula_review' ? '步骤2' : '步骤3'
            }</div>
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
                onClick={() => setTableData(null)}
              >
                📁 重新导入
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
                  <h4>导入信息</h4>
                  <p>导入人：{tableData.importedBy}</p>
                  <p>导入时间：{new Date(tableData.importTime).toLocaleString()}</p>
                  <p>审核状态：{
                    tableData.hasReviewStatus === 'not_viewed' ? '未查看' :
                    tableData.hasReviewStatus === 'viewed' ? '已查看(吴老师)' : '已确认'
                  }</p>
                  <p className="data-consistency-note">
                    ✅ 左侧总览、中间表格、右侧历史、导出文件、接口返回 —— <strong>同读一份 unifiedResult 数据</strong>
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
