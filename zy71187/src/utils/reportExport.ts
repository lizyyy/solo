export function exportCSVReport(
  levelName: string,
  equipment: { name: string; type: string }[],
  matchedAccessories: Record<string, string>,
  accessories: { id: string; name: string; equipmentId: string; isMissing: boolean }[],
  markedDamages: Record<string, string>,
  damages: { id: string; description: string; equipmentId: string; severity: string; isNormalWear: boolean }[],
  depositAmounts: Record<string, number>,
  correctDeposits: Record<string, number>,
  totalScore: number,
  passed: boolean,
): string {
  const rows: string[] = []
  rows.push('器材归还检查报告')
  rows.push(`关卡：,${levelName}`)
  rows.push(`总分：,${totalScore}`)
  rows.push(`结果：,${passed ? '通过' : '未通过'}`)
  rows.push('')
  rows.push('器材清单')
  rows.push('器材名称,类型,押金计算,正确押金,偏差')

  for (const eq of equipment) {
    const eqKey = equipment.findIndex((e) => e.name === eq.name)
    const depKey = Object.keys(depositAmounts)[eqKey] || ''
    const playerDep = depositAmounts[depKey] || 0
    const correctDep = correctDeposits[depKey] || 0
    const diff = playerDep - correctDep
    rows.push(`${eq.name},${eq.type},${playerDep},${correctDep},${diff}`)
  }

  rows.push('')
  rows.push('配件匹配')
  rows.push('配件名称,所属器材,玩家匹配,正确匹配')

  for (const acc of accessories) {
    const playerMatch = matchedAccessories[acc.id] || '未匹配'
    const correctMatch = acc.isMissing ? '缺失' : acc.equipmentId
    rows.push(`${acc.name},${acc.equipmentId},${playerMatch},${correctMatch}`)
  }

  rows.push('')
  rows.push('损伤标记')
  rows.push('损伤描述,严重程度,玩家标记,是否正常磨损')

  for (const dmg of damages) {
    const playerMarked = markedDamages[dmg.id] ? '已标记' : '未标记'
    const isNormal = dmg.isNormalWear ? '是' : '否'
    rows.push(`${dmg.description},${dmg.severity},${playerMarked},${isNormal}`)
  }

  return rows.join('\n')
}

export function downloadCSV(filename: string, content: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
