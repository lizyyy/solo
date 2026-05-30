import { useState } from 'react';
import { Clock, FileWarning, FileText, ChevronRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AuditLog, BadDataRecord, Decision } from '@shared/types';
import { cn } from '@/lib/utils';
import Timeline from '@/components/Timeline';
import BadDataTable from '@/components/BadDataTable';

const mockAuditLogs: AuditLog[] = [
  {
    id: 'log1',
    action: 'decision',
    entityType: 'decision',
    entityId: 'dec_001',
    afterChange: { name: '2024夏季巡演返场', selectedCount: 8 },
    operator: '张经纪',
    timestamp: '2024-05-20 16:45:23',
    ip: '192.168.1.100'
  },
  {
    id: 'log2',
    action: 'import',
    entityType: 'vote',
    beforeChange: { count: 12847 },
    afterChange: { count: 12994, added: 147 },
    operator: '李助理',
    timestamp: '2024-05-20 14:32:15',
    ip: '192.168.1.101'
  },
  {
    id: 'log3',
    action: 'create',
    entityType: 'track',
    entityId: 'track_045',
    afterChange: { name: '晴天', artist: '周杰伦', duration: 269 },
    operator: '张经纪',
    timestamp: '2024-05-18 11:20:45',
    ip: '192.168.1.100'
  },
  {
    id: 'log4',
    action: 'update',
    entityType: 'copyright',
    entityId: 'copy_023',
    beforeChange: { status: 'pending' },
    afterChange: { status: 'active' },
    operator: 'admin',
    timestamp: '2024-05-17 09:15:30',
    ip: '127.0.0.1'
  },
  {
    id: 'log5',
    action: 'delete',
    entityType: 'track',
    entityId: 'track_012',
    beforeChange: { name: '旧曲目', artist: '未知' },
    operator: '张经纪',
    timestamp: '2024-05-16 15:42:18',
    ip: '192.168.1.100'
  }
];

const mockBadData: BadDataRecord[] = [
  {
    id: 'bd1',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 15,
    rawContent: ',张三,2024-05-20',
    errorType: 'missing_field',
    errorMessage: '缺少曲目名称字段',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  },
  {
    id: 'bd2',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 23,
    rawContent: '未知歌曲,李四,2024-05-20',
    errorType: 'unknown_track',
    errorMessage: '曲目不存在于候选库',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  },
  {
    id: 'bd3',
    sourceFile: 'votes_20240520.csv',
    lineNumber: 45,
    rawContent: '海阔天空,张三,2024-05-20',
    errorType: 'duplicate',
    errorMessage: '同一投票人重复投票',
    detectedAt: '2024-05-20 14:32:15',
    importSession: 'sess_001'
  },
  {
    id: 'bd4',
    sourceFile: 'votes_20240518.csv',
    lineNumber: 8,
    rawContent: '光辉岁月,王五,invalid_date',
    errorType: 'invalid_format',
    errorMessage: '日期格式错误',
    detectedAt: '2024-05-18 10:25:33',
    importSession: 'sess_001'
  },
  {
    id: 'bd5',
    sourceFile: 'votes_20240515.csv',
    lineNumber: 67,
    rawContent: '稻香,赵六,2024-05-15,extra_field',
    errorType: 'invalid_format',
    errorMessage: '字段数量不匹配',
    detectedAt: '2024-05-15 16:18:42',
    importSession: 'sess_001'
  }
];

const mockDecisions: Decision[] = [
  {
    id: 'dec_001',
    name: '2024夏季巡演返场',
    selectedTrackIds: ['1', '2', '3', '4', '5', '6', '7', '8'],
    totalDuration: 2156,
    totalVotes: 15689,
    avgStamina: 3.4,
    copyrightRisk: 'high',
    filters: { minVotes: 100, maxDuration: 300 },
    deduplicationRules: [{ field: 'voterId', enabled: true }],
    snapshot: { tracks: [], votes: [], copyrights: [] },
    decisionReason: '综合观众投票和乐手体力评估，选择8首热门曲目作为返场曲单',
    createdAt: '2024-05-20 16:45:23',
    createdBy: '张经纪'
  },
  {
    id: 'dec_002',
    name: '上海站加场返场',
    selectedTrackIds: ['3', '5', '7', '9'],
    totalDuration: 1024,
    totalVotes: 8456,
    avgStamina: 2.8,
    copyrightRisk: 'low',
    filters: { minVotes: 200 },
    deduplicationRules: [{ field: 'voterId', enabled: true }],
    snapshot: { tracks: [], votes: [], copyrights: [] },
    decisionReason: '上海站加场特别准备，精选4首经典曲目',
    createdAt: '2024-05-15 14:20:10',
    createdBy: '张经纪'
  },
  {
    id: 'dec_003',
    name: '北京站首演返场',
    selectedTrackIds: ['2', '4', '6', '8', '10'],
    totalDuration: 1345,
    totalVotes: 11234,
    avgStamina: 3.6,
    copyrightRisk: 'medium',
    filters: {},
    deduplicationRules: [{ field: 'voterId', enabled: true }],
    snapshot: { tracks: [], votes: [], copyrights: [] },
    decisionReason: '首演重点场次，选择5首观众最期待的曲目',
    createdAt: '2024-05-10 18:30:05',
    createdBy: '李助理'
  }
];

type TabType = 'history' | 'baddata' | 'decisions';

export default function AuditCenter() {
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const navigate = useNavigate();

  const tabs = [
    { id: 'history' as TabType, label: '操作历史', icon: <Clock size={16} /> },
    { id: 'baddata' as TabType, label: '坏数据档案', icon: <FileWarning size={16} /> },
    { id: 'decisions' as TabType, label: '决策日志', icon: <FileText size={16} /> }
  ];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high':
        return <span className="badge-red animate-pulse-red">高风险</span>;
      case 'medium':
        return <span className="badge-orange">中风险</span>;
      case 'low':
        return <span className="badge-gold">低风险</span>;
      default:
        return <span className="badge-neutral">无风险</span>;
    }
  };

  return (
    <div className="p-6 min-h-full">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-white mb-2">审计追溯中心</h1>
        <p className="text-neutral-400 text-sm">所有操作历史、坏数据记录和决策日志完整保留，可追溯可复盘</p>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-neutral-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-3 flex items-center gap-2 text-sm font-medium transition-all duration-200 border-b-2 -mb-px',
              activeTab === tab.id
                ? 'text-gold border-gold'
                : 'text-neutral-400 border-transparent hover:text-white hover:border-neutral-600'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in-up">
        {activeTab === 'history' && (
          <div className="max-w-4xl">
            <Timeline logs={mockAuditLogs} />
          </div>
        )}

        {activeTab === 'baddata' && (
          <BadDataTable records={mockBadData} />
        )}

        {activeTab === 'decisions' && (
          <div className="space-y-4">
            {mockDecisions.map((decision, index) => (
              <div
                key={decision.id}
                className="card-stage p-5 animate-fade-in-up hover:border-gold/30 cursor-pointer group"
                style={{ animationDelay: `${index * 80}ms` }}
                onClick={() => navigate(`/export/${decision.id}`)}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-serif text-lg font-semibold text-white group-hover:text-gold transition-colors">
                        {decision.name}
                      </h3>
                      {getRiskBadge(decision.copyrightRisk)}
                      <ChevronRight
                        size={18}
                        className="text-neutral-600 group-hover:text-gold group-hover:translate-x-1 transition-all ml-auto"
                      />
                    </div>

                    <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
                      {decision.decisionReason}
                    </p>

                    <div className="flex items-center gap-6 text-xs">
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <Calendar size={12} />
                        <span>{decision.createdAt}</span>
                      </div>
                      <span className="text-neutral-500">
                        创建人: <span className="text-neutral-300">{decision.createdBy}</span>
                      </span>
                      <span className="text-neutral-500">
                        曲目: <span className="font-mono text-gold">{decision.selectedTrackIds.length} 首</span>
                      </span>
                      <span className="text-neutral-500">
                        时长: <span className="font-mono text-white">{formatDuration(decision.totalDuration)}</span>
                      </span>
                      <span className="text-neutral-500">
                        总票数: <span className="font-mono text-gold">{decision.totalVotes.toLocaleString()}</span>
                      </span>
                      <span className="text-neutral-500">
                        平均体力: <span className="font-mono text-orange">{decision.avgStamina.toFixed(1)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
