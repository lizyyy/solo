import { db } from './index.js'
import { v4 as uuidv4 } from 'uuid'

const now = new Date()
const minutesAgo = (min: number) => new Date(now.getTime() - min * 60000).toISOString()

export function insertMockData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM problems').get() as { count: number }
  if (count.count > 0) return

  const problems = [
    {
      id: uuidv4(),
      musicianName: '张伟',
      section: '主唱',
      channel: 1,
      description: '人声高频刺耳，齿音太重',
      discoveredAt: minutesAgo(45),
      status: 'confirmed',
      currentVersion: 3,
      versions: [
        { musicianName: '张伟', channel: 1, description: '人声高频刺耳，齿音太重', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
        { musicianName: '张伟', channel: 1, description: '人声高频刺耳，齿音太重', operatorName: '李音响师', tuningAction: '衰减8kHz频段，降低齿音', tuningParams: { eq: [{ freq: 8000, gain: -4, q: 2 }] }, changeReason: '首次调音尝试', anomaly: null },
        { musicianName: '张伟', channel: 1, description: '人声高频刺耳，齿音太重', operatorName: '李音响师', tuningAction: '进一步衰减7-9kHz，增加中频温暖度', tuningParams: { eq: [{ freq: 8000, gain: -6, q: 2 }, { freq: 2000, gain: 2, q: 1 }] }, changeReason: '乐手反馈仍有齿音', anomaly: null },
      ],
      confirmed: true,
    },
    {
      id: uuidv4(),
      musicianName: '王磊',
      section: '吉他手',
      channel: 3,
      description: '吉他声音发闷，缺少穿透力',
      discoveredAt: minutesAgo(30),
      status: 'resolved',
      currentVersion: 2,
      versions: [
        { musicianName: '王磊', channel: 3, description: '吉他声音发闷，缺少穿透力', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
        { musicianName: '王磊', channel: 3, description: '吉他声音发闷，缺少穿透力', operatorName: '李音响师', tuningAction: '提升3-5kHz频段，增加中频表现', tuningParams: { eq: [{ freq: 4000, gain: 5, q: 1.5 }], gain: 3 }, changeReason: '提升高频泛音', anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '李明',
      section: '鼓手',
      channel: 5,
      description: '军鼓不够脆，底鼓太软',
      discoveredAt: minutesAgo(20),
      status: 'in_progress',
      currentVersion: 1,
      versions: [
        { musicianName: '李明', channel: 5, description: '军鼓不够脆，底鼓太软', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '王磊',
      section: '吉他手',
      channel: 99,
      description: '吉他音量太小',
      discoveredAt: minutesAgo(15),
      status: 'pending',
      currentVersion: 1,
      versions: [
        { musicianName: '王磊', channel: 99, description: '吉他音量太小', operatorName: '实习助理', tuningAction: null, tuningParams: null, changeReason: null, anomaly: {
          type: 'channel_invalid',
          reason: '通道号99超出物理范围 (1-32)',
          impact: '调音台无此通道，无法执行调音动作',
          nextAction: '请核实乐手对应的监听通道编号，王磊历史使用通道为3',
        }},
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '张伟',
      section: '主唱',
      channel: 1,
      description: '人声高频刺耳',
      discoveredAt: minutesAgo(12),
      status: 'pending',
      currentVersion: 1,
      versions: [
        { musicianName: '张伟', channel: 1, description: '人声高频刺耳', operatorName: '实习助理', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '张伟',
      section: '主唱',
      channel: 1,
      description: '人声高频还是刺耳，齿音重',
      discoveredAt: minutesAgo(8),
      status: 'pending',
      currentVersion: 1,
      versions: [
        { musicianName: '张伟', channel: 1, description: '人声高频还是刺耳，齿音重', operatorName: '实习助理', tuningAction: null, tuningParams: null, changeReason: null, anomaly: {
          type: 'duplicate',
          reason: '30分钟内通道1已记录相似问题（人声高频刺耳）',
          impact: '重复记录可能导致调音动作冲突或遗漏',
          nextAction: '建议合并到已有问题，或确认是新问题',
        }},
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '刘芳',
      section: '键盘手',
      channel: 7,
      description: '钢琴音色不够透亮',
      discoveredAt: minutesAgo(25),
      status: 'in_progress',
      currentVersion: 2,
      versions: [
        { musicianName: '刘芳', channel: 7, description: '钢琴音色不够透亮', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
        { musicianName: '刘芳', channel: 7, description: '钢琴音色不够透亮', operatorName: '李音响师', tuningAction: '提升高频泛音区，增加空气感', tuningParams: { eq: [{ freq: 12000, gain: 3, q: 0.7 }] }, changeReason: '初次调整', anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '赵强',
      section: '贝斯手',
      channel: 9,
      description: '贝斯低频浑浊，不清楚',
      discoveredAt: minutesAgo(18),
      status: 'pending',
      currentVersion: 1,
      versions: [
        { musicianName: '赵强', channel: 9, description: '贝斯低频浑浊，不清楚', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '陈静',
      section: '和声',
      channel: 11,
      description: '和声音量不够，听不到自己',
      discoveredAt: minutesAgo(5),
      status: 'pending',
      currentVersion: 1,
      versions: [
        { musicianName: '陈静', channel: 11, description: '和声音量不够，听不到自己', operatorName: '实习助理', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
      ],
      confirmed: false,
    },
    {
      id: uuidv4(),
      musicianName: '周明',
      section: '打击乐',
      channel: 15,
      description: '手鼓返听延迟太高',
      discoveredAt: minutesAgo(35),
      status: 'resolved',
      currentVersion: 2,
      versions: [
        { musicianName: '周明', channel: 15, description: '手鼓返听延迟太高', operatorName: '李音响师', tuningAction: null, tuningParams: null, changeReason: null, anomaly: null },
        { musicianName: '周明', channel: 15, description: '手鼓返听延迟太高', operatorName: '李音响师', tuningAction: '降低延迟时间，调整相位', tuningParams: { delay: 0, pan: 0 }, changeReason: '延迟补偿调整', anomaly: null },
      ],
      confirmed: false,
    },
  ]

  const insertProblem = db.prepare(`
    INSERT INTO problems (id, musician_name, section, channel, description, discovered_at, rehearsal_id, status, current_version, created_at, updated_at)
    VALUES (@id, @musicianName, @section, @channel, @description, @discoveredAt, 'default', @status, @currentVersion, @createdAt, @updatedAt)
  `)

  const insertVersion = db.prepare(`
    INSERT INTO problem_versions (id, problem_id, version, parent_version, musician_name, channel, description, tuning_action, tuning_params, operator_name, change_reason, anomaly_info, created_at)
    VALUES (@id, @problemId, @version, @parentVersion, @musicianName, @channel, @description, @tuningAction, @tuningParams, @operatorName, @changeReason, @anomalyInfo, @createdAt)
  `)

  const insertAnomaly = db.prepare(`
    INSERT INTO anomaly_records (id, problem_id, version_id, type, reason, impact, next_action, related_problem_ids, created_at)
    VALUES (@id, @problemId, @versionId, @type, @reason, @impact, @nextAction, @relatedProblemIds, @createdAt)
  `)

  const insertConfirmation = db.prepare(`
    INSERT INTO confirmations (id, problem_id, version, musician_signed, musician_signed_at, musician_signature, engineer_signed, engineer_signed_at, engineer_signature, notes, created_at)
    VALUES (@id, @problemId, @version, @musicianSigned, @musicianSignedAt, @musicianSignature, @engineerSigned, @engineerSignedAt, @engineerSignature, @notes, @createdAt)
  `)

  const tx = db.transaction(() => {
    for (const problem of problems) {
      const createdAt = minutesAgo(50)
      insertProblem.run({
        ...problem,
        createdAt,
        updatedAt: new Date().toISOString(),
      })

      for (let i = 0; i < problem.versions.length; i++) {
        const v = problem.versions[i]
        const versionId = uuidv4()
        insertVersion.run({
          id: versionId,
          problemId: problem.id,
          version: i + 1,
          parentVersion: i > 0 ? i : null,
          musicianName: v.musicianName,
          channel: v.channel,
          description: v.description,
          tuningAction: v.tuningAction,
          tuningParams: v.tuningParams ? JSON.stringify(v.tuningParams) : null,
          operatorName: v.operatorName,
          changeReason: v.changeReason,
          anomalyInfo: v.anomaly ? JSON.stringify(v.anomaly) : null,
          createdAt: minutesAgo(45 - i * 5),
        })

        if (v.anomaly) {
          insertAnomaly.run({
            id: uuidv4(),
            problemId: problem.id,
            versionId,
            type: v.anomaly.type,
            reason: v.anomaly.reason,
            impact: v.anomaly.impact,
            nextAction: v.anomaly.nextAction,
            relatedProblemIds: v.anomaly.relatedProblemIds ? JSON.stringify(v.anomaly.relatedProblemIds) : null,
            createdAt: minutesAgo(45 - i * 5),
          })
        }
      }

      if (problem.confirmed) {
        insertConfirmation.run({
          id: uuidv4(),
          problemId: problem.id,
          version: problem.currentVersion,
          musicianSigned: 1,
          musicianSignedAt: minutesAgo(10),
          musicianSignature: '张伟',
          engineerSigned: 1,
          engineerSignedAt: minutesAgo(5),
          engineerSignature: '李音响师',
          notes: '问题已完全解决，乐手满意',
          createdAt: minutesAgo(5),
        })
      }
    }
  })

  tx()
}
