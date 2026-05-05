import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { HallHeatmapData } from '../types';
import { formatCurrency, formatPercent } from '../utils/exportUtils';
import { useDashboard } from '../context/DashboardContext';

interface HallHeatmapProps {
  data: HallHeatmapData[];
}

const HallHeatmap: React.FC<HallHeatmapProps> = ({ data }) => {
  const { selectHall, clearSelections, selectedHallId } = useDashboard();

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">展馆热力</div>
        <div className="card-body flex items-center justify-center h-64 text-gray-400">
          暂无数据
        </div>
      </div>
    );
  }

  const maxVisitors = Math.max(...data.map((d) => d.visitors));
  const minVisitors = Math.min(...data.map((d) => d.visitors));

  const hallData = data.map((hall) => ({
    name: hall.hallName,
    value: [hall.visitors, hall.orders, hall.revenue, hall.conversionRate, hall.avgOrderValue],
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const { name, value } = params;
        return `
          <div class="font-medium mb-1">${name}</div>
          <div class="space-y-1 text-sm">
            <div>客流量: <span class="font-medium">${value[0].toLocaleString()}</span></div>
            <div>订单数: <span class="font-medium">${value[1].toLocaleString()}</span></div>
            <div>成交额: <span class="font-medium">${formatCurrency(value[2])}</span></div>
            <div>转化率: <span class="font-medium">${formatPercent(value[3])}</span></div>
            <div>客单价: <span class="font-medium">${formatCurrency(value[4])}</span></div>
          </div>
        `;
      },
    },
    visualMap: {
      min: minVisitors,
      max: maxVisitors,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '10px',
      inRange: {
        color: ['#e0f2fe', '#7dd3fc', '#0ea5e9', '#2563eb', '#1e40af'],
      },
      text: ['高客流', '低客流'],
      textStyle: {
        color: '#64748b',
        fontSize: 11,
      },
    },
    grid: {
      left: '3%',
      right: '3%',
      top: '10%',
      bottom: '20%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: ['展馆'],
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.hallName),
      splitArea: {
        show: true,
      },
    },
    series: [
      {
        name: '展馆数据',
        type: 'heatmap',
        data: data.map((hall, index) => [0, index, hall.visitors]),
        label: {
          show: true,
          formatter: (params: any) => {
            const hallInfo = data[params.dataIndex];
            return `${hallInfo.hallName}\n${hallInfo.visitors}人`;
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  const handleChartClick = (params: any) => {
    if (params.componentType === 'series') {
      const hallName = params.name;
      const hall = data.find((d) => d.hallName === hallName);
      if (hall) {
        if (selectedHallId === hall.hallId) {
          clearSelections();
        } else {
          selectHall(hall.hallId);
        }
      }
    }
  };

  const onEvents = {
    click: handleChartClick,
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <span>展馆热力</span>
        {selectedHallId && (
          <button
            onClick={clearSelections}
            className="text-xs text-primary hover:underline"
          >
            清除选择
          </button>
        )}
      </div>
      <div className="card-body">
        <ReactECharts
          option={option}
          style={{ height: '320px', width: '100%' }}
          onEvents={onEvents}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

export default HallHeatmap;
