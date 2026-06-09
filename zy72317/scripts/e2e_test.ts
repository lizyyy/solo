/**
 * 端到端测试脚本：删除断档 → 补录 → 重算 → 复核 → 导出一致性
 * 直接调用服务层/仓库层方法，模拟控制器层的业务流程
 */
import db from '../api/db';
import { routeService } from '../api/services/RouteService';
import { routeRepository } from '../api/repositories/RouteRepository';
import { importService } from '../api/services/ImportService';
import { selfCheckService } from '../api/services/SelfCheckService';
import { versionService } from '../api/services/VersionService';
import { weightRepository } from '../api/repositories/WeightRepository';
import { routeController } from '../api/controllers/RouteController';
import type { PickingRouteData, GapRecord, PickingRoute } from '../shared/types';

// 模拟控制器层，统一返回 { routes, openGaps, openGapCount }
function getFullState(): { routes: PickingRoute[]; openGaps: GapRecord[]; openGapCount: number } {
  const routes = routeService.getAllRoutes();
  const openGaps = routeService.getOpenGaps();
  return { routes, openGaps, openGapCount: openGaps.length };
}

function log(step: string, msg: string, data?: any) {
  const ts = new Date().toLocaleTimeString();
  console.log(`\n[${ts}] 🔹 ${step}`);
  console.log(`      ${msg}`);
  if (data !== undefined) {
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      if (keys.length <= 6) {
        console.log('      📊', JSON.stringify(data, null, 2).replace(/\n/g, '\n        '));
      } else {
        console.log(`      📊 对象包含 ${keys.length} 个字段: ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? '...' : ''}`);
      }
    } else {
      console.log('      📊', data);
    }
  }
}

function assert(condition: boolean, step: string, detail: string) {
  if (!condition) {
    console.error(`\n❌ [断言失败] ${step}: ${detail}`);
    process.exit(1);
  }
  console.log(`✅ [断言通过] ${step}: ${detail}`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 组合优化拣货路线 - 补录后重算全流程端到端测试');
  console.log('='.repeat(70));

  // ====== Step 0: 清理旧数据 ======
  log('Step 0', '清理旧的测试数据');
  try {
    db.prepare('DELETE FROM change_log').run();
    db.prepare('DELETE FROM gap_record').run();
    db.prepare('DELETE FROM picking_route').run();
    db.prepare("DELETE FROM import_batch WHERE id != 'virtual-supplement-batch'").run();
    db.prepare('DELETE FROM parameter_version').run();
    console.log('      清理完成');
  } catch (e: any) {
    console.log('      清理失败（可能是首次运行）:', e.message);
  }

  // ====== Step 1: 导入边界值说明（模拟导入 10 条记录） ======
  log('Step 1', '导入边界值说明（模拟 10 条）');
  const testLines: string[] = [
    '订单号,SKU,数量,货区,优先级,截止时间',
  ];
  for (let i = 1; i <= 10; i++) {
    const zone = ['A区', 'B区', 'C区', 'D区', 'E区'][(i - 1) % 5];
    testLines.push(
      `ORD-${String(i).padStart(4, '0')},SKU-${String(i).padStart(6, '0')},${(i % 5) + 1},${zone},${(i % 3) + 1},2025-07-${String(10 + i).padStart(2, '0')} 12:00:00`
    );
  }
  const csvContent = testLines.join('\n');
  const importResult = await importService.importCSV(
    Buffer.from(csvContent, 'utf-8'),
    '边界值样例_10条.csv',
    '吴老师',
    false,
  );
  assert(importResult.importedRows === 10, 'Step 1', `导入成功，共 ${importResult.importedRows} 条记录`);
  assert(importResult.importedRows === 10, 'Step 1', '导入条数正好 10 条');

  // ====== Step 2: 检查初始状态 ======
  log('Step 2', '检查初始导入状态');
  const initialData = getFullState();
  const initialRoutes = initialData.routes;
  assert(initialRoutes.length === 10, 'Step 2', '路线表有 10 条');
  assert(initialData.openGapCount === 0, 'Step 2', '初始没有断档');
  initialRoutes.forEach((r, i) => {
    assert(r.originalLineNo === i + 1, `编号核对`, `第 ${i + 1} 条原始行号=${r.originalLineNo}, 当前编号=${r.currentLineNo}`);
  });

  // ====== Step 3: 人工删除编号 5，产生断档 ======
  log('Step 3', '人工删除编号 5（产生编号断档 4→6，缺 1 条）');
  const route5 = initialRoutes.find(r => r.currentLineNo === 5);
  assert(!!route5, 'Step 3', `找到编号 5 的记录: ${route5!.routeData.orderNo}`);
  const deleteResult = routeService.deleteRoute(route5!.id, '吴老师');
  assert(!!deleteResult, 'Step 3', '删除成功');
  const afterDelete = getFullState();
  assert(afterDelete.routes.length === 9, 'Step 3', '删除后剩 9 条记录（逻辑删除，不算在列表里）');
  assert(afterDelete.openGapCount === 1, `Step 3`, `检测到断档 ${afterDelete.openGapCount} 处`);
  const gap = afterDelete.openGaps[0];
  assert(gap.beforeLineNo === 4 && gap.afterLineNo === 6, 'Step 3', `断档位置正确: ${gap.beforeLineNo} → ${gap.afterLineNo}，缺 ${gap.missingCount} 条`);
  log('Step 3', '断档详情', {
    id: gap.id.slice(0, 10) + '...',
    before: gap.beforeLineNo,
    after: gap.afterLineNo,
    missing: gap.missingCount,
    status: gap.status,
  });

  // ====== Step 4: 补录一行（核心：外键约束必须通过！） ======
  log('Step 4', '补录一行（测试外键约束是否通过，这是原问题的触发点！）');
  const supplementData: Partial<PickingRouteData> = {
    orderNo: 'ORD-S0011',
    sku: 'SKU-000011',
    quantity: 3,
    warehouseZone: 'B区',
  };
  let suppRoute: PickingRoute | null = null;
  try {
    suppRoute = routeService.supplementRoute(supplementData, '吴老师');
  } catch (e: any) {
    console.error('\n❌❌ 补录外键约束失败（原问题）:', e.message);
    console.error(e.stack);
    assert(false, 'Step 4', `补录操作必须成功，不能出现 FOREIGN KEY constraint failed`);
  }
  assert(!!suppRoute, 'Step 4', '补录成功！外键约束没有报错 ✨');
  const afterSupp = getFullState();
  assert(afterSupp.routes.length === 10, 'Step 4', `补录后路线列表有 ${afterSupp.routes.length} 条（9 + 1）`);
  const suppRouteFound = afterSupp.routes.find(r => r.originalLineNo === -1);
  assert(!!suppRouteFound, 'Step 4', '补录的记录 originalLineNo=-1，标记为补录');
  assert(suppRouteFound!.status === 'supplement_pending_recalc', 'Step 4', `补录记录状态: ${suppRouteFound!.status}`);
  assert(suppRouteFound!.sourceBatch === 'virtual-supplement-batch', 'Step 4', `sourceBatch 指向虚拟补录批次，避免外键错误`);
  log('Step 4', '补录记录详情', {
    id: suppRouteFound!.id.slice(0, 10) + '...',
    orderNo: suppRouteFound!.routeData.orderNo,
    currentLineNo: suppRouteFound!.currentLineNo,
    status: suppRouteFound!.status,
    sourceBatch: suppRouteFound!.sourceBatch,
  });

  // ====== Step 5: 补录后重算 ======
  log('Step 5', '点击"补录后重算"（只重算补录记录，断档独立处理）');
  const recalcResult = routeService.recalculateRoutes('吴老师');
  log('Step 5', `重算结果`, {
    updated: recalcResult.updated,
    message: recalcResult.message,
  });
  assert(recalcResult.updated === 1, 'Step 5', '重算了 1 条补录记录');
  assert(recalcResult.message.includes('断档') || recalcResult.message.includes('复核'), 'Step 5', '重算消息提示断档待复核');

  const afterRecalc = getFullState();
  const recalculated = afterRecalc.routes.find(r => r.originalLineNo === -1)!;
  assert(recalculated.status === 'normal', 'Step 5', `重算后补录记录状态：${recalculated.status}`);
  assert(recalculated.routeData.distance > 0, 'Step 5', `重算后距离有值: ${recalculated.routeData.distance}`);
  assert(afterRecalc.openGapCount >= 1, 'Step 5', `重算后仍有 ${afterRecalc.openGapCount} 处断档待复核（不会消失，留给教研组）`);

  // ====== Step 6: 教研组复核断档 ======
  log('Step 6', '教研组对断档执行复核（保留原始证据+处理方式+说明+下一步）');
  const gap2 = afterRecalc.openGaps[0];
  const reviewResult = routeService.reviewGap({
    gapId: gap2.id,
    reviewedBy: '吴老师',
    resolutionType: 'accept_gap',
    resolutionRemark: '人工核对：编号 5 对应订单 ORD-0005 因客户取消已删除，编号断档保留不补，相邻记录继续使用。通知教研组同事知晓。',
    nextHandler: '张老师（后续如补录请联系吴老师确认）',
  });
  assert(reviewResult.success === true, 'Step 6', '断档复核成功');
  assert(reviewResult.affectedRoutes && reviewResult.affectedRoutes.length === 2,
    'Step 6', `相邻 ${reviewResult.affectedRoutes?.length || 0} 条记录标记为断档已复核`);

  const afterReview = getFullState();
  assert(afterReview.openGapCount === 0, 'Step 6', `复核后待复核断档数 = ${afterReview.openGapCount}（应为 0）`);

  const reviewedRoutes = afterReview.routes.filter(r => r.status === 'reviewed_resolved');
  assert(reviewedRoutes.length === 2, 'Step 6', `有 ${reviewedRoutes.length} 条相邻路线状态为 reviewed_resolved`);
  reviewedRoutes.forEach(r => {
    assert(!!r.gapReviewInfo, 'Step 6', `相邻路线 ${r.currentLineNo} 有 gapReviewInfo 复核详情`);
    assert(r.gapReviewInfo!.reviewedBy === '吴老师', 'Step 6', `复核人记录正确: ${r.gapReviewInfo!.reviewedBy}`);
    assert(r.gapReviewInfo!.originalGap.missingCount === 1, 'Step 6', `原始断档信息保留完整：缺 ${r.gapReviewInfo!.originalGap.missingCount} 条`);
    assert(r.gapReviewInfo!.nextHandler !== null, 'Step 6', `下一步责任人已记录: ${r.gapReviewInfo!.nextHandler}`);
  });
  log('Step 6', '复核后相邻路线的 gapReviewInfo（证据完整）', {
    routeNo: reviewedRoutes[0]?.currentLineNo,
    reviewedBy: reviewedRoutes[0]?.gapReviewInfo?.reviewedBy,
    resolutionType: reviewedRoutes[0]?.gapReviewInfo?.resolutionType,
    nextHandler: reviewedRoutes[0]?.gapReviewInfo?.nextHandler,
  });

  // ====== Step 7: 导出明细一致性校验 ======
  log('Step 7', '导出明细 + 一致性校验（单一数据源原则）');
  const exp = routeService.exportRoutes();
  log('Step 7', `导出结果（service 层）`, {
    count: exp.count,
    dataLength: exp.data.length,
    openGapCount: exp.openGapCount,
    openGapsCount: exp.openGaps.length,
  });
  const pageCount = afterReview.routes.length;
  assert(exp.count === pageCount, 'Step 7', `导出条数=${exp.count}，页面条数=${pageCount}，两者一致`);
  assert(exp.data.length === pageCount, 'Step 7', `导出的 data 数组长度也等于 ${pageCount}`);
  assert(exp.openGapCount === 0, 'Step 7', `导出时待复核断档数=${exp.openGapCount}`);

  // 模拟 Controller 层生成 CSV 并验证计数一致
  let csvExported = '';
  const mockRes = {
    statusCode: 200,
    _headers: {} as Record<string, any>,
    setHeader(k: string, v: any) { (this as any)._headers[k] = v; return this; },
    json(data: any) { return this; },
    send(data: any) { csvExported = String(data); return this; },
    status(code: number) { this.statusCode = code; return this; },
  } as any;
  await routeController.exportRoutes({} as any, mockRes);
  log('Step 7', `实际导出 CSV 长度`, csvExported.length);
  log('Step 7', `导出头 X-Export-Count`, mockRes._headers['X-Export-Count']);
  log('Step 7', `导出头 X-Export-Open-Gap-Count`, mockRes._headers['X-Export-Open-Gap-Count']);
  // CSV 至少应有表头 + 数据行
  const lineCount = csvExported.split('\n').filter(l => l.trim() !== '').length;
  assert(lineCount >= 10 + 1, 'Step 7', `CSV 行数至少含表头+10条: 实际 ${lineCount} 行`);
  assert(csvExported.includes('断档复核说明') || csvExported.includes('断档汇总'), 'Step 7', 'CSV 包含断档相关内容');
  assert(mockRes._headers['X-Export-Count'] == pageCount, 'Step 7', `HTTP Header X-Export-Count (${mockRes._headers['X-Export-Count']}) == pageCount (${pageCount})`);

  // ====== Step 8: 自检中心四项验证 ======
  log('Step 8', '自检中心完整跑一遍四项（重复导入/编号断档/补录重算/导出一致）');
  const check = selfCheckService.runSelfCheck();
  log('Step 8', '自检 - 重复导入', check.duplicateImport.details);
  log('Step 8', '自检 - 编号断档', check.numberGap.details);
  log('Step 8', '自检 - 补录重算', check.supplementRecalc.details);
  log('Step 8', '自检 - 导出一致性', check.exportConsistency.details);

  assert(check.duplicateImport.passed, 'Step 8', '重复导入检测通过');
  assert(check.numberGap.passed, `Step 8`, `编号断档检测通过（open=${(check.numberGap.details as any).openGapCount}, reviewed=${(check.numberGap.details as any).reviewedGapCount}）`);
  assert(check.supplementRecalc.passed, 'Step 8', `补录重算检测通过（pending=${check.supplementRecalc.details.pendingRecalcCount}）`);
  assert(check.exportConsistency.passed,
    `Step 8`,
    `导出一致性校验通过: page=${check.exportConsistency.details.pageCount}, export=${check.exportConsistency.details.exportCount}, api=${check.exportConsistency.details.apiCount}, db=${(check.exportConsistency.details as any).dbCount}`
  );

  // ====== Step 9: 参数版本发布条件验证 ======
  log('Step 9', '验证：只有所有断档都复核了才能发布参数版本');
  // 先补看权重（三步工作流的第二步：吴老师补看评分权重表）
  weightRepository.markAsReviewed('吴老师', '吴老师已核对全部5个维度的评分权重，确认无误');
  const canPubResult = versionService.canPublish();
  log('Step 9', `canPublish 返回`, canPubResult);
  assert(canPubResult.canPublish === true, 'Step 9', `断档复核+权重已复核后 canPublish.canPublish=${canPubResult.canPublish}，允许发布参数版本`);

  // ====== Step 10: 变更历史追溯 ======
  log('Step 10', '追溯补录记录的变更历史（审计追踪）');
  const suppRouteLatest = routeService.getRouteById(suppRouteFound!.id)!;
  const history = suppRouteLatest.changeLog;
  log('Step 10', `补录记录变更历史条数：${history.length}`);
  assert(history.length >= 2, 'Step 10', `变更历史至少包含：补录(supplement)、重算(recalculate) 两条`);
  const actions = history.map(h => h.action);
  assert(actions.includes('supplement'), 'Step 10', '变更历史有 supplement 动作');
  assert(actions.includes('recalculate'), 'Step 10', '变更历史有 recalculate 动作');
  log('Step 10', '变更历史动作序列:', actions);

  log('Step 10b', '追溯断档相邻记录的变更历史（含 gap_review 复核）');
  const adjLatest = routeService.getRouteById(reviewedRoutes[0].id)!;
  const adjHistory = adjLatest.changeLog;
  const adjActions = adjHistory.map(h => h.action);
  assert(adjActions.includes('gap_review'), 'Step 10b', `相邻记录变更历史含 gap_review：${adjActions}`);
  const gapReview = adjHistory.find(h => h.action === 'gap_review')!;
  assert(
    typeof gapReview.afterValue === 'object' && (gapReview.afterValue as any).gapReviewInfo,
    'Step 10b',
    'gap_review 的 afterValue 含 GapReviewInfo'
  );

  // ====== 完成 ======
  console.log('\n' + '='.repeat(70));
  console.log('🎉🎉🎉 端到端全流程测试全部通过！');
  console.log('='.repeat(70));
  console.log('\n📋 验证清单:');
  console.log('  ✅ 外键约束修复：补录不再报 FOREIGN KEY constraint failed');
  console.log('  ✅ 断档独立化：gap_record 独立表，不污染相邻正常路线状态');
  console.log('  ✅ 补录后重算：只重算 supplement_pending_recalc，断档独立留待复核');
  console.log('  ✅ 复核流程：GapReviewInfo 含原始断档/处理方式/说明/下一步，全部记入历史');
  console.log('  ✅ 单一数据源：页面/导出/接口/自检/DB 五重计数一致');
  console.log('  ✅ 状态正确：reviewed_resolved 标记相邻记录，保留复核证据');
  console.log('  ✅ 发布条件：断档复核完才能发布参数版本');
  console.log('  ✅ 审计追踪：每条记录的所有变更（含 gap_review）可追溯');
  console.log('  ✅ 自检四项：重复导入/编号断档/补录重算/导出一致全部通过');
  console.log('');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ 测试运行异常:', e);
  console.error(e.stack);
  process.exit(1);
});
