import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileText,
  Image,
  MessageSquare,
  File,
  Plus,
} from 'lucide-react'
import { useRecordStore } from '@/store/recordStore'
import StatusBadge from '@/components/StatusBadge'
import RejudgeModal from '@/components/RejudgeModal'
import RollbackModal from '@/components/RollbackModal'
import SupplementModal from '@/components/SupplementModal'
import { formatAmount, formatDate } from '@/lib/utils'
import { STATUS_LABELS, ATTACHMENT_TYPE_LABELS } from '../../shared/types'
import type { AttachmentType, ActionType, RecordStatus } from '../../shared/types'

const ATTACHMENT_ICONS: Record<AttachmentType, React.ReactNode> = {
  bank_receipt: <FileText size={20} className="text-blue-400" />,
  ledger: <FileText size={20} className="text-purple-400" />,
  screenshot: <Image size={20} className="text-emerald-400" />,
  explanation: <MessageSquare size={20} className="text-amber-400" />,
  other: <File size={20} className="text-gray-400" />,
}

const TIMELINE_DOT_COLORS: Record<ActionType, string> = {
  create: 'bg-blue-500',
  rejudge: 'bg-amber-500',
  rollback: 'bg-gray-400',
  supplement: 'bg-emerald-500',
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { detail, detailLoading, fetchDetail, rejudge, rollback, supplement } =
    useRecordStore()

  const [rejudgeOpen, setRejudgeOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [supplementOpen, setSupplementOpen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<AttachmentType>('other')
  const [uploadRemark, setUploadRemark] = useState('')

  useEffect(() => {
    if (id) fetchDetail(id)
  }, [id])

  const handleUpload = async () => {
    if (!uploadFile || !id) return
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('file_type', uploadType)
    formData.append('original_remark', uploadRemark)
    await fetch(`/api/records/${id}/attachments`, { method: 'POST', body: formData })
    setShowUpload(false)
    setUploadFile(null)
    setUploadRemark('')
    fetchDetail(id)
  }

  if (detailLoading || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        加载中...
      </div>
    )
  }

  const { data, attachments, audit_logs } = detail

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>

        <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-6 relative">
          <div className="absolute top-6 right-6">
            <StatusBadge status={data.status} />
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-4 pr-24">{data.unit_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">金额</p>
              <p className="text-lg font-mono font-semibold text-gray-100">
                {formatAmount(data.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">保证金类型</p>
              <p className="text-sm text-gray-200">{data.deposit_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">原始来源</p>
              <p className="text-sm text-gray-200">{data.source}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">首次录入时间</p>
              <p className="text-sm text-gray-300">{formatDate(data.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">最近更新</p>
              <p className="text-sm text-gray-300">{formatDate(data.updated_at)}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-100">
              附件资料 <span className="text-gray-500 text-sm">({attachments.length})</span>
            </h3>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400 transition-colors"
            >
              <Upload size={14} />
              上传
            </button>
          </div>

          {showUpload && (
            <div className="mb-4 p-4 bg-[#12122a] border border-[#2a2a4a] rounded space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-[#2a2a4a] file:text-gray-300"
                />
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as AttachmentType)}
                  className="bg-[#1e1e3a] border border-[#2a2a4a] rounded px-2 py-1 text-sm text-gray-200 focus:outline-none"
                >
                  {(Object.entries(ATTACHMENT_TYPE_LABELS) as [AttachmentType, string][]).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <input
                type="text"
                placeholder="备注..."
                value={uploadRemark}
                onChange={(e) => setUploadRemark(e.target.value)}
                className="w-full bg-[#1e1e3a] border border-[#2a2a4a] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-3 py-1 text-sm text-gray-400 hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile}
                  className="px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  上传
                </button>
              </div>
            </div>
          )}

          {attachments.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">暂无附件</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="bg-[#12122a] border border-[#2a2a4a] rounded-lg p-3 hover:border-[#3a3a5a] transition-colors"
                >
                  <div className="flex items-start gap-2 mb-2">
                    {ATTACHMENT_ICONS[att.file_type]}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-200 truncate">{att.file_name}</p>
                      <p className="text-xs text-gray-500">{ATTACHMENT_TYPE_LABELS[att.file_type]}</p>
                    </div>
                  </div>
                  {att.original_remark && (
                    <p className="text-xs text-gray-500 line-clamp-2 break-all">
                      {att.original_remark}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg p-6">
          <h3 className="text-base font-medium text-gray-100 mb-4">判定时间线</h3>
          <div className="space-y-0">
            {audit_logs.map((log, idx) => (
              <div key={log.id} className="flex gap-4 relative">
                <div className="w-28 shrink-0 text-right pt-0.5">
                  <p className="text-xs text-gray-500">{formatDate(log.created_at)}</p>
                </div>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${TIMELINE_DOT_COLORS[log.action]} ring-4 ring-[#1e1e3a] z-10 shrink-0`}
                  />
                  {idx < audit_logs.length - 1 && (
                    <div className="w-px flex-1 bg-[#2a2a4a]" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  {log.action === 'create' && (
                    <p className="text-sm text-gray-300">创建记录</p>
                  )}
                  {log.action === 'rejudge' && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-300">
                        状态变更: {STATUS_LABELS[log.old_status as RecordStatus]} →{' '}
                        {STATUS_LABELS[log.new_status as RecordStatus]}
                      </p>
                      {log.reason && (
                        <p className="text-xs text-gray-500">原因: {log.reason}</p>
                      )}
                    </div>
                  )}
                  {log.action === 'rollback' && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-300">
                        回滚: {STATUS_LABELS[log.old_status as RecordStatus]} →{' '}
                        {STATUS_LABELS[log.new_status as RecordStatus]}
                      </p>
                      {log.reason && (
                        <p className="text-xs text-gray-500">原因: {log.reason}</p>
                      )}
                    </div>
                  )}
                  {log.action === 'supplement' && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-300">补录备注</p>
                      {log.diff_summary && (
                        <p className="text-xs text-gray-500">{log.diff_summary}</p>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">{log.operator}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e]/95 backdrop-blur border-t border-[#2a2a4a]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setRejudgeOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
          >
            改判
          </button>
          <button
            onClick={() => setRollbackOpen(true)}
            className="px-4 py-2 text-sm font-medium border border-[#2a2a4a] text-gray-300 hover:bg-[#2a2a4a] rounded transition-colors"
          >
            回退
          </button>
          <button
            onClick={() => setSupplementOpen(true)}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium border border-[#2a2a4a] text-gray-300 hover:bg-[#2a2a4a] rounded transition-colors"
          >
            <Plus size={14} />
            补录备注
          </button>
        </div>
      </div>

      <RejudgeModal
        open={rejudgeOpen}
        onClose={() => setRejudgeOpen(false)}
        currentStatus={data.status}
        onConfirm={(d) => rejudge(id!, d)}
      />
      <RollbackModal
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        onConfirm={(d) => rollback(id!, d)}
      />
      <SupplementModal
        open={supplementOpen}
        onClose={() => setSupplementOpen(false)}
        currentRemark={data.original_remark}
        onConfirm={(d) => supplement(id!, d)}
      />
    </div>
  )
}
