import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  ArrowLeft,
  Music,
  Clock,
  Users,
  Zap,
  AlertTriangle,
  Filter,
  Layers,
  FileText,
  Calculator,
  ShieldAlert,
  FileWarning
} from 'lucide-react';
import type { Decision, TrackWithRelations, BadDataRecord } from '@shared/types';
import { cn } from '@/lib/utils';
import SourceInfoPanel from '@/components/SourceInfoPanel';

const mockDecision: Decision = {
  id: 'dec_001',
  name: '2024夏季巡演返场',
  selectedTrackIds: ['1', '2', '3', '4', '5', '6', '7', '8'],
  totalDuration: 2156,
  totalVotes: 15689,
  avgStamina: 3.4,
  copyrightRisk: 'high',
  filters: {
    copyrightStatus: ['active', 'pending'],
    minVotes: 100,
    maxDuration: 300,
    maxStamina: 4
  },
  deduplicationRules: [
    { field: 'voterId', enabled: true },
    { field: 'voterName', enabled: false }
  ],
  snapshot: { tracks: [], votes: [], copyrights: [] },
  decisionReason: '综合观众投票和乐手体力评估，选择8首热门曲目作为返场曲单。考虑到现场氛围，特别加入了一首高难度曲目作为压轴。',
  createdAt: '2024-05-20 16:45:23',
  createdBy: '张经纪'
};

const mockTracks: TrackWithRelations[] = [
  {
    id: '1',
    name: '夜空中最亮的星',
    artist: '逃跑计划',
    duration: 256,
    staminaLevel: 3,
    voteCount: 1247,
    isSelected: true,
    copyright: {
      id: 'c1', trackId: '1', trackName: '夜空中最亮的星', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00123',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 5, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-10 09:00' },
    createdAt: '2024-05-10', updatedAt: '2024-05-10'
  },
  {
    id: '2',
    name: '海阔天空',
    artist: 'Beyond',
    duration: 326,
    staminaLevel: 4,
    voteCount: 2891,
    isSelected: true,
    copyright: {
      id: 'c2', trackId: '2', trackName: '海阔天空', status: 'expired',
      warningLevel: 'high', expiredAt: '2024-03-15', licenseNumber: 'CP-2022-08901',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 12, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 8, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12', updatedAt: '2024-05-12'
  },
  {
    id: '3',
    name: '光辉岁月',
    artist: 'Beyond',
    duration: 298,
    staminaLevel: 4,
    voteCount: 2156,
    isSelected: true,
    copyright: {
      id: 'c3', trackId: '3', trackName: '光辉岁月', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00124',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 15, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 15, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12', updatedAt: '2024-05-12'
  },
  {
    id: '4',
    name: '晴天',
    artist: '周杰伦',
    duration: 269,
    staminaLevel: 2,
    voteCount: 3542,
    isSelected: true,
    copyright: {
      id: 'c4', trackId: '4', trackName: '晴天', status: 'pending',
      warningLevel: 'medium', licenseNumber: 'CP-2024-00567',
      source: { sourceType: 'api', importedBy: 'system', importedAt: '2024-05-18 08:00' },
      updatedAt: '2024-05-18'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-11 11:30' },
    createdAt: '2024-05-11', updatedAt: '2024-05-11'
  },
  {
    id: '5',
    name: '稻香',
    artist: '周杰伦',
    duration: 223,
    staminaLevel: 2,
    voteCount: 1876,
    isSelected: true,
    copyright: {
      id: 'c5', trackId: '5', trackName: '稻香', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00568',
      source: { sourceType: 'api', importedBy: 'system', importedAt: '2024-05-18 08:00' },
      updatedAt: '2024-05-18'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 23, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12', updatedAt: '2024-05-12'
  },
  {
    id: '6',
    name: '倔强',
    artist: '五月天',
    duration: 275,
    staminaLevel: 3,
    voteCount: 1654,
    isSelected: true,
    copyright: {
      id: 'c6', trackId: '6', trackName: '倔强', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00789',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 28, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-13 16:45' },
    createdAt: '2024-05-13', updatedAt: '2024-05-13'
  },
  {
    id: '7',
    name: '突然好想你',
    artist: '五月天',
    duration: 258,
    staminaLevel: 3,
    voteCount: 1432,
    isSelected: true,
    copyright: {
      id: 'c7', trackId: '7', trackName: '突然好想你', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00790',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 31, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'csv-import', fileName: 'tracks_spring.csv', lineNumber: 35, importedBy: '李助理', importedAt: '2024-05-12 14:20' },
    createdAt: '2024-05-12', updatedAt: '2024-05-12'
  },
  {
    id: '8',
    name: '离开地球表面',
    artist: '五月天',
    duration: 251,
    staminaLevel: 5,
    voteCount: 891,
    isSelected: true,
    copyright: {
      id: 'c8', trackId: '8', trackName: '离开地球表面', status: 'active',
      warningLevel: 'low', licenseNumber: 'CP-2024-00791',
      source: { sourceType: 'csv-import', fileName: 'copyright_2024Q1.csv', lineNumber: 35, importedBy: 'admin', importedAt: '2024-05-15 10:30' },
      updatedAt: '2024-05-15'
    },
    source: { sourceType: 'manual', importedBy: '张经纪', importedAt: '2024-05-14 10:15' },
    createdAt: '2024-05-14', updatedAt: '2024-05-14'
  }
];

const mockBadData: BadDataRecord[] = [
  {
    id: 'bd1', sourceFile: 'votes_20240520.csv', lineNumber: 15,
    rawContent: ',张三,2024-05-20', errorType: 'missing_field',
    errorMessage: '缺少曲目名称字段', detectedAt: '2024-05-20 14:32:15', importSession: 'sess_001'
  },
  {
    id: 'bd2', sourceFile: 'votes_20240520.csv', lineNumber: 23,
    rawContent: '未知歌曲,李四,2024-05-20', errorType: 'unknown_track',
    errorMessage: '曲目不存在于候选库', detectedAt: '2024-05-20 14:32:15', importSession: 'sess_001'
  },
  {
    id: 'bd3', sourceFile: 'votes_20240520.csv', lineNumber: 45,
    rawContent: '海阔天空,张三,2024-05-20', errorType: 'duplicate',
    errorMessage: '同一投票人重复投票', detectedAt: '2024-05-20 14:32:15', importSession: 'sess_001'
  }
];

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card-stage overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-stage bg-gold/15 flex items-center justify-center border border-gold/30">
            <span className="text-gold">{icon}</span>
          </div>
          <h3 className="font-serif font-semibold text-white text-lg">{title}</h3>
        </div>
        <div className="text-neutral-500">
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 animate-fade-in-up">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ExportReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'high': return <span className="badge-red animate-pulse-red">高风险</span>;
      case 'medium': return <span className="badge-orange">中风险</span>;
      case 'low': return <span className="badge-gold">低风险</span>;
      default: return <span className="badge-neutral">无风险</span>;
    }
  };

  const handleExportJSON = () => {
    const exportData = {
      decision: mockDecision,
      tracks: mockTracks,
      badData: mockBadData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-${id}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['序号', '曲目名称', '艺术家', '时长(秒)', '体力等级', '投票数', '版权状态', '许可证号'];
    const rows = mockTracks.map((t, i) => [
      i + 1, t.name, t.artist, t.duration, t.staminaLevel, t.voteCount,
      t.copyright?.status || '未登记', t.copyright?.licenseNumber || '—'
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-${id}-tracklist.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 min-h-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/audit')}
            className="p-2 rounded-stage hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-white mb-1">
              {mockDecision.name}
            </h1>
            <p className="text-neutral-400 text-sm">
              创建于 {mockDecision.createdAt} · 操作人: {mockDecision.createdBy}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="btn-stage flex items-center gap-2"
          >
            <FileSpreadsheet size={16} />
            导出 CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="btn-gold flex items-center gap-2"
          >
            <FileJson size={16} />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="决策概览" icon={<FileText size={16} />}>
          <div className="grid grid-cols-6 gap-4 mb-6">
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <Music size={24} className="mx-auto text-gold mb-2" />
              <p className="font-mono text-2xl font-bold text-gold">{mockDecision.selectedTrackIds.length}</p>
              <p className="text-xs text-neutral-500">选中曲目</p>
            </div>
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <Clock size={24} className="mx-auto text-blue-400 mb-2" />
              <p className="font-mono text-2xl font-bold text-white">{formatDuration(mockDecision.totalDuration)}</p>
              <p className="text-xs text-neutral-500">总时长</p>
            </div>
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <Users size={24} className="mx-auto text-gold mb-2" />
              <p className="font-mono text-2xl font-bold text-gold">{mockDecision.totalVotes.toLocaleString()}</p>
              <p className="text-xs text-neutral-500">总票数</p>
            </div>
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <Zap size={24} className="mx-auto text-orange mb-2" />
              <p className="font-mono text-2xl font-bold text-orange">{mockDecision.avgStamina.toFixed(1)}</p>
              <p className="text-xs text-neutral-500">平均体力</p>
            </div>
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <AlertTriangle size={24} className="mx-auto text-red mb-2" />
              <div className="my-1">{getRiskBadge(mockDecision.copyrightRisk)}</div>
              <p className="text-xs text-neutral-500">版权风险</p>
            </div>
            <div className="bg-neutral-800/30 rounded-stage p-4 text-center border border-neutral-700/50">
              <Download size={24} className="mx-auto text-purple-400 mb-2" />
              <p className="font-mono text-2xl font-bold text-purple-400">2</p>
              <p className="text-xs text-neutral-500">坏数据</p>
            </div>
          </div>

          <div className="bg-neutral-800/20 rounded-stage p-4 border border-gold/20">
            <p className="text-sm font-medium text-gold mb-2">决策理由</p>
            <p className="text-sm text-neutral-300 leading-relaxed">{mockDecision.decisionReason}</p>
          </div>
        </Section>

        <Section title="筛选条件" icon={<Filter size={16} />}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">版权状态</p>
              <div className="flex flex-wrap gap-2">
                {mockDecision.filters.copyrightStatus?.map(status => (
                  <span key={status} className="badge-gold">
                    {status === 'active' ? '版权有效' : '待审核'}
                  </span>
                ))}
                {(!mockDecision.filters.copyrightStatus || mockDecision.filters.copyrightStatus.length === 0) && (
                  <span className="text-sm text-neutral-500">未筛选</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">最小投票数</p>
              <p className="font-mono text-gold">{mockDecision.filters.minVotes || 0} 票</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">最大时长</p>
              <p className="font-mono text-white">{mockDecision.filters.maxDuration || 600} 秒</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">最大体力消耗</p>
              <p className="font-mono text-orange">
                {'★'.repeat(mockDecision.filters.maxStamina || 5)}{'☆'.repeat(5 - (mockDecision.filters.maxStamina || 5))}
              </p>
            </div>
          </div>
        </Section>

        <Section title="去重规则" icon={<Layers size={16} />}>
          <div className="space-y-3">
            {mockDecision.deduplicationRules.map((rule, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-neutral-800/30 rounded-stage">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded border-2',
                    rule.enabled ? 'bg-gold border-gold' : 'border-neutral-600'
                  )} />
                  <span className="text-sm text-white">
                    {rule.field === 'voterId' ? '按投票人ID去重' :
                     rule.field === 'voterName' ? '按投票人姓名去重' :
                     `按 ${rule.field} 去重`}
                  </span>
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  rule.enabled ? 'text-gold' : 'text-neutral-500'
                )}>
                  {rule.enabled ? '已启用' : '已禁用'}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="曲单详情" icon={<Music size={16} />}>
          <div className="space-y-3">
            {mockTracks.map((track, index) => (
              <div key={track.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-center gap-4 p-4 bg-neutral-800/30 rounded-stage border border-neutral-700/50 hover:border-gold/30 transition-colors">
                  <span className="font-mono text-gold font-bold w-8 shrink-0">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{track.name}</span>
                      {track.copyright?.status === 'expired' && (
                        <span className="badge-red animate-pulse-red">版权过期</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-400">{track.artist}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-white">{formatDuration(track.duration)}</p>
                    <p className="font-mono text-xs text-gold">{track.voteCount.toLocaleString()} 票</p>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <p className="font-mono text-sm text-orange">
                      {'★'.repeat(track.staminaLevel)}{'☆'.repeat(5 - track.staminaLevel)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 mb-4">
                  <SourceInfoPanel
                    trackSource={track.source}
                    voteCount={track.voteCount}
                    copyright={track.copyright}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="时长计算过程" icon={<Calculator size={16} />}>
          <div className="bg-neutral-950 rounded-stage p-4 border border-neutral-800">
            <div className="font-mono text-sm space-y-2">
              <p className="text-neutral-500">// 时长计算明细</p>
              {mockTracks.map((track, index) => (
                <p key={track.id} className="text-neutral-300">
                  <span className="text-gold">{String(index + 1).padStart(2, '0')}.</span>{' '}
                  {track.name.padEnd(20, ' ')} = <span className="text-white">{track.duration}</span> 秒
                </p>
              ))}
              <div className="border-t border-neutral-700 my-2 pt-2">
                <p className="text-gold font-bold">
                  总时长 = {mockTracks.reduce((sum, t) => sum + t.duration, 0)} 秒
                  = {formatDuration(mockDecision.totalDuration)}
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="版权风险评估" icon={<ShieldAlert size={16} />}>
          <div className="space-y-4">
            {mockDecision.copyrightRisk !== 'none' && (
              <div className={cn(
                'rounded-stage p-4 border',
                mockDecision.copyrightRisk === 'high'
                  ? 'bg-red/10 border-red/30 animate-pulse-red'
                  : 'bg-orange/10 border-orange/30'
              )}>
                <p className={cn(
                  'text-sm font-medium mb-2',
                  mockDecision.copyrightRisk === 'high' ? 'text-red' : 'text-orange'
                )}>
                  ⚠️ {mockDecision.copyrightRisk === 'high' ? '高' : '中'}等级版权风险
                </p>
                <p className="text-sm text-neutral-300">
                  已选曲目中有 {mockTracks.filter(t => t.copyright?.status === 'expired').length} 首歌曲版权已过期，
                  {mockTracks.filter(t => t.copyright?.status === 'pending').length} 首待审核。
                  建议在演出前完成版权续约，避免法律风险。
                </p>
              </div>
            )}

            <div className="space-y-2">
              {mockTracks.map(track => (
                <div key={track.id} className="flex items-center justify-between p-3 bg-neutral-800/20 rounded-stage">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{track.name}</span>
                    <span className="text-xs text-neutral-500">{track.artist}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-neutral-500">
                      {track.copyright?.licenseNumber || '—'}
                    </span>
                    {track.copyright?.status === 'expired' ? (
                      <span className="badge-red animate-pulse-red">已过期</span>
                    ) : track.copyright?.status === 'pending' ? (
                      <span className="badge-orange">待审核</span>
                    ) : track.copyright?.status === 'active' ? (
                      <span className="badge-gold">有效</span>
                    ) : (
                      <span className="badge-neutral">未登记</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="坏数据记录" icon={<FileWarning size={16} />}>
          <div className="space-y-2">
            {mockBadData.map((record, index) => (
              <div
                key={record.id}
                className={cn(
                  'p-4 rounded-stage border animate-fade-in-up',
                  index % 2 === 0 ? 'bg-red/5 border-red/20' : 'bg-neutral-800/20 border-neutral-700/50'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge-red">
                        {record.errorType === 'missing_field' ? '字段缺失' :
                         record.errorType === 'duplicate' ? '重复数据' :
                         record.errorType === 'unknown_track' ? '未知曲目' :
                         record.errorType === 'invalid_format' ? '格式错误' : record.errorType}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">
                        {record.sourceFile} · 第 {record.lineNumber} 行
                      </span>
                    </div>
                    <p className="font-mono text-xs text-neutral-400 bg-neutral-900/50 px-3 py-2 rounded">
                      {record.rawContent}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-neutral-500 shrink-0">{record.detectedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
        <p className="text-xs text-neutral-600 font-mono">
          本报告由返场曲单决策系统自动生成 · 报告ID: {id} · 生成时间: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
