import { useState, useRef } from 'react';
import { useStore } from '@/store';
import type { Direction, BendLossRecord } from '@/types';
import { Upload, Plus, Lock, Image, FileText, Edit3, Save, X, ChevronDown, ChevronUp, AlertOctagon, History as HistoryIcon } from 'lucide-react';

export default function DataEntry() {
  const nameplates = useStore(s => s.nameplates);
  const records = useStore(s => s.records);
  const currentUser = useStore(s => s.currentUser);
  const screenshots = useStore(s => s.screenshots);
  const auditLogs = useStore(s => s.auditLogs);
  const importNameplate = useStore(s => s.importNameplate);
  const addRecord = useStore(s => s.addRecord);
  const addSupplementaryRecord = useStore(s => s.addSupplementaryRecord);
  const addScreenshot = useStore(s => s.addScreenshot);
  const updateRecordNote = useStore(s => s.updateRecordNote);
  const updateScreenshotNote = useStore(s => s.updateScreenshotNote);

  const [npForm, setNpForm] = useState({ equipmentCode: '', fiberType: '', coreDiameter: 0, claddingDiameter: 0, minBendRadius: 0 });
  const [recForm, setRecForm] = useState({ nameplateId: '', bendRadius: 0, direction: '+' as Direction, lossValue: 0 });
  const [isSupp, setIsSupp] = useState(false);
  const [suppNote, setSuppNote] = useState('');
  const [ssRecordId, setSsRecordId] = useState('');
  const [ssNote, setSsNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteField, setEditingNoteField] = useState<'errorNote' | 'supplementaryNote' | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [editingSSId, setEditingSSId] = useState<string | null>(null);
  const [editingSSNote, setEditingSSNote] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [expandedSSId, setExpandedSSId] = useState<string | null>(null);

  const duplicateWarnings = auditLogs.filter(l => l.action === 'nameplate_duplicate_warning' || l.action === 'record_duplicate_warning').slice(0, 5);

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

  const startEditNote = (r: BendLossRecord, field: 'errorNote' | 'supplementaryNote') => {
    setEditingNoteId(r.id);
    setEditingNoteField(field);
    setEditingNoteValue(field === 'errorNote' ? (r.errorNote || '') : (r.supplementaryNote || ''));
  };

  const saveEditNote = () => {
    if (!editingNoteId || !editingNoteField) return;
    const operator = currentUser?.name || '未知';
    updateRecordNote(editingNoteId, editingNoteField, editingNoteValue, operator);
    setEditingNoteId(null);
    setEditingNoteField(null);
    setEditingNoteValue('');
  };

  const startEditSSNote = (ssid: string, currentNote: string) => {
    setEditingSSId(ssid);
    setEditingSSNote(currentNote);
  };

  const saveEditSSNote = () => {
    if (!editingSSId) return;
    const operator = currentUser?.name || '未知';
    updateScreenshotNote(editingSSId, editingSSNote, operator);
    setEditingSSId(null);
    setEditingSSNote('');
  };

  const selectedNp = nameplates.find(n => n.id === recForm.nameplateId);
  const ssForSelected = ssRecordId ? screenshots.filter(s => s.recordId === ssRecordId) : [];

  const npDuplicateWarning = duplicateWarnings.find(w => w.action === 'nameplate_duplicate_warning' && w.detail.includes(npForm.equipmentCode));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">数据录入</h2>
        <span className="text-xs text-gray-400">当前用户：{currentUser?.name || '未登录'}</span>
      </div>

      {duplicateWarnings.length > 0 && (
        <div className="border-2 border-[#E36414]/30 bg-orange-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon size={16} className="text-[#E36414]" />
            <h4 className="text-sm font-semibold text-[#E36414]">重复导入警告（最近{duplicateWarnings.length}条）</h4>
          </div>
          <ul className="space-y-1">
            {duplicateWarnings.map(w => (
              <li key={w.id} className="text-xs text-[#E36414] font-mono pl-6">
                {w.detail} — {w.operator} @ {new Date(w.timestamp).toLocaleString('zh-CN')}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          <div className="relative">
            <input placeholder="设备编码" value={npForm.equipmentCode} onChange={e => setNpForm(f => ({ ...f, equipmentCode: e.target.value }))} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] ${npDuplicateWarning ? 'border-[#E36414] bg-orange-50' : 'border-gray-200'}`} />
            {npDuplicateWarning && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#E36414] rounded-full" title="此编码已存在重复" />}
          </div>
          <input placeholder="光纤类型" value={npForm.fiberType} onChange={e => setNpForm(f => ({ ...f, fiberType: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="芯径(μm)" value={npForm.coreDiameter || ''} onChange={e => setNpForm(f => ({ ...f, coreDiameter: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="包层直径(μm)" value={npForm.claddingDiameter || ''} onChange={e => setNpForm(f => ({ ...f, claddingDiameter: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <input type="number" placeholder="最小弯曲半径(mm)" value={npForm.minBendRadius || ''} onChange={e => setNpForm(f => ({ ...f, minBendRadius: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
        </div>
        {npDuplicateWarning && (
          <p className="mb-3 px-3 py-2 bg-orange-50 border border-[#E36414]/30 rounded text-xs text-[#E36414]">
            ⚠ {npDuplicateWarning.detail.split(' — ')[0]} — 系统仍允许导入（保留原始操作痕迹），但已记录警告
          </p>
        )}
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
                {nameplates.map(np => {
                  const hasDup = nameplates.filter(n => n.equipmentCode === np.equipmentCode).length > 1;
                  return (
                    <tr key={np.id} className={`border-b border-gray-50 ${hasDup ? 'bg-orange-50/30' : ''}`}>
                      <td className="py-2 px-3">
                        {hasDup && <span className="inline-block w-2 h-2 rounded-full bg-[#E36414] mr-2 align-middle" title="重复设备编码" />}
                        {np.equipmentCode}
                      </td>
                      <td className="py-2 px-3">{np.fiberType}</td>
                      <td className="py-2 px-3">{np.coreDiameter}μm</td>
                      <td className="py-2 px-3">{np.claddingDiameter}μm</td>
                      <td className="py-2 px-3">{np.minBendRadius}mm</td>
                      <td className="py-2 px-3 text-gray-400">{new Date(np.importTime).toLocaleString('zh-CN')}</td>
                    </tr>
                  );
                })}
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
          <select value={recForm.direction} onChange={e => setRecForm(f => ({ ...f, direction: e.target.value as Direction }))} className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] ${recForm.direction === '向左' ? 'border-[#E36414] bg-orange-50' : recForm.direction === '向右' ? 'border-[#E36414] bg-orange-50' : 'border-gray-200'}`}>
            <option value="+">+ (正方向)</option>
            <option value="-">- (负方向)</option>
            <option value="向左">向左 (待复核)</option>
            <option value="向右">向右 (待复核)</option>
          </select>
          <input type="number" step="0.01" placeholder="损耗值(dB)" value={recForm.lossValue || ''} onChange={e => setRecForm(f => ({ ...f, lossValue: +e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C5C]" />
          <button onClick={handleAddRecord} disabled={!recForm.nameplateId} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Plus size={14} /> 录入
          </button>
        </div>

        {(recForm.direction === '向左' || recForm.direction === '向右') && (
          <div className="mb-3 px-3 py-2 bg-orange-50 border border-[#E36414]/30 rounded-lg text-xs text-[#E36414]">
            ⚠ 方向为"{recForm.direction}"将自动标记为"待复核"，不会自动归为正常，需实验老师复核确认
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <input type="checkbox" checked={isSupp} onChange={e => setIsSupp(e.target.checked)} className="rounded" />
          补录数据 <span className="text-xs text-gray-400">（勾选后补录说明必填）</span>
        </label>
        {isSupp && (
          <input placeholder="补录说明（必填，不少于5字）" value={suppNote} onChange={e => setSuppNote(e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#FBBF24] ${suppNote.length < 5 ? 'border-[#E36414]' : 'border-[#FBBF24] bg-yellow-50'}`} />
        )}

        {selectedNp && recForm.bendRadius > 0 && recForm.bendRadius < selectedNp.minBendRadius && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 mb-3">
            ⚠ 弯曲半径 {recForm.bendRadius}mm 小于铭牌最小弯曲半径 {selectedNp.minBendRadius}mm — 系统保留原始数据但标记危险工况
          </div>
        )}

        {records.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="py-2 px-3 text-left font-medium">展开</th>
                  <th className="py-2 px-3 text-left font-medium">设备</th>
                  <th className="py-2 px-3 text-left font-medium">弯曲半径</th>
                  <th className="py-2 px-3 text-left font-medium">方向</th>
                  <th className="py-2 px-3 text-left font-medium">损耗值</th>
                  <th className="py-2 px-3 text-left font-medium">状态</th>
                  <th className="py-2 px-3 text-left font-medium">补录</th>
                  <th className="py-2 px-3 text-left font-medium">误差/备注</th>
                  <th className="py-2 px-3 text-left font-medium">时间</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {records.map(r => {
                  const np = nameplates.find(n => n.id === r.nameplateId);
                  const expanded = expandedRecordId === r.id;
                  const chCount = r.changeHistory?.length || 0;
                  const recDupWarnings = auditLogs.filter(l => l.recordId === r.id && l.action === 'record_duplicate_warning');
                  return (
                    <>
                      <tr key={r.id} className={`border-b border-gray-50 ${r.isSupplementary ? 'bg-yellow-50/50' : ''} ${r.direction === '向左' || r.direction === '向右' ? 'border-l-2 border-l-[#E36414]' : ''} ${recDupWarnings.length > 0 ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2 px-3">
                          <button onClick={() => setExpandedRecordId(expanded ? null : r.id)} className="text-gray-400 hover:text-gray-700">
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {chCount > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-[#0F4C5C] text-white rounded-full text-[9px] font-medium" title={`${chCount}次修改`}>{chCount}</span>}
                        </td>
                        <td className="py-2 px-3">
                          {np?.equipmentCode || r.nameplateId.slice(0, 8)}
                          {recDupWarnings.length > 0 && <span className="inline-block w-2 h-2 rounded-full bg-[#E36414] ml-2 align-middle" title="重复导入警告" />}
                        </td>
                        <td className="py-2 px-3">{r.bendRadius}mm</td>
                        <td className={`py-2 px-3 ${r.direction === '向左' || r.direction === '向右' ? 'text-[#E36414] font-semibold' : ''}`}>{r.direction}</td>
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
                        <td className="py-2 px-3">{r.isSupplementary ? <span className="text-[#FBBF24] font-bold">补</span> : ''}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {editingNoteId === r.id && editingNoteField === 'errorNote' ? (
                            <div className="flex items-center gap-1">
                              <input value={editingNoteValue} onChange={e => setEditingNoteValue(e.target.value)} autoFocus className="flex-1 px-1 py-0.5 border border-[#0F4C5C] rounded text-xs" />
                              <button onClick={saveEditNote} className="text-green-600 hover:text-green-700"><Save size={12} /></button>
                              <button onClick={() => { setEditingNoteId(null); setEditingNoteField(null); }} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className="truncate max-w-[100px]">{r.errorNote || r.supplementaryNote || <span className="text-gray-300">(可编辑)</span>}</span>
                              <button onClick={() => startEditNote(r, r.isSupplementary ? 'supplementaryNote' : 'errorNote')} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#0F4C5C] transition-opacity"><Edit3 size={11} /></button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-400">{new Date(r.recordTime).toLocaleString('zh-CN')}</td>
                      </tr>
                      {expanded && (
                        <tr key={`${r.id}-exp`} className="bg-gray-50/80 border-b border-gray-100">
                          <td colSpan={9} className="py-3 px-6">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <HistoryIcon size={12} className="text-[#0F4C5C]" />
                                <span className="font-semibold text-gray-700">变更追踪</span>
                                {r.lastModified && <span>最后修改: {new Date(r.lastModified).toLocaleString('zh-CN')}</span>}
                              </div>
                              {(r.changeHistory && r.changeHistory.length > 0) ? (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-100 text-gray-600">
                                      <tr>
                                        <th className="py-1.5 px-3 text-left font-medium">修改字段</th>
                                        <th className="py-1.5 px-3 text-left font-medium">旧值</th>
                                        <th className="py-1.5 px-3 text-left font-medium">新值</th>
                                        <th className="py-1.5 px-3 text-left font-medium">修改人</th>
                                        <th className="py-1.5 px-3 text-left font-medium">时间</th>
                                        <th className="py-1.5 px-3 text-left font-medium">影响</th>
                                      </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                      {[...r.changeHistory].reverse().map(ch => (
                                        <tr key={ch.id} className="border-t border-gray-100">
                                          <td className="py-1.5 px-3 text-[#0F4C5C]">{ch.field}</td>
                                          <td className="py-1.5 px-3 text-red-500">{ch.oldValue}</td>
                                          <td className="py-1.5 px-3 text-green-600">{ch.newValue}</td>
                                          <td className="py-1.5 px-3">{ch.changedBy}</td>
                                          <td className="py-1.5 px-3 text-gray-400">{new Date(ch.changedAt).toLocaleString('zh-CN')}</td>
                                          <td className="py-1.5 px-3 text-gray-500 max-w-[200px]">{ch.affectedResults || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">暂无变更记录</p>
                              )}
                              {r.reviewConclusion && (
                                <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs">
                                  <span className="font-semibold text-blue-700">复核结论 ({r.reviewer}):</span>
                                  <span className="text-blue-800 ml-2">{r.reviewConclusion}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
        <p className="text-xs text-gray-400 mb-4">
          <span className="text-[#E36414] font-medium">重要：</span>
          截图备注与正式数据并列展示，<span className="underline">绝不被清洗</span>。铭牌参数与截图矛盾时将生成冲突条目，供设备工程师裁决。
        </p>
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
            <input placeholder="截图备注（必填，含业务关键词）" value={ssNote} onChange={e => setSsNote(e.target.value)} className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C5C] ${ssNote.length >= 2 ? 'border-gray-200' : 'border-[#E36414]'}`} />
            <button onClick={handleScreenshotUpload} disabled={!ssRecordId} className="px-4 py-2 bg-[#0F4C5C] text-white rounded-lg text-sm font-medium hover:bg-[#0d3f4d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
              <Upload size={14} /> 上传
            </button>
          </div>
        </div>

        {ssRecordId && ssForSelected.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-3">此记录已关联的维修群截图 ({ssForSelected.length})</h4>
            <div className="space-y-2">
              {ssForSelected.map(ss => {
                const exp = expandedSSId === ss.id;
                const chCount = ss.changeHistory?.length || 0;
                return (
                  <div key={ss.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-start gap-3">
                      <img src={ss.dataUrl} alt="" className="w-24 h-16 object-cover rounded bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {editingSSId === ss.id ? (
                          <div className="flex items-center gap-2">
                            <input value={editingSSNote} onChange={e => setEditingSSNote(e.target.value)} autoFocus className="flex-1 px-2 py-1.5 border border-[#0F4C5C] rounded text-xs font-mono" />
                            <button onClick={saveEditSSNote} className="text-green-600 hover:text-green-700"><Save size={14} /></button>
                            <button onClick={() => setEditingSSId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 group">
                            <p className="text-sm text-gray-800 font-mono flex-1 leading-relaxed">{ss.note || <span className="text-gray-400 italic">(无备注，点击编辑补充)</span>}</p>
                            <button onClick={() => startEditSSNote(ss.id, ss.note)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#0F4C5C] transition-opacity flex-shrink-0"><Edit3 size={12} /></button>
                            {chCount > 0 && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-[#FBBF24] text-gray-800 rounded-full text-[9px] font-medium flex-shrink-0" title={`${chCount}次备注修改`}>{chCount}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                          <span>上传者: {ss.uploader}</span>
                          <span>时间: {new Date(ss.uploadTime).toLocaleString('zh-CN')}</span>
                          {ss.lastModified && <span className="text-[#FBBF24]">已修改: {new Date(ss.lastModified).toLocaleString('zh-CN')}</span>}
                        </div>
                        {ss.changeHistory && ss.changeHistory.length > 0 && (
                          <button onClick={() => setExpandedSSId(exp ? null : ss.id)} className="mt-2 flex items-center gap-1 text-[10px] text-[#0F4C5C] hover:underline">
                            {exp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            查看备注变更历史 ({ss.changeHistory.length})
                          </button>
                        )}
                        {exp && ss.changeHistory && ss.changeHistory.length > 0 && (
                          <div className="mt-2 pl-3 border-l-2 border-[#FBBF24]/50 space-y-1">
                            {[...ss.changeHistory].reverse().map(ch => (
                              <div key={ch.id} className="text-[10px] font-mono">
                                <span className="text-red-500">"{ch.oldValue}"</span>
                                <span className="text-gray-400"> → </span>
                                <span className="text-green-600">"{ch.newValue}"</span>
                                <span className="text-gray-400 ml-2">by {ch.changedBy} @ {new Date(ch.changedAt).toLocaleString('zh-CN')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
