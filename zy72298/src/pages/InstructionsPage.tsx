import { useState } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import { MATERIAL_LABELS, STATUS_LABELS } from '@/types';
import { saveAs } from 'file-saver';
import {
  FileText,
  Edit,
  Save,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InstructionsPage() {
  const { records, history, updateSiteInstruction, exportData } = usePipelineStore();
  const step3Records = records.filter((r) => r.status === 'step3' || r.status === 'confirmed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [instructionInputs, setInstructionInputs] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const getInstructionHistory = (recordId: string) => {
    return history.filter(
      (h) => h.recordId === recordId && h.action === 'update_instruction'
    );
  };

  const checkHistoryConsistency = (recordId: string, currentInstruction: string) => {
    const recordHistory = getInstructionHistory(recordId);
    if (recordHistory.length === 0) return true;
    const lastVersion = recordHistory[recordHistory.length - 1];
    const lastInstruction = lastVersion.changes.find((c) => c.field === 'siteInstruction')?.newValue;
    return lastInstruction === currentInstruction;
  };

  const handleEdit = (recordId: string, currentInstruction?: string) => {
    setEditingId(recordId);
    setInstructionInputs((prev) => ({ ...prev, [recordId]: currentInstruction || '' }));
  };

  const handleSave = (recordId: string) => {
    const instruction = instructionInputs[recordId]?.trim();
    if (!instruction) return;
    updateSiteInstruction(recordId, instruction);
    setEditingId(null);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `pipeline-instructions-${Date.now()}.json`);
  };

  const toggleHistory = (recordId: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-primary-800 flex items-center gap-2">
            <FileText />
            现场说明
          </h1>
          <p className="text-sm text-industrial-gray mt-1">
            给现场班组的作业说明，自动核对与历史记录一致性
          </p>
        </div>
        <button onClick={handleExport} className="btn-outline inline-flex items-center gap-2">
          <Download className="w-4 h-4" />
          导出全部
        </button>
      </div>

      {step3Records.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无待更新说明的记录</p>
          <p className="text-sm mt-1">完成冲突处理和坐标复核后，记录将出现在这里</p>
        </div>
      )}

      <div className="space-y-4">
        {step3Records.map((record) => {
          const instructionHistory = getInstructionHistory(record.id);
          const isConsistent = record.siteInstruction
            ? checkHistoryConsistency(record.id, record.siteInstruction)
            : true;
          const isExpanded = expandedHistory.has(record.id);

          return (
            <div key={record.id} className="card overflow-hidden animate-slide-in">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono-data text-lg text-primary-800">{record.photoNumber}</span>
                  <span className={cn(
                    'status-tag',
                    record.materialType === 'normal' && 'bg-blue-50 text-blue-700',
                    record.materialType === 'wrong_caliber' && 'bg-red-50 text-red-700',
                    record.materialType === 'supplementary' && 'bg-amber-50 text-amber-700',
                  )}>
                    {MATERIAL_LABELS[record.materialType]}
                  </span>
                  {record.cadLayer && (
                    <span className="text-xs text-gray-500 font-mono-data">
                      CAD: {record.cadLayer}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {record.siteInstruction ? (
                    isConsistent ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                        <CheckCircle className="w-3.5 h-3.5" />
                        与历史记录一致
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                        <AlertCircle className="w-3.5 h-3.5" />
                        与历史记录不一致
                      </span>
                    )
                  ) : null}
                  <span className={cn(
                    'status-tag',
                    record.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                  )}>
                    {STATUS_LABELS[record.status]}
                  </span>
                </div>
              </div>

              <div className="p-5">
                {editingId === record.id ? (
                  <div className="space-y-3">
                    <textarea
                      className="input-field w-full min-h-[100px] text-sm"
                      placeholder="请输入给现场班组的作业说明..."
                      value={instructionInputs[record.id] || ''}
                      onChange={(e) => setInstructionInputs((prev) => ({
                        ...prev,
                        [record.id]: e.target.value,
                      }))}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(record.id)}
                        className="btn-success inline-flex items-center gap-1.5 text-sm"
                      >
                        <Save className="w-4 h-4" />
                        保存说明
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-outline text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 font-display mb-1">现场班组作业说明</div>
                        {record.siteInstruction ? (
                          <div className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-4 rounded border border-gray-200">
                            {record.siteInstruction}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 bg-gray-50 p-4 rounded border border-dashed border-gray-300">
                            尚未填写作业说明
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleEdit(record.id, record.siteInstruction)}
                        className="btn-outline text-sm shrink-0 inline-flex items-center gap-1.5"
                      >
                        <Edit className="w-4 h-4" />
                        {record.siteInstruction ? '编辑' : '填写'}
                      </button>
                    </div>

                    <button
                      onClick={() => toggleHistory(record.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      历史版本 ({instructionHistory.length})
                    </button>

                    {isExpanded && instructionHistory.length > 0 && (
                      <div className="mt-2 border-t border-gray-100 pt-3 space-y-2">
                        {instructionHistory.map((h, idx) => {
                          const instruction = h.changes.find((c) => c.field === 'siteInstruction')?.newValue as string;
                          return (
                            <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-mono-data">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3 h-3" />
                                  {h.operator}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {new Date(h.timestamp).toLocaleString('zh-CN')}
                                </div>
                              </div>
                              <div className="text-sm text-gray-700">{instruction}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
