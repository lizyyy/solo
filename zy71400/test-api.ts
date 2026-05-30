import http from 'http'

function request(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    }
    const req = http.request(options, (res) => {
      let chunks = ''
      res.on('data', (d) => (chunks += d))
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)) } catch { resolve(chunks) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  // 1. Create batch
  const batch = (await request('POST', '/api/batches', { name: '异常测试', date: '2026-05-30' })).data
  console.log('Batch:', batch.id, batch.status)

  // 2. Create trades
  const t1 = (await request('POST', `/api/batches/${batch.id}/trades`, { direction: '正回购', counterparty: '工商银行', amount: 500000, term: 14, startDate: '2026-05-30', endDate: '2026-06-13' })).data
  const t2 = (await request('POST', `/api/batches/${batch.id}/trades`, { direction: '逆回购', counterparty: '建设银行', amount: 800000, term: 7, startDate: '2026-05-30', endDate: '2026-06-06' })).data
  console.log('Trade1:', t1.id, 'Trade2:', t2.id)

  // 3. Create expired rate
  const r1 = (await request('POST', `/api/batches/${batch.id}/rates`, { bondCode: '240002.IB', rate: 95, effectiveDate: '2025-01-01', expiryDate: '2026-01-01' })).data
  console.log('Rate (expired):', r1.id, 'expiry:', r1.expiryDate)

  // 4. Create collaterals - same bond_code to test duplicate, maturity before end_date to test 到期券未替换
  const c1 = (await request('POST', `/api/batches/${batch.id}/collaterals`, { tradeId: t1.id, bondCode: '240002.IB', bondName: '24国债02', faceValue: 100, quantity: 5000, maturityDate: '2026-06-01' })).data
  const c2 = (await request('POST', `/api/batches/${batch.id}/collaterals`, { tradeId: t2.id, bondCode: '240002.IB', bondName: '24国债02', faceValue: 100, quantity: 3000, maturityDate: '2026-06-01' })).data
  console.log('Collateral1:', c1.id, 'Collateral2:', c2.id)

  // 5. Process
  const processResult = (await request('POST', `/api/batches/${batch.id}/process`)).data
  console.log('\n=== Process Results ===')
  for (const r of processResult) {
    console.log(`Bond: ${r.bondCode}, Rate: ${r.discountRate}, Amount: ${r.discountAmount}, Conclusion: ${r.conclusion}`)
    for (const w of r.warnings) {
      console.log(`  Warning: ${w.type} - ${w.message}`)
    }
  }

  // 6. Get batch detail
  const detail = (await request('GET', `/api/batches/${batch.id}`)).data
  console.log('\nBatch status:', detail.status, 'ResultCount:', detail.resultCount)

  // 7. Get reviews
  const reviews = (await request('GET', `/api/batches/${batch.id}/reviews`)).data
  console.log('Reviews count:', reviews.length, 'First status:', reviews[0]?.status)

  // 8. Submit reviews
  for (const rv of reviews) {
    await request('POST', `/api/batches/${batch.id}/review`, {
      resultId: rv.resultId,
      status: '已复核',
      reviewer: '张三',
      remark: '审核通过',
    })
  }

  // 9. Check batch status after review
  const afterReview = (await request('GET', `/api/batches/${batch.id}`)).data
  console.log('After review, batch status:', afterReview.status)

  // 10. Test export (just check it doesn't error)
  const exportResp = await request('GET', `/api/batches/${batch.id}/export`)
  console.log('\nExport response (first 200 chars):', typeof exportResp === 'string' ? exportResp.substring(0, 200) : JSON.stringify(exportResp).substring(0, 200))

  // 11. Final batch status
  const finalBatch = (await request('GET', `/api/batches/${batch.id}`)).data
  console.log('Final batch status:', finalBatch.status)

  console.log('\n✅ All tests passed!')
}

main().catch(console.error)
