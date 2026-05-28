import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Container } from '../components/layout/Container';
import { FileSpreadsheet, Download, CheckCircle, AlertTriangle, Table, FileText, History } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function ExportCenter() {
  const { exportReport, getStatistics, validateConsistency, pledges } = useAppStore();
  const [exporting, setExporting] = useState(false);
  const [consistencyStatus, setConsistencyStatus] = useState<{ passed: boolean; message: string } | null>(null);

  const statistics = getStatistics();

  const handleCheckConsistency = () => {
    const result = validateConsistency();
    const passedCount = result.details.filter((d) => d.passed).length;
    setConsistencyStatus({
      passed: result.passed,
      message: result.passed
        ? `数据一致性校验通过：${pledges.length}条记录，${statistics.totalWarning}条预警，${statistics.pendingSupplement}条待补仓，${passedCount}/${result.details.length}项校验通过`
        : `数据不一致：${result.errors.map((e) => e).join('；')}`,
    });
    setTimeout(() => setConsistencyStatus(null), 8000);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      exportReport();
      setExporting(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="export" />

      <Container>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1e3a5f]" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            报告导出
          </h1>
          <p className="text-gray-600 mt-1">
            导出完整的股票质押预警处置报告，包含统计概览、客户明细、补仓展期处置记录
          </p>
        </div>

        {consistencyStatus && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              consistencyStatus.passed
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {consistencyStatus.passed ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium">
                  {consistencyStatus.passed ? '数据一致性校验通过' : '发现数据不一致'}
                </div>
                <div className="text-sm mt-1">{consistencyStatus.message}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">导出内容</h2>
              <p className="text-gray-600 text-sm mb-6">
                导出的Excel报告包含6个工作表，全面覆盖预警处置业务的各个环节，
                所有数据与页面显示保持一致。
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: <Table className="w-5 h-5" />,
                    name: '预警概览',
                    desc: '统计指标和预警客户明细',
                    color: 'bg-red-100 text-red-600',
                  },
                  {
                    icon: <FileText className="w-5 h-5" />,
                    name: '客户明细',
                    desc: '所有客户质押合约的详细数据',
                    color: 'bg-blue-100 text-blue-600',
                  },
                  {
                    icon: <FileText className="w-5 h-5" />,
                    name: '补仓记录',
                    desc: '所有补仓操作记录及到账状态',
                    color: 'bg-green-100 text-green-600',
                  },
                  {
                    icon: <FileText className="w-5 h-5" />,
                    name: '展期记录',
                    desc: '所有展期申请及审批状态',
                    color: 'bg-purple-100 text-purple-600',
                  },
                  {
                    icon: <FileText className="w-5 h-5" />,
                    name: '处置记录',
                    desc: '所有平仓处置报告',
                    color: 'bg-orange-100 text-orange-600',
                  },
                  {
                    icon: <History className="w-5 h-5" />,
                    name: '操作日志',
                    desc: '所有操作的历史审计记录',
                    color: 'bg-gray-100 text-gray-600',
                  },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.desc}</div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">数据概览</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">质押合约总数</span>
                  <span className="font-bold text-gray-900">{pledges.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">今日触线</span>
                  <span className="font-bold text-red-600">{statistics.totalWarning}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">待补仓</span>
                  <span className="font-bold text-orange-600">{statistics.pendingSupplement}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">待展期</span>
                  <span className="font-bold text-purple-600">{statistics.pendingExtension}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">待处置</span>
                  <span className="font-bold text-red-600">{statistics.pendingDisposal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">特殊场景</span>
                  <span className="font-bold text-yellow-600">{statistics.specialCases}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">导出操作</h2>
              <div className="space-y-3">
                <button
                  onClick={handleCheckConsistency}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  校验数据一致性
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full px-4 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      导出完整报告
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">💡 提示</div>
                  <div className="text-xs text-blue-600">
                    导出前会自动进行数据一致性校验，确保页面统计、列表显示、导出报告三方数据一致。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">导出报告示例</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex gap-2">
              <div className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">
                预警概览
              </div>
              <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                客户明细
              </div>
              <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                补仓记录
              </div>
              <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                展期记录
              </div>
              <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                处置记录
              </div>
              <div className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                操作日志
              </div>
            </div>
            <div className="p-4">
              <div className="text-center text-gray-400 py-8">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-2" />
                <p>导出的Excel文件将包含完整的数据表格</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
