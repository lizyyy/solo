import React, { useState } from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { RotateCcw, Camera, FileText, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface FloatingMenuProps {
  onScreenshot: () => void;
  onExportReport: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ onScreenshot, onExportReport }) => {
  const { resetExperiment } = useExperimentStore();
  const [showInfo, setShowInfo] = useState(false);

  const menuItems = [
    {
      icon: RotateCcw,
      label: '重置实验',
      onClick: resetExperiment,
      color: 'text-dark-300 hover:text-primary-400',
    },
    {
      icon: Camera,
      label: '截图',
      onClick: onScreenshot,
      color: 'text-dark-300 hover:text-blue-400',
    },
    {
      icon: FileText,
      label: '导出报告',
      onClick: onExportReport,
      color: 'text-dark-300 hover:text-green-400',
    },
    {
      icon: Info,
      label: '使用说明',
      onClick: () => setShowInfo(!showInfo),
      color: 'text-dark-300 hover:text-purple-400',
    },
  ];

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="glass rounded-full px-3 py-2 flex items-center gap-1 shadow-lg">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.onClick}
                className={`group relative p-2 rounded-full transition-all btn-click ${item.color} hover:bg-dark-700/50`}
                title={item.label}
              >
                <Icon size={20} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs whitespace-nowrap bg-dark-800 text-dark-200 px-2 py-1 rounded pointer-events-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {showInfo && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-96 max-w-[90vw]">
          <div className="glass rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="title-font font-semibold text-primary-400">使用说明</h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-dark-400 hover:text-dark-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm text-dark-300">
              <div className="flex items-start gap-2">
                <span className="text-primary-400">🖱️</span>
                <p><strong>3D场景操作：</strong>左键拖拽旋转视角，滚轮缩放，右键平移</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-400">🎚️</span>
                <p><strong>调节参数：</strong>拖动右侧滑块改变角度、质量和摩擦系数</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-400">👆</span>
                <p><strong>查看详情：</strong>点击斜面或物块查看详细信息</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-400">📸</span>
                <p><strong>截图导出：</strong>点击截图按钮保存当前场景图片</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary-400">📄</span>
                <p><strong>报告导出：</strong>导出包含参数、受力分析和异常记录的完整报告</p>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-dark-800/50 text-xs text-dark-400">
                <p className="font-medium text-dark-300 mb-1">💡 物理原理</p>
                <p>物块是否滑动取决于斜面角度和摩擦系数。当斜面角度超过临界角度 θ_c = arctan(μ) 时，沿斜面的分力超过最大静摩擦力，物块开始滑动。注意：临界角度与物块质量无关！</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingMenu;
