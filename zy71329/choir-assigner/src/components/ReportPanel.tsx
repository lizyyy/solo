import { FileSpreadsheet, FileText, Download, BarChart3, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Member, VoicePart, Assignment, AdjustmentRecord, ConflictItem } from '../types';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';

interface ReportPanelProps {
  members: Member[];
  voiceParts: VoicePart[];
  assignments: Assignment[];
  adjustments: AdjustmentRecord[];
  globalConflicts: ConflictItem[];
  songName?: string;
  teacherNotes?: string;
  statistics: {
    totalMembers: number;
    assignedMembers: number;
    partsDistribution: Record<string, number>;
    averageMatchScore: number;
    conflictCount: Record<string, number>;
  };
}

export function ReportPanel({
  members,
  voiceParts,
  assignments,
  adjustments,
  globalConflicts,
  songName,
  teacherNotes,
  statistics,
}: ReportPanelProps) {
  const handleExportExcel = () => {
    exportToExcel({
      members,
      voiceParts,
      assignments,
      adjustments,
      globalConflicts,
      songName,
      teacherNotes,
    });
  };

  const handleExportCSV = () => {
    exportToCSV(assignments, members, voiceParts);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">导出报告</h1>
        <p className="text-gray-500">生成完整的声部分配报告，支持多种格式下载</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">导出选项</h2>
            
            <div className="space-y-3">
              <button
                onClick={handleExportExcel}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">Excel 报告 (.xlsx)</div>
                  <div className="text-sm text-gray-500">包含所有工作表：分配结果、统计、异常、历史</div>
                </div>
                <Download className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={handleExportCSV}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">CSV 分配表</div>
                  <div className="text-sm text-gray-500">仅包含分配结果的简化版本</div>
                </div>
                <Download className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">报告摘要</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">曲目名称</span>
                <span className="font-medium text-gray-800">{songName || '未命名'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">导出时间</span>
                <span className="font-medium text-gray-800">{new Date().toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  分配人数
                </span>
                <span className="font-medium text-gray-800">
                  {statistics.assignedMembers} / {statistics.totalMembers}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  平均匹配度
                </span>
                <span className="font-medium text-green-600">{Math.round(statistics.averageMatchScore)}%</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  异常数量
                </span>
                <span className={`font-medium ${
                  Object.values(statistics.conflictCount).reduce((a, b) => a + b, 0) > 0 
                    ? 'text-amber-600' 
                    : 'text-green-600'
                }`}>
                  {Object.values(statistics.conflictCount).reduce((a, b) => a + b, 0)} 个
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">声部分布</h2>
            
            <div className="space-y-3">
              {voiceParts.map((part) => {
                const count = assignments.filter(a => a.partId === part.id).length;
                const percentage = (count / part.idealMembers) * 100;
                
                return (
                  <div key={part.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 font-medium">{part.displayName}</span>
                      <span className="text-sm text-gray-500">
                        {count} / {part.idealMembers} 人
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentage > 100 ? 'bg-red-500' : percentage < 50 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {teacherNotes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">老师备注</h2>
              <p className="text-gray-600 leading-relaxed">{teacherNotes}</p>
            </div>
          )}

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-800">数据一致性</h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              报告中的统计数据、分配详情和异常信息均来自同一数据源，确保导出的表格、页面统计和单条详情完全一致。
              任何手动调整都会被记录到历史中，并实时影响所有数据展示。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
