import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Tag, ClipboardCheck, Palette, Users, Calculator, Eye, CheckCircle, BookOpen, Lightbulb, Sparkles
} from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'
import { CLUE_TYPE_LABELS, CLUE_TYPE_COLORS, DOC_TYPE_LABELS, type ClueType, type LotDocument } from '@/types'

const iconMap: Record<string, typeof FileText> = {
  Tag,
  FileText,
  ClipboardCheck,
  Palette,
  Users,
  Calculator,
}

const dimensionTabs: { key: ClueType | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'provenance_gap', label: '来源缺口' },
  { key: 'condition_deduction', label: '品相扣分' },
  { key: 'school_mislabel', label: '流派误标' },
  { key: 'buyer_misjudge', label: '买家误判' },
  { key: 'price_anchor', label: '估价锚定' },
]

function getIconForDoc(doc: LotDocument) {
  return iconMap[doc.icon] || FileText
}

export default function Desk() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { markDocumentRead, collectClue, removeClue, getLotProgress, activeProfileId } = useGameStore()

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ClueType | 'all'>('all')
  const [showClueBoard, setShowClueBoard] = useState(true)

  const lot = lots.find(l => l.id === lotId)
  const progress = getLotProgress(lotId || '')

  useEffect(() => {
    if (!activeProfileId || !lot) {
      navigate('/')
    }
  }, [activeProfileId, lot, navigate])

  if (!lot) return null

  const readCount = progress?.readDocuments.length || 0
  const collectedCount = progress?.collectedClues.length || 0
  const totalClues = lot.traps.length

  const allClues = useMemo(() => {
    return lot.documents.flatMap(doc =>
      doc.content.details
        .filter(s => s.isKeyClue && s.clueType)
        .map(s => ({
          ...s,
          clueType: s.clueType as ClueType,
          docId: doc.id,
          docTitle: doc.title,
          collected: progress?.collectedClues.includes(s.id) || false,
        }))
    )
  }, [lot, progress?.collectedClues])

  const filteredClues = useMemo(() => {
    if (activeTab === 'all') return allClues
    return allClues.filter(c => c.clueType === activeTab)
  }, [allClues, activeTab])

  const handleDocClick = (docId: string) => {
    setSelectedDocId(docId)
    if (!progress?.readDocuments.includes(docId)) {
      markDocumentRead(lot.id, docId)
    }
  }

  const handleClueClick = (sectionId: string) => {
    if (progress?.collectedClues.includes(sectionId)) {
      removeClue(lot.id, sectionId)
    } else {
      collectClue(lot.id, sectionId)
    }
  }

  return (
    <div className="min-h-screen desk-surface flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 bg-wood-900/80 border-b border-gold/20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gold-light hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-serif text-sm tracking-wide">返回大厅</span>
          </button>
          <div className="w-px h-6 bg-gold/30" />
          <div>
            <h1 className="font-serif text-lg text-gold-light tracking-wide">{lot.name}</h1>
            <p className="font-body text-xs text-parchment-dark tracking-wider">{lot.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm font-body">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-gold" />
              <span className="text-parchment-dark">已读 {readCount}/{lot.documents.length} 份文档</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-gold" />
              <span className="text-parchment-dark">已收集 {collectedCount}/{totalClues} 条线索</span>
            </span>
          </div>
          <button
            onClick={() => navigate(`/case/${lot.id}/valuate`)}
            className="btn-seal text-sm"
          >
            提交估价
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-auto p-6">
          <div className="relative w-full" style={{ minHeight: '600px' }}>
            {lot.documents.map((doc) => {
              const isRead = progress?.readDocuments.includes(doc.id)
              const isSelected = selectedDocId === doc.id
              const hasClues = doc.content.details.some(s => s.isKeyClue)
              const collectedInThisDoc = doc.content.details
                .filter(s => s.isKeyClue)
                .filter(s => progress?.collectedClues.includes(s.id)).length
              const totalInThisDoc = doc.content.details.filter(s => s.isKeyClue).length
              const DocIcon = getIconForDoc(doc)

              return (
                <button
                  key={doc.id}
                  onClick={() => handleDocClick(doc.id)}
                  className={`absolute parchment-card doc-shadow doc-shadow-hover rounded-sm overflow-hidden
                             transition-all duration-300 cursor-pointer
                             ${isSelected ? 'ring-2 ring-gold shadow-lg shadow-gold/20 scale-105 z-50' : 'hover:z-10'}`}
                  style={{
                    left: doc.position.x,
                    top: doc.position.y,
                    transform: `rotate(${doc.position.rotation}deg)`,
                    width: '220px',
                  }}
                >
                  <div className="relative p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <DocIcon className="w-5 h-5 text-seal" />
                        <span className="font-serif text-sm text-ink font-semibold text-left leading-tight">
                          {doc.title}
                        </span>
                      </div>
                      {isRead && <CheckCircle className="w-4 h-4 text-jade flex-shrink-0" />}
                    </div>
                    <p className="font-body text-xs text-ink/60 text-left">
                      {DOC_TYPE_LABELS[doc.type]}
                    </p>
                    {hasClues && (
                      <div className="mt-3 pt-3 border-t border-ink/10">
                        <p className="font-body text-xs text-ink/50 text-left">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          线索 {collectedInThisDoc}/{totalInThisDoc}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selectedDocId && (
          <div
            className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center"
            onClick={() => setSelectedDocId(null)}
          >
            <div
              className="parchment-card rounded-lg max-w-2xl w-full mx-6 max-h-[80vh] overflow-y-auto animate-float-in"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const doc = lot.documents.find(d => d.id === selectedDocId)
                if (!doc) return null
                const IconComp = getIconForDoc(doc)
                return (
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <IconComp className="w-6 h-6 text-seal" />
                          <h2 className="font-serif text-xl text-ink font-semibold">{doc.title}</h2>
                        </div>
                        <p className="font-body text-sm text-ink/60">
                          {DOC_TYPE_LABELS[doc.type]}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedDocId(null)}
                        className="text-ink/40 hover:text-ink/60 transition-colors text-lg"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 bg-parchment-dark/30 rounded-sm">
                        <p className="font-body text-sm text-ink/80 italic">
                          {doc.content.summary}
                        </p>
                      </div>

                      {doc.content.details.map((section) => {
                        const isCollected = progress?.collectedClues.includes(section.id)
                        const hasClueHighlight = section.isKeyClue

                        return (
                          <div
                            key={section.id}
                            onClick={() => hasClueHighlight ? handleClueClick(section.id) : undefined}
                            className={`p-4 rounded-sm transition-all
                                       ${hasClueHighlight ? 'cursor-pointer' : ''}
                                       ${hasClueHighlight && isCollected ? 'bg-gold/20 border border-gold/40' : ''}
                                       ${hasClueHighlight && !isCollected ? 'hover:bg-gold/10 border border-transparent hover:border-gold/20' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              {hasClueHighlight && (
                                <Sparkles
                                  className={`w-5 h-5 flex-shrink-0 mt-0.5
                                             ${isCollected ? 'text-gold' : 'text-gold/50'}`}
                                />
                              )}
                              <div className="flex-1">
                                <h3 className="font-serif text-sm text-ink font-semibold mb-1">
                                  {section.heading}
                                </h3>
                                <p className="font-body text-sm text-ink/80 leading-relaxed">
                                  {section.text}
                                </p>
                                {hasClueHighlight && section.clueType && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span
                                      className="text-xs px-2 py-0.5 rounded-sm font-body text-white"
                                      style={{ backgroundColor: CLUE_TYPE_COLORS[section.clueType] }}
                                    >
                                      {CLUE_TYPE_LABELS[section.clueType]}
                                    </span>
                                    {isCollected ? (
                                      <span className="text-xs text-jade font-body">✓ 已收集</span>
                                    ) : (
                                      <span className="text-xs text-ink/40 font-body">点击收集线索</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {showClueBoard && (
          <div className="w-80 bg-wood-900/90 border-l border-gold/20 flex flex-col">
            <div className="p-4 border-b border-gold/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-gold" />
                  <h2 className="font-serif text-gold-light text-lg">线索板</h2>
                </div>
                <button
                  onClick={() => setShowClueBoard(false)}
                  className="text-parchment-dark hover:text-gold transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-parchment-dark">
                  已收集 {collectedCount}/{totalClues}
                </span>
                <span className="text-gold">
                  {Math.round((collectedCount / totalClues) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-wood-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-dark to-gold rounded-full transition-all duration-500"
                  style={{ width: `${(collectedCount / totalClues) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-3 border-b border-gold/10">
              <div className="flex flex-wrap gap-1">
                {dimensionTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-2 py-1 text-xs font-serif rounded-sm transition-all
                               ${activeTab === tab.key
                                 ? 'bg-gold/20 text-gold-light'
                                 : 'text-parchment-dark hover:text-gold-light'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {filteredClues.length === 0 ? (
                <div className="text-center py-8 text-parchment-dark/60 font-body text-sm">
                  暂无线索
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClues.map((clue) => (
                    <div
                      key={clue.id}
                      className={`p-3 rounded-sm transition-all
                                 ${clue.collected
                                   ? 'bg-jade/15 border border-jade/40'
                                   : 'bg-wood-800/50 border border-gold/20'}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-body"
                          style={{
                            backgroundColor: clue.collected
                              ? `${CLUE_TYPE_COLORS[clue.clueType]}30`
                              : 'rgba(201, 168, 76, 0.1)',
                            color: clue.collected
                              ? CLUE_TYPE_COLORS[clue.clueType]
                              : '#C9A84C',
                          }}
                        >
                          {CLUE_TYPE_LABELS[clue.clueType]}
                        </span>
                        {clue.collected && (
                          <CheckCircle className="w-3 h-3 text-jade" />
                        )}
                      </div>
                      <p className="font-serif text-sm text-parchment mb-1">
                        {clue.heading}
                      </p>
                      <p className="font-body text-xs text-parchment-dark/70">
                        {clue.docTitle}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
