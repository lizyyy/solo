import { useState } from 'react';
import {
  ChevronDown,
  Download,
  FileText,
  RotateCcw,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { sampleDatasets } from '../../data/samples';
import { validateExcavationData } from '../../utils/dataValidator';
import { exportToCSV, exportToJSON } from '../../utils/exporter';
import { downloadReport } from '../../utils/reportGenerator';
import { filterArtifacts } from '../../utils/filterEngine';

export const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const excavationData = useStore((state) => state.excavationData);
  const setExcavationData = useStore((state) => state.setExcavationData);
  const setValidationErrors = useStore((state) => state.setValidationErrors);
  const resetAll = useStore((state) => state.resetAll);
  const filters = useStore((state) => state.filters);
  const validationErrors = useStore((state) => state.validationErrors);

  const handleSampleSelect = (sampleId: string) => {
    const sample = sampleDatasets.find((s) => s.id === sampleId);
    if (sample) {
      setExcavationData(sample.data);
      const errors = validateExcavationData(sample.data);
      setValidationErrors(errors);
    }
    setIsDropdownOpen(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setExcavationData(data);
          const errors = validateExcavationData(data);
          setValidationErrors(errors);
        } catch (error) {
          alert('JSON 文件格式错误');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportCSV = () => {
    if (!excavationData) return;
    const filtered = filterArtifacts(excavationData.artifacts, filters);
    exportToCSV(filtered, `${excavationData.name}_出土物.csv`);
  };

  const handleExportJSON = () => {
    if (!excavationData) return;
    exportToJSON(excavationData, `${excavationData.name}_探方数据.json`);
  };

  const handleGenerateReport = () => {
    if (!excavationData) return;
    const filtered = filterArtifacts(excavationData.artifacts, filters);
    downloadReport(excavationData, filtered, validationErrors);
  };

  return (
    <header className="h-14 bg-stone-900 border-b border-stone-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-amber-500 flex items-center gap-2">
          <span className="text-2xl">🏺</span>
          考古探方分层查看
        </h1>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-sm text-stone-200 transition-colors"
          >
            <span>加载样例</span>
            <ChevronDown size={16} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-stone-800 border border-stone-600 rounded-lg shadow-xl z-50 overflow-hidden">
              {sampleDatasets.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleSampleSelect(sample.id)}
                  className="w-full px-4 py-3 text-left hover:bg-stone-700 transition-colors border-b border-stone-700 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-200">
                      {sample.name}
                    </span>
                    {sample.hasConflicts && (
                      <AlertTriangle size={14} className="text-red-400" />
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-sm text-stone-200 cursor-pointer transition-colors">
          <Upload size={16} />
          <span>导入数据</span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        {excavationData && (
          <>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded text-sm text-white transition-colors"
            >
              <Download size={16} />
              <span>导出 CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-sm text-stone-200 transition-colors"
            >
              <Download size={16} />
              <span>导出 JSON</span>
            </button>

            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded text-sm text-white transition-colors"
            >
              <FileText size={16} />
              <span>生成报告</span>
            </button>

            <div className="w-px h-6 bg-stone-600 mx-2" />
          </>
        )}

        <button
          onClick={resetAll}
          className="flex items-center gap-2 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 rounded text-sm text-stone-200 transition-colors"
        >
          <RotateCcw size={16} />
          <span>重置</span>
        </button>
      </div>
    </header>
  );
};
