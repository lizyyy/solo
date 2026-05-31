import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useClassroomStore } from '@/store/useClassroomStore';
import { ExportPanel } from '@/components/ExportPanel';

export const ExportPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClassroom, getClassroomRecords, getClassroomScoreSheets } = useClassroomStore();

  const classroom = id ? getClassroom(id) : undefined;
  const records = id ? getClassroomRecords(id) : [];
  const scoreSheets = id ? getClassroomScoreSheets(id) : [];

  if (!classroom) {
    return (
      <div className="min-h-screen bg-lab-bg p-8 flex items-center justify-center">
        <div className="text-center text-lab-text-muted">
          <p className="font-mono">课堂不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 border-2 border-lab-border text-sm font-mono hover:bg-lab-border/20"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lab-bg">
      <div className="border-b-2 border-lab-border bg-lab-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/classroom/${id}`)}
                className="p-2 border-2 border-lab-border hover:border-lab-accent transition-colors"
              >
                <ArrowLeft size={16} className="text-lab-text" />
              </button>
              <div>
                <h1 className="text-lg font-mono text-lab-text flex items-center gap-2">
                  <Download size={18} className="text-lab-accent" />
                  导出课堂记录
                </h1>
                <p className="text-xs text-lab-text-muted font-mono">{classroom.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard
            label="总记录数"
            value={records.length}
            color="text-lab-text"
          />
          <StatCard
            label="补材料"
            value={records.filter((r) => r.materialType === 'supplement').length}
            color="text-lab-supplement"
          />
          <StatCard
            label="改结论"
            value={records.filter((r) => r.materialType === 'conclusion_change').length}
            color="text-lab-conclusion"
          />
        </div>

        <div className="mb-6 p-4 border-2 border-lab-border bg-lab-card">
          <h3 className="text-sm font-mono text-lab-text-muted mb-3">导出说明</h3>
          <ul className="text-xs font-mono text-lab-text-muted space-y-1">
            <li>• <span className="text-lab-text">文本格式</span>：适合打印或传阅，格式简洁</li>
            <li>• <span className="text-lab-text">JSON格式</span>：完整数据，可导入系统继续编辑</li>
            <li>• 所有导出文件包含完整时间戳，确保一致性</li>
            <li>• 下一班教学可直接使用导出文件，无需再翻聊天记录</li>
          </ul>
        </div>

        <ExportPanel
          classroom={classroom}
          records={records}
          scoreSheets={scoreSheets}
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <div className="p-4 border-2 border-lab-border bg-lab-card">
    <div className="text-xs text-lab-text-muted font-mono mb-1">{label}</div>
    <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
  </div>
);
