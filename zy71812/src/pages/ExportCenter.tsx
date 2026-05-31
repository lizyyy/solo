import { useEffect, useState } from 'react';
import { useReviewStore } from '../store/useReviewStore';
import { exportToExcel, downloadBlob, prepareExportData, verifyExport } from '../utils/export';
import type { ExportVerification } from '../types';
import { formatDateTime } from '../utils/date';
import { shortHash } from '../utils/hash';
import { Download, FileSpreadsheet, CheckCircle, AlertTriangle, Hash, Clock, User, FileText, Upload, ShieldCheck } from 'lucide-react';

export function ExportCenter() {
  const { initializeData, refunds, rates, currentOperator, addOperationLog } =
    useReviewStore();
  const [isExporting, setIsExporting] = useState(false);
  const [lastVerification, setLastVerification] = useState<ExportVerification | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    isValid: boolean;
    currentHash: string;
    storedHash: string;
    discrepancies: string[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  useEffect(() => {
    initializeData();
  }, [initializeData]);

  useEffect(() => {
    const { mainData } = prepareExportData(refunds, rates);
    setPreviewData(mainData);
  }, [refunds, rates]);

  const stats = {
    total: refunds.length,
    normal: refunds.filter((r) => r.status === 'normal').length,
    pending: refunds.filter((r) => r.status === 'pending').length,
    anomaly: refunds.filter((r) => r.status === 'anomaly').length,
    totalAmount: refunds.reduce((sum, r) => sum + r.amount, 0),
    totalFeeAmount: refunds.reduce((sum, r) => sum + r.feeAmount, 0),
  };

  const handleExport = async () => {
    if (stats.pending > 0) {
      const confirmed = confirm(
        `当前有 ${stats.pending} 条待确认记录，是否继续导出？\n建议先处理完所有异常后再导出。`
      );
      if (!confirmed) return;
    }

    setIsExporting(true);
    try {
      const { excelBlob, verificationBlob, verification } = await exportToExcel(
        refunds,
        rates,
        currentOperator
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(excelBlob, `供应商扣款复核_${timestamp}.xlsx`);
      downloadBlob(verificationBlob, `校验文件_${timestamp}.json`);

      setLastVerification(verification);

      await addOperationLog(
        'system',
        'export',
        null,
        { exportId: verification.exportId, recordCount: verification.recordCount },
        `导出数据：${verification.recordCount}条记录，校验码：${shortHash(verification.dataHash)}`
      );

      setVerifyResult(null);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleVerify = async () => {
    if (!lastVerification) return;

    const result = await verifyExport(refunds, lastVerification);
    setVerifyResult(result);
  };

  const handleImportVerification = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const verification = JSON.parse(event.target?.result as string) as ExportVerification;
        setLastVerification(verification);
        const result = await verifyExport(refunds, verification);
        setVerifyResult(result);
      } catch (error) {
        alert('校验文件格式错误');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-bg-border bg-bg-secondary">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-text-secondary" />
            <h2 className="text-data-base font-semibold text-text-primary">导出中心</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="btn-secondary flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              导入校验文件
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportVerification}
              />
            </label>
            {lastVerification && (
              <button
                onClick={handleVerify}
                className="btn-secondary flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                校验数据
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting || refunds.length === 0}
              className="btn-primary flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? '导出中...' : '导出Excel'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Stat label="总记录数" value={stats.total.toString()} />
          <Stat label="正常" value={stats.normal.toString()} color="text-status-normal" />
          <Stat label="待确认" value={stats.pending.toString()} color="text-status-pending" />
          <Stat label="异常" value={stats.anomaly.toString()} color="text-status-anomaly" />
          <Stat
            label="退款合计"
            value={`¥${stats.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          />
          <Stat
            label="手续费合计"
            value={`¥${stats.totalFeeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-bg-border bg-bg-secondary/50">
            <p className="text-data-xs text-text-muted">数据预览（前10条）</p>
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin p-4">
            {previewData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-data-sm">暂无数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-data-sm">
                  <thead className="sticky top-0 bg-bg-secondary">
                    <tr className="border-b border-bg-border">
                      <th className="py-2 px-3 font-medium text-text-secondary">流水号</th>
                      <th className="py-2 px-3 font-medium text-text-secondary">供应商</th>
                      <th className="py-2 px-3 font-medium text-text-secondary text-right">退款金额</th>
                      <th className="py-2 px-3 font-medium text-text-secondary text-right">手续费</th>
                      <th className="py-2 px-3 font-medium text-text-secondary">日期</th>
                      <th className="py-2 px-3 font-medium text-text-secondary">归属期</th>
                      <th className="py-2 px-3 font-medium text-text-secondary">状态</th>
                      <th className="py-2 px-3 font-medium text-text-secondary">异常</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b border-bg-border/50 hover:bg-bg-tertiary/30">
                        <td className="py-2.5 px-3 font-mono text-text-primary">{row['流水号']}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{row['供应商名称']}</td>
                        <td className="py-2.5 px-3 font-mono text-text-primary text-right">
                          {row['退款金额(元)']}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-text-secondary text-right">
                          {row['手续费金额(元)']}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">{row['退款日期']}</td>
                        <td className="py-2.5 px-3 text-text-secondary">{row['归属期']}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-data-xs ${
                              row['状态'] === '正常'
                                ? 'text-status-normal'
                                : row['状态'] === '待确认'
                                ? 'text-status-pending'
                                : 'text-status-anomaly'
                            }`}
                          >
                            {row['状态']}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary text-data-xs">
                          {row['异常类型'] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="w-96 border-l border-bg-border bg-bg-secondary p-4 overflow-y-auto scrollbar-thin">
          <h3 className="text-data-sm font-medium text-text-primary mb-4 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-status-normal" />
            一致性校验
          </h3>

          {lastVerification ? (
            <div className="space-y-4">
              <div className="p-3 bg-bg-primary rounded border border-bg-border">
                <p className="text-data-xs text-text-muted mb-2">上次导出信息</p>
                <div className="space-y-2">
                  <DetailRow icon={Hash} label="导出ID" value={lastVerification.exportId} mono />
                  <DetailRow
                    icon={Clock}
                    label="导出时间"
                    value={formatDateTime(lastVerification.exportTime)}
                  />
                  <DetailRow icon={User} label="操作人" value={lastVerification.operator} />
                  <DetailRow
                    icon={FileText}
                    label="记录数量"
                    value={`${lastVerification.recordCount} 条`}
                  />
                  <DetailRow
                    icon={FileText}
                    label="退款合计"
                    value={`¥${lastVerification.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
                  />
                </div>
              </div>

              <div className="p-3 bg-bg-primary rounded border border-bg-border">
                <p className="text-data-xs text-text-muted mb-2">状态分布</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-mono font-semibold text-status-normal">
                      {lastVerification.statusBreakdown.normal}
                    </p>
                    <p className="text-data-xs text-text-muted">正常</p>
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-status-pending">
                      {lastVerification.statusBreakdown.pending}
                    </p>
                    <p className="text-data-xs text-text-muted">待确认</p>
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-status-anomaly">
                      {lastVerification.statusBreakdown.anomaly}
                    </p>
                    <p className="text-data-xs text-text-muted">异常</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-bg-primary rounded border border-bg-border">
                <p className="text-data-xs text-text-muted mb-2">数据哈希</p>
                <p className="font-mono text-data-xs text-text-primary break-all">
                  {lastVerification.dataHash}
                </p>
              </div>

              <div className="p-3 bg-bg-primary rounded border border-bg-border">
                <p className="text-data-xs text-text-muted mb-2">数字签名</p>
                <p className="font-mono text-data-xs text-text-primary break-all">
                  {lastVerification.signature}
                </p>
              </div>

              {verifyResult && (
                <div
                  className={`p-3 rounded border ${
                    verifyResult.isValid
                      ? 'bg-status-normal/10 border-status-normal/30'
                      : 'bg-status-anomaly/10 border-status-anomaly/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {verifyResult.isValid ? (
                      <CheckCircle className="w-4 h-4 text-status-normal" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-status-anomaly" />
                    )}
                    <span
                      className={`text-data-sm font-medium ${
                        verifyResult.isValid ? 'text-status-normal' : 'text-status-anomaly'
                      }`}
                    >
                      {verifyResult.isValid ? '数据一致性校验通过' : '数据一致性校验失败'}
                    </span>
                  </div>
                  <div className="space-y-1 text-data-xs">
                    <p className="text-text-muted">
                      当前哈希: <span className="font-mono">{shortHash(verifyResult.currentHash)}</span>
                    </p>
                    <p className="text-text-muted">
                      存储哈希: <span className="font-mono">{shortHash(verifyResult.storedHash)}</span>
                    </p>
                  </div>
                  {verifyResult.discrepancies.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-bg-border">
                      <p className="text-data-xs text-text-muted mb-1">差异项：</p>
                      <ul className="space-y-1">
                        {verifyResult.discrepancies.map((d, idx) => (
                          <li key={idx} className="text-data-xs text-status-anomaly">
                            • {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50" />
              <p className="text-data-sm text-text-muted mb-2">暂无导出记录</p>
              <p className="text-data-xs text-text-muted">
                导出Excel后将自动生成校验信息
              </p>
            </div>
          )}

          <div className="mt-6 p-3 bg-bg-primary rounded border border-bg-border">
            <p className="text-data-xs font-medium text-text-primary mb-2">导出说明</p>
            <ul className="space-y-1.5 text-data-xs text-text-secondary">
              <li>• 导出文件包含5个工作表：结算明细、异常记录、结算附件、人工确认、费率表</li>
              <li>• 每次导出同时生成校验文件(.json)，用于后续数据一致性验证</li>
              <li>• 校验基于SHA-256哈希算法，确保数据不可篡改</li>
              <li>• 建议处理完所有待确认项后再导出最终结果</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-data-xs text-text-muted">{label}:</span>
      <span className={`font-mono font-semibold text-data-sm ${color || 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 text-text-muted" />
        <span className="text-data-xs text-text-muted">{label}</span>
      </div>
      <p className={`text-data-sm text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
