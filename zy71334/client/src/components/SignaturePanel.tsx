import { useState } from 'react'
import { Confirmation, ConfirmRequest } from '../types'
import { problemApi } from '../services/api'
import { formatDateTime } from '../utils/format'
import { Headphones, Sliders, CheckCircle, Clock, PenLine } from 'lucide-react'

interface SignaturePanelProps {
  problemId: string
  confirmation: Confirmation | null
  currentVersion: number
  onConfirmed?: () => void
}

export default function SignaturePanel({ problemId, confirmation, currentVersion, onConfirmed }: SignaturePanelProps) {
  const [musicianSignature, setMusicianSignature] = useState('')
  const [engineerSignature, setEngineerSignature] = useState('')
  const [notes, setNotes] = useState('')
  const [signingType, setSigningType] = useState<'musician' | 'engineer' | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSign = async (type: 'musician' | 'engineer') => {
    const signature = type === 'musician' ? musicianSignature : engineerSignature
    if (!signature.trim()) return

    setLoading(true)
    try {
      const request: ConfirmRequest = {
        type,
        signature: signature.trim(),
        notes: notes.trim() || undefined,
      }
      await problemApi.confirm(problemId, request)
      onConfirmed?.()
      setSigningType(null)
      if (type === 'musician') setMusicianSignature('')
      else setEngineerSignature('')
    } catch (error) {
      console.error('Failed to sign:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
        <PenLine className="w-4 h-4 text-accent-amber" />
        签收确认
        <span className="ml-auto text-xs text-slate-400 font-normal">
          版本 V{currentVersion}
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`bg-stage-darker rounded-lg p-4 ${confirmation?.musicianSigned ? 'border border-accent-green/30' : 'border border-stage-border'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Headphones className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">乐手确认</span>
            {confirmation?.musicianSigned && (
              <CheckCircle className="w-4 h-4 text-accent-green ml-auto" />
            )}
          </div>

          {confirmation?.musicianSigned ? (
            <div>
              <p className="text-white font-medium text-lg">{confirmation.musicianSignature}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(confirmation.musicianSignedAt!)}
              </p>
            </div>
          ) : signingType === 'musician' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={musicianSignature}
                onChange={(e) => setMusicianSignature(e.target.value)}
                placeholder="请输入乐手姓名"
                className="input"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSign('musician')}
                  disabled={loading || !musicianSignature.trim()}
                  className="btn-primary flex-1 text-xs py-1.5"
                >
                  {loading ? '确认中...' : '确认签收'}
                </button>
                <button
                  onClick={() => setSigningType(null)}
                  className="btn-secondary text-xs py-1.5"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSigningType('musician')}
              className="w-full py-2 border border-dashed border-stage-border rounded text-sm text-slate-400 hover:border-accent-amber hover:text-accent-amber transition-colors"
            >
              + 乐手签收
            </button>
          )}
        </div>

        <div className={`bg-stage-darker rounded-lg p-4 ${confirmation?.engineerSigned ? 'border border-accent-green/30' : 'border border-stage-border'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">音响师确认</span>
            {confirmation?.engineerSigned && (
              <CheckCircle className="w-4 h-4 text-accent-green ml-auto" />
            )}
          </div>

          {confirmation?.engineerSigned ? (
            <div>
              <p className="text-white font-medium text-lg">{confirmation.engineerSignature}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(confirmation.engineerSignedAt!)}
              </p>
            </div>
          ) : signingType === 'engineer' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={engineerSignature}
                onChange={(e) => setEngineerSignature(e.target.value)}
                placeholder="请输入音响师姓名"
                className="input"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSign('engineer')}
                  disabled={loading || !engineerSignature.trim()}
                  className="btn-primary flex-1 text-xs py-1.5"
                >
                  {loading ? '确认中...' : '确认签收'}
                </button>
                <button
                  onClick={() => setSigningType(null)}
                  className="btn-secondary text-xs py-1.5"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSigningType('engineer')}
              className="w-full py-2 border border-dashed border-stage-border rounded text-sm text-slate-400 hover:border-accent-amber hover:text-accent-amber transition-colors"
            >
              + 音响师签收
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label">备注</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="填写调音备注或乐手反馈..."
          className="input resize-none h-20"
        />
      </div>

      {confirmation?.notes && (
        <div className="mt-4 pt-4 border-t border-stage-border">
          <span className="text-xs text-slate-500">历史备注</span>
          <p className="text-sm text-slate-300 mt-1">{confirmation.notes}</p>
        </div>
      )}

      {confirmation?.musicianSigned && confirmation?.engineerSigned && (
        <div className="mt-4 p-3 rounded-lg bg-accent-green/10 border border-accent-green/30 text-center">
          <CheckCircle className="w-6 h-6 text-accent-green mx-auto mb-2" />
          <p className="text-accent-green font-medium">双签确认已完成</p>
          <p className="text-xs text-slate-400 mt-1">问题已闭环，数据已归档</p>
        </div>
      )}
    </div>
  )
}
