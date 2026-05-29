import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

const RULES_APPENDIX = [
  {
    rule: '修复状态流转规则',
    description: '作品状态按 pending → in_progress → completed → archived 流转；修复记录按 draft → in_progress → under_review → approved/rejected 流转。rejected 状态需填写退回原因，退回后修复师可重新修改再提交。approved 后所有步骤与材料锁定，仅馆方审核员可解锁。',
  },
  {
    rule: '材料追踪规则',
    description: '批号格式要求：2位大写字母+8位数字（如 AB20240001）。有效期过期自动标记为 expired 并触发异常。批号格式不合规自动标记为 batch_error 并触发异常。同一批号可关联多个步骤，支持反查。',
  },
  {
    rule: '照片版本规则',
    description: '每个步骤至少应关联1张照片（before/during/after任一阶段），缺失照片触发 missing_photo 异常。重新上传同阶段照片自动递增版本号，旧版本不删除，保留历史记录。',
  },
  {
    rule: '签名留痕规则',
    description: '修复师签名代表锁定步骤，不再允许修改。馆方审核员签名代表确认闭环，完成三段追溯链。签名数据为 Canvas base64，附签名人、角色、时间戳。已签名记录不可删除签名。',
  },
  {
    rule: '异常检测规则',
    description: 'missing_photo：步骤缺少照片；batch_number_error：材料批号不匹配 /^[A-Z]{2}\\d{8}$/；step_order_inverted：步骤顺序高于前一步但执行时间早于前一步；material_expired：材料有效期已过。',
  },
  {
    rule: '报告导出规则',
    description: '报告必须包含：作品信息、修复步骤、材料清单、异常清单（含修正记录）、签名页。异常清单按类型分组，每组列出：异常描述、发现时间、修正操作、确认人。规则说明作为附录附入。步骤顺序倒置的异常在报告中以时间线对比展示。',
  },
]

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  missing_photo: '照片缺失',
  batch_number_error: '材料批号错误',
  step_order_inverted: '步骤顺序倒置',
  material_expired: '材料过期',
}

const STEP_TYPE_LABELS: Record<string, string> = {
  cleaning: '清洁',
  color_correction: '补色',
  reinforcement: '加固',
  other: '其他',
}

const reportStore = new Map<string, unknown>()

router.post('/restorations/:id/report', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { includeAnomalies = true, includeCorrections = true, includeSignatures = true, includeRules = true } = req.body

  const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(restoration.artwork_id) as Record<string, unknown>

  const steps = db.prepare('SELECT * FROM restoration_steps WHERE restoration_id = ? ORDER BY step_order').all(req.params.id) as Record<string, unknown>[]

  const stepsWithDetails = steps.map(step => {
    const materials = db.prepare('SELECT * FROM material_batches WHERE step_id = ?').all(step.id) as Record<string, unknown>[]
    const photos = db.prepare('SELECT * FROM photos WHERE step_id = ? ORDER BY phase, version').all(step.id) as Record<string, unknown>[]
    return {
      ...toCamelCase(step),
      stepTypeLabel: STEP_TYPE_LABELS[step.type as string] || step.type,
      materials: materials.map(toCamelCase),
      photos: photos.map(toCamelCase),
    }
  })

  let anomaliesSection: unknown = null
  if (includeAnomalies) {
    const anomalies = db.prepare('SELECT * FROM anomalies WHERE restoration_id = ? ORDER BY detected_at').all(req.params.id) as Record<string, unknown>[]

    const grouped: Record<string, unknown[]> = {}
    for (const anomaly of anomalies) {
      const type = anomaly.type as string
      if (!grouped[type]) grouped[type] = []
      const entry: Record<string, unknown> = {
        ...toCamelCase(anomaly),
        typeLabel: ANOMALY_TYPE_LABELS[type] || type,
      }

      if (includeCorrections) {
        const corrections = db.prepare('SELECT * FROM corrections WHERE anomaly_id = ? ORDER BY corrected_at').all(anomaly.id) as Record<string, unknown>[]
        entry.corrections = corrections.map(toCamelCase)
      }

      grouped[type].push(entry)
    }

    const groupedWithLabels = Object.entries(grouped).map(([type, items]) => ({
      type,
      typeLabel: ANOMALY_TYPE_LABELS[type] || type,
      items,
    }))

    anomaliesSection = groupedWithLabels
  }

  let signaturesSection: unknown = null
  if (includeSignatures) {
    const signatures = db.prepare('SELECT * FROM signatures WHERE restoration_id = ? ORDER BY signed_at').all(req.params.id) as Record<string, unknown>[]
    signaturesSection = signatures.map(toCamelCase)
  }

  const report = {
    id: uuidv4(),
    restorationId: req.params.id,
    generatedAt: new Date().toISOString(),
    includeAnomalies,
    includeCorrections,
    includeSignatures,
    includeRules,
    artwork: toCamelCase(artwork),
    restoration: toCamelCase(restoration),
    steps: stepsWithDetails,
    anomalies: anomaliesSection,
    signatures: signaturesSection,
    rulesAppendix: includeRules ? RULES_APPENDIX : null,
  }

  reportStore.set(report.id as string, report)

  res.status(201).json({ success: true, data: report })
})

router.get('/reports/:id', (req: Request, res: Response): void => {
  const report = reportStore.get(req.params.id)
  if (!report) {
    res.status(404).json({ success: false, error: '报告不存在' })
    return
  }
  res.json({ success: true, data: report })
})

export default router
