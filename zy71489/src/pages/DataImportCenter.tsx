import { useState, useRef } from 'react';
import {
  Upload,
  Music,
  Users,
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileWarning,
  Loader2
} from 'lucide-react';
import type { ImportResult, BadDataRecord } from '@shared/types';
import { cn } from '@/lib/utils';

const mockBadData: BadDataRecord[] = [
  {
    id: 'bd1',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 15,
    rawContent: ',张三,2024-05-20',
    errorType: 'missing_field',
    errorMessage: '缺少曲目名称字段',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  },
  {
    id: 'bd2',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 23,
    rawContent: '未知歌曲,李四,2024-05-20',
    errorType: 'unknown_track',
    errorMessage: '曲目不存在于候选库',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  },
  {
    id: 'bd3',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 45,
    rawContent: '海阔天空,张三,2024-05-20',
    errorType: 'duplicate',
    errorMessage: '同一投票人重复投票',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  }
];

interface ImportState {
  isDragging: boolean;
  isUploading: boolean;
  progress: number;
  result: ImportResult | null;
  badData: BadDataRecord[];
}

export default function DataImportCenter() {
  const [trackForm, setTrackForm] = useState({
    name: '',
    artist: '',
    duration: '',
    staminaLevel: '3' as '1' | '2' | '3' | '4' | '5',
    notes: ''
  });

  const [voteImport, setVoteImport] = useState<ImportState>({
    isDragging: false,
    isUploading: false,
    progress: 0,
    result: null,
    badData: []
  });

  const [copyrightImport, setCopyrightImport] = useState<ImportState>({
    isDragging: false,
    isUploading: false,
    progress: 0,
    result: null,
    badData: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyrightInputRef = useRef<HTMLInputElement>(null);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/import/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trackForm,
          duration: parseInt(trackForm.duration)
        })
      });
      setTrackForm({ name: '', artist: '', duration: '', staminaLevel: '3', notes: '' });
      alert('曲目录入成功！');
    } catch (e) {
      console.error('Failed to add track:', e);
    }
  };

  const handleDragOver = (e: React.DragEvent, setState: React.Dispatch<React.SetStateAction<ImportState>>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragging: true }));
  };

  const handleDragLeave = (e: React.DragEvent, setState: React.Dispatch<React.SetStateAction<ImportState>>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragging: false }));
  };

  const simulateUpload = (setState: React.Dispatch<React.SetStateAction<ImportState>>, type: 'vote' | 'copyright') => {
    setState(prev => ({ ...prev, isUploading: true, progress: 0, result: null, badData: [] }));

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        const result: ImportResult = {
          success: type === 'vote' ? 147 : 52,
          failed: type === 'vote' ? 2 : 1,
          duplicates: type === 'vote' ? 8 : 0,
          badData: type === 'vote' ? mockBadData : []
        };

        setState(prev => ({
          ...prev,
          isUploading: false,
          progress: 100,
          result,
          badData: result.badData
        }));
      } else {
        setState(prev => ({ ...prev, progress }));
      }
    }, 200);
  };

  const handleFileDrop = (
    e: React.DragEvent,
    setState: React.Dispatch<React.SetStateAction<ImportState>>,
    type: 'vote' | 'copyright'
  ) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragging: false }));
    simulateUpload(setState, type);
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setState: React.Dispatch<React.SetStateAction<ImportState>>,
    type: 'vote' | 'copyright'
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      simulateUpload(setState, type);
    }
  };

  function UploadZone({
    title,
    description,
    icon,
    state,
    setState,
    inputRef,
    type
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
    state: ImportState;
    setState: React.Dispatch<React.SetStateAction<ImportState>>;
    inputRef: React.RefObject<HTMLInputElement>;
    type: 'vote' | 'copyright';
  }) {
    return (
      <div className="card-stage p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-stage bg-gold/15 flex items-center justify-center border border-gold/30">
            {icon}
          </div>
          <div>
            <h3 className="font-serif font-semibold text-white">{title}</h3>
            <p className="text-xs text-neutral-500">{description}</p>
          </div>
        </div>

        <div
          className={cn(
            'border-2 border-dashed rounded-stage p-8 text-center transition-all duration-300 cursor-pointer',
            state.isDragging
              ? 'border-gold bg-gold/10'
              : 'border-neutral-700 hover:border-gold/50 hover:bg-neutral-800/30',
            state.isUploading && 'pointer-events-none opacity-60'
          )}
          onDragOver={(e) => handleDragOver(e, setState)}
          onDragLeave={(e) => handleDragLeave(e, setState)}
          onDrop={(e) => handleFileDrop(e, setState, type)}
          onClick={() => !state.isUploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e, setState, type)}
          />

          {state.isUploading ? (
            <div className="space-y-3">
              <Loader2 size={40} className="mx-auto text-gold animate-spin" />
              <p className="text-sm text-neutral-400">正在处理文件...</p>
              <div className="w-full max-w-xs mx-auto bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="font-mono text-xs text-gold">{Math.round(state.progress)}%</p>
            </div>
          ) : (
            <>
              <Upload size={40} className="mx-auto text-neutral-500 mb-3" />
              <p className="text-sm text-neutral-400 mb-1">拖拽 CSV 文件到此处</p>
              <p className="text-xs text-neutral-600">或点击选择文件</p>
              <p className="text-xs text-neutral-600 mt-2">支持格式: .csv</p>
            </>
          )}
        </div>

        {state.result && (
          <div className="mt-4 space-y-3 animate-fade-in-up">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-green-500/10 border border-green-500/30 rounded-stage p-3 text-center">
                <CheckCircle size={20} className="mx-auto text-green-400 mb-1" />
                <p className="font-mono text-lg text-green-400">{state.result.success}</p>
                <p className="text-xs text-neutral-500">成功</p>
              </div>
              <div className="bg-red/10 border border-red/30 rounded-stage p-3 text-center">
                <XCircle size={20} className="mx-auto text-red mb-1" />
                <p className="font-mono text-lg text-red">{state.result.failed}</p>
                <p className="text-xs text-neutral-500">失败</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-stage p-3 text-center">
                <AlertTriangle size={20} className="mx-auto text-yellow-400 mb-1" />
                <p className="font-mono text-lg text-yellow-400">{state.result.duplicates}</p>
                <p className="text-xs text-neutral-500">重复</p>
              </div>
              <div className="bg-orange/10 border border-orange/30 rounded-stage p-3 text-center">
                <FileWarning size={20} className="mx-auto text-orange mb-1" />
                <p className="font-mono text-lg text-orange">{state.result.badData.length}</p>
                <p className="text-xs text-neutral-500">坏数据</p>
              </div>
            </div>

            {state.badData.length > 0 && (
              <div className="bg-neutral-950 rounded-stage border border-neutral-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
                  <p className="text-sm font-medium text-orange flex items-center gap-2">
                    <FileWarning size={14} />
                    坏数据记录
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {state.badData.map((record, index) => (
                    <div
                      key={record.id}
                      className={cn(
                        'px-4 py-3 border-b border-neutral-800/50 text-sm animate-fade-in-up',
                        index % 2 === 0 && 'bg-red/5'
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-red mb-1">
                            第 {record.lineNumber} 行: {record.errorMessage}
                          </p>
                          <p className="font-mono text-xs text-neutral-500 truncate">
                            原始内容: {record.rawContent}
                          </p>
                        </div>
                        <span className="badge-red shrink-0">
                          {record.errorType === 'missing_field' ? '字段缺失' :
                           record.errorType === 'duplicate' ? '重复' :
                           record.errorType === 'unknown_track' ? '未知曲目' : record.errorType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-white mb-2">数据导入中心</h1>
        <p className="text-neutral-400 text-sm">录入候选曲目、导入观众投票和版权状态数据，所有操作自动留痕</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-stage p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-stage bg-gold/15 flex items-center justify-center border border-gold/30">
              <Music className="text-gold" size={20} />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-white">候选曲目录入</h3>
              <p className="text-xs text-neutral-500">手动添加单首候选曲目</p>
            </div>
          </div>

          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">曲目名称 *</label>
                <input
                  type="text"
                  value={trackForm.name}
                  onChange={(e) => setTrackForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入曲目名称"
                  className="input-stage"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">艺术家 *</label>
                <input
                  type="text"
                  value={trackForm.artist}
                  onChange={(e) => setTrackForm(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="输入艺术家名称"
                  className="input-stage"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">时长（秒） *</label>
                <input
                  type="number"
                  value={trackForm.duration}
                  onChange={(e) => setTrackForm(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="例如: 240"
                  className="input-stage"
                  min="60"
                  max="600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">体力等级 *</label>
                <select
                  value={trackForm.staminaLevel}
                  onChange={(e) => setTrackForm(prev => ({ ...prev, staminaLevel: e.target.value as '1' | '2' | '3' | '4' | '5' }))}
                  className="input-stage"
                >
                  <option value="1">★☆☆☆☆ 轻松</option>
                  <option value="2">★★☆☆☆ 较低</option>
                  <option value="3">★★★☆☆ 中等</option>
                  <option value="4">★★★★☆ 较高</option>
                  <option value="5">★★★★★ 高难度</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">备注</label>
                <textarea
                  value={trackForm.notes}
                  onChange={(e) => setTrackForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="可选备注信息"
                  rows={3}
                  className="input-stage resize-none"
                />
              </div>
            </div>

            <button type="submit" className="w-full btn-gold flex items-center justify-center gap-2">
              <Plus size={16} />
              录入曲目
            </button>
          </form>
        </div>

        <UploadZone
          title="观众投票导入"
          description="导入 CSV 格式的观众投票数据"
          icon={<Users className="text-gold" size={20} />}
          state={voteImport}
          setState={setVoteImport}
          inputRef={fileInputRef}
          type="vote"
        />

        <div className="lg:col-span-2">
          <UploadZone
            title="版权状态导入"
            description="导入 CSV 格式的版权状态数据表"
            icon={<FileText className="text-gold" size={20} />}
            state={copyrightImport}
            setState={setCopyrightImport}
            inputRef={copyrightInputRef}
            type="copyright"
          />
        </div>
      </div>
    </div>
  );
}
