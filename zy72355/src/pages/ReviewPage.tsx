import { useState, useEffect } from 'react'
import { FileSearch, Save, AlertTriangle, History, Image, ChevronLeft, ChevronRight, Check, User, FileText, ArrowRight } from 'lucide-react'
import { useAssessmentStore, type AssessmentItem } from '@/stores/assessmentStore'
import StatusBadge from '@/components/StatusBadge'
import { Link, useNavigate } from 'react-router-dom'

export default function ReviewPage() {
  const { items, fetchItems, loading, updateRemark, fetchBoundaryRules, boundaryRules } = useAssessmentStore()
  const [selected, setSelected] = useState<AssessmentItem | null>(null)
  const [remark, setRemark] = useState('')
  const [directionOverride, setDirectionOverride] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedItem, setSavedItem] = useState<AssessmentItem | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchItems()
    fetchBoundaryRules()
  }, [])

  useEffect(() => {
    if (selected) {
      setRemark(selected.remark)
      setDirectionOverride(selected.direction || '')
    }
  }, [selected?.id])

  const needsRemark = (i: AssessmentItem) => !i.remark || i.remark.trim().length === 0
  const pendingItems = items.filter(i =>
    i.status === '待补看' ||
    i.status === '退回' ||
    (i.status === '待实验老师复核' && needsRemark(i))
  )

  const checkBoundary = (dir: string) => {
    return boundaryRules.some(r => dir.includes(r.pattern))
  }

  const handleSave = async () => {
    if (!selected) return
    const dirOverride = directionOverride !== selected.direction ? directionOverride : undefined
    await updateRemark(selected.id, remark, dirOverride)
    setSavedId(selected.id)
    // 重新拉取最新数据
    await fetchItems()
    setTimeout(() => {
      setSavedId(null)
    }, 2500)
  }

  const handlePrev = () => {
    const idx = pendingItems.findIndex(i => i.id === selected?.id)
    if (idx > 0) setSelected(pendingItems[idx - 1])
  }

  const handleNext = () => {
    const idx = pendingItems.findIndex(i => i.id === selected?.id)
    if (idx < pendingItems.length - 1) setSelected(pendingItems[idx + 1])
  }

  // 根据最新 items 列表刷新 selected
  useEffect(() => {
    if (selected) {
      const fresh = items.find(i => i.id === selected.id)
      if (fresh && fresh.id === selected.id) {
        setSavedItem(fresh)
        // 只有当用户没在编辑时才同步更新表单
      }
    }
  }, [items.length, items.map(i => `${i.id}-${i.status}-${i.updated_at}`).join('|')])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">巡检备注补看</h1>
        <p className="text-sm text-zinc-500 mt-1">第 2 / 3 步：质检员逐条补看手写巡检备注，对照原始行号补全。含"向左/向右"等非标方向、导入即进入待复核但备注为空的记录，也会出现在此处等待补录。保存后列表、详情、历史、异常工况表同步更新同一份数据。</p>
      </div>

      <div className="flex gap-6">
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
              <span className="text-sm font-medium text-zinc-700">待补看 / 待复核空备注 ({pendingItems.length})</span>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {pendingItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-400">
                  <FileSearch size={32} className="mx-auto mb-2" />
                  暂无待补看条目
                </div>
              ) : (
                pendingItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`px-4 py-3 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors ${
                      selected?.id === item.id ? 'bg-zinc-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-800">行号 {item.line_number}</span>
                      <StatusBadge status={item.status} boundaryFlag={item.boundary_flag} />
                    </div>
                    <div className="text-xs text-zinc-500 truncate">{item.raw_conclusion}</div>
                    <div className="text-xs flex items-center gap-1 text-zinc-400 mt-1">
                      <FileText size={11} />
                      备注：{item.remark ? '已补' : '未补'}
                      {item.status === '待实验老师复核' && needsRemark(item) && <span className="text-amber-600 font-medium">· 待复核（先补备注）</span>}
                      {item.direction && ` · 方向：${item.direction}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#1B3A4B] text-white rounded-lg text-xs">
            <div className="font-medium mb-1.5 flex items-center gap-1.5">
              <ArrowRight size={12} /> 三步同一份数据
            </div>
            <p className="text-white/70 leading-relaxed">
              ①导入 → ②补看备注 → ③异常表复核<br/>
              每一步都写同一条记录，变更历史可见。
            </p>
          </div>
        </div>

        <div className="flex-1">
          {selected ? (
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-zinc-800">行号 {selected.line_number}</span>
                  <StatusBadge status={selected.status} boundaryFlag={selected.boundary_flag} />
                  <Link
                    to={`/history/${selected.id}`}
                    target="_blank"
                    className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
                  >
                    <History size={12} />
                    查看变更历史
                  </Link>
                  {savedId === selected.id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-emerald-700 bg-emerald-50">
                      <Check size={12} /> 已保存，列表/异常表/历史已同步更新
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrev} disabled={pendingItems[0]?.id === selected.id} className="p-1.5 hover:bg-zinc-100 rounded disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={handleNext} disabled={pendingItems[pendingItems.length - 1]?.id === selected.id} className="p-1.5 hover:bg-zinc-100 rounded disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-zinc-100">
                <div className="p-5">
                  <div className="text-xs text-zinc-500 mb-2">工况照片（原始证据）</div>
                  <div className="aspect-[4/3] bg-zinc-100 rounded flex items-center justify-center mb-3 border border-zinc-200">
                    <Image size={48} className="text-zinc-300" />
                  </div>
                  <div className="text-xs space-y-2">
                    <div className="flex">
                      <span className="w-20 text-zinc-400 shrink-0">文件名：</span>
                      <span className="text-zinc-600 break-all">{selected.file_name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 text-zinc-400 shrink-0">原始结论：</span>
                      <span className="text-zinc-700">{selected.raw_conclusion}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 text-zinc-400 shrink-0">原始行号：</span>
                      <span className="text-zinc-700 font-mono">#{selected.line_number}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 text-zinc-400 shrink-0">原始方向：</span>
                      <span className={selected.boundary_flag ? 'text-amber-600 font-medium' : 'text-zinc-700'}>
                        {selected.boundary_flag && '⚠ '}
                        {selected.raw_direction_original || selected.direction || '（未填写）'}
                      </span>
                    </div>
                    {selected.raw_direction_original && selected.raw_direction_original !== selected.direction && (
                      <div className="flex">
                        <span className="w-20 text-zinc-400 shrink-0">当前方向：</span>
                        <span className="text-zinc-700">{selected.direction}</span>
                      </div>
                    )}
                    {selected.direction_normalized && (
                      <div className="flex">
                        <span className="w-20 text-zinc-400 shrink-0">建议归一：</span>
                        <span className="text-blue-600">{selected.direction_normalized}</span>
                      </div>
                    )}
                  </div>

                  {selected.boundary_flag && (
                    <div className="p-3 bg-amber-50 rounded mt-3 border border-amber-100">
                      <div className="flex items-start gap-1.5 text-amber-800">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <div className="font-semibold">边界规则触发 — 不归正常</div>
                          <div className="mt-0.5">方向"{selected.raw_direction_original || selected.direction}"为非标表述。</div>
                          <div className="mt-1 flex items-center gap-1 text-amber-700">
                            <User size={11} />
                            下一步责任人：<span className="font-semibold">实验老师复核</span>
                          </div>
                          {selected.review_reason && (
                            <div className="mt-1.5 pt-1.5 border-t border-amber-200/60">
                              触发原因：{selected.review_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col">
                  <div className="text-xs text-zinc-500 mb-2">手写巡检备注（补看）</div>
                  <textarea
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    className="w-full h-40 p-3 text-sm border border-zinc-200 rounded focus:outline-none focus:border-[#1B3A4B] resize-none"
                    placeholder="在此输入从手写巡检备注中补看的内容..."
                  />

                  <div className="mt-4 text-xs text-zinc-500 mb-2">方向（可修正）</div>
                  <input
                    type="text"
                    value={directionOverride}
                    onChange={e => setDirectionOverride(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none transition-colors ${
                      checkBoundary(directionOverride)
                        ? 'border-amber-300 focus:border-amber-400 bg-amber-50'
                        : 'border-zinc-200 focus:border-[#1B3A4B]'
                    }`}
                    placeholder="如：正方向、负方向..."
                  />

                  {checkBoundary(directionOverride) && (
                    <div className="p-2 bg-amber-50 rounded mt-2 text-xs text-amber-700 border border-amber-100">
                      <AlertTriangle size={12} className="inline mr-1" />
                      保存后进入"待实验老师复核"，不会自动归正常
                    </div>
                  )}

                  <div className="mt-5 pt-4 border-t border-zinc-100 text-xs space-y-1.5">
                    <div className="flex">
                      <span className="w-16 text-zinc-400 shrink-0">改前备注：</span>
                      <span className="text-zinc-500">{selected.remark || '（空）'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16 text-zinc-400 shrink-0">改前方向：</span>
                      <span className="text-zinc-500">{selected.direction || '（空）'}</span>
                    </div>
                    {(remark !== selected.remark || directionOverride !== (selected.direction || '')) && (
                      <div className="p-2 bg-blue-50 rounded text-blue-700 mt-1.5">
                        有改动，保存将生成变更历史记录
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex justify-end">
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="px-4 py-2 text-sm bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savedId === selected.id ? (
                        <><Check size={14} /> 已保存</>
                      ) : (
                        <><Save size={14} /> 保存备注与修正</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  仅实际改动的字段会记入变更历史；列表、异常工况表、历史记录均从同一条数据读取。
                </div>
                <button
                  onClick={() => navigate('/abnormal')}
                  className="text-sm text-[#1B3A4B] hover:underline font-medium"
                >
                  前往第 3 步：异常工况表 →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center">
              <FileSearch size={48} className="mx-auto mb-3 text-zinc-300" />
              <p className="text-zinc-500">请从左侧列表选择待补看的条目</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
