import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, GitCompare, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { ConflictBadge } from '@/components/ConflictBadge';
import { VersionSelector } from '@/components/VersionSelector';
import type { Channel, Monitor, ChangeDiff } from '@/types';
import { ChannelType, MonitorPosition, RequirementStatus } from '@/types';
import {
  getChannelTypeLabel,
  getMonitorPositionLabel,
  generateId
} from '@/utils/helpers';

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname === '/requirement/new';

  const {
    requirements,
    versions,
    getRequirementById,
    addRequirement,
    updateRequirement,
    resolveConflict,
    getVersionsForRequirement,
    compareVersions
  } = useAppStore();

  const existingReq = id ? getRequirementById(id) : null;

  const [bandName, setBandName] = useState(existingReq?.bandName || '');
  const [performanceDate, setPerformanceDate] = useState(existingReq?.performanceDate || '');
  const [startTime, setStartTime] = useState(existingReq?.startTime || '19:00');
  const [endTime, setEndTime] = useState(existingReq?.endTime || '20:00');
  const [changeOverTime, setChangeOverTime] = useState(existingReq?.changeOverTime || 20);
  const [channels, setChannels] = useState<Channel[]>(existingReq?.channels || []);
  const [monitors, setMonitors] = useState<Monitor[]>(existingReq?.monitors || []);
  const [stageNotes, setStageNotes] = useState(existingReq?.stageNotes || '');
  const [changeReason, setChangeReason] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareResult, setCompareResult] = useState<ChangeDiff | null>(null);

  const reqVersions = id ? getVersionsForRequirement(id) : [];

  useEffect(() => {
    if (existingReq && selectedVersion !== null) {
      const versionRecord = versions.find(
        (v) => v.requirementId === id && v.versionNumber === selectedVersion
      );
      if (versionRecord) {
        setBandName(versionRecord.snapshot.bandName);
        setPerformanceDate(versionRecord.snapshot.performanceDate);
        setStartTime(versionRecord.snapshot.startTime);
        setEndTime(versionRecord.snapshot.endTime);
        setChangeOverTime(versionRecord.snapshot.changeOverTime);
        setChannels(versionRecord.snapshot.channels);
        setMonitors(versionRecord.snapshot.monitors);
        setStageNotes(versionRecord.snapshot.stageNotes);
      }
    } else if (existingReq) {
      setBandName(existingReq.bandName);
      setPerformanceDate(existingReq.performanceDate);
      setStartTime(existingReq.startTime);
      setEndTime(existingReq.endTime);
      setChangeOverTime(existingReq.changeOverTime);
      setChannels(existingReq.channels);
      setMonitors(existingReq.monitors);
      setStageNotes(existingReq.stageNotes);
    }
  }, [existingReq, selectedVersion, id, versions]);

  const handleAddChannel = () => {
    const newChannel: Channel = {
      id: generateId(),
      name: '',
      type: 'other',
      assignedTo: id || 'new',
      order: channels.length + 1
    };
    setChannels([...channels, newChannel]);
  };

  const handleUpdateChannel = (index: number, updates: Partial<Channel>) => {
    const updated = [...channels];
    updated[index] = { ...updated[index], ...updates };
    setChannels(updated);
  };

  const handleRemoveChannel = (index: number) => {
    const updated = channels.filter((_, i) => i !== index);
    setChannels(updated.map((ch, i) => ({ ...ch, order: i + 1 })));
  };

  const handleAddMonitor = () => {
    const newMonitor: Monitor = {
      id: generateId(),
      name: `返听 ${monitors.length + 1}`,
      position: 'stage_center',
      mix: {}
    };
    setMonitors([...monitors, newMonitor]);
  };

  const handleUpdateMonitor = (index: number, updates: Partial<Monitor>) => {
    const updated = [...monitors];
    updated[index] = { ...updated[index], ...updates };
    setMonitors(updated);
  };

  const handleRemoveMonitor = (index: number) => {
    const updated = monitors.filter((_, i) => i !== index);
    setMonitors(updated);
  };

  const handleSave = () => {
    if (!bandName.trim() || !performanceDate) {
      alert('请填写乐队名称和演出日期');
      return;
    }

    const reqData = {
      bandName: bandName.trim(),
      performanceDate,
      startTime,
      endTime,
      changeOverTime,
      channels,
      monitors,
      stageNotes
    };

    if (isNew) {
      addRequirement(reqData);
      navigate('/');
    } else if (id && existingReq) {
      updateRequirement(id, reqData, changeReason || '');
      setChangeReason('');
      alert('保存成功，已生成新版本');
    }
  };

  const handleCompare = (v1: number, v2: number) => {
    const version1 = versions.find(
      (v) => v.requirementId === id && v.versionNumber === v1
    );
    const version2 = versions.find(
      (v) => v.requirementId === id && v.versionNumber === v2
    );
    if (version1 && version2) {
      const diff = compareVersions(version1.snapshot, version2.snapshot);
      setCompareResult(diff);
      setShowCompare(true);
    }
  };

  const handleRestoreVersion = () => {
    if (selectedVersion !== null && existingReq) {
      const versionRecord = versions.find(
        (v) => v.requirementId === id && v.versionNumber === selectedVersion
      );
      if (versionRecord) {
        if (confirm(`确定要恢复到版本 v${selectedVersion} 吗？这将创建一个新版本。`)) {
          updateRequirement(
            existingReq.id,
            {
              bandName: versionRecord.snapshot.bandName,
              performanceDate: versionRecord.snapshot.performanceDate,
              startTime: versionRecord.snapshot.startTime,
              endTime: versionRecord.snapshot.endTime,
              changeOverTime: versionRecord.snapshot.changeOverTime,
              channels: versionRecord.snapshot.channels,
              monitors: versionRecord.snapshot.monitors,
              stageNotes: versionRecord.snapshot.stageNotes
            },
            `恢复到版本 v${selectedVersion}`
          );
          setSelectedVersion(null);
        }
      }
    }
  };

  const currentReq = existingReq || {
    conflicts: [],
    status: RequirementStatus.NORMAL,
    currentVersion: 1
  };

  const channelTypes: ChannelType[] = ['vocals', 'guitar', 'bass', 'drums', 'keys', 'other'];
  const monitorPositions: MonitorPosition[] = [
    'stage_left',
    'stage_center',
    'stage_right',
    'drummer'
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-base-800 text-base-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold uppercase tracking-wider">
              {isNew ? '新建需求' : bandName || '需求详情'}
            </h1>
            {!isNew && existingReq && (
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={currentReq.status} />
                <span className="text-sm font-mono text-base-500">
                  v{currentReq.currentVersion}
                </span>
                {selectedVersion !== null && (
                  <span className="text-sm font-mono text-neon-purple">
                    正在查看 v{selectedVersion}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedVersion !== null && (
            <button
              onClick={handleRestoreVersion}
              className="btn btn-warning flex items-center gap-1 text-xs"
            >
              <RotateCcw className="w-3 h-3" />
              恢复此版本
            </button>
          )}
          <button
            onClick={handleSave}
            className="btn btn-primary flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            {isNew ? '创建' : '保存修改'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel">
            <div className="panel-header">基本信息</div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    乐队名称 *
                  </label>
                  <input
                    type="text"
                    value={bandName}
                    onChange={(e) => setBandName(e.target.value)}
                    placeholder="输入乐队名称"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    演出日期 *
                  </label>
                  <input
                    type="date"
                    value={performanceDate}
                    onChange={(e) => setPerformanceDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    开始时间
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    结束时间
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    换场时间（分钟）
                  </label>
                  <input
                    type="number"
                    value={changeOverTime}
                    onChange={(e) => setChangeOverTime(parseInt(e.target.value) || 0)}
                    min="0"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-base-500 mb-1">
                  舞台备注
                </label>
                <textarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  placeholder="输入舞台备注信息..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {!isNew && (
                <div>
                  <label className="block text-xs font-mono text-base-500 mb-1">
                    修改说明（保存时生成新版本）
                  </label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="简要说明本次修改内容..."
                    className="input-field"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <span>通道配置 ({channels.length})</span>
              <button
                onClick={handleAddChannel}
                className="btn btn-success text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加通道
              </button>
            </div>
            <div className="p-4">
              {channels.length === 0 ? (
                <div className="text-center py-8 text-base-500 font-mono text-sm">
                  暂无通道配置，点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-3">
                  {channels.map((channel, index) => (
                    <div
                      key={channel.id}
                      className="grid grid-cols-12 gap-3 items-center p-3 bg-base-900 border border-base-700"
                    >
                      <div className="col-span-1 text-center font-mono text-base-500">
                        {channel.order}
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={channel.name}
                          onChange={(e) =>
                            handleUpdateChannel(index, { name: e.target.value })
                          }
                          placeholder="通道名称"
                          className="input-field text-sm py-1"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={channel.type}
                          onChange={(e) =>
                            handleUpdateChannel(index, {
                              type: e.target.value as ChannelType
                            })
                          }
                          className="input-field text-sm py-1"
                        >
                          {channelTypes.map((type) => (
                            <option key={type} value={type}>
                              {getChannelTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={channel.assignedTo}
                          onChange={(e) =>
                            handleUpdateChannel(index, { assignedTo: e.target.value })
                          }
                          placeholder="分配给"
                          className="input-field text-sm py-1"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => handleRemoveChannel(index)}
                          className="p-1 text-base-500 hover:text-neon-red transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <span>返听配置 ({monitors.length})</span>
              <button
                onClick={handleAddMonitor}
                className="btn btn-success text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                添加返听
              </button>
            </div>
            <div className="p-4">
              {monitors.length === 0 ? (
                <div className="text-center py-8 text-base-500 font-mono text-sm">
                  暂无返听配置，点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-3">
                  {monitors.map((monitor, index) => (
                    <div
                      key={monitor.id}
                      className="p-3 bg-base-900 border border-base-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold">#{index + 1}</span>
                          <input
                            type="text"
                            value={monitor.name}
                            onChange={(e) =>
                              handleUpdateMonitor(index, { name: e.target.value })
                            }
                            placeholder="返听名称"
                            className="input-field text-sm py-1 w-40"
                          />
                          <select
                            value={monitor.position}
                            onChange={(e) =>
                              handleUpdateMonitor(index, {
                                position: e.target.value as MonitorPosition
                              })
                            }
                            className="input-field text-sm py-1 w-32"
                          >
                            {monitorPositions.map((pos) => (
                              <option key={pos} value={pos}>
                                {getMonitorPositionLabel(pos)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleRemoveMonitor(index)}
                          className="p-1 text-base-500 hover:text-neon-red transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {channels.slice(0, 8).map((ch) => (
                          <label
                            key={ch.id}
                            className="flex items-center gap-1 text-xs font-mono"
                          >
                            <input
                              type="checkbox"
                              checked={monitor.mix[ch.id] !== undefined}
                              onChange={(e) => {
                                const newMix = { ...monitor.mix };
                                if (e.target.checked) {
                                  newMix[ch.id] = 70;
                                } else {
                                  delete newMix[ch.id];
                                }
                                handleUpdateMonitor(index, { mix: newMix });
                              }}
                              className="mr-1"
                            />
                            <span className="text-base-400">{ch.name || `CH${ch.order}`}</span>
                            {monitor.mix[ch.id] !== undefined && (
                              <input
                                type="number"
                                value={monitor.mix[ch.id]}
                                onChange={(e) => {
                                  const newMix = {
                                    ...monitor.mix,
                                    [ch.id]: parseInt(e.target.value) || 0
                                  };
                                  handleUpdateMonitor(index, { mix: newMix });
                                }}
                                min="0"
                                max="100"
                                className="w-14 px-1 py-0.5 bg-base-800 border border-base-600 text-xs"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!isNew && existingReq && (
            <div className="panel">
              <div className="panel-header">
                冲突检测结果 ({currentReq.conflicts.filter((c) => !c.resolved).length})
              </div>
              <div className="p-4">
                {currentReq.conflicts.length === 0 ? (
                  <div className="text-center py-8 text-base-500 font-mono text-sm">
                    暂无冲突
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentReq.conflicts.map((conflict) => (
                      <ConflictBadge
                        key={conflict.id}
                        conflict={conflict}
                        onResolve={() => id && resolveConflict(id, conflict.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!isNew && (
            <div className="panel">
              <div className="panel-header flex items-center justify-between">
                <span>版本历史</span>
                <button
                  onClick={() => setShowCompare(true)}
                  className="text-xs font-mono text-neon-purple hover:text-white flex items-center gap-1"
                >
                  <GitCompare className="w-3 h-3" />
                  版本对比
                </button>
              </div>
              <div className="p-4">
                <VersionSelector
                  versions={reqVersions}
                  selectedVersion={selectedVersion}
                  onSelectVersion={setSelectedVersion}
                  onCompare={handleCompare}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showCompare && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-8">
          <div className="panel w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="panel-header flex items-center justify-between sticky top-0 bg-base-800">
              <span>版本对比</span>
              <button
                onClick={() => {
                  setShowCompare(false);
                  setCompareResult(null);
                }}
                className="text-xs font-mono text-base-500 hover:text-white"
              >
                关闭
              </button>
            </div>
            <div className="p-4">
              {compareResult && (
                <div className="space-y-6">
                  {compareResult.channels.added.length > 0 && (
                    <div>
                      <h4 className="font-display font-bold text-neon-green mb-2">
                        新增通道 ({compareResult.channels.added.length})
                      </h4>
                      <div className="space-y-1">
                        {compareResult.channels.added.map((ch) => (
                          <div
                            key={ch.id}
                            className="p-2 bg-neon-green bg-opacity-10 border border-neon-green text-sm"
                          >
                            {ch.name} ({getChannelTypeLabel(ch.type)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {compareResult.channels.removed.length > 0 && (
                    <div>
                      <h4 className="font-display font-bold text-neon-red mb-2">
                        删除通道 ({compareResult.channels.removed.length})
                      </h4>
                      <div className="space-y-1">
                        {compareResult.channels.removed.map((ch) => (
                          <div
                            key={ch.id}
                            className="p-2 bg-neon-red bg-opacity-10 border border-neon-red text-sm line-through"
                          >
                            {ch.name} ({getChannelTypeLabel(ch.type)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {compareResult.channels.modified.length > 0 && (
                    <div>
                      <h4 className="font-display font-bold text-neon-orange mb-2">
                        修改通道 ({compareResult.channels.modified.length})
                      </h4>
                      <div className="space-y-2">
                        {compareResult.channels.modified.map(({ from, to }) => (
                          <div
                            key={from.id}
                            className="p-2 bg-neon-orange bg-opacity-10 border border-neon-orange text-sm"
                          >
                            <div className="line-through opacity-60">
                              {from.name} → {to.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {compareResult.changeOverTime && (
                    <div>
                      <h4 className="font-display font-bold text-neon-purple mb-2">
                        换场时间变更
                      </h4>
                      <div className="p-2 bg-neon-purple bg-opacity-10 border border-neon-purple text-sm">
                        {compareResult.changeOverTime.from} 分钟 →{' '}
                        {compareResult.changeOverTime.to} 分钟
                      </div>
                    </div>
                  )}

                  {compareResult.startTime && (
                    <div>
                      <h4 className="font-display font-bold text-neon-cyan mb-2">
                        演出时间变更
                      </h4>
                      <div className="p-2 bg-neon-cyan bg-opacity-10 border border-neon-cyan text-sm">
                        {compareResult.startTime.from} → {compareResult.startTime.to}
                      </div>
                    </div>
                  )}

                  {compareResult.stageNotes && (
                    <div>
                      <h4 className="font-display font-bold text-base-400 mb-2">
                        舞台备注变更
                      </h4>
                      <div className="p-2 bg-base-800 border border-base-600 text-sm">
                        <div className="line-through opacity-60 mb-1">
                          {compareResult.stageNotes.from || '(空)'}
                        </div>
                        <div>{compareResult.stageNotes.to || '(空)'}</div>
                      </div>
                    </div>
                  )}

                  {Object.values(compareResult).every(
                    (v) =>
                      (Array.isArray(v) && v.length === 0) ||
                      (typeof v === 'object' &&
                        v !== null &&
                        'added' in v &&
                        v.added.length === 0 &&
                        v.removed.length === 0 &&
                        v.modified.length === 0) ||
                      v === null
                  ) && <div className="text-center py-8 text-base-500">两个版本无差异</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
