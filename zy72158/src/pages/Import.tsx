import { useState } from 'react';
import { Upload, FileSpreadsheet, Camera, FileCheck, Map, Plus, X, AlertCircle, CheckCircle2, Merge, MapPin } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ImportData, SourceType } from '@/types';
import { parseCSVToImportData } from '@/utils/csvParser';
import { parseExcelToImportData } from '@/utils/excelParser';
import { findBestMatch } from '@/utils/matchStall';

const sourceOptions: { value: SourceType; label: string; icon: typeof FileSpreadsheet }[] = [
  { value: 'street_form', label: '街道表格', icon: FileSpreadsheet },
  { value: 'site_photo', label: '现场照片', icon: Camera },
  { value: 'approval_record', label: '审批记录', icon: FileCheck },
  { value: 'gis_legacy', label: 'GIS点位', icon: Map },
];

export default function Import() {
  const addStall = useStore(state => state.addStall);
  const stalls = useStore(state => state.stalls);
  const [sourceType, setSourceType] = useState<SourceType>('street_form');
  const [sourceName, setSourceName] = useState('');
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [mergeHints, setMergeHints] = useState<Record<number, { matched: boolean; stallName: string; reasons: string[] }>>({});
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    area: '',
    timePeriod: '10:00-22:00',
    contact: '',
    phone: '',
    lat: '',
    lng: '',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [parseMessage, setParseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function findExistingMatch(data: ImportData): { stallName: string; reasons: string[] } | null {
    const match = findBestMatch(data, stalls);
    if (match) {
      return {
        stallName: match.stall.name,
        reasons: match.reasons.filter(r => r.type !== 'combined').map(r => r.description),
      };
    }
    return null;
  }

  function updateMergeHints(items: ImportData[]) {
    const hints: Record<number, { matched: boolean; stallName: string; reasons: string[] }> = {};
    items.forEach((item, idx) => {
      const matched = findExistingMatch(item);
      if (matched) {
        hints[idx] = { matched: true, stallName: matched.stallName, reasons: matched.reasons };
      }
    });
    setMergeHints(hints);
  }

  async function processFile(file: File) {
    setSourceName(file.name);
    setParseMessage(null);

    const lowerName = file.name.toLowerCase();
    const isCSV = lowerName.endsWith('.csv');
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          setParseMessage({ type: 'error', text: `无法读取文件 ${file.name}` });
          return;
        }
        const parsed = parseCSVToImportData(text, sourceType, file.name);
        if (parsed.length === 0) {
          setParseMessage({ type: 'error', text: `文件 ${file.name} 中未找到有效数据。请确保包含"商户名称"和"面积"列。` });
          return;
        }
        const newPreview = [...previewData, ...parsed];
        setPreviewData(newPreview);
        updateMergeHints(newPreview);
        setParseMessage({ type: 'success', text: `从 ${file.name} 解析出 ${parsed.length} 条数据` });
      };
      reader.readAsText(file, 'utf-8');
    } else if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) {
            setParseMessage({ type: 'error', text: `无法读取文件 ${file.name}` });
            return;
          }
          const parsed = parseExcelToImportData(buffer, sourceType, file.name);
          if (parsed.length === 0) {
            setParseMessage({ type: 'error', text: `文件 ${file.name} 中未找到有效数据。请确保第一行表头包含"商户名称"和"面积"列。` });
            return;
          }
          const newPreview = [...previewData, ...parsed];
          setPreviewData(newPreview);
          updateMergeHints(newPreview);
          setParseMessage({ type: 'success', text: `从 ${file.name} 解析出 ${parsed.length} 条数据` });
        } catch (err) {
          setParseMessage({ type: 'error', text: `解析 Excel 文件失败：${(err as Error).message}` });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const item: ImportData = {
        name: '',
        location: '',
        area: 0,
        timePeriod: '10:00-22:00',
        sourceType,
        sourceName: file.name,
        rawData: `文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB, 类型: ${file.type || '未知'}`,
      };
      setPreviewData(prev => [...prev, item]);
      updateMergeHints([...previewData, item]);
      setParseMessage({ type: 'success', text: `已记录文件 ${file.name}，请在右侧手动录入对应商户信息，或关联到已有记录补充材料。` });
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleAddPreview = () => {
    if (!formData.name || !formData.location || !formData.area) return;

    const newItem: ImportData = {
      name: formData.name,
      location: formData.location,
      area: parseFloat(formData.area),
      timePeriod: formData.timePeriod,
      contact: formData.contact || undefined,
      phone: formData.phone || undefined,
      lat: formData.lat ? parseFloat(formData.lat) : undefined,
      lng: formData.lng ? parseFloat(formData.lng) : undefined,
      sourceType,
      sourceName: sourceName || '手动录入',
      rawData: JSON.stringify(formData),
    };

    const newPreview = [...previewData, newItem];
    setPreviewData(newPreview);
    updateMergeHints(newPreview);
    setFormData({
      name: '',
      location: '',
      area: '',
      timePeriod: '10:00-22:00',
      contact: '',
      phone: '',
      lat: '',
      lng: '',
    });
  };

  const handleRemovePreview = (index: number) => {
    const newPreview = previewData.filter((_, i) => i !== index);
    setPreviewData(newPreview);
    const hints: Record<number, { matched: boolean; stallName: string; reasons: string[] }> = {};
    newPreview.forEach((item, idx) => {
      const matched = findExistingMatch(item);
      if (matched) hints[idx] = { matched: true, stallName: matched.stallName, reasons: matched.reasons };
    });
    setMergeHints(hints);
  };

  const handleImport = () => {
    const validItems = previewData.filter(item => item.name && item.area > 0);
    let mergedCount = 0;
    let newCount = 0;

    validItems.forEach(data => {
      const result = addStall(data);
      if (result.merged) {
        mergedCount++;
      } else {
        newCount++;
      }
    });

    setPreviewData([]);
    setMergeHints({});
    setSourceName('');
    setParseMessage({ type: 'success', text: `导入完成：${newCount} 条新建，${mergedCount} 条归并补充材料。系统已自动进行冲突检测。` });
  };

  const validCount = previewData.filter(item => item.name && item.area > 0).length;
  const invalidCount = previewData.length - validCount;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">选择数据来源</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sourceOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setSourceType(option.value)}
                className={`p-4 rounded-lg border-2 transition-all text-center ${
                  sourceType === option.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Icon className="w-8 h-8 mx-auto mb-2" />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {parseMessage && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          parseMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {parseMessage.type === 'success' 
            ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          }
          <p className={`text-sm ${parseMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {parseMessage.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">文件上传</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files.length > 0) processFile(files[0]);
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">拖拽文件到此处，或</p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg cursor-pointer hover:bg-primary-700 transition-colors">
              <Upload className="w-4 h-4" />
              选择文件
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.pdf"
                onChange={handleFileUpload}
              />
            </label>
            <p className="text-xs text-gray-500 mt-4">
              Excel（.xlsx/.xls）和 CSV 文件将自动解析；图片/PDF 将记录来源
            </p>
          </div>
          {sourceName && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">已选择: {sourceName}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">手动录入</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">商户名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入商户名称"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">位置描述 *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="请输入位置描述"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">外摆面积(㎡) *</label>
                <input
                  type="number"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="例如: 8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">经营时间段</label>
                <input
                  type="text"
                  value={formData.timePeriod}
                  onChange={(e) => setFormData({ ...formData, timePeriod: e.target.value })}
                  placeholder="如: 10:00-22:00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系人</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="联系人姓名"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="联系电话"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  纬度
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  placeholder="如: 31.2304"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  经度
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  placeholder="如: 121.4737"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <button
              onClick={handleAddPreview}
              disabled={!formData.name || !formData.location || !formData.area}
              className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加到预览列表
            </button>
          </div>
        </div>
      </div>

      {previewData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                数据预览 ({previewData.length} 条，{validCount} 条有效)
              </h2>
              {invalidCount > 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  {invalidCount} 条缺少商户名称或面积，导入时将被跳过
                </p>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={validCount === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              确认导入
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">商户名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">位置 / GIS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">面积</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">时间段</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.map((item, index) => {
                  const isValid = item.name && item.area > 0;
                  const hint = mergeHints[index];
                  return (
                    <tr key={index} className={!isValid ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3">
                        {!isValid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">待补全</span>
                        ) : hint?.matched ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Merge className="w-3 h-3 mr-1" />
                            归并
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">新建</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.name || <span className="text-yellow-500 italic">未填写</span>}
                        {hint?.matched && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            → 归并到: {hint.stallName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{item.location || '-'}</div>
                        {item.lat !== undefined && item.lng !== undefined && (
                          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                          </div>
                        )}
                        {hint?.matched && hint.reasons.length > 0 && (
                          <div className="text-xs text-blue-500 mt-1 leading-relaxed">
                            {hint.reasons.join('；')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.area > 0 ? `${item.area}㎡` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.timePeriod}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.sourceName}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemovePreview(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
