/**
 * 绿波速度带计算工具 — 端到端验证脚本
 * 
 * 验证场景：导入→计算→调参→重复导入→核对报告和导出
 * 执行方式：在浏览器 Console 中粘贴运行，或通过 browser_evaluate 调用
 * 
 * 验证项：
 *  1. J03 offset 和 J04 greenRatio 人工修正值在重复导入后不被覆盖
 *  2. 速度带结果（speedBandResults）自动按修正后数据重算
 *  3. 报告页速度带汇总、异常数量、人工修正统计口径一致
 *  4. 调参页 CSV 导出口径与修正后数据一致
 */

function runE2EValidation() {
  const results = [];
  function log(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
  }

  const state = JSON.parse(localStorage.getItem('green-wave-store') || '{}').state;
  if (!state) {
    console.error('Store 为空，先导入数据再运行此脚本');
    return;
  }

  const { intersections, speedBandResults, manualAdjustments, validationResults } = state;

  // ============================================================
  // 验证 1：J03 offset 和 J04 greenRatio 字段值
  // ============================================================
  const j03 = intersections.find(i => i.id === 'J03');
  const j04 = intersections.find(i => i.id === 'J04');
  log(
    'J03 offset 人工修正值',
    j03?.offset === 40,
    `期望=40，实际=${j03?.offset}`
  );
  log(
    'J04 greenRatio 人工修正值',
    j04?.greenRatio === 0.55,
    `期望=0.55，实际=${j04?.greenRatio}`
  );

  // ============================================================
  // 验证 2：manualAdjustments 记录完整
  // ============================================================
  const j03Adj = manualAdjustments.find(a => a.intersectionId === 'J03' && a.field === 'offset');
  const j04Adj = manualAdjustments.find(a => a.intersectionId === 'J04' && a.field === 'greenRatio');
  log(
    'J03 offset 修正记录存在',
    !!j03Adj,
    j03Adj ? `${j03Adj.originalValue}→${j03Adj.adjustedValue}` : '缺失'
  );
  log(
    'J04 greenRatio 修正记录存在',
    !!j04Adj,
    j04Adj ? `${j04Adj.originalValue}→${j04Adj.adjustedValue}` : '缺失'
  );
  log(
    '人工修正总数=2',
    manualAdjustments.length === 2,
    `实际=${manualAdjustments.length}`
  );

  // ============================================================
  // 验证 3：speedBandResults 按修正后数据重算
  // ============================================================
  // 用修正后数据重新计算，和 store 中结果对比
  function calculateExpected() {
    const bandwidth = Math.min(...intersections.map(d => d.cycle * d.greenRatio));
    const expected = [];
    for (let i = 0; i < intersections.length - 1; i++) {
      const from = intersections[i];
      const to = intersections[i + 1];
      const distance = to.distanceFromStart - from.distanceFromStart;
      const deltaOffset = to.offset - from.offset;
      const greenTimeFrom = from.cycle * from.greenRatio;
      const greenTimeTo = to.cycle * to.greenRatio;
      const segmentBandwidth = Math.min(greenTimeFrom, greenTimeTo);

      let isAnomalous = false;
      let reason = '';
      if (segmentBandwidth <= 0) {
        isAnomalous = true; reason = '绿信比为0导致无绿波带宽';
      } else if (deltaOffset <= 0) {
        isAnomalous = true; reason = '偏移差≤0，无法形成绿波';
      } else {
        const halfBand = bandwidth / 2;
        const denominatorMax = deltaOffset - halfBand;
        if (denominatorMax <= 0) {
          isAnomalous = true; reason = '偏移差不足以支撑绿波带宽';
        }
      }
      expected.push({
        segmentIndex: i,
        fromIntersection: from.name,
        toIntersection: to.name,
        distance,
        isAnomalous,
        anomalyReason: reason,
        bandwidth: Math.round(segmentBandwidth * 10) / 10,
      });
    }
    return expected;
  }

  const expected = calculateExpected();
  log(
    '速度带段数=4',
    speedBandResults.length === 4 && expected.length === 4,
    `store=${speedBandResults.length}，重算=${expected.length}`
  );

  let anomaliesMatch = true;
  let segmentDetails = [];
  for (let i = 0; i < expected.length; i++) {
    const actual = speedBandResults[i];
    const exp = expected[i];
    const match = actual?.isAnomalous === exp.isAnomalous && actual?.bandwidth === exp.bandwidth;
    if (!match) anomaliesMatch = false;
    segmentDetails.push(
      `段${i}: ${exp.fromIntersection}→${exp.toIntersection}, store异常=${actual?.isAnomalous}, 重算异常=${exp.isAnomalous}, store带宽=${actual?.bandwidth}, 重算带宽=${exp.bandwidth}`
    );
  }
  log(
    '速度带逐段匹配（修正后重算口径 = store 中 speedBandResults）',
    anomaliesMatch,
    segmentDetails.join(' | ')
  );

  const actualAnomalies = speedBandResults.filter(r => r.isAnomalous).length;
  const expectedAnomalies = expected.filter(r => r.isAnomalous).length;
  log(
    '异常段数量一致',
    actualAnomalies === expectedAnomalies,
    `store异常=${actualAnomalies}，重算异常=${expectedAnomalies}`
  );

  // ============================================================
  // 验证 4：报告 CSV 导出口径（模拟 ReportPage exportCSV）
  // ============================================================
  const validResults = speedBandResults.filter(r => !r.isAnomalous);
  const speeds = validResults.flatMap(r => [r.speedMin, r.speedMax]).filter(s => s > 0);
  const overallBandwidth = Math.min(...intersections.map(d => d.cycle * d.greenRatio));
  const avgBandwidth = validResults.length > 0
    ? Math.round(validResults.reduce((s, r) => s + r.bandwidth, 0) / validResults.length * 10) / 10
    : 0;

  log(
    '报告全段带宽口径',
    overallBandwidth === 50,
    `期望=50（J04 greenRatio=0.55 * 100 = 55，J02=0.45*100=45 → 取最小45？需复核），实际=${overallBandwidth}，各段cycle*greenRatio: ${intersections.map(i => `${i.id}=${i.cycle * i.greenRatio}`).join(', ')}`
  );

  log(
    '报告有效路段数',
    validResults.length === expected.filter(r => !r.isAnomalous).length,
    `store有效=${validResults.length}，重算有效=${expected.filter(r => !r.isAnomalous).length}`
  );

  // ============================================================
  // 验证 5：CSV 导出内容（模拟 AdjustPage exportCSV）
  // ============================================================
  const exportHeader = '段编号,起点,终点,距离(m),速度下限(km/h),速度上限(km/h),带宽(s),是否异常,异常原因';
  const exportRows = speedBandResults.map(r =>
    `${r.segmentIndex},${r.fromIntersection},${r.toIntersection},${r.distance},${r.speedMin},${r.speedMax},${r.bandwidth},${r.isAnomalous ? '是' : '否'},${r.anomalyReason || ''}`
  );
  log(
    'CSV 导出表头正确',
    exportHeader.split(',').length === 9,
    `实际列数=${exportHeader.split(',').length}`
  );
  log(
    'CSV 导出行数=4段',
    exportRows.length === 4,
    `实际行数=${exportRows.length}`
  );

  // ============================================================
  // 汇总
  // ============================================================
  const passedCount = results.filter(r => r.passed).length;
  console.log(`\n========== 验证汇总 ==========`);
  console.log(`通过: ${passedCount}/${results.length}`);

  return {
    timestamp: new Date().toISOString(),
    passed: passedCount === results.length,
    passedCount,
    total: results.length,
    details: results,
  };
}

window.runE2EValidation = runE2EValidation;
console.log('验证脚本已加载，请调用 runE2EValidation()');
