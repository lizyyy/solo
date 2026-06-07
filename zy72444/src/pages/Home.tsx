import { Users, Ticket, Clock, CheckCircle, Plus } from 'lucide-react';
import StatCard from '@/components/StatCard';
import BatchCard from '@/components/BatchCard';
import { useAppStore } from '@/stores/useAppStore';

export default function Home() {
  const { batches, processSteps, createNewBatch } = useAppStore();

  const totalPeople = batches.reduce((sum, b) => sum + b.totalCount, 0);
  const totalFree = batches.reduce((sum, b) => sum + b.freeTicketCount, 0);
  const reviewingCount = batches.filter((b) => b.status === 'reviewing').length;
  const authorizedCount = batches.filter((b) => b.status === 'authorized').length;

  const handleCreateBatch = () => {
    const now = new Date();
    const weekNum = Math.ceil(now.getDate() / 7);
    const name = `${now.getFullYear()}春季儿童合奏课第${weekNum + 3}周`;
    const date = now.toISOString().split('T')[0];
    createNewBatch(name, date);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary-900">打卡概览</h1>
          <p className="text-primary-600 mt-2">管理儿童合奏课堂的签到与票务核对</p>
        </div>
        <button
          onClick={handleCreateBatch}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300"
        >
          <Plus className="w-5 h-5" />
          新建批次
        </button>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="总人次"
          value={totalPeople}
          icon={Users}
          color="primary"
          trend={8}
        />
        <StatCard
          label="赠票总数"
          value={totalFree}
          icon={Ticket}
          color="sky"
          trend={5}
        />
        <StatCard
          label="待复核"
          value={reviewingCount}
          icon={Clock}
          color="accent"
        />
        <StatCard
          label="已授权"
          value={authorizedCount}
          icon={CheckCircle}
          color="emerald"
          trend={12}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold text-primary-900">
            批次列表
          </h2>
          <p className="text-sm text-primary-500">共 {batches.length} 个批次</p>
        </div>
        <div className="grid grid-cols-2 gap-5">
          {batches.map((batch, index) => (
            <div key={batch.id} style={{ animationDelay: `${index * 100}ms` }}>
              <BatchCard
                batch={batch}
                processStep={processSteps.find((p) => p.batchId === batch.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
