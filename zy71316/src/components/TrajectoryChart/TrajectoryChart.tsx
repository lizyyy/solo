import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Activity } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

export const TrajectoryChart: React.FC = () => {
  const { result, selectedPointIndex, setSelectedPointIndex } = useSimulationStore();

  const chartOptions = useMemo(() => {
    if (!result) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: '等待模拟开始...',
          left: 'center',
          top: 'center',
          textStyle: { color: '#6b7280', fontSize: 16 }
        },
        grid: { show: false }
      };
    }

    const trajectory = result.trajectory;
    const timeData = trajectory.map(p => p.time.toFixed(1));
    const altitudeData = trajectory.map(p => p.altitude);
    const velocityData = trajectory.map(p => p.velocity);
    const accelerationData = trajectory.map(p => p.acceleration);

    const riskPoints = trajectory
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => p.risks.length > 0);

    const deployIndex = trajectory.findIndex(p => p.parachuteDeployed);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        textStyle: { color: '#e5e7eb' },
        formatter: (params: any) => {
          const idx = params[0].dataIndex;
          const point = trajectory[idx];
          setSelectedPointIndex(idx);
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px; color: #f97316;">时间: ${point.time.toFixed(2)}s</div>
              <div style="display: grid; gap: 4px;">
                <div>高度: <span style="color: #4ecdc4;">${point.altitude.toFixed(2)}m</span></div>
                <div>速度: <span style="color: #f97316;">${point.velocity.toFixed(2)}m/s</span></div>
                <div>加速度: <span style="color: #a78bfa;">${point.acceleration.toFixed(4)}m/s²</span></div>
                <div>阻力: <span style="color: #22d3ee;">${point.dragForce.toFixed(2)}N</span></div>
                <div>降落伞: <span style="color: ${point.parachuteDeployed ? '#22c55e' : '#f87171'};">${point.parachuteDeployed ? '已展开' : '未展开'}</span></div>
                ${point.risks.length > 0 ? `<div style="color: #f87171;">⚠️ 风险: ${point.risks.join(', ')}</div>` : ''}
              </div>
            </div>
          `;
        }
      },
      legend: {
        data: ['高度', '速度', '加速度', '开伞点'],
        top: 10,
        textStyle: { color: '#9ca3af' }
      },
      grid: {
        left: '5%',
        right: '5%',
        top: '15%',
        bottom: '10%'
      },
      xAxis: {
        type: 'category',
        data: timeData,
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { color: '#6b7280' },
        name: '时间 (s)',
        nameTextStyle: { color: '#6b7280' }
      },
      yAxis: [
        {
          type: 'value',
          name: '高度 (m)',
          position: 'left',
          axisLine: { lineStyle: { color: '#4ecdc4' } },
          axisLabel: { color: '#6b7280' },
          splitLine: { lineStyle: { color: '#1f2937' } }
        },
        {
          type: 'value',
          name: '速度 (m/s)',
          position: 'right',
          axisLine: { lineStyle: { color: '#f97316' } },
          axisLabel: { color: '#6b7280' },
          splitLine: { show: false }
        },
        {
          type: 'value',
          name: '加速度 (m/s²)',
          position: 'right',
          offset: 60,
          axisLine: { lineStyle: { color: '#a78bfa' } },
          axisLabel: { color: '#6b7280' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '高度',
          type: 'line',
          yAxisIndex: 0,
          data: altitudeData,
          smooth: true,
          lineStyle: { color: '#4ecdc4', width: 2 },
          itemStyle: { color: '#4ecdc4' },
          symbol: 'none'
        },
        {
          name: '速度',
          type: 'line',
          yAxisIndex: 1,
          data: velocityData,
          smooth: true,
          lineStyle: { color: '#f97316', width: 2 },
          itemStyle: { color: '#f97316' },
          symbol: 'none'
        },
        {
          name: '加速度',
          type: 'line',
          yAxisIndex: 2,
          data: accelerationData,
          smooth: true,
          lineStyle: { color: '#a78bfa', width: 2 },
          itemStyle: { color: '#a78bfa' },
          symbol: 'none'
        },
        {
          name: '开伞点',
          type: 'scatter',
          yAxisIndex: 0,
          data: deployIndex >= 0 ? [[deployIndex, trajectory[deployIndex].altitude]] : [],
          symbol: 'pin',
          symbolSize: 30,
          itemStyle: { color: '#22c55e' },
          label: {
            show: true,
            formatter: '开伞',
            position: 'top',
            color: '#22c55e'
          }
        },
        {
          name: '风险点',
          type: 'scatter',
          yAxisIndex: 0,
          data: riskPoints.map(p => [p.index, p.altitude]),
          symbol: 'circle',
          symbolSize: 15,
          itemStyle: { 
            color: '#ef4444',
            shadowBlur: 10,
            shadowColor: '#ef4444'
          },
          rippleEffect: {
            brushType: 'stroke'
          },
          animation: true
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        }
      ]
    };
  }, [result, setSelectedPointIndex]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <Activity className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-bold text-white tracking-wider">减速轨迹分析</h2>
        {result && (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">最终速度:</span>
              <span className={`font-mono font-bold ${result.landedSafely ? 'text-green-400' : 'text-red-400'}`}>
                {result.finalVelocity.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">总时间:</span>
              <span className="font-mono font-bold text-cyan-400">
                {result.totalTime.toFixed(2)} s
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-bold ${
              result.landedSafely 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {result.landedSafely ? '✓ 安全着陆' : '✗ 着陆风险'}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 p-4">
        <ReactECharts
          option={chartOptions}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};
