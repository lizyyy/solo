import { useState } from 'react';
import { useMidiStore } from '@/store/useMidiStore';
import type { ReviewSession, SupplementalMaterial, ControllerEvent, SoundParameter } from '@/types/midi';
import { detectConflicts } from '@/engine/conflictDetector';
import { History, FileSearch, Upload, Plus, RefreshCw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Review() {
  const {
    reviewSessions, supplementalMaterials, mappings, conflicts,
    soundParameters, operationHistory,
    addReviewSession, addSupplementalMaterial, processSupplementalMaterial,
    addControllerEvent, addSoundParameter,
  } = useMidiStore();

  const [showSessionForm, setShowSessionForm] = useState(false);
  const [conclusionText, setConclusionText] = useState('');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [suppFormType, setSuppFormType] = useState<'controller_event' | 'sound_parameter' | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ newConflicts: number; completeness: number } | null>(null);

  const [ceType, setCeType] = useState<ControllerEvent['type']>('cc');
  const [ceChannel, setCeChannel] = useState(1);
  const [ceCcNumber, setCeCcNumber] = useState(1);
  const [ceValueMin, setCeValueMin] = useState(0);
  const [ceValueMax, setCeValueMax] = useState(127);

  const [spName, setSpName] = useState('');
  const [spType, setSpType] = useState<SoundParameter['type']>('continuous');
  const [spCategory, setSpCategory] = useState('');
  const [spValueMin, setSpValueMin] = useState(0);
  const [spValueMax, setSpValueMax] = useState(127);

  const unresolvedConflicts = conflicts.filter((c) => c.resolvedAt == null);
  const mappingCompleteness = soundParameters.length > 0
    ? Math.min((mappings.length / soundParameters.length) * 100, 100)
    : 0;

  const handleCreateSession = () => {
    if (!conclusionText.trim()) return;
    const snapshotId = operationHistory.length > 0
      ? operationHistory[operationHistory.length - 1].id
      : 'initial';
    const session: ReviewSession = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      conclusion: conclusionText,
      conflictCount: unresolvedConflicts.length,
      mappingCompleteness,
      historySnapshotId: snapshotId,
      supplementalMaterials: [],
    };
    addReviewSession(session);
    setConclusionText('');
    setShowSessionForm(false);
  };

  const handleAddControllerEvent = () => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const label = `${ceType.toUpperCase()}${ceType === 'cc' ? ceCcNumber : ''} Ch${ceChannel}`;
    const event: ControllerEvent = {
      id, type: ceType, channel: ceChannel,
      ccNumber: ceType === 'cc' ? ceCcNumber : undefined,
      valueRange: [ceValueMin, ceValueMax],
      timestamp, label,
    };
    addControllerEvent(event);

    const material: SupplementalMaterial = {
      id: crypto.randomUUID(), type: 'controller_event',
      content: event, receivedAt: timestamp,
      reviewSessionId: reviewSessions.length > 0 ? reviewSessions[reviewSessions.length - 1].id : '',
    };
    addSupplementalMaterial(material);
    runConflictDetection();
    setSuppFormType(null);
    resetCeForm();
  };

  const handleAddSoundParameter = () => {
    if (!spName.trim()) return;
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const param: SoundParameter = {
      id, name: spName, type: spType,
      valueRange: spType === 'enum' ? [] : [spValueMin, spValueMax],
      category: spCategory || 'Custom',
    };
    addSoundParameter(param);

    const material: SupplementalMaterial = {
      id: crypto.randomUUID(), type: 'sound_parameter',
      content: param, receivedAt: timestamp,
      reviewSessionId: reviewSessions.length > 0 ? reviewSessions[reviewSessions.length - 1].id : '',
    };
    addSupplementalMaterial(material);
    runConflictDetection();
    setSuppFormType(null);
    resetSpForm();
  };

  const runConflictDetection = () => {
    const prevCount = useMidiStore.getState().conflicts.filter((c) => c.resolvedAt == null).length;
    const newConflicts = detectConflicts(
      useMidiStore.getState().mappings,
      useMidiStore.getState().controllerEvents,
      useMidiStore.getState().soundParameters,
      useMidiStore.getState().conflicts,
    );
    const newUnresolved = newConflicts.filter((c) => c.resolvedAt == null).length;
    const added = Math.max(newUnresolved - prevCount, 0);
    const completeness = useMidiStore.getState().soundParameters.length > 0
      ? Math.min((useMidiStore.getState().mappings.length / useMidiStore.getState().soundParameters.length) * 100, 100)
      : 0;
    setAnalysisResult({ newConflicts: added, completeness });
  };

  const resetCeForm = () => {
    setCeType('cc'); setCeChannel(1); setCeCcNumber(1); setCeValueMin(0); setCeValueMax(127);
  };

  const resetSpForm = () => {
    setSpName(''); setSpType('continuous'); setSpCategory(''); setSpValueMin(0); setSpValueMax(127);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');

  return (
    <div className="space-y-8" style={{ background: '#0D1117', minHeight: '100vh', padding: '2rem' }}>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5" style={{ color: '#00FF87' }} />
            复盘 - 历史结论
          </h2>
          <button
            onClick={() => setShowSessionForm(!showSessionForm)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#00FF87', color: '#0D1117' }}
          >
            <Plus className="w-4 h-4" /> 创建复盘会话
          </button>
        </div>

        {showSessionForm && (
          <div className="rounded-lg p-4 mb-4 border" style={{ background: 'rgba(24,24,27,0.5)', borderColor: '#27272a' }}>
            <textarea
              value={conclusionText}
              onChange={(e) => setConclusionText(e.target.value)}
              placeholder="输入复盘结论..."
              className="w-full rounded-md p-2 text-sm text-white mb-3 border"
              style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'Noto Sans SC, sans-serif' }}
              rows={3}
            />
            <div className="flex gap-4 text-sm mb-3" style={{ color: '#a1a1aa', fontFamily: 'JetBrains Mono, monospace' }}>
              <span>冲突: <b style={{ color: unresolvedConflicts.length > 0 ? '#FF4444' : '#00FF87' }}>{unresolvedConflicts.length}</b></span>
              <span>覆盖率: <b style={{ color: '#00FF87' }}>{mappingCompleteness.toFixed(1)}%</b></span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateSession} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: '#00FF87', color: '#0D1117' }}>提交</button>
              <button onClick={() => setShowSessionForm(false)} className="px-3 py-1.5 rounded-md text-sm" style={{ background: '#27272a', color: '#a1a1aa' }}>取消</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {reviewSessions.map((session) => (
            <div key={session.id} className="rounded-lg border overflow-hidden" style={{ background: 'rgba(24,24,27,0.5)', borderColor: '#27272a' }}>
              <button
                onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatDate(session.createdAt)}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold')} style={{ background: session.conflictCount > 0 ? 'rgba(255,68,68,0.2)' : 'rgba(0,255,135,0.2)', color: session.conflictCount > 0 ? '#FF4444' : '#00FF87' }}>
                    {session.conflictCount} 冲突
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full" style={{ background: '#27272a' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(session.mappingCompleteness, 100)}%`, background: '#00FF87' }} />
                    </div>
                    <span className="text-xs" style={{ color: '#00FF87', fontFamily: 'JetBrains Mono, monospace' }}>{session.mappingCompleteness.toFixed(0)}%</span>
                  </div>
                </div>
                <FileSearch className="w-4 h-4" style={{ color: '#71717a' }} />
              </button>
              {expandedSession === session.id && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: '#27272a' }}>
                  <p className="text-sm mt-2" style={{ color: '#d4d4d8', fontFamily: 'Noto Sans SC, sans-serif' }}>{session.conclusion}</p>
                  {session.supplementalMaterials.length > 0 && (
                    <div className="mt-2 text-xs" style={{ color: '#71717a' }}>
                      关联材料: {session.supplementalMaterials.length} 项
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {reviewSessions.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: '#52525b' }}>暂无复盘会话</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5" style={{ color: '#00FF87' }} />
          补传材料
        </h2>

        <div className="rounded-lg border-2 border-dashed p-6 mb-4 text-center transition-colors" style={{ borderColor: '#27272a' }}>
          <p className="text-sm mb-3" style={{ color: '#71717a' }}>添加补充材料</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setSuppFormType(suppFormType === 'controller_event' ? null : 'controller_event'); setAnalysisResult(null); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: suppFormType === 'controller_event' ? '#00FF87' : '#27272a', color: suppFormType === 'controller_event' ? '#0D1117' : '#d4d4d8' }}
            >
              <Plus className="w-4 h-4" /> 添加控制器事件
            </button>
            <button
              onClick={() => { setSuppFormType(suppFormType === 'sound_parameter' ? null : 'sound_parameter'); setAnalysisResult(null); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: suppFormType === 'sound_parameter' ? '#00FF87' : '#27272a', color: suppFormType === 'sound_parameter' ? '#0D1117' : '#d4d4d8' }}
            >
              <Plus className="w-4 h-4" /> 添加音源参数
            </button>
          </div>
        </div>

        {suppFormType === 'controller_event' && (
          <div className="rounded-lg p-4 mb-4 border" style={{ background: 'rgba(24,24,27,0.5)', borderColor: '#27272a' }}>
            <div className="grid grid-cols-5 gap-2 mb-3">
              <select value={ceType} onChange={(e) => setCeType(e.target.value as ControllerEvent['type'])} className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }}>
                <option value="cc">CC</option><option value="note">Note</option><option value="pitchbend">Pitchbend</option><option value="aftertouch">Aftertouch</option>
              </select>
              <input type="number" min={1} max={16} value={ceChannel} onChange={(e) => setCeChannel(Number(e.target.value))} placeholder="Channel" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />
              {ceType === 'cc' && <input type="number" min={0} max={127} value={ceCcNumber} onChange={(e) => setCeCcNumber(Number(e.target.value))} placeholder="CC#" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />}
              <input type="number" value={ceValueMin} onChange={(e) => setCeValueMin(Number(e.target.value))} placeholder="Min" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />
              <input type="number" value={ceValueMax} onChange={(e) => setCeValueMax(Number(e.target.value))} placeholder="Max" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
            <button onClick={handleAddControllerEvent} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: '#00FF87', color: '#0D1117' }}>提交</button>
          </div>
        )}

        {suppFormType === 'sound_parameter' && (
          <div className="rounded-lg p-4 mb-4 border" style={{ background: 'rgba(24,24,27,0.5)', borderColor: '#27272a' }}>
            <div className="grid grid-cols-5 gap-2 mb-3">
              <input value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="名称" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'Noto Sans SC, sans-serif' }} />
              <select value={spType} onChange={(e) => setSpType(e.target.value as SoundParameter['type'])} className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }}>
                <option value="continuous">Continuous</option><option value="toggle">Toggle</option><option value="enum">Enum</option>
              </select>
              <input value={spCategory} onChange={(e) => setSpCategory(e.target.value)} placeholder="分类" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'Noto Sans SC, sans-serif' }} />
              <input type="number" value={spValueMin} onChange={(e) => setSpValueMin(Number(e.target.value))} placeholder="Min" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />
              <input type="number" value={spValueMax} onChange={(e) => setSpValueMax(Number(e.target.value))} placeholder="Max" className="rounded-md px-2 py-1.5 text-sm text-white border" style={{ background: '#0D1117', borderColor: '#27272a', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
            <button onClick={handleAddSoundParameter} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: '#00FF87', color: '#0D1117' }}>提交</button>
          </div>
        )}

        {analysisResult !== null && (
          <div className="rounded-lg p-3 mb-4 border flex items-center gap-3" style={{ background: 'rgba(24,24,27,0.5)', borderColor: analysisResult.newConflicts > 0 ? '#FF4444' : '#00FF87' }}>
            {analysisResult.newConflicts > 0 ? (
              <AlertTriangle className="w-4 h-4" style={{ color: '#FF4444' }} />
            ) : (
              <CheckCircle className="w-4 h-4" style={{ color: '#00FF87' }} />
            )}
            <span className="text-sm" style={{ color: analysisResult.newConflicts > 0 ? '#FF4444' : '#00FF87', fontFamily: 'Noto Sans SC, sans-serif' }}>
              {analysisResult.newConflicts > 0 ? `新增冲突: ${analysisResult.newConflicts}` : '无新增冲突'}
            </span>
            <span className="text-sm" style={{ color: '#a1a1aa', fontFamily: 'JetBrains Mono, monospace' }}>
              当前映射覆盖率: {analysisResult.completeness.toFixed(1)}%
            </span>
          </div>
        )}

        <div className="space-y-2">
          {supplementalMaterials.map((mat) => {
            const isProcessed = mat.processedAt != null;
            const typeIcon = mat.type === 'controller_event' ? Clock : mat.type === 'sound_parameter' ? RefreshCw : FileSearch;
            const TypeIcon = typeIcon;
            const typeLabel = mat.type === 'controller_event' ? '控制器事件' : mat.type === 'sound_parameter' ? '音源参数' : '预设文件';
            return (
              <div key={mat.id} className="rounded-lg p-3 border flex items-center justify-between" style={{ background: 'rgba(24,24,27,0.5)', borderColor: '#27272a' }}>
                <div className="flex items-center gap-3">
                  <TypeIcon className="w-4 h-4" style={{ color: '#71717a' }} />
                  <span className="text-sm text-white">{typeLabel}</span>
                  <span className="text-xs" style={{ color: '#52525b', fontFamily: 'JetBrains Mono, monospace' }}>{formatDate(mat.receivedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessed ? (
                    <CheckCircle className="w-4 h-4" style={{ color: '#00FF87' }} />
                  ) : (
                    <button
                      onClick={() => processSupplementalMaterial(mat.id)}
                      className="px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ background: '#FFB800', color: '#0D1117' }}
                    >
                      处理
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {supplementalMaterials.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: '#52525b' }}>暂无补传材料</p>
          )}
        </div>
      </section>
    </div>
  );
}
