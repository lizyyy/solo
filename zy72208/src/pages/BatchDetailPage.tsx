import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, FileSpreadsheet, Terminal, Eye } from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore.js';
import { StepWizard } from '../components/StepWizard.js';
import { SelfCheckPanel } from '../components/SelfCheckPanel.js';
import { SettlementTable } from '../components/SettlementTable.js';
import { DetailPanel } from '../components/DetailPanel.js';
import { ReplayTerminal } from '../components/ReplayTerminal.js';
import type { SettlementDetail, OriginalSnapshot, AuditLog } from '../../shared/types.js';

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    currentBatch, 
    currentDetails, 
    currentSelfCheck, 
    selectedDetail, 
    currentUser,
    loadBatch, 
    runSelfCheck, 
    markRiskReviewed, 
    markAudited,
    loadDetailAuditTrail,
    loadDetailSnapshot,
    loading 
  } = useSettlementStore();
  
  const [activeTab, setActiveTab] = useState<'details' | 'replay'>('details');
  const [detailWithData, setDetailWithData] = useState<(SettlementDetail & { snapshot?: OriginalSnapshot; auditLogs?: AuditLog[] }) | null>(null);

  useEffect(() => {
    if (id) {
      loadBatch(id);
    }
  }, [id, loadBatch]);

  useEffect(() => {
    const loadDetailData = async () => {
      if (selectedDetail) {
        const [snapshot, auditLogs] = await Promise.all([
          loadDetailSnapshot(selectedDetail.originalSnapshotId),
          loadDetailAuditTrail(selectedDetail.id)
        ]);
        setDetailWithData({ ...selectedDetail, snapshot, auditLogs });
      } else {
        setDetailWithData(null);
      }
    };
    loadDetailData();
  }, [selectedDetail, loadDetailSnapshot, loadDetailAuditTrail]);

  const currentStep = currentBatch ? {
    'DRAFT': 0,
    'IMPORTED': 1,
    'RISK_REVIEWED': 2,
    'AUDITED': 3,
    'COMPLETED': 3
  }[currentBatch.status] : 0;

  const steps = [
    { title: '导入除权日截图', description: 'OCR识别后粘贴数据', operator: currentBatch?.importedBy, timestamp: currentBatch?.importedAt },
    { title: '风控补看税费率', description: '老秦补录税率备注', operator: currentBatch?.riskReviewedBy, timestamp: currentBatch?.riskReviewedAt },
    { title: '审计明细更新', description: '审计确认最终结果', operator: currentBatch?.auditedBy, timestamp: currentBatch?.auditedAt }
  ];

  const handleRiskReview = () => {
    if (id && currentUser.role === 'risk_control') {
      const updates = currentDetails
        .filter(d => d.hasMixedCurrency)
        .map(d => ({
          detailId: d.id,
          taxRate: d.taxRate || 0.06,
          taxRateRemark: '风控老秦补录税率',
          currencyDecision: 'SUBMIT_REVIEW' as const,
          currencyRemark: '港币人民币同列，提交托管对接人复核'
        }));
      markRiskReviewed(id, updates);
    }
  };

  const handleAuditUpdate = () => {
    if (id && currentUser.role === 'auditor') {
      const updates = currentDetails
        .filter(d => d.status === 'PENDING_REVIEW')
        .map(d => ({
          detailId: d.id,
          status: 'APPROVED' as const,
          remark: '审计确认通过'
        }));
      markAudited(id, updates);
    }
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    window.open(`/api/export/${id}?format=${format}`, '_blank');
  };

  if (!currentBatch) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={32} className="mx-auto text-navy-400 animate-spin mb-4" />
          <p className="text-navy-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="bg-white border-b border-navy-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-navy-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-navy-600" />
              </button>
              <div>
                <h1 className="font-display text-xl text-navy-800">{currentBatch.batchNo}</h1>
                <p className="text-sm text-navy-500 font-mono">
                  {currentBatch.sourceFile} · {currentBatch.totalCount} 条明细
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-300 text-navy-700 rounded-lg hover:bg-navy-50 transition-colors text-sm font-medium"
              >
                <FileSpreadsheet size={16} />
                导出 Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-300 text-navy-700 rounded-lg hover:bg-navy-50 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                导出 CSV
              </button>
              {currentUser.role === 'risk_control' && currentBatch.status === 'IMPORTED' && (
                <button
                  onClick={handleRiskReview}
                  disabled={loading}
                  className="px-6 py-2 bg-audit-orange text-white rounded-lg hover:bg-audit-orange/90 transition-colors font-medium disabled:opacity-50"
                >
                  步骤2：完成风控复核
                </button>
              )}
              {currentUser.role === 'auditor' && currentBatch.status === 'RISK_REVIEWED' && (
                <button
                  onClick={handleAuditUpdate}
                  disabled={loading}
                  className="px-6 py-2 bg-audit-green text-white rounded-lg hover:bg-audit-green/90 transition-colors font-medium disabled:opacity-50"
                >
                  步骤3：完成审计确认
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <StepWizard currentStep={currentStep} steps={steps} />

        <SelfCheckPanel
          results={currentSelfCheck}
          onRunCheck={(types) => id && runSelfCheck(id, types)}
          loading={loading}
        />

        <div className="border-b border-navy-200 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-navy-800 text-navy-800'
                  : 'border-transparent text-navy-500 hover:text-navy-700'
              }`}
            >
              <Eye size={14} className="inline mr-1" />
              明细列表 ({currentDetails.length})
            </button>
            <button
              onClick={() => setActiveTab('replay')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'replay'
                  ? 'border-navy-800 text-navy-800'
                  : 'border-transparent text-navy-500 hover:text-navy-700'
              }`}
            >
              <Terminal size={14} className="inline mr-1" />
              复盘命令
            </button>
          </div>
        </div>

        {activeTab === 'details' ? (
          <SettlementTable
            details={currentDetails}
            onSelectDetail={(detailId) => {
              const detail = currentDetails.find(d => d.id === detailId);
              useSettlementStore.getState().setSelectedDetail(detail || null);
            }}
            selectedDetailId={selectedDetail?.id}
          />
        ) : (
          <ReplayTerminal batchId={currentBatch.id} batchNo={currentBatch.batchNo} />
        )}

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <p className="text-sm text-navy-500 mb-1">总佣金金额</p>
            <p className="text-2xl font-bold font-mono text-navy-800">
              ¥ {currentBatch.totalCommissionAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <p className="text-sm text-navy-500 mb-1">总税费</p>
            <p className="text-2xl font-bold font-mono text-navy-700">
              ¥ {currentBatch.totalTaxAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-navy-200 p-5">
            <p className="text-sm text-navy-500 mb-1">净佣金合计</p>
            <p className="text-2xl font-bold font-mono text-audit-green">
              ¥ {currentBatch.totalNetAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </main>

      {detailWithData && (
        <DetailPanel
          detail={detailWithData}
          onClose={() => {
            useSettlementStore.getState().setSelectedDetail(null);
            setDetailWithData(null);
          }}
        />
      )}
    </div>
  );
};
