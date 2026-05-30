import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, FileText, Play, RefreshCw, AlertTriangle, CheckCircle, TrendingUp, Settings, GitCompare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabContent, TabItem } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import {
  MaterialUpload,
  MaterialList,
  TermsDisplay,
  CalculationTable,
  IssueList,
  PayoutPlanComparison,
  OperationLogList,
  VersionCompare,
} from '@/components/business';
import { useBatchStore } from '@/store/batchStore';
import { exportToExcel, exportIssuesToCsv, exportCalculationsToCsv } from '@/utils/export';
import { loadDemoData } from '@/mock/demoData';
import type { BatchStatus } from '@/types';

const statusLabels: Record<BatchStatus, { label: string; status: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'processing' }> = {
  draft: { label: '草稿', status: 'pending' },
  importing: { label: '导入中', status: 'processing' },
  parsing: { label: '解析中', status: 'processing' },
  calculating: { label: '试算中', status: 'processing' },
  validating: { label: '校验中', status: 'processing' },
  has_issues: { label: '有问题', status: 'error' },
  ready: { label: '待确认', status: 'warning' },
  completed: { label: '已完成', status: 'success' },
  archived: { label: '已归档', status: 'info' },
};

export default function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const {
    batches,
    currentBatch,
    materials,
    parsedTerms,
    positions,
    prices,
    calculations,
    validationIssues,
    payoutPlans,
    operationLogs,
    batchVersions,
    isLoading,
    error,
    setCurrentBatch,
    loadBatch,
    importMaterial,
    parseAllMaterials,
    calculateAll,
    validateAll,
    generatePlans,
    resolveIssue,
    updateParsedTerms,
    deleteMaterial,
    addOperationLog,
  } = useBatchStore();

  const [activeTab, setActiveTab] = useState('materials');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [triedDemoData, setTriedDemoData] = useState(false);

  useEffect(() => {
    if (batchId) {
      loadBatch(batchId);
    }
  }, [batchId, loadBatch, triedDemoData]);

  useEffect(() => {
    const hasNoBatches = batches.length === 0;
    const batchNotFound = batchId && !currentBatch && !batches.find(b => b.id === batchId);
    
    if (hasNoBatches && !triedDemoData) {
      loadDemoData();
      setTriedDemoData(true);
    }
  }, [batches, batchId, currentBatch, triedDemoData]);

  const handleParseAll = async () => {
    if (!batchId) return;
    setIsProcessing(true);
    try {
      await parseAllMaterials(batchId);
    } catch (error) {
      console.error('解析失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCalculateAll = async () => {
    if (!batchId) return;
    setIsProcessing(true);
    try {
      await calculateAll(batchId);
    } catch (error) {
      console.error('试算失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateAll = () => {
    if (!batchId) return;
    validateAll(batchId);
  };

  const handleGeneratePlans = () => {
    if (!batchId) return;
    generatePlans(batchId);
  };

  const handleRunAll = async () => {
    if (!batchId) return;
    setIsProcessing(true);
    try {
      await parseAllMaterials(batchId);
      await calculateAll(batchId);
      validateAll(batchId);
      generatePlans(batchId);
    } catch (error) {
      console.error('执行失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportExcel = async () => {
    if (!batch) return;
    try {
      await exportToExcel(
        batch,
        materials,
        parsedTerms,
        calculations,
        validationIssues,
        payoutPlans,
        operationLogs
      );
      setShowExportModal(false);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const handleExportIssues = () => {
    exportIssuesToCsv(validationIssues, batch?.name || '未知批次');
    setShowExportModal(false);
  };

  const handleExportCalculations = () => {
    exportCalculationsToCsv(calculations, batch?.name || '未知批次');
    setShowExportModal(false);
  };

  const canParse = materials.some(m => m.type === 'product_terms' || m.type === 'customer_position' || m.type === 'underlying_price');
  const canCalculate = parsedTerms && positions.length > 0 && prices.length > 0;
  const canValidate = calculations.length > 0;
  const canGeneratePlans = calculations.length > 0 && parsedTerms;

  const tabs: TabItem[] = [
    {
      key: 'materials',
      label: '材料管理',
      count: materials.length,
    },
    {
      key: 'terms',
      label: '条款解析',
      disabled: !parsedTerms,
    },
    {
      key: 'calculation',
      label: '档位试算',
      count: calculations.length,
      disabled: calculations.length === 0,
    },
    {
      key: 'validation',
      label: '复核校验',
      count: validationIssues.filter(i => !i.resolved).length,
      disabled: validationIssues.length === 0,
    },
    {
      key: 'payout',
      label: '兑付方案',
      count: payoutPlans.length,
      disabled: payoutPlans.length === 0,
    },
    {
      key: 'versions',
      label: '版本对比',
      count: batchVersions.length,
      disabled: batchVersions.length === 0,
    },
    {
      key: 'logs',
      label: '操作日志',
      count: operationLogs.length,
    },
  ];

  const batch = currentBatch || batches.find(b => b.id === batchId);

  if (!batch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">批次未找到</h3>
          <p className="text-sm text-gray-500 mb-4">请先加载演示数据或创建新批次</p>
          <Button onClick={() => navigate('/')}>返回首页</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回工作台
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900">{batch.name}</h1>
                  <StatusIndicator
                    status={statusLabels[batch.status].status}
                    label={statusLabels[batch.status].label}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono">{batch.id}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-xs text-gray-500">
                    版本 v{batch.currentVersion}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-xs text-gray-500">
                    创建于 {new Date(batch.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {error && (
                <Badge variant="error" size="sm">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {error}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAll}
                disabled={isProcessing || !canParse}
                loading={isProcessing}
              >
                <Play className="w-4 h-4 mr-1" />
                一键执行
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
              >
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleParseAll}
              disabled={!canParse || isProcessing}
            >
              <FileText className="w-4 h-4 mr-1" />
              1. 条款解析
            </Button>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCalculateAll}
              disabled={!canCalculate || isProcessing}
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              2. 档位试算
            </Button>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleValidateAll}
              disabled={!canValidate || isProcessing}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              3. 复核校验
            </Button>
            <ArrowRight className="w-4 h-4 text-gray-300" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGeneratePlans}
              disabled={!canGeneratePlans || isProcessing}
            >
              <Settings className="w-4 h-4 mr-1" />
              4. 生成方案
            </Button>

            <div className="flex-1" />

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Badge variant="neutral" size="sm">
                  {materials.length} 份材料
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {validationIssues.length > 0 ? (
                  <Badge
                    variant={validationIssues.some(i => i.severity === 'error' && !i.resolved) ? 'error' : 'warning'}
                    size="sm"
                  >
                    {validationIssues.filter(i => !i.resolved).length} 个待处理问题
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    无问题
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === 'materials' && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">导入材料</h3>
                  <MaterialUpload
                    batchId={batch.id}
                    onUpload={importMaterial}
                  />
                </CardContent>
              </Card>
              <MaterialList
                materials={materials}
                onDelete={deleteMaterial}
              />
            </div>
          )}

          {activeTab === 'terms' && parsedTerms && (
            <TermsDisplay
              terms={parsedTerms}
              onUpdate={updateParsedTerms}
            />
          )}

          {activeTab === 'calculation' && (
            <CalculationTable calculations={calculations} />
          )}

          {activeTab === 'validation' && (
            <IssueList
              issues={validationIssues}
              onResolve={resolveIssue}
            />
          )}

          {activeTab === 'payout' && (
            <PayoutPlanComparison plans={payoutPlans} />
          )}

          {activeTab === 'versions' && (
            <VersionCompare versions={batchVersions} materials={materials} />
          )}

          {activeTab === 'logs' && (
            <OperationLogList logs={operationLogs} />
          )}
        </div>
      </main>

      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="导出数据"
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setShowExportModal(false)}>
            取消
          </Button>
        }
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportExcel}
          >
            <FileText className="w-4 h-4 mr-2" />
            <div className="text-left">
              <p className="font-medium">导出完整复核报告 (Excel)</p>
              <p className="text-xs text-gray-500">包含所有Sheet：材料清单、条款解析、试算结果、问题清单、兑付方案、操作日志等</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportCalculations}
            disabled={calculations.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            <div className="text-left">
              <p className="font-medium">导出计算明细 (CSV)</p>
              <p className="text-xs text-gray-500">
                {calculations.length} 条计算记录，包含每位客户的本金、收益率、兑付金额
              </p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportIssues}
            disabled={validationIssues.length === 0}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            <div className="text-left">
              <p className="font-medium">导出问题清单 (CSV)</p>
              <p className="text-xs text-gray-500">
                {validationIssues.length} 条问题记录，包含问题类型、级别、触发材料、修复建议
              </p>
            </div>
          </Button>
        </div>
      </Modal>
    </div>
  );
}
