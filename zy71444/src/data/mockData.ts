import type { ClientAccount, ExpiryBucket, OptionPosition } from "./types"

export const EXPIRY_BUCKETS: ExpiryBucket[] = [
  { id: "1M", label: "1个月", month: "2026-06", color: "#00d4aa" },
  { id: "2M", label: "2个月", month: "2026-07", color: "#00b4d8" },
  { id: "3M", label: "3个月", month: "2026-08", color: "#4cc9f0" },
  { id: "6M", label: "6个月", month: "2026-11", color: "#7b61ff" },
  { id: "9M", label: "9个月", month: "2027-02", color: "#f72585" },
  { id: "12M", label: "12个月", month: "2027-05", color: "#ff6b35" },
]

export const CLIENT_ACCOUNTS: ClientAccount[] = [
  { id: "c1", name: "华泰证券", code: "HTSC" },
  { id: "c2", name: "中信证券", code: "CITIC" },
  { id: "c3", name: "国泰君安", code: "GTJA" },
  { id: "c4", name: "广发证券", code: "GF" },
  { id: "c5", name: "招商证券", code: "CMS" },
  { id: "c6", name: "海通证券", code: "HT" },
  { id: "c7", name: "申万宏源", code: "SWHY" },
  { id: "c8", name: "银河证券", code: "CGS" },
  { id: "c9", name: "中金公司", code: "CICC" },
  { id: "c10", name: "东方证券", code: "DFZQ" },
]

const UNDERLYINGS = ["沪深300ETF", "上证50ETF", "中证500ETF", "创业板ETF", "科创50ETF"]

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generatePositionsForBucket(
  clientId: string,
  bucket: ExpiryBucket,
  bucketIndex: number
): OptionPosition[] {
  const count = randInt(2, 5)
  const positions: OptionPosition[] = []
  const isMismatchBucket = bucketIndex === 3 && (clientId === "c2" || clientId === "c7")
  const isSignReversalBucket = bucketIndex === 1 && (clientId === "c4" || clientId === "c9")

  for (let i = 0; i < count; i++) {
    const underlying = UNDERLYINGS[randInt(0, UNDERLYINGS.length - 1)]
    const direction: "CALL" | "PUT" = Math.random() > 0.5 ? "CALL" : "PUT"
    const quantity = direction === "CALL" ? randInt(10, 200) : -randInt(10, 200)
    const notional = Math.abs(quantity) * rand(2.5, 5.5) * 10000

    const baseDelta = direction === "CALL"
      ? rand(0.2, 0.8) * Math.abs(quantity)
      : -rand(0.2, 0.8) * Math.abs(quantity)
    const baseGamma = rand(0.01, 0.15) * Math.abs(quantity)
    const baseVega = rand(0.05, 0.3) * Math.abs(quantity)

    const deltaSignReversal = isSignReversalBucket && i === 0
    const delta = deltaSignReversal ? -baseDelta : baseDelta

    const actualBucket = isMismatchBucket && i === 1 ? "3M" : bucket.id

    positions.push({
      id: `${clientId}-${bucket.id}-${i}`,
      clientId,
      underlying,
      strike: rand(2.5, 5.5),
      direction,
      quantity,
      expiryDate: bucket.month + "-20",
      expiryBucket: bucket.id,
      delta,
      gamma: baseGamma,
      vega: baseVega,
      notional,
      deltaSignReversal,
      bucketMismatch: actualBucket !== bucket.id,
    })
  }

  return positions
}

export function generateMockData(): OptionPosition[] {
  const allPositions: OptionPosition[] = []

  for (const client of CLIENT_ACCOUNTS) {
    EXPIRY_BUCKETS.forEach((bucket, bucketIndex) => {
      const positions = generatePositionsForBucket(client.id, bucket, bucketIndex)
      allPositions.push(...positions)
    })
  }

  return allPositions
}

export const MOCK_POSITIONS = generateMockData()
