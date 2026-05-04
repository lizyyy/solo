const test = require('node:test')
const assert = require('node:assert')
const LicenseRiskAssessor = require('../src/core/LicenseRiskAssessor')

test('LicenseRiskAssessor - 许可证标准化', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.normalizeLicense('MIT'), 'MIT')
  assert.strictEqual(assessor.normalizeLicense('Apache-2.0'), 'Apache-2.0')
  assert.strictEqual(assessor.normalizeLicense('apache-2.0'), 'Apache-2.0')
  assert.strictEqual(assessor.normalizeLicense('GPL-3.0'), 'GPL-3.0')
  assert.strictEqual(assessor.normalizeLicense('AGPL-3.0'), 'AGPL-3.0')
  assert.strictEqual(assessor.normalizeLicense(''), 'UNKNOWN')
  assert.strictEqual(assessor.normalizeLicense(null), 'UNKNOWN')
  assert.strictEqual(assessor.normalizeLicense(undefined), 'UNKNOWN')
})

test('LicenseRiskAssessor - 风险等级评估', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.assessRisk('MIT').level, 'SAFE')
  assert.strictEqual(assessor.assessRisk('Apache-2.0').level, 'LOW')
  assert.strictEqual(assessor.assessRisk('BSD-3-Clause').level, 'SAFE')
  assert.strictEqual(assessor.assessRisk('GPL-3.0').level, 'HIGH')
  assert.strictEqual(assessor.assessRisk('AGPL-3.0').level, 'HIGH')
  assert.strictEqual(assessor.assessRisk('LGPL-3.0').level, 'MEDIUM')
  assert.strictEqual(assessor.assessRisk('MPL-2.0').level, 'MEDIUM')
  assert.strictEqual(assessor.assessRisk('UNKNOWN').level, 'UNKNOWN')
  assert.strictEqual(assessor.assessRisk('').level, 'UNKNOWN')
})

test('LicenseRiskAssessor - Copyleft 检测', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.isCopyleft('MIT'), false)
  assert.strictEqual(assessor.isCopyleft('Apache-2.0'), false)
  assert.strictEqual(assessor.isCopyleft('GPL-3.0'), true)
  assert.strictEqual(assessor.isCopyleft('AGPL-3.0'), true)
  assert.strictEqual(assessor.isCopyleft('LGPL-2.1'), true)
  assert.strictEqual(assessor.isCopyleft('MPL-2.0'), true)
})

test('LicenseRiskAssessor - 网络服务风险检测', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.isNetworkServiceRisk('MIT'), false)
  assert.strictEqual(assessor.isNetworkServiceRisk('GPL-3.0'), false)
  assert.strictEqual(assessor.isNetworkServiceRisk('AGPL-3.0'), true)
  assert.strictEqual(assessor.isNetworkServiceRisk('AGPL-3.0-only'), true)
})

test('LicenseRiskAssessor - NOTICE 要求检测', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.requiresNotice('MIT'), false)
  assert.strictEqual(assessor.requiresNotice('Apache-2.0'), true)
  assert.strictEqual(assessor.requiresNotice('GPL-3.0'), false)
})

test('LicenseRiskAssessor - 归因要求检测', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.requiresAttribution('MIT'), true)
  assert.strictEqual(assessor.requiresAttribution('Apache-2.0'), true)
  assert.strictEqual(assessor.requiresAttribution('GPL-3.0'), true)
  assert.strictEqual(assessor.requiresAttribution('BSD-3-Clause'), true)
})

test('LicenseRiskAssessor - 风险等级比较', () => {
  const assessor = new LicenseRiskAssessor()

  assert.strictEqual(assessor.compareRisk('SAFE', 'LOW'), -1)
  assert.strictEqual(assessor.compareRisk('LOW', 'SAFE'), 1)
  assert.strictEqual(assessor.compareRisk('MEDIUM', 'MEDIUM'), 0)
  assert.strictEqual(assessor.compareRisk('HIGH', 'SAFE'), 3)
  assert.strictEqual(assessor.compareRisk('UNKNOWN', 'SAFE'), 4)
})

test('LicenseRiskAssessor - 许可证说明', () => {
  const assessor = new LicenseRiskAssessor()

  const mitInfo = assessor.getLicenseExplanation('MIT')
  assert.strictEqual(typeof mitInfo.summary, 'string')
  assert.strictEqual(mitInfo.commercialUse, true)

  const apacheInfo = assessor.getLicenseExplanation('Apache-2.0')
  assert.strictEqual(apacheInfo.patentGrant, true)

  const unknownInfo = assessor.getLicenseExplanation('UNKNOWN')
  assert.strictEqual(unknownInfo.commercialUse, null)
})

test('LicenseRiskAssessor - OR 许可证处理', () => {
  const assessor = new LicenseRiskAssessor()

  const normalized = assessor.normalizeLicense('MIT OR Apache-2.0')
  assert.ok(['MIT', 'Apache-2.0'].includes(normalized))
})
