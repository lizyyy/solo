import AuditTimeline from '@/components/AuditTimeline'

export default function Audit() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-2xl font-bold text-[#1a365d] mb-1"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          审核追踪
        </h2>
        <p className="text-sm text-slate-400">
          谁改了什么 · 为什么改 · 改完影响哪些结果
        </p>
      </div>
      <AuditTimeline />
    </div>
  )
}
