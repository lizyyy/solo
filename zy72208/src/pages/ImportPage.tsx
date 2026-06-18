import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useSettlementStore } from '../store/useSettlementStore.js';
import { parsePastedData } from '../utils/api.js';

const sampleData = `保单号	产品名称	佣金金额	币种
POL-001	年金保险A款	50000	港币(HKD)
POL-002	终身寿险B款	75000	人民币¥
POL-003	重疾险C款	120000	HKD 港币
POL-004	年金保险A款	80000	人民币 CNY
POL-005	终身寿险B款	30000	HK$ 港币 人民币 ¥
POL-006	重疾险D款	500000	人民币
POL-007	年金保险E款	800000	HKD
POL-008	终身寿险F款	1200000	人民币`;

export const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { createBatch, loading } = useSettlementStore();
  const [batchNo, setBatchNo] = useState(`INS-${new Date().toISOString().slice(0, 10)}`);
  const [sourceFile, setSourceFile] = useState('除权日截图.xlsx');
  const [pastedData, setPastedData] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleParse = () => {
    if (pastedData.trim()) {
      const parsed = parsePastedData(pastedData);
      setPreview(parsed);
      setStep('preview');
    }
  };

  const handleImport = async () => {
    const records = preview.map(row => ({
      originalLineNo: row.lineNo,
      policyNo: row.policyNo,
      productName: row.productName,
      commissionAmount: parseFloat(row.commissionAmount),
      currencyRaw: row.currency
    }));

    const batch = await createBatch({
      batchNo,
      sourceFile,
      sourceType: 'SCREENSHOT',
      totalCount: records.length,
      records
    });

    if (batch) {
      navigate(`/batch/${batch.id}`);
    }
  };

  const loadSample = () => {
    setPastedData(sampleData);
  };

  const mixedCount = preview.filter(r => {
    const raw = r.currency || '';
    const hasHKD = /HKD|HK\$|港币|港幣|HK/i.test(raw);
    const hasCNY = /CNY|RMB|¥|￥|人民币|元/i.test(raw);
    return hasHKD && hasCNY;
  }).length;

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="bg-white border-b border-navy-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-navy-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-navy-600" />
          </button>
          <div>
            <h1 className="font-display text-xl text-navy-800">除权日截图导入</h1>
            <p className="text-sm text-navy-500">步骤 1/3：粘贴除权日截图识别结果</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1">批次号</label>
            <input
              type="text"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              className="w-full p-3 border border-navy-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1">来源文件</label>
            <input
              type="text"
              value={sourceFile}
              onChange={(e) => setSourceFile(e.target.value)}
              className="w-full p-3 border border-navy-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={loadSample}
              className="w-full p-3 bg-navy-100 text-navy-700 rounded-lg hover:bg-navy-200 transition-colors text-sm font-medium"
            >
              加载示例数据（含混币）
            </button>
          </div>
        </div>

        {step === 'input' ? (
          <div className="bg-white rounded-lg border border-navy-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-navy-800 flex items-center gap-2">
                <FileText size={18} />
                粘贴除权日截图数据
              </h3>
              <span className="text-xs text-navy-500">支持 Tab 分隔或 CSV 格式</span>
            </div>
            <textarea
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              placeholder={`请粘贴除权日截图识别的数据...\n\n格式示例：\n保单号\t产品名称\t佣金金额\t币种\nPOL-001\t年金保险A款\t50000\t港币(HKD)`}
              rows={15}
              className="w-full p-4 border border-navy-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 outline-none resize-none"
            />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-start gap-2 text-sm text-navy-500">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p>• 原始行号会自动保留，便于后续追溯证据</p>
                  <p>• 系统会自动检测"港币和人民币写在同一列"的记录</p>
                  <p>• 支持复制 Excel 列直接粘贴</p>
                </div>
              </div>
              <button
                onClick={handleParse}
                disabled={!pastedData.trim() || loading}
                className="px-6 py-3 bg-navy-800 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={18} />
                解析并预览
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg border ${mixedCount > 0 ? 'bg-audit-orange/5 border-audit-orange/30' : 'bg-audit-green/5 border-audit-green/30'}`}>
              <div className="flex items-center gap-3">
                {mixedCount > 0 ? (
                  <AlertTriangle size={24} className="text-audit-orange flex-shrink-0" />
                ) : (
                  <CheckCircle size={24} className="text-audit-green flex-shrink-0" />
                )}
                <div>
                  <h4 className={`font-semibold ${mixedCount > 0 ? 'text-audit-orange' : 'text-audit-green'}`}>
                    {mixedCount > 0 ? `检测到 ${mixedCount} 条港币人民币同列记录` : '币种检测正常'}
                  </h4>
                  <p className="text-sm text-navy-600 mt-0.5">
                    {mixedCount > 0 
                      ? '这些记录会标记为异常，需托管对接人复核，不会自动归一化' 
                      : '所有记录币种识别正常'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-navy-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-navy-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white">行号</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white">保单号</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white">产品名称</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-white">佣金金额</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white">币种（原始）</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white">检测结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {preview.map((row, idx) => {
                      const raw = row.currency || '';
                      const hasHKD = /HKD|HK\$|港币|港幣|HK/i.test(raw);
                      const hasCNY = /CNY|RMB|¥|￥|人民币|元/i.test(raw);
                      const isMixed = hasHKD && hasCNY;
                      return (
                        <tr key={idx} className={isMixed ? 'bg-audit-orange/5' : idx % 2 === 0 ? 'bg-white' : 'bg-navy-50/30'}>
                          <td className="px-4 py-3 font-mono text-sm text-navy-600">#{row.lineNo}</td>
                          <td className="px-4 py-3 font-mono text-sm text-navy-700">{row.policyNo}</td>
                          <td className="px-4 py-3 text-sm text-navy-700">{row.productName}</td>
                          <td className="px-4 py-3 font-mono text-sm text-right text-navy-700">
                            {parseFloat(row.commissionAmount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-navy-700">{row.currency}</td>
                          <td className="px-4 py-3">
                            {isMixed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-audit-orange/10 text-audit-orange text-xs font-medium rounded">
                                <AlertTriangle size={12} />
                                混币，待复核
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-audit-green/10 text-audit-green text-xs font-medium rounded">
                                <CheckCircle size={12} />
                                正常
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('input')}
                className="px-6 py-3 bg-white border border-navy-300 text-navy-700 rounded-lg hover:bg-navy-50 transition-colors font-medium"
              >
                返回修改
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-8 py-3 bg-audit-green text-white rounded-lg hover:bg-audit-green/90 transition-colors font-medium disabled:opacity-50 shadow-lg"
              >
                确认导入，进入步骤2
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
