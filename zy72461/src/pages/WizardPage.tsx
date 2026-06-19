import { useState } from 'react'
import { useRecordStore } from '../store/useRecordStore'
import { useNavigate } from 'react-router-dom'
import { FileText, Upload, AlertTriangle, CheckCircle, Eye, ArrowRight } from 'lucide-react'
import { statusLabels, statusColors, Conflict, RecordStatus } from '../types'
import ConflictResolver from '../components/conflict/ConflictResolver'
import ChangeTimeline from '../components/record/ChangeTimeline'

type Step = 1 | 2 | 3

const sampleNotices = [
  {
    label: '样例1：顺利记录（阳光花园）',
    data: { communityName: '阳光花园', metroStation: '地铁2号线 人民广场站', street: '人民路街道', detourRoute: '从3号口出，沿人民路向北200米，经无障碍坡道进入小区西门', hasRamp: true, rampCondition: '完好', barrierFreeInfo: '西门有无障碍坡道，坡度1:12，宽度1.5米' },
  },
  {
    label: '样例2：新旧名字冲突（幸福家园）',
    data: { communityName: '幸福家园', metroStation: '地铁3号线 幸福路站', street: '幸福路街道', detourRoute: '从2号口出，沿幸福路向东300米，经小区南门无障碍通道进入', hasRamp: true, rampCondition: '完好', barrierFreeInfo: '南门新设无障碍坡道，2026年5月完工' },
  },
  {
    label: '样例3：口径冲突（建设小区）',
    data: { communityName: '建设小区', metroStation: '地铁4号线 建设路站', street: '建设路街道', detourRoute: '从1号口出，沿建设路向南400米，经东门坡道进入', hasRamp: true, rampCondition: '完好', barrierFreeInfo: '东门无障碍坡道正常使用' },
  },
]

export default function WizardPage() {
  const navigate = useNavigate()
  const {
    importConstructionNotice,
    matchRampRecord,
    wizardRecordId,
    setWizardRecordId,
    getRecordById,
    supplementFromRamp,
    resolveNameConflict,
    currentStep,
    setCurrentStep,
  } = useRecordStore()

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState({
    communityName: '',
    metroStation: '',
    street: '',
    detourRoute: '',
    hasRamp: false,
    rampCondition: '',
    barrierFreeInfo: '',
  })

  const [matchResult, setMatchResult] = useState<{
    matched: boolean
    conflicts: Conflict[]
    status: RecordStatus
    oldName?: string
  } | null>(null)

  const [importedRecordId, setImportedRecordId] = useState<string | null>(wizardRecordId)

  const record = importedRecordId ? getRecordById(importedRecordId) : null

  const handleFormChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleLoadSample = (index: number) => {
    const sample = sampleNotices[index].data
    setForm({
      communityName: sample.communityName,
      metroStation: sample.metroStation,
      street: sample.street,
      detourRoute: sample.detourRoute,
      hasRamp: sample.hasRamp,
      rampCondition: sample.rampCondition,
      barrierFreeInfo: sample.barrierFreeInfo,
    })
  }

  const handleImport = () => {
    if (!form.communityName || !form.metroStation || !form.street || !form.detourRoute) return

    const id = importConstructionNotice({
      communityName: form.communityName,
      metroStation: form.metroStation,
      detourRoute: form.detourRoute,
      hasRamp: form.hasRamp,
      rampCondition: form.rampCondition,
      barrierFreeInfo: form.barrierFreeInfo,
      street: form.street,
    })

    setImportedRecordId(id)
    setStep(2)
    setCurrentStep(2)
  }

  const handleMatchRamp = () => {
    if (!importedRecordId) return

    const result = matchRampRecord(importedRecordId)
    setMatchResult(result)
  }

  const handleSupplement = () => {
    if (!importedRecordId) return
    supplementFromRamp(importedRecordId)
  }

  const handleResolveName = (name: string) => {
    if (!importedRecordId) return
    resolveNameConflict(importedRecordId, name)
  }

  const handleGoToSummary = () => {
    navigate('/summary')
  }

  const stepItems = [
    { num: 1, label: '导入施工告示', icon: FileText },
    { num: 2, label: '补看坡道记录', icon: Eye },
    { num: 3, label: '生成街道摘要', icon: Upload },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">地铁口无障碍绕行 - 三步操作流程</h1>

          <div className="flex items-center space-x-4 mb-6">
            {stepItems.map((s, idx) => {
              const Icon = s.icon
              const isActive = step === s.num
              const isCompleted = step > s.num
              return (
                <div key={s.num} className="flex items-center flex-1">
                  <div
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg w-full ${
                      isActive ? 'bg-blue-700 text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    <span className="font-medium text-sm">第{s.num}步：{s.label}</span>
                  </div>
                  {idx < stepItems.length - 1 && (
                    <div className={`w-8 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>第1步：导入施工告示</span>
            </h2>

            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-3">快速加载样例数据，或手动填写：</p>
              <div className="flex space-x-3">
                {sampleNotices.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleLoadSample(i)}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm rounded border border-blue-200 transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">小区名称 *</label>
                <input
                  type="text"
                  value={form.communityName}
                  onChange={(e) => handleFormChange('communityName', e.target.value)}
                  placeholder="例如：阳光花园"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地铁站 *</label>
                <input
                  type="text"
                  value={form.metroStation}
                  onChange={(e) => handleFormChange('metroStation', e.target.value)}
                  placeholder="例如：地铁2号线 人民广场站"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属街道 *</label>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => handleFormChange('street', e.target.value)}
                  placeholder="例如：人民路街道"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">有无障碍坡道</label>
                <select
                  value={form.hasRamp ? 'yes' : 'no'}
                  onChange={(e) => handleFormChange('hasRamp', e.target.value === 'yes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">无</option>
                  <option value="yes">有</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">绕行路线 *</label>
                <input
                  type="text"
                  value={form.detourRoute}
                  onChange={(e) => handleFormChange('detourRoute', e.target.value)}
                  placeholder="例如：从3号口出，沿人民路向北200米，经无障碍坡道进入小区西门"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">坡道状态</label>
                <input
                  type="text"
                  value={form.rampCondition}
                  onChange={(e) => handleFormChange('rampCondition', e.target.value)}
                  placeholder="例如：完好 / 损坏待修 / 无"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">无障碍设施说明</label>
                <input
                  type="text"
                  value={form.barrierFreeInfo}
                  onChange={(e) => handleFormChange('barrierFreeInfo', e.target.value)}
                  placeholder="例如：西门有无障碍坡道，坡度1:12"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleImport}
              disabled={!form.communityName || !form.metroStation || !form.street || !form.detourRoute}
              className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span>导入施工告示</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && record && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <Eye className="w-5 h-5 text-orange-600" />
                <span>第2步：补看无障碍坡道记录</span>
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-blue-800 mb-2">已导入的施工告示</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                  <span>小区：{record.communityName}</span>
                  <span>地铁站：{record.metroStation}</span>
                  <span>绕行路线：{record.constructionNotice.detourRoute}</span>
                  <span>坡道状态：{record.constructionNotice.rampCondition || '未填写'}</span>
                </div>
              </div>

              {!matchResult && !record.rampRecord && (
                <button
                  onClick={handleMatchRamp}
                  className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>查找匹配的无障碍坡道记录</span>
                </button>
              )}

              {matchResult && !matchResult.matched && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700">未找到匹配的无障碍坡道记录。该记录仅依据施工告示，标记为正常。</p>
                  <button
                    onClick={() => { setStep(3); setCurrentStep(3) }}
                    className="mt-3 flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    <span>下一步：生成街道摘要</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {matchResult && matchResult.matched && matchResult.conflicts.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">匹配成功，无冲突</span>
                  </div>
                  <p className="text-sm text-green-700">施工告示与坡道记录口径一致，标记为正常。</p>
                  <button
                    onClick={() => { setStep(3); setCurrentStep(3) }}
                    className="mt-3 flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    <span>下一步：生成街道摘要</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {matchResult && matchResult.matched && matchResult.conflicts.length > 0 && (
                <div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-800">
                        检测到 {matchResult.conflicts.length} 处冲突
                      </span>
                    </div>
                    <p className="text-sm text-red-700">
                      {matchResult.status === 'name_conflict'
                        ? '施工告示与坡道记录的小区名称不一致（疑似新旧名称），该记录暂不进入街道摘要，留给市政巡检员复核。'
                        : '施工告示与坡道记录在数据口径上存在矛盾，请老马确认采信哪一方。系统不会自动拍板。'}
                    </p>
                    {matchResult.oldName && (
                      <p className="text-sm text-red-700 mt-1">
                        坡道记录中的名称为「{matchResult.oldName}」，施工告示为「{record.communityName}」
                      </p>
                    )}
                  </div>

                  {matchResult.status === 'name_conflict' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-yellow-800 mb-3">名称冲突 - 市政巡检员复核</h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        同一小区新旧两个名字出现时，别急着归正常，留给市政巡检员复核。
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleResolveName(record.communityName)}
                          className="w-full text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
                        >
                          确认新名「{record.communityName}」
                        </button>
                        {matchResult.oldName && (
                          <button
                            onClick={() => handleResolveName(matchResult.oldName!)}
                            className="w-full text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                          >
                            确认旧名「{matchResult.oldName}」
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <ConflictResolver recordId={record.id} conflicts={record.conflicts} />

                  {record.conflicts.some((c) => c.status === 'pending') && record.rampRecord && (
                    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-medium text-orange-800 mb-2">一键补录坡道记录</h4>
                      <p className="text-sm text-orange-700 mb-3">
                        以坡道记录口径批量更新所有待处理冲突项，补录后状态将更新为"坡道补录"，复核完成即可进入街道摘要。
                      </p>
                      <button
                        onClick={handleSupplement}
                        className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium"
                      >
                        <Upload className="w-4 h-4" />
                        <span>以坡道记录补录所有待处理项</span>
                      </button>
                    </div>
                  )}

                  {record.conflicts.every((c) => c.status !== 'pending') && record.conflicts.length > 0 && (() => {
                    const hasRejected = record.conflicts.some((c) => c.status === 'rejected')
                    if (hasRejected) {
                      return (
                        <div className="mt-4">
                          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="w-5 h-5 text-gray-600" />
                              <span className="font-medium text-gray-800">存在驳回待查项</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              记录状态保持为「{statusLabels[record.status]}」，不进入街道摘要，需继续核实。
                            </p>
                          </div>
                          <button
                            onClick={() => { setStep(3); setCurrentStep(3) }}
                            className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                          >
                            <span>查看街道摘要预览</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    }
                    return (
                      <div className="mt-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">所有冲突已处理</span>
                          </div>
                          <p className="text-sm text-green-700 mt-1">
                            记录状态已更新为「{statusLabels[record.status]}」，可进入街道摘要。
                          </p>
                        </div>
                        <button
                          onClick={() => { setStep(3); setCurrentStep(3) }}
                          className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
                        >
                          <span>下一步：生成街道摘要</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}

              {record.rampRecord && !matchResult && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-700">该记录已有坡道记录数据，可直接查看冲突情况。</p>
                  <button
                    onClick={handleMatchRamp}
                    className="mt-2 flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    <span>重新匹配坡道记录</span>
                  </button>
                </div>
              )}
            </div>

            {record.changeHistory.length > 0 && (
              <ChangeTimeline history={record.changeHistory} />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-green-600" />
                <span>第3步：生成街道摘要</span>
              </h2>

              <SummaryPreview />

              <div className="flex items-center space-x-4 mt-6">
                <button
                  onClick={() => navigate('/summary')}
                  className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded font-medium"
                >
                  <Upload className="w-4 h-4" />
                  <span>查看完整街道摘要并导出</span>
                </button>
                <button
                  onClick={() => navigate(`/record/${importedRecordId}`)}
                  className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  <span>查看记录详情</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryPreview() {
  const { getStats, getStreetSummaries, getExcludedFromSummary } = useRecordStore()
  const stats = getStats()
  const streetSummaries = getStreetSummaries()
  const excluded = getExcludedFromSummary()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
          <p className="text-xs text-blue-600">记录总数</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {stats.normal + stats.completed + stats.rampSupplemented}
          </p>
          <p className="text-xs text-green-600">进入街道摘要</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats.nameConflict}</p>
          <p className="text-xs text-yellow-600">名称待复核（不进入摘要）</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{stats.dataConflict}</p>
          <p className="text-xs text-red-600">口径冲突（不进入摘要）</p>
        </div>
      </div>

      {streetSummaries.length > 0 ? (
        <div>
          <h3 className="font-medium text-gray-800 mb-2">将进入街道摘要的记录</h3>
          {streetSummaries.map((street) => (
            <div key={street.street} className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
              <span className="font-medium text-green-800">{street.street}</span>
              <span className="text-sm text-green-600 ml-2">{street.count} 条</span>
              {street.records.map((r) => (
                <div key={r.id} className="text-sm text-green-700 ml-4">
                  · {r.communityName}（{statusLabels[r.status]}）
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-gray-600">暂无记录进入街道摘要</p>
          <p className="text-sm text-gray-500 mt-1">所有记录均处于待复核或冲突状态</p>
        </div>
      )}

      {excluded.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-800 mb-2 text-red-700">不进入街道摘要的记录</h3>
          {excluded.map((r) => (
            <div key={r.id} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-medium text-red-800">{r.communityName}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[r.status]}`}>
                  {statusLabels[r.status]}
                </span>
              </div>
              <p className="text-sm text-red-600 ml-6">
                {r.status === 'name_conflict'
                  ? '新旧名称待市政巡检员复核，复核完成后方可进入摘要'
                  : '口径冲突待老马确认，确认后方可进入摘要'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
