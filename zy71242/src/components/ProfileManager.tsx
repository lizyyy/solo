import { useState, useRef, useEffect } from 'react'
import { User, Plus, ChevronDown, Trash2, Check, X } from 'lucide-react'
import { useGameStore } from '@/store'
import type { PlayerProfile } from '@/types'

export default function ProfileManager() {
  const { profiles, activeProfileId, createProfile, switchProfile, deleteProfile } = useGameStore()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeProfile = profiles.find((p: PlayerProfile) => p.profileId === activeProfileId)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setIsCreating(false)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createProfile(trimmed)
    setNewName('')
    setIsCreating(false)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') {
      setIsCreating(false)
      setNewName('')
    }
  }

  const handleDelete = (profileId: string) => {
    if (confirmDeleteId === profileId) {
      deleteProfile(profileId)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(profileId)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 gold-border gold-border-hover
                   rounded-sm transition-all duration-300 bg-wood-800/50 hover:bg-wood-700/50"
      >
        <User className="w-4 h-4 text-gold" />
        <span className="font-serif text-parchment tracking-wide">
          {activeProfile ? activeProfile.profileName : '选择鉴定师'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gold-light transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 wood-panel gold-border rounded-sm
                        shadow-2xl shadow-black/50 z-50 animate-float-in overflow-hidden">
          <div className="p-3 border-b border-gold/20">
            <p className="font-serif text-gold-light text-sm tracking-wider">鉴定师列表</p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {profiles.length === 0 && (
              <div className="p-4 text-center text-parchment-dark text-sm">
                尚无鉴定师，请创建
              </div>
            )}
            {profiles.map((p: PlayerProfile) => (
              <div
                key={p.profileId}
                className="flex items-center justify-between px-3 py-2.5
                           hover:bg-wood-700/50 transition-colors duration-200 group"
              >
                <button
                  onClick={() => {
                    switchProfile(p.profileId)
                    setOpen(false)
                    setConfirmDeleteId(null)
                  }}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {p.profileId === activeProfileId ? (
                    <Check className="w-4 h-4 text-gold flex-shrink-0" />
                  ) : (
                    <span className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className={`font-body tracking-wide text-sm ${
                    p.profileId === activeProfileId ? 'text-gold-light' : 'text-parchment'
                  }`}>
                    {p.profileName}
                  </span>
                </button>

                {confirmDeleteId === p.profileId ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(p.profileId)}
                      className="p-1 text-seal hover:bg-seal/20 rounded transition-colors"
                      title="确认删除"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-1 text-parchment-dark hover:bg-wood-600/50 rounded transition-colors"
                      title="取消"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(p.profileId)
                    }}
                    className="p-1 text-parchment-dark/50 hover:text-seal
                               opacity-0 group-hover:opacity-100 transition-all duration-200 rounded"
                    title="删除鉴定师"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gold/20 p-3">
            {isCreating ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入鉴定师名号"
                  maxLength={12}
                  className="flex-1 bg-wood-900/60 border border-gold/30 rounded-sm
                             px-3 py-1.5 text-parchment text-sm font-body
                             placeholder:text-parchment-dark/50 focus:outline-none
                             focus:border-gold/60 transition-colors"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="p-1.5 text-gold hover:text-gold-light disabled:text-parchment-dark/30
                             transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsCreating(false); setNewName('') }}
                  className="p-1.5 text-parchment-dark hover:text-parchment transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-gold/80
                           hover:text-gold-light transition-colors text-sm font-serif"
              >
                <Plus className="w-4 h-4" />
                <span>新建鉴定师</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
