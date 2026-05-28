import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlayerProfile, LotProgress, AuctionResult, TrapResult, ExportReport } from '@/types'
import lots from '@/data/lots'
import { saveState, fetchState, exportFromServer, importToServer } from '@/lib/api'

interface GameState {
  profiles: PlayerProfile[]
  activeProfileId: string | null
  serverSynced: boolean

  hydrateFromServer: () => Promise<void>
  getActiveProfile: () => PlayerProfile | null
  createProfile: (name: string) => string
  switchProfile: (profileId: string) => void
  deleteProfile: (profileId: string) => void

  markDocumentRead: (lotId: string, docId: string) => void
  collectClue: (lotId: string, sectionId: string) => void
  removeClue: (lotId: string, sectionId: string) => void
  setValuation: (lotId: string, low: number, high: number) => void
  setConfidence: (lotId: string, confidence: number) => void
  submitAuction: (lotId: string, playerBid: number) => void
  completeLot: (lotId: string) => void

  getLotProgress: (lotId: string) => LotProgress | null
  getLotScore: (lotId: string) => number

  exportReport: (lotId: string) => ExportReport | null
  exportAllData: () => Promise<string>
  importData: (json: string) => Promise<boolean>
}

const createDefaultProgress = (lotId: string): LotProgress => ({
  lotId,
  readDocuments: [],
  collectedClues: [],
  valuation: null,
  confidence: 50,
  auctionResult: null,
  completedAt: null,
  score: 0,
})

const generateId = () => `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function syncToServer(profiles: PlayerProfile[], activeProfileId: string | null) {
  saveState(profiles, activeProfileId).catch(() => {})
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      serverSynced: false,

      hydrateFromServer: async () => {
        try {
          const data = await fetchState()
          set({
            profiles: data.profiles || [],
            activeProfileId: data.activeProfileId || null,
            serverSynced: true,
          })
        } catch {
          set({ serverSynced: false })
        }
      },

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get()
        return profiles.find(p => p.profileId === activeProfileId) || null
      },

      createProfile: (name: string) => {
        const id = generateId()
        const profile: PlayerProfile = {
          profileId: id,
          profileName: name,
          currentLotId: null,
          lotProgress: {},
          totalScore: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set(state => {
          const newProfiles = [...state.profiles, profile]
          syncToServer(newProfiles, id)
          return { profiles: newProfiles, activeProfileId: id }
        })
        return id
      },

      switchProfile: (profileId: string) => {
        set({ activeProfileId: profileId })
        syncToServer(get().profiles, profileId)
      },

      deleteProfile: (profileId: string) => {
        set(state => {
          const newProfiles = state.profiles.filter(p => p.profileId !== profileId)
          const newActiveId = state.activeProfileId === profileId ? null : state.activeProfileId
          syncToServer(newProfiles, newActiveId)
          return {
            profiles: newProfiles,
            activeProfileId: newActiveId,
          }
        })
      },

      markDocumentRead: (lotId: string, docId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          if (progress.readDocuments.includes(docId)) return state
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      readDocuments: [...progress.readDocuments, docId],
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      collectClue: (lotId: string, sectionId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          if (progress.collectedClues.includes(sectionId)) return state
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      collectedClues: [...progress.collectedClues, sectionId],
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      removeClue: (lotId: string, sectionId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId]
          if (!progress) return state
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      collectedClues: progress.collectedClues.filter(id => id !== sectionId),
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      setValuation: (lotId: string, low: number, high: number) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      valuation: { low, high },
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      setConfidence: (lotId: string, confidence: number) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      confidence,
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      submitAuction: (lotId: string, playerBid: number) => {
        const lot = lots.find(l => l.id === lotId)
        if (!lot) return

        const profile = get().profiles.find(p => p.profileId === get().activeProfileId)
        if (!profile) return
        const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)

        const finalPrice = lot.finalPrice
        const won = playerBid >= finalPrice
        const profitLoss = won ? lot.correctValuation.low * 10000 - playerBid * 10000 : 0
        const correctMid = (lot.correctValuation.low + lot.correctValuation.high) / 2
        const playerMid = progress.valuation
          ? (progress.valuation.low + progress.valuation.high) / 2
          : playerBid
        const valuationDeviation = Math.abs(playerMid - correctMid) / correctMid * 100

        const trapResults: TrapResult[] = lot.traps.map(trap => {
          const identified = progress.collectedClues.includes(trap.sectionId)
          return {
            trapId: trap.id,
            identified,
            pointsEarned: identified ? trap.points : 0,
            pointsPossible: trap.points,
          }
        })

        const totalTrapPoints = trapResults.reduce((sum, t) => sum + t.pointsEarned, 0)

        let valuationScore = 0
        if (progress.valuation) {
          const vLow = progress.valuation.low
          const vHigh = progress.valuation.high
          if (vLow <= lot.correctValuation.high && vHigh >= lot.correctValuation.low) {
            const overlapLow = Math.max(vLow, lot.correctValuation.low)
            const overlapHigh = Math.min(vHigh, lot.correctValuation.high)
            const correctRange = lot.correctValuation.high - lot.correctValuation.low
            const overlapRange = overlapHigh - overlapLow
            valuationScore = Math.round((overlapRange / correctRange) * 30)
          }
        }

        const auctionScore = won ? Math.max(0, 20 - Math.round(valuationDeviation)) : Math.max(0, 10 - Math.round(valuationDeviation / 2))

        const totalScore = totalTrapPoints + valuationScore + auctionScore

        const auctionResult: AuctionResult = {
          playerBid,
          finalPrice,
          won,
          profitLoss,
          valuationDeviation: Math.round(valuationDeviation * 10) / 10,
          trapResults,
        }

        set(state => {
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      auctionResult,
                      score: totalScore,
                    },
                  },
                  totalScore: Object.values(p.lotProgress).reduce((sum, lp) => sum + (lp.score || 0), 0) + totalScore - (progress.score || 0),
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      completeLot: (lotId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId]
          if (!progress) return state
          const newProfiles = state.profiles.map(p =>
            p.profileId === state.activeProfileId
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  lotProgress: {
                    ...p.lotProgress,
                    [lotId]: {
                      ...progress,
                      completedAt: Date.now(),
                    },
                  },
                }
              : p
          )
          syncToServer(newProfiles, state.activeProfileId)
          return { profiles: newProfiles }
        })
      },

      getLotProgress: (lotId: string) => {
        const profile = get().profiles.find(p => p.profileId === get().activeProfileId)
        if (!profile) return null
        return profile.lotProgress[lotId] || null
      },

      getLotScore: (lotId: string) => {
        const profile = get().profiles.find(p => p.profileId === get().activeProfileId)
        if (!profile) return 0
        const progress = profile.lotProgress[lotId]
        return progress?.score || 0
      },

      exportReport: (lotId: string) => {
        const lot = lots.find(l => l.id === lotId)
        const profile = get().profiles.find(p => p.profileId === get().activeProfileId)
        if (!lot || !profile) return null

        const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)

        const report: ExportReport = {
          profileName: profile.profileName,
          lotName: lot.name,
          lotSubtitle: lot.subtitle,
          difficulty: lot.difficulty,
          documents: lot.documents.map(d => ({
            title: d.title,
            type: d.type,
            read: progress.readDocuments.includes(d.id),
          })),
          clues: lot.documents.flatMap(d =>
            d.content.details
              .filter(s => s.isKeyClue)
              .map(s => ({
                sectionId: s.id,
                type: s.clueType || 'unknown',
                description: `${d.title} - ${s.heading}: ${s.text.slice(0, 50)}...`,
                collected: progress.collectedClues.includes(s.id),
              }))
          ),
          valuation: progress.valuation,
          confidence: progress.confidence,
          auctionResult: progress.auctionResult,
          analysis: lot.analysis,
          generatedAt: new Date().toISOString(),
        }

        return report
      },

      exportAllData: async () => {
        try {
          return await exportFromServer()
        } catch {
          const state = get()
          return JSON.stringify({
            profiles: state.profiles,
            activeProfileId: state.activeProfileId,
            exportedAt: new Date().toISOString(),
          }, null, 2)
        }
      },

      importData: async (json: string) => {
        try {
          const result = await importToServer(json)
          if (result) {
            await get().hydrateFromServer()
          }
          return result
        } catch {
          try {
            const data = JSON.parse(json)
            if (!data.profiles || !Array.isArray(data.profiles)) return false
            set({
              profiles: data.profiles,
              activeProfileId: data.activeProfileId || null,
            })
            syncToServer(data.profiles, data.activeProfileId || null)
            return true
          } catch {
            return false
          }
        }
      },
    }),
    {
      name: 'auction-valuation-storage',
    }
  )
)
