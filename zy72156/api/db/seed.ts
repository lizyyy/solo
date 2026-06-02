import { getDb } from '../db/index.js'
import { initSchema } from '../db/schema.js'

function seedIfNeeded(): void {
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) as c FROM locations').get() as { c: number }
  if (count.c > 0) return

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const insertLocation = db.prepare(`
    INSERT INTO locations (id, canonical_name, aliases, lat, lng, has_coordinate_drift, drift_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertLocation.run('loc-1', '翠湖公园东门', JSON.stringify(['翠湖公园东门路口', '翠湖东门', '翠湖公园东']), 30.572, 104.066, 0, null, now, now)
  insertLocation.run('loc-2', '翠湖公园西门', JSON.stringify(['翠湖西门', '翠湖公园西门口']), 30.568, 104.058, 1, '两批投诉坐标差约80米，以西门牌坊为准', now, now)
  insertLocation.run('loc-3', '人民公园南广场', JSON.stringify(['人民公园南门广场', '人民公园南']), 30.658, 104.065, 0, null, now, now)
  insertLocation.run('loc-4', '浣花溪公园北入口', JSON.stringify(['浣花溪北门', '浣花溪公园北入口路口']), 30.659, 104.032, 1, '地图标注与实际入口偏移约120米', now, now)
  console.log('Seed: locations inserted')

  const insertFeedback = db.prepare(`
    INSERT INTO feedback (id, location_id, raw_location_text, content, source, source_type, is_duplicate, duplicate_of, is_boundary, boundary_note, reported_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertFeedback.run('fb-1', 'loc-1', '翠湖公园东门路口', '广场舞音响每天早上7点到9点，音量过大，影响旁边小区住户休息', '张女士 2024-03-15 来电', '居民投诉', 0, null, 0, null, '2024-03-15 08:30', now)
  insertFeedback.run('fb-2', 'loc-1', '翠湖东门', '东门广场每天早上广场舞太吵了，能不能管管', '李先生 2024-03-18 12345', '12345工单', 1, 'fb-1', 0, null, '2024-03-18 09:15', now)
  insertFeedback.run('fb-3', 'loc-1', '翠湖公园东', '东门这边合唱团下午也很吵', '王阿姨 2024-04-02 来访', '现场走访', 0, null, 0, null, '2024-04-02 14:20', now)
  insertFeedback.run('fb-4', 'loc-2', '翠湖西门', '西门广场晚上7点到9点太极拳音乐太响', '赵先生 2024-03-20 来电', '居民投诉', 0, null, 0, null, '2024-03-20 19:45', now)
  insertFeedback.run('fb-5', 'loc-2', '翠湖公园西门口', '西门口每天晚上都有人放露天电影，声音很大', '周女士 2024-04-05 12345', '12345工单', 0, null, 0, null, '2024-04-05 20:10', now)
  insertFeedback.run('fb-6', 'loc-3', '人民公园南广场', '南广场周末有乐队排练，音响开得特别大', '吴先生 2024-04-10 来电', '居民投诉', 0, null, 0, null, '2024-04-10 15:30', now)
  insertFeedback.run('fb-7', 'loc-3', '人民公园南门广场', '广场舞团队之间互相比音量，越来越吵', '郑女士 2024-04-12 来电', '居民投诉', 1, 'fb-6', 0, null, '2024-04-12 16:00', now)
  insertFeedback.run('fb-8', 'loc-4', '浣花溪北门', '北入口附近每天清晨有群众练功喊嗓，6点就开始', '陈先生 2024-04-15 来电', '居民投诉', 0, null, 0, null, '2024-04-15 06:45', now)
  insertFeedback.run('fb-9', 'loc-4', '浣花溪公园北入口路口', '北入口路口活动噪声涉及边界区域，部分属于公园用地、部分属于市政道路，需确认管辖', '网格员 小刘 2024-04-18 巡查', '网格巡查', 0, null, 1, '公园用地与市政道路交界，管辖权需明确', '2024-04-18 10:00', now)
  insertFeedback.run('fb-10', 'loc-1', '翠湖公园东门路口', null, '匿名 2024-04-20 12345', '12345工单', 0, null, 0, null, '2024-04-20 07:30', now)
  console.log('Seed: feedback inserted')

  const insertScheme = db.prepare(`
    INSERT INTO schemes (id, location_id, version, title, content, status, superseded_by, historical_opinion, manual_note, source_refs, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertScheme.run('sc-1', 'loc-1', 1, '翠湖公园东门噪声调解方案v1', '建议将广场舞时间调整为8:00-9:00，音量限制在60分贝以内', '被覆盖', null, 'v1方案执行后居民仍反映音量超标，需加严管控', '老曹：v1执行两周后复查，确实没达到效果', JSON.stringify(['fb-1', 'fb-2']), '2024-04-01 10:00', '老曹')
  insertScheme.run('sc-2', 'loc-1', 2, '翠湖公园东门噪声调解方案v2', '将活动区域移至东门广场东侧（远离住宅区），同时安装分贝监测显示屏，超65分贝自动提醒', '已发布', null, null, null, JSON.stringify(['fb-1', 'fb-2', 'fb-3']), '2024-04-20 14:00', '老曹')
  insertScheme.run('sc-3', 'loc-2', 1, '翠湖公园西门噪声调解方案v1', '建议太极拳团队改用蓝牙音箱，统一音量控制', '草稿', null, null, '老曹：方案还在跟团队沟通中', JSON.stringify(['fb-4', 'fb-5']), '2024-04-25 09:30', '老曹')
  insertScheme.run('sc-4', 'loc-3', 1, '人民公园南广场噪声调解方案v1', '设立周末活动报备制度，限制音响功率不超过30W', '草稿', null, null, null, JSON.stringify(['fb-6', 'fb-7']), '2024-04-28 11:00', '老曹')
  insertScheme.run('sc-5', 'loc-4', 1, '浣花溪公园北入口噪声调解方案v1', '因涉及管辖边界，需先与市政道路管理部门协商确定管辖权，再制定管控措施', '草稿', null, null, '老曹：管辖权确认中，暂缓执行', JSON.stringify(['fb-8', 'fb-9']), '2024-05-01 10:00', '老曹')
  console.log('Seed: schemes inserted')

  db.prepare('UPDATE schemes SET superseded_by = ? WHERE id = ?').run('sc-2', 'sc-1')
  console.log('Seed: schemes updated')

  const insertReport = db.prepare(`
    INSERT INTO reports (id, location_id, scheme_id, title, content, cross_period_stats, source_trace, generated_at, generated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertReport.run(
    'rpt-1', 'loc-1', 'sc-2', '翠湖公园东门噪声调解报告',
    '【调解概况】\n翠湖公园东门广场舞噪声问题，经居民张女士、李先生等多次投诉（详见来源追踪），我处于2024年4月1日发布v1方案，将活动时间调整为8:00-9:00、音量限60分贝。执行两周后复查发现效果不理想，居民仍反映超标。\n\n【方案调整】\n2024年4月20日发布v2方案：活动区域东移（远离住宅），加装分贝监测屏，超65分贝自动提醒。目前方案执行中，待6月底评估。\n\n【特别说明】\n1. 投诉人张女士与李先生描述的是同一问题，已合并处理\n2. 4月2日王阿姨补充反映下午合唱团噪声，已纳入v2方案一并处理\n3. v1方案虽然被覆盖，但历史意见已保留（详见方案版本记录）',
    JSON.stringify({ '2024年3月': 2, '2024年4月': 1, '2024年5月（截至报告日）': 0 }),
    JSON.stringify([
      { ref: 'fb-1', type: '居民投诉', time: '2024-03-15 08:30' },
      { ref: 'fb-2', type: '12345工单', time: '2024-03-18 09:15' },
      { ref: 'fb-3', type: '现场走访', time: '2024-04-02 14:20' },
      { ref: 'fb-10', type: '12345工单', time: '2024-04-20 07:30' }
    ]),
    '2024-05-15 16:00', '老曹'
  )
  console.log('Seed: reports inserted')

  const insertNote = db.prepare(`
    INSERT INTO manual_notes (id, target_type, target_id, content, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  insertNote.run('note-1', 'location', 'loc-1', '翠湖东门这个点位投诉比较集中，后续需要重点关注', '2024-04-20 14:30', '老曹')
  insertNote.run('note-2', 'scheme', 'sc-1', 'v1方案限期整改效果不佳，已升级为v2', '2024-04-20 14:00', '老曹')
  insertNote.run('note-3', 'feedback', 'fb-9', '边界记录：需与市政道路管理科确认管辖范围后再处理', '2024-04-18 11:00', '老曹')
  insertNote.run('note-4', 'location', 'loc-4', '浣花溪北入口管辖权待确认，不要急着出方案', '2024-05-01 10:30', '老曹')
  console.log('Seed: notes inserted')
}

export function initDatabase(): void {
  initSchema()
  seedIfNeeded()
}
