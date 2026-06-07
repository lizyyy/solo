import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useReviewStore } from '../store/useReviewStore';
import BasicInfo from '../components/detail/BasicInfo';
import StepProgress from '../components/detail/StepProgress';
import EvidenceTimeline from '../components/detail/EvidenceTimeline';
import ConflictSection from '../components/detail/ConflictSection';
import HistoryLogs from '../components/detail/HistoryLogs';
import ParamsSection from '../components/detail/ParamsSection';
import ActionButtons from '../components/detail/ActionButtons';
import { Loader2 } from 'lucide-react';

const DetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { records, selectRecord, selectedRecord } = useReviewStore();

  useEffect(() => {
    if (id) {
      selectRecord(id);
    }
  }, [id, selectRecord]);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  const record = selectedRecord || records.find(r => r.id === id);

  if (!record) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BasicInfo record={record} />
      <StepProgress currentStep={record.currentStep} />
      
      {record.conflicts && record.conflicts.length > 0 && (
        <ConflictSection conflicts={record.conflicts} recordId={record.id} />
      )}
      
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <EvidenceTimeline evidences={record.evidences} />
          <ActionButtons recordId={record.id} currentStatus={record.status} />
        </div>
        
        <div className="space-y-6">
          <HistoryLogs logs={record.operationLogs} />
          <ParamsSection params={record.modelParams} />
        </div>
      </div>
    </div>
  );
};

export default DetailPage;
