import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const dataDir = path.join(projectRoot, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'budget.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    conversion_rate REAL DEFAULT 0,
    fatigue_score REAL DEFAULT 0,
    spend_velocity REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    conversion_date TEXT NOT NULL,
    conversions INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    revenue REAL DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    recorded_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    total_budget REAL NOT NULL,
    spent REAL DEFAULT 0,
    remaining REAL DEFAULT 0,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS allocations (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    suggested_budget REAL NOT NULL,
    actual_budget REAL,
    override_reason TEXT,
    version TEXT DEFAULT '1',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS allocation_versions (
    id TEXT PRIMARY KEY,
    allocation_id TEXT NOT NULL REFERENCES allocations(id),
    version_number TEXT NOT NULL,
    budget_value REAL NOT NULL,
    change_reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exceptions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    human_tip TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    related_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by TEXT,
    resolution TEXT
  );

  CREATE TABLE IF NOT EXISTS exception_actions (
    id TEXT PRIMARY KEY,
    exception_id TEXT NOT NULL REFERENCES exceptions(id),
    action TEXT NOT NULL,
    note TEXT,
    actor TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS creative_tags (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL REFERENCES channels(id),
    tag_name TEXT NOT NULL,
    tag_value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    format TEXT NOT NULL,
    content TEXT NOT NULL,
    human_tips TEXT,
    config_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

function seedData() {
  const channelCount = db.prepare('SELECT COUNT(*) as count FROM channels').get() as { count: number }
  if (channelCount.count > 0) return

  const insertChannel = db.prepare(`
    INSERT INTO channels (id, name, platform, conversion_rate, fatigue_score, spend_velocity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const channels = [
    { id: uuidv4(), name: '抖音', platform: 'douyin', conversion_rate: 0.038, fatigue_score: 0.72, spend_velocity: 1.2, status: 'active' },
    { id: uuidv4(), name: '快手', platform: 'kuaishou', conversion_rate: 0.029, fatigue_score: 0.45, spend_velocity: 0.8, status: 'active' },
    { id: uuidv4(), name: '小红书', platform: 'xiaohongshu', conversion_rate: 0.051, fatigue_score: 0.31, spend_velocity: 0.6, status: 'active' },
    { id: uuidv4(), name: '视频号', platform: 'weixin', conversion_rate: 0.022, fatigue_score: 0.18, spend_velocity: 0.4, status: 'active' },
    { id: uuidv4(), name: 'B站', platform: 'bilibili', conversion_rate: 0.044, fatigue_score: 0.55, spend_velocity: 0.9, status: 'active' },
  ]

  const channelIds: string[] = []
  for (const ch of channels) {
    insertChannel.run(ch.id, ch.name, ch.platform, ch.conversion_rate, ch.fatigue_score, ch.spend_velocity, ch.status)
    channelIds.push(ch.id)
  }

  const campaign618 = 'camp_618'
  const campaignBrand = 'camp_brand'

  const insertBudget = db.prepare(`
    INSERT INTO budgets (id, campaign_id, total_budget, spent, remaining, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insertBudget.run(uuidv4(), campaign618, 500000, 180000, 320000, '2026-06-01T00:00:00.000Z', '2026-06-20T00:00:00.000Z')
  insertBudget.run(uuidv4(), campaignBrand, 200000, 85000, 115000, '2026-06-10T00:00:00.000Z', '2026-06-18T00:00:00.000Z')

  const insertConversion = db.prepare(`
    INSERT INTO conversions (id, channel_id, conversion_date, conversions, cost, revenue, delay_hours, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date('2026-05-30T12:00:00.000Z')
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOffset)
    const dateStr = date.toISOString().split('T')[0]

    for (let i = 0; i < channelIds.length; i++) {
      const chId = channelIds[i]
      const ch = channels[i]
      const baseConversions = Math.round(ch.conversion_rate * 10000 * (0.8 + Math.random() * 0.4))
      const cost = Math.round(baseConversions / ch.conversion_rate * (0.9 + Math.random() * 0.2))
      const revenue = Math.round(cost * (2 + Math.random() * 1.5))
      const delayHours = i === 0 ? Math.round(20 + Math.random() * 10) : Math.round(Math.random() * 12)

      insertConversion.run(uuidv4(), chId, dateStr, baseConversions, cost, revenue, delayHours, date.toISOString())
    }
  }

  const insertException = db.prepare(`
    INSERT INTO exceptions (id, type, severity, message, human_tip, suggestion, status, related_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertException.run(
    uuidv4(),
    'budget_overspend',
    'high',
    '抖音渠道预算已超花12%',
    '⚠️ 抖音渠道预算已超花12%，建议人工确认是否追加或回调',
    '建议将抖音渠道预算回调至原预算的105%以内，或将超出部分计入下期',
    'open',
    channelIds[0],
    new Date().toISOString()
  )

  insertException.run(
    uuidv4(),
    'conversion_delay',
    'medium',
    '抖音渠道转化数据延迟超过24小时',
    '⚠️ 抖音渠道转化数据延迟超过24小时，可能影响分配决策准确性',
    '建议暂停基于抖音实时数据的自动分配，切换至人工审核模式',
    'open',
    channelIds[0],
    new Date().toISOString()
  )

  insertException.run(
    uuidv4(),
    'fatigue_missing',
    'low',
    '视频号渠道疲劳度数据缺失',
    '⚠️ 视频号渠道疲劳度数据为0，可能未正确采集，建议检查数据源',
    '建议检查视频号数据采集接口是否正常，手动补充疲劳度评分',
    'open',
    channelIds[3],
    new Date().toISOString()
  )

  const insertCreativeTag = db.prepare(`
    INSERT INTO creative_tags (id, channel_id, tag_name, tag_value)
    VALUES (?, ?, ?, ?)
  `)

  insertCreativeTag.run(uuidv4(), channelIds[0], '内容类型', '竖版短视频')
  insertCreativeTag.run(uuidv4(), channelIds[0], '投放时段', '晚间高峰')
  insertCreativeTag.run(uuidv4(), channelIds[1], '内容类型', '生活记录')
  insertCreativeTag.run(uuidv4(), channelIds[1], '投放时段', '午间')
  insertCreativeTag.run(uuidv4(), channelIds[2], '内容类型', '种草笔记')
  insertCreativeTag.run(uuidv4(), channelIds[2], '投放时段', '全天均匀')
  insertCreativeTag.run(uuidv4(), channelIds[3], '内容类型', '社交推荐')
  insertCreativeTag.run(uuidv4(), channelIds[3], '投放时段', '午间晚间')
  insertCreativeTag.run(uuidv4(), channelIds[4], '内容类型', '中长视频')
  insertCreativeTag.run(uuidv4(), channelIds[4], '投放时段', '晚间')

  const insertCalendarEvent = db.prepare(`
    INSERT INTO calendar_events (id, campaign_id, event_date, event_type, description)
    VALUES (?, ?, ?, ?, ?)
  `)

  insertCalendarEvent.run(uuidv4(), campaign618, '2026-06-01', 'launch', '618大促活动启动')
  insertCalendarEvent.run(uuidv4(), campaign618, '2026-06-18', 'peak', '618大促高峰日')
  insertCalendarEvent.run(uuidv4(), campaign618, '2026-06-20', 'end', '618大促活动结束')
  insertCalendarEvent.run(uuidv4(), campaignBrand, '2026-06-10', 'launch', '品牌日活动启动')
  insertCalendarEvent.run(uuidv4(), campaignBrand, '2026-06-18', 'end', '品牌日活动结束')
}

const seedTransaction = db.transaction(() => {
  seedData()
})
seedTransaction()

export default db
