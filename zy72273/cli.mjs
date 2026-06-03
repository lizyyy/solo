#!/usr/bin/env node

const BASE_URL = process.env.API_URL || 'http://localhost:3001'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${path}`, opts)
  return res.json()
}

async function listRecords(status) {
  const url = status ? `/api/records?status=${status}` : '/api/records'
  const res = await request('GET', url)
  if (!res.success) { console.error('错误:', res.error); process.exit(1) }
  if (res.data.length === 0) { console.log('暂无记录'); return }
  console.log(`\n  ${'信标ID'.padEnd(14)} ${'状态'.padEnd(10)} ${'坐标混用'.padEnd(8)} ${'照片数'.padEnd(6)} 更新时间`)
  console.log('  ' + '-'.repeat(70))
  for (const r of res.data) {
    const mix = r.coordinate_mix_detected ? '⚠ 混用' : '  无'
    console.log(`  ${r.beacon_id.padEnd(14)} ${r.status.padEnd(10)} ${mix.padEnd(8)} ${String(r.photo_count ?? 0).padEnd(6)} ${r.updated_at}`)
  }
  console.log()
}

async function showDetail(id) {
  const res = await request('GET', `/api/records/${id}`)
  if (!res.success) { console.error('错误:', res.error); process.exit(1) }
  const r = res.data
  console.log(`\n  信标: ${r.beacon_id}`)
  console.log(`  状态: ${r.status}`)
  console.log(`  坐标原点说明: ${r.origin_description}`)
  console.log(`  坐标混用: ${r.coordinate_mix_detected ? '是 ⚠' : '否'}`)
  console.log()

  if (r.coordinates && r.coordinates.length > 0) {
    console.log('  坐标数据:')
    for (const c of r.coordinates) {
      const latlng = c.lat != null && c.lng != null ? `${c.lat}, ${c.lng}` : '—'
      const metric = c.x != null && c.y != null ? `(${c.x}, ${c.y}${c.z != null ? ', ' + c.z : ''})` : '—'
      const typeLabel = c.coordinate_type === 'mixed' ? '混用 ⚠' : c.coordinate_type === 'latlng' ? '经纬度' : '米制'
      console.log(`    ${c.point_name}: [${typeLabel}] 经纬度=${latlng} 米制=${metric}`)
      if (c.manual_correction) {
        console.log(`      人工修正: ${JSON.stringify(c.manual_correction)}`)
      }
    }
    console.log()
  }

  if (r.photos && r.photos.length > 0) {
    console.log('  巡检照片:')
    for (const p of r.photos) {
      console.log(`    ${p.photo_id} (补录人: ${p.supplemented_by || '—'}, 时间: ${p.supplemented_at || '—'})`)
    }
  } else {
    console.log('  巡检照片: 尚未补录')
  }
  console.log()

  if (r.note) {
    console.log('  现场班组说明:')
    console.log(`    为什么留下: ${r.note.why_left_behind || '—'}`)
    console.log(`    缺什么材料: ${r.note.missing_materials.join(', ') || '无'}`)
    console.log(`    下一步找谁: 联系${r.note.next_step.contactTeam === 'inspection' ? '巡检组' : '园区运维'} ${r.note.next_step.contactPerson} — ${r.note.next_step.action}`)
    console.log(`    版本: v${r.note.version}`)
  }
  console.log()

  if (r.logs && r.logs.length > 0) {
    console.log('  操作历史:')
    for (const l of r.logs) {
      console.log(`    [${l.timestamp}] ${l.operator}(${l.operator_role}): ${l.description}${l.reason ? ' 原因: ' + l.reason : ''}`)
    }
  }
  console.log()
}

async function importData(filePath) {
  const fs = await import('fs')
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  const res = await request('POST', '/api/records/import', data)
  if (!res.success) { console.error('导入失败:', res.error); process.exit(1) }
  console.log('导入成功:', res.data)
}

async function supplementPhoto(recordId, photoIds, operator) {
  const res = await request('PATCH', `/api/records/${recordId}/photo`, { photoIds: photoIds.split(','), operator })
  if (!res.success) { console.error('补录失败:', res.error); process.exit(1) }
  console.log('补录成功:', res.data)
}

async function manualCorrect(recordId, entryId, operator, reason, correctionJson) {
  const correction = correctionJson ? JSON.parse(correctionJson) : {}
  const res = await request('POST', `/api/records/${recordId}/correct`, { entryId, correction, operator, reason })
  if (!res.success) { console.error('修正失败:', res.error); process.exit(1) }
  console.log('修正成功:', res.data)
}

async function rerun(recordId, operator) {
  const res = await request('POST', `/api/records/${recordId}/rerun`, { operator })
  if (!res.success) { console.error('重跑失败:', res.error); process.exit(1) }
  console.log('重跑成功:', res.data)
}

async function seedDemo() {
  const res = await request('GET', '/api/demo/seed')
  if (!res.success) { console.error('种子失败:', res.error); process.exit(1) }
  console.log('演示数据:', res.data)
}

async function resetDemo() {
  const res = await request('GET', '/api/demo/reset')
  if (!res.success) { console.error('重置失败:', res.error); process.exit(1) }
  console.log('演示数据已重置:', res.data)
}

async function getRerunCommand(recordId) {
  const res = await request('GET', `/api/records/${recordId}/rerun-command`)
  if (!res.success) { console.error('获取失败:', res.error); process.exit(1) }
  console.log('重跑命令:\n' + res.data.command)
}

function printHelp() {
  console.log(`
  室内导航信标校准 CLI

  用法:
    beacon list [--status <状态>]           列出校准记录
    beacon show <记录ID>                    查看记录详情
    beacon import <JSON文件路径>            导入校准数据
    beacon photo <记录ID> <照片编号> <操作人>  补录巡检照片
    beacon correct <记录ID> <坐标ID> <操作人> <原因> [修正JSON]  人工修正坐标
    beacon rerun <记录ID> [操作人]           重跑校准
    beacon rerun-cmd <记录ID>               获取可重跑的命令
    beacon demo-seed                        植入演示数据
    beacon demo-reset                       重置演示数据

  状态值: calibrated, pending_review, pending_photo, anomaly

  环境变量:
    API_URL  API 地址 (默认 http://localhost:3001)
  `)
}

const [,, command, ...args] = process.argv

switch (command) {
  case 'list': listRecords(args.find(a => a === '--status') ? args[args.indexOf('--status') + 1] : undefined); break
  case 'show': showDetail(args[0]); break
  case 'import': importData(args[0]); break
  case 'photo': supplementPhoto(args[0], args[1], args[2]); break
  case 'correct': manualCorrect(args[0], args[1], args[2], args[3], args[4]); break
  case 'rerun': rerun(args[0], args[1] || 'system'); break
  case 'rerun-cmd': getRerunCommand(args[0]); break
  case 'demo-seed': seedDemo(); break
  case 'demo-reset': resetDemo(); break
  default: printHelp()
}
