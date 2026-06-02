import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Route, Lightbulb, GitBranch, Link, ArrowLeft } from 'lucide-react';
import { planService } from '@/services/planService';
import { formatDateTime } from '@/utils/export';
import BusinessSuggestionCard from '@/components/business/BusinessSuggestionCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { PlanVersion, TraceNode } from '@/types';

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanVersion | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [traceChain, setTraceChain] = useState<TraceNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (planId: string) => {
    setLoading(true);
    try {
      const [planData, versionsData, traceData] = await Promise.all([
        planService.getPlanById(planId),
        planService.getPlanVersions(planId),
        planService.getTraceChain(planId),
      ]);
      setPlan(planData);
      setVersions(versionsData);
      setTraceChain(traceData);
    } catch (error) {
      console.error('加载方案详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSwitch = (versionId: string) => {
    navigate(`/plans/${versionId}`);
  };

  const getTraceNodeStyle = (type: string) => {
    switch (type) {
      case 'point':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'feedback':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'plan':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTraceNodeIcon = (type: string) => {
    switch (type) {
      case 'point':
        return <MapPin className="w-4 h-4" />;
      case 'feedback':
        return <Lightbulb className="w-4 h-4" />;
      case 'plan':
        return <Route className="w-4 h-4" />;
      default:
        return <Link className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="加载中..." />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Route className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>方案不存在</p>
        <button
          onClick={() => navigate('/plans')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/plans')}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm">
                {plan.version}
              </span>
              <h1 className="text-2xl font-bold text-slate-800">{plan.title}</h1>
              {plan.isActive && (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  已生效
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">
              创建人：{plan.createdBy} · 创建时间：{formatDateTime(plan.createdAt)}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold text-slate-700 mb-2">变更原因</h3>
          <p className="text-slate-600 bg-slate-50 rounded-lg p-3">{plan.changeReason}</p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-700 mb-2">方案内容</h3>
          <div className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 leading-relaxed">
            {plan.content}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <Route className="w-5 h-5 text-blue-600" />
              绕行路线
            </h2>
            <div className="space-y-4">
              {plan.bypassRoutes.map((route) => (
                <div key={route.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-slate-800">{route.name}</h4>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {route.applicableTime}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm mb-3">{route.description}</p>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>{route.startPoint} → {route.endPoint}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{route.estimatedTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              业务建议
            </h2>
            <div className="space-y-3">
              {plan.suggestions.map((suggestion) => (
                <BusinessSuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-blue-600" />
              历史版本
            </h2>
            <div className="space-y-2">
              {versions.map((ver) => (
                <button
                  key={ver.id}
                  onClick={() => handleVersionSwitch(ver.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    ver.id === plan.id
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ver.version}</span>
                    {ver.isActive && (
                      <span className="text-xs text-green-600">生效中</span>
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1 truncate">{ver.title}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <Link className="w-5 h-5 text-blue-600" />
              版本追溯链路
            </h2>
            <div className="relative">
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />
              <div className="space-y-4">
                {traceChain.map((node, index) => (
                  <div key={`${node.id}-${index}`} className="relative pl-8">
                    <div
                      className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border ${getTraceNodeStyle(node.type)}`}
                    >
                      {getTraceNodeIcon(node.type)}
                    </div>
                    <div className={`p-3 rounded-lg border ${getTraceNodeStyle(node.type)}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{node.title}</span>
                        <span className="text-xs opacity-70">{node.relation}</span>
                      </div>
                      <p className="text-xs opacity-70">{formatDateTime(node.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
