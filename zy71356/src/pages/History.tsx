import { useState, useEffect } from 'react';
import {
  GitBranch,
  ArrowRightLeft,
  Clock,
  User,
  FileText,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import { api } from '@/lib/api';
import { Arrangement, SwapLog } from '@shared/types';

export default function History() {
  const {
    currentArrangement,
    swapLogs,
    stalls,
    vendors,
    loadArrangement,
    loadAll,
  } = useMarketStore();

  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [selectedTab, setSelectedTab] = useState<'versions' | 'swaps'>('versions');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadArrangements();
  }, []);

  const loadArrangements = async () => {
    setLoading(true);
    try {
      const data = await api.arrangements.getAll();
      setArrangements(data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchVersion = async (id: string) => {
    if (confirm('确定要切换到此版本吗？当前未保存的更改将丢失。')) {
      await loadArrangement(id);
    }
  };

  const getStallName = (stallId: string) => {
    return stalls.find((s) => s.id === stallId)?.name || stallId;
  };

  const getVendorNameByStall = (stallId: string) => {
    const assignment = currentArrangement?.assignments.find(
      (a) => a.stallId === stallId
    );
    if (!assignment) return '未知';
    return vendors.find((v) => v.id === assignment.vendorId)?.name || '未知';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return formatDate(dateStr);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">历史记录</h1>
        <p className="text-slate-500 mt-1">查看排布版本历史和换位操作记录</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setSelectedTab('versions')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedTab === 'versions'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <GitBranch size={18} />
          版本历史
        </button>
        <button
          onClick={() => setSelectedTab('swaps')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            selectedTab === 'swaps'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ArrowRightLeft size={18} />
          换位记录
        </button>
      </div>

      {selectedTab === 'versions' ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <GitBranch size={18} className="text-teal-600" />
                  版本时间线
                </h3>
                <button
                  onClick={loadArrangements}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  刷新
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  加载中...
                </div>
              ) : arrangements.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" />
                  <div className="divide-y divide-slate-100">
                    {arrangements.map((arrangement, index) => (
                      <div
                        key={arrangement.id}
                        className={`relative p-6 pl-16 hover:bg-slate-50 transition-colors ${
                          currentArrangement?.id === arrangement.id
                            ? 'bg-teal-50/50'
                            : ''
                        }`}
                      >
                        <div
                          className={`absolute left-6 w-4 h-4 rounded-full border-4 ${
                            currentArrangement?.id === arrangement.id
                              ? 'border-teal-500 bg-white'
                              : index === 0
                              ? 'border-slate-400 bg-white'
                              : 'border-slate-300 bg-slate-100'
                          }`}
                        />
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-slate-800">
                                {arrangement.name}
                              </span>
                              <span className="text-sm font-mono text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                                v{arrangement.version}
                              </span>
                              {currentArrangement?.id === arrangement.id && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle size={12} />
                                  当前版本
                                </span>
                              )}
                            </div>
                            {arrangement.note && (
                              <p className="text-sm text-slate-600 mt-2 flex items-start gap-2">
                                <FileText size={14} className="text-slate-400 mt-0.5" />
                                {arrangement.note}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <User size={12} />
                                {arrangement.createdBy}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {formatDate(arrangement.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatRelativeTime(arrangement.createdAt)}
                              </span>
                            </div>
                          </div>
                          {currentArrangement?.id !== arrangement.id && (
                            <button
                              onClick={() => handleSwitchVersion(arrangement.id)}
                              className="flex items-center gap-1 px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              切换到此版本
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
                  暂无版本记录
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">版本统计</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">总版本数</span>
                  <span className="text-2xl font-bold text-slate-800">
                    {arrangements.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">当前版本</span>
                  <span className="text-lg font-semibold text-teal-600">
                    {currentArrangement?.version || '-'}
                  </span>
                </div>
                <div className="h-px bg-slate-100" />
                {currentArrangement && (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-500">
                      {currentArrangement.name}
                    </div>
                    {currentArrangement.note && (
                      <div className="text-sm text-slate-400 bg-slate-50 p-3 rounded-lg">
                        {currentArrangement.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-100">
              <h3 className="font-semibold text-teal-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={18} className="text-teal-600" />
                版本管理说明
              </h3>
              <ul className="text-sm text-teal-700 space-y-2">
                <li>• 每次重大修改建议创建新版本</li>
                <li>• 旧版本数据会永久保留，不会被覆盖</li>
                <li>• 可随时切换回历史版本查看</li>
                <li>• 每个版本都保留独立的冲突检测记录</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-teal-600" />
                  换位操作日志
                </h3>
              </div>

              {swapLogs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {swapLogs
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                              <ArrowRightLeft
                                size={20}
                                className="text-teal-600"
                              />
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">
                                摊位 {getStallName(log.stallA)} ↔ 摊位 {getStallName(log.stallB)}
                              </div>
                              <div className="text-sm text-slate-500 mt-1">
                                {getVendorNameByStall(log.stallA)} ↔ {getVendorNameByStall(log.stallB)}
                              </div>
                              {log.reason ? (
                                <div className="text-sm text-teal-600 mt-1 flex items-center gap-1">
                                  <CheckCircle size={14} />
                                  原因：{log.reason}
                                </div>
                              ) : (
                                <div className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle size={14} />
                                  未填写换位原因
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400">
                              {formatRelativeTime(log.createdAt)}
                            </div>
                            <div className="text-xs text-slate-300 mt-1">
                              操作人：{log.operator}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <ArrowRightLeft size={48} className="mx-auto mb-3 opacity-30" />
                  暂无换位记录
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">换位统计</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">总换位次数</span>
                  <span className="text-2xl font-bold text-slate-800">
                    {swapLogs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">有原因记录</span>
                  <span className="text-lg font-semibold text-green-600">
                    {swapLogs.filter((l) => l.reason).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">无原因记录</span>
                  <span className="text-lg font-semibold text-amber-600">
                    {swapLogs.filter((l) => !l.reason).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
              <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                重要提醒
              </h3>
              <ul className="text-sm text-amber-700 space-y-2">
                <li>• 每次换位都应填写操作原因</li>
                <li>• 未填写原因的换位将生成冲突记录</li>
                <li>• 所有换位操作都会永久保留日志</li>
                <li>• 建议注明操作人，便于后续追溯</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
