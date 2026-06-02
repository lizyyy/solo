import { useState } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import type { CarbonRecord, SourceType, SupplementDiff } from '@/types';
import {
  PlusCircle,
  Search,
  Edit3,
  FileText,
  Camera,
  FileCheck,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
} from 'lucide-react';
import SourceBadge from '@/components/common/SourceBadge';
import StatusBadge from '@/components/common/StatusBadge';

export default function Supplement() {
  const { records, supplementRecord } = useCarbonStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<CarbonRecord | null>(null);
  const [formData, setFormData] = useState<Partial<CarbonRecord>>({});
  const [diffs, setDiffs] = useState<SupplementDiff[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [supplementSuccess, setSupplementSuccess] = useState(false);

  const filteredRecords = records.filter(r =>
    r.pointName.includes(searchTerm) ||
    r.address.includes(searchTerm) ||
    r.originalName.includes(searchTerm)
  );

  const handleSelectRecord = (record: CarbonRecord) => {
    setSelectedRecord(record);
    setFormData({
      pointName: record.pointName,
      address: record.address,
      carbonAmount: record.carbonAmount,
      unit: record.unit,
      recordDate: record.recordDate,
      remark: record.remark,
      sourceType: record.sourceType,
      isOldCaliber: false,
      oldCaliberNote: '',
    });
    setDiffs([]);
    setShowDiff(false);
    setSupplementSuccess(false);
  };

  const handleSourceTypeChange = (type: SourceType) => {
    setFormData(prev => ({ ...prev, sourceType: type }));
  };

  const previewDiffs = () => {
    if (!selectedRecord) return;
    
    const { diffs: newDiffs } = supplementRecord(selectedRecord.id, formData);
    setDiffs(newDiffs);
    setShowDiff(true);
    
    setTimeout(() => {
      const state = useCarbonStore.getState();
      const updated = state.records.find(r => r.id === selectedRecord.id);
      if (updated) {
        setSelectedRecord(updated);
      }
      setSupplementSuccess(true);
      setTimeout(() => setSupplementSuccess(false), 3000);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    previewDiffs();
  };

  const clearSelection = () => {
    setSelectedRecord(null);
    setFormData({});
    setDiffs([]);
    setShowDiff(false);
    setSearchTerm('');
  };

  const sourceTypeOptions: { type: SourceType; icon: typeof FileText; label: string }[] = [
    { type: 'street_form', icon: FileText, label: '街道表格' },
    { type: 'inspection_photo', icon: Camera, label: '现场照片' },
    { type: 'approval_record', icon: FileCheck, label: '审批记录' },
    { type: 'manual_supplement', icon: Edit3, label: '人工补录' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-lg font-semibold text-gray-800 mb-1">补录备注</h3>
        <p className="text-sm text-gray-500">
          选择已有记录进行补录更新，系统自动对比新旧数据差异并留存痕迹
        </p>
      </div>

      {supplementSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-3 animate-slide-in-right">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-green-800">补录成功！数据差异已记入审核痕迹</span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索点位名称或地址..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">未找到匹配的记录</p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    onClick={() => handleSelectRecord(record)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      selectedRecord?.id === record.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                    }`}
                  >
                    <p className="font-medium text-gray-800 text-sm truncate">
                      {record.pointName}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-1">{record.address}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <SourceBadge sourceType={record.sourceType} className="text-xs" />
                      <StatusBadge status={record.status} className="text-xs" />
                    </div>
                    {record.isOldCaliber && (
                      <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-0.5">
                        旧口径数据
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          {!selectedRecord ? (
            <div className="card p-12 text-center">
              <PlusCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h4 className="text-lg font-medium text-gray-600 mb-2">选择要补录的记录</h4>
              <p className="text-gray-500">
                从左侧列表选择需要补录更新的记录，补录后系统将自动对比差异
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="font-medium text-gray-800 text-lg">补录信息</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      原始记录：{selectedRecord.pointName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      点位名称
                    </label>
                    <input
                      type="text"
                      value={formData.pointName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, pointName: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      碳排放量
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={formData.carbonAmount || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, carbonAmount: parseFloat(e.target.value) }))}
                        className="input-field flex-1"
                      />
                      <input
                        type="text"
                        value={formData.unit || 'kgCO2e'}
                        onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                        className="input-field w-24"
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地址
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      记录日期
                    </label>
                    <input
                      type="date"
                      value={formData.recordDate || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, recordDate: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      数据来源
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {sourceTypeOptions.map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => handleSourceTypeChange(option.type)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs transition-all ${
                            formData.sourceType === option.type
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <option.icon className="w-3.5 h-3.5" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    备注说明
                  </label>
                  <textarea
                    value={formData.remark || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                    className="input-field h-20 resize-none"
                    placeholder="请输入补录说明..."
                  />
                </div>

                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isOldCaliber || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, isOldCaliber: e.target.checked }))}
                      className="mt-1 w-4 h-4 text-orange-600 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-orange-800">标记为旧口径数据</p>
                      <p className="text-xs text-orange-600 mt-0.5">
                        用于从巡检照片补录的历史数据，原统计口径与当前不同
                      </p>
                      {formData.isOldCaliber && (
                        <input
                          type="text"
                          value={formData.oldCaliberNote || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, oldCaliberNote: e.target.value }))}
                          className="input-field mt-2 text-sm"
                          placeholder="请说明旧口径的具体含义..."
                        />
                      )}
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    保存补录并对比差异
                  </button>
                </div>
              </div>

              {showDiff && diffs.length > 0 && (
                <div className="card p-6 animate-scale-in">
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowLeftRight className="w-5 h-5 text-primary-600" />
                    <h4 className="font-medium text-gray-800">数据差异对比</h4>
                  </div>
                  
                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-32">字段</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-1/3">原值</th>
                          <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 w-16"></th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-1/3">新值</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {diffs.map((diff, idx) => (
                          <tr key={idx} className={diff.isDiff ? 'bg-warn-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">
                              {diff.field}
                            </td>
                            <td className={`px-4 py-3 text-sm ${
                              diff.isDiff ? 'text-danger-600 line-through' : 'text-gray-600'
                            }`}>
                              {String(diff.oldValue) || '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {diff.isDiff ? (
                                <ArrowLeftRight className="w-4 h-4 text-warn-600 mx-auto" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                              )}
                            </td>
                            <td className={`px-4 py-3 text-sm ${
                              diff.isDiff ? 'text-green-600 font-medium' : 'text-gray-600'
                            }`}>
                              {String(diff.newValue) || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-warn-600" />
                    <span className="text-gray-600">
                      共发现 <span className="font-semibold text-warn-600">
                        {diffs.filter(d => d.isDiff).length}
                      </span> 处差异，以上变更已记入审核痕迹
                    </span>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-primary-800 mb-2">补录说明</h4>
        <ul className="text-sm text-primary-700 space-y-1 list-disc list-inside">
          <li>补录操作会保留原始数据，新数据作为补充版本存在</li>
          <li>系统自动对比新旧数据差异，差异部分会高亮显示</li>
          <li>旧口径数据请勾选「标记为旧口径数据」，并说明口径差异</li>
          <li>所有补录操作都会留下完整审核痕迹，导出时可追溯</li>
        </ul>
      </div>
    </div>
  );
}
