import { useCallback, useState } from "react"
import { useStore } from "@/store"
import { Upload, FileAudio, FileText, FileJson, Clock, File, Plus, Trash2, AlertCircle } from "lucide-react"
import ConflictModal from "@/components/ConflictModal"
import { formatFileSize, formatDateTime } from "@/utils/hash"
import type { MaterialFile, ConflictStrategy } from "@/types"

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  audio: <FileAudio size={16} className="text-amber-400" />,
  time: <Clock size={16} className="text-blue-400" />,
  notes: <FileText size={16} className="text-emerald-400" />,
  beats: <FileAudio size={16} className="text-purple-400" />,
  late_markers: <AlertCircle size={16} className="text-red-400" />,
  report: <FileJson size={16} className="text-cyan-400" />,
}

const FILE_TYPE_LABELS: Record<string, string> = {
  audio: "分轨音频",
  time: "排练时间",
  notes: "乐手备注",
  beats: "节拍点",
  late_markers: "迟到标记",
  report: "整理报告",
}

export default function ImportWorkbench() {
  const {
    currentSessionId,
    sessions,
    createSession,
    selectSession,
    materials,
    importFiles,
    deleteMaterial,
    isProcessing,
    conflictDialog,
    setConflictDialog,
  } = useStore()

  const [isDragging, setIsDragging] = useState(false)
  const [newSessionName, setNewSessionName] = useState("")
  const [showNewSession, setShowNewSession] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (!currentSessionId) return
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) importFiles(files)
    },
    [currentSessionId, importFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!currentSessionId || !e.target.files) return
      const files = Array.from(e.target.files)
      if (files.length > 0) importFiles(files)
      e.target.value = ""
    },
    [currentSessionId, importFiles]
  )

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return
    const id = await createSession(newSessionName.trim())
    setNewSessionName("")
    setShowNewSession(false)
    selectSession(id)
  }

  const handleConflictResolve = (strategy: ConflictStrategy) => {
    conflictDialog.onResolve?.(strategy)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {conflictDialog.open && (
        <ConflictModal
          fileName={conflictDialog.fileName}
          existingFile={conflictDialog.existingFile}
          onResolve={handleConflictResolve}
          onCancel={() => {
            conflictDialog.onResolve?.("skip")
            setConflictDialog({ open: false, fileName: "", existingFile: "", onResolve: null })
          }}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">导入工作台</h1>
        <p className="text-sm text-gray-500 mt-1">拖拽上传分轨音频、排练时间、乐手备注、节拍点、迟到标记或整理报告</p>
      </div>

      {!currentSessionId && (
        <div className="bg-[#12122A] border border-[#2A2A4A] rounded-xl p-8 text-center mb-6">
          <File size={40} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-base font-medium text-gray-300 mb-2">请先创建或选择排练场次</h3>
          <p className="text-sm text-gray-500 mb-4">所有材料将关联到当前选中的排练场次</p>

          {showNewSession ? (
            <div className="flex items-center gap-2 max-w-sm mx-auto">
              <input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                placeholder="输入场次名称，如：2024-12-15 排练"
                className="flex-1 bg-[#0F0F1A] border border-[#2A2A4A] rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
              <button
                onClick={handleCreateSession}
                className="px-4 py-2 bg-amber-500 text-black rounded-md text-sm font-medium hover:bg-amber-400 transition-colors"
              >
                创建
              </button>
              <button
                onClick={() => setShowNewSession(false)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewSession(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-md text-sm font-medium hover:bg-amber-400 transition-colors"
            >
              <Plus size={16} />
              创建新场次
            </button>
          )}

          {sessions.length > 0 && (
            <div className="mt-4">
              <span className="text-xs text-gray-500">或选择已有场次：</span>
              <div className="flex gap-2 mt-2 justify-center flex-wrap">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSession(s.id)}
                    className="px-3 py-1.5 bg-[#0F0F1A] border border-[#2A2A4A] rounded-md text-xs text-gray-300 hover:border-amber-500/50 transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentSessionId && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-all ${
              isDragging
                ? "border-amber-400 bg-amber-400/5"
                : "border-[#2A2A4A] bg-[#12122A] hover:border-[#3A3A5A]"
            }`}
          >
            {isProcessing && (
              <div className="absolute inset-0 bg-[#0F0F1A]/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-amber-400">正在处理音频...</span>
                </div>
              </div>
            )}

            <Upload
              size={32}
              className={`mx-auto mb-3 ${isDragging ? "text-amber-400" : "text-gray-500"}`}
            />
            <h3 className={`text-sm font-medium mb-1 ${isDragging ? "text-amber-400" : "text-gray-300"}`}>
              {isDragging ? "松开即可导入" : "拖拽文件到此处"}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              支持 WAV / MP3 / OGG 音频 · CSV 节拍点 · JSON 迟到标记 · TXT 备注
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F0F1A] border border-[#2A2A4A] rounded-md text-xs text-gray-300 hover:border-amber-500/50 cursor-pointer transition-colors">
              <Upload size={14} />
              选择文件
              <input
                type="file"
                multiple
                accept=".wav,.mp3,.ogg,.flac,.csv,.json,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <h2 className="text-sm font-bold text-gray-300 mb-3">
              已导入材料
              <span className="text-gray-600 font-normal ml-2">({materials.length})</span>
            </h2>

            {materials.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                暂无材料，请拖拽文件上传
              </div>
            ) : (
              <div className="bg-[#12122A] border border-[#2A2A4A] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2A2A4A]">
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">类型</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">文件名</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">大小</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">导入时间</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">状态</th>
                      <th className="text-right text-xs text-gray-500 font-medium px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m: MaterialFile) => (
                      <tr key={m.id} className="border-b border-[#2A2A4A]/50 hover:bg-[#1A1A35] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {FILE_TYPE_ICONS[m.fileType] || <File size={16} className="text-gray-500" />}
                            <span className="text-xs text-gray-400">{FILE_TYPE_LABELS[m.fileType] || m.fileType}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300 font-mono">{m.fileName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500 font-mono">{formatFileSize(m.fileSize)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">{formatDateTime(m.importedAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              m.status === "normal"
                                ? "bg-emerald-400/10 text-emerald-400"
                                : m.status === "anomaly"
                                ? "bg-red-400/10 text-red-400"
                                : "bg-amber-400/10 text-amber-400"
                            }`}
                          >
                            {m.status === "normal" ? "正常" : m.status === "anomaly" ? "异常" : "待审"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteMaterial(m.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
