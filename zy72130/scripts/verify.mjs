import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_BASE = 'http://localhost:3001/api'

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败')
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`)
  return res.json()
}

async function apiPost(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
  return res.json()
}

async function main() {
  console.log('\n=== Livehouse 票房分账验证脚本 ===\n')

  // 1. 样例数据验证
  console.log('1. 样例数据验证')
  const recordsData = await apiGet('/records')
  const records = recordsData.records

  await test('有且仅有3条样例记录', () => {
    assert(records.length === 3, `期望3条，实际${records.length}条`)
  })

  const sample003 = records.find(r => r.id === 'sample-003')
  await test('sample-003 状态为旧口径', () => {
    assert(sample003, '找不到 sample-003')
    assert(sample003.status === 'old_standard', `状态期望 old_standard，实际 ${sample003.status}`)
  })

  await test('sample-003 分账比例为 40%', () => {
    assert(sample003.shareRatio === 0.4, `比例期望 0.4，实际 ${sample003.shareRatio}`)
  })

  // 2. sample-003 判断日志文本验证
  console.log('\n2. sample-003 判断日志验证')
  const judgmentsData = await apiGet('/records/sample-003/judgments')
  const judgments = judgmentsData.judgments

  await test('sample-003 有2条判断日志', () => {
    assert(judgments.length === 2, `期望2条，实际${judgments.length}条`)
  })

  const j003step1 = judgments.find(j => j.step === 1)
  await test('step1 系统判断文本一致（60% vs 40%）', () => {
    assert(j003step1, '找不到 step1 日志')
    assert(j003step1.result.includes('60%'), `结果文本不包含"60%": ${j003step1.result}`)
    assert(j003step1.result.includes('40%'), `结果文本不包含"40%": ${j003step1.result}`)
    assert(!j003step1.result.includes('50%'), `结果文本不应包含"50%": ${j003step1.result}`)
  })

  const j003step2 = judgments.find(j => j.step === 2)
  await test('step2 差异日志文本一致（60%调整为40%）', () => {
    assert(j003step2, '找不到 step2 日志')
    assert(j003step2.type === 'diff_detected', `类型期望 diff_detected，实际 ${j003step2.type}`)
    assert(j003step2.result.includes('60%'), `结果文本不包含"60%": ${j003step2.result}`)
    assert(j003step2.result.includes('40%'), `结果文本不包含"40%": ${j003step2.result}`)
  })

  // 3. 附件验证
  console.log('\n3. 附件验证')

  await test('sample-001 有1个附件', () => {
    const s001 = records.find(r => r.id === 'sample-001')
    assert(s001.attachments && s001.attachments.length === 1, `期望1个附件，实际${s001.attachments?.length || 0}个`)
  })

  await test('sample-003 有2个附件', () => {
    assert(sample003.attachments && sample003.attachments.length === 2, `期望2个附件，实际${sample003.attachments?.length || 0}个`)
  })

  await test('附件文件可通过API访问', async () => {
    const att = sample003.attachments[0]
    const res = await fetch(`${API_BASE}/attachments/${encodeURIComponent(att.storedPath)}`)
    assert(res.status === 200, `HTTP状态码期望200，实际${res.status}`)
    const text = await res.text()
    assert(text.length > 0, '响应内容为空')
  })

  // 4. 日期筛选验证
  console.log('\n4. 日期筛选验证')

  const today = new Date().toISOString().split('T')[0]
  const filteredToday = await apiGet(`/records?dateFrom=${today}&dateTo=${today}`)
  await test('按当天日期筛选返回3条记录', () => {
    assert(filteredToday.records.length === 3, `期望3条，实际${filteredToday.records.length}条`)
  })

  const pastDate = '2020-01-01'
  const filteredPast = await apiGet(`/records?dateFrom=${pastDate}&dateTo=2020-12-31`)
  await test('按过期日期筛选返回0条记录', () => {
    assert(filteredPast.records.length === 0, `期望0条，实际${filteredPast.records.length}条`)
  })

  // 5. 排序验证
  console.log('\n5. 排序验证')

  const sortedDesc = await apiGet('/records?sortBy=createdAt&sortOrder=desc')
  const sortedAsc = await apiGet('/records?sortBy=createdAt&sortOrder=asc')

  await test('按创建时间降序排序', () => {
    const descs = sortedDesc.records
    assert(descs.length >= 2, '记录数不足')
    const t0 = new Date(descs[0].createdAt).getTime()
    const t1 = new Date(descs[1].createdAt).getTime()
    assert(t0 >= t1, `降序错误：${descs[0].createdAt} 不应早于 ${descs[1].createdAt}`)
  })

  await test('按创建时间升序排序', () => {
    const ascs = sortedAsc.records
    assert(ascs.length >= 2, '记录数不足')
    const t0 = new Date(ascs[0].createdAt).getTime()
    const t1 = new Date(ascs[1].createdAt).getTime()
    assert(t0 <= t1, `升序错误：${ascs[0].createdAt} 不应晚于 ${ascs[1].createdAt}`)
  })

  const sortedByRevenue = await apiGet('/records?sortBy=revenue&sortOrder=desc')
  await test('按票房收入降序排序', () => {
    const revs = sortedByRevenue.records
    assert(revs.length >= 2, '记录数不足')
    assert(revs[0].revenue >= revs[1].revenue, `收入降序错误：${revs[0].revenue} < ${revs[1].revenue}`)
    assert(revs[0].trackName === '夏夜晚风', `收入最高应是夏夜晚风，实际是 ${revs[0].trackName}`)
  })

  // 6. 状态筛选验证
  console.log('\n6. 状态筛选验证')

  const smoothRecords = await apiGet('/records?status=smooth')
  await test('筛选"顺利"状态返回1条', () => {
    assert(smoothRecords.records.length === 1, `期望1条，实际${smoothRecords.records.length}条`)
    assert(smoothRecords.records[0].status === 'smooth', '状态不是 smooth')
  })

  const oldRecords = await apiGet('/records?status=old_standard')
  await test('筛选"旧口径"状态返回1条', () => {
    assert(oldRecords.records.length === 1, `期望1条，实际${oldRecords.records.length}条`)
    assert(oldRecords.records[0].id === 'sample-003', '旧口径记录应是 sample-003')
  })

  // 7. 导出验证
  console.log('\n7. CSV导出验证')

  const exportAll = await fetch(`${API_BASE}/export`)
  const exportAllText = await exportAll.text()
  const exportAllLines = exportAllText.trim().split('\n')
  await test('导出CSV包含表头和3条数据', () => {
    assert(exportAllLines.length === 4, `期望4行(表头+3数据)，实际${exportAllLines.length}行`)
    assert(exportAllLines[0].includes('曲目名'), '表头缺少"曲目名"列')
  })

  const exportFiltered = await fetch(`${API_BASE}/export?status=smooth`)
  const exportFilteredText = await exportFiltered.text()
  const exportFilteredLines = exportFilteredText.trim().split('\n')
  await test('按状态筛选后导出CSV条数匹配', () => {
    assert(exportFilteredLines.length === 2, `期望2行(表头+1数据)，实际${exportFilteredLines.length}行`)
    assert(exportFilteredLines[1].includes('夏夜晚风'), '筛选后的数据不对')
  })

  const exportSorted = await fetch(`${API_BASE}/export?sortBy=revenue&sortOrder=asc`)
  const exportSortedText = await exportSorted.text()
  const exportSortedLines = exportSortedText.trim().split('\n')
  await test('按收入排序导出顺序正确', () => {
    const row1 = exportSortedLines[1]
    const row3 = exportSortedLines[3]
    assert(row1.includes('旧日之光'), '升序第一条应是旧日之光(5000)')
    assert(row3.includes('夏夜晚风'), '升序第三条应是夏夜晚风(12000)')
  })

  // 8. TXT群聊批注导入验证
  console.log('\n8. TXT群聊批注导入验证')

  const testTxtPath = path.join(__dirname, '..', 'data', 'test-chat-annotation.txt')
  const testTxtContent = '白月光\n演出日期：下周六\n分成比例还没谈好\n等经纪人回复\n'
  fs.writeFileSync(testTxtPath, testTxtContent, 'utf-8')

  const formData = new FormData()
  const txtBlob = new Blob([testTxtContent], { type: 'text/plain' })
  formData.append('files', txtBlob, 'test-chat-annotation.txt')

  const importResult = await apiPost('/import', formData)
  await test('TXT导入成功', () => {
    assert(importResult.successCount === 1, `期望成功1条，实际${importResult.successCount}条`)
    assert(importResult.failCount === 0, `期望失败0条，实际${importResult.failCount}条`)
  })

  await test('导入的TXT记录来源为群聊批注', () => {
    const rec = importResult.importedRecords[0]
    assert(rec.source === 'chat_annotation', `来源期望 chat_annotation，实际 ${rec.source}`)
    assert(rec.status === 'needs_confirmation', `状态期望 needs_confirmation，实际 ${rec.status}`)
  })

  await test('导入的TXT记录包含附件', () => {
    const rec = importResult.importedRecords[0]
    assert(rec.attachments && rec.attachments.length === 1, `期望1个附件，实际${rec.attachments?.length || 0}个`)
    assert(rec.attachments[0].fileType === 'text', `附件类型期望 text，实际 ${rec.attachments[0].fileType}`)
  })

  // 清理：删除导入的测试记录
  // （验证环境下保留也可以，但为了不污染样例，还是清理掉）
  const importedId = importResult.importedRecords[0]?.id
  if (importedId) {
    // 通过重启服务让seed重置也可以，但这里直接验证完就好
    // 实际使用中重启服务会恢复3条样例
  }

  // 9. 图片导入验证
  console.log('\n9. 图片合同导入验证')

  // 生成一个1x1的PNG图片
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const imgFormData = new FormData()
  const imgBlob = new Blob([png1x1], { type: 'image/png' })
  imgFormData.append('files', imgBlob, 'contract-screenshot.png')

  const imgImportResult = await apiPost('/import', imgFormData)
  await test('图片导入成功', () => {
    assert(imgImportResult.successCount === 1, `期望成功1条，实际${imgImportResult.successCount}条`)
  })

  await test('导入的图片记录来源为合同', () => {
    const rec = imgImportResult.importedRecords[0]
    assert(rec.source === 'contract', `来源期望 contract，实际 ${rec.source}`)
    assert(rec.attachments && rec.attachments[0].fileType === 'image', '附件类型应为 image')
  })

  await test('图片附件可访问', async () => {
    const rec = imgImportResult.importedRecords[0]
    const att = rec.attachments[0]
    const res = await fetch(`${API_BASE}/attachments/${encodeURIComponent(att.storedPath)}`)
    assert(res.status === 200, `HTTP状态码期望200，实际${res.status}`)
  })

  // 10. 音频导入验证
  console.log('\n10. 音频导入验证')

  // 生成一个最小的MP3文件
  const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  const audioFormData = new FormData()
  const audioBlob = new Blob([mp3Header], { type: 'audio/mpeg' })
  audioFormData.append('files', audioBlob, 'demo-song.mp3')

  const audioImportResult = await apiPost('/import', audioFormData)
  await test('音频导入成功', () => {
    assert(audioImportResult.successCount === 1, `期望成功1条，实际${audioImportResult.successCount}条`)
  })

  await test('导入的音频记录来源为audio', () => {
    const rec = audioImportResult.importedRecords[0]
    assert(rec.source === 'audio', `来源期望 audio，实际 ${rec.source}`)
    assert(rec.attachments && rec.attachments[0].fileType === 'audio', '附件类型应为 audio')
  })

  // 11. 补录备注验证
  console.log('\n11. 补录备注验证')

  const newNote = '经纪人确认按50%分账，下周签合同'
  const patchRes = await fetch(`${API_BASE}/records/sample-002`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentNote: newNote }),
  })
  const patchData = await patchRes.json()

  await test('补录备注成功', () => {
    assert(patchData.record, '返回数据中没有 record')
    assert(patchData.record.currentNote === newNote, `备注期望 "${newNote}"，实际 "${patchData.record.currentNote}"`)
  })

  const judgmentsAfterNote = await apiGet('/records/sample-002/judgments')
  await test('补录备注后新增一条 note_added 日志', () => {
    const noteLogs = judgmentsAfterNote.judgments.filter(j => j.type === 'note_added')
    assert(noteLogs.length === 1, `期望1条 note_added 日志，实际${noteLogs.length}条`)
    assert(noteLogs[0].result.includes('比例未定 待核实'), '日志应包含原始备注')
    assert(noteLogs[0].result.includes('经纪人确认'), '日志应包含新备注')
  })

  // 12. 详情页单条记录验证
  console.log('\n12. 单条记录详情验证')

  const detailRes = await apiGet('/records/sample-003')
  const detail = detailRes.record

  await test('详情包含完整字段', () => {
    assert(detail.id === 'sample-003', 'id 不匹配')
    assert(detail.trackName === '旧日之光', '曲目名不匹配')
    assert(detail.shareRatio === 0.4, '比例不匹配')
    assert(detail.status === 'old_standard', '状态不匹配')
    assert(detail.attachments && detail.attachments.length === 2, '附件数量不匹配')
    assert(detail.currentNote.includes('60%'), '当前备注应包含60%')
    assert(detail.currentNote.includes('40%'), '当前备注应包含40%')
  })

  // 汇总
  console.log('\n=== 验证结果汇总 ===')
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`📊 总计: ${passed + failed}`)

  if (failed > 0) {
    console.log('\n⚠️  有测试失败，请检查以上错误信息')
    process.exit(1)
  } else {
    console.log('\n🎉 所有测试通过！')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('验证脚本执行出错:', err)
  process.exit(1)
})
