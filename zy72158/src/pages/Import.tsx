import { useState } from 'react';
import { Upload, FileSpreadsheet, Camera, FileCheck, Map, Plus, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ImportData, SourceType } from '@/types';
import { generateId } from '@/utils/timeUtils';

const sourceOptions: { value: SourceType; label: string; icon: typeof FileSpreadsheet }[] = [
  { value: 'street_form', label: '街道表格', icon: FileSpreadsheet },
  { value: 'site_photo', label: '现场照片', icon: Camera },
  { value: 'approval_record', label: '审批记录', icon: FileCheck },
  { value: 'gis_legacy', label: 'GIS点位', icon: Map },
];

export default function Import() {
  const addStall = useStore(state => state.addStall);
  const [sourceType, setSourceType] = useState<SourceType>('street_form');
  const [sourceName, setSourceName] = useState('');
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    area: '',
    timePeriod: '10:00-22:00',
    contact: '',
    phone: '',
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleAddPreview = () => {
    if (!formData.name || !formData.location || !formData.area) return;
    
    const newItem: ImportData = {
      ...formData,
      area: parseFloat(formData.area),
      sourceType,
      sourceName: sourceName || '手动录入',
      rawData: JSON.stringify(formData),
    };
    
    setPreviewData([...previewData, newItem]);
    setFormData({
      name: '',
      location: '',
      area: '',
      timePeriod: '10:00-22:00',
      contact: '',
      phone: '',
    });
  };

  const handleRemovePreview = (index: number) => {
    setPreviewData(previewData.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    previewData.forEach(data => {
      addStall(data);
    });
    setPreviewData([]);
    alert(`成功导入 ${previewData.length} 条数据！系统已自动进行冲突检测。`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceName(file.name);
      const mockData: ImportData[] = [
        {
          name: '示例商户A',
          location: '示例街道1号',
          area: 8,
          timePeriod: '09:00-21:00',
          sourceType,
          sourceName: file.name,
          rawData: `从 ${file.name} 导入`,
        },
      ];
      setPreviewData([...previewData, ...mockData]);
    }
  };

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
              if (files.length > 0) {
                setSourceName(files[0].name);
              }
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
              支持 Excel、CSV、图片、PDF 等格式
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
            <h2 className="text-lg font-semibold text-gray-900">
              数据预览 ({previewData.length} 条)
            </h2>
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              确认导入
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">商户名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">位置</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">面积</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">时间段</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.area}㎡</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.timePeriod}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemovePreview(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
