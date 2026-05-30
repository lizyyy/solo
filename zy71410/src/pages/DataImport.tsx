import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { createSourceMeta, parseProspectusCsv, parseLedgerCsv, parsePaymentCsv } from '../utils/import';
import { exportToCsv, downloadCsv, generateSummaryReport } from '../utils/export';
import { SourceType, SOURCE_TYPE_LABELS, ExportOptions } from '../types';
import { Upload, FileText, Play, Download, AlertCircle, CheckCircle, Info } from 'lucide-react';

const DataImport: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [sourceType, setSourceType] = useState<SourceType>('prospectus');
  const [version, setVersion] = useState('1.0');
  const [uploadUser, setUploadUser] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeDiscrepancies: true,
    includeHistory: true
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!fileContent) {
      setMessage({ type: 'error', text: '请先选择要导入的文件' });
      return;
    }
    if (!uploadUser.trim()) {
      setMessage({ type: 'error', text: '请输入上传人姓名' });
      return;
    }

    try {
      const source = createSourceMeta(
        sourceType,
        fileName || `${SOURCE_TYPE_LABELS[sourceType]}_${new Date().toLocaleDateString()}`,
        version,
        uploadUser,
        description
      );

      let recordCount = 0;

      switch (sourceType) {
        case 'prospectus':
          const prospectuses = parseProspectusCsv(fileContent, source.id);
          dispatch({ type: 'ADD_SOURCE', payload: source });
          dispatch({ type: 'ADD_PROSPECTUSES', payload: prospectuses });
          recordCount = prospectuses.length;
          break;
        case 'ledger':
          const ledgers = parseLedgerCsv(fileContent, source.id);
          dispatch({ type: 'ADD_SOURCE', payload: source });
          dispatch({ type: 'ADD_LEDGERS', payload: ledgers });
          recordCount = ledgers.length;
          break;
        case 'payment':
          const vouchers = parsePaymentCsv(fileContent, source.id);
          dispatch({ type: 'ADD_SOURCE', payload: source });
          dispatch({ type: 'ADD_VOUCHERS', payload: vouchers });
          recordCount = vouchers.length;
          break;
      }

      setMessage({
        type: 'success',
        text: `成功导入 ${recordCount} 条 ${SOURCE_TYPE_LABELS[sourceType]} 记录`
      });

      setFileName('');
      setFileContent('');
      setDescription('');
    } catch (err) {
      setMessage({ type: 'error', text: '导入失败，请检查文件格式' });
      console.error(err);
    }
  };

  const handleProcess = () => {
    if (state.prospectuses.length === 0) {
      setMessage({ type: 'error', text: '请先导入募集说明书' });
      return;
    }
    if (state.ledgers.length === 0 && state.vouchers.length === 0) {
      setMessage({ type: 'error', text: '请至少导入项目台账或付款凭证' });
      return;
    }

    dispatch({ type: 'PROCESS_DATA' });
    setMessage({
      type: 'success',
      text: `数据处理完成，共生成 ${state.fundUsages.length} 条资金用途记录，检测到 ${state.discrepancies.length} 处差异`
    });
  };

  const handleExport = () => {
    if (state.fundUsages.length === 0) {
      setMessage({ type: 'error', text: '暂无数据可导出' });
      return;
    }

    const content = exportToCsv(
      state.fundUsages,
      exportOptions.includeDiscrepancies ? state.discrepancies : [],
      exportOptions.includeHistory ? state.processingHistory : [],
      exportOptions
    );
    downloadCsv(content, '绿色债券资金用途数据');
    setMessage({ type: 'success', text: '导出成功' });
  };

  const handleExportReport = () => {
    if (state.fundUsages.length === 0) {
      setMessage({ type: 'error', text: '暂无数据可导出' });
      return;
    }
    const report = generateSummaryReport(state.fundUsages, state.discrepancies, state.sources);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `绿色债券资金用途汇总报告_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: '汇总报告导出成功' });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'import'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            数据导入
          </div>
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'export'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            数据导出
          </div>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          )}
          <span className={`text-sm ${
            message.type === 'success' ? 'text-green-700' :
            message.type === 'error' ? 'text-red-700' : 'text-blue-700'
          }`}>
            {message.text}
          </span>
        </div>
      )}

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">导入设置</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    数据类型
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['prospectus', 'ledger', 'payment'] as SourceType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => setSourceType(type)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          sourceType === type
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <FileText className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-sm font-medium">{SOURCE_TYPE_LABELS[type]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      版本号
                    </label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="input-field"
                      placeholder="例如: 1.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      上传人 *
                    </label>
                    <input
                      type="text"
                      value={uploadUser}
                      onChange={(e) => setUploadUser(e.target.value)}
                      className="input-field"
                      placeholder="请输入姓名"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    说明
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input-field resize-none"
                    rows={2}
                    placeholder="可选，说明数据来源或变更内容"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择CSV文件 *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer"
                    >
                      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      {fileName ? (
                        <div>
                          <p className="text-green-600 font-medium">{fileName}</p>
                          <p className="text-sm text-gray-500 mt-1">点击重新选择</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-600">点击或拖拽文件到此处</p>
                          <p className="text-sm text-gray-400 mt-1">支持CSV格式</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleImport}
                  disabled={!fileContent || !uploadUser}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  导入数据
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">处理数据</h3>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-600 mb-4">
                  导入完成后，点击下方按钮进行资金用途匹配、归类和差异检测。系统会自动关联募集说明书、项目台账和付款凭证，生成资金用途记录并检测不一致的地方。
                </p>
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-gray-600">募集说明书: {state.prospectuses.length} 条</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                    <span className="text-gray-600">项目台账: {state.ledgers.length} 条</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    <span className="text-gray-600">付款凭证: {state.vouchers.length} 条</span>
                  </div>
                </div>
                <button
                  onClick={handleProcess}
                  disabled={state.prospectuses.length === 0 || (state.ledgers.length === 0 && state.vouchers.length === 0)}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  开始处理
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">CSV格式说明</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">募集说明书</h4>
                  <p className="text-xs text-gray-500 mb-1">列顺序: 项目名称,债券代码,发行金额,计划用途,用途分类,预计日期,披露标准,披露版本</p>
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                    项目名称,债券代码,发行金额,计划用途,用途分类,预计日期,披露标准,披露版本
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">项目台账</h4>
                  <p className="text-xs text-gray-500 mb-1">列顺序: 项目名称,计划金额,实际金额,用途分类,进度,计划日期,实际日期,状态</p>
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                    项目名称,计划金额,实际金额,用途分类,进度,计划日期,实际日期,状态
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">付款凭证</h4>
                  <p className="text-xs text-gray-500 mb-1">列顺序: 凭证号,项目名称,金额,付款日期,收款方,用途分类,摘要,有发票,已审批</p>
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                    凭证号,项目名称,金额,付款日期,收款方,用途分类,摘要,有发票,已审批
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
              <div className="card-header border-blue-200">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">使用提示</h3>
                </div>
              </div>
              <div className="card-body">
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• 请确保三类数据中的"项目名称"完全一致，以便系统自动匹配</li>
                  <li>• 用途分类请使用标准分类：清洁能源、清洁交通、可持续水资源管理、废物处理、绿色建筑、生态保护</li>
                  <li>• 版本号用于追踪数据变更，建议每次更新时递增</li>
                  <li>• 系统会自动检测不一致的数据，并标记需要解释的项目</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">导出设置</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    导出格式
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExportOptions({ ...exportOptions, format: 'csv' })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        exportOptions.format === 'csv'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">CSV</p>
                      <p className="text-xs text-gray-500">适合Excel打开</p>
                    </button>
                    <button
                      onClick={() => setExportOptions({ ...exportOptions, format: 'excel' })}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        exportOptions.format === 'excel'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">Excel</p>
                      <p className="text-xs text-gray-500">多工作表格式</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    包含内容
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeDiscrepancies}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeDiscrepancies: e.target.checked })}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <span className="text-sm text-gray-700">包含差异记录</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeHistory}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeHistory: e.target.checked })}
                        className="w-4 h-4 text-green-600 rounded"
                      />
                      <span className="text-sm text-gray-700">包含处理历史</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      开始日期（可选）
                    </label>
                    <input
                      type="date"
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        dateRange: {
                          start: e.target.value,
                          end: exportOptions.dateRange?.end || ''
                        }
                      })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      结束日期（可选）
                    </label>
                    <input
                      type="date"
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        dateRange: {
                          start: exportOptions.dateRange?.start || '',
                          end: e.target.value
                        }
                      })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleExport}
                    disabled={state.fundUsages.length === 0}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    导出数据
                  </button>
                  <button
                    onClick={handleExportReport}
                    disabled={state.fundUsages.length === 0}
                    className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    生成汇总报告
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">导出内容预览</h3>
              </div>
              <div className="card-body space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">资金用途记录</span>
                  <span className="font-medium">{state.fundUsages.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">差异记录</span>
                  <span className="font-medium">{state.discrepancies.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">处理历史</span>
                  <span className="font-medium">{state.processingHistory.length} 条</span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between">
                  <span className="text-gray-600">数据来源</span>
                  <span className="font-medium">{state.sources.length} 个</span>
                </div>
              </div>
            </div>

            <div className="card bg-green-50 border-green-200">
              <div className="card-header border-green-200">
                <h3 className="font-semibold text-green-800">导出文件包含</h3>
              </div>
              <div className="card-body text-sm text-green-700 space-y-2">
                <p>✓ 资金用途明细表</p>
                {exportOptions.includeDiscrepancies && (
                  <p>✓ 差异记录表（含影响分析）</p>
                )}
                {exportOptions.includeHistory && (
                  <p>✓ 操作处理历史</p>
                )}
                <p>✓ 数据来源和版本信息</p>
                <p>✓ 导出时间和范围说明</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImport;
