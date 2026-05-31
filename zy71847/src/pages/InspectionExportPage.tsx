import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, FileSpreadsheet, Eye, Check, Settings, Info } from 'lucide-react';
import { useCableStore } from '@/store/cableStore';
import { ExportConfig, CableRecord, STATUS_LABELS } from '@/types';
import { generatePDF, generateExcel, getStatistics } from '@/utils/exportGenerator';
import { StatusBadge } from '@/components/common/StatusBadge';
import { generateExportMessage } from '@/utils/humanMessageGenerator';
import { HumanMessageCard } from '@/components/common/HumanMessageCard';

export const InspectionExportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { recordIds?: string[] } | null;
  
  const { records, getFilteredRecords, filters } = useCableStore();
  
  const [config, setConfig] = useState<ExportConfig>({
    format: 'pdf',
    includeCaliber: true,
    groupByStatus: true,
    template: 'customer',
    title: '机房线缆巡检单',
    remark: '',
  });

  const selectedRecordIds = state?.recordIds;
  
  const recordsToExport = useMemo(() => {
    if (selectedRecordIds && selectedRecordIds.length > 0) {
      return records.filter(r => selectedRecordIds.includes(r.id));
    }
    const filtered = getFilteredRecords();
    return filtered.length > 0 ? filtered : records;
  }, [records, selectedRecordIds, getFilteredRecords, filters]);

  const stats = useMemo(() => getStatistics(recordsToExport), [recordsToExport]);

  const confirmedRecords = recordsToExport.filter(r => r.status === 'confirmed');
  const pendingRecords = recordsToExport.filter(r => r.status === 'pending');
  const manualRecords = recordsToExport.filter(r => r.status === 'manual');

  const handleExport = () => {
    if (config.format === 'pdf') {
      generatePDF(recordsToExport, config);
    } else {
      generateExcel(recordsToExport, config);
    }
  };

  const RecordPreview = ({ records, title, color }: { records: CableRecord[]; title: string; color: string }) => (
    records.length > 0 && (
      <div className="mb-4">
        <h4 className={`text-sm font-semibold ${color} mb-2 flex items-center gap-2`}>
          {title} <span className="font-mono">({records.length} 条)</span>
        </h4>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">线缆编号</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">机房/机柜</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">类型</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">坐标</th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">备注</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 3).map(record => (
                <tr key={record.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">{record.cableNo}</td>
                  <td className="px-3 py-2">{record.room}/{record.cabinet}</td>
                  <td className="px-3 py-2">{record.cableType}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    ({record.startPoint.x},{record.startPoint.y}) → ({record.endPoint.x},{record.endPoint.y})
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{record.remark}</td>
                </tr>
              ))}
              {records.length > 3 && (
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td colSpan={5} className="px-3 py-2 text-center text-gray-400">
                    ... 还有 {records.length - 3} 条记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">导出巡检单</h1>
                <p className="text-xs text-gray-500">
                  将导出 {recordsToExport.length} 条记录
                  {selectedRecordIds && `（已选择 ${selectedRecordIds.length} 条）`}
                </p>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-signal-green text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              {config.format === 'pdf' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
              导出 {config.format.toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          <aside className="w-80 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                导出配置
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">导出格式</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig({ ...config, format: 'pdf' })}
                      className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        config.format === 'pdf'
                          ? 'bg-signal-blue text-white border-signal-blue'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, format: 'excel' })}
                      className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        config.format === 'excel'
                          ? 'bg-signal-green text-white border-signal-green'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">文档标题</label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">备注说明</label>
                  <textarea
                    value={config.remark}
                    onChange={(e) => setConfig({ ...config, remark: e.target.value })}
                    placeholder="可选：导出目的、适用范围等"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue resize-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">使用模板</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setConfig({ ...config, template: 'customer' })}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        config.template === 'customer'
                          ? 'bg-industrial-800 text-white border-industrial-800'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      客户版
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, template: 'internal' })}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        config.template === 'internal'
                          ? 'bg-industrial-800 text-white border-industrial-800'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      内部版
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.groupByStatus}
                      onChange={(e) => setConfig({ ...config, groupByStatus: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-signal-blue focus:ring-signal-blue"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">按状态分块展示</span>
                      <p className="text-xs text-gray-500">已确认/待补/人工修改分开显示</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.includeCaliber}
                      onChange={(e) => setConfig({ ...config, includeCaliber: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-signal-blue focus:ring-signal-blue"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">包含处理口径说明</span>
                      <p className="text-xs text-gray-500">附加状态定义和说明文字</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-500" />
                导出统计
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-signal-green font-mono">{stats.confirmed}</p>
                  <p className="text-xs text-green-700">已确认</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-signal-orange font-mono">{stats.pending}</p>
                  <p className="text-xs text-amber-700">待补</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-signal-blue font-mono">{stats.manual}</p>
                  <p className="text-xs text-blue-700">人工修改</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-800 font-mono">{stats.total}</p>
                  <p className="text-xs text-gray-600">总计</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-gray-500" />
                  导出预览
                </h3>
              </div>

              <div className="p-6">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50">
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-1">{config.title}</h2>
                    <p className="text-xs text-gray-500">生成时间：{new Date().toLocaleString('zh-CN')}</p>
                    {config.remark && (
                      <p className="text-sm text-gray-600 mt-2">{config.remark}</p>
                    )}
                  </div>

                  {config.groupByStatus ? (
                    <>
                      <RecordPreview 
                        records={confirmedRecords} 
                        title="【已确认】" 
                        color="text-signal-green" 
                      />
                      <RecordPreview 
                        records={pendingRecords} 
                        title="【待补】" 
                        color="text-signal-orange" 
                      />
                      <RecordPreview 
                        records={manualRecords} 
                        title="【人工修改】" 
                        color="text-signal-blue" 
                      />
                    </>
                  ) : (
                    <RecordPreview 
                      records={recordsToExport} 
                      title="【全部记录】" 
                      color="text-gray-800" 
                    />
                  )}

                  {config.includeCaliber && (
                    <div className="mt-6 p-4 bg-gray-100/50 rounded-lg border border-gray-200">
                      <h5 className="text-xs font-semibold text-gray-600 mb-2">【处理口径说明】</h5>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>1. 已确认：数据经过双人复核，坐标和走向准确无误</li>
                        <li>2. 待补：信息不完整或存在疑问，需要现场核实后补充</li>
                        <li>3. 人工修改：原始数据存在问题（如坐标轴翻转），已人工修正</li>
                        <li>4. 如有疑问，请联系对应记录的负责人确认</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {pendingRecords.length > 0 && (
              <div className="mt-6">
                <HumanMessageCard
                  message={generateExportMessage(recordsToExport.length)}
                  onAction={(action) => {
                    if (action === 'export_pdf') {
                      setConfig({ ...config, format: 'pdf' });
                      setTimeout(handleExport, 100);
                    } else if (action === 'export_excel') {
                      setConfig({ ...config, format: 'excel' });
                      setTimeout(handleExport, 100);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
