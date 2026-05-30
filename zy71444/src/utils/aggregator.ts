import type { OptionPosition, AggregatedExposure, IntermediateStep, GreekKey } from "../data/types"
import { CLIENT_ACCOUNTS, EXPIRY_BUCKETS } from "../data/mockData"

function detectAnomalies(positions: OptionPosition[]): {
  hasAnomaly: boolean
  anomalyType: ("BUCKET_MISMATCH" | "SIGN_REVERSAL")[]
  mismatchPositions: OptionPosition[]
  reversalPositions: OptionPosition[]
} {
  const mismatchPositions = positions.filter((p) => p.bucketMismatch)
  const reversalPositions = positions.filter((p) => p.deltaSignReversal)
  const anomalyType: ("BUCKET_MISMATCH" | "SIGN_REVERSAL")[] = []
  if (mismatchPositions.length > 0) anomalyType.push("BUCKET_MISMATCH")
  if (reversalPositions.length > 0) anomalyType.push("SIGN_REVERSAL")
  return {
    hasAnomaly: anomalyType.length > 0,
    anomalyType,
    mismatchPositions,
    reversalPositions,
  }
}

function buildIntermediateSteps(
  positions: OptionPosition[],
  greek: GreekKey
): IntermediateStep[] {
  const steps: IntermediateStep[] = []

  const rawValues = positions.map((p) => ({ id: p.id, value: p[greek] }))
  const rawSum = rawValues.reduce((s, r) => s + r.value, 0)

  steps.push({
    step: "原始求和",
    description: `对${positions.length}个头寸的${greek.toUpperCase()}值逐项求和`,
    inputValues: Object.fromEntries(rawValues.map((r) => [r.id, Math.round(r.value * 100) / 100])),
    outputValue: Math.round(rawSum * 100) / 100,
  })

  const absSum = rawValues.reduce((s, r) => s + Math.abs(r.value), 0)
  const netRatio = absSum > 0 ? rawSum / absSum : 0
  steps.push({
    step: "净额/绝对值比",
    description: "净敞口与绝对敞口之比，判断方向集中度",
    inputValues: { 净敞口: Math.round(rawSum * 100) / 100, 绝对敞口: Math.round(absSum * 100) / 100 },
    outputValue: Math.round(netRatio * 1000) / 1000,
    threshold: 0.7,
    reasoning: netRatio > 0.7
      ? `净额/绝对值比 ${netRatio.toFixed(3)} > 0.7，方向高度集中`
      : `净额/绝对值比 ${netRatio.toFixed(3)} ≤ 0.7，方向较分散`,
  })

  const reversals = positions.filter((p) => p.deltaSignReversal)
  if (reversals.length > 0) {
    steps.push({
      step: "符号反转检测",
      description: "Delta符号与标的方向相反的头寸",
      inputValues: Object.fromEntries(
        reversals.map((p) => [p.id, Math.round(p.delta * 100) / 100])
      ),
      outputValue: reversals.length,
      threshold: 0,
      reasoning: `发现${reversals.length}个符号反转头寸，需核实方向标记`,
    })
  }

  const mismatches = positions.filter((p) => p.bucketMismatch)
  if (mismatches.length > 0) {
    steps.push({
      step: "到期桶错位检测",
      description: "头寸到期日与桶归属不匹配",
      inputValues: Object.fromEntries(
        mismatches.map((p) => [`${p.id}(到期=${p.expiryDate}, 桶=${p.expiryBucket})`, 1])
      ),
      outputValue: mismatches.length,
      threshold: 0,
      reasoning: `发现${mismatches.length}个到期桶错位头寸，需核实归属逻辑`,
    })
  }

  return steps
}

export function aggregatePositions(positions: OptionPosition[]): AggregatedExposure[] {
  const groups = new Map<string, OptionPosition[]>()

  for (const pos of positions) {
    const key = `${pos.clientId}::${pos.expiryBucket}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(pos)
  }

  const results: AggregatedExposure[] = []

  for (const [key, groupPositions] of groups) {
    const [clientId, bucketId] = key.split("::")
    const client = CLIENT_ACCOUNTS.find((c) => c.id === clientId)
    const bucket = EXPIRY_BUCKETS.find((b) => b.id === bucketId)
    if (!client || !bucket) continue

    const anomalyInfo = detectAnomalies(groupPositions)

    const deltaSteps = buildIntermediateSteps(groupPositions, "delta")
    const gammaSteps = buildIntermediateSteps(groupPositions, "gamma")
    const vegaSteps = buildIntermediateSteps(groupPositions, "vega")

    results.push({
      clientId,
      clientName: client.name,
      clientCode: client.code,
      bucketId,
      bucketLabel: bucket.label,
      bucketColor: bucket.color,
      delta: Math.round(groupPositions.reduce((s, p) => s + p.delta, 0) * 100) / 100,
      gamma: Math.round(groupPositions.reduce((s, p) => s + p.gamma, 0) * 100) / 100,
      vega: Math.round(groupPositions.reduce((s, p) => s + p.vega, 0) * 100) / 100,
      positions: groupPositions,
      intermediateSteps: [...deltaSteps, ...gammaSteps, ...vegaSteps],
      hasAnomaly: anomalyInfo.hasAnomaly,
      anomalyType: anomalyInfo.anomalyType,
    })
  }

  return results
}
