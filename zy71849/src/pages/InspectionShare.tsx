import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/db';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  UserEdit,
  FileText,
  User,
  Phone,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Shield,
  Clock,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { InspectionCategory, INSPECTION_CATEGORY_LABELS, Project } from '@/types';

export default function InspectionShare() {
  const { shareId } = useParams();
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<InspectionCategory | 'all'>('all');

  useEffect(() => {
    const validateShare = () => {
      if (!shareId) {
        setIsValid(false);
        return;
      }

      const shareData = localStorage.getItem(`inspection_share_${shareId}`);
      if (!shareData) {
        setIsValid(false);
        return;
      }

      const data = JSON.parse(shareData);
      const now = new Date();
      const expiresAt = new Date(data.expiresAt);

      if (now > expiresAt) {
        setIsValid(false);
        return;
      }

      loadData(data.projectId);
      setIsValid(true);
    };

    validateShare();
  }, [shareId]);

  const loadData = async (projectId: string) => {
    const [projectData, itemsData] = await Promise.all([
      db.projects.get(projectId),
      db.inspectionItems.where('projectId').equals(projectId).toArray(),
    ]);

    setProject(projectData || null);
    setItems(itemsData);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedItems(next);
  };

  if (isValid === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">加载中...</div>
      </div>
    );
  }

  if (isValid === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-slate-800 mb-2">
            链接已失效或不存在
          </h2>
          <p className="text-slate-500">
            请联系项目负责人获取最新的巡检单链接
          </p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: InspectionCategory | 'all'; label: string; color: string; count: number }> = [
    { key: 'all', label: '全部', color: 'bg-slate-100 text-slate-700', count: items.length },
    {
      key: 'confirmed',
      label: '已确认',
      color: 'bg-green-100 text-green-700',
      count: items.filter((i) => i.category === 'confirmed').length,
    },
    {
      key: 'pending-supplement',
      label: '待补充',
      color: 'bg-amber-100 text-amber-700',
      count: items.filter((i) => i.category === 'pending-supplement').length,
    },
    {
      key: 'manual-modified',
      label: '人工改过',
      color: 'bg-red-100 text-red-700',
      count: items.filter((i) => i.category === 'manual-modified').length,
    },
  ];

  const filteredItems =
    activeTab === 'all'
      ? items
      : items.filter((i) => i.category === activeTab);

  const categoryConfig: Record<InspectionCategory, { icon: typeof CheckCircle2; bgColor: string; borderColor: string }> = {
    confirmed: { icon: CheckCircle2, bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    'pending-supplement': { icon: AlertTriangle, bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    'manual-modified': { icon: UserEdit, bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  };

  const stats = {
    total: items.length,
    confirmed: items.filter((i) => i.category === 'confirmed').length,
    pending: items.filter((i) => i.category === 'pending-supplement').length,
    manual: items.filter((i) => i.category === 'manual-modified').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-xl font-semibold text-slate-800">
                {project?.name || '巡检单'}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-green-600" />
                  已授权访问
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  链接7天内有效
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-primary-100 text-primary-700">
                共 {items.length} 条记录
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="p-4">
              <p className="text-sm text-slate-500">总计</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">{stats.total}</p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-confirmed">
            <div className="p-4">
              <p className="text-sm text-slate-500">已确认</p>
              <p className="text-2xl font-semibold text-status-confirmed mt-1">
                {stats.confirmed}
              </p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-pending">
            <div className="p-4">
              <p className="text-sm text-slate-500">待补充</p>
              <p className="text-2xl font-semibold text-status-pending mt-1">
                {stats.pending}
              </p>
            </div>
          </div>
          <div className="card border-l-4 border-l-status-manual">
            <div className="p-4">
              <p className="text-sm text-slate-500">人工修改</p>
              <p className="text-2xl font-semibold text-status-manual mt-1">
                {stats.manual}
              </p>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              处理口径说明
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="font-medium text-green-700 mb-1">已确认</p>
                <p className="text-xs text-green-600">
                  数据校验通过，视线分析结果准确，可直接用于施工。
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="font-medium text-amber-700 mb-1">待补充</p>
                <p className="text-xs text-amber-600">
                  数据存在缺失或异常，需补充完整后重新分析。请联系对应责任人补全数据。
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="font-medium text-red-700 mb-1">人工改过</p>
                <p className="text-xs text-red-600">
                  数据经过人工调整，需再次核对原始材料。调整原因和依据已记录在案。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? `${tab.color} shadow-sm`
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item) => {
            const config = categoryConfig[item.category];
            const CategoryIcon = config.icon;
            const isExpanded = expandedItems.has(item.id);

            return (
              <div
                key={item.id}
                className={`card border ${config.borderColor} ${config.bgColor}/30 overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg ${config.bgColor} ${config.borderColor} border flex items-center justify-center flex-shrink-0`}
                      >
                        <CategoryIcon
                          className={`w-5 h-5 ${
                            item.category === 'confirmed'
                              ? 'text-status-confirmed'
                              : item.category === 'pending-supplement'
                              ? 'text-status-pending'
                              : 'text-status-manual'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={item.category} type="inspection" />
                        </div>
                        <h3 className="font-medium text-slate-800">
                          {item.description.split('视线分析结果')[0] || '设备记录'}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 animate-fade-in">
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                <FileText className="w-4 h-4" />
                                处理口径
                              </h4>
                              <p className="text-sm text-slate-600">{item.handlingMethod}</p>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                <ArrowRight className="w-4 h-4" />
                                下一步操作
                              </h4>
                              <p className="text-sm text-slate-600">{item.nextStep}</p>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                                <Phone className="w-4 h-4" />
                                联系人
                              </h4>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <User className="w-4 h-4" />
                                <span className="font-medium">{item.contactPerson}</span>
                                <span className="text-slate-400">|</span>
                                <span>{item.contactRole}</span>
                              </div>
                            </div>

                            {item.isConfirmed && item.confirmedBy && (
                              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                  <Check className="w-4 h-4" />
                                  <span className="font-medium">已确认</span>
                                  <span className="text-green-600">
                                    by {item.confirmedBy} at{' '}
                                    {new Date(item.confirmedAt).toLocaleString('zh-CN')}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 hover:bg-white/50 rounded-md transition-colors ml-4"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">暂无记录</p>
          </div>
        )}
      </main>
    </div>
  );
}
