export type Tenor = '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | '30Y'

export const TENORS: Tenor[] = ['3M', '6M', '1Y', '3Y', '5Y', '10Y', '30Y']

export const TENOR_YEARS: Record<Tenor, number> = {
  '3M': 0.25,
  '6M': 0.5,
  '1Y': 1,
  '3Y': 3,
  '5Y': 5,
  '10Y': 10,
  '30Y': 30,
}

export interface YieldCurvePoint {
  tenor: Tenor
  rate: number
}

export interface Bond {
  id: string
  name: string
  coupon: number
  maturity: number
  faceValue: number
  type: 'fixed' | 'floating'
}

export interface PortfolioPosition {
  bondId: string
  weight: number
}

export interface PriceRecord {
  bondId: string
  price: number
  timestamp: number
}

export type AlertType = 'inversion' | 'duration_mismatch' | 'weight_overflow'

export interface ScenarioAlert {
  id: string
  type: AlertType
  timestamp: number
  details: string
  severity: 'warning' | 'error'
  suggestion: string
}

export interface CurveSnapshot {
  points: YieldCurvePoint[]
  timestamp: number
}

export interface PracticeSession {
  id: string
  batchName: string
  batchDate: string
  curveSnapshots: CurveSnapshot[]
  portfolioHistory: PortfolioPosition[][]
  priceHistory: PriceRecord[]
  alerts: ScenarioAlert[]
  durationScore: number
  targetDuration: number
  actualDuration: number
  createdAt: number
  completedAt?: number
}

export interface PolicyEvent {
  id: string
  name: string
  description: string
  shifts: Partial<Record<Tenor, number>>
}

export const DEFAULT_BONDS: Bond[] = [
  { id: 'bond-01', name: '25国债01', coupon: 0.018, maturity: 0.25, faceValue: 100, type: 'fixed' },
  { id: 'bond-05', name: '25国债05', coupon: 0.021, maturity: 3, faceValue: 100, type: 'fixed' },
  { id: 'bond-10', name: '25国债10', coupon: 0.025, maturity: 5, faceValue: 100, type: 'fixed' },
  { id: 'bond-20', name: '25国债20', coupon: 0.029, maturity: 10, faceValue: 100, type: 'fixed' },
  { id: 'bond-30', name: '25国债30', coupon: 0.032, maturity: 30, faceValue: 100, type: 'fixed' },
]

export const DEFAULT_CURVE: YieldCurvePoint[] = [
  { tenor: '3M', rate: 1.60 },
  { tenor: '6M', rate: 1.70 },
  { tenor: '1Y', rate: 1.80 },
  { tenor: '3Y', rate: 2.10 },
  { tenor: '5Y', rate: 2.30 },
  { tenor: '10Y', rate: 2.60 },
  { tenor: '30Y', rate: 2.90 },
]

export const POLICY_EVENTS: PolicyEvent[] = [
  {
    id: 'cut-50',
    name: '央行降息50bp',
    description: '央行下调政策利率50个基点，短端利率大幅下行，长端受通胀预期影响下行有限',
    shifts: { '3M': -0.50, '6M': -0.45, '1Y': -0.40, '3Y': -0.30, '5Y': -0.20, '10Y': -0.10, '30Y': -0.05 },
  },
  {
    id: 'hike-25',
    name: '央行加息25bp',
    description: '央行上调政策利率25个基点，短端利率上行，曲线趋于平坦',
    shifts: { '3M': 0.30, '6M': 0.28, '1Y': 0.25, '3Y': 0.20, '5Y': 0.15, '10Y': 0.10, '30Y': 0.05 },
  },
  {
    id: 'qt',
    name: '缩表预期升温',
    description: '央行缩减资产负债表预期增强，长端利率上行幅度大于短端，曲线陡峭化',
    shifts: { '3M': 0.05, '6M': 0.08, '1Y': 0.12, '3Y': 0.20, '5Y': 0.30, '10Y': 0.40, '30Y': 0.50 },
  },
  {
    id: 'recession',
    name: '衰退预期加剧',
    description: '经济衰退预期升温，避险情绪推动长端利率大幅下行，曲线可能倒挂',
    shifts: { '3M': -0.10, '6M': -0.15, '1Y': -0.25, '3Y': -0.40, '5Y': -0.55, '10Y': -0.70, '30Y': -0.80 },
  },
  {
    id: 'inflation',
    name: '通胀超预期',
    description: '通胀数据超出市场预期，长端利率上行，收益率曲线整体上移',
    shifts: { '3M': 0.15, '6M': 0.20, '1Y': 0.25, '3Y': 0.35, '5Y': 0.40, '10Y': 0.50, '30Y': 0.55 },
  },
]
