import { Upload } from "lucide-react"
import { useDataStore } from "@/store/useDataStore"

export default function DataImport() {
  const { isLoaded, records, loadData } = useDataStore()

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
            <Upload className="h-5 w-5 text-zinc-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">数据导入</h2>
            {isLoaded ? (
              <p className="text-sm text-zinc-500">
                已加载 <span className="font-medium text-zinc-700">{records.length}</span> 条实验记录
              </p>
            ) : (
              <p className="text-sm text-zinc-400">尚未加载数据</p>
            )}
          </div>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
        >
          <Upload className="h-4 w-4" />
          加载实验数据
        </button>
      </div>
    </div>
  )
}
