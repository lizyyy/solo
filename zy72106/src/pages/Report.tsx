import { useAppStore } from '@/store/useAppStore';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { formatCoordinate } from '@/utils/calculations/unitConversion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export function Report() {
  const { currentResult, sensorRecords, calculationParams, manualCorrections } =
    useAppStore();

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = currentResult
      ? [
          { '项目': '地震ID', '值': currentResult.earthquakeId },
          { '项目': '震中位置', '值': formatCoordinate(currentResult.latitude, currentResult.longitude) },
          { '项目': '深度', '值': `${currentResult.depth.toFixed(2)} km` },
          { '项目': '发震时刻', '值': `${currentResult.originTime.toFixed(2)} s` },
          { '项目': '震级', '值': `M ${currentResult.magnitude.toFixed(1)}` },
          { '项目': '结果质量', '值': currentResult.quality },
          { '项目': '水平误差', '值': `±${currentResult.uncertainty.horizontal.toFixed(2)} km` },
          { '项目': '垂直误差', '值': `±${currentResult.uncertainty.vertical.toFixed(2)} km` },
        ]
      : [];

    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '定位结果摘要');

    const recordsData = sensorRecords.map((r) => ({
      '台站名称': r.stationName,
      '传感器ID': r.sensorId,
      '纬度': r.latitude,
      '经度': r.longitude,
      '海拔(m)': r.elevation,
      'P波到时(s)': r.pWaveArrival,
      'S波到时(s)': r.sWaveArrival,
      '振幅': r.amplitude,
      '数据质量': r.quality,
      '数据来源': r.source,
      '备注': r.notes || '',
    }));

    const ws2 = XLSX.utils.json_to_sheet(recordsData);
    XLSX.utils.book_append_sheet(wb, ws2, '传感器记录');

    const paramsData = [
      { '参数': 'P波速度', '值': `${calculationParams.pWaveVelocity} km/s` },
      { '参数': 'S波速度', '值': `${calculationParams.sWaveVelocity} km/s` },
      { '参数': '波速比', '值': calculationParams.velocityRatio },
      { '参数': '时间差阈值', '值': `${calculationParams.timeThreshold} s` },
      { '参数': '定位方法', '值': calculationParams.locationMethod },
      { '参数': '最大迭代次数', '值': calculationParams.maxIterations },
      { '参数': '收敛阈值', '值': calculationParams.convergenceThreshold },
    ];

    const ws3 = XLSX.utils.json_to_sheet(paramsData);
    XLSX.utils.book_append_sheet(wb, ws3, '计算参数');

    XLSX.writeFile(wb, `地震波定位报告_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('地震波到时定位报告', 105, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`生成时间: ${new Date().toLocaleString()}`, 20, 40);
    
    doc.setFontSize(14);
    doc.text('一、定位结果摘要', 20, 55);
    
    if (currentResult) {
      doc.setFontSize(11);
      doc.text(`地震ID: ${currentResult.earthquakeId}`, 25, 65);
      doc.text(`震中位置: ${formatCoordinate(currentResult.latitude, currentResult.longitude)}`, 25, 73);
      doc.text(`深度: ${currentResult.depth.toFixed(2)} km`, 25, 81);
      doc.text(`发震时刻: ${currentResult.originTime.toFixed(2)} s`, 25, 89);
      doc.text(`震级: M ${currentResult.magnitude.toFixed(1)}`, 25, 97);
      doc.text(`结果质量: ${currentResult.quality}`, 25, 105);
    }
    
    doc.setFontSize(14);
    doc.text('二、计算参数', 20, 120);
    
    doc.setFontSize(11);
    doc.text(`P波速度: ${calculationParams.pWaveVelocity} km/s`, 25, 130);
    doc.text(`S波速度: ${calculationParams.sWaveVelocity} km/s`, 25, 138);
    doc.text(`波速比: ${calculationParams.velocityRatio}`, 25, 146);
    doc.text(`定位方法: ${calculationParams.locationMethod}`, 25, 154);
    
    doc.setFontSize(14);
    doc.text('三、传感器记录', 20, 170);
    
    doc.setFontSize(11);
    sensorRecords.slice(0, 8).forEach((r, i) => {
      doc.text(
        `${r.stationName}: P=${r.pWaveArrival?.toFixed(2) || '-'}s, S=${r.sWaveArrival?.toFixed(2) || '-'}s`,
        25,
        180 + i * 8
      );
    });

    doc.save(`地震波定位报告_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return '优秀';
      case 'good':
        return '良好';
      case 'fair':
        return '一般';
      case 'poor':
        return '较差';
      default:
        return quality;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">报告生成</h2>
          <p className="text-sm text-slate-400 mt-1">
            导出完整的地震波定位分析报告
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            disabled={!currentResult && sensorRecords.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <FileSpreadsheet size={18} />
            导出 Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={!currentResult && sensorRecords.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            导出 PDF
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-white">报告预览</h3>
          <button
            onClick={() => window.print()}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
          >
            <Printer size={14} /> 打印
          </button>
        </div>
        <div className="card-body max-w-4xl mx-auto">
          <div className="bg-white text-slate-900 rounded-lg p-8 shadow-lg print:shadow-none">
            <div className="text-center border-b border-slate-200 pb-6 mb-6">
              <h1 className="text-2xl font-bold text-slate-900">
                地震波到时定位分析报告
              </h1>
              <p className="text-slate-500 mt-2">
                生成时间: {new Date().toLocaleString()}
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-primary-500 pl-3">
                一、定位结果摘要
              </h2>
              {currentResult ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">地震ID</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {currentResult.earthquakeId}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">震中位置</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {formatCoordinate(currentResult.latitude, currentResult.longitude)}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">深度</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {currentResult.depth.toFixed(2)} km
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">发震时刻</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {currentResult.originTime.toFixed(2)} s
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">震级</p>
                    <p className="font-mono font-semibold text-slate-900">
                      M {currentResult.magnitude.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-500">结果质量</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {getQualityLabel(currentResult.quality)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无定位结果</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-primary-500 pl-3">
                二、计算参数
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 text-slate-500">P波速度</td>
                    <td className="py-2 font-mono">{calculationParams.pWaveVelocity} km/s</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 text-slate-500">S波速度</td>
                    <td className="py-2 font-mono">{calculationParams.sWaveVelocity} km/s</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 text-slate-500">波速比 (Vp/Vs)</td>
                    <td className="py-2 font-mono">{calculationParams.velocityRatio}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 text-slate-500">定位方法</td>
                    <td className="py-2">
                      {calculationParams.locationMethod === 'geiger'
                        ? 'Geiger 方法'
                        : calculationParams.locationMethod === 'homogeneous'
                        ? '均匀介质'
                        : '层状介质'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-primary-500 pl-3">
                三、传感器记录 ({sensorRecords.length} 条)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="py-2 px-2 text-left font-medium text-slate-600">台站</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600">P波(s)</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600">S波(s)</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600">振幅</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-600">质量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensorRecords.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 px-2">{r.stationName}</td>
                        <td className="py-2 px-2 font-mono">
                          {r.pWaveArrival?.toFixed(2) || '-'}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {r.sWaveArrival?.toFixed(2) || '-'}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {r.amplitude?.toLocaleString() || '-'}
                        </td>
                        <td className="py-2 px-2">{getQualityLabel(r.quality)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {manualCorrections.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-amber-500 pl-3">
                  四、人工修正记录 ({manualCorrections.length} 处)
                </h2>
                <div className="space-y-2">
                  {manualCorrections.map((c, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded p-3">
                      <p className="text-sm text-slate-700">{c.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
