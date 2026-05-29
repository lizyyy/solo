import { useNavigate } from 'react-router-dom';
import { Disc3, CheckCircle2, Clock, AlertTriangle, Plus, Library, FileText } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatCard } from '@/components/features/StatCard';
import { RiskAlertItem } from '@/components/features/RiskAlertItem';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function Dashboard() {
  const navigate = useNavigate();
  const { samplePacks, risks, tracks } = useStore();

  const stats = [
    {
      title: '采样包总数',
      value: samplePacks.length,
      icon: <Disc3 className="w-6 h-6" />,
      color: 'blue' as const,
    },
    {
      title: '授权有效',
      value: samplePacks.filter((s) => s.status === 'active').length,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: 'green' as const,
    },
    {
      title: '即将到期',
      value: samplePacks.filter((s) => s.status === 'expiring').length,
      icon: <Clock className="w-6 h-6" />,
      color: 'amber' as const,
    },
    {
      title: '存在风险',
      value: samplePacks.filter((s) => s.status === 'expired' || s.status === 'incomplete').length,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'red' as const,
    },
  ];

  const quickActions = [
    {
      label: '新建采样包',
      icon: <Plus className="w-5 h-5" />,
      onClick: () => navigate('/sample-packs'),
    },
    {
      label: '查看采样包',
      icon: <Library className="w-5 h-5" />,
      onClick: () => navigate('/sample-packs'),
    },
    {
      label: '生成报告',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => navigate('/report'),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">仪表盘</h1>
        <p className="text-gray-500 mt-1">一目了然查看所有授权状态和风险提醒</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={stat.title}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1A1A2E]">风险提醒</h2>
            <span className="text-sm text-gray-500">
              共 {risks.length} 条待处理
            </span>
          </div>

          {risks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-[#4A7C59] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#1A1A2E]">一切正常</h3>
                <p className="text-gray-500 mt-2">
                  所有采样包授权状态良好，没有发现风险
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {risks.map((risk, index) => (
                <div
                  key={risk.id}
                  className="animate-in fade-in slide-in-from-left-4 duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <RiskAlertItem alert={risk} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">快速操作</h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start py-6 px-5 text-left"
                onClick={action.onClick}
              >
                <div className="w-10 h-10 rounded-lg bg-[#E8B86D]/10 flex items-center justify-center mr-4">
                  {action.icon}
                </div>
                <span className="font-medium">{action.label}</span>
              </Button>
            ))}
          </div>

          <Card className="mt-6">
            <CardContent className="p-5">
              <h3 className="font-semibold text-[#1A1A2E] mb-4">快速统计</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">曲目总数</span>
                  <span className="font-medium text-[#1A1A2E]">{tracks.length} 首</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">已过期授权</span>
                  <span className="font-medium text-[#B85450]">
                    {samplePacks.filter((s) => s.status === 'expired').length} 个
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">资料不全</span>
                  <span className="font-medium text-[#B85450]">
                    {samplePacks.filter((s) => s.status === 'incomplete').length} 个
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
