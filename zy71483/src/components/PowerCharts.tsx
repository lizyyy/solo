import ReactECharts from 'echarts-for-react';
import { useStore } from '../store/useStore';
import { useMemo } from 'react';

export function PowerCharts() {
  const { filteredRecords, powerResults, shadingResults } = useStore();

  const timeSeriesOption = useMemo(() => {
    const sortedRecords = [...filteredRecords]
      .filter((r) => r.status !== 'withdrawn')
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E6EB',
        textStyle: { color: '#1D2129' },
      },
      legend: {
        data: ['总功率', '损失功率'],
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: sortedRecords.map((r) =>
          new Date(r.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        ),
        axisLine: { lineStyle: { color: '#E5E6EB' } },
      },
      yAxis: {
        type: 'value',
        name: '功率 (W)',
        axisLine: { lineStyle: { color: '#E5E6EB' } },
        splitLine: { lineStyle: { color: '#F7F8FA' } },
      },
      series: [
        {
          name: '总功率',
          type: 'line',
          smooth: true,
          data: sortedRecords.map((r) => r.totalPower.toFixed(1)),
          lineStyle: { color: '#00B42A', width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0, 180, 42, 0.3)' },
                { offset: 1, color: 'rgba(0, 180, 42, 0.05)' },
              ],
            },
          },
        },
        {
          name: '损失功率',
          type: 'line',
          smooth: true,
          data: sortedRecords.map((r) => r.totalLoss.toFixed(1)),
          lineStyle: { color: '#F53F3F', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 63, 63, 0.3)' },
                { offset: 1, color: 'rgba(245, 63, 63, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [filteredRecords]);

  const lossPieOption = useMemo(() => {
    const shadingLoss = powerResults
      .filter((p) => p.lossReason === 'shading')
      .reduce((sum, p) => sum + (p.theoreticalPower - p.actualPower), 0);

    const mismatchLoss = powerResults
      .filter((p) => p.lossReason === 'mismatch')
      .reduce((sum, p) => sum + (p.theoreticalPower - p.actualPower), 0);

    const diodeLoss = powerResults
      .filter((p) => p.lossReason === 'diode')
      .reduce((sum, p) => sum + (p.theoreticalPower - p.actualPower), 0);

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E6EB',
        textStyle: { color: '#1D2129' },
        formatter: '{b}: {c} W ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            { value: shadingLoss.toFixed(1), name: '遮挡损失', itemStyle: { color: '#F53F3F' } },
            { value: mismatchLoss.toFixed(1), name: '失配损失', itemStyle: { color: '#FF7D00' } },
            { value: diodeLoss.toFixed(1), name: '二极管保护', itemStyle: { color: '#165DFF' } },
          ],
        },
      ],
    };
  }, [powerResults]);

  const shadingBarOption = useMemo(() => {
    const moduleData = shadingResults.map((s, index) => ({
      name: `组件 ${index + 1}`,
      value: s.shadingRate * 100,
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E5E6EB',
        textStyle: { color: '#1D2129' },
        formatter: '{b}: {c}%',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: moduleData.map((d) => d.name),
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
        axisLine: { lineStyle: { color: '#E5E6EB' } },
      },
      yAxis: {
        type: 'value',
        name: '遮挡率 (%)',
        max: 100,
        axisLine: { lineStyle: { color: '#E5E6EB' } },
        splitLine: { lineStyle: { color: '#F7F8FA' } },
      },
      series: [
        {
          type: 'bar',
          data: moduleData.map((d) => ({
            value: d.value.toFixed(1),
            itemStyle: {
              color:
                d.value < 30
                  ? '#00B42A'
                  : d.value < 60
                  ? '#FF7D00'
                  : '#F53F3F',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: '60%',
        },
      ],
    };
  }, [shadingResults]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">功率时间曲线</div>
        <div className="card-body">
          <div style={{ height: '200px' }}>
            <ReactECharts
              option={timeSeriesOption}
              style={{ height: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">损失构成</div>
          <div className="card-body">
            <div style={{ height: '180px' }}>
              <ReactECharts
                option={lossPieOption}
                style={{ height: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">组件遮挡率</div>
          <div className="card-body">
            <div style={{ height: '180px' }}>
              <ReactECharts
                option={shadingBarOption}
                style={{ height: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
