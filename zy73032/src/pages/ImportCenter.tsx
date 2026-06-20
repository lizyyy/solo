import { useState, useRef, useCallback } from 'react'
import { Upload, Download, FileText, CheckCircle } from 'lucide-react'
import { useReconcileStore } from '../store/useReconcileStore'
import { SAMPLE_CSV, downloadCsv } from '../utils/helpers'
import OnboardingSidebar from '../components/OnboardingSidebar'

export default function ImportCenter() {
  const importCsv = useReconcileStore((s) => s.importCsv)
  const addMedicalRecord = useReconcileStore((s) => s.addMedicalRecord)
  const loading = useReconcileStore((s) => s.loading)
  const [csvPreview, setCsvPreview] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [csvWarning, setCsvWarning] = useState('')
  const [importSuccess, setImportSuccess] = useState(false)
  const [medicalForm, setMedicalForm] = useState({
    pet_name: '',
    visit_date: '2026-06-05',
    diagnosis: '',
    treatment: '',
    veterinarian: '',
    include_sample_normal: true,
  })
  const [medicalSuccess, setMedicalSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCsvText = useCallback((text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim())
    if (lines.length === 0) {
      setCsvWarning('CSV 内容为空')
      setCsvPreview([])
      return
    }
    setCsvWarning('')
    setCsvPreview(lines.slice(0, 6))
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      setCsvFileName(file.name)
      setImportSuccess(false)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = String(e.target?.result || '')
        parseCsvText(text)
      }
      reader.readAsText(file)
    },
    [parseCsvText],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
        handleFile(file)
      } else {
        setCsvWarning('请上传 CSV 文件')
      }
    },
    [handleFile],
  )

  const handleConfirmImport = async () => {
    if (csvPreview.length === 0) {
      setCsvWarning('请先选择 CSV 文件')
      return
    }
    try {
      const text = csvPreview.join('\n')
      await importCsv(text, csvFileName || 'imported.csv')
      setImportSuccess(true)
      setTimeout(() => setImportSuccess(false), 3000)
    } catch (err) {
      setCsvWarning((err as Error).message)
    }
  }

  const handleMedicalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!medicalForm.pet_name.trim() || !medicalForm.diagnosis.trim()) {
      return
    }
    try {
      await addMedicalRecord({
        pet_name: medicalForm.pet_name,
        visit_date: medicalForm.visit_date,
        diagnosis: medicalForm.diagnosis,
        treatment: medicalForm.treatment,
        veterinarian: medicalForm.veterinarian,
      })
      setMedicalSuccess(true)
      setMedicalForm({
        pet_name: '',
        visit_date: '2026-06-05',
        diagnosis: '',
        treatment: '',
        veterinarian: '',
        include_sample_normal: true,
      })
      setTimeout(() => setMedicalSuccess(false), 3000)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <Upload size={18} />
            </div>
            <div>
              <h3 className="card-title mb-0">导入训练课 CSV</h3>
              <p className="text-xs text-warm-500">从同一份 SQLite 数据源读入，别名未识别自动进入异常</p>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              csvPreview.length > 0
                ? 'border-brand-300 bg-brand-50/40'
                : 'border-warm-300 hover:border-brand-400 hover:bg-warm-50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <Upload size={28} className="mx-auto text-warm-400 mb-2" />
            <p className="text-sm text-warm-700 font-medium">
              点击或拖拽 CSV 文件到此处
            </p>
            <p className="text-xs text-warm-400 mt-1">
              需包含 pet_name, course_name, course_date, duration_min, trainer 列
            </p>
            {csvFileName && (
              <p className="text-xs text-brand-600 mt-2">已选择：{csvFileName}</p>
            )}
          </div>

          {csvWarning && (
            <p className="text-sm text-danger-600 mt-3 bg-danger-50 p-2 rounded-md">
              ⚠️ {csvWarning}
            </p>
          )}

          {importSuccess && (
            <p className="text-sm text-success-700 mt-3 bg-success-50 p-2 rounded-md flex items-center gap-2">
              <CheckCircle size={16} /> 导入成功，已写入 SQLite
            </p>
          )}

          {csvPreview.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-warm-700 mb-2">预览（前5行）</p>
              <div className="bg-warm-50 rounded-lg p-3 text-xs font-mono text-warm-600 overflow-x-auto">
                {csvPreview.map((line, i) => (
                  <div key={i} className="whitespace-pre">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary flex-1"
              onClick={handleConfirmImport}
              disabled={loading || csvPreview.length === 0}
            >
              确认导入
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                downloadCsv('训练课排程-样例.csv', SAMPLE_CSV)
              }}
            >
              <Download size={14} />
              下载样例
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-success-100 text-success-700 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="card-title mb-0">录入病历手写单</h3>
              <p className="text-xs text-warm-500">和排程共用同一份 SQLite，自动按宠物名和日期关联</p>
            </div>
          </div>

          <form onSubmit={handleMedicalSubmit} className="space-y-3">
            <div>
              <label className="text-sm text-warm-600 font-medium">宠物名 *</label>
              <input
                type="text"
                className="input mt-1"
                value={medicalForm.pet_name}
                onChange={(e) =>
                  setMedicalForm({ ...medicalForm, pet_name: e.target.value })
                }
                placeholder="比如：黑妞"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-warm-600 font-medium">就诊日期 *</label>
                <input
                  type="date"
                  className="input mt-1"
                  value={medicalForm.visit_date}
                  onChange={(e) =>
                    setMedicalForm({ ...medicalForm, visit_date: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm text-warm-600 font-medium">医生</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={medicalForm.veterinarian}
                  onChange={(e) =>
                    setMedicalForm({ ...medicalForm, veterinarian: e.target.value })
                  }
                  placeholder="陈医生"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-warm-600 font-medium">诊断 *</label>
              <input
                type="text"
                className="input mt-1"
                value={medicalForm.diagnosis}
                onChange={(e) =>
                  setMedicalForm({ ...medicalForm, diagnosis: e.target.value })
                }
                placeholder="比如：疫苗接种"
                required
              />
            </div>
            <div>
              <label className="text-sm text-warm-600 font-medium">处置</label>
              <textarea
                className="textarea mt-1"
                rows={2}
                value={medicalForm.treatment}
                onChange={(e) =>
                  setMedicalForm({ ...medicalForm, treatment: e.target.value })
                }
                placeholder="观察30分钟后离院..."
              />
            </div>

            <label className="flex items-start gap-2 p-3 bg-brand-50/60 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={medicalForm.include_sample_normal}
                onChange={(e) =>
                  setMedicalForm({
                    ...medicalForm,
                    include_sample_normal: e.target.checked,
                  })
                }
              />
              <div>
                <p className="text-sm font-medium text-brand-800">
                  附带一条正常训练课记录
                </p>
                <p className="text-xs text-brand-600 mt-0.5">
                  勾选后会同时生成一条同宠物的待确认排程，方便看待确认逻辑怎么走
                </p>
              </div>
            </label>

            {medicalSuccess && (
              <p className="text-sm text-success-700 bg-success-50 p-2 rounded-md flex items-center gap-2">
                <CheckCircle size={16} /> 已录入 SQLite，已自动关联到排程
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              确认录入
            </button>
          </form>
        </div>
      </div>

      <div className="w-80 flex-shrink-0">
        <OnboardingSidebar />
      </div>
    </div>
  )
}
