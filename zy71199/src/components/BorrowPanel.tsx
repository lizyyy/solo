import { CheckCircle, XCircle, User, Building, FileText, Calendar, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getLevel } from '@/data/levels';
import { cn } from '@/lib/utils';

interface BorrowPanelProps {
  onClose: () => void;
}

export default function BorrowPanel({ onClose }: BorrowPanelProps) {
  const { currentBorrowRequest, currentLevelId, processBorrow } = useGameStore();

  const level = currentLevelId ? getLevel(currentLevelId) : null;
  const request = level?.borrowRequests?.find(r => r.id === currentBorrowRequest?.requestId);
  const file = level?.files.find(f => f.id === request?.fileId);

  if (!request || !file) return null;

  const handleProcess = (approved: boolean, registered: boolean) => {
    processBorrow(approved, registered);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a3a2e] rounded-2xl border-2 border-[#d4a017]/40
        shadow-2xl shadow-black/50 max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-[#8e44ad] to-[#9b59b6] px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-white" />
            <div>
              <h2 className="text-white font-bold text-lg">借阅请求处理</h2>
              <p className="text-white/70 text-sm">请检查借阅登记是否合规</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-[#d4a017]" />
              <span className="text-white/80 font-medium">借阅文件</span>
            </div>
            <p className="text-white font-bold">{file.name}</p>
            <p className="text-white/60 text-sm mt-1">{file.content.slice(0, 50)}...</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-[#3498db]" />
                <span className="text-white/60 text-sm">借阅人</span>
              </div>
              <p className="text-white font-bold">{request.borrower}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Building size={16} className="text-[#27ae60]" />
                <span className="text-white/60 text-sm">部门</span>
              </div>
              <p className="text-white font-bold">{request.department}</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-[#e67e22]" />
              <span className="text-white/60 text-sm">借阅用途</span>
            </div>
            <p className="text-white">{request.purpose}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[#e74c3c]" />
              <span className="text-white/60 text-sm">归还期限</span>
            </div>
            <p className="text-white font-bold">{request.deadline}</p>
            {request.needsApproval && (
              <div className="mt-2 flex items-center gap-2 text-yellow-400 text-sm">
                <AlertTriangle size={14} />
                <span>该借阅需要上级审批</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={() => handleProcess(true, true)}
            className={cn(
              'w-full py-3 rounded-xl font-bold transition-all duration-200',
              'flex items-center justify-center gap-2',
              'bg-green-600 hover:bg-green-500 text-white',
              'shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-600/40'
            )}
          >
            <CheckCircle size={20} />
            批准借阅（已登记+已审批）
          </button>

          {request.needsApproval && (
            <button
              onClick={() => handleProcess(false, true)}
              className={cn(
                'w-full py-3 rounded-xl font-bold transition-all duration-200',
                'flex items-center justify-center gap-2',
                'bg-yellow-600 hover:bg-yellow-500 text-white',
                'shadow-lg shadow-yellow-600/30'
              )}
            >
              <XCircle size={20} />
              已登记但未审批（不批准）
            </button>
          )}

          <button
            onClick={() => handleProcess(false, false)}
            className={cn(
              'w-full py-3 rounded-xl font-bold transition-all duration-200',
              'flex items-center justify-center gap-2',
              'bg-red-600 hover:bg-red-500 text-white',
              'shadow-lg shadow-red-600/30'
            )}
          >
            <XCircle size={20} />
            拒绝借阅（未登记）
          </button>
        </div>
      </div>
    </div>
  );
}