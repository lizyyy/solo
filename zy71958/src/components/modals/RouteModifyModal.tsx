import { useState, useMemo } from 'react';
import { X, Edit3, Check, MoveUp, MoveDown, RotateCcw } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { Coordinate } from '../../types';
import { cn } from '../../lib/utils';
import { formatDistance, calculateRouteLength } from '../../utils/geo';

type ModifyType = 'altitude' | 'shift' | 'scale';

export function RouteModifyModal() {
  const { activeModal, closeModal, currentUser, modalData } = useUiStore();
  const { getCurrentRouteVersion, modifyRoute, getSelectedRecord } = useRecordsStore();

  const record = getSelectedRecord();
  const recordId = modalData.recordId || record?.id;
  const currentRoute = recordId ? getCurrentRouteVersion(recordId) : undefined;

  const [modifyType, setModifyType] = useState<ModifyType>('altitude');
  const [altitudeDelta, setAltitudeDelta] = useState(10);
  const [shiftLat, setShiftLat] = useState(0);
  const [shiftLng, setShiftLng] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const previewCoords = useMemo(() => {
    if (!currentRoute) return [];
    const coords = [...currentRoute.routeData.coordinates];
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    return coords.map((coord, index) => {
      if (index < start || index > end) return coord;

      let newCoord = { ...coord };

      switch (modifyType) {
        case 'altitude':
          newCoord.alt = Math.max(0, Math.min(500, coord.alt + altitudeDelta));
          break;
        case 'shift':
          newCoord.lat = coord.lat + shiftLat * 0.0001;
          newCoord.lng = coord.lng + shiftLng * 0.0001;
          break;
      }

      return newCoord;
    });
  }, [currentRoute, modifyType, altitudeDelta, shiftLat, shiftLng, startIndex, endIndex]);

  const originalLength = currentRoute ? calculateRouteLength(currentRoute.routeData.coordinates) : 0;
  const previewLength = currentRoute ? calculateRouteLength(previewCoords) : 0;
  const lengthDiff = previewLength - originalLength;

  if (activeModal !== 'routeModify') return null;

  const handleSubmit = async () => {
    if (!recordId || !currentRoute) return;

    setLoading(true);
    try {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);

      await modifyRoute(
        recordId,
        (coords) =>
          coords.map((coord, index) => {
            if (index < start || index > end) return coord;

            let newCoord = { ...coord };

            switch (modifyType) {
              case 'altitude':
                newCoord.alt = Math.max(0, Math.min(500, coord.alt + altitudeDelta));
                break;
              case 'shift':
                newCoord.lat = coord.lat + shiftLat * 0.0001;
                newCoord.lng = coord.lng + shiftLng * 0.0001;
                break;
            }

            return newCoord;
          }),
        description || `航线修正 - ${modifyType === 'altitude' ? '高度调整' : '位置偏移'}`,
        currentUser
      );
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setModifyType('altitude');
    setAltitudeDelta(10);
    setShiftLat(0);
    setShiftLng(0);
    setStartIndex(0);
    setEndIndex(0);
    setDescription('');
    setSuccess(false);
    closeModal();
  };

  const applyPreset = (preset: 'avoid_nfz' | 'lower_alt' | 'raise_alt') => {
    switch (preset) {
      case 'avoid_nfz':
        setModifyType('shift');
        setShiftLat(20);
        setShiftLng(20);
        setDescription('东移北移避开禁飞区');
        break;
      case 'lower_alt':
        setModifyType('altitude');
        setAltitudeDelta(-20);
        setDescription('降低高度20米');
        break;
      case 'raise_alt':
        setModifyType('altitude');
        setAltitudeDelta(30);
        setDescription('升高高度30米');
        break;
    }
  };

  if (!currentRoute) {
    return null;
  }

  const maxIndex = currentRoute.routeData.coordinates.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-slate-200">修正航线</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-400 font-medium">航线已修正，版本已记录</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">当前航线</p>
                <p className="text-slate-200 font-medium">{currentRoute.routeData.name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>{currentRoute.routeData.coordinates.length} 个航点</span>
                  <span>原始航程: {formatDistance(originalLength)}</span>
                  <span className={cn(lengthDiff !== 0 && (lengthDiff > 0 ? 'text-green-400' : 'text-red-400'))}>
                    预估变化: {lengthDiff > 0 ? '+' : ''}{formatDistance(lengthDiff)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">快捷修正</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'avoid_nfz' as const, label: '避开禁飞区', desc: '东移+北移' },
                    { id: 'lower_alt' as const, label: '降低高度', desc: '-20米' },
                    { id: 'raise_alt' as const, label: '升高高度', desc: '+30米' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className="p-3 rounded-lg border border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/10 text-left transition-colors"
                    >
                      <p className="text-sm text-slate-200 font-medium">{preset.label}</p>
                      <p className="text-xs text-slate-500">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">修正类型</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setModifyType('altitude')}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors',
                      modifyType === 'altitude'
                        ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MoveUp className="w-4 h-4" />
                      <span className="text-sm font-medium">高度调整</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setModifyType('shift')}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors',
                      modifyType === 'shift'
                        ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700 hover:border-slate-600 text-slate-400'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MoveDown className="w-4 h-4 rotate-45" />
                      <span className="text-sm font-medium">位置偏移</span>
                    </div>
                  </button>
                </div>
              </div>

              {modifyType === 'altitude' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">高度变化 (米)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={altitudeDelta}
                      onChange={(e) => setAltitudeDelta(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      value={altitudeDelta}
                      onChange={(e) => setAltitudeDelta(parseInt(e.target.value) || 0)}
                      className="w-20 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-center focus:outline-none focus:border-orange-500/50"
                    />
                    <span className="text-xs text-slate-400">米</span>
                  </div>
                </div>
              )}

              {modifyType === 'shift' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">南北偏移 (×10米)</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShiftLat(shiftLat - 10)}
                        className="p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-slate-300"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={shiftLat}
                        onChange={(e) => setShiftLat(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-center focus:outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={() => setShiftLat(shiftLat + 10)}
                        className="p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-slate-300"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      {shiftLat > 0 ? `北移 ${shiftLat * 10}米` : shiftLat < 0 ? `南移 ${Math.abs(shiftLat) * 10}米` : '无偏移'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">东西偏移 (×10米)</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShiftLng(shiftLng - 10)}
                        className="p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-slate-300"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={shiftLng}
                        onChange={(e) => setShiftLng(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 text-center focus:outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={() => setShiftLng(shiftLng + 10)}
                        className="p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-slate-300"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      {shiftLng > 0 ? `东移 ${shiftLng * 10}米` : shiftLng < 0 ? `西移 ${Math.abs(shiftLng) * 10}米` : '无偏移'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">起始航点</label>
                  <input
                    type="range"
                    min="0"
                    max={maxIndex}
                    value={startIndex}
                    onChange={(e) => setStartIndex(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 mt-1">第 {startIndex + 1} 个航点</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">结束航点</label>
                  <input
                    type="range"
                    min="0"
                    max={maxIndex}
                    value={endIndex}
                    onChange={(e) => setEndIndex(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 mt-1">第 {endIndex + 1} 个航点</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">修改说明</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="简要说明此次修正的原因..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
                  />
                  <button
                    onClick={() => {
                      setStartIndex(0);
                      setEndIndex(maxIndex);
                    }}
                    className="absolute right-2 top-2 p-1 text-slate-500 hover:text-slate-400 transition-colors"
                    title="应用到全部航点"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-xs text-orange-400">
                  <span className="font-medium">注意：</span>
                  修正后系统会自动保存新版本，并记录到操作历史中。原始版本仍可在航线版本中查看和对比。
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            取消
          </button>
          {!success && (
            <button
              onClick={handleSubmit}
              disabled={loading || (startIndex === endIndex && modifyType !== 'altitude')}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  保存修正
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
