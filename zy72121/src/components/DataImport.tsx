import { useState, useRef } from 'react';
import { Upload, FileText, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { checkDataQuality } from '../utils/dataQuality';
import { getQualityLabel, getQualityColor } from '../utils/dataQuality';
import { cn } from '../utils/cn';

export default function DataImport() {
  const { records, setRecords, addRecord, removeRecord, resetToDemo, clearAll } = useAppStore();
  const [pasteText, setPasteText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const issues = checkDataQuality(records);
  const issueCount = issues.length;
  const missingCount = issues.filter(i => i.type === 'missing').length;
  const unitCount = issues.filter(i => i.type === 'unit_mismatch').length;
  const outlierCount = issues.filter(i => i.type === 'outlier').length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseAndImport(text);
    };
    reader.readAsText(file);
  };

  const parseAndImport = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(/[\t,]/).map(h => h.trim().toLowerCase());
    const newRecords = lines.slice(1).map((line, idx) => {
      const values = line.split(/[\t,]/).map(v => v.trim());
      const getValue = (header: string) => {
        const idx = headers.findIndex(h => h.includes(header));
        return idx >= 0 ? values[idx] : '';
      };

      return {
        id: `rec_${Date.now()}_${idx}`,
        location: getValue('位置') || getValue('location') || `测点${idx + 1}`,
        curtainType: getValue('门帘') || getValue('curtain') || 'PVC软门帘',
        temperatureInside: parseFloat(getValue('库内温度') || getValue('inside')) || null,
        tempInsideUnit: getValue('库内单位') || '°C',
        temperatureOutside: parseFloat(getValue('库外温度') || getValue('outside')) || null,
        tempOutsideUnit: getValue('库外单位') || '°C',
        curtainArea: parseFloat(getValue('面积') || getValue('area')) || null,
        areaUnit: getValue('面积单位') || 'm²',
        airChangeRate: parseFloat(getValue('换气') || getValue('air')) || 10,
        samplingTime: new Date().toISOString(),
        source: '导入文件',
        dataQuality: 'good' as const,
        dataIssues: [] as string[],
      };
    });

    setRecords(newRecords);
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleAddDemo = () => {
    addRecord({
      id: `rec_${Date.now()}`,
      location: `新测点-${records.length + 1}`,
      curtainType: 'PVC软门帘',
      temperatureInside: -20,
      tempInsideUnit: '°C',
      temperatureOutside: 28,
      tempOutsideUnit: '°C',
      curtainArea: 6,
      areaUnit: 'm²',
      airChangeRate: 15,
      samplingTime: new Date().toISOString(),
      source: '手动添加',
      dataQuality: 'good',
      dataIssues: [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">巡检数据</h2>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            上传文件
          </button>
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            <FileText className="w-4 h-4" />
            粘贴数据
          </button>
          <button
            onClick={handleAddDemo}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
          <button
            onClick={resetToDemo}
            className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 text-sm rounded-lg hover:bg-amber-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置演示
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {issueCount > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{missingCount}</div>
            <div className="text-xs text-amber-700">数据缺失</div>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{unitCount}</div>
            <div className="text-xs text-blue-700">单位不规范</div>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{outlierCount}</div>
            <div className="text-xs text-red-700">数值异常</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-slate-600">{records.length}</div>
            <div className="text-xs text-slate-700">总记录数</div>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">位置</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">门帘类型</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">库内温度</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">库外温度</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">门帘面积</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">数据质量</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">来源</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{record.location}</td>
                  <td className="px-3 py-2 text-slate-600">{record.curtainType}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {record.temperatureInside !== null
                      ? `${record.temperatureInside}${record.tempInsideUnit}`
                      : <span className="text-amber-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {record.temperatureOutside !== null
                      ? `${record.temperatureOutside}${record.tempOutsideUnit}`
                      : <span className="text-amber-500">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {record.curtainArea !== null
                      ? `${record.curtainArea}${record.areaUnit}`
                      : <span className="text-amber-500">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      getQualityColor(record.dataQuality)
                    )}>
                      {getQualityLabel(record.dataQuality)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{record.source}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeRecord(record.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[600px] shadow-xl">
            <h3 className="text-lg font-semibold mb-4">粘贴数据</h3>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="请粘贴CSV/TSV格式数据，第一行为表头..."
              className="w-full h-48 p-3 border border-slate-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => parseAndImport(pasteText)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
