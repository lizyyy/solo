import { useState } from 'react';
import { FileSpreadsheet, FileJson, BookOpen, Download, CheckCircle, AlertCircle, Upload, Camera, Filter } from 'lucide-react';
import { useAppStore } from '../store';
import { exportToExcel, exportToJSON } from '../utils/importExport';

const Report = () => {
  const { points, photos, schemes, conflicts, getFilteredPoints } = useAppStore();
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const filteredPoints = getFilteredPoints();
  const filteredPointIds = filteredPoints.map((p) => p.id);
  const filteredPhotos = photos.filter((p) => filteredPointIds.includes(p.pointId));
  const filteredSchemes = schemes.filter((s) => filteredPointIds.includes(s.pointId));
  const filteredConflicts = conflicts.filter((c) => filteredPointIds.includes(c.pointId));

  const handleExportExcel = (all: boolean) => {
    const exportPoints = all ? points : filteredPoints;
    const exportPhotos = all ? photos : filteredPhotos;
    const exportSchemes = all ? schemes : filteredSchemes;
    const exportConflicts = all ? conflicts : filteredConflicts;

    exportToExcel(exportPoints, exportPhotos, exportSchemes, exportConflicts, all ? '全部数据' : '筛选数据');
    setExportSuccess('Excel 导出成功！');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  const handleExportJSON = (all: boolean) => {
    const exportPoints = all ? points : filteredPoints;
    const exportPhotos = all ? photos : filteredPhotos;
    const exportSchemes = all ? schemes : filteredSchemes;
    const exportConflicts = all ? conflicts : filteredConflicts;

    exportToJSON(exportPoints, exportPhotos, exportSchemes, exportConflicts, all ? '全部数据' : '筛选数据');
    setExportSuccess('JSON 导出成功！');
    setTimeout(() => setExportSuccess(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">报告导出与使用说明</h1>
        <p className="text-slate-500 mt-1">导出数据报告，查看操作指南</p>
      </div>

      {exportSuccess && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle className="w-5 h-5" />
          <span>{exportSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-500" />
            数据导出
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-3">
                当前筛选条件下：<strong>{filteredPoints.length}</strong> 个点位，
                <strong>{filteredPhotos.length}</strong> 张照片，
                <strong>{filteredSchemes.length}</strong> 个方案版本，
                <strong>{filteredConflicts.filter((c) => !c.resolved).length}</strong> 个未解决冲突
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExportExcel(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  导出筛选 Excel
                </button>
                <button
                  onClick={() => handleExportJSON(false)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <FileJson className="w-4 h-4" />
                  导出筛选 JSON
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700 mb-3">
                全部数据：<strong>{points.length}</strong> 个点位，
                <strong>{photos.length}</strong> 张照片，
                <strong>{schemes.length}</strong> 个方案版本
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExportExcel(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  导出全部 Excel
                </button>
                <button
                  onClick={() => handleExportJSON(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <FileJson className="w-4 h-4" />
                  导出全部 JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            使用说明
          </h2>

          <div className="space-y-4">
            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-green-500" />
                <span className="font-medium text-slate-800">如何导入点位</span>
              </div>
              <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                <li>在点位总览页点击"导入点位"按钮</li>
                <li>选择 .xlsx 或 .xls 格式的Excel文件</li>
                <li>预览数据无误后点击"确认导入"</li>
                <li>支持的列名：点位名称、位置、所属医院、来源、原始备注</li>
              </ol>
              <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-700">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                注意：原始备注字段会完整保留，不会进行任何清洗处理。来源列支持中文自动映射：街道表格→街道表格、现场巡检→现场巡检、审批记录→审批记录，无法识别的归为"其他来源"。
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-slate-800">如何补充照片</span>
              </div>
              <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                <li>点击点位进入详情页</li>
                <li>切换到"照片"标签页</li>
                <li>点击"上传照片"选择图片（支持多选）</li>
                <li>在每张照片下方输入原始备注（可选）</li>
              </ol>
              <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                提示：点击照片可查看大图，照片备注会单独保存不丢失
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-slate-800">如何导出当前筛选</span>
              </div>
              <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
                <li>在点位总览页设置筛选条件（搜索、状态、来源、医院）</li>
                <li>进入"报告与说明"页面</li>
                <li>点击"导出筛选 Excel"或"导出筛选 JSON"</li>
                <li>文件会自动下载到本地</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">常见问题与设计原则</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-2">为什么数据不自动清洗？</h3>
            <p className="text-sm text-slate-600">
              巡检照片中的备注可能包含关键的现场信息（如"注意有管线"、"业主不让改"等）。
              为了不丢失上下文，系统完整保留原始数据，让后续接手的人能看到老曹当时看到的全部信息。
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-2">旧方案为什么不删除？</h3>
            <p className="text-sm text-slate-600">
              方案迭代是有原因的。保留历史方案和意见，是为了避免"为什么之前这么判"的反复询问。
              新人接手时，可以完整看到每个方案的来龙去脉。
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-2">冲突为什么不自动处理？</h3>
            <p className="text-sm text-slate-600">
              数据冲突往往涉及现场实际情况与纸面记录的矛盾，系统只负责把两边的证据摆出来，
              最终判断需要由人来做。避免"例外在汇总数字里悄悄消失"。
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-2">数据存在哪里？</h3>
            <p className="text-sm text-slate-600">
              所有数据都保存在浏览器本地存储（LocalStorage）中，不会上传到任何服务器。
              建议定期导出 Excel 备份，更换浏览器或清理缓存前务必备份。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
