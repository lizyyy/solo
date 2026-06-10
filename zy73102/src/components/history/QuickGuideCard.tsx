import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, RotateCcw, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepCardProps {
  number: string;
  title: string;
  description: string;
  hint: string;
  buttonText: string;
  onClick: () => void;
  iconBg: string;
  iconColor: string;
  Icon: typeof Package;
}

function StepCard({
  number,
  title,
  description,
  hint,
  buttonText,
  onClick,
  iconBg,
  iconColor,
  Icon,
}: StepCardProps) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#1F3A5F]/30 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold shadow-inner',
            iconBg
          )}
          style={{ fontFamily: 'Noto Serif SC, serif' }}
        >
          {number}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            iconBg,
            iconColor
          )}
        >
          <Icon size={20} />
        </div>
      </div>

      <h3 className="mb-1.5 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mb-3 text-xs leading-relaxed text-slate-600">{description}</p>

      <div className="mb-4 flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2">
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"></div>
        <span className="text-[11px] text-slate-500">{hint}</span>
        <ArrowRight size={12} className="shrink-0 text-slate-400" />
      </div>

      <div className="mt-auto">
        <button
          onClick={onClick}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#1F3A5F] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#182f4d]"
        >
          {buttonText} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

export default function QuickGuideCard() {
  const navigate = useNavigate();

  const steps: StepCardProps[] = [
    {
      number: '①',
      title: '先跑哪包样例？',
      description: '从首页「样例包导入区」一键加载标准样例包A，自动创建批次、填充图纸与会议纪要数据。',
      hint: '灰色箭头指向样例导入区',
      buttonText: '前往首页样例区',
      onClick: () => navigate('/', { state: { highlight: 'sample' } }),
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      Icon: Package,
    },
    {
      number: '②',
      title: '失败后怎么重来？',
      description: '在历史面板找到失败/有异常的执行，点击「补备注重跑」填写修正原因，系统自动创建新 run 并生成差异对比。',
      hint: '指向历史面板补备注',
      buttonText: '前往历史面板',
      onClick: () => navigate('/history', { state: { highlight: 'rerun' } }),
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      Icon: RotateCcw,
    },
    {
      number: '③',
      title: '从哪里看页面摘要？',
      description: '首页顶部 4 个大数字卡片实时汇总：材料总数、碰撞数、异常数、最新版本标记。任何操作后立即更新。',
      hint: '指向顶部摘要卡片',
      buttonText: '查看首页摘要',
      onClick: () => navigate('/', { state: { highlight: 'summary' } }),
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      Icon: BarChart3,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            三步快速指引
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            新用户按顺序走完即可完成首次追踪全流程
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400"></span>导入</span>
          <ArrowRight size={10} />
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400"></span>修正</span>
          <ArrowRight size={10} />
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400"></span>确认</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#1F3A5F]/15 bg-[#1F3A5F]/5 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1F3A5F] text-xs font-bold text-white">
          复核
        </div>
        <div className="text-xs leading-relaxed">
          <strong className="text-[#1F3A5F]">复核人接手流程：</strong>
          <span className="ml-1 text-slate-600">
            材料审核 → 批次卡片/3D 场景定位；异常排查 → 碰撞中心逐条审阅；报告输出 → 导出中心选择批次+轮次下载 CSV/JSON。
          </span>
        </div>
      </div>
    </section>
  );
}
