import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { TimeSlotTrend } from '../types';
import { formatCurrency, formatPercent } from '../utils/exportUtils';
import { useDashboard } from '../context/DashboardContext';

interface TimeSlotTrendChartProps {
  data: TimeSlotTrend[];
}

const TimeSlotTrendChart: React.FC<TimeSlotTrendChartProps> = ({ data }) => {
  const { selectTimeSlot, clearSelections, selectedTimeSlot } = useDashboard();

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">时段趋势</div>
        <div className="card-body flex items-center justify-center h-64 text-gray-400">
          暂无数据
        </div>
      </div>
    );
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const timeSlot = params[0]?.axisValue;
        let result = `<div class="font-medium mb-1">${timeSlot}</div>`;
        params.forEach((param: any) => {
          const value = param.value;
          let displayValue: string;
          if (param.seriesName === '转化率') {
            displayValue = formatPercent(value);
          } else if (param.seriesName === '客单价' || param.seriesName === '成交额') {
            displayValue = formatCurrency(value);
          } else {
            displayValue = value.toLocaleString();
          }
          result += `<div class="flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded-full" style="background-color: ${param.color}"></span>
            <span>${param.seriesName}:</span>
            <span class="font-medium">${displayValue}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['客流量', '订单数', '成交额', '转化率', '客单价'],
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '40px',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((d) => d.timeSlot),
      axisLabel: {
        rotate: 30,
        fontSize: 11,
      },
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        position: 'left',
      },
      {
        type: 'value',
        name: '金额',
        position: 'right',
        axisLabel: {
          formatter: (value: number) => `¥${(value / 1000).toFixed(0)}k`,
        },
      },
    ],
    series: [
      {
        name: '客流量',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.visitors),
        itemStyle: { color: '#2563eb' },
        areaStyle: {
          color: 'rgba(37, 99, 235, 0.1)',
        },
      },
      {
        name: '订单数',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.orders),
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: 'rgba(16, 185, 129, 0.1)',
        },
      },
      {
        name: '成交额',
        type: 'bar',
        yAxisIndex: 1,
        data: data.map((d) => d.revenue),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: '转化率',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.conversionRate),
        itemStyle: { color: '#ef4444' },
      },
      {
        name: '客单价',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: data.map((d) => d.avgOrderValue),
        itemStyle: { color: '#06b6d4' },
      },
    ],
  };

  const handleChartClick = (params: any) => {
    if (params.componentType === 'series') {
      const timeSlot = params.name;
      if (selectedTimeSlot === timeSlot) {
        clearSelections();
      } else {
        selectTimeSlot(timeSlot);
      }
    }
  };

  const onEvents = {
    click: handleChartClick,
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <span>时段趋势</span>
        {selectedTimeSlot && (
          <button
            onClick={clearSelections}
            className="text-xs text-primary hover:underline"
          >
            清除选择 ({selectedTimeSlot})
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

export default TimeSlotTrendChart;
