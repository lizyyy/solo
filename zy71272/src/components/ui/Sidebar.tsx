import { useState } from 'react';
import {
  Users,
  Mic,
  MapPin,
  Home,
  AlertCircle,
  Plus,
  Trash2,
  Volume2,
  Navigation,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  INSTRUMENT_LABELS,
  INSTRUMENT_COLORS,
  INSTRUMENT_ICONS,
  WALL_MATERIALS,
} from '../../utils/constants';
import {
  isObjectInvolvedInIssue,
  getIssueTypeLabel,
} from '../../utils/sceneDetection';
import {
  calculateMonitorVolumeRatios,
  roundTo,
} from '../../utils/helpers';
import { InstrumentType } from '../../types';

const TABS = [
  { id: 'musicians', label: '乐手', icon: Users },
  { id: 'microphones', label: '麦克风', icon: Mic },
  { id: 'monitors', label: '监听点', icon: MapPin },
  { id: 'room', label: '房间', icon: Home },
  { id: 'issues', label: '检测', icon: AlertCircle },
];

export default function Sidebar() {
  const uiState = useStore(state => state.uiState);
  const setActiveTab = useStore(state => state.setActiveTab);
  const musicians = useStore(state => state.musicians);
  const microphones = useStore(state => state.microphones);
  const monitorPoints = useStore(state => state.monitorPoints);
  const roomConfig = useStore(state => state.roomConfig);
  const sceneIssues = useStore(state => state.sceneIssues);
  const selectedObjectId = useStore(state => state.selectedObjectId);
  const selectedObjectType = useStore(state => state.selectedObjectType);
  const updateMusician = useStore(state => state.updateMusician);
  const addMusician = useStore(state => state.addMusician);
  const removeMusician = useStore(state => state.removeMusician);
  const updateMicrophone = useStore(state => state.updateMicrophone);
  const addMicrophone = useStore(state => state.addMicrophone);
  const removeMicrophone = useStore(state => state.removeMicrophone);
  const updateMonitorPoint = useStore(state => state.updateMonitorPoint);
  const addMonitorPoint = useStore(state => state.addMonitorPoint);
  const removeMonitorPoint = useStore(state => state.removeMonitorPoint);
  const updateRoomConfig = useStore(state => state.updateRoomConfig);
  const selectObject = useStore(state => state.selectObject);
  const focusOnIssue = useStore(state => state.focusOnIssue);

  const [newInstrumentType, setNewInstrumentType] = useState<InstrumentType>('guitar');

  if (!uiState.sidebarOpen || !roomConfig) return null;

  const selectedMusician = musicians.find(m => m.id === selectedObjectId && selectedObjectType === 'musician');
  const selectedMic = microphones.find(m => m.id === selectedObjectId && selectedObjectType === 'microphone');
  const selectedMonitor = monitorPoints.find(m => m.id === selectedObjectId && selectedObjectType === 'monitor');

  const activeTab = uiState.activeTab;

  const renderMusiciansTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[#00f0ff] font-bold">乐手站位 ({musicians.length})</h3>
        <div className="flex items-center gap-2">
          <select
            value={newInstrumentType}
            onChange={(e) => setNewInstrumentType(e.target.value as InstrumentType)}
            className="bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#00f0ff]"
          >
            {Object.entries(INSTRUMENT_LABELS).map(([type, label]) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => addMusician(newInstrumentType, INSTRUMENT_LABELS[newInstrumentType])}
            className="p-1.5 rounded bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {musicians.map(musician => {
          const issue = isObjectInvolvedInIssue(musician.id, sceneIssues);
          const isSelected = selectedMusician?.id === musician.id;

          return (
            <div
              key={musician.id}
              onClick={() => selectObject(musician.id, 'musician')}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-[#00f0ff]/20 border-[#00f0ff]'
                  : issue
                    ? 'bg-[#ff3366]/10 border-[#ff3366]/50 hover:bg-[#ff3366]/20'
                    : 'bg-[#0a0e17]/50 border-[#3a4a6b] hover:bg-[#1a2535] hover:border-[#00f0ff]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{INSTRUMENT_ICONS[musician.type]}</span>
                  <div>
                    <div className="font-medium text-white" style={{ color: musician.color }}>
                      {musician.name}
                    </div>
                    <div className="text-xs text-[#8899aa]">
                      {INSTRUMENT_LABELS[musician.type]}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff]">
                    {musician.sourceLevel} dB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMusician(musician.id); }}
                    className="p-1 rounded text-[#ff3366] hover:bg-[#ff3366]/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {issue && (
                <div className="mt-2 text-xs text-[#ff3366] flex items-center gap-1">
                  <AlertCircle size={12} />
                  {getIssueTypeLabel(issue.type)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedMusician && (
        <div className="p-4 bg-[#0a0e17]/70 rounded-lg border border-[#00f0ff]/30">
          <h4 className="text-[#00f0ff] font-bold mb-3 flex items-center gap-2">
            <span className="text-xl">{INSTRUMENT_ICONS[selectedMusician.type]}</span>
            {selectedMusician.name} 参数
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8899aa] mb-1">名称</label>
              <input
                type="text"
                value={selectedMusician.name}
                onChange={(e) => updateMusician(selectedMusician.id, { name: e.target.value })}
                className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8899aa] mb-1 flex items-center gap-1">
                <Volume2 size={12} /> 声源强度 (dB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="70"
                  max="120"
                  value={selectedMusician.sourceLevel}
                  onChange={(e) => updateMusician(selectedMusician.id, { sourceLevel: Number(e.target.value) })}
                  className="flex-1 accent-[#00f0ff]"
                />
                <span className="text-[#00f0ff] font-mono text-sm w-12 text-right">
                  {selectedMusician.sourceLevel}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#8899aa] mb-1 flex items-center gap-1">
                <Navigation size={12} /> 指向性
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedMusician.directivity}
                  onChange={(e) => updateMusician(selectedMusician.id, { directivity: Number(e.target.value) })}
                  className="flex-1 accent-[#ff6b35]"
                />
                <span className="text-[#ff6b35] font-mono text-sm w-12 text-right">
                  {selectedMusician.directivity.toFixed(1)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#8899aa] mb-1">朝向角度 (°)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={Math.round(selectedMusician.rotation * 180 / Math.PI)}
                  onChange={(e) => updateMusician(selectedMusician.id, { rotation: Number(e.target.value) * Math.PI / 180 })}
                  className="flex-1 accent-[#ff3366]"
                />
                <span className="text-[#ff3366] font-mono text-sm w-12 text-right">
                  {Math.round(selectedMusician.rotation * 180 / Math.PI)}°
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">X</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMusician.position.x, 1)}
                  onChange={(e) => updateMusician(selectedMusician.id, {
                    position: { ...selectedMusician.position, x: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">Y</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMusician.position.y, 1)}
                  onChange={(e) => updateMusician(selectedMusician.id, {
                    position: { ...selectedMusician.position, y: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">Z</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMusician.position.z, 1)}
                  onChange={(e) => updateMusician(selectedMusician.id, {
                    position: { ...selectedMusician.position, z: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {monitorPoints.length > 0 && selectedMusician && (
        <div className="p-4 bg-[#0a0e17]/50 rounded-lg border border-[#ff6b35]/30">
          <h4 className="text-[#ff6b35] font-bold mb-3 text-sm">监听点音量比例</h4>
          {monitorPoints.map(monitor => {
            const ratios = calculateMonitorVolumeRatios(musicians, monitor.position);
            const myRatio = ratios.find(r => r.musician.id === selectedMusician.id)?.ratio || 0;

            return (
              <div key={monitor.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8899aa]">{monitor.name}</span>
                  <span className={myRatio > 0.6 || myRatio < 0.1 ? 'text-[#ff3366]' : 'text-[#00ff88]'}>
                    {roundTo(myRatio * 100, 1)}%
                  </span>
                </div>
                <div className="h-2 bg-[#0a0e17] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, myRatio * 100)}%`,
                      backgroundColor: myRatio > 0.6 || myRatio < 0.1 ? '#ff3366' : selectedMusician.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMicrophonesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[#00f0ff] font-bold">麦克风 ({microphones.length})</h3>
        <button
          onClick={() => addMicrophone(`麦克风 ${microphones.length + 1}`)}
          className="p-1.5 rounded bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {microphones.map(mic => {
          const isSelected = selectedMic?.id === mic.id;

          return (
            <div
              key={mic.id}
              onClick={() => selectObject(mic.id, 'microphone')}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-[#00f0ff]/20 border-[#00f0ff]'
                  : 'bg-[#0a0e17]/50 border-[#3a4a6b] hover:bg-[#1a2535] hover:border-[#00f0ff]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-[#00f0ff]" />
                  <span className="font-medium text-white">{mic.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMicrophone(mic.id); }}
                  className="p-1 rounded text-[#ff3366] hover:bg-[#ff3366]/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {microphones.length === 0 && (
          <div className="text-center py-8 text-[#8899aa] text-sm">
            暂无麦克风配置<br />
            点击 + 添加麦克风
          </div>
        )}
      </div>

      {selectedMic && (
        <div className="p-4 bg-[#0a0e17]/70 rounded-lg border border-[#00f0ff]/30">
          <h4 className="text-[#00f0ff] font-bold mb-3">{selectedMic.name} 参数</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8899aa] mb-1">名称</label>
              <input
                type="text"
                value={selectedMic.name}
                onChange={(e) => updateMicrophone(selectedMic.id, { name: e.target.value })}
                className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8899aa] mb-1">类型</label>
              <select
                value={selectedMic.type}
                onChange={(e) => updateMicrophone(selectedMic.id, { type: e.target.value as any })}
                className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
              >
                <option value="dynamic">动圈麦克风</option>
                <option value="condenser">电容麦克风</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8899aa] mb-1">增益 (dB)</label>
              <input
                type="range"
                min="-20"
                max="20"
                value={selectedMic.gain}
                onChange={(e) => updateMicrophone(selectedMic.id, { gain: Number(e.target.value) })}
                className="w-full accent-[#00f0ff]"
              />
              <div className="text-right text-[#00f0ff] text-sm font-mono">{selectedMic.gain} dB</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMonitorsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[#00f0ff] font-bold">监听点 ({monitorPoints.length})</h3>
        <button
          onClick={() => addMonitorPoint(`监听点 ${monitorPoints.length + 1}`, { x: 0, y: 1.5, z: 3 })}
          className={`p-1.5 rounded transition-colors ${
            monitorPoints.length === 0
              ? 'bg-[#ff6b35]/20 text-[#ff6b35] hover:bg-[#ff6b35]/30 animate-pulse'
              : 'bg-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/30'
          }`}
        >
          <Plus size={16} />
        </button>
      </div>

      {monitorPoints.length === 0 && (
        <div className="p-4 bg-[#ff6b35]/10 border border-[#ff6b35]/30 rounded-lg">
          <div className="flex items-center gap-2 text-[#ff6b35] text-sm mb-2">
            <AlertCircle size={16} />
            <span className="font-medium">未配置监听点</span>
          </div>
          <p className="text-xs text-[#8899aa]">
            建议在听音位置添加至少一个监听点，用于评估混音效果和音量平衡。
          </p>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {monitorPoints.map(monitor => {
          const issue = isObjectInvolvedInIssue(monitor.id, sceneIssues);
          const isSelected = selectedMonitor?.id === monitor.id;

          return (
            <div
              key={monitor.id}
              onClick={() => selectObject(monitor.id, 'monitor')}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-[#00ff88]/20 border-[#00ff88]'
                  : issue
                    ? 'bg-[#ff6b35]/10 border-[#ff6b35]/50 hover:bg-[#ff6b35]/20'
                    : 'bg-[#0a0e17]/50 border-[#3a4a6b] hover:bg-[#1a2535] hover:border-[#00ff88]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className={issue ? 'text-[#ff6b35]' : 'text-[#00ff88]'} />
                  <span className="font-medium text-white">{monitor.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMonitorPoint(monitor.id); }}
                  className="p-1 rounded text-[#ff3366] hover:bg-[#ff3366]/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {issue && (
                <div className="mt-2 text-xs text-[#ff6b35] flex items-center gap-1">
                  <AlertCircle size={12} />
                  {issue.message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedMonitor && (
        <div className="p-4 bg-[#0a0e17]/70 rounded-lg border border-[#00ff88]/30">
          <h4 className="text-[#00ff88] font-bold mb-3">{selectedMonitor.name} 参数</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8899aa] mb-1">名称</label>
              <input
                type="text"
                value={selectedMonitor.name}
                onChange={(e) => updateMonitorPoint(selectedMonitor.id, { name: e.target.value })}
                className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">X</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMonitor.position.x, 1)}
                  onChange={(e) => updateMonitorPoint(selectedMonitor.id, {
                    position: { ...selectedMonitor.position, x: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00ff88]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">Y</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMonitor.position.y, 1)}
                  onChange={(e) => updateMonitorPoint(selectedMonitor.id, {
                    position: { ...selectedMonitor.position, y: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00ff88]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8899aa] mb-1">Z</label>
                <input
                  type="number"
                  step="0.1"
                  value={roundTo(selectedMonitor.position.z, 1)}
                  onChange={(e) => updateMonitorPoint(selectedMonitor.id, {
                    position: { ...selectedMonitor.position, z: Number(e.target.value) }
                  })}
                  className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-[#00ff88]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {monitorPoints.length > 0 && (
        <div className="p-4 bg-[#0a0e17]/50 rounded-lg border border-[#00ff88]/30">
          <h4 className="text-[#00ff88] font-bold mb-3 text-sm">各监听点音量比例</h4>
          {monitorPoints.map(monitor => {
            const ratios = calculateMonitorVolumeRatios(musicians, monitor.position);
            return (
              <div key={monitor.id} className="mb-4 last:mb-0">
                <div className="text-xs text-[#8899aa] mb-2 font-medium">{monitor.name}</div>
                <div className="space-y-2">
                  {ratios.map(({ musician, ratio }) => (
                    <div key={musician.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: musician.color }}>{musician.name}</span>
                        <span className={ratio > 0.6 || ratio < 0.1 ? 'text-[#ff3366]' : 'text-[#8899aa]'}>
                          {roundTo(ratio * 100, 1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#0a0e17] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, ratio * 100)}%`,
                            backgroundColor: ratio > 0.6 || ratio < 0.1 ? '#ff3366' : musician.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRoomTab = () => (
    <div className="space-y-4">
      <h3 className="text-[#00f0ff] font-bold">房间配置</h3>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#8899aa] mb-1">宽度 (m)</label>
            <input
              type="number"
              min="3"
              max="30"
              step="0.5"
              value={roomConfig.width}
              onChange={(e) => updateRoomConfig({ width: Number(e.target.value) })}
              className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8899aa] mb-1">高度 (m)</label>
            <input
              type="number"
              min="2"
              max="10"
              step="0.1"
              value={roomConfig.height}
              onChange={(e) => updateRoomConfig({ height: Number(e.target.value) })}
              className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8899aa] mb-1">长度 (m)</label>
            <input
              type="number"
              min="3"
              max="30"
              step="0.5"
              value={roomConfig.length}
              onChange={(e) => updateRoomConfig({ length: Number(e.target.value)})}
              className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#8899aa] mb-1">墙面材质</label>
          <select
            value={roomConfig.wallMaterial}
            onChange={(e) => {
              const material = WALL_MATERIALS.find(m => m.value === e.target.value);
              updateRoomConfig({
                wallMaterial: e.target.value,
                reverbTime: material?.reverb || 1.0,
              });
            }}
            className="w-full bg-[#0a0e17] border border-[#3a4a6b] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00f0ff]"
          >
            {WALL_MATERIALS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8899aa] mb-1">
            混响时间 (s): {roomConfig.reverbTime.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={roomConfig.reverbTime}
            onChange={(e) => updateRoomConfig({ reverbTime: Number(e.target.value) })}
            className="w-full accent-[#00f0ff]"
          />
        </div>

        <div>
          <label className="block text-xs text-[#8899aa] mb-1">
            环境噪声 (dB): {roomConfig.ambientNoise}
          </label>
          <input
            type="range"
            min="20"
            max="60"
            value={roomConfig.ambientNoise}
            onChange={(e) => updateRoomConfig({ ambientNoise: Number(e.target.value) })}
            className="w-full accent-[#ff6b35]"
          />
        </div>
      </div>

      <div className="p-4 bg-[#0a0e17]/50 rounded-lg border border-[#3a4a6b]">
        <h4 className="text-[#8899aa] font-bold mb-2 text-sm">房间信息</h4>
        <div className="text-xs text-[#8899aa] space-y-1">
          <div className="flex justify-between">
            <span>容积:</span>
            <span className="text-white font-mono">
              {roundTo(roomConfig.width * roomConfig.height * roomConfig.length, 1)} m³
            </span>
          </div>
          <div className="flex justify-between">
            <span>地面面积:</span>
            <span className="text-white font-mono">
              {roundTo(roomConfig.width * roomConfig.length, 1)} m²
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIssuesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[#00f0ff] font-bold">场景检测</h3>
        <span className={`text-sm px-2 py-1 rounded ${
          sceneIssues.length > 0 ? 'bg-[#ff3366]/20 text-[#ff3366]' : 'bg-[#00ff88]/20 text-[#00ff88]'
        }`}>
          {sceneIssues.length} 个问题
        </span>
      </div>

      {sceneIssues.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">✨</div>
          <div className="text-[#00ff88] font-medium mb-2">一切正常</div>
          <div className="text-xs text-[#8899aa]">
            当前站位和声场配置良好<br />未检测到明显问题
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {sceneIssues.map(issue => (
            <div
              key={issue.id}
              onClick={() => focusOnIssue(issue)}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                issue.severity === 'error'
                  ? 'bg-[#ff3366]/10 border-[#ff3366]/50 hover:bg-[#ff3366]/20'
                  : 'bg-[#ff6b35]/10 border-[#ff6b35]/50 hover:bg-[#ff6b35]/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  issue.severity === 'error' ? 'bg-[#ff3366]/30' : 'bg-[#ff6b35]/30'
                }`}>
                  <AlertCircle size={18} className={issue.severity === 'error' ? 'text-[#ff3366]' : 'text-[#ff6b35]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      issue.severity === 'error'
                        ? 'bg-[#ff3366]/20 text-[#ff3366]'
                        : 'bg-[#ff6b35]/20 text-[#ff6b35]'
                    }`}>
                      {getIssueTypeLabel(issue.type)}
                    </span>
                    <span className={`text-xs ${
                      issue.severity === 'error' ? 'text-[#ff3366]' : 'text-[#ff6b35]'
                    }`}>
                      {issue.severity === 'error' ? '错误' : '警告'}
                    </span>
                  </div>
                  <p className="text-sm text-white mb-2">{issue.message}</p>
                  {issue.details.suggestion && (
                    <p className="text-xs text-[#8899aa]">
                      💡 {issue.details.suggestion}
                    </p>
                  )}
                  {issue.details.distance !== undefined && (
                    <p className="text-xs text-[#8899aa] mt-1">
                      距离: {issue.details.distance}m (阈值: {issue.details.threshold}m)
                    </p>
                  )}
                  {issue.details.ratio !== undefined && (
                    <p className="text-xs text-[#8899aa] mt-1">
                      当前比例: {issue.details.ratio}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-[#0a0e17]/50 rounded-lg border border-[#3a4a6b]">
        <h4 className="text-xs text-[#8899aa] font-bold mb-2">检测规则</h4>
        <ul className="text-xs text-[#8899aa] space-y-1">
          <li>• 乐手间距 &lt; 0.5m 触发重叠警告</li>
          <li>• 监听点声压级 &lt; 60dB 触发位置警告</li>
          <li>• 单乐器音量占比 &gt; 60% 或 &lt; 10% 触发比例警告</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="fixed left-0 top-16 bottom-0 w-80 bg-[#121a29]/95 backdrop-blur-xl border-r border-[#00f0ff]/30 z-40 flex flex-col">
      <div className="flex border-b border-[#3a4a6b]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const hasIssues = tab.id === 'issues' && sceneIssues.length > 0;
          const needsAttention = tab.id === 'monitors' && monitorPoints.length === 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 transition-all duration-200 relative ${
                activeTab === tab.id
                  ? 'text-[#00f0ff] bg-[#00f0ff]/10 border-b-2 border-[#00f0ff]'
                  : needsAttention
                    ? 'text-[#ff6b35]'
                    : 'text-[#8899aa] hover:text-white hover:bg-[#1a2535]'
              }`}
            >
              <Icon size={18} className={needsAttention ? 'animate-pulse' : ''} />
              <span className="text-xs">{tab.label}</span>
              {hasIssues && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff3366] rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'musicians' && renderMusiciansTab()}
        {activeTab === 'microphones' && renderMicrophonesTab()}
        {activeTab === 'monitors' && renderMonitorsTab()}
        {activeTab === 'room' && renderRoomTab()}
        {activeTab === 'issues' && renderIssuesTab()}
      </div>
    </div>
  );
}
