import React, { useState } from 'react';
import { useScreeningStore } from '../store/useScreeningStore';
import { exportVersionReport, downloadTextFile } from '../utils/export';
import {
  History as HistoryIcon,
  Download,
  FileText,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const History: React.FC = () => {
  const { versions, setCurrentVersion } = useScreeningStore();
  const navigate = useNavigate();
  const [exportedId, setExportedId] = useState<string | null>(null);

  const handleExport = (version: typeof versions[0]) => {
    const report = exportVersionReport(version);
    const filename = `跨境汇款筛查报告_${version.name.replace(/\s+/g, '_')}_${version.timestamp.slice(0, 10)}.txt`;
    downloadTextFile(report, filename);
    setExportedId(version.id);
    setTimeout(() => setExportedId(null), 2000);
  };

  const handleView = (versionId: string) => {
    setCurrentVersion(versionId);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">历史版本</h2>
          <p className="text-sm text-slate-500 mt-1">查看所有历史筛查版本，支持导出报告供转发</p>
        </div>

        <div className="space-y-4">
          {versions.map((version, idx) => (
            <div
              key={version.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                    <HistoryIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{version.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        v{versions.length - idx}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      {version.timestamp}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(version.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    查看
                  </button>
                  <button
                    onClick={() => handleExport(version)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    {exportedId === version.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        已导出
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        导出报告
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">总笔数</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{version.totalCount}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm text-emerald-700">正常</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700">{version.normalCount}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">异常</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">{version.abnormalCount}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm text-amber-700">待确认</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{version.pendingCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-semibold text-blue-900 mb-2">导出报告说明</h4>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li>• 导出的报告包含完整的异常和待确认汇款明细</li>
            <li>• 异常说明已整理为可直接转发的格式，可复制到邮件或即时通讯工具</li>
            <li>• 报告包含版本时间戳，便于审计追溯</li>
            <li>• 所有人工说明保留原始记录，不做系统自动合并</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
