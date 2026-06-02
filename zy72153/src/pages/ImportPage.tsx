import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { createPointLocation, createApprovalRecord } from '@/lib/merge-detect'
import { Upload, FileText, Image, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { cn } from '@/lib/utils'
import type { PointLocation, ApprovalRecord } from '@/types'

const POINT_COL_MAP: Record<string, keyof PointLocation> = {
  路口名称: 'name', 行政区划: 'district', 经度: 'longitude', 纬度: 'latitude',
  投诉编号: 'complaintId', 投诉时间: 'complaintTime', 审批编号: 'approvalRef',
  设计容量: 'designCapacity', 实际需求: 'actualDemand',
  施工期: 'constructionPeriod', 养护期: 'maintenancePeriod',
}

const APPROVAL_COL_MAP: Record<string, keyof ApprovalRecord> = {
  审批编号: 'approvalRef', 路口名称: 'locationName', 行政区划: 'district',
  审批内容: 'content', 审批状态: 'approvalStatus', 审批时间: 'approvedAt',
  设计容量: 'designCapacity', 施工期: 'constructionPeriod', 养护期: 'maintenancePeriod',
}

function parseCsv<T>(file: File, colMap: Record<string, keyof T>): Promise<{ rows: Partial<T>[], emptyCount: number }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, { header: true, skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.map((row: Record<string, string>) => {
          const mapped: Record<string, unknown> = {}
          for (const [cn, key] of Object.entries(colMap)) {
            let val: unknown = row[cn]?.trim() ?? ''
            if (key === 'longitude' || key === 'latitude' || key === 'designCapacity' || key === 'actualDemand') {
              val = val ? Number(val) : null
            }
            mapped[key as string] = val
          }
          return mapped as Partial<T>
        })
        const emptyCount = rows.filter(r => Object.values(r).some(v => v === '' || v === null || v === undefined)).length
        resolve({ rows, emptyCount })
      },
      error: reject,
    })
  })
}

function DropZone({ onFile, dragOver, onDragOver, onDragLeave, onDrop, label }: {
  onFile: (f: File) => void, dragOver: boolean,
  onDragOver: (e: React.DragEvent) => void, onDragLeave: () => void, onDrop: (e: React.DragEvent) => void,
  label: string,
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('border-2 border-dashed border-stone-300 rounded-lg p-8 text-center cursor-pointer transition-colors', dragOver && 'drag-active')}
      onClick={() => inputRef.current?.click()}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <Upload className="mx-auto mb-2 text-stone-400" size={32} />
      <p className="text-stone-500 text-sm">{label}</p>
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  )
}

export default function ImportPage() {
  const store = useStore()
  const [previewPoints, setPreviewPoints] = useState<Partial<PointLocation>[]>([])
  const [previewApprovals, setPreviewApprovals] = useState<Partial<ApprovalRecord>[]>([])
  const [pointEmpty, setPointEmpty] = useState(0)
  const [approvalEmpty, setApprovalEmpty] = useState(0)
  const [selectedPointId, setSelectedPointId] = useState('')
  const [dragOver, setDragOver] = useState({ point: false, approval: false })
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])

  const handlePointFile = useCallback(async (file: File) => {
    const { rows, emptyCount } = await parseCsv<PointLocation>(file, POINT_COL_MAP)
    setPreviewPoints(rows); setPointEmpty(emptyCount)
  }, [])

  const handleApprovalFile = useCallback(async (file: File) => {
    const { rows, emptyCount } = await parseCsv<ApprovalRecord>(file, APPROVAL_COL_MAP)
    setPreviewApprovals(rows); setApprovalEmpty(emptyCount)
  }, [])

  const importPoints = async () => {
    const points = previewPoints.map(d => createPointLocation(d as Partial<PointLocation>))
    await store.addPoints(points)
    await store.runMergeDetection(); await store.runConflictDetection()
    setPreviewPoints([]); setPointEmpty(0)
  }

  const importApprovals = async () => {
    const approvals = previewApprovals.map(d => createApprovalRecord(d as Partial<ApprovalRecord>))
    await store.addApprovals(approvals)
    await store.runConflictDetection()
    setPreviewApprovals([]); setApprovalEmpty(0)
  }

  const uploadPhotos = async () => {
    if (!selectedPointId || !photoFiles.length) return
    await store.addPhotos(selectedPointId, photoFiles)
    setPhotoFiles([])
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
  const existingPhotos = selectedPointId ? store.getPhotosForPoint(selectedPointId) : []

  const PreviewTable = ({ rows, cols }: { rows: Record<string, unknown>[], cols: string[] }) => (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-xs">
        <thead><tr className="bg-stone-50">{cols.map(c => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-stone-100">{cols.map(c => <td key={c} className="px-2 py-1">{String(r[c] ?? '')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="font-serif-title text-2xl font-semibold text-teal-800">导入台</h1>
      <p className="text-stone-400 text-sm mb-6">导入点位数据、审批台账和照片附件</p>

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-stone-700 flex items-center gap-2 mb-3"><FileText size={18} />点位数据导入</h2>
        <DropZone onFile={handlePointFile} dragOver={dragOver.point}
          onDragOver={e => { onDragOver(e); setDragOver(d => ({ ...d, point: true })) }}
          onDragLeave={() => setDragOver(d => ({ ...d, point: false }))}
          onDrop={e => { e.preventDefault(); setDragOver(d => ({ ...d, point: false })); e.dataTransfer.files[0] && handlePointFile(e.dataTransfer.files[0]) }}
          label="拖拽CSV文件到此处，或点击选择文件" />
        {previewPoints.length > 0 && <>
          <PreviewTable rows={previewPoints as Record<string, unknown>[]} cols={Object.keys(POINT_COL_MAP)} />
          <p className="text-sm text-stone-500 mt-2 flex items-center gap-1"><AlertCircle size={14} />解析到 {previewPoints.length} 条记录，{pointEmpty} 条存在空值</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={importPoints}>确认导入</button>
            <button className="btn-secondary" onClick={() => { setPreviewPoints([]); setPointEmpty(0) }}>清空预览</button>
          </div>
        </>}
      </div>

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-stone-700 flex items-center gap-2 mb-3"><FileText size={18} />审批台账导入</h2>
        <DropZone onFile={handleApprovalFile} dragOver={dragOver.approval}
          onDragOver={e => { onDragOver(e); setDragOver(d => ({ ...d, approval: true })) }}
          onDragLeave={() => setDragOver(d => ({ ...d, approval: false }))}
          onDrop={e => { e.preventDefault(); setDragOver(d => ({ ...d, approval: false })); e.dataTransfer.files[0] && handleApprovalFile(e.dataTransfer.files[0]) }}
          label="拖拽CSV文件到此处，或点击选择文件" />
        {previewApprovals.length > 0 && <>
          <PreviewTable rows={previewApprovals as Record<string, unknown>[]} cols={Object.keys(APPROVAL_COL_MAP)} />
          <p className="text-sm text-stone-500 mt-2 flex items-center gap-1"><AlertCircle size={14} />解析到 {previewApprovals.length} 条记录，{approvalEmpty} 条存在空值</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={importApprovals}>确认导入</button>
            <button className="btn-secondary" onClick={() => { setPreviewApprovals([]); setApprovalEmpty(0) }}>清空预览</button>
          </div>
        </>}
      </div>

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-stone-700 flex items-center gap-2 mb-3"><Image size={18} />照片附件补充</h2>
        <select className="select-field mb-3" value={selectedPointId} onChange={e => setSelectedPointId(e.target.value)}>
          <option value="">选择点位…</option>
          {store.points.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="block text-sm text-stone-500 mb-3"
          onChange={e => setPhotoFiles(Array.from(e.target.files ?? []))} />
        {existingPhotos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {existingPhotos.map(ph => (
              <img key={ph.id} src={URL.createObjectURL(ph.fileData)} alt={ph.fileName}
                className="w-20 h-20 object-cover rounded-lg border border-stone-200" />
            ))}
          </div>
        )}
        <button className="btn-primary" onClick={uploadPhotos} disabled={!selectedPointId || !photoFiles.length}>上传照片</button>
      </div>
    </div>
  )
}
