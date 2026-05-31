import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { STATUS_COLORS } from '@/types';
import type { InventoryRecord } from '@/types';
import StatCard from '@/components/StatCard';
import InventoryScene from '@/components/InventoryScene';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import { formatDateTime, calculateCompletionRate } from '@/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const records = useAppStore(state => state.records);
  const permissionChanges = useAppStore(state => state.permissionChanges);
  const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const todayRecords = records.filter(r => r.createdAt.startsWith(todayStr));

    return {
      total: records.length,
      pending: records.filter(r => r.status === 'pending').length,
      completed: records.filter(r => r.status === 'completed').length,
      error: records.filter(r => r.status === 'error').length,
      processing: records.filter(r => r.status === 'processing').length,
      todayNew: todayRecords.length,
      idempotentInvalid: records.filter(r => !r.idempotentValid).length,
      permissionChanges: permissionChanges.length,
      completionRate: calculateCompletionRate(
        records.length,
        records.filter(r => r.status === 'completed').length
      ),
    };
  }, [records, permissionChanges]);

  const pendingRecords = useMemo(() => {
    return records
      .filter(r => r.status === 'pending' || r.status === 'error')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [records]);

  const statusLegend = [
    { status: 'processing', label: '处理中' },
    { status: 'completed', label: '已完成' },
    { status: 'pending', label: '待处理' },
    { status: 'error', label: '异常' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">数据看板</h1>
          <p className="mt-1 text-slate-400 text-sm">
            库存预占释放状态总览与3D可视化
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">状态图例：</span>
          {statusLegend.map(item => (
            <div key={item.status} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] }}
              />
              <span className="text-slate-400 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="总记录数"
          value={stats.total}
          icon={Package}
          color="#06B6D4"
          subtitle={`今日新增 ${stats.todayNew} 条`}
          trend={stats.todayNew > 0 ? 15 : 0}
        />
        <StatCard
          title="待处理"
          value={stats.pending}
          icon={Clock}
          color="#F59E0B"
          subtitle="需要人工复核"
        />
        <StatCard
          title="已完成"
          value={stats.completed}
          icon={CheckCircle2}
          color="#10B981"
          subtitle={`完成率 ${stats.completionRate}%`}
          trend={5}
        />
        <StatCard
          title="异常记录"
          value={stats.error + stats.idempotentInvalid}
          icon={AlertTriangle}
          color="#EF4444"
          subtitle={`幂等失效 ${stats.idempotentInvalid} 条`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-white font-semibold">3D 库存状态可视化</h2>
            </div>
            <span className="text-slate-500 text-xs">
              显示前50条记录，点击立方体查看详情
            </span>
          </div>
          <div className="h-[500px]">
            <InventoryScene
              records={records}
              onSelectRecord={(record) => setSelectedRecord(record)}
            />
          </div>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-white font-semibold">待处理队列</h2>
            <button
              onClick={() => navigate('/review')}
              className="text-cyan-400 text-sm hover:text-cyan-300 flex items-center gap-1"
            >
              全部查看 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-700/50">
            {pendingRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                暂无待处理记录
              </div>
            ) : (
              pendingRecords.map(record => (
                <div
                  key={record.id}
                  className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/records/${record.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={record.status} size="sm" />
                        <SourceBadge source={record.source} />
                      </div>
                      <p className="text-white text-sm font-medium truncate">
                        {record.interfaceName}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {record.stockCode} · 预占 {record.preOccupyQty}
                      </p>
                      {record.pendingReason && (
                        <p className="text-amber-400 text-xs mt-2 line-clamp-2">
                          {record.pendingReason}
                        </p>
                      )}
                    </div>
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="记录详情"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedRecord.status} />
              <SourceBadge source={selectedRecord.source} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-500 text-xs">库存编码</label>
                <p className="text-white font-mono">{selectedRecord.stockCode}</p>
              </div>
              <div>
                <label className="text-slate-500 text-xs">接口名称</label>
                <p className="text-white font-mono">{selectedRecord.interfaceName}</p>
              </div>
              <div>
                <label className="text-slate-500 text-xs">预占数量</label>
                <p className="text-white">{selectedRecord.preOccupyQty}</p>
              </div>
              <div>
                <label className="text-slate-500 text-xs">已释放数量</label>
                <p className="text-white">{selectedRecord.releaseQty}</p>
              </div>
              <div>
                <label className="text-slate-500 text-xs">操作人</label>
                <p className="text-white">{selectedRecord.operator}</p>
              </div>
              <div>
                <label className="text-slate-500 text-xs">幂等键</label>
                <p className={`font-mono text-sm ${selectedRecord.idempotentValid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedRecord.idempotentKey}
                </p>
              </div>
            </div>

            {selectedRecord.pendingReason && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <label className="text-amber-400 text-xs font-medium">待处理原因</label>
                <p className="text-amber-300 text-sm mt-1">{selectedRecord.pendingReason}</p>
              </div>
            )}

            <div>
              <label className="text-slate-500 text-xs">原始数据</label>
              <pre className="mt-1 text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(selectedRecord.rawData, null, 2)}
              </pre>
            </div>

            <div className="text-xs text-slate-500">
              创建时间：{formatDateTime(selectedRecord.createdAt)}
              <br />
              更新时间：{formatDateTime(selectedRecord.updatedAt)}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setSelectedRecord(null);
                  navigate(`/records/${selectedRecord.id}`);
                }}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                查看完整详情
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
