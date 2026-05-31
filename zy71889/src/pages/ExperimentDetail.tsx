import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Layers,
  Clock,
  FlaskConical,
  FileText,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Timeline } from '@/components/Timeline';
import { ViscosityPanel } from '@/components/ViscosityPanel';
import { CorrectionForm } from '@/components/CorrectionForm';
import { ConfirmationForm } from '@/components/ConfirmationForm';
import { GradingSheetView } from '@/components/GradingSheetView';
import { useLabStore } from '@/store/useLabStore';
import { formatDateTime, getStatusLabel } from '@/lib/api';
import type { TimelineEvent, ExperimentBatch } from '@shared/types';

const statusClass: Record<ExperimentBatch['status'], string> = {
  pending: 'tag-pending',
  processing: 'tag-pending',
  completed: 'tag-completed',
  needs_review: 'tag-needs-review',
};

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentBatch = useLabStore((state) => state.currentBatch);
  const timeline = useLabStore((state) => state.timeline);
  const batchVersions = useLabStore((state) => state.batchVersions);
  const loading = useLabStore((state) => state.loading);
  const error = useLabStore((state) => state.error);
  const clearError = useLabStore((state) => state.clearError);
  const resetCurrentBatch = useLabStore((state) => state.resetCurrentBatch);

  const fetchBatch = useLabStore((state) => state.fetchBatch);
  const fetchTimeline = useLabStore((state) => state.fetchTimeline);
  const fetchViscosityHistory = useLabStore((state) => state.fetchViscosityHistory);
  const fetchGradingSheet = useLabStore((state) => state.fetchGradingSheet);
  const fetchBatchVersions = useLabStore((state) => state.fetchBatchVersions);

  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'grading'>('timeline');

  useEffect(() => {
    if (!id) return;

    fetchBatch(id);
    fetchTimeline(id);
    fetchViscosityHistory(id);
    fetchGradingSheet(id);
    fetchBatchVersions(id);

    return () => {
      resetCurrentBatch();
    };
  }, [id, fetchBatch, fetchTimeline, fetchViscosityHistory, fetchGradingSheet, fetchBatchVersions, resetCurrentBatch]);

  const handleEvidenceClick = (evidenceId: string) => {
    const element = document.querySelector(`[data-event-id="${evidenceId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
  };

  if (!id) {
    return <div className="p-8 text-center">无效的批次ID</div>;
  }

  if (loading.batch && !currentBatch) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center">
          <FlaskConical size={32} className="mx-auto text-ink-300 animate-pulse-soft mb-3" />
          <p className="text-ink-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !currentBatch) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="card p-6 max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto text-brick-500 mb-3" />
          <p className="text-ink-700 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="btn">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink-800 text-white sticky top-0 z-40">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center text-ink-200 hover:text-white hover:bg-ink-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-serif text-lg font-semibold truncate">
                  {currentBatch?.studentName || '加载中...'}
                </h1>
                {currentBatch && (
                  <span className={`tag ${statusClass[currentBatch.status]}`}>
                    {getStatusLabel(currentBatch.status)}
                  </span>
                )}
                {currentBatch && currentBatch.version > 1 && (
                  <span className="tag tag-insufficient">
                    <Layers size={10} className="mr-1" />
                    第 {currentBatch.version} 版
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-300 overflow-hidden">
                {currentBatch && (
                  <>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {currentBatch.studentId}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers size={12} />
                      {currentBatch.materialId}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(currentBatch.createdAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {batchVersions.length > 1 && (
        <div className="bg-ink-50 border-b border-ink-200">
          <div className="container py-3">
            <div className="flex items-center gap-2 overflow-x-auto text-sm">
              <span className="text-ink-500 flex-shrink-0">历史版本：</span>
              {batchVersions.map((version) => (
                <Link
                  key={version.id}
                  to={`/experiment/${version.id}`}
                  className={`px-2 py-1 text-xs whitespace-nowrap border ${
                    version.id === currentBatch?.id
                      ? 'bg-ink-800 text-white border-ink-800'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
                  } transition-colors`}
                >
                  v{version.version} · {formatDate(version.createdAt)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4 border-b border-ink-200">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'timeline'
                    ? 'border-ink-800 text-ink-800'
                    : 'border-transparent text-ink-500 hover:text-ink-700'
                }`}
              >
                时间线
              </button>
              <button
                onClick={() => setActiveTab('grading')}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'grading'
                    ? 'border-ink-800 text-ink-800'
                    : 'border-transparent text-ink-500 hover:text-ink-700'
                }`}
              >
                批改表
              </button>
            </div>

            {activeTab === 'timeline' ? (
              loading.timeline ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="card p-4 animate-pulse-soft">
                      <div className="h-4 bg-ink-100 rounded w-1/4 mb-3" />
                      <div className="h-4 bg-ink-100 rounded w-full mb-2" />
                      <div className="h-4 bg-ink-100 rounded w-5/6" />
                    </div>
                  ))}
                </div>
              ) : (
                <Timeline
                  events={timeline}
                  onEventClick={handleEventClick}
                  highlightedEventId={selectedEvent?.id}
                />
              )
            ) : (
              <GradingSheetView batchId={id} onEvidenceClick={handleEvidenceClick} />
            )}
          </div>

          <div className="w-full lg:w-80 space-y-4 flex-shrink-0">
            {error && (
              <div className="p-3 bg-brick-50 border border-brick-200 text-brick-700 text-sm flex items-start justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-brick-500 hover:text-brick-700 flex-shrink-0 ml-2">
                  <X size={14} />
                </button>
              </div>
            )}

            <ViscosityPanel batchId={id} />

            <CorrectionForm batchId={id} />

            <ConfirmationForm batchId={id} relatedEvent={selectedEvent} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}
