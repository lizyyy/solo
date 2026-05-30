import { create } from 'zustand'
import type {
  Seat,
  Speaker,
  SeatMeasurement,
  Anomaly,
  AudienceZone,
  AnomalyType,
  FrequencyBand,
} from '@/types'
import { generateAllData } from '@/data/mock'

interface DataConflict {
  field: string
  existingSource: string
  newSource: string
}

type MergeableKeys = 'seats' | 'speakers' | 'measurements' | 'anomalies' | 'zones'
type MergeableData = Partial<Pick<DataState, MergeableKeys>>

interface DataState {
  seats: Seat[]
  speakers: Speaker[]
  measurements: SeatMeasurement[]
  anomalies: Anomaly[]
  zones: AudienceZone[]
  loading: boolean
  dataConflicts: Map<string, DataConflict>
}

interface DataActions {
  loadData: () => void
  mergeData: (partial: MergeableData) => void
  getMeasurementForSeat: (seatId: string, band: FrequencyBand) => SeatMeasurement | undefined
  getAnomaliesForObject: (objectType: 'seat' | 'speaker', objectId: string) => Anomaly[]
  getFilteredSeatIds: (zoneIds: string[], anomalyTypes: AnomalyType[], splRange: [number, number]) => string[]
}

const useDataStore = create<DataState & DataActions>()((set, get) => ({
  seats: [],
  speakers: [],
  measurements: [],
  anomalies: [],
  zones: [],
  loading: true,
  dataConflicts: new Map<string, DataConflict>(),

  loadData: () => {
    set({ loading: true })
    const data = generateAllData()
    set({
      seats: data.seats,
      speakers: data.speakers,
      measurements: data.measurements,
      anomalies: data.anomalies,
      zones: data.zones,
      loading: false,
    })
  },

  mergeData: (partial) => {
    set((state) => {
      const newConflicts = new Map(state.dataConflicts)
      const updates: Partial<DataState> = {}

      const dataKeys: MergeableKeys[] = ['seats', 'speakers', 'measurements', 'anomalies', 'zones']

      for (const key of dataKeys) {
        if (key in partial && partial[key] !== undefined) {
          const current = state[key]
          if (Array.isArray(current) && current.length > 0) {
            newConflicts.set(key, {
              field: key,
              existingSource: 'original',
              newSource: 'merge',
            })
          } else {
            updates[key] = partial[key] as never
          }
        }
      }

      return { ...updates, dataConflicts: newConflicts }
    })
  },

  getMeasurementForSeat: (seatId, band) => {
    return get().measurements.find(
      (m) => m.seatId === seatId && m.frequencyBand === band,
    )
  },

  getAnomaliesForObject: (objectType, objectId) => {
    return get().anomalies.filter(
      (a) => (objectType === 'seat' ? a.seatId === objectId : a.speakerId === objectId),
    )
  },

  getFilteredSeatIds: (zoneIds, anomalyTypes, splRange) => {
    const { seats, measurements, anomalies } = get()

    return seats
      .filter((seat) => {
        if (zoneIds.length > 0 && !zoneIds.includes(seat.zoneId)) return false

        if (anomalyTypes.length > 0) {
          const seatAnomalies = anomalies.filter(
            (a) => a.seatId === seat.id,
          )
          if (!seatAnomalies.some((a) => anomalyTypes.includes(a.type))) return false
        }

        const seatMeasurements = measurements.filter((m) => m.seatId === seat.id)
        const hasInRange = seatMeasurements.some(
          (m) => m.splDB >= splRange[0] && m.splDB <= splRange[1],
        )
        if (seatMeasurements.length > 0 && !hasInRange) return false

        return true
      })
      .map((seat) => seat.id)
  },
}))

export default useDataStore
