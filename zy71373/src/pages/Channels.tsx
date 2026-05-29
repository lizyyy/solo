import { useEffect, useMemo } from 'react';
import { Globe, Printer, Share2, Tv, ShoppingBag, Edit, Layers, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import type { Channel, ChannelType, EntityStatus } from '../types';

const channelConfig: Record<ChannelType, { label: string; icon: typeof Globe; gradient: string }> = {
  web: {
    label: '网站',
    icon: Globe,
    gradient: 'from-cyan-500/20 to-blue-500/20'
  },
  print: {
    label: '印刷',
    icon: Printer,
    gradient: 'from-amber-500/20 to-orange-500/20'
  },
  social: {
    label: '社交',
    icon: Share2,
    gradient: 'from-pink-500/20 to-rose-500/20'
  },
  broadcast: {
    label: '广播电视',
    icon: Tv,
    gradient: 'from-purple-500/20 to-violet-500/20'
  },
  merchandise: {
    label: '衍生商品',
    icon: ShoppingBag,
    gradient: 'from-emerald-500/20 to-teal-500/20'
  }
};

export default function Channels() {
  const { channels, loadChannels, updateChannelStatus, loading } = useStore();

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const stats = useMemo(() => {
    const total = channels.length;
    const highRisk = channels.filter(c => c.riskLevel === 'high').length;
    return { total, highRisk };
  }, [channels]);

  const handleToggleStatus = async (id: string, currentStatus: EntityStatus) => {
    const newStatus: EntityStatus = currentStatus === 'confirmed' ? 'temp_note' : 'confirmed';
    await updateChannelStatus(id, newStatus);
  };

  if (loading.channels) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">发布渠道管理</h1>
          <p className="text-slate-400 mt-1">管理和配置所有品牌发布渠道</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Layers className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">总渠道数</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[rgba(229,57,53,0.15)]">
                <AlertTriangle className="w-6 h-6 text-[#E53935]" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">高风险渠道</p>
                <p className="text-2xl font-bold text-[#E53935] mt-1">{stats.highRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">渠道列表</h2>
            <span className="text-sm text-slate-400">共 {channels.length} 条记录</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {channels.length === 0 ? (
            <div className="py-16 text-center">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">暂无渠道记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">渠道名称</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">渠道类型</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">描述</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">风险等级</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">状态</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelRow({
  channel,
  onToggleStatus
}: {
  channel: Channel;
  onToggleStatus: (id: string, status: EntityStatus) => void;
}) {
  const config = channelConfig[channel.type];
  const Icon = config.icon;

  return (
    <tr className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-medium text-white">{channel.name}</span>
        </div>
      </td>
      <td className="py-4 px-6">
        <span className="px-2.5 py-1 text-xs rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/50">
          {config.label}
        </span>
      </td>
      <td className="py-4 px-6 text-slate-300 max-w-xs truncate">
        {channel.description}
      </td>
      <td className="py-4 px-6">
        <RiskBadge level={channel.riskLevel} size="sm" />
      </td>
      <td className="py-4 px-6">
        <StatusBadge status={channel.status} size="sm" />
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm">
            <Edit className="w-4 h-4" />
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(channel.id, channel.status)}
          >
            {channel.status === 'confirmed' ? '标记临时' : '确认'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
