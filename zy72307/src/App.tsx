import React, { useState, useEffect } from 'react';
import { WeightTableData } from './types';
import { processImportedData, updateWeightRow, recalculateAfterEdit, advanceProcessStep } from './utils/dataProcessor';
import { unifiedResultSource } from './utils/resultSource';
import { exportToExcel } from './utils/excelHandler';
import { FileUpload } from './components/FileUpload';
import { ProcessSteps } from './components/ProcessSteps';
import { WeightTable } from './components/WeightTable';
import { MatrixWarning } from './components/MatrixWarning';
import { SummaryPanel } from './components/SummaryPanel';
import { FormulaReviewModal } from './components/FormulaReviewModal';
import './styles.css';

const App: React.FC = () => {
  const [tableData, setTableData] = useState<WeightTableData | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  useEffect(() => {
    if (tableData) {
      unifiedResultSource.setData(tableData.rows, tableData.matrixResult);
    }
  }, [tableData]);

  const handleFileLoaded = (rawData: Array<{ criterion: string; weight: string }>) => {
    const data = processImportedData(rawData);
    setTableData(data);
  };

  const handleRowUpdate = (id: string, newValue: string) => {
    if (!tableData) return;

    const updatedRows = tableData.rows.map(row => {
      if (row.id === id) {
        return updateWeightRow(row, newValue);
      }
      return row;
    });

    const newData = { ...tableData, rows: updatedRows };
    const recalculatedData = recalculateAfterEdit(newData);
    setTableData(recalculatedData);
  };

  const handleNoteUpdate = (id: string, note: string) => {
    if (!tableData) return;

    const updatedRows = tableData.rows.map(row => {
      if (row.id === id) {
        return { ...row, notes: note };
      }
      return row;
    });

    setTableData({ ...tableData, rows: updatedRows });
  };

  const handleNextStep = () => {
    if (!tableData) return;

    if (tableData.processStep === 'step1_imported') {
      setShowFormulaModal(true);
    } else if (tableData.processStep === 'step2_formula_review') {
      const newData = advanceProcessStep(tableData);
      const recalculatedData = recalculateAfterEdit(newData);
      setTableData(recalculatedData);
    }
  };

  const handleFormulaConfirm = () => {
    setShowFormulaModal(false);
    if (tableData) {
      const newData = advanceProcessStep(tableData);
      setTableData(newData);
    }
  };

  const handleExport = () => {
    if (tableData) {
      exportToExcel(tableData);
    }
  };

  const handleRecalculate = () => {
    if (tableData) {
      const recalculatedData = recalculateAfterEdit(tableData);
      setTableData(recalculatedData);
    }
  };

  const canProceed = tableData !== null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>矩阵条件数预警系统</h1>
        <p className="subtitle">评分权重表校验与分析工具</p>
      </header>

      <main className="app-main">
        {!tableData ? (
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
                <SummaryPanel result={unifiedResultSource.getUnifiedResult()} />
                <MatrixWarning result={tableData.matrixResult} />
                <div className="import-info">
                  <h4>导入信息</h4>
                  <p>导入人：{tableData.importedBy}</p>
                  <p>导入时间：{new Date(tableData.importTime).toLocaleString()}</p>
                  <p>审核状态：{
                    tableData.hasReviewStatus === 'not_viewed' ? '未查看' :
                    tableData.hasReviewStatus === 'viewed' ? '已查看' : '已确认'
                  }</p>
                </div>
              </div>
              
              <div className="right-panel">
                <div className="table-header">
                  <h2>评分权重表明细</h2>
                  <div className="warning-notice">
                    {tableData.rows.some(r => r.warnings.includes('percent_decimal_mixed')) && (
                      <div className="notice-item review">
                        ⚠️ 检测到百分数和小数混合出现，需活动负责人复核
                      </div>
                    )}
                  </div>
                </div>
                <WeightTable 
                  rows={tableData.rows}
                  onRowUpdate={handleRowUpdate}
                  onNoteUpdate={handleNoteUpdate}
                />
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
