import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, FileSpreadsheet, Plus, Check, ArrowRight, FlaskConical } from "lucide-react"
import { PhotoRecord, SourceType, AuthStatus, FIELD_OPTIONS, FIELD_LABELS, FieldMapping } from "@/lib/types"
import { parseCSV, parseExcel, autoMapFields, applyMapping, ParsedData } from "@/lib/fileUtils"
import { useStore } from "@/store/index"

export default function Import() {
  const { projects, currentProject, setCurrentProject, createProject, loadProjects, addPhotoRecords } = useStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const [isNewProject, setIsNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newSpecVersion, setNewSpecVersion] = useState("")

  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [fileName, setFileName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) return

    setFileName(file.name)

    try {
      let data: ParsedData
      if (ext === "csv") {
        const text = await file.text()
        data = parseCSV(text)
      } else {
        const buffer = await file.arrayBuffer()
        data = parseExcel(buffer)
      }
      setParsedData(data)
      setMappings(autoMapFields(data.headers))
    } catch {
      setParsedData(null)
      setMappings([])
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleMappingChange = useCallback((index: number, target: string) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, target } : m)))
  }, [])

  const activeProject = isNewProject
    ? projects.find((p) => p.name === newProjectName) ?? null
    : currentProject

  const canImport = (isNewProject ? newProjectName.trim() !== "" : activeProject !== null) && parsedData !== null

  const mappedRows = parsedData ? applyMapping(parsedData.rows, mappings) : []
  const previewRows = mappedRows.slice(0, 5)

  const handleImport = async () => {
    if (!canImport || !parsedData) return

    setImporting(true)
    try {
      let project = isNewProject ? null : activeProject

      if (isNewProject && newProjectName.trim()) {
        project = await createProject(newProjectName.trim(), newSpecVersion.trim() || "1.0")
      }

      if (!project) return

      const records: PhotoRecord[] = mappedRows.map((row) => ({
        id: crypto.randomUUID(),
        projectId: project!.id,
        fileName: row.fileName || "",
        shootDate: row.shootDate || "",
        sourceType: (["版式稿", "色卡", "其他"].includes(row.sourceType) ? row.sourceType : "其他") as SourceType,
        authorizationStatus: (["有效", "过期", "未知"].includes(row.authorizationStatus)
          ? row.authorizationStatus
          : "未知") as AuthStatus,
        authorizationExpiry: row.authorizationExpiry || null,
        authorizationContact: row.authorizationContact || null,
        markStatus: "待判断" as const,
        markReason: "",
        nextStep: "",
        reviewOpinion: row.reviewOpinion || "",
        specVersion: row.specVersion || project!.specVersion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))

      await addPhotoRecords(records, project.specVersion)
      await loadProjects()
      setCurrentProject(project)

      setParsedData(null)
      setMappings([])
      setFileName("")
      setNewProjectName("")
      setNewSpecVersion("")
      setIsNewProject(false)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#1e1e38] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#eaeaea] mb-4">项目选择</h2>

        {!isNewProject ? (
          <div className="flex items-center gap-4">
            <select
              value={currentProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((proj) => proj.id === e.target.value)
                setCurrentProject(p ?? null)
              }}
              className="flex-1 bg-[#2a2a4a] text-[#eaeaea] rounded-lg px-4 py-2.5 border border-[#3a3a5a] focus:outline-none focus:border-[#e94560]"
            >
              <option value="">-- 选择项目 --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.specVersion})
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsNewProject(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#e94560] text-white rounded-lg hover:bg-[#d63850] transition-colors"
            >
              <Plus size={16} />
              新建项目
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="项目名称"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 bg-[#2a2a4a] text-[#eaeaea] rounded-lg px-4 py-2.5 border border-[#3a3a5a] focus:outline-none focus:border-[#e94560]"
              />
              <input
                type="text"
                placeholder="规格版本 (如 1.0)"
                value={newSpecVersion}
                onChange={(e) => setNewSpecVersion(e.target.value)}
                className="w-48 bg-[#2a2a4a] text-[#eaeaea] rounded-lg px-4 py-2.5 border border-[#3a3a5a] focus:outline-none focus:border-[#e94560]"
              />
            </div>
            <button
              onClick={() => setIsNewProject(false)}
              className="text-sm text-[#e94560] hover:underline"
            >
              取消新建，选择已有项目
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#1e1e38] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#eaeaea] mb-4">文件上传</h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed border-[#e94560] rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging ? "bg-[#e94560]/10" : "bg-transparent"
          }`}
        >
          <Upload size={40} className="text-[#e94560] mb-3" />
          <p className="text-[#eaeaea] mb-1">拖拽文件到此处或点击上传</p>
          <p className="text-sm text-[#888]">.csv, .xlsx, .xls</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {fileName && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[#eaeaea]">
            <FileSpreadsheet size={16} className="text-[#e94560]" />
            {fileName}
          </div>
        )}
      </div>

      {parsedData && (
        <div className="bg-[#1e1e38] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[#eaeaea] mb-4">字段映射</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3a3a5a]">
                  <th className="text-left py-2 px-3 text-[#888] font-normal">源字段</th>
                  <th className="w-8"></th>
                  <th className="text-left py-2 px-3 text-[#888] font-normal">目标字段</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, index) => (
                  <tr
                    key={mapping.source}
                    className={`border-b border-[#2a2a4a] ${mapping.target ? "bg-[#e94560]/5" : ""}`}
                  >
                    <td className="py-2.5 px-3 text-[#eaeaea]">{mapping.source}</td>
                    <td className="text-center text-[#e94560]">
                      <ArrowRight size={14} />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={mapping.target}
                        onChange={(e) => handleMappingChange(index, e.target.value)}
                        className="w-full bg-[#2a2a4a] text-[#eaeaea] rounded-lg px-3 py-1.5 border border-[#3a3a5a] focus:outline-none focus:border-[#e94560]"
                      >
                        <option value="">-- 不映射 --</option>
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {FIELD_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="bg-[#1e1e38] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[#eaeaea] mb-4">数据预览（前 5 行）</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3a3a5a]">
                  {FIELD_OPTIONS.filter((opt) =>
                    previewRows.some((row) => row[opt] !== undefined && row[opt] !== "")
                  ).map((opt) => (
                    <th key={opt} className="text-left py-2 px-3 text-[#888] font-normal whitespace-nowrap">
                      {FIELD_LABELS[opt]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-[#2a2a4a]">
                    {FIELD_OPTIONS.filter((opt) =>
                      previewRows.some((r) => r[opt] !== undefined && r[opt] !== "")
                    ).map((opt) => (
                      <td key={opt} className="py-2 px-3 text-[#eaeaea] whitespace-nowrap">
                        {row[opt] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={async () => {
            const project = await createProject("春季品牌拍摄", "v2")
            const records: PhotoRecord[] = [
              { id: crypto.randomUUID(), projectId: project.id, fileName: "IMG_001.jpg", shootDate: "2024-03-15", sourceType: "版式稿", authorizationStatus: "有效", authorizationExpiry: "2025-12-31", authorizationContact: "张经理", markStatus: "待判断", markReason: "", nextStep: "", reviewOpinion: "构图良好可用", specVersion: "v2", createdAt: Date.now(), updatedAt: Date.now() },
              { id: crypto.randomUUID(), projectId: project.id, fileName: "IMG_002.jpg", shootDate: "2024-03-15", sourceType: "色卡", authorizationStatus: "过期", authorizationExpiry: "2024-06-30", authorizationContact: "李总监", markStatus: "待判断", markReason: "", nextStep: "", reviewOpinion: "", specVersion: "v2", createdAt: Date.now(), updatedAt: Date.now() },
              { id: crypto.randomUUID(), projectId: project.id, fileName: "IMG_003.jpg", shootDate: "2024-04-01", sourceType: "版式稿", authorizationStatus: "有效", authorizationExpiry: "2025-12-31", authorizationContact: "张经理", markStatus: "待判断", markReason: "", nextStep: "", reviewOpinion: "色彩需调整", specVersion: "v1", createdAt: Date.now(), updatedAt: Date.now() },
              { id: crypto.randomUUID(), projectId: project.id, fileName: "IMG_004.jpg", shootDate: "2024-04-10", sourceType: "色卡", authorizationStatus: "未知", authorizationExpiry: null, authorizationContact: null, markStatus: "待判断", markReason: "", nextStep: "", reviewOpinion: "", specVersion: "v2", createdAt: Date.now(), updatedAt: Date.now() },
              { id: crypto.randomUUID(), projectId: project.id, fileName: "IMG_005.jpg", shootDate: "2024-04-15", sourceType: "版式稿", authorizationStatus: "过期", authorizationExpiry: "2024-09-30", authorizationContact: "王设计师", markStatus: "待判断", markReason: "", nextStep: "", reviewOpinion: "构图满意可出图", specVersion: "v2", createdAt: Date.now(), updatedAt: Date.now() },
            ]
            await addPhotoRecords(records, project.specVersion)
            setCurrentProject(project)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-surface-light text-text-secondary rounded-lg hover:bg-[#3a3a5a] hover:text-text-primary transition-colors text-sm"
        >
          <FlaskConical size={14} />
          加载示例数据
        </button>
        <button
          onClick={handleImport}
          disabled={!canImport || importing}
          className="flex items-center gap-2 px-6 py-3 bg-[#e94560] text-white rounded-xl font-semibold hover:bg-[#d63850] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? (
            <span className="animate-pulse">导入中...</span>
          ) : (
            <>
              <Check size={18} />
              确认导入
            </>
          )}
        </button>
      </div>
    </div>
  )
}
