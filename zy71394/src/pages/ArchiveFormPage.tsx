import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, X } from 'lucide-react'
import { api } from '@/services/api'
import { useStore } from '@/store/app'
import type { PromptDetail, CreatePromptRequest, UpdatePromptRequest } from '../../shared/types'
import { getRatingColor, getStatusBadge } from '@/components/StatusBadges'
import DuplicateCheckModal from '@/components/DuplicateCheckModal'

interface FormData {
  title: string
  content: string
  techStacks: string[]
  rating: number
  failureReasons: string[]
  tags: string[]
  changeReason: string
  status: 'active' | 'deprecated' | 'archived'
}

const initialFormData: FormData = {
  title: '',
  content: '',
  techStacks: [],
  rating: 5,
  failureReasons: [],
  tags: [],
  changeReason: '',
  status: 'active',
}

export default function ArchiveFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showDuplicateCheck, hideDuplicateCheck, duplicateCheckResult } = useStore()
  const isEdit = !!id || searchParams.get('edit') === '1'

  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prompt, setPrompt] = useState<PromptDetail | null>(null)
  const [availableTechStacks, setAvailableTechStacks] = useState<string[]>([])
  const [availableFailureReasons, setAvailableFailureReasons] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    loadMetaData()
    if (isEdit) {
      loadPrompt()
    }
  }, [id, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMetaData() {
    const [st, fr] = await Promise.all([
      api.tags.techStacks(),
      api.tags.failureReasons(),
    ])
    setAvailableTechStacks(st)
    setAvailableFailureReasons(fr)
  }

  async function loadPrompt() {
    setLoading(true)
    try {
      const data = await api.prompts.get(id!)
      setPrompt(data)
      setFormData({
        title: data.title,
        content: data.content,
        techStacks: data.techStacks,
        rating: data.rating,
        failureReasons: data.failureReasons,
        tags: data.tags,
        changeReason: '',
        status: data.status,
      })
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function toggleTechStack(tech: string) {
    setFormData(prev => ({
      ...prev,
      techStacks: prev.techStacks.includes(tech)
        ? prev.techStacks.filter(t => t !== tech)
        : [...prev.techStacks, tech],
    }))
  }

  function toggleFailureReason(reason: string) {
    setFormData(prev => ({
      ...prev,
      failureReasons: prev.failureReasons.includes(reason)
        ? prev.failureReasons.filter(r => r !== reason)
        : [...prev.failureReasons, reason],
    }))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      alert('请输入标题')
      return
    }
    if (!formData.content.trim()) {
      alert('请输入内容')
      return
    }
    if (isEdit && !formData.changeReason.trim()) {
      alert('请输入修改原因')
      return
    }

    try {
      const duplicateResult = await api.prompts.checkDuplicates(
        formData.title,
        formData.content,
        id
      )

      if (duplicateResult.hasDuplicate) {
        showDuplicateCheck(formData.title, formData.content)
        return
      }

      await doSave()
    } catch (e) {
      console.error(e)
      alert('保存失败')
    }
  }

  async function doSave() {
    setSaving(true)
    try {
      const baseData = {
        title: formData.title,
        content: formData.content,
        techStacks: formData.techStacks,
        rating: formData.rating,
        failureReasons: formData.failureReasons,
        tags: formData.tags,
      }

      if (isEdit) {
        const updateData: UpdatePromptRequest = {
          ...baseData,
          changeReason: formData.changeReason,
          status: formData.status,
        }
        await api.prompts.update(id!, updateData)
        navigate(`/archive/${id}`)
      } else {
        const createData: CreatePromptRequest = {
          ...baseData,
          changeReason: formData.changeReason || undefined,
        }
        const result = await api.prompts.create(createData)
        navigate(`/archive/${result.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(isEdit ? `/archive/${id}` : '/archive')}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-100">
            {isEdit ? '编辑提示词' : '新增提示词'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isEdit ? '修改现有提示词并创建新版本' : '录入新的提示词到知识库'}
          </p>
        </div>
        {isEdit && prompt && getStatusBadge(prompt.status)}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <div className="card p-6">
            <label className="label">标题</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="输入提示词标题，便于检索和识别"
              className="input"
            />
          </div>

          <div className="card p-6">
            <label className="label">内容</label>
            <textarea
              value={formData.content}
              onChange={e => updateField('content', e.target.value)}
              placeholder="输入提示词完整内容"
              rows={12}
              className="input font-mono text-sm resize-y"
            />
          </div>

          {isEdit && (
            <div className="card p-6">
              <label className="label">修改原因</label>
              <textarea
                value={formData.changeReason}
                onChange={e => updateField('changeReason', e.target.value)}
                placeholder="描述本次修改的原因和内容"
                rows={3}
                className="input"
              />
              {isEdit && (
                <div className="mt-4">
                  <label className="label">状态</label>
                  <div className="flex gap-2">
                    {(['active', 'deprecated', 'archived'] as const).map(status => (
                      <button
                        key={status}
                        onClick={() => updateField('status', status)}
                        className={`chip border px-3 py-1.5 ${
                          formData.status === status
                            ? 'bg-brand-amber/20 text-brand-amber border-brand-amber/30'
                            : 'bg-bg-lighter text-gray-400 border-bg-border hover:border-gray-500'
                        }`}
                      >
                        {status === 'active' ? '在用' : status === 'deprecated' ? '弃用' : '归档'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="w-80 flex-shrink-0 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="label mb-0">评分</label>
              <span className={`badge border ${getRatingColor(formData.rating)}`}>
                {formData.rating.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={formData.rating}
              onChange={e => updateField('rating', Number(e.target.value))}
              className="w-full accent-brand-amber"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>10</span>
            </div>
          </div>

          <div className="card p-6">
            <label className="label">技术栈</label>
            <div className="flex flex-wrap gap-2">
              {availableTechStacks.map(tech => (
                <button
                  key={tech}
                  onClick={() => toggleTechStack(tech)}
                  className={`chip border ${
                    formData.techStacks.includes(tech)
                      ? 'bg-status-info/20 text-status-info border-status-info/30'
                      : 'bg-bg-lighter text-gray-400 border-bg-border hover:border-gray-500'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <label className="label">失败原因</label>
            <div className="flex flex-wrap gap-2">
              {availableFailureReasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => toggleFailureReason(reason)}
                  className={`chip border ${
                    formData.failureReasons.includes(reason)
                      ? 'bg-status-danger/20 text-status-danger border-status-danger/30'
                      : 'bg-bg-lighter text-gray-400 border-bg-border hover:border-gray-500'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <label className="label">标签</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="输入标签后按回车"
                className="input flex-1"
              />
              <button onClick={addTag} className="btn-primary px-3">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="chip bg-bg-lighter text-gray-300 border-bg-border border"
                >
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="ml-1 text-gray-500 hover:text-status-danger">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full py-3"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? '保存修改' : '创建提示词'}
          </button>
        </aside>
      </div>

      {duplicateCheckResult && (
        <DuplicateCheckModal
          title={duplicateCheckResult.title}
          content={duplicateCheckResult.content}
          excludeId={id}
          onClose={hideDuplicateCheck}
          onContinue={doSave}
        />
      )}
    </div>
  )
}
