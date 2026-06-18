import { Search, Calendar, User } from 'lucide-react'

interface HistoryFilterProps {
  recordId: string
  changedBy: string
  dateFrom: string
  dateTo: string
  onRecordIdChange: (v: string) => void
  onChangedByChange: (v: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
}

export default function HistoryFilter({
  recordId,
  changedBy,
  dateFrom,
  dateTo,
  onRecordIdChange,
  onChangedByChange,
  onDateFromChange,
  onDateToChange,
}: HistoryFilterProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 bg-ocean-800 rounded-lg px-3 py-2 border border-ocean-700">
        <Search className="w-4 h-4 text-foam/40" />
        <input
          type="text"
          placeholder="记录 ID"
          value={recordId}
          onChange={(e) => onRecordIdChange(e.target.value)}
          className="bg-transparent text-foam font-mono text-sm outline-none placeholder:text-foam/30 w-28"
        />
      </div>

      <div className="flex items-center gap-2 bg-ocean-800 rounded-lg px-3 py-2 border border-ocean-700">
        <User className="w-4 h-4 text-foam/40" />
        <input
          type="text"
          placeholder="操作人"
          value={changedBy}
          onChange={(e) => onChangedByChange(e.target.value)}
          className="bg-transparent text-foam font-sans text-sm outline-none placeholder:text-foam/30 w-24"
        />
      </div>

      <div className="flex items-center gap-2 bg-ocean-800 rounded-lg px-3 py-2 border border-ocean-700">
        <Calendar className="w-4 h-4 text-foam/40" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="bg-transparent text-foam font-mono text-sm outline-none placeholder:text-foam/30 [color-scheme:dark]"
        />
        <span className="text-foam/30 text-xs">至</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="bg-transparent text-foam font-mono text-sm outline-none placeholder:text-foam/30 [color-scheme:dark]"
        />
      </div>
    </div>
  )
}
