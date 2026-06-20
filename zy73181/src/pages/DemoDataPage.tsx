import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileWarning, CheckCircle2, Database, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { difficultyLabel, constraintTypeLabel, reviewStatusLabel } from '@/services/filterService';

export default function DemoDataPage() {
  const navigate = useNavigate();
  const { problems, reviewResultsA, activeParamsGroup, reviewResultsA: resultsA, reviewResultsB: resultsB } = useAppStore();

  const normalProblems = useMemo(
    () => problems.filter((p) => !p.hasUnitIssue && !p.isRemarkSupplementary && p.reviewStatus === 'normal'),
    [problems]
  );

  const unitIssueProblems = useMemo(
    () => problems.filter((p) => p.hasUnitIssue),
    [problems]
  );

  const supplementaryProblems = useMemo(
    () => problems.filter((p) => p.isRemarkSupplementary),
    [problems]
  );

  const abnormalProblems = useMemo(
    () => problems.filter((p) => p.reviewStatus === 'abnormal'),
    [problems]
  );

  const results = activeParamsGroup === 'A' ? resultsA : resultsB;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-academic-100 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-academic-50 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-academic-500" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-academic-800 flex items-center gap-2">
              <Database className="w-6 h-6 text-amber-500" />
              演示数据中心
            </h1>
            <p className="text-sm text-academic-500 mt-0.5">
              "不太干净"的混合数据集 · 包含正常样例、单位缺失、后补备注、边界异常
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              演示数据集已加载 · 共 {problems.length} 条
            </span>
          </div>
        </div>
      </header>

      <main className="p-8">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <DatasetCard
            icon={CheckCircle2}
            label="正常样例"
            count={normalProblems.length}
            total={problems.length}
            tone="normal"
            description="单位完整、边界清晰、复核通过"
            delay={1}
          />
          <DatasetCard
            icon={AlertTriangle}
            label="单位缺失"
            count={unitIssueProblems.length}
            total={problems.length}
            tone="unit"
            description="boundaryUnit 为 null，独立标记不混入正常结果"
            delay={2}
          />
          <DatasetCard
            icon={FileWarning}
            label="后补备注"
            count={supplementaryProblems.length}
            total={problems.length}
            tone="supplementary"
            description="remark 含后补标识，更新时间晚于创建时间"
            delay={3}
          />
          <DatasetCard
            icon={AlertTriangle}
            label="边界异常"
            count={abnormalProblems.length}
            total={problems.length}
            tone="abnormal"
            description="偏差超过容差阈值，拖偏整体统计结果"
            delay={4}
          />
        </div>

        {unitIssueProblems.length > 0 && (
          <Section
            title="单位缺失样例"
            subtitle="这些数据的 boundaryUnit 为 null，系统会独立标记为紫色，不会混入正常结果统计"
            tone="unit"
            icon={AlertTriangle}
          >
            <ProblemGrid problems={unitIssueProblems} results={results} highlight="unit" />
          </Section>
        )}

        {supplementaryProblems.length > 0 && (
          <Section
            title="后补备注样例"
            subtitle="这些数据的 remark 字段含后补标识，更新时间明显晚于创建时间，表示题目录入后又补充了说明"
            tone="supplementary"
            icon={FileWarning}
          >
            <ProblemGrid problems={supplementaryProblems} results={results} highlight="supplementary" />
          </Section>
        )}

        {abnormalProblems.length > 0 && (
          <Section
            title="边界异常样例"
            subtitle="这些题目的边界偏差超过容差阈值，在报告中会被标记为拖偏整体结果的问题行"
            tone="abnormal"
            icon={AlertTriangle}
          >
            <ProblemGrid problems={abnormalProblems} results={results} highlight="abnormal" />
          </Section>
        )}

        <Section
          title="正常样例"
          subtitle="单位完整、边界清晰、复核通过的标准题目"
          tone="normal"
          icon={CheckCircle2}
        >
          <ProblemGrid problems={normalProblems} results={results} highlight="normal" />
        </Section>
      </main>
    </div>
  );
}

function DatasetCard({
  icon: Icon,
  label,
  count,
  total,
  tone,
  description,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  tone: 'normal' | 'unit' | 'supplementary' | 'abnormal';
  description: string;
  delay: number;
}) {
  const toneClasses: Record<string, string> = {
    normal: 'border-status-normal/30 bg-status-normal/5 text-status-normal',
    unit: 'border-status-unit/30 bg-status-unit/5 text-status-unit',
    supplementary: 'border-amber-400/40 bg-amber-50 text-amber-700',
    abnormal: 'border-status-abnormal/30 bg-status-abnormal/5 text-status-abnormal',
  };

  const pct = Math.round((count / total) * 100);

  return (
    <div className={`card-academic p-5 border-l-4 ${toneClasses[tone]} animate-fade-in-up stagger-${delay}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg bg-current/10 flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-medium bg-current/10 px-2 py-0.5 rounded-full">
          {pct}%
        </span>
      </div>
      <p className="text-3xl font-display font-bold tabular-nums text-academic-800 mb-1">
        {count}
      </p>
      <p className="text-sm font-medium text-academic-700 mb-1">{label}</p>
      <p className="text-xs text-academic-500 leading-relaxed">{description}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  tone,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  tone: 'normal' | 'unit' | 'supplementary' | 'abnormal';
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const toneClasses: Record<string, string> = {
    normal: 'text-status-normal bg-status-normal/10 border-status-normal/30',
    unit: 'text-status-unit bg-status-unit/10 border-status-unit/30',
    supplementary: 'text-amber-700 bg-amber-50 border-amber-300',
    abnormal: 'text-status-abnormal bg-status-abnormal/10 border-status-abnormal/30',
  };

  return (
    <div className="mb-8">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg border ${toneClasses[tone]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-academic-800">{title}</h2>
          <p className="text-sm text-academic-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProblemGrid({
  problems,
  results,
  highlight,
}: {
  problems: ReturnType<typeof useAppStore.getState>['problems'];
  results: ReturnType<typeof useAppStore.getState>['reviewResultsA'];
  highlight: 'normal' | 'unit' | 'supplementary' | 'abnormal';
}) {
  const bgMap: Record<string, string> = {
    normal: 'border-status-normal/20 hover:border-status-normal/40',
    unit: 'border-status-unit/30 bg-status-unit/5 hover:border-status-unit/50',
    supplementary: 'border-amber-300/50 bg-amber-50/60 hover:border-amber-400',
    abnormal: 'border-status-abnormal/30 bg-status-abnormal/5 hover:border-status-abnormal/50',
  };

  const tagMap: Record<string, string> = {
    normal: 'tag-normal',
    unit: 'tag-unit',
    supplementary: 'tag-warning',
    abnormal: 'tag-abnormal',
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {problems.map((p, idx) => {
        const r = results.find((x) => x.problemId === p.id);
        return (
          <div
            key={p.id}
            className={`rounded-lg border bg-white p-5 transition-all hover:shadow-md animate-fade-in-up ${bgMap[highlight]}`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-academic-600 bg-academic-50 px-2 py-0.5 rounded">
                  {p.id}
                </span>
                <span className={`tag-${p.difficulty === 'easy' ? 'easy' : p.difficulty === 'medium' ? 'medium' : p.difficulty === 'hard' ? 'hard' : 'expert'}`}>
                  {difficultyLabel(p.difficulty)}
                </span>
                <span className={tagMap[highlight]}>
                  {highlight === 'normal' ? '正常样例' :
                   highlight === 'unit' ? '单位缺失' :
                   highlight === 'supplementary' ? '后补备注' : '边界异常'}
                </span>
              </div>
              <span className="text-[11px] text-academic-400">行 {p.originalRow}</span>
            </div>

            <h3 className="font-medium text-academic-800 text-sm mb-3 leading-relaxed">
              {p.title}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <InfoItem label="约束类型" value={constraintTypeLabel(p.constraintType)} />
              <InfoItem label="知识点" value={p.knowledgePoint} />
              <InfoItem
                label="边界值"
                value={p.boundaryValue !== null ? String(p.boundaryValue) : '—'}
              />
              <InfoItem
                label="单位"
                value={p.boundaryUnit || '(缺失)'}
                valueClass={!p.boundaryUnit ? 'text-status-unit font-semibold' : ''}
              />
              <InfoItem label="复核状态" value={reviewStatusLabel(p.reviewStatus)} />
              <InfoItem
                label="偏差"
                value={r && r.status !== 'unit_issue' ? `${(r.deviation * 100).toFixed(2)}%` : '—'}
                valueClass={r && r.deviation > 0.05 ? 'text-status-abnormal font-semibold' : ''}
              />
            </div>

            {p.remark && (
              <div className="pt-3 border-t border-academic-100">
                <p className="text-[11px] text-academic-500 mb-1">
                  {p.isRemarkSupplementary ? '📝 后补备注：' : '备注：'}
                </p>
                <p className={`text-xs ${p.isRemarkSupplementary ? 'text-amber-800 font-medium' : 'text-academic-600'}`}>
                  {p.remark}
                </p>
              </div>
            )}

            {p.isRemarkSupplementary && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700">
                <span>创建: {p.createdAt.slice(0, 10)}</span>
                <span>→</span>
                <span className="font-semibold">更新: {p.updatedAt.slice(0, 10)}</span>
              </div>
            )}

            {r?.problematicRow && (
              <div className="mt-3 p-2.5 bg-status-abnormal/10 rounded text-xs text-status-abnormal">
                {r.problematicRow}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoItem({
  label, value, valueClass = '',
}: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] text-academic-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-academic-700 font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}
