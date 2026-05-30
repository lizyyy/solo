import { useState, useRef } from "react"
import { GitCompare, Shield, BookOpen, Upload, Download } from "lucide-react"
import { useStore } from "@/store/useStore"
import { RULE_VERSIONS } from "@/data/mockData"
import type { RuleVersion, StatusDefinition } from "@/types"

const DOT_MAP: Record<StatusDefinition["status"], string> = {
  processed: "bg-emerald-400",
  pending: "bg-amber-400",
  returned: "bg-red-400",
}

function formatWan(v: number) {
  return (v / 10000).toFixed(1) + " 万元"
}

function DiffRow({ label, curr, hist }: { label: string; curr: string; hist: string }) {
  const diff = curr !== hist
  return (
    <tr>
      <td className="px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800/40">{label}</td>
      <td className={`px-3 py-2 text-xs border-b border-zinc-800/40 ${diff ? "bg-sky-500/10" : ""}`}>{curr}</td>
      <td className={`px-3 py-2 text-xs border-b border-zinc-800/40 ${diff ? "bg-sky-500/10" : ""}`}>{hist}</td>
    </tr>
  )
}

function VersionCompare({ current, versions }: { current: RuleVersion; versions: RuleVersion[] }) {
  const [sel, setSel] = useState(versions.find((v) => v.version !== current.version)?.version ?? versions[0].version)
  const historical = versions.find((v) => v.version === sel) ?? versions[0]
  const allBanks = Array.from(new Set([...Object.keys(current.regLimitConfig), ...Object.keys(historical.regLimitConfig)]))

  return (
    <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-medium text-zinc-200">规则版本对照</span>
        </div>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-sky-500/50"
        >
          {versions.filter((v) => v.version !== current.version).map((v) => (
            <option key={v.version} value={v.version}>{v.version} ({v.effectiveDate})</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800/40">
              <th className="px-3 py-2 text-left font-medium">字段</th>
              <th className="px-3 py-2 text-left font-medium">当前版本 ({current.version})</th>
              <th className="px-3 py-2 text-left font-medium">历史版本 ({historical.version})</th>
            </tr>
          </thead>
          <tbody>
            <DiffRow label="生效日期" curr={current.effectiveDate} hist={historical.effectiveDate} />
            <DiffRow label="版本描述" curr={current.description} hist={historical.description} />
            <DiffRow label="留底比例" curr={(current.reserveRatio * 100).toFixed(0) + "%"} hist={(historical.reserveRatio * 100).toFixed(0) + "%"} />
            {allBanks.map((bank) => (
              <DiffRow
                key={bank}
                label={`${bank}限额`}
                curr={formatWan(current.regLimitConfig[bank] ?? 0)}
                hist={formatWan(historical.regLimitConfig[bank] ?? 0)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LimitConfig({ rule }: { rule: RuleVersion }) {
  const banks = Object.entries(rule.regLimitConfig)
  return (
    <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800/60">
        <Shield className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-zinc-200">限额校验配置</span>
      </div>
      <div className="px-5 py-4 space-y-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">留底比例</span>
          <span className="text-sm font-mono text-sky-400">{(rule.reserveRatio * 100).toFixed(0)}%</span>
        </div>
        <div className="h-px bg-zinc-800/60" />
        <div className="space-y-2.5">
          {banks.map(([bank, limit]) => (
            <div key={bank} className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{bank}</span>
              <span className="text-xs font-mono text-zinc-200">{formatWan(limit)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusDefinitions({ defs }: { defs: StatusDefinition[] }) {
  return (
    <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800/60">
        <BookOpen className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-zinc-200">归集状态口径定义</span>
      </div>
      <div className="px-5 py-4 space-y-4 flex-1">
        {defs.map((d) => (
          <div key={d.status} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${DOT_MAP[d.status]}`} />
              <span className={`text-xs font-medium ${d.color}`}>{d.label}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{d.status}</span>
            </div>
            <p className="text-xs text-zinc-400 pl-4">{d.condition}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImportExport({ currentVersion }: { currentVersion: string }) {
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importAccounts = useStore((s) => s.importAccounts)
  const exportAccounts = useStore((s) => s.exportAccounts)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        const version = data.ruleVersion ?? data._exportRuleVersion ?? ""
        if (!version) { showToast(false, "导入文件缺少规则版本信息"); return }
        const result = importAccounts(Array.isArray(data) ? data : data.accounts ?? [], version)
        showToast(result.success, result.message)
      } catch {
        showToast(false, "文件解析失败，请确认JSON格式正确")
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleExport = () => {
    const json = exportAccounts()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cash-mgmt-export-${currentVersion}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800/60">
        <Upload className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-zinc-200">导入导出</span>
      </div>
      <div className="px-5 py-4 space-y-4 flex-1">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-zinc-700/60 rounded-lg py-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-sky-500/40 transition-colors"
        >
          <Upload className="w-5 h-5 text-zinc-500" />
          <span className="text-xs text-zinc-500">点击或拖拽文件至此处导入</span>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        </div>
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-medium py-2.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出当前数据
        </button>
        <div className="text-[10px] text-zinc-600 text-center">
          当前规则版本 <span className="text-sky-400 font-mono">{currentVersion}</span>
        </div>
        {toast && (
          <div className={`text-xs px-3 py-2 rounded-lg ${toast.ok ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Rules() {
  const currentRuleVersion = useStore((s) => s.currentRuleVersion)
  const current = RULE_VERSIONS.find((v) => v.version === currentRuleVersion) ?? RULE_VERSIONS[0]

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="grid grid-cols-2 gap-5 h-full">
        <VersionCompare current={current} versions={RULE_VERSIONS} />
        <LimitConfig rule={current} />
        <StatusDefinitions defs={current.statusDefinitions} />
        <ImportExport currentVersion={currentRuleVersion} />
      </div>
    </div>
  )
}
