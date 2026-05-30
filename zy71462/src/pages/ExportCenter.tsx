import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBatchStore } from '@/store/batchStore';
import { exportToExcel, exportToCSV, exportEvidenceChain } from '@/utils/export/reportExport';
import { Download, FileSpreadsheet, FileText, FileJson, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

const ExportCenter: React.FC = () => {
  const { 
    currentBatch, 
    materials, 
    holdings, 
    targetWeights, 
    priceQuotes,
    currentTask,
    trades,
    evidenceRecords,
    validationErrors,
    config,
  } = useBatchStore();

  const [exporting, setExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const canExport = currentBatch && holdings.length > 0 && targetWeights.length > 0;
  const hasResults = currentTask && trades.length > 0;

  const handleExport = async (type: string, exporter: () => Promise<void> | void) => {
    setExporting(type);
    setExportSuccess(null);
    
    try {
      await exporter();
      setExportSuccess(type);
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(null);
    }
  };

  const exportItems = [
    {
      id: 'excel',
      title: 'Excel 完整报告',
      description: '包含所有数据、计算结果和证据链的多sheet报告',
      icon: FileSpreadsheet,
      disabled: !canExport,
      exporter: () => exportToExcel({
        batch: currentBatch!,
        materials,
        holdings,
        targetWeights,
        priceQuotes,
        task: currentTask!,
        trades,
        evidenceRecords,
        validationErrors,
      }, {
        includeRawData: true,
        includeCalculationDetails: true,
        includeEvidence: true,
        format: 'xlsx',
      }),
    },
    {
      id: 'trades_csv',
      title: '交易建议 CSV',
      description: '仅导出交易建议列表，可直接导入交易系统',
      icon: FileText,
      disabled: !hasResults,
      exporter: () => exportToCSV(trades, 'trade_suggestions'),
    },
    {
      id: 'holdings_csv',
      title: '持仓数据 CSV',
      description: '导出当前持仓数据和权重',
      icon: FileText,
      disabled: holdings.length === 0,
      exporter: () => exportToCSV(holdings, 'holdings'),
    },
    {
      id: 'evidence',
      title: '证据链 JSON',
      description: '导出完整计算证据链，用于审计和复查',
      icon: FileJson,
      disabled: evidenceRecords.length === 0,
      exporter: () => exportEvidenceChain(evidenceRecords, currentBatch),
    },
  ];

  const summaryItems = [
    { label: '持仓数量', value: holdings.length, enabled: holdings.length > 0 },
    { label: '目标权重', value: targetWeights.length, enabled: targetWeights.length > 0 },
    { label: '报价记录', value: priceQuotes.length, enabled: priceQuotes.length > 0 },
    { label: '交易建议', value: trades.length, enabled: trades.length > 0 },
    { label: '证据记录', value: evidenceRecords.length, enabled: evidenceRecords.length > 0 },
    { label: '校验问题', value: validationErrors.length, enabled: validationErrors.length === 0, variant: validationErrors.length > 0 ? 'warning' : 'success' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">报告导出中心</h1>
            <p className="mt-1 text-sm text-slate-400">
              导出再平衡分析报告、交易建议和完整证据链
            </p>
          </div>
          <Link to="/result">
            <Button variant="secondary">
              返回结果 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {!canExport && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-amber-400 mb-1">数据不完整</h3>
                <p className="text-sm text-slate-400">
                  请先导入持仓表和目标权重后再导出报告。
                </p>
                <Link to="/import" className="inline-block mt-2">
                  <Button variant="secondary" size="sm">去导入</Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <h3 className="font-medium text-white mb-4">数据概览</h3>
          <div className="grid grid-cols-6 gap-4">
            {summaryItems.map((item, idx) => (
              <div key={idx} className="text-center">
                <div className={`text-2xl font-bold font-mono ${
                  item.variant === 'warning' ? 'text-amber-500' :
                  item.enabled ? 'text-emerald-400' : 'text-slate-600'
                }`}>
                  {item.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {currentTask && (
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-xs text-slate-500 mb-1">总税费</div>
              <div className="text-xl font-bold text-red-400 font-mono">
                ¥{currentTask.totalTax.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-500 mb-1">亏损抵扣</div>
              <div className="text-xl font-bold text-emerald-400 font-mono">
                -¥{currentTask.totalLossOffset.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-500 mb-1">税后收益</div>
              <div className={`text-xl font-bold font-mono ${currentTask.afterTaxReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {currentTask.afterTaxReturn >= 0 ? '+' : ''}¥{currentTask.afterTaxReturn.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-500 mb-1">跟踪误差</div>
              <div className="text-xl font-bold text-blue-400 font-mono">
                {(currentTask.trackingError * 100).toFixed(2)}%
              </div>
            </Card>
          </div>
        )}

        <Card className="p-4">
          <h3 className="font-medium text-white mb-4">导出选项</h3>
          <div className="grid grid-cols-2 gap-4">
            {exportItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-md border transition-colors ${
                  item.disabled
                    ? 'border-slate-800 bg-slate-900/50 opacity-50'
                    : 'border-slate-700 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{item.title}</h4>
                      <p className="text-sm text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exportSuccess === item.id && (
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        导出成功
                      </Badge>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={item.disabled || exporting === item.id}
                      onClick={() => handleExport(item.id, item.exporter)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      {exporting === item.id ? '导出中...' : '导出'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 bg-slate-800/30">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="text-sm text-slate-400">
              <div className="font-medium text-slate-300 mb-1">导出说明</div>
              <ul className="space-y-1 list-disc list-inside">
                <li>Excel 报告包含：摘要、持仓、交易建议、税费明细、证据链、校验结果、原始材料等完整内容</li>
                <li>所有导出文件均在本地生成，不会上传到任何服务器，确保数据安全</li>
                <li>证据链 JSON 包含每笔计算的完整步骤，可用于审计和复查</li>
                <li>建议在导出前完成所有数据校验，确保结果准确</li>
              </ul>
            </div>
          </div>
        </Card>

        {currentBatch && (
          <Card className="p-4">
            <h3 className="font-medium text-white mb-4">批次信息</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-500">批次名称</div>
                <div className="text-white">{currentBatch.name}</div>
              </div>
              <div>
                <div className="text-slate-500">批次号</div>
                <div className="text-white font-mono">{currentBatch.id}</div>
              </div>
              <div>
                <div className="text-slate-500">客户编号</div>
                <div className="text-white font-mono">{currentBatch.clientId}</div>
              </div>
              <div>
                <div className="text-slate-500">创建人</div>
                <div className="text-white">{currentBatch.createdBy}</div>
              </div>
              <div>
                <div className="text-slate-500">创建时间</div>
                <div className="text-white">{new Date(currentBatch.createdAt).toLocaleString('zh-CN')}</div>
              </div>
              <div>
                <div className="text-slate-500">当前版本</div>
                <div className="text-white">v{currentBatch.currentVersion}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="text-slate-500 text-sm mb-2">包含材料</div>
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <Badge key={m.id} variant="secondary" className="flex items-center gap-1">
                    {m.type === 'holding' ? '持仓' : m.type === 'target' ? '权重' : '报价'} · v{m.version} · {m.fileName}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default ExportCenter;
