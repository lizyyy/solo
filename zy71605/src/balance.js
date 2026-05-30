const { BALANCE_TYPES, SOURCES } = require('./models')

function splitBalance(member) {
  if (!member || !member.balance) {
    return { stored_value: 0, bonus: 0, frozen: 0, total: 0 }
  }
  const b = member.balance
  const stored_value = Number(b.stored_value) || 0
  const bonus = Number(b.bonus) || 0
  const frozen = Number(b.frozen) || 0
  return {
    stored_value,
    bonus,
    frozen,
    total: stored_value + bonus + frozen
  }
}

function checkBonusAsCashIssue(member) {
  const b = member.balance
  if (!b) return { hasIssue: false, detail: '' }
  const stored_value = Number(b.stored_value) || 0
  const bonus = Number(b.bonus) || 0
  const issues = []
  if (bonus > 0 && bonus >= stored_value) {
    issues.push(`赠金(${bonus}) ≥ 储值(${stored_value})，赠金可能被当成现金使用`)
  }
  if (bonus > 0 && stored_value === 0) {
    issues.push(`储值为0但赠金${bonus}，余额全部为赠金，迁移时需确认赠金规则`)
  }
  return {
    hasIssue: issues.length > 0,
    detail: issues.join('; '),
    card_id: member.card_id,
    stored_value,
    bonus
  }
}

function checkDuplicateImport(members) {
  const seen = new Map()
  const duplicates = []
  for (const m of members) {
    const key = m.card_id
    if (seen.has(key)) {
      duplicates.push({
        card_id: key,
        first: seen.get(key),
        second: m,
        detail: `卡号${key}重复出现，来源分别为「${seen.get(key).source}」和「${m.source}」`
      })
    } else {
      seen.set(key, m)
    }
  }
  return duplicates
}

function validateFrozenBalance(member, freezeRecords) {
  const b = member.balance
  if (!b) return { valid: true, detail: '' }
  const declaredFrozen = Number(b.frozen) || 0
  const cardFreezeRecords = freezeRecords.filter(
    f => f.card_id === member.card_id && f.status === 'frozen'
  )
  const actualFrozen = cardFreezeRecords.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
  const diff = Math.abs(declaredFrozen - actualFrozen)
  const issues = []
  if (diff > 0.01) {
    issues.push(`卡面冻结金额${declaredFrozen}与冻结记录合计${actualFrozen}不一致，差额${diff}`)
  }
  if (declaredFrozen > 0 && actualFrozen === 0) {
    issues.push(`卡面有冻结金额${declaredFrozen}但无冻结记录，可能为手动标注`)
  }
  return {
    valid: issues.length === 0,
    detail: issues.join('; '),
    card_id: member.card_id,
    declaredFrozen,
    actualFrozen,
    diff,
    freezeRecords: cardFreezeRecords
  }
}

function fullBalanceAudit(members, freezeRecords) {
  const bonusIssues = []
  const frozenIssues = []
  const duplicateIssues = checkDuplicateImport(members)

  for (const m of members) {
    const bonusCheck = checkBonusAsCashIssue(m)
    if (bonusCheck.hasIssue) bonusIssues.push(bonusCheck)

    const frozenCheck = validateFrozenBalance(m, freezeRecords)
    if (!frozenCheck.valid) frozenIssues.push(frozenCheck)
  }

  return {
    bonusIssues,
    frozenIssues,
    duplicateIssues,
    summary: {
      totalMembers: members.length,
      bonusIssueCount: bonusIssues.length,
      frozenIssueCount: frozenIssues.length,
      duplicateIssueCount: duplicateIssues.length
    }
  }
}

module.exports = {
  splitBalance,
  checkBonusAsCashIssue,
  checkDuplicateImport,
  validateFrozenBalance,
  fullBalanceAudit
}
