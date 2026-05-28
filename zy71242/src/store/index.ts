import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlayerProfile, LotProgress, AuctionResult, TrapResult, ExportReport } from '@/types'
import lots from '@/data/lots'

interface GameState {
  profiles: PlayerProfile[]
  activeProfileId: string | null

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
  exportAllData: () => string
  importData: (json: string) => boolean
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

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

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
        set(state => ({
          profiles: [...state.profiles, profile],
          activeProfileId: id,
        }))
        return id
      },

      switchProfile: (profileId: string) => {
        set({ activeProfileId: profileId })
      },

      deleteProfile: (profileId: string) => {
        set(state => ({
          profiles: state.profiles.filter(p => p.profileId !== profileId),
          activeProfileId: state.activeProfileId === profileId ? null : state.activeProfileId,
        }))
      },

      markDocumentRead: (lotId: string, docId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          if (progress.readDocuments.includes(docId)) return state
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
        })
      },

      collectClue: (lotId: string, sectionId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          if (progress.collectedClues.includes(sectionId)) return state
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
        })
      },

      removeClue: (lotId: string, sectionId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId]
          if (!progress) return state
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
        })
      },

      setValuation: (lotId: string, low: number, high: number) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
        })
      },

      setConfidence: (lotId: string, confidence: number) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId] || createDefaultProgress(lotId)
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
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
        const maxTrapPoints = trapResults.reduce((sum, t) => sum + t.pointsPossible, 0)

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

        set(state => ({
          profiles: state.profiles.map(p =>
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
          ),
        }))
      },

      completeLot: (lotId: string) => {
        set(state => {
          const profile = state.profiles.find(p => p.profileId === state.activeProfileId)
          if (!profile) return state
          const progress = profile.lotProgress[lotId]
          if (!progress) return state
          return {
            profiles: state.profiles.map(p =>
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
            ),
          }
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

      exportAllData: () => {
        const state = get()
        return JSON.stringify({
          profiles: state.profiles,
          activeProfileId: state.activeProfileId,
          exportedAt: new Date().toISOString(),
        }, null, 2)
      },

      importData: (json: string) => {
        try {
          const data = JSON.parse(json)
          if (!data.profiles || !Array.isArray(data.profiles)) return false
          set({
            profiles: data.profiles,
            activeProfileId: data.activeProfileId || null,
          })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: 'auction-valuation-storage',
    }
  )
)
