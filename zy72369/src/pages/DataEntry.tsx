import { useState, useRef } from 'react';
import { useStore } from '@/store';
import type { Direction } from '@/types';
import { Upload, Plus, Lock, Image, FileText } from 'lucide-react';

export default function DataEntry() {
  const nameplates = useStore(s => s.nameplates);
  const records = useStore(s => s.records);
  const currentUser = useStore(s => s.currentUser);
  const importNameplate = useStore(s => s.importNameplate);
  const addRecord = useStore(s => s.addRecord);
  const addSupplementaryRecord = useStore(s => s.addSupplementaryRecord);
  const addScreenshot = useStore(s => s.addScreenshot);

  const [npForm, setNpForm] = useState({ equipmentCode: '', fiberType: '', coreDiameter: 0, claddingDiameter: 0, minBendRadius: 0 });
  const [recForm, setRecForm] = useState({ nameplateId: '', bendRadius: 0, direction: '+' as Direction, lossValue: 0 });
  const [isSupp, setIsSupp] = useState(false);
  const [suppNote, setSuppNote] = useState('');
  const [ssRecordId, setSsRecordId] = useState('');
  const [ssNote, setSsNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportNameplate = () => {
    if (!npForm.equipmentCode || !npForm.fiberType) return;
    importNameplate(npForm);
    setNpForm({ equipmentCode: '', fiberType: '', coreDiameter: 0, claddingDiameter: 0, minBendRadius: 0 });
  };

  const handleAddRecord = () => {
    if (!recForm.nameplateId) return;
    const operator = currentUser?.name || '未知';
    if (isSupp) {
      addSupplementaryRecord({ ...recForm, operator, isSupplementary: true, supplementaryNote: suppNote });
      setIsSupp(false);
      setSuppNote('');
    } else {
      addRecord({ ...recForm, operator });
    }
    setRecForm({ nameplateId: '', bendRadius: 0, direction: '+', lossValue: 0 });
  };

  const handleScreenshotUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !ssRecordId) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      addScreenshot({
        recordId: ssRecordId,
        dataUrl,
        note: ssNote,
        uploader: currentUser?.name || '未知',
      });
      setSsNote('');
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const selectedNp = nameplates.find(n => n.id === recForm.nameplateId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">数据录入</h2>
        <span className="text-xs text-gray-400">当前用户：{currentUser?.name || '未登录'}</span>
      </div>

      {/* Nameplate Import */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-[#0F4C5C]" />
          <h3 className="font-semibold text-gray-800">设备铭牌参数导入</h3>
          {nameplates.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-[#0F4C5C] bg-[#0F4C5C]/5 px-2 py-1 rounded">
              <Lock size={12} /> 基准已锁定 ({nameplates.length})
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <input placeholder="设备编码" value={npForm.equipmentCode} onChange={e => setNpForm(f => ({ ...f, equipmentCode: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input placeholder="光纤类型" value={npForm.fiberType} onChange={e => setNpForm(f => ({ ...f, fiberType: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="芯径(μm)" value={npForm.coreDiameter || ''} onChange={e => setNpForm(f => ({ ...f, coreDiameter: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="包层直径(μm)" value={npForm.claddingDiameter || ''} onChange={e => setNpForm(f => ({ ...f, claddingDiameter: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="最小弯曲半径(mm)" value={npForm.minBendRadius || ''} onChange={e => setNpForm(f => ({ ...f, minBendRadius: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
        </div>
        <button onClick={handleImportNameplate} disabled={!npForm.equipmentCode || !npForm.fiberType} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
          <Plus size={14} /> 导入铭牌
        </button>

        {nameplates.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="py-2 px-3 text-left font-medium">设备编码</th>
                  <th className="py-2 px-3 text-left font-medium">光纤类型</th>
                  <th className="py-2 px-3 text-left font-medium">芯径</th>
                  <th className="py-2 px-3 text-left font-medium">包层直径</th>
                  <th className="py-2 px-3 text-left font-medium">最小弯曲半径</th>
                  <th className="py-2 px-3 text-left font-medium">导入时间</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {nameplates.map(np => (
                  <tr key={np.id} className="border-b border-gray-50">
                    <td className="py-2 px-3">{np.equipmentCode}</td>
                    <td className="py-2 px-3">{np.fiberType}</td>
                    <td className="py-2 px-3">{np.coreDiameter}μm</td>
                    <td className="py-2 px-3">{np.claddingDiameter}μm</td>
                    <td className="py-2 px-3">{np.minBendRadius}mm</td>
                    <td className="py-2 px-3 text-gray-400">{new Date(np.importTime).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bend Loss Record Entry */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0F4C5C]" />
          弯曲损耗数据录入
        </h3>
        <div className="grid grid-cols-5 gap-3 mb-3">
          <select value={recForm.nameplateId} onChange={e => setRecForm(f => ({ ...f, nameplateId: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]">
            <option value="">选择设备铭牌</option>
            {nameplates.map(np => <option key={np.id} value={np.id}>{np.equipmentCode} - {np.fiberType}</option>)}
          </select>
          <input type="number" placeholder="弯曲半径(mm)" value={recForm.bendRadius || ''} onChange={e => setRecForm(f => ({ ...f, bendRadius: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <select value={recForm.direction} onChange={e => setRecForm(f => ({ ...f, direction: e.target.value as Direction }))} className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] ${recForm.direction === '向左' ? 'border-[#E36414] bg-orange-50' : 'border-gray-200'}`}>
            <option value="+">+ (正方向)</option>
            <option value="-">- (负方向)</option>
            <option value="向左">向左 (待复核)</option>
            <option value="向右">向右</option>
          </select>
          <input type="number" step="0.01" placeholder="损耗值(dB)" value={recForm.lossValue || ''} onChange={e => setRecForm(f => ({ ...f, lossValue: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <button onClick={handleAddRecord} disabled={!recForm.nameplateId} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Plus size={14} /> 录入
          </button>
        </div>

        {recForm.direction === '向左' && (
          <div className="mb-3 px-3 py-2 bg-orange-50 border border-[#E36414]/30 rounded-lg text-xs text-[#E36414]">
            ⚠ 方向为"向左"将自动标记为"待复核"，不会自动归为正常，需实验老师复核确认
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <input type="checkbox" checked={isSupp} onChange={e => setIsSupp(e.target.checked)} className="rounded" />
          补录数据
        </label>
        {isSupp && (
          <input placeholder="补录说明（必填）" value={suppNote} onChange={e => setSuppNote(e.target.value)} className="w-full px-3 py-2 border border-[#FBBF24] bg-yellow-50 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#FBBF24]" />
        )}

        {selectedNp && recForm.bendRadius > 0 && recForm.bendRadius < selectedNp.minBendRadius && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            ⚠ 弯曲半径 {recForm.bendRadius}mm 小于铭牌最小弯曲半径 {selectedNp.minBendRadius}mm
          </div>
        )}

        {records.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="py-2 px-3 text-left font-medium">设备</th>
                  <th className="py-2 px-3 text-left font-medium">弯曲半径</th>
                  <th className="py-2 px-3 text-left font-medium">方向</th>
                  <th className="py-2 px-3 text-left font-medium">损耗值</th>
                  <th className="py-2 px-3 text-left font-medium">状态</th>
                  <th className="py-2 px-3 text-left font-medium">补录</th>
                  <th className="py-2 px-3 text-left font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {records.map(r => {
                  const np = nameplates.find(n => n.id === r.nameplateId);
                  return (
                    <tr key={r.id} className={`border-b border-gray-50 ${r.isSupplementary ? 'bg-yellow-50/50' : ''} ${r.direction === '向左' ? 'border-l-2 border-l-[#E36414]' : ''}`}>
                      <td className="py-2 px-3">{np?.equipmentCode || r.nameplateId.slice(0, 8)}</td>
                      <td className="py-2 px-3">{r.bendRadius}mm</td>
                      <td className="py-2 px-3">{r.direction}</td>
                      <td className="py-2 px-3">{r.lossValue}dB</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          r.status === 'normal' ? 'bg-green-50 text-green-700' :
                          r.status === 'conflict' ? 'bg-red-50 text-red-700' :
                          r.status === 'pending_review' ? 'bg-orange-50 text-orange-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {r.status === 'normal' ? '正常' : r.status === 'conflict' ? '冲突' : r.status === 'pending_review' ? '待复核' : '已复核'}
                        </span>
                      </td>
                      <td className="py-2 px-3">{r.isSupplementary ? <span className="text-[#FBBF24]">补</span> : ''}</td>
                      <td className="py-2 px-3 text-gray-400">{new Date(r.recordTime).toLocaleString('zh-CN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Screenshot Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Image size={18} className="text-[#0F4C5C]" />
          维修群截图上传
        </h3>
        <p className="text-xs text-gray-400 mb-4">截图备注与正式数据并列展示，不可被清洗。铭牌参数与截图矛盾时将生成冲突条目。</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <select value={ssRecordId} onChange={e => setSsRecordId(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]">
            <option value="">选择关联记录</option>
            {records.map(r => (
              <option key={r.id} value={r.id}>
                {nameplates.find(n => n.id === r.nameplateId)?.equipmentCode || r.id.slice(0, 8)} | R={r.bendRadius} D={r.direction}
              </option>
            ))}
          </select>
          <input ref={fileRef} type="file" accept="image/*" className="px-3 py-2 border border-gray-200 rounded-lg text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#0F4C5C]/10 file:text-[#0F4C5C]" />
          <div className="flex gap-2">
            <input placeholder="截图备注" value={ssNote} onChange={e => setSsNote(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
            <button onClick={handleScreenshotUpload} disabled={!ssRecordId} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              <Upload size={14} /> 上传
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
