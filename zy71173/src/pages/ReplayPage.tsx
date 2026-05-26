import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getRecordById } from '@/game/replay';
import type { GameRecord } from '@/game/types';
import ReplayPlayer from '@/components/ReplayPlayer';
import ReportViewer from '@/components/ReportViewer';

export default function ReplayPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<GameRecord | null>(null);

  useEffect(() => {
    if (recordId) {
      const found = getRecordById(recordId);
      setRecord(found);
    }
  }, [recordId]);

  if (!record) {
    return (
      <div className="w-screen h-screen bg-museum-bg flex flex-col items-center justify-center p-8">
        <div className="card text-center">
          <h2 className="text-2xl font-bold text-museum-danger mb-4">记录不存在</h2>
          <p className="text-gray-400 mb-6">该回放记录可能已被删除或不存在</p>
          <button
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-museum-bg flex flex-col overflow-hidden">
      <div className="p-4">
        <div className="hud-panel flex items-center gap-4">
          <button
            className="btn-secondary px-4 py-2 flex items-center gap-2"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={18} />
            返回
          </button>
          <h1 className="text-xl font-bold text-museum-accent">历史回放</h1>
          <div className="flex-1" />
          <div className="text-gray-400 text-sm">
            记录ID: {record.id}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 px-4 min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <ReplayPlayer record={record} />
        </div>
        <div className="w-[400px] min-h-0 overflow-auto">
          <ReportViewer record={record} />
        </div>
      </div>

      <div className="p-4" />
    </div>
  );
}
