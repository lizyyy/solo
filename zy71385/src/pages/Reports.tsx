import { useState, useEffect } from 'react';
import { FileText, Download, Plus, TrendingUp, AlertTriangle, CheckCircle, Clock, User, Eye, FileSpreadsheet, FileJson, Filter, Search } from 'lucide-react';
import { useFlagStore } from '../store/flagStore';
import { Card } from '../components/Card';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RiskBadge } from '../components/RiskBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDateTime } from '../utils/dateUtils';
import { getRiskLevelLabel, getSuggestedActionLabel } from '../utils/riskCalculator';
import type { Report, FlagWithDetails } from '../types';

export function Reports() {
  const {
    reports,
    flags,
    initData,
    loading,
    generateReport,
    exportFlags,
  } = useFlagStore();

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportType, setReportType] = useState<'cleanup' | 'risk' | 'scan'>('cleanup');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'cleanup':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'scan':
        return <FileText className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'cleanup':
        return '清理报告';
      case 'risk':
        return '风险评估报告';
      case 'scan':
        return '代码扫描报告';
      default:
        return type;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'cleanup':
        return 'bg-green-100 text-green-700';
      case 'risk':
        return 'bg-orange-100 text-orange-700';
      case 'scan':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleGenerateReport = () => {
    const report = generateReport(reportType);
    setSelectedReport(report);
    setShowGenerateModal(false);
  };

  const handleExport = (format: 'xlsx' | 'json') => {
    if (selectedReport) {
      exportFlags(format, selectedReport.flagIds);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = !searchQuery || 
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.generatedBy.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getReportFlags = (report: Report): FlagWithDetails[] => {
    return flags.filter(f => report.flagIds.includes(f.id));
  };

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在处理..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报告中心</h1>
          <p className="text-gray-500 mt-1">生成、查看和导出各类功能开关分析报告</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          生成报告
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Card
          title="总报告数"
          value={reports.length}
          icon={<FileText className="w-6 h-6" />}
          color="blue"
          trend="累计生成"
        />
        <Card
          title="清理报告"
          value={reports.filter(r => r.type === 'cleanup').length}
          icon={<TrendingUp className="w-6 h-6" />}
          color="green"
          trend="可清理清单"
        />
        <Card
          title="风险报告"
          value={reports.filter(r => r.type === 'risk').length}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="orange"
          trend="风险评估"
        />
        <Card
          title="扫描报告"
          value={reports.filter(r => r.type === 'scan').length}
          icon={<FileText className="w-6 h-6" />}
          color="blue"
          trend="代码引用"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">历史报告</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索报告..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 w-64"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input-field w-36"
              >
                <option value="all">全部类型</option>
                <option value="cleanup">清理报告</option>
                <option value="risk">风险报告</option>
                <option value="scan">扫描报告</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredReports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>暂无报告</p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedReport?.id === report.id
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-gray-50 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        {getReportIcon(report.type)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{report.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getReportTypeColor(report.type)}`}>
                            {getReportTypeLabel(report.type)}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {report.generatedBy}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(report.generatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white rounded-lg transition-colors">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">{report.summary.totalFlags}</p>
                      <p className="text-xs text-gray-500">总开关数</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600">{report.summary.safeToDelete}</p>
                      <p className="text-xs text-gray-500">可安全删除</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-orange-600">{report.summary.needVerification}</p>
                      <p className="text-xs text-gray-500">需确认</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-600">{report.summary.blockers}</p>
                      <p className="text-xs text-gray-500">阻塞项</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          {selectedReport ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">报告详情</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="导出Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="导出JSON"
                  >
                    <FileJson className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getReportIcon(selectedReport.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{selectedReport.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getReportTypeColor(selectedReport.type)}`}>
                        {getReportTypeLabel(selectedReport.type)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">生成人</p>
                      <p className="text-sm font-medium text-gray-700">{selectedReport.generatedBy}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">生成时间</p>
                      <p className="text-sm font-medium text-gray-700">{formatDateTime(selectedReport.generatedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedReport.summary.totalFlags}</p>
                    <p className="text-xs text-blue-600">总开关数</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedReport.summary.safeToDelete}</p>
                    <p className="text-xs text-green-600">可安全删除</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-orange-600">{selectedReport.summary.needVerification}</p>
                    <p className="text-xs text-orange-600">需确认</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-red-600">{selectedReport.summary.blockers}</p>
                    <p className="text-xs text-red-600">阻塞项</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">报告说明</h4>
                  <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                    <p className="text-sm text-primary-800 leading-relaxed">
                      <span className="font-medium">报告规则说明：</span>
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-primary-700">
                      <li>• <strong>可安全删除</strong>：代码无引用、全量开启超过180天、无灰度用户</li>
                      <li>• <strong>需人工确认</strong>：存在代码引用、灰度用户、环境不一致等情况</li>
                      <li>• <strong>禁止清理</strong>：检测到动态引用、生产环境灰度用户超过100人</li>
                    </ul>
                    <p className="text-xs text-primary-600 mt-3">
                      * 所有规则可在系统设置中调整阈值和启用状态
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">涉及开关列表</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {getReportFlags(selectedReport).slice(0, 10).map((flag) => (
                      <div key={flag.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{flag.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{flag.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                            <span className={`text-xs font-medium ${
                              flag.suggestedAction === 'safe_delete' ? 'text-green-600' :
                              flag.suggestedAction === 'verify_first' ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {flag.suggestedAction && getSuggestedActionLabel(flag.suggestedAction)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {getReportFlags(selectedReport).length > 10 && (
                      <p className="text-center text-sm text-gray-500 py-2">
                        ... 还有 {getReportFlags(selectedReport).length - 10} 个开关
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <p className="font-medium text-gray-700">选择一个报告查看详情</p>
              <p className="text-sm text-gray-400 mt-1">点击左侧列表中的报告卡片</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onConfirm={handleGenerateReport}
        title="生成新报告"
        message="选择报告类型，系统将根据当前数据自动生成分析报告。"
        confirmText="生成报告"
        variant="info"
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">报告类型</label>
          <div className="grid grid-cols-3 gap-3">
            {(['cleanup', 'risk', 'scan'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  reportType === type
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  {type === 'cleanup' ? (
                    <TrendingUp className={`w-6 h-6 ${reportType === type ? 'text-primary-600' : 'text-gray-400'}`} />
                  ) : type === 'risk' ? (
                    <AlertTriangle className={`w-6 h-6 ${reportType === type ? 'text-primary-600' : 'text-gray-400'}`} />
                  ) : (
                    <FileText className={`w-6 h-6 ${reportType === type ? 'text-primary-600' : 'text-gray-400'}`} />
                  )}
                  <span className={`text-sm font-medium ${reportType === type ? 'text-primary-700' : 'text-gray-600'}`}>
                    {getReportTypeLabel(type)}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              <span className="font-medium">报告包含内容：</span>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              <li>• 风险分级统计和分布</li>
              <li>• 可安全删除开关列表</li>
              <li>• 需人工确认项说明</li>
              <li>• 阻塞项和风险提示</li>
              <li>• 完整规则说明</li>
            </ul>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
