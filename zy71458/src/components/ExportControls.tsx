import { Download, FileJson, FileSpreadsheet, Image } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';

export const ExportControls = () => {
  const { config, results, conclusion, runSim } = useSimulationStore();

  const exportCSV = () => {
    if (results.length === 0) {
      alert('请先运行模拟');
      return;
    }

    const headers = ['时间(h)', '浓度(' + config.drug.unit + ')', '给药点', '超上限', '低于下限'];
    const rows = results.map((r) => [
      r.time.toFixed(2),
      r.concentration.toFixed(4),
      r.isDosingPoint ? '是' : '否',
      r.isAboveMax ? '是' : '否',
      r.isBelowMin ? '是' : '否',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `simulation_${config.drug.name}_${Date.now()}.csv`;
    link.click();
  };

  const exportJSON = () => {
    const exportData = {
      config,
      conclusion,
      exportTime: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `config_${config.drug.name}_${Date.now()}.json`;
    link.click();
  };

  const exportChartImage = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      alert('请先运行模拟生成图表');
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `chart_${config.drug.name}_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Download className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">操作控制</h2>
          <p className="text-sm text-gray-500">运行模拟并导出结果</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={runSim}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-teal-500/30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-bold text-lg">运行模拟</span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={exportCSV}
            className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-medium text-gray-700">CSV</span>
          </button>
          <button
            onClick={exportJSON}
            className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <FileJson className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">JSON</span>
          </button>
          <button
            onClick={exportChartImage}
            className="flex flex-col items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Image className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium text-gray-700">图片</span>
          </button>
        </div>
      </div>
    </div>
  );
};
