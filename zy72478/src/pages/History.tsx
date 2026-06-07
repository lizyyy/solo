
import {
  History,
  Upload,
  Map,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Download,
  User,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const actionIcons: Record<string, React.ReactNode> = {
  '导入': <Upload className="w-4 h-4" />,
  '生成': <Map className="w-4 h-4" />,
  '录入': <FileText className="w-4 h-4" />,
  '检测': <AlertTriangle className="w-4 h-4" />,
  '执行': <ClipboardCheck className="w-4 h-4" />,
  '重算': <Map className="w-4 h-4" />,
  '导出': <Download className="w-4 h-4" />,
  '处理': <ClipboardCheck className="w-4 h-4" />,
};

const getActionIcon = (action: string) => {
  for (const [key, icon] of Object.entries(actionIcons)) {
    if (action.includes(key)) return icon;
  }
  return <History className="w-4 h-4" />;
};

export default function HistoryPage() {
  const { operationLogs, currentProject, heatmapData, addOperationLog } = useAppStore();

  const projectLogs = operationLogs.filter((l) => l.projectId === currentProject?.id);
  const projectHeatmaps = heatmapData.filter((h) => h.projectId === currentProject?.id);

  const handleExport = () => {
    addOperationLog('导出操作日志', '导出完整操作日志记录');
    alert('操作日志已导出（演示）');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">历史记录</h1>
          <p className="text-gray-500 mt-1">所有操作的时间线记录和版本回溯</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors"
        >
          <Download className="w-4 h-4" />
          导出日志
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">操作日志</h2>
            </div>
            <div className="p-5">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {projectLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-10">
                      <div className="absolute left-0 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center text-gray-500">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800">{log.action}</span>
                          <span className="text-xs text-gray-500">{log.createdAt}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          <span>{log.operator}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">热力图版本</h3>
            <div className="space-y-3">
              {projectHeatmaps.slice().reverse().map((heatmap) => (
                <div
                  key={heatmap.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{heatmap.version}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      heatmap.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      heatmap.status === 'pending_review' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {heatmap.status === 'confirmed' ? '已确认' :
                       heatmap.status === 'pending_review' ? '待复核' : '草稿'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{heatmap.createdAt}</p>
                  {heatmap.hasLowSampling && (
                    <p className="text-xs text-orange-600 mt-1">⚠️ 存在采样不足区域</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">统计信息</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">总操作次数</span>
                <span className="text-sm font-medium text-gray-800">{projectLogs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">热力图版本数</span>
                <span className="text-sm font-medium text-gray-800">{projectHeatmaps.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">参与人员</span>
                <span className="text-sm font-medium text-gray-800">
                  {new Set(projectLogs.map((l) => l.operator)).size} 人
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
            <h3 className="font-semibold mb-3">操作提示</h3>
            <ul className="space-y-2 text-sm text-white/80">
              <li>• 所有操作均会被记录，可随时追溯</li>
              <li>• 热力图版本支持回滚，点击版本可查看详情</li>
              <li>• 导出日志包含完整操作时间线</li>
              <li>• 重要操作需人工确认，系统不自动拍板</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
