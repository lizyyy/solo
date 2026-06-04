import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, PlusCircle, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store';
import { BillRecord, RecordStatus } from '../../shared/types';
import { DataTable, Column } from '../components/DataTable';
import EvidenceDrawer from '../components/EvidenceDrawer';
import { cn } from '../lib/utils';

type TabType = 'smooth' | 'gap' | 'supplement';

const tabConfig: Record<TabType, { label: string; icon: typeof CheckCircle; color: string }> = {
  smooth: { label: '顺利记录', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
  gap: { label: '断档记录', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  supplement: { label: '补录记录', icon: PlusCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export default function ResultPage() {
  const [activeTab, setActiveTab] = useState<TabType>('smooth');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ smooth: 0, gap: 0, supplement: 0, total: 0 });
  const { records, setRecords, selectedRecord, setSelectedRecord, drawerOpen, setDrawerOpen } = useAppStore();

  const filteredRecords = records.filter((r) => r.status === activeTab);

  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      try {
        const [smoothRes, gapRes, supplementRes] = await Promise.all([
          api.getRecords({ status: 'smooth' as RecordStatus, pageSize: 100 }),
          api.getRecords({ status: 'gap' as RecordStatus, pageSize: 100 }),
          api.getRecords({ status: 'supplement' as RecordStatus, pageSize: 100 }),
        ]);

        const allRecords = [...smoothRes.records, ...gapRes.records, ...supplementRes.records];
        setRecords(allRecords);
        setStats({
          smooth: smoothRes.total,
          gap: gapRes.total,
          supplement: supplementRes.total,
          total: smoothRes.total + gapRes.total + supplementRes.total,
        });
      } catch (error) {
        console.error('加载记录失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [activeTab, setRecords]);

  const handleRowClick = (row: BillRecord) => {
    setSelectedRecord(row);
    setDrawerOpen(true);
  };

  const handleViewEvidence = (row: BillRecord) => {
    setSelectedRecord(row);
    setDrawerOpen(true);
  };

  const columns: Column<BillRecord>[] = [
    {
      key: 'recordNo',
      header: '记录编号',
      width: '140px',
      render: (row) => <span className="font-mono text-sm font-medium text-gray-900">{row.recordNo}</span>,
    },
    {
      key: 'date',
      header: '日期',
      width: '120px',
      render: (row) => <span className="font-mono text-gray-600">{row.date}</span>,
    },
    {
      key: 'teacherName',
      header: '老师姓名',
      width: '100px',
    },
    {
      key: 'amount',
      header: '金额',
      width: '100px',
      align: 'right',
      numeric: true,
      render: (row) => <span className="font-mono font-medium">¥{row.amount.toFixed(2)}</span>,
    },
    {
      key: 'itemType',
      header: '项目类型',
      render: (row) => <span className="text-gray-700">{row.itemType}</span>,
    },
  ];

  const statCards = [
    { label: '顺利记录', value: stats.smooth, icon: CheckCircle, color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
    { label: '断档记录', value: stats.gap, icon: AlertTriangle, color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
    { label: '补录记录', value: stats.supplement, icon: PlusCircle, color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
    { label: '总计', value: stats.total, icon: TrendingUp, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">整合结果</h1>
          <p className="text-sm text-gray-500 mt-1">查看和管理所有对账记录</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={cn('rounded-xl p-4 border border-gray-200', card.bgColor)}>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn('text-sm font-medium', card.textColor)}>{card.label}</p>
                <p className={cn('text-2xl font-bold mt-1', card.textColor)}>{card.value}</p>
              </div>
              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', card.color)}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          {(Object.keys(tabConfig) as TabType[]).map((tab) => {
            const config = tabConfig[tab];
            const count = stats[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
                  isActive ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <config.icon className="w-4 h-4" />
                <span>{config.label}</span>
                <span
                  className={cn(
                    'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium border',
                    isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : config.color
                  )}
                >
                  {count}
                </span>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          <DataTable
            columns={columns}
            data={filteredRecords}
            onRowClick={handleRowClick}
            onViewEvidence={handleViewEvidence}
            loading={loading}
          />
        </div>
      </div>

      <EvidenceDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
      />
    </div>
  );
}
