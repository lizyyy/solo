import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBatchStore } from '../store/useBatchStore';
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  MessageSquarePlus,
  Clock,
  Tag,
} from 'lucide-react';

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getRecord = useBatchStore(s => s.getRecord);
  const confirmRecord = useBatchStore(s => s.confirmRecord);
  const addNote = useBatchStore(s => s.addNote);
  const currentBatch = useBatchStore(s => s.getCurrentBatch());

  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [confirmReason, setConfirmReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const record = id ? getRecord(id) : null;

  if (!record) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono">记录未找到</p>
          <button onClick={() => navigate('/tuning')} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const judgmentIcon = (j: string) => {
    if (j === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (j === 'warning') return <AlertTriangle className="w-4 h-4 text-orange-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  const judgmentLabel = (j: string) => {
    if (j === 'pass') return { text: '通过', color: 'text-green-400' };
    if (j === 'warning') return { text: '警告', color: 'text-orange-400' };
    return { text: '错误', color: 'text-red-400' };
  };

  const typeLabel = (t: string) => {
    if (t === 'smooth') return { text: '顺利记录', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
    if (t === 'pending') return { text: '待确认记录', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    return { text: '旧口径记录', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/30' };
  };

  const statusLabel = (s: string) => {
    if (s === 'auto_pass') return { text: '自动通过', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (s === 'confirmed') return { text: '已确认', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (s === 'rejected') return { text: '已驳回', color: 'text-red-400', bg: 'bg-red-500/20' };
    return { text: '待确认', color: 'text-orange-400', bg: 'bg-orange-500/20' };
  };

  const tl = typeLabel(record.recordType);
  const sl = statusLabel(record.status);

  const handleConfirm = (approved: boolean) => {
    confirmRecord(record.id, approved, confirmReason);
    setConfirmReason('');
    setShowConfirm(false);
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) return;
    addNote(record.id, noteContent, '林老师');
    setNoteContent('');
    setShowNoteInput(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-mono font-bold tracking-tight">磁悬浮小车轨道调参系统</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-mono">
            <button onClick={() => navigate('/')} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">数据导入</button>
            <button onClick={() => navigate('/tuning')} className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">调参主流程</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/tuning')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回记录列表
        </button>

        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-mono font-bold">记录 #{record.sequence}</h2>
          <span className={`px-3 py-1 rounded border text-xs font-mono ${tl.bg} ${tl.color}`}>
            {tl.text}
          </span>
          <span className={`px-3 py-1 rounded text-xs font-mono ${sl.bg} ${sl.color}`}>
            {sl.text}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              判断过程
            </h3>
            <div className="space-y-0">
              {record.checkSteps.map((step, idx) => {
                const jl = judgmentLabel(step.judgment);
                return (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center bg-zinc-900">
                        {judgmentIcon(step.judgment)}
                      </div>
                      {idx < record.checkSteps.length - 1 && (
                        <div className="w-px h-full bg-zinc-800 my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-zinc-300">{step.title}</span>
                        <span className={`text-xs font-mono ${jl.color}`}>{jl.text}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-2">{step.description}</p>
                      <div className="flex gap-4 text-xs font-mono mb-2">
                        <div>
                          <span className="text-zinc-600">原值：</span>
                          <span className="text-zinc-400">{step.originalValue}</span>
                        </div>
                        <div>
                          <span className="text-zinc-600">计算值：</span>
                          <span className="text-zinc-300">{step.calculatedValue}</span>
                        </div>
                      </div>
                      {step.basis && (
                        <p className="text-xs text-zinc-600 mb-1">依据：{step.basis}</p>
                      )}
                      {step.suggestion && (
                        <div className="mt-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded text-xs text-orange-300/90 font-mono leading-relaxed">
                          💡 {step.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/50 mb-4">
              <h3 className="font-mono font-bold mb-4 text-sm">记录参数</h3>
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">时间戳</span>
                  <span className="text-zinc-300 text-xs">{record.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">采样间隔</span>
                  <span className="text-zinc-300">{record.timeSinceLast}ms</span>
                </div>
                <hr className="border-zinc-800" />
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">轨道间隙</span>
                  <div className="text-right">
                    <span className="text-zinc-300">{record.gap.calculated.toFixed(3)} mm</span>
                    {record.gap.unit !== 'mm' && (
                      <span className="text-orange-400 text-xs block">原值: {record.gap.raw} {record.gap.unit}</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">悬浮高度</span>
                  <div className="text-right">
                    <span className="text-zinc-300">{record.height.calculated.toFixed(3)} mm</span>
                    {record.height.unit !== 'mm' && (
                      <span className="text-orange-400 text-xs block">原值: {record.height.raw} {record.height.unit}</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">推进电流</span>
                  <div className="text-right">
                    <span className="text-zinc-300">{record.current.calculated.toFixed(3)} A</span>
                    {record.current.unit !== 'A' && (
                      <span className="text-orange-400 text-xs block">原值: {record.current.raw} {record.current.unit}</span>
                    )}
                  </div>
                </div>
                <hr className="border-zinc-800" />
                <div className="flex justify-between">
                  <span className="text-zinc-500">X方向</span>
                  <span className={`${record.direction.x < -2 || record.direction.x > 2 ? 'text-orange-400' : 'text-zinc-300'}`}>
                    {record.direction.x > 0 ? '+' : ''}{record.direction.x.toFixed(2)} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Y方向</span>
                  <span className={`${record.direction.y < -1 || record.direction.y > 3 ? 'text-orange-400' : 'text-zinc-300'}`}>
                    {record.direction.y > 0 ? '+' : ''}{record.direction.y.toFixed(2)} mm
                  </span>
                </div>
                <hr className="border-zinc-800" />
                <div>
                  <span className="text-zinc-500 block mb-1">数据来源</span>
                  <span className="text-zinc-400 text-xs">{record.source === 'sensor' ? '传感器自动采集' : record.source === 'wechat' ? '维修微信群' : '人工录入'}</span>
                </div>
                {record.deviceParam && (
                  <div>
                    <span className="text-zinc-500 block mb-1">设备参数</span>
                    <span className="text-zinc-400 text-xs">{record.deviceParam}</span>
                  </div>
                )}
                {record.siteRemark && (
                  <div>
                    <span className="text-zinc-500 block mb-1">现场备注</span>
                    <span className="text-zinc-400 text-xs">{record.siteRemark}</span>
                  </div>
                )}
              </div>
            </div>

            {record.status === 'pending' && !showConfirm && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  人工确认
                </button>
                <button
                  onClick={() => confirmRecord(record.id, false, '人工驳回')}
                  className="flex-1 py-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded font-mono text-sm flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  驳回
                </button>
              </div>
            )}

            {showConfirm && (
              <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4 mb-4">
                <p className="text-sm font-mono text-blue-400 mb-3">确认此记录？可填写理由：</p>
                <textarea
                  value={confirmReason}
                  onChange={e => setConfirmReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm font-mono text-zinc-300 resize-none h-20 mb-3 focus:outline-none focus:border-blue-500/50"
                  placeholder="填写确认理由（可选）"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirm(true)}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded font-mono text-sm"
                  >
                    确认通过
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-2 border border-zinc-700 text-zinc-500 rounded font-mono text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="w-full py-2.5 border border-zinc-700 text-zinc-400 hover:text-blue-400 hover:border-blue-500/50 rounded font-mono text-sm flex items-center justify-center gap-2 mb-4 transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              补录备注
            </button>

            {showNoteInput && (
              <div className="border border-zinc-800 rounded-lg p-4 mb-4 bg-zinc-900/50">
                <p className="text-xs text-zinc-500 font-mono mb-2">补录备注后，系统会自动计算并展示补录前后的差异</p>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-sm font-mono text-zinc-300 resize-none h-24 mb-3 focus:outline-none focus:border-blue-500/50"
                  placeholder="输入补录备注内容..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded font-mono text-sm"
                  >
                    提交备注
                  </button>
                  <button
                    onClick={() => { setShowNoteInput(false); setNoteContent(''); }}
                    className="flex-1 py-2 border border-zinc-700 text-zinc-500 rounded font-mono text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {record.notes.length > 0 && (
              <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                <h4 className="font-mono font-bold text-sm mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-500" />
                  备注记录
                </h4>
                <div className="space-y-3">
                  {record.notes.map(note => (
                    <div key={note.id} className="border-l-2 border-zinc-700 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-zinc-500">{note.author}</span>
                        <span className="text-xs font-mono text-zinc-600">{new Date(note.createdAt).toLocaleString('zh-CN')}</span>
                        {note.isSupplementary && (
                          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">补录</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 font-mono">{note.content}</p>
                      {note.diff && (
                        <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs font-mono">
                          <div className="text-zinc-600 mb-1">补录差异：</div>
                          <div className="text-red-400/70 line-through">{note.diff.oldValue}</div>
                          <div className="text-green-400">{note.diff.newValue}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
