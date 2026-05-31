import { useState, useEffect, useCallback } from 'react'
import { FileText, Shield, ClipboardCheck, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import type { GuideSection } from '@/types'

const sectionIcons: Record<string, React.ElementType> = {
  'annotation-sample-placement': FileText,
  'training-set-leakage-check': Shield,
  'evaluation-review-before-export': ClipboardCheck,
}

const keyPaths = [
  { label: '标注样本目录', path: '/data/samples/{model_id}/' },
  { label: '泄漏检查脚本', path: '/scripts/leakage_check.py' },
  { label: '评估导出目录', path: '/data/exports/{report_id}/' },
]

const faqItems = [
  { q: '样本解析失败怎么办？', a: '检查JSON格式是否合法，确认必填字段label和content存在。' },
  { q: '一致性检查不通过？', a: '查看不一致条目的reason字段，修正结论描述或评估指标后重新检查。' },
  { q: '如何修改已导出的报告？', a: '变更历史会自动记录修改，导出前再次执行复核流程即可。' },
]

export default function Guide() {
  const { guideSections, loading, loadGuide } = useAppStore()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  useEffect(() => {
    loadGuide()
  }, [loadGuide])

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleStep = useCallback((sectionId: string, step: number) => {
    const key = `${sectionId}-${step}`
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const totalSteps = guideSections.reduce((acc, s) => acc + s.steps.length, 0)
  const completedSteps = guideSections.reduce(
    (acc, s) => acc + s.steps.filter((step) => checkedSteps[`${s.id}-${step.step}`]).length,
    0,
  )
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          收尾指南
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          算法工程师操作手册
        </p>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>完成进度</span>
          <span style={{ color: 'var(--accent-amber)' }}>{progress}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--accent-amber)',
              minWidth: progress > 0 ? '8px' : undefined,
            }}
          />
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          {loading && guideSections.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <p style={{ color: 'var(--text-muted)' }}>加载中...</p>
            </div>
          )}

          {guideSections.map((section) => (
            <GuideCard
              key={section.id}
              section={section}
              expanded={!!expandedSections[section.id]}
              checkedSteps={checkedSteps}
              onToggleSection={toggleSection}
              onToggleStep={toggleStep}
            />
          ))}
        </div>

        <div className="hidden w-72 flex-shrink-0 lg:block">
          <div className="sticky top-6 space-y-5">
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-tertiary)',
              }}
            >
              <h3
                className="mb-3 text-sm font-semibold"
                style={{ color: 'var(--accent-amber)' }}
              >
                关键路径
              </h3>
              <div className="space-y-3">
                {keyPaths.map((item) => (
                  <div key={item.label}>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {item.label}
                    </p>
                    <code
                      className="mt-0.5 block break-all rounded px-2 py-1 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {item.path}
                    </code>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-tertiary)',
              }}
            >
              <h3
                className="mb-3 text-sm font-semibold"
                style={{ color: 'var(--accent-amber)' }}
              >
                常见问题
              </h3>
              <div className="space-y-2">
                {faqItems.map((item, idx) => (
                  <div key={idx}>
                    <button
                      className="flex w-full items-start gap-2 text-left text-xs"
                      onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                    >
                      <ChevronDown
                        className={cn(
                          'mt-0.5 h-3 w-3 flex-shrink-0 transition-transform duration-200',
                          faqOpen === idx && 'rotate-180',
                        )}
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.q}</span>
                    </button>
                    <div
                      className={cn(
                        'overflow-hidden transition-all duration-200',
                        faqOpen === idx ? 'mt-1.5 max-h-40 opacity-100' : 'max-h-0 opacity-0',
                      )}
                    >
                      <p
                        className="pl-5 text-xs leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.a}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GuideCard({
  section,
  expanded,
  checkedSteps,
  onToggleSection,
  onToggleStep,
}: {
  section: GuideSection
  expanded: boolean
  checkedSteps: Record<string, boolean>
  onToggleSection: (id: string) => void
  onToggleStep: (sectionId: string, step: number) => void
}) {
  const Icon = sectionIcons[section.id] || FileText

  const sectionChecked = section.steps.filter(
    (s) => checkedSteps[`${section.id}-${s.step}`],
  ).length
  const sectionTotal = section.steps.length

  return (
    <div
      className="overflow-hidden rounded-lg border transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: expanded ? 'var(--accent-amber)' : 'var(--bg-tertiary)',
      }}
    >
      <button
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        onClick={() => onToggleSection(section.id)}
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
        >
          <Icon className="h-5 w-5" style={{ color: 'var(--accent-amber)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {section.title}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {sectionChecked}/{sectionTotal} 已完成
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0',
        )}
        style={{ overflow: 'hidden' }}
      >
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--bg-tertiary)' }}>
          <ol className="space-y-4">
            {section.steps.map((step) => {
              const stepKey = `${section.id}-${step.step}`
              const checked = !!checkedSteps[stepKey]
              return (
                <li key={step.step} className="flex items-start gap-3">
                  <button
                    className="mt-0.5 flex-shrink-0"
                    onClick={() => onToggleStep(section.id, step.step)}
                  >
                    {checked ? (
                      <CheckCircle2
                        className="h-5 w-5 transition-colors duration-200"
                        style={{ color: 'var(--accent-amber)' }}
                      />
                    ) : (
                      <Circle
                        className="h-5 w-5 transition-colors duration-200"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    )}
                  </button>
                  <div
                    className={cn(
                      'flex items-start gap-3 flex-1 min-w-0 transition-all duration-300',
                      checked && 'opacity-50',
                    )}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: checked ? 'var(--bg-tertiary)' : 'var(--accent-amber)',
                        color: checked ? 'var(--text-muted)' : 'var(--bg-primary)',
                      }}
                    >
                      {step.step}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className={cn(
                          'text-sm font-medium transition-all duration-300',
                          checked && 'line-through',
                        )}
                        style={{ color: checked ? 'var(--text-muted)' : 'var(--text-primary)' }}
                      >
                        {step.title}
                      </h3>
                      <p
                        className={cn(
                          'mt-0.5 text-xs leading-relaxed transition-all duration-300',
                          checked && 'line-through',
                        )}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
