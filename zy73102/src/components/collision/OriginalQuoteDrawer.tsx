import { X, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSceneStore } from '@/store/useSceneStore'

export interface MeetingParagraph {
  id: string
  index: number
  content: string
  isHit: boolean
  hitFields: string[]
}

export interface MeetingMinutes {
  id: string
  title: string
  code: string
  date: string
  paragraphs: MeetingParagraph[]
}

interface OriginalQuoteDrawerProps {
  open: boolean
  onClose: () => void
  meeting: MeetingMinutes | null
  hitParagraphIds?: string[]
  className?: string
}

export default function OriginalQuoteDrawer({
  open,
  onClose,
  meeting,
  hitParagraphIds = [],
  className,
}: OriginalQuoteDrawerProps) {
  const { focusOnMaterial } = useSceneStore()

  const handleLocateIn3D = () => {
    if (meeting && hitParagraphIds.length > 0) {
      const firstHit = meeting.paragraphs.find((p) => p.id === hitParagraphIds[0])
      if (firstHit && firstHit.hitFields.length > 0) {
        focusOnMaterial(
          `${meeting.id}-${firstHit.id}`,
          `材料定位: ${meeting.title} 第${firstHit.index}条`,
        )
      }
    }
  }

  if (!meeting) {
    return null
  }

  const allHitIds = hitParagraphIds.length > 0
    ? hitParagraphIds
    : meeting.paragraphs.filter((p) => p.isHit).map((p) => p.id)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full shadow-2xl transition-transform duration-300 ease-out',
          className,
        )}
        style={{
          width: '380px',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-l-2xl border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                    {meeting.code}
                  </span>
                  <span className="text-xs text-slate-500">{meeting.date}</span>
                </div>
                <h3 className="text-base font-bold text-slate-800 leading-snug">
                  {meeting.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/50 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                会议纪要全文（命中 <b className="text-amber-600">{allHitIds.length}</b> 条）
              </span>
            </div>

            <div className="space-y-3">
              {meeting.paragraphs.map((paragraph) => {
                const isHit = allHitIds.includes(paragraph.id)
                return (
                  <div
                    key={paragraph.id}
                    className={cn(
                      'relative rounded-xl border p-4 transition-all',
                      isHit
                        ? 'border-amber-300 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white',
                    )}
                  >
                    {isHit && (
                      <div className="absolute right-2 top-2 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                          <MapPin className="h-3 w-3" />
                          第{paragraph.index}条
                        </span>
                      </div>
                    )}

                    <p
                      className={cn(
                        'text-sm leading-relaxed',
                        isHit ? 'font-medium text-slate-800' : 'text-slate-600',
                      )}
                    >
                      {paragraph.content}
                    </p>

                    {isHit && paragraph.hitFields.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-xs text-slate-500">命中字段:</span>
                        {paragraph.hitFields.map((field) => (
                          <span
                            key={field}
                            className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-indigo-700 shadow-sm"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4">
            <button
              type="button"
              onClick={handleLocateIn3D}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg active:scale-[0.98]"
            >
              <MapPin className="h-4 w-4" />
              在3D中定位材料
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
