import { motion } from 'framer-motion';
import { Info, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RouteInfo } from './RouteInfo';
import { ValidationInfo } from './ValidationInfo';
import { ExportReport } from './ExportReport';

export const InfoPanel = () => {
  const { currentRoute, campusData } = useAppStore();

  if (!campusData) return null;

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      className="absolute right-4 top-4 bottom-4 w-80 bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 flex flex-col overflow-hidden z-10"
    >
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">路线信息</h2>
            <p className="text-xs text-gray-400">
              {currentRoute ? '已规划完成' : '等待规划'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentRoute ? (
          <>
            <RouteInfo route={currentRoute} />
            <ValidationInfo validation={currentRoute.validation} />
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>导出报告</span>
              </div>
              <ExportReport />
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <RouteIcon className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm">选择起点和终点后</p>
            <p className="text-gray-400 text-sm">点击"规划路线"查看详情</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-700/50 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">设施状态图例</h3>
          <div className="space-y-2">
            <LegendItem color="bg-green-500" label="正常运行" />
            <LegendItem color="bg-orange-500" label="维护中" />
            <LegendItem color="bg-red-500" label="已停用" />
            <LegendItem color="bg-blue-500" label="起点/终点" />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-700/50 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">操作提示</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <p>• 鼠标左键拖拽旋转视角</p>
            <p>• 鼠标滚轮缩放场景</p>
            <p>• 鼠标右键拖拽平移</p>
            <p>• 点击3D标记点选择起点/终点</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const RouteIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="5" r="3" />
    <path d="M12 22V8" />
    <path d="M5 12H2l2-2 2 2" />
    <path d="M19 12h3l-2 2-2-2" />
  </svg>
);

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={`w-3 h-3 rounded-full ${color}`} />
    <span className="text-xs text-gray-400">{label}</span>
  </div>
);
