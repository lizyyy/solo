import type { TimeSlot } from "./types"

const pointIds = [
  "P001", "P002", "P003", "P004", "P005", "P006",
  "P007", "P008", "P009", "P010", "P011", "P012",
  "P013", "P014", "P015", "P016", "P017", "P018",
  "P019", "P020", "P021", "P022", "P023", "P024",
  "P025", "P026", "P027", "P028", "P029", "P030",
  "P031", "P032", "P033", "P034", "P035", "P036",
]

function generateCongestion(hour: number, baseCongestion: { [key: string]: number }): { id: string; congestion: number }[] {
  return pointIds.map(id => {
    const base = baseCongestion[id] ?? 0.2
    let multiplier = 1.0
    if (hour >= 7 && hour <= 9) multiplier = 1.5 + Math.random() * 0.5
    else if (hour >= 17 && hour <= 19) multiplier = 1.3 + Math.random() * 0.4
    else if (hour >= 11 && hour <= 14) multiplier = 0.8 + Math.random() * 0.3
    else if (hour >= 22 || hour <= 5) multiplier = 0.2 + Math.random() * 0.2
    else multiplier = 0.5 + Math.random() * 0.3
    return { id, congestion: Math.min(1, Math.max(0, base * multiplier)) }
  })
}

const baseCongestionMap: { [key: string]: number } = {
  P001: 0.6, P002: 0.4, P003: 0.8, P004: 0.7, P005: 0.5, P006: 0.5,
  P007: 0, P008: 0, P009: 0.9, P010: 0.7, P011: 0.3, P012: 0.35,
  P013: 0.65, P014: 0, P015: 0.2, P016: 0.55, P017: 0.3, P018: 0.25,
  P019: 0, P020: 0, P021: 0, P022: 0, P023: 0.75, P024: 0.65,
  P025: 0, P026: 0, P027: 0.45, P028: 0.4, P029: 0.15, P030: 0.85,
  P031: 0, P032: 0, P033: 0.35, P034: 0.3, P035: 0, P036: 0,
}

export const mockTimeSlots: TimeSlot[] = Array.from({ length: 18 }, (_, i) => ({
  hour: i + 6,
  points: generateCongestion(i + 6, baseCongestionMap),
}))
