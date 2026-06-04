import React, { useState, useMemo } from 'react';
import { Filter, Search, BarChart3, AlertTriangle, AlertOctagon, CheckCircle, RefreshCw } from 'lucide-react';
import { useCleaningStore } from '@/store/useCleaningStore';
import { StepNavigator } from '@/components/layout/StepNavigator';
import { RecordsTable } from '@/components/records/RecordsTable';
import { RecordDetailPanel } from '@/components/records/RecordDetailPanel';
import type { StrainRecord, RecordStatus } from '@/types';

const CleaningWorkbench: React.FC = () => {
  const {
    records,
    photoEvidences,
    noteEvidences,
    conflicts,
    thresholdAlerts,
    evidenceChain,
    workflowStep,
    setWorkflowStep,
    resetAllData,
  } = useCleaningStore();

  const [selectedRecord, setSelectedRecord] = useState<StrainRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        record.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.materialType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || record.recordStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const recordPhotoEvidences = useMemo(() => {
    if (!selectedRecord) return [];
    return photoEvidences.filter((p) => p.recordId === selectedRecord.id);
  }, [selectedRecord, photoEvidences]);

  const recordNoteEvidences = useMemo(() => {
    if (!selectedRecord) return [];
    return noteEvidences.filter((n) => n.recordId === selectedRecord.id);
  }, [selectedRecord, noteEvidences]);

  const recordConflicts = useMemo(() => {
    if (!selectedRecord) return [];
    return conflicts.filter((c) => c.recordId === selectedRecord.id);
  }, [selectedRecord, conflicts]);

  const recordThresholdAlerts = useMemo(() => {
    if (!selectedRecord) return [];
    return thresholdAlerts.filter((a) => a.recordId === selectedRecord.id);
  }, [selectedRecord, thresholdAlerts]);

  const recordEvidenceChain = useMemo(() => {
    if (!selectedRecord) return [];
    return evidenceChain.filter((e) => e.recordId === selectedRecord.id);
  }, [selectedRecord, evidenceChain]);

  const stats = useMemo(() => {
    const total = records.length;
    const normal = records.filter((r) => r.recordStatus === 'normal').length;
    const overThreshold = records.filter((r) => r.recordStatus === 'over_threshold' || r.recordStatus === 'pending_review').length;
    const supplemented = records.filter((r) => r.recordStatus === 'supplemented').length;
    const conflict = records.filter((r) => r.recordStatus === 'conflict').length;
    return { total, normal, overThreshold, supplemented, conflict };
  }, [records]);

  const currentIndex = selectedRecord
    ? filteredRecords.findIndex((r) => r.id === selectedRecord.id)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedRecord(filteredRecords[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredRecords.length - 1) {
      setSelectedRecord(filteredRecords[currentIndex + 1]);
    }
  };

  const statusOptions: { value: RecordStatus | 'all'; label: string; color: string }[] = [
    { value: 'all', label: '全部', color: 'text-neutral-600' },
    { value: 'normal', label: '顺利', color: 'text-success-600' },
    { value: 'over_threshold', label: '超阈值', color: 'text-warning-600' },
    { value: 'pending_review', label: '待复核', color: 'text-warning-600' },
    { value: 'supplemented', label: '补录', color: 'text-info-600' },
    { value: 'conflict', label: '冲突', color: 'text-danger-600' },
  ];

  return (
    <div className="h-full flex flex-col">
      <StepNavigator />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">材料拉伸应变清洗工作台</h1>
            <p className="text-neutral-500 mt-1">整合工况照片与手写巡检备注，完成数据清洗与单位换算</p>
          </div>
          <button
            onClick={resetAllData}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重置数据
          </button>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-neutral-500" />
              <span className="text-sm text-neutral-600">总计记录</span>
            </div>
            <div className="font-mono text-3xl font-bold text-neutral-900">{stats.total}</div>
          </div>
          <div className="bg-white border border-success-200 rounded-xl p-4 bg-success-50/50">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-success-500" />
              <span className="text-sm text-success-700">顺利</span>
            </div>
            <div className="font-mono text-3xl font-bold text-success-700">{stats.normal}</div>
          </div>
          <div className="bg-white border border-warning-200 rounded-xl p-4 bg-warning-50/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="w-5 h-5 text-warning-500" />
              <span className="text-sm text-warning-700">超阈值/待复核</span>
            </div>
            <div className="font-mono text-3xl font-bold text-warning-700">{stats.overThreshold}</div>
          </div>
          <div className="bg-white border border-info-200 rounded-xl p-4 bg-info-50/50">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-info-500" />
              <span className="text-sm text-info-700">补录</span>
            </div>
            <div className="font-mono text-3xl font-bold text-info-700">{stats.supplemented}</div>
          </div>
          <div className="bg-white border border-danger-200 rounded-xl p-4 bg-danger-50/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
              <span className="text-sm text-danger-700">冲突</span>
            </div>
            <div className="font-mono text-3xl font-bold text-danger-700">{stats.conflict}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索记录ID、材料名称..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-neutral-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
              className="px-3 py-2.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-4 h-full flex-1">
          <div className={`transition-all duration-300 ${selectedRecord ? 'flex-1' : 'w-full'}`}>
            <RecordsTable
              records={filteredRecords}
              onSelectRecord={setSelectedRecord}
              selectedRecordId={selectedRecord?.id}
            />
          </div>

          {selectedRecord && (
            <RecordDetailPanel
              record={selectedRecord}
              photoEvidences={recordPhotoEvidences}
              noteEvidences={recordNoteEvidences}
              conflicts={recordConflicts}
              thresholdAlerts={recordThresholdAlerts}
              evidenceChain={recordEvidenceChain}
              onClose={() => setSelectedRecord(null)}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={currentIndex > 0}
              hasNext={currentIndex < filteredRecords.length - 1}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CleaningWorkbench;
