import { useState, useEffect } from 'react';
import { Download, FileJson, FileSpreadsheet, Eye, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { exportToCsv, exportToJson, defaultExportFields, getExportPreview } from '../utils/exportUtil';
import { StatusBadge } from '../components/common/StatusBadge';
import { fetchRecords, syncToServer } from '../utils/apiClient';

export default function Export() {
  const { records } = useRecordStore();
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [showPreview, setShowPreview] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [apiData, setApiData] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const checkApiAndFetch = async () => {
    setApiLoading(true);
    try {
      const result = await fetchRecords();
      setApiStatus('connected');
      setApiData(result);
    } catch {
      setApiStatus('disconnected');
      setApiData(null);
    }
    setApiLoading(false);
  };

  const handleSyncToServer = async () => {
    setApiLoading(true);
    try {
      await syncToServer(records, '阿宁', true);
      await checkApiAndFetch();
    } catch {
      setApiStatus('disconnected');
    }
    setApiLoading(false);
  };

  useEffect(() => {
    checkApiAndFetch();
  }, []);

  const preview = getExportPreview(records);

  const handleExport = () => {
    if (format === 'csv') {
      exportToCsv(records);
    } else {
      exportToJson(records);
    }
  };

  const stats = {
    total: records.length,
    hasAbnormal: records.filter(r => r.abnormalType !== 'none').length
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">数据导出</h1>
        <p className="text-slate-500 mt-1">统一数据源导出，页面展示、导出明细、接口返回同一份结果</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">导出配置</h2>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">导出格式</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      format === 'csv'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className={`w-6 h-6 ${format === 'csv' ? 'text-slate-900' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <p className={`font-medium ${format === 'csv' ? 'text-slate-900' : 'text-slate-600'}`}>CSV 格式</p>
                      <p className="text-xs text-slate-400">适合Excel打开查看</p>
                    </div>
                    {format === 'csv' && <Check className="w-5 h-5 text-slate-900 ml-auto" />}
                  </button>

                  <button
                    onClick={() => setFormat('json')}
                    className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      format === 'json'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileJson className={`w-6 h-6 ${format === 'json' ? 'text-slate-900' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <p className={`font-medium ${format === 'json' ? 'text-slate-900' : 'text-slate-600'}`}>JSON 格式</p>
                      <p className="text-xs text-slate-400">适合程序接口调用</p>
                    </div>
                    {format === 'json' && <Check className="w-5 h-5 text-slate-900 ml-auto" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">
                  导出字段（共 {defaultExportFields.length} 个字段）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {defaultExportFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-slate-700">{field.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">导出预览（前5条）</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {defaultExportFields.slice(0, 5).map((field) => (
                        <th key={field.key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, idx) => (
                      <tr key={idx}>
                        {defaultExportFields.slice(0, 5).map((field) => (
                          <td key={field.key} className="px-4 py-3 text-slate-700">
                            {String(row[field.label])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">导出概览</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">总记录数</span>
                <span className="text-lg font-bold text-slate-900">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">含异常记录</span>
                <span className="text-lg font-bold text-amber-600">{stats.hasAbnormal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">导出字段</span>
                <span className="text-lg font-bold text-slate-900">{defaultExportFields.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">准备导出</p>
                <p className="text-xs text-slate-400">点击下方按钮开始下载</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExport}
                className="w-full py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出 {format.toUpperCase()} 文件
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? '隐藏预览' : '预览数据'}
              </button>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <p className="text-xs text-sky-700">
              <strong>数据源一致性说明：</strong>
              本系统所有展示页面、导出功能、接口返回均读取同一份 Zustand Store 数据，确保引用链接404仍被判通过等异常记录在各处显示完全一致，不会出现一个地方显示异常、另一个地方消失的情况。
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900">API 接口状态</h4>
              <div className="flex items-center gap-2">
                {apiStatus === 'connected' ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600"><Wifi className="w-3.5 h-3.5" /> 已连接</span>
                ) : apiStatus === 'disconnected' ? (
                  <span className="flex items-center gap-1 text-xs text-rose-600"><WifiOff className="w-3.5 h-3.5" /> 未连接</span>
                ) : (
                  <span className="text-xs text-slate-400">检测中...</span>
                )}
                <button onClick={checkApiAndFetch} disabled={apiLoading}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${apiLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <button onClick={handleSyncToServer} disabled={apiLoading}
              className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 mb-3">
              同步当前数据到 API 服务
            </button>
            {apiData && apiData.success && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">API 返回记录数：<span className="font-bold text-slate-900">{apiData.total}</span></p>
                <p className="text-xs text-slate-500 mb-1">前端 Store 记录数：<span className="font-bold text-slate-900">{records.length}</span></p>
                <p className="text-xs text-slate-500">数据一致性：<span className={`font-bold ${apiData.total === records.length ? 'text-emerald-600' : 'text-rose-600'}`}>{apiData.total === records.length ? '一致' : '不一致'}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
