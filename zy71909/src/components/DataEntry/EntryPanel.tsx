import { useState, useMemo } from 'react';
import { X, Plus, Save, User, Music, AlertTriangle } from 'lucide-react';
import { useAppStore, useSelectedBatch } from '../../store/useAppStore';

export function EntryPanel() {
  const { 
    entryPanelOpen, 
    setEntryPanelOpen, 
    students, 
    voiceParts,
    addDeviation,
    selectedBatchId,
  } = useAppStore();
  
  const selectedBatch = useSelectedBatch();
  
  const [selectedVoicePart, setSelectedVoicePart] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [entries, setEntries] = useState<Array<{
    measure: number;
    deviationCents: number;
    isAnomaly: boolean;
  }>>([]);

  const filteredStudents = useMemo(() => {
    if (!selectedVoicePart) return students;
    return students.filter(s => s.voicePartId === selectedVoicePart);
  }, [students, selectedVoicePart]);

  const measures = useMemo(() => {
    if (!selectedBatch) return [];
    return Array.from({ length: selectedBatch.totalMeasures }, (_, i) => i + 1);
  }, [selectedBatch]);

  const handleAddRow = () => {
    setEntries([...entries, { measure: 1, deviationCents: 0, isAnomaly: false }]);
  };

  const handleRemoveRow = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index: number, field: string, value: any) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSaveAll = () => {
    if (!selectedBatchId || !selectedStudent) return;

    entries.forEach(entry => {
      addDeviation({
        studentId: selectedStudent,
        batchId: selectedBatchId,
        measure: entry.measure,
        deviationCents: entry.deviationCents,
        isAnomaly: entry.isAnomaly,
        anomalyType: entry.isAnomaly ? 'manual' : undefined,
        anomalyReason: entry.isAnomaly ? '手动录入标记' : undefined,
        reviewed: false,
      });
    });

    setEntries([]);
    setSelectedStudent(null);
    setEntryPanelOpen(false);
  };

  if (!entryPanelOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={() => setEntryPanelOpen(false)}
      />
      
      <div className="relative w-[500px] h-full bg-white shadow-2xl animate-slide-up flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-cream-200">
          <h2 className="font-serif text-lg font-semibold text-primary">数据录入</h2>
          <button 
            onClick={() => setEntryPanelOpen(false)}
            className="p-2 rounded-lg hover:bg-cream-100 transition-colors"
          >
            <X className="w-5 h-5 text-primary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {!selectedBatchId ? (
            <div className="text-center py-12 text-primary-400">
              <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>请先选择一个排练批次</p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-accent/5 rounded-xl border border-accent/20">
                <p className="text-sm text-accent-700">
                  <span className="font-medium">当前批次：</span>
                  {selectedBatch?.title}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-primary-600 mb-2">
                  选择声部
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedVoicePart(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      !selectedVoicePart
                        ? 'bg-primary text-white'
                        : 'bg-cream-100 text-primary-600 hover:bg-cream-200'
                    }`}
                  >
                    全部
                  </button>
                  {voiceParts.map(vp => (
                    <button
                      key={vp.id}
                      onClick={() => setSelectedVoicePart(vp.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        selectedVoicePart === vp.id
                          ? 'text-white'
                          : 'bg-cream-100 text-primary-600 hover:bg-cream-200'
                      }`}
                      style={{ 
                        backgroundColor: selectedVoicePart === vp.id ? vp.color : undefined 
                      }}
                    >
                      {vp.displayName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-primary-600 mb-2">
                  选择学生
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto scrollbar-thin">
                  {filteredStudents.map(student => (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        selectedStudent === student.id
                          ? 'bg-accent/20 border border-accent/30 text-accent-700'
                          : 'bg-cream-50 border border-cream-200 text-primary-600 hover:border-accent/30'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="truncate">{student.name}</span>
                      {student.partChanged && (
                        <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-primary-600">
                    录入偏差数据
                  </label>
                  <button
                    onClick={handleAddRow}
                    className="text-xs text-accent hover:text-accent-600 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加行
                  </button>
                </div>

                <div className="space-y-2">
                  {entries.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-cream-300 rounded-xl text-center">
                      <p className="text-sm text-primary-400">
                        点击上方「添加行」开始录入数据
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs text-primary-400 px-1">
                        <span className="col-span-3">小节</span>
                        <span className="col-span-5">偏差（音分）</span>
                        <span className="col-span-3">异常</span>
                        <span className="col-span-1"></span>
                      </div>
                      {entries.map((entry, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={entry.measure}
                            onChange={e => handleUpdateRow(index, 'measure', parseInt(e.target.value))}
                            className="col-span-3 px-2 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                          >
                            {measures.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={entry.deviationCents}
                            onChange={e => handleUpdateRow(index, 'deviationCents', parseInt(e.target.value) || 0)}
                            className="col-span-5 px-2 py-2 text-sm rounded-lg border border-cream-300 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent font-mono"
                            placeholder="±音分"
                          />
                          <label className="col-span-3 flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={entry.isAnomaly}
                              onChange={e => handleUpdateRow(index, 'isAnomaly', e.target.checked)}
                              className="rounded text-accent focus:ring-accent"
                            />
                            <span className="text-xs text-primary-500">是</span>
                          </label>
                          <button
                            onClick={() => handleRemoveRow(index)}
                            className="col-span-1 p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-cream-200">
          <button
            onClick={handleSaveAll}
            disabled={!selectedBatchId || !selectedStudent || entries.length === 0}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            保存录入数据
          </button>
        </div>
      </div>
    </div>
  );
}
