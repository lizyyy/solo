import { create } from "zustand"
import type {
  RehearsalSession,
  TrackAudio,
  RehearsalMeta,
  AnomalyFragment,
  AlignmentVersion,
  ExportRecord,
  MaterialFile,
  ConflictStrategy,
} from "@/types"
import * as db from "@/utils/db"
import { generateId, computeFileHash } from "@/utils/hash"
import { decodeAudioFile, runAllDetections, detectOnsetOffset } from "@/utils/audio-engine"

interface AppState {
  currentSessionId: string | null
  sessions: RehearsalSession[]
  tracks: TrackAudio[]
  meta: RehearsalMeta | null
  anomalies: AnomalyFragment[]
  versions: AlignmentVersion[]
  exports: ExportRecord[]
  materials: MaterialFile[]
  isProcessing: boolean
  conflictDialog: {
    open: boolean
    fileName: string
    existingFile: string
    onResolve: ((strategy: ConflictStrategy) => void) | null
  }

  loadSessions: () => Promise<void>
  createSession: (name: string) => Promise<string>
  selectSession: (id: string) => Promise<void>
  importFiles: (files: File[]) => Promise<void>
  importSingleFile: (file: File, strategy: ConflictStrategy) => Promise<void>
  runDetection: () => Promise<void>
  updateAnomaly: (id: string, updates: Partial<AnomalyFragment>) => Promise<void>
  saveVersion: (summary: string) => Promise<void>
  exportVersion: (versionId: string, format: "pdf" | "json", strategy: ConflictStrategy) => Promise<string | null>
  deleteMaterial: (id: string) => Promise<void>
  setConflictDialog: (dialog: AppState["conflictDialog"]) => void
}

export const useStore = create<AppState>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  tracks: [],
  meta: null,
  anomalies: [],
  versions: [],
  exports: [],
  materials: [],
  isProcessing: false,
  conflictDialog: {
    open: false,
    fileName: "",
    existingFile: "",
    onResolve: null,
  },

  loadSessions: async () => {
    const sessions = await db.getAllSessions()
    set({ sessions })
  },

  createSession: async (name: string) => {
    const id = generateId()
    const session: RehearsalSession = {
      id,
      name,
      createdAt: new Date().toISOString(),
      trackIds: [],
    }
    await db.putSession(session)
    set((state) => ({ sessions: [...state.sessions, session] }))
    return id
  },

  selectSession: async (id: string) => {
    set({ isProcessing: true })
    const session = await db.getSession(id)
    if (!session) { set({ isProcessing: false }); return }

    const tracks = await db.getTracksBySession(id)
    const meta = await db.getMeta(id)
    const anomalies = await db.getAnomaliesBySession(id)
    const versions = await db.getVersionsBySession(id)
    const materials = await db.getMaterialsBySession(id)

    const allExports: ExportRecord[] = []
    for (const v of versions) {
      const exps = await db.getExportsByVersion(v.id)
      allExports.push(...exps)
    }

    set({
      currentSessionId: id,
      tracks,
      meta,
      anomalies,
      versions,
      exports: allExports,
      materials,
      isProcessing: false,
    })
  },

  importFiles: async (files: File[]) => {
    const { currentSessionId } = get()
    if (!currentSessionId) return

    for (const file of files) {
      const fileHash = await computeFileHash(file)
      const existing = await db.getMaterialByHash(fileHash)
      if (existing) {
        return new Promise<void>((resolve) => {
          set({
            conflictDialog: {
              open: true,
              fileName: file.name,
              existingFile: existing.fileName,
              onResolve: async (strategy: ConflictStrategy) => {
                set({ conflictDialog: { open: false, fileName: "", existingFile: "", onResolve: null } })
                if (strategy === "skip") { resolve(); return }
                await get().importSingleFile(file, strategy)
                resolve()
              },
            },
          })
        })
      } else {
        await get().importSingleFile(file, "append")
      }
    }
  },

  importSingleFile: async (file: File, strategy: ConflictStrategy) => {
    const { currentSessionId } = get()
    if (!currentSessionId) return

    set({ isProcessing: true })
    const fileHash = await computeFileHash(file)
    const ext = file.name.split(".").pop()?.toLowerCase()

    if (ext === "wav" || ext === "mp3" || ext === "ogg" || ext === "flac") {
      const existing = await db.getTrackByHash(fileHash)
      if (existing && strategy === "skip") {
        set({ isProcessing: false })
        return
      }

      try {
        const { audioBuffer, waveformPeaks } = await decodeAudioFile(file)
        const channelType = guessChannelType(file.name)
        const onsetOffset = detectOnsetOffset(waveformPeaks)

        const track: TrackAudio = {
          id: generateId(),
          sessionId: currentSessionId,
          fileName: file.name,
          fileHash,
          channelType,
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration,
          waveformPeaks,
          startOffset: onsetOffset,
          rawAudioData: null,
        }

        if (existing && strategy === "overwrite") {
          track.id = existing.id
        }

        await db.putTrack(track)

        const material: MaterialFile = {
          id: generateId(),
          sessionId: currentSessionId,
          fileName: file.name,
          fileType: "audio",
          fileSize: file.size,
          fileHash,
          importedAt: new Date().toISOString(),
          status: "normal",
          parsed: true,
        }
        await db.putMaterial(material)

        set((state) => {
          const tracks = existing && strategy === "overwrite"
            ? state.tracks.map((t) => t.id === existing.id ? track : t)
            : [...state.tracks, track]
          const materials = existing && strategy === "overwrite"
            ? state.materials.map((m) => m.fileHash === fileHash ? material : m)
            : [...state.materials, material]
          return { tracks, materials }
        })
      } catch (e) {
        console.error("Failed to decode audio:", e)
        const material: MaterialFile = {
          id: generateId(),
          sessionId: currentSessionId,
          fileName: file.name,
          fileType: "audio",
          fileSize: file.size,
          fileHash,
          importedAt: new Date().toISOString(),
          status: "anomaly",
          parsed: false,
        }
        await db.putMaterial(material)
        set((state) => ({ materials: [...state.materials, material] }))
      }
    } else if (ext === "csv") {
      const text = await file.text()
      const beatPoints = parseCSV(text)
      const existingMeta = await db.getMeta(currentSessionId)
      const meta: RehearsalMeta = existingMeta || {
        id: generateId(),
        sessionId: currentSessionId,
        rehearsalTime: "",
        musicianNotes: "",
        beatPoints: [],
        lateMarkers: [],
      }
      meta.beatPoints = strategy === "append" ? [...meta.beatPoints, ...beatPoints] : beatPoints
      await db.putMeta(meta)

      const material: MaterialFile = {
        id: generateId(),
        sessionId: currentSessionId,
        fileName: file.name,
        fileType: "beats",
        fileSize: file.size,
        fileHash,
        importedAt: new Date().toISOString(),
        status: "normal",
        parsed: true,
      }
      await db.putMaterial(material)
      set((state) => ({ meta, materials: [...state.materials, material] }))
    } else if (ext === "json") {
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        const existingMeta = await db.getMeta(currentSessionId)
        const meta: RehearsalMeta = existingMeta || {
          id: generateId(),
          sessionId: currentSessionId,
          rehearsalTime: "",
          musicianNotes: "",
          beatPoints: [],
          lateMarkers: [],
        }
        if (Array.isArray(data.lateMarkers)) {
          meta.lateMarkers = strategy === "append" ? [...meta.lateMarkers, ...data.lateMarkers] : data.lateMarkers
        }
        if (data.rehearsalTime) meta.rehearsalTime = data.rehearsalTime
        if (data.musicianNotes) meta.musicianNotes = data.musicianNotes
        await db.putMeta(meta)

        const material: MaterialFile = {
          id: generateId(),
          sessionId: currentSessionId,
          fileName: file.name,
          fileType: data.lateMarkers ? "late_markers" : "report",
          fileSize: file.size,
          fileHash,
          importedAt: new Date().toISOString(),
          status: "normal",
          parsed: true,
        }
        await db.putMaterial(material)
        set((state) => ({ meta, materials: [...state.materials, material] }))
      } catch {
        console.error("Failed to parse JSON file")
      }
    } else if (ext === "txt") {
      const text = await file.text()
      const existingMeta = await db.getMeta(currentSessionId)
      const meta: RehearsalMeta = existingMeta || {
        id: generateId(),
        sessionId: currentSessionId,
        rehearsalTime: "",
        musicianNotes: "",
        beatPoints: [],
        lateMarkers: [],
      }
      meta.musicianNotes = strategy === "append"
        ? meta.musicianNotes + "\n---\n" + text
        : text
      await db.putMeta(meta)

      const material: MaterialFile = {
        id: generateId(),
        sessionId: currentSessionId,
        fileName: file.name,
        fileType: "notes",
        fileSize: file.size,
        fileHash,
        importedAt: new Date().toISOString(),
        status: "normal",
        parsed: true,
      }
      await db.putMaterial(material)
      set((state) => ({ meta, materials: [...state.materials, material] }))
    }

    set({ isProcessing: false })
  },

  runDetection: async () => {
    const { tracks, currentSessionId } = get()
    if (!currentSessionId || tracks.length === 0) return

    set({ isProcessing: true })
    const anomalies = runAllDetections(tracks, currentSessionId)
    await db.putAnomalies(anomalies)
    set({ anomalies, isProcessing: false })
  },

  updateAnomaly: async (id: string, updates: Partial<AnomalyFragment>) => {
    const { anomalies } = get()
    const idx = anomalies.findIndex((a) => a.id === id)
    if (idx === -1) return
    const updated = { ...anomalies[idx], ...updates }
    await db.putAnomaly(updated)
    set((state) => ({
      anomalies: state.anomalies.map((a) => a.id === id ? updated : a),
    }))
  },

  saveVersion: async (summary: string) => {
    const { tracks, anomalies, currentSessionId, versions } = get()
    if (!currentSessionId) return

    const trackStates = tracks.map((t) => {
      const relatedAnomalies = anomalies.filter((a) => a.trackId === t.id && a.type === "beat_drift")
      return {
        trackId: t.id,
        offsetMs: Math.round(t.startOffset * 1000),
        bpm: 120,
        driftSegments: relatedAnomalies.map((a) => ({
          startTime: a.startTime,
          endTime: a.endTime,
          bpmDelta: parseFloat(a.note.match(/([+-]?\d+\.?\d*)\s*BPM/)?.[1] || "0"),
        })),
      }
    })

    const version: AlignmentVersion = {
      id: generateId(),
      sessionId: currentSessionId,
      createdAt: new Date().toISOString(),
      summary,
      trackStates,
      anomalies: [...anomalies],
      parentVersionId: versions.length > 0 ? versions[versions.length - 1].id : null,
    }

    await db.putVersion(version)
    set((state) => ({ versions: [...state.versions, version] }))
  },

  exportVersion: async (versionId: string, format: "pdf" | "json", strategy: ConflictStrategy): Promise<string | null> => {
    const { versions, tracks, exports } = get()
    const version = versions.find((v) => v.id === versionId)
    if (!version) return null

    const existingExports = exports.filter(
      (e) => e.versionId === versionId && e.format === format
    )

    if (existingExports.length > 0 && strategy === "skip") {
      return "skip"
    }

    const trackInfos = version.anomalies
      .map((a) => tracks.find((t) => t.id === a.trackId))
      .filter(Boolean) as { id: string; fileName: string; channelType: string }[]

    const uniqueTrackInfos = [...new Map(trackInfos.map((t) => [t.id, t])).values()]

    let content = ""
    if (format === "json") {
      content = exportAsJSON(version, uniqueTrackInfos)
    }

    const record: ExportRecord = {
      id: generateId(),
      versionId,
      sessionId: version.sessionId,
      format,
      exportedAt: new Date().toISOString(),
      fileHash: content ? computeExportHash(content) : generateId(),
      contentSummary: `v${versionId.slice(0, 6)} ${format.toUpperCase()}`,
    }

    if (existingExports.length > 0 && strategy === "overwrite") {
      record.id = existingExports[0].id
    }

    await db.putExport(record)
    set((state) => ({
      exports: strategy === "overwrite"
        ? state.exports.map((e) => e.id === existingExports[0]?.id ? record : e)
        : [...state.exports, record],
    }))

    return content || "pdf"
  },

  deleteMaterial: async (id: string) => {
    await db.deleteMaterial(id)
    set((state) => ({ materials: state.materials.filter((m) => m.id !== id) }))
  },

  setConflictDialog: (dialog) => set({ conflictDialog: dialog }),
}))

function guessChannelType(fileName: string): "drums" | "bass" | "vocals" | "other" {
  const lower = fileName.toLowerCase()
  if (lower.includes("drum") || lower.includes("鼓")) return "drums"
  if (lower.includes("bass") || lower.includes("贝斯") || lower.includes("貝斯")) return "bass"
  if (lower.includes("vocal") || lower.includes("人声") || lower.includes("vox")) return "vocals"
  return "other"
}

function parseCSV(text: string): { time: number; bpm: number; confidence: number }[] {
  const lines = text.trim().split("\n")
  const points: { time: number; bpm: number; confidence: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim())
    if (cols.length >= 2) {
      points.push({
        time: parseFloat(cols[0]) || 0,
        bpm: parseFloat(cols[1]) || 120,
        confidence: cols[2] ? parseFloat(cols[2]) : 1,
      })
    }
  }
  return points
}

function exportAsJSON(version: AlignmentVersion, tracks: { id: string; fileName: string; channelType: string }[]): string {
  const CHANNEL_TYPE_LABELS: Record<string, string> = { drums: "鼓", bass: "贝斯", vocals: "人声", other: "其他" }
  const ANOMALY_TYPE_LABELS: Record<string, string> = { offset_error: "起点偏移", beat_drift: "节拍漂移", duplicate_clip: "重复剪辑", late_join: "迟到加入" }

  const report = {
    versionId: version.id,
    createdAt: version.createdAt,
    summary: version.summary,
    tracks: version.trackStates.map((ts) => {
      const trackInfo = tracks.find((t) => t.id === ts.trackId)
      return {
        fileName: trackInfo?.fileName || "unknown",
        channelType: CHANNEL_TYPE_LABELS[trackInfo?.channelType || "other"],
        offsetMs: ts.offsetMs,
        bpm: ts.bpm,
        driftSegments: ts.driftSegments.map((d) => ({
          timeRange: `${d.startTime.toFixed(2)}s - ${d.endTime.toFixed(2)}s`,
          bpmDelta: d.bpmDelta,
        })),
      }
    }),
    anomalies: version.anomalies.map((a) => ({
      type: ANOMALY_TYPE_LABELS[a.type],
      timeRange: `${a.startTime.toFixed(2)}s - ${a.endTime.toFixed(2)}s`,
      severity: a.severity === "error" ? "严重" : "警告",
      note: a.note,
      resolved: a.resolved ? "已处理" : "待处理",
    })),
  }
  return JSON.stringify(report, null, 2)
}

function computeExportHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36) + generateId()
}
