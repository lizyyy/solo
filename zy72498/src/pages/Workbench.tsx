import { useState } from 'react';
import {
  Camera,
  Bus,
  FileText,
  Check,
  ChevronRight,
  Upload,
  Plus,
  X,
  Edit3,
  Save
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { JunctionPhoto, BusCardRecord } from '@/types';
import { generateId, formatDateTime } from '@/utils/common';

const STEPS = [
  { id: 1, title: '路口照片导入', icon: Camera, description: '上传路口照片，填写小区、路口信息' },
  { id: 2, title: '公交刷卡时段', icon: Bus, description: '录入或导入公交刷卡时段数据' },
  { id: 3, title: '街道摘要更新', icon: FileText, description: '生成并导出街道级汇总摘要' }
];

export default function Workbench() {
  const {
    photos,
    busRecords,
    summaries,
    currentStep,
    setCurrentStep,
    addPhotos,
    addBusRecords,
    updatePhoto,
    updateBusRecord,
    deletePhoto,
    deleteBusRecord,
    generateSummary
  } = useAppStore();

  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [showBusForm, setShowBusForm] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<JunctionPhoto | null>(null);
  const [editingBus, setEditingBus] = useState<BusCardRecord | null>(null);

  const [photoForm, setPhotoForm] = useState({
    fileName: '',
    junctionName: '',
    communityName: '',
    photoTime: '',
    hasCrosswalk: false,
    hasTrafficLight: false,
    note: ''
  });

  const [busForm, setBusForm] = useState({
    communityName: '',
    timeSlot: '',
    cardCount: 0,
    recordDate: '',
    isSupplementary: false
  });

  const handleAddPhoto = () => {
    if (!photoForm.communityName) return;
    
    const newPhoto: JunctionPhoto = {
      id: editingPhoto?.id || generateId(),
      fileName: photoForm.fileName || `路口照片_${Date.now()}.jpg`,
      uploadTime: formatDateTime(),
      junctionName: photoForm.junctionName,
      communityName: photoForm.communityName,
      photoTime: photoForm.photoTime || formatDateTime(),
      hasCrosswalk: photoForm.hasCrosswalk,
      hasTrafficLight: photoForm.hasTrafficLight,
      note: photoForm.note,
      importBatch: useAppStore.getState().currentBatch
    };

    if (editingPhoto) {
      updatePhoto(editingPhoto.id, newPhoto);
    } else {
      addPhotos([newPhoto]);
    }

    setPhotoForm({
      fileName: '',
      junctionName: '',
      communityName: '',
      photoTime: '',
      hasCrosswalk: false,
      hasTrafficLight: false,
      note: ''
    });
    setShowPhotoForm(false);
    setEditingPhoto(null);
  };

  const handleAddBus = () => {
    if (!busForm.communityName || !busForm.timeSlot) return;

    const newBus: BusCardRecord = {
      id: editingBus?.id || generateId(),
      communityName: busForm.communityName,
      timeSlot: busForm.timeSlot,
      cardCount: busForm.cardCount,
      recordDate: busForm.recordDate || new Date().toISOString().split('T')[0],
      importBatch: useAppStore.getState().currentBatch,
      isSupplementary: busForm.isSupplementary
    };

    if (editingBus) {
      updateBusRecord(editingBus.id, newBus);
    } else {
      addBusRecords([newBus]);
    }

    setBusForm({
      communityName: '',
      timeSlot: '',
      cardCount: 0,
      recordDate: '',
      isSupplementary: false
    });
    setShowBusForm(false);
    setEditingBus(null);
  };

  const handleEditPhoto = (photo: JunctionPhoto) => {
    setEditingPhoto(photo);
    setPhotoForm({
      fileName: photo.fileName,
      junctionName: photo.junctionName,
      communityName: photo.communityName,
      photoTime: photo.photoTime,
      hasCrosswalk: photo.hasCrosswalk,
      hasTrafficLight: photo.hasTrafficLight,
      note: photo.note || ''
    });
    setShowPhotoForm(true);
  };

  const handleEditBus = (record: BusCardRecord) => {
    setEditingBus(record);
    setBusForm({
      communityName: record.communityName,
      timeSlot: record.timeSlot,
      cardCount: record.cardCount,
      recordDate: record.recordDate,
      isSupplementary: record.isSupplementary
    });
    setShowBusForm(true);
  };

  const handleGenerateSummary = () => {
    generateSummary();
  };

  const stepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">数据导入工作台</h2>
        <p className="text-slate-500 mt-1">按照三步流程完成社区托育步行可达性数据核查</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center cursor-pointer transition-all ${
                    stepStatus(step.id) === 'current' ? 'scale-105' : ''
                  }`}
                  onClick={() => setCurrentStep(step.id as 1 | 2 | 3)}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      stepStatus(step.id) === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : stepStatus(step.id) === 'current'
                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-200'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {stepStatus(step.id) === 'completed' ? (
                      <Check size={20} />
                    ) : (
                      <step.icon size={20} />
                    )}
                  </div>
                  <div className="ml-3">
                    <div
                      className={`font-medium ${
                        stepStatus(step.id) === 'current'
                          ? 'text-sky-600'
                          : stepStatus(step.id) === 'completed'
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      步骤 {step.id}
                    </div>
                    <div className="text-sm text-slate-600">{step.title}</div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight
                    className={`mx-4 flex-shrink-0 ${
                      stepStatus(step.id) === 'completed' ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                    size={24}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">第一步：路口照片导入</h3>
              <p className="text-sm text-slate-500 mt-1">
                已导入 <span className="font-medium text-sky-600">{photos.length}</span> 张照片
              </p>
            </div>
            <button
              onClick={() => {
                setEditingPhoto(null);
                setShowPhotoForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              <Plus size={18} />
              添加照片记录
            </button>
          </div>

          {showPhotoForm && (
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">文件名</label>
                  <input
                    type="text"
                    value={photoForm.fileName}
                    onChange={(e) => setPhotoForm({ ...photoForm, fileName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="例如：路口照片_001.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">小区名称 *</label>
                  <input
                    type="text"
                    value={photoForm.communityName}
                    onChange={(e) => setPhotoForm({ ...photoForm, communityName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="例如：阳光花园"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">路口名称</label>
                  <input
                    type="text"
                    value={photoForm.junctionName}
                    onChange={(e) => setPhotoForm({ ...photoForm, junctionName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="例如：东门路口"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">拍摄时间</label>
                  <input
                    type="text"
                    value={photoForm.photoTime}
                    onChange={(e) => setPhotoForm({ ...photoForm, photoTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="2025-06-05 08:30:00"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={photoForm.hasCrosswalk}
                    onChange={(e) => setPhotoForm({ ...photoForm, hasCrosswalk: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span className="text-sm text-slate-700">有人行横道</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={photoForm.hasTrafficLight}
                    onChange={(e) => setPhotoForm({ ...photoForm, hasTrafficLight: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span className="text-sm text-slate-700">有红绿灯</span>
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea
                  value={photoForm.note}
                  onChange={(e) => setPhotoForm({ ...photoForm, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  rows={2}
                  placeholder="特殊情况说明..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddPhoto}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  <Save size={16} />
                  {editingPhoto ? '保存修改' : '添加记录'}
                </button>
                <button
                  onClick={() => {
                    setShowPhotoForm(false);
                    setEditingPhoto(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">文件名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">小区</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">路口</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">人行横道</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">红绿灯</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {photos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-800">{photo.fileName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{photo.communityName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{photo.junctionName || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          photo.hasCrosswalk
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {photo.hasCrosswalk ? '有' : '无'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          photo.hasTrafficLight
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {photo.hasTrafficLight ? '有' : '无'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPhoto(photo)}
                          className="p-1 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {photos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <Camera size={40} className="mx-auto mb-3 opacity-50" />
                      <p>暂无照片数据，点击上方按钮添加</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              下一步：公交刷卡时段
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">第二步：公交刷卡时段</h3>
              <p className="text-sm text-slate-500 mt-1">
                已录入 <span className="font-medium text-sky-600">{busRecords.length}</span> 条记录
                ，总刷卡量 <span className="font-medium text-emerald-600">
                  {busRecords.reduce((s, r) => s + r.cardCount, 0)}
                </span> 次
              </p>
            </div>
            <button
              onClick={() => {
                setEditingBus(null);
                setShowBusForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              <Plus size={18} />
              添加公交记录
            </button>
          </div>

          {showBusForm && (
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">小区名称 *</label>
                  <input
                    type="text"
                    value={busForm.communityName}
                    onChange={(e) => setBusForm({ ...busForm, communityName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="例如：阳光花园"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">时段 *</label>
                  <select
                    value={busForm.timeSlot}
                    onChange={(e) => setBusForm({ ...busForm, timeSlot: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">请选择时段</option>
                    <option value="07:00-08:00">07:00-08:00</option>
                    <option value="08:00-09:00">08:00-09:00</option>
                    <option value="16:00-17:00">16:00-17:00</option>
                    <option value="17:00-18:00">17:00-18:00</option>
                    <option value="18:00-19:00">18:00-19:00</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">刷卡次数</label>
                  <input
                    type="number"
                    value={busForm.cardCount}
                    onChange={(e) => setBusForm({ ...busForm, cardCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">记录日期</label>
                  <input
                    type="date"
                    value={busForm.recordDate}
                    onChange={(e) => setBusForm({ ...busForm, recordDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={busForm.isSupplementary}
                    onChange={(e) => setBusForm({ ...busForm, isSupplementary: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span className="text-sm text-slate-700">这是补录数据</span>
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddBus}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  <Save size={16} />
                  {editingBus ? '保存修改' : '添加记录'}
                </button>
                <button
                  onClick={() => {
                    setShowBusForm(false);
                    setEditingBus(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">小区</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">时段</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">刷卡次数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {busRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">{record.communityName}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-mono">{record.timeSlot}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{record.cardCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{record.recordDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          record.isSupplementary
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {record.isSupplementary ? '补录' : '正常'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditBus(record)}
                          className="p-1 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => deleteBusRecord(record.id)}
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {busRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <Bus size={40} className="mx-auto mb-3 opacity-50" />
                      <p>暂无公交数据，点击上方按钮添加</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ← 上一步
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              下一步：生成摘要
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">第三步：街道摘要更新</h3>
              <p className="text-sm text-slate-500 mt-1">
                已生成 <span className="font-medium text-sky-600">{summaries.length}</span> 版摘要
              </p>
            </div>
            <button
              onClick={handleGenerateSummary}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <FileText size={18} />
              生成最新摘要
            </button>
          </div>

          <div className="p-6">
            {summaries.length > 0 ? (
              <div className="space-y-4">
                {summaries.slice().reverse().map((summary) => (
                  <div
                    key={summary.id}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-800">第 {summary.version} 版</span>
                        <span className="text-sm text-slate-500 ml-3">
                          生成于 {summary.generatedAt}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 text-xs bg-sky-100 text-sky-700 rounded">
                          {summary.stats.totalCommunities} 个小区
                        </span>
                        <span className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded">
                          {summary.stats.totalPhotos} 张照片
                        </span>
                        <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded">
                          {summary.stats.totalBusRecords} 条公交
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono bg-slate-50 p-4 rounded">
                        {summary.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <FileText size={40} className="mx-auto mb-3 opacity-50" />
                <p>点击上方按钮生成街道摘要</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ← 上一步
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
