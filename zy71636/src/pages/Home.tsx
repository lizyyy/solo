import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { Scene3D } from '../components/three/Scene3D';
import { FilterPanel } from '../components/FilterPanel';
import { DetailPanel } from '../components/DetailPanel';
import { Toolbar } from '../components/Toolbar';
import { useAppStore } from '../store/useAppStore';

interface HomePageProps {
  onGoToHistory: () => void;
}

export function HomePage({ onGoToHistory }: HomePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filters = useAppStore((state) => state.filters);

  const handleExport = async () => {
    if (!containerRef.current) return;

    try {
      const watermark = document.createElement('div');
      watermark.style.position = 'absolute';
      watermark.style.bottom = '10px';
      watermark.style.left = '10px';
      watermark.style.right = '10px';
      watermark.style.padding = '12px 16px';
      watermark.style.background = 'rgba(0, 0, 0, 0.8)';
      watermark.style.borderRadius = '8px';
      watermark.style.color = 'white';
      watermark.style.fontSize = '11px';
      watermark.style.zIndex = '1000';
      watermark.style.backdropFilter = 'blur(4px)';
      watermark.style.border = '1px solid rgba(255, 255, 255, 0.1)';

      const now = new Date().toLocaleString('zh-CN');
      watermark.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">水坝3D巡检报告</div>
            <div style="color: #9ca3af;">导出时间: ${now}</div>
          </div>
          <div style="text-align: right;">
            <div style="color: #9ca3af; margin-bottom: 2px;">筛选条件:</div>
            <div style="font-family: monospace;">数据类型: ${filters.dataTypes.join(', ')}</div>
            <div style="font-family: monospace;">异常等级: ${filters.severityLevel.join(', ')}</div>
            <div style="font-family: monospace;">边界问题: ${filters.showBoundaryIssues ? '显示' : '隐藏'}</div>
          </div>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 24px;">
          <div><span style="display: inline-block; width: 8px; height: 8px; background: #f53f3f; border-radius: 50%; margin-right: 6px;"></span>裂缝-危急</div>
          <div><span style="display: inline-block; width: 8px; height: 8px; background: #ff7d00; border-radius: 50%; margin-right: 6px;"></span>裂缝-预警</div>
          <div><span style="display: inline-block; width: 8px; height: 8px; background: #00b42a; border-radius: 50%; margin-right: 6px;"></span>正常</div>
          <div><span style="display: inline-block; width: 8px; height: 8px; background: #ffff00; border-radius: 50%; margin-right: 6px;"></span>边界问题标记</div>
        </div>
      `;

      containerRef.current.style.position = 'relative';
      containerRef.current.appendChild(watermark);

      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = `水坝巡检报告_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      containerRef.current.removeChild(watermark);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Toolbar onExport={handleExport} onGoToHistory={onGoToHistory} />

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <FilterPanel />

        <div className="flex-1 relative">
          <Scene3D />

          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2 border border-slate-700/50">
            <div className="text-slate-300 font-medium mb-2">图例</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-400">裂缝-危急</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-400">裂缝-预警</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-400">正常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="text-slate-400">边界问题</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-400">渗压传感器</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-slate-400">应力传感器</span>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg p-2 text-xs border border-slate-700/50">
            <div className="text-slate-400">
              <span className="text-slate-300">操作提示:</span> 左键拖拽旋转 · 滚轮缩放 · 右键平移 · 点击对象查看详情
            </div>
          </div>
        </div>

        <DetailPanel />
      </div>
    </div>
  );
}
