import { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { SongGroupCard } from '@/components/labels/SongGroupCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { AlertTriangle, CheckCircle, Users, Clock } from 'lucide-react';

export const ReviewPage = () => {
  const { records, groups } = useEmotionLabelStore();

  const pendingGroups = useMemo(() => {
    return groups
      .filter((g) => g.reviewStatus === 'pending')
      .map((group) => ({
        group,
        records: group.memberIds
          .map((id) => records.find((r) => r.id === id))
          .filter(Boolean),
      }));
  }, [groups, records]);

  const pendingRecords = useMemo(() => {
    return records.filter((r) => r.status === 'reviewing' && !r.groupId);
  }, [records]);

  const stats = {
    totalPending: pendingGroups.length + pendingRecords.length,
    totalGroups: groups.length,
    confirmedGroups: groups.filter((g) => g.reviewStatus === 'confirmed').length,
    pendingGroupCount: pendingGroups.length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
          异常复核区
        </h1>
        <p className="text-gray-500 mt-1">
          音乐老师许老师复核专区：现场名/版权名待确认记录，别急着归正常，复核后再处理
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-amber-50 p-4 rounded-sm border border-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-sm text-amber-700">待复核总数</p>
              <p className="text-2xl font-bold text-amber-800 mt-1">{stats.totalPending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-[#2c5282]" />
            <div>
              <p className="text-sm text-gray-500">总分组数</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalGroups}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-sm border border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-green-700">已确认分组</p>
              <p className="text-2xl font-bold text-green-800 mt-1">{stats.confirmedGroups}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#ebf4ff] p-4 rounded-sm border border-[#bfdbfe]">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-[#2c5282]" />
            <div>
              <p className="text-sm text-[#2c5282]">待复核分组</p>
              <p className="text-2xl font-bold text-[#1e3a5f] mt-1">{stats.pendingGroupCount}</p>
            </div>
          </div>
        </div>
      </div>

      <Card
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            待复核分组 - 现场名/版权名关联确认
          </div>
        }
        subtitle="同一首歌有现场名和版权名的记录，需音乐老师确认是否为同一首歌"
      >
        {pendingGroups.length > 0 ? (
          <div className="space-y-4">
            {pendingGroups.map(({ group, records: groupRecords }) => (
              <div key={group.id} className="border-l-4 border-amber-500 pl-4">
                <SongGroupCard
                  group={group}
                  records={groupRecords.filter(Boolean) as any}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="text-lg font-medium text-gray-700">太棒了！暂无待复核分组</p>
            <p className="text-sm mt-1">所有同名映射都已完成复核</p>
          </div>
        )}
      </Card>

      {pendingRecords.length > 0 && (
        <Card
          title="其他待复核记录"
          subtitle="未分组但标记为待复核的单条记录"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">原始行号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">现场名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">版权名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-40">情绪标签</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">音频备注</th>
                </tr>
              </thead>
              <tbody>
                {pendingRecords.map((record) => (
                  <tr key={record.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{record.originalRowNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{record.liveName}</td>
                    <td className="px-4 py-3 text-gray-600">{record.copyrightName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 bg-[#1e3a5f] text-white rounded text-xs">
                        {record.emotionTag}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{record.audioNote || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
