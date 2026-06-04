import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Link as LinkIcon } from 'lucide-react';
import type { StrainRecord, PhotoEvidence, NoteEvidence, EvidenceConflict, ThresholdAlert, EvidenceChainNode } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UnitConverterDisplay, CaliberSelector } from '@/components/common/UnitConverter';
import { PhotoEvidenceCard, PhotoImportForm } from '@/components/evidence/PhotoEvidenceCard';
import { NoteEvidenceCard, NoteReviewForm } from '@/components/evidence/NoteEvidenceCard';
import { ConflictCard } from '@/components/conflicts/ConflictCard';
import { ThresholdAlertCard } from '@/components/reviews/ThresholdAlertCard';
import { EvidenceChainDisplay } from './EvidenceChainDisplay';
import { useCleaningStore } from '@/store/useCleaningStore';
import { createConversionRecord } from '@/utils/unitConverter';

interface RecordDetailPanelProps {
  record: StrainRecord;
  photoEvidences: PhotoEvidence[];
  noteEvidences: NoteEvidence[];
  conflicts: EvidenceConflict[];
  thresholdAlerts: ThresholdAlert[];
  evidenceChain: EvidenceChainNode[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const RecordDetailPanel: React.FC<RecordDetailPanelProps> = ({
  record,
  photoEvidences,
  noteEvidences,
  conflicts,
  thresholdAlerts,
  evidenceChain,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const { addPhotoEvidence, addNoteEvidence, updateRecordCaliber, setWorkflowStep, workflowStep, unitConversions } = useCleaningStore();
  const [activeTab, setActiveTab] = useState<'summary' | 'evidence' | 'issues' | 'chain'>('summary');
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  const currentConversion = unitConversions.find(c => c.recordId === record.id);

  const handleAddPhoto = (evidence: Omit<PhotoEvidence, 'id'>) => {
    addPhotoEvidence(evidence);
    setShowPhotoForm(false);
    if (workflowStep < 1) {
      setWorkflowStep(1);
    }
  };

  const handleAddNote = (evidence: Omit<NoteEvidence, 'id'>) => {
    addNoteEvidence(evidence);
    setShowNoteForm(false);
    if (workflowStep < 2) {
      setWorkflowStep(2);
    }
  };

  const handleCaliberSelect = (version: string, factor: number) => {
    const conversion = createConversionRecord(
      record.id,
      record.originalValue,
      record.originalUnit,
      record.cleanedUnit
    );
    updateRecordCaliber(record.id, conversion);
  };

  const tabs = [
    { id: 'summary' as const, label: '清洗结果', count: null },
    { id: 'evidence' as const, label: '证据材料', count: photoEvidences.length + noteEvidences.length },
    { id: 'issues' as const, label: '待处理问题', count: conflicts.filter(c => c.resolutionStatus === 'pending').length + thresholdAlerts.filter(a => a.reviewStatus === 'pending_review').length },
    { id: 'chain' as const, label: '证据链', count: evidenceChain.length },
  ];

  return (
    <div className="w-full max-w-4xl bg-white border-l border-neutral-200 h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">记录详情</span>
              <span className="font-mono text-sm text-neutral-500">{record.id}</span>
            </div>
            <div className="text-sm text-neutral-500">{record.materialName} · {record.materialType}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={record.recordStatus} type="record" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </div>

      <div className="border-b border-neutral-200 shrink-0">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="text-sm text-neutral-500 mb-1">原始值</div>
                <div className="font-mono text-2xl font-bold text-neutral-900">
                  {record.originalValue}
                  <span className="text-base text-neutral-500">{record.originalUnit}</span>
                </div>
              </div>
              <div className={`p-4 border rounded-xl ${
                record.recordStatus === 'normal' ? 'bg-success-50 border-success-200' :
                record.recordStatus === 'over_threshold' || record.recordStatus === 'pending_review' ? 'bg-warning-50 border-warning-200' :
                'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="text-sm text-neutral-500 mb-1">清洗后值</div>
                <div className={`font-mono text-2xl font-bold ${
                  record.recordStatus === 'normal' ? 'text-success-700' :
                  record.recordStatus === 'over_threshold' || record.recordStatus === 'pending_review' ? 'text-warning-700' :
                  'text-neutral-900'
                }`}>
                  {record.cleanedValue}
                  <span className="text-base text-neutral-500">{record.cleanedUnit}</span>
                </div>
              </div>
            </div>

            {currentConversion && (
              <UnitConverterDisplay
                conversion={currentConversion}
                showHistory={true}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="text-sm font-medium text-neutral-900 mb-2">口径来源</div>
                <div className="text-sm text-neutral-700">{record.caliberSource}</div>
              </div>
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="text-sm font-medium text-neutral-900 mb-2">证据来源</div>
                <div className="flex gap-2">
                  {record.evidenceSources.includes('photo') && (
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                      工况照片
                    </span>
                  )}
                  {record.evidenceSources.includes('note') && (
                    <span className="px-2 py-1 bg-success-100 text-success-700 text-xs font-medium rounded">
                      手写备注
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-primary-800">说明</span>
              </div>
              <p className="text-sm text-primary-700">{record.description}</p>
            </div>

            <CaliberSelector
              fromUnit={record.originalUnit}
              toUnit={record.cleanedUnit}
              selectedVersion={record.caliberSource.split(' ')[0]}
              onSelect={handleCaliberSelect}
            />
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">工况照片证据 ({photoEvidences.length})</h3>
              <button
                onClick={() => setShowPhotoForm(!showPhotoForm)}
                className="px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
              >
                {showPhotoForm ? '取消' : '导入照片'}
              </button>
            </div>

            {showPhotoForm && (
              <PhotoImportForm recordId={record.id} onImport={handleAddPhoto} />
            )}

            {photoEvidences.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {photoEvidences.map((photo) => (
                  <PhotoEvidenceCard
                    key={photo.id}
                    evidence={photo}
                    isConflict={conflicts.some(c => c.photoEvidenceId === photo.id && c.resolutionStatus === 'pending')}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-500 bg-neutral-50 rounded-lg">
                暂无工况照片证据
              </div>
            )}

            <div className="flex items-center justify-between mt-6 mb-4">
              <h3 className="font-semibold text-lg">手写巡检备注 ({noteEvidences.length})</h3>
              <button
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="px-3 py-1.5 bg-success-500 text-white text-sm font-medium rounded-lg hover:bg-success-600 transition-colors"
              >
                {showNoteForm ? '取消' : '林老师审阅'}
              </button>
            </div>

            {showNoteForm && (
              <NoteReviewForm recordId={record.id} onSubmit={handleAddNote} />
            )}

            {noteEvidences.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {noteEvidences.map((note) => (
                  <NoteEvidenceCard
                    key={note.id}
                    evidence={note}
                    isConflict={conflicts.some(c => c.noteEvidenceId === note.id && c.resolutionStatus === 'pending')}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-500 bg-neutral-50 rounded-lg">
                暂无手写巡检备注
              </div>
            )}
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-4">证据冲突 ({conflicts.filter(c => c.resolutionStatus === 'pending').length} 待处理)</h3>
              {conflicts.length > 0 ? (
                <div className="space-y-4">
                  {conflicts.map((conflict) => (
                    <ConflictCard
                      key={conflict.id}
                      conflict={conflict}
                      record={{ id: record.id, materialName: record.materialName }}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 bg-neutral-50 rounded-lg">
                  暂无证据冲突
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4">超阈值告警 ({thresholdAlerts.filter(a => a.reviewStatus === 'pending_review').length} 待复核)</h3>
              {thresholdAlerts.length > 0 ? (
                <div className="space-y-4">
                  {thresholdAlerts.map((alert) => (
                    <ThresholdAlertCard
                      key={alert.id}
                      alert={alert}
                      record={{ id: record.id, materialName: record.materialName }}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 bg-neutral-50 rounded-lg">
                  暂无超阈值告警
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chain' && (
          <EvidenceChainDisplay chain={evidenceChain} />
        )}
      </div>
    </div>
  );
};
