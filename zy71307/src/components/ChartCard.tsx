import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Maximize2, Download, RefreshCw } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  option: echarts.EChartsOption;
  onRefresh?: () => void;
  onExport?: () => void;
  height?: number;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  option,
  onRefresh,
  onExport,
  height = 400,
  className = '',
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    chartInstance.current.setOption(option, true);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [option]);

  return (
    <div className={`bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-700">
        <div>
          <h3 className="font-display text-sm font-semibold text-gray-100">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 font-mono">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded hover:bg-industrial-700 text-gray-400 hover:text-tech-400 transition-colors"
              title="刷新图表"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="p-1.5 rounded hover:bg-industrial-700 text-gray-400 hover:text-tech-400 transition-colors"
              title="导出图表"
            >
              <Download size={14} />
            </button>
          )}
          <button
            className="p-1.5 rounded hover:bg-industrial-700 text-gray-400 hover:text-tech-400 transition-colors"
            title="全屏"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <div ref={chartRef} style={{ height }} />
    </div>
  );
};
