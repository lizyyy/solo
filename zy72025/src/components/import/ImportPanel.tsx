import { useRef, useState } from 'react';
import { Upload, FileText, Users, Play, AlertCircle, CheckCircle, Download } from 'lucide-react';
import type { Level, PlayerRecord } from '@/types';
import { CONFLICT_TYPE_LABELS } from '@/types';
import { allTestRecords } from '@/data/mockRecords';

interface ImportPanelProps {
  levels: Level[];
  onImportLevels: (file: File) => Promise<void>;
  onImportRecords: (file: File) => Promise<void>;
  onProcessRecord: (record: PlayerRecord) => Promise<void>;
  onExportSample: () => void;
  isLoading?: boolean;
  importResult?: { importedSessions: number; importedLevels: number } | null;
}

export function ImportPanel({
  levels,
  onImportLevels,
  onImportRecords,
  onProcessRecord,
  onExportSample,
  isLoading = false,
  importResult,
}: ImportPanelProps) {
  const levelFileInputRef = useRef<HTMLInputElement>(null);
  const recordFileInputRef = useRef<HTMLInputElement>(null);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);

  const handleLevelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImportLevels(file);
      e.target.value = '';
    }
  };

  const handleRecordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImportRecords(file);
      e.target.value = '';
    }
  };

  const handleProcessAll = async () => {
    for (let i = 0; i < allTestRecords.length; i++) {
      setProcessingIndex(i);
      try {
        await onProcessRecord(allTestRecords[i]);
      } catch (e) {
        console.error(`Failed to process record ${i}:`, e);
      }
    }
    setProcessingIndex(null);
  };

  const getRecordBadge = (record: PlayerRecord) => {
    const hasNull = record.steps.some(s => !s.decision || s.decision.trim() === '');
    const hasDuplicate = record.steps.some((s, i) => 
      record.steps.findIndex((r, j) => i !== j && r.stepIndex === s.stepIndex) !== -1
    );
    const hasBoundary = record.steps.some(s => 
      s.resources && Object.values(s.resources).some(v => v !== undefined && (v > 100 || v < -10))
    );

    if (hasNull) return { text: '含空值', type: 'warning' };
    if (hasDuplicate) return { text: '重复项', type: 'warning' };
    if (hasBoundary) return { text: '边界值', type: 'danger' };
    return { text: '正常', type: 'success' };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            导入关卡数据
          </h3>
          <p className="text-sm text-white/60 mb-4">
            导入 JSON 格式的关卡配置文件
          </p>
          <input
            ref={levelFileInputRef}
            type="file"
            accept=".json"
            onChange={handleLevelFileChange}
            className="hidden"
          />
          <button
            onClick={() => levelFileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full btn-secondary flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            选择关卡文件
          </button>

          {levels.length > 0 && (
            <div className="mt-4 p-3 bg-success-500/20 border border-success-500/30 rounded-lg">
              <p className="text-sm text-success-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                当前系统中有 {levels.length} 个可用关卡
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            导入玩家记录
          </h3>
          <p className="text-sm text-white/60 mb-4">
            导入 JSON 格式的学生练习记录
          </p>
          <input
            ref={recordFileInputRef}
            type="file"
            accept=".json"
            onChange={handleRecordFileChange}
            className="hidden"
          />
          <button
            onClick={() => recordFileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full btn-secondary flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            选择记录文件
          </button>

          <div className="mt-4">
            <p className="text-sm text-white/60 mb-2">或使用内置测试数据：</p>
            <button
              onClick={handleProcessAll}
              disabled={isLoading || processingIndex !== null}
              className="w-full btn-accent flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {processingIndex !== null 
                ? `正在处理 (${processingIndex + 1}/${allTestRecords.length})...` 
                : '处理全部测试记录'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-accent-400 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            可用测试记录
          </h3>
          <button
            onClick={onExportSample}
            className="text-sm text-white/60 hover:text-white flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            导出样例
          </button>
        </div>

        <div className="space-y-3">
          {allTestRecords.map((record, index) => {
            const badge = getRecordBadge(record);
            return (
              <div
                key={index}
                className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{record.playerName}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          badge.type === 'success'
                            ? 'bg-success-500/30 text-success-300'
                            : badge.type === 'warning'
                            ? 'bg-warning-500/30 text-warning-300'
                            : 'bg-danger-500/30 text-danger-300'
                        }`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-sm text-white/60">
                      关卡: {record.levelId} | 步骤: {record.steps.length}
                    </p>
                    {record.teacherNotes && (
                      <p className="text-sm text-white/50 mt-1">
                        备注: {record.teacherNotes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onProcessRecord(record)}
                    disabled={isLoading || processingIndex !== null}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <Play className="w-3 h-3" />
                    处理
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold text-accent-400 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          冲突类型说明
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(CONFLICT_TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="p-3 bg-white/5 rounded-lg">
              <span className="font-medium text-white">{label}</span>
              <p className="text-xs text-white/50 mt-1">
                {key === 'resource_mismatch' && '资源数据与预期不一致'}
                {key === 'step_missing' && '步骤缺失或无法找到'}
                {key === 'timeline_conflict' && '时间线顺序颠倒'}
                {key === 'duplicate_step' && '存在重复的步骤索引'}
                {key === 'null_value' && '存在空值或未填写项'}
                {key === 'boundary_issue' && '数值超出合理边界'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {importResult && (
        <div className="p-4 bg-success-500/20 border border-success-500/30 rounded-lg">
          <p className="text-success-300 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            导入成功：新增 {importResult.importedLevels} 个关卡，{importResult.importedSessions} 条记录
          </p>
        </div>
      )}
    </div>
  );
}
