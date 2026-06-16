import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { BarChart3, MousePointer, Info, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useNavigate } from 'react-router-dom';

interface BarChartDataItem {
  name: string;
  value: number;
  recordId: string;
  sampleId: string;
  type: string;
  itemStyle: { color: string };
}

type ScatterDataPoint = [number, number, number, string, string];

interface BarClickParams {
  name: string;
  value: number;
  data: BarChartDataItem;
}

interface ScatterClickParams {
  data: ScatterDataPoint;
}

interface TooltipFormatterParams {
  name: string;
  value: number;
  data: BarChartDataItem | ScatterDataPoint;
  dataIndex: number;
  seriesName: string;
}

export function Charts() {
  const navigate = useNavigate();
  const { getCurrentRecords, selectRecord } = useAppStore();
  const records = getCurrentRecords();

  const barChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);
  const [selectedData, setSelectedData] = useState<{
    name: string;
    value: number;
    recordId: string;
  } | null>(null);

  useEffect(() => {
    if (!barChartRef.current) return;

    const chart = echarts.init(barChartRef.current);

    const chartData = records.map((r) => ({
      name: r.sampleName.replace('社区', '').replace('-', '\n'),
      value: r.outputData.modularity,
      recordId: r.id,
      sampleId: r.sampleId,
      type: r.type,
      itemStyle: {
        color:
          r.type === 'success'
            ? '#10b981'
            : r.type === 'pending'
            ? '#f59e0b'
            : '#64748b',
      },
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const data = (params as unknown as TooltipFormatterParams[])[0];
          const itemData = data.data as BarChartDataItem;
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${data.name.replace('\n', '-')}</div>
              <div>模块度: ${data.value}</div>
              <div>类型: ${itemData.type === 'success' ? '顺利' : itemData.type === 'pending' ? '待确认' : '旧口径'}</div>
              <div style="margin-top: 4px; color: #666; font-size: 12px;">点击查看计算详情</div>
            </div>
          `;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: chartData.map((d) => d.name),
        axisLabel: { interval: 0, rotate: 0 },
      },
      yAxis: {
        type: 'value',
        name: '模块度',
        min: 0,
        max: 1,
        axisLine: { show: true },
      },
      series: [
        {
          name: '模块度',
          type: 'bar',
          data: chartData,
          barWidth: '60%',
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          markLine: {
            silent: true,
            data: [{ yAxis: 0.6, lineStyle: { color: '#ef4444', type: 'dashed' } }],
            label: { formatter: '阈值 0.6' },
          },
        },
      ],
    };

    chart.setOption(option);

    chart.on('click', (params) => {
      const p = params as unknown as BarClickParams;
      if (p.data?.recordId) {
        setSelectedData({
          name: p.name.replace('\n', '-'),
          value: p.value,
          recordId: p.data.recordId,
        });
        useAppStore.getState().selectRecord(p.data.recordId);
        navigate('/calculation');
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [records, navigate]);

  useEffect(() => {
    if (!scatterChartRef.current) return;

    const chart = echarts.init(scatterChartRef.current);

    const scatterData = records.map((r) => [
      r.outputData.communityCount,
      r.outputData.modularity,
      r.outputData.stability,
      r.sampleName,
      r.id,
    ]);

    const option: echarts.EChartsOption = {
      tooltip: {
        formatter: (params) => {
          const data = (params as unknown as TooltipFormatterParams).data as ScatterDataPoint;
          const [communityCount, modularity, stability, name] = data;
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${name}</div>
              <div>社区数量: ${communityCount}</div>
              <div>模块度: ${modularity}</div>
              <div>稳定性: ${stability}</div>
              <div style="margin-top: 4px; color: #666; font-size: 12px;">点击查看计算详情</div>
            </div>
          `;
        },
      },
      grid: { left: '10%', right: '10%', bottom: '10%', top: '10%' },
      xAxis: {
        type: 'value',
        name: '社区数量',
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: '模块度',
        min: 0,
        max: 1,
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: (data) => (data as unknown as ScatterDataPoint)[2] * 40 + 10,
          itemStyle: {
            color: (params) => {
              const data = (params as unknown as TooltipFormatterParams).data as ScatterDataPoint;
              const record = records.find((r) => r.id === data[4]);
              return record?.type === 'success'
                ? '#10b981'
                : record?.type === 'pending'
                ? '#f59e0b'
                : '#64748b';
            },
            opacity: 0.8,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
      ],
    };

    chart.setOption(option);

    chart.on('click', (params) => {
      const p = params as unknown as ScatterClickParams;
      if (p.data?.[4]) {
        setSelectedData({
          name: p.data[3],
          value: p.data[1],
          recordId: p.data[4],
        });
        useAppStore.getState().selectRecord(p.data[4]);
        navigate('/calculation');
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      chart.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [records, navigate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">图表分析</h1>
          <p className="text-slate-500 mt-1">从图表点击跳转至对应计算记录</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500"></div>
            <span className="text-slate-600">顺利</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500"></div>
            <span className="text-slate-600">待确认</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-500"></div>
            <span className="text-slate-600">旧口径</span>
          </div>
        </div>
      </div>

      {selectedData && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MousePointer className="w-5 h-5 text-cyan-600" />
            <div>
              <span className="font-medium text-cyan-800">已选中: {selectedData.name}</span>
              <span className="text-cyan-600 ml-2">模块度: {selectedData.value}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/calculation')}
            className="flex items-center gap-2 text-cyan-700 hover:text-cyan-800 font-medium"
          >
            查看详情
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">模块度对比</h3>
            <p className="text-sm text-slate-500">点击柱状图查看对应记录详情</p>
          </div>
        </div>
        <div ref={barChartRef} className="h-80 w-full"></div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">散点分布</h3>
            <p className="text-sm text-slate-500">社区数量 vs 模块度（点大小表示稳定性）</p>
          </div>
        </div>
        <div ref={scatterChartRef} className="h-80 w-full"></div>
      </div>

      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-6 border border-cyan-200">
        <div className="flex items-start gap-4">
          <Info className="w-8 h-8 text-cyan-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-slate-800 mb-2">图表追溯功能说明</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• 点击任意图表中的数据点，可直接跳转到对应计算记录</li>
              <li>• 计算记录中包含完整的计算步骤、输入输出参数</li>
              <li>• 图神经网络社区解释算法参与了所有数据点的判断</li>
              <li>• 红色虚线为模块度阈值0.6，低于该值需人工确认</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">数据明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600">样本名称</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">模块度</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">社区数量</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">稳定性</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    selectRecord(record.id);
                    navigate('/calculation');
                  }}
                >
                  <td className="py-3 px-4 font-medium text-slate-800">{record.sampleName}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.type === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : record.type === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {record.type === 'success'
                        ? '顺利'
                        : record.type === 'pending'
                        ? '待确认'
                        : '旧口径'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{record.outputData.modularity}</td>
                  <td className="py-3 px-4 text-slate-700">{record.outputData.communityCount}</td>
                  <td className="py-3 px-4 text-slate-700">{record.outputData.stability}</td>
                  <td className="py-3 px-4">
                    <button className="text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1">
                      查看详情
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
