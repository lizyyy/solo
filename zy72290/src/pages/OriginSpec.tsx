import { MapPin, FileText, Plus, ChevronRight, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function OriginSpec() {
  const navigate = useNavigate();
  const {
    originSpecs,
    selectedRecordId,
    pointRecords,
    selectRecord,
    getSelectedRecord,
    supplementMissingRow,
    stepStatus,
    setStep,
  } = useAppStore();

  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [supplementX, setSupplementX] = useState('');
  const [supplementY, setSupplementY] = useState('');
  const [selectedSource, setSelectedSource] = useState('');

  const selectedRecord = getSelectedRecord();

  useEffect(() => {
    if (selectedRecordId) {
      setStep(2);
    }
  }, [selectedRecordId, setStep]);

  const getMissingRowNumbers = (record: typeof selectedRecord) => {
    if (!record) return [];
    const existingRows = record.coordinates.map(c => c.rowIndex);
    const missing: number[] = [];
    for (let i = 1; i <= record.photoPointCount; i++) {
      if (!existingRows.includes(i)) {
        missing.push(i);
      }
    }
    return missing;
  };

  const handleSupplement = () => {
    if (!selectedRecordId || !supplementX || !supplementY || !selectedSource) return;
    supplementMissingRow(selectedRecordId, parseFloat(supplementX), parseFloat(supplementY), selectedSource);
    setShowSupplementForm(false);
    setSupplementX('');
    setSupplementY('');
    setSelectedSource('');
  };

  const canSupplement = selectedRecord &&
    selectedRecord.status === 'pending_review' &&
    getMissingRowNumbers(selectedRecord).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">坐标原点说明</h2>
        <p className="text-slate-500 mt-1">第二步：查看坐标原点定义，补录旧口径缺失数据</p>
      </div>

      {selectedRecordId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">当前点位：</span>
              <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg font-medium">
                {selectedRecord?.pointCode}
              </span>
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full',
                selectedRecord?.status === 'normal' && 'bg-emerald-100 text-emerald-700',
                selectedRecord?.status === 'pending_review' && 'bg-amber-100 text-amber-700',
                selectedRecord?.status === 'supplemented' && 'bg-sky-100 text-sky-700'
              )}>
                {selectedRecord?.status === 'normal' && '✓ 正常'}
                {selectedRecord?.status === 'pending_review' && '⚠ 待复核'}
                {selectedRecord?.status === 'supplemented' && '↻ 已补录'}
              </span>
            </div>
            <select
              value={selectedRecordId}
              onChange={(e) => selectRecord(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
            >
              {pointRecords.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.pointCode}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!selectedRecordId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={18} />
            <span className="text-sm text-amber-700">请先在安全半径表页面选择一条点位记录</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {originSpecs.map((spec) => (
          <div key={spec.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <MapPin className="text-sky-500" size={20} />
              <div>
                <h3 className="text-base font-semibold text-slate-800">{spec.originCode}</h3>
                <p className="text-xs text-slate-500">{spec.referenceSystem}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">原点 X 坐标</p>
                  <p className="text-lg font-bold text-slate-700 mt-1">{spec.originX.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">原点 Y 坐标</p>
                  <p className="text-lg font-bold text-slate-700 mt-1">{spec.originY.toFixed(2)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">测量日期</p>
                <p className="text-sm font-medium text-slate-700 mt-1">{spec.measureDate}</p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2">
                  <FileText className="text-slate-400 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-slate-600">{spec.note}</p>
                </div>
              </div>
              {canSupplement && spec.originCode === 'HD-OLD' && (
                <button
                  onClick={() => {
                    setShowSupplementForm(true);
                    setSelectedSource(spec.originCode + '-' + spec.note.split('，')[0]);
                    setSupplementX(spec.originX.toString());
                    setSupplementY(spec.originY.toString());
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
                >
                  <Plus size={16} /> 从该基准补录数据
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showSupplementForm && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-6">
          <h4 className="text-base font-semibold text-slate-800 mb-4">补录旧口径数据</h4>
          <p className="text-sm text-slate-600 mb-4">
            参考坐标原点说明中的旧测量基准，补录缺失的第 {getMissingRowNumbers(selectedRecord).join('、')} 行坐标数据
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">X 坐标</label>
              <input
                type="number"
                step="0.1"
                value={supplementX}
                onChange={(e) => setSupplementX(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="输入 X 坐标"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Y 坐标</label>
              <input
                type="number"
                step="0.1"
                value={supplementY}
                onChange={(e) => setSupplementY(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="输入 Y 坐标"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">数据来源</label>
              <div className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-600">
                {selectedSource}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSupplement}
              className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
            >
              确认补录
            </button>
            <button
              onClick={() => setShowSupplementForm(false)}
              className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {selectedRecord && selectedRecord.coordinates.some(c => c.isSupplemented) && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="text-sky-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-sky-800">已补录数据</p>
              {selectedRecord.coordinates.filter(c => c.isSupplemented).map((c) => (
                <p key={c.id} className="text-sm text-sky-600 mt-1">
                  第 {c.rowIndex} 行：坐标 ({c.x.toFixed(1)}, {c.y.toFixed(1)})，来源：{c.supplementSource}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedRecord && selectedRecord.status === 'pending_review' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-amber-800">照片有点位但坐标表缺一行</p>
              <p className="text-sm text-amber-600 mt-1">
                第 {getMissingRowNumbers(selectedRecord).join('、')} 行数据缺失。可从上方 HD-OLD 旧基准补录，
                或者保留待复核状态，留给安全员处理。
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && selectedRecord.status === 'normal' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-emerald-800">数据完整</p>
              <p className="text-sm text-emerald-600 mt-1">该点位记录数据完整，无需补录，可直接进入下一步。</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/obstruction')}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          下一步：更新遮挡点清单 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
