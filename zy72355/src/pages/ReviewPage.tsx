import { useState, useEffect } from 'react'
import { FileSearch, Save, AlertTriangle, History, Image, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useAssessmentStore, type AssessmentItem } from '@/stores/assessmentStore'
import StatusBadge from '@/components/StatusBadge'
import { Link, useNavigate } from 'react-router-dom'

export default function ReviewPage() {
  const { items, fetchItems, loading, updateRemark, fetchBoundaryRules, boundaryRules } = useAssessmentStore()
  const [selected, setSelected] = useState<AssessmentItem | null>(null)
  const [remark, setRemark] = useState('')
  const [directionOverride, setDirectionOverride] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
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

  const pendingItems = items.filter(i => i.status === '待补看' || i.status === '退回')

  const checkBoundary = (dir: string) => {
    return boundaryRules.some(r => dir.includes(r.pattern))
  }

  const handleSave = async () => {
    if (!selected) return
    await updateRemark(selected.id, remark, directionOverride !== selected.direction ? directionOverride : undefined)
    setSavedId(selected.id)
    setTimeout(() => setSavedId(null), 2000)
  }

  const handlePrev = () => {
    const idx = pendingItems.findIndex(i => i.id === selected?.id)
    if (idx > 0) setSelected(pendingItems[idx - 1])
  }

  const handleNext = () => {
    const idx = pendingItems.findIndex(i => i.id === selected?.id)
    if (idx < pendingItems.length - 1) setSelected(pendingItems[idx + 1])
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">巡检备注补看</h1>
        <p className="text-sm text-zinc-500 mt-1">第 2 / 3 步：质检员逐条补看手写巡检备注，对照原始行号补全</p>
      </div>

      <div className="flex gap-6">
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
              <span className="text-sm font-medium text-zinc-700">待补看列表 ({pendingItems.length})</span>
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
                    {item.direction && (
                      <div className="text-xs text-zinc-400 mt-1">方向：{item.direction}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {selected ? (
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
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

              <div className="flex h-[500px]">
                <div className="w-1/2 p-5 border-r border-zinc-100">
                  <div className="text-xs text-zinc-500 mb-2">工况照片缩略图</div>
                  <div className="aspect-[4/3] bg-zinc-100 rounded flex items-center justify-center mb-3">
                    <Image size={48} className="text-zinc-300" />
                  </div>
                  <div className="text-xs space-y-2">
                    <div>
                      <span className="text-zinc-400">文件名：</span>
                      <span className="text-zinc-600">{selected.file_name}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">原始结论：</span>
                      <span className="text-zinc-700">{selected.raw_conclusion}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">原始方向：</span>
                      <span className={`${selected.boundary_flag ? 'text-amber-600 font-medium' : 'text-zinc-700'}`}>
                        {selected.boundary_flag && '⚠ '}
                        {selected.direction || '（未填写）'}
                      </span>
                    </div>
                    {selected.boundary_flag && (
                      <div className="p-2 bg-amber-50 rounded mt-3">
                        <div className="flex items-start gap-1.5 text-amber-700">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium text-xs">边界规则触发</div>
                            <div className="text-xs mt-0.5">方向"{selected.direction}"为非标表述，将自动进入"待实验老师复核"状态</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-1/2 p-5">
                  <div className="text-xs text-zinc-500 mb-2">手写巡检备注</div>
                  <textarea
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    className="w-full h-40 p-3 text-sm border border-zinc-200 rounded focus:outline-none focus:border-[#1B3A4B] resize-none"
                    placeholder="在此输入从手写巡检备注中补看的内容..."
                  />

                  <div className="text-xs text-zinc-500 mb-2 mt-4">方向（可修改）</div>
                  <input
                    type="text"
                    value={directionOverride}
                    onChange={e => setDirectionOverride(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded focus:outline-none ${
                      checkBoundary(directionOverride)
                        ? 'border-amber-300 focus:border-amber-400 bg-amber-50'
                        : 'border-zinc-200 focus:border-[#1B3A4B]'
                    }`}
                    placeholder="如：正方向、负方向..."
                  />

                  {checkBoundary(directionOverride) && (
                    <div className="p-2 bg-amber-50 rounded mt-2 text-xs text-amber-700">
                      <AlertTriangle size={12} className="inline mr-1" />
                      保存后将进入"待实验老师复核"，不会自动归正常
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      改前：{selected.remark || '（空）'}
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="px-4 py-2 text-sm bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savedId === selected.id ? (
                        <><Check size={14} /> 已保存</>
                      ) : (
                        <><Save size={14} /> 保存备注</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {remark && remark !== selected.remark
                    ? '备注已修改，保存后将生成变更历史记录'
                    : '仅修改的字段会记入变更历史'}
                </div>
                <button
                  onClick={() => navigate('/abnormal')}
                  className="text-sm text-[#1B3A4B] hover:underline"
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
