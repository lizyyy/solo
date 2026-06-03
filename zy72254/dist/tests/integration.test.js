"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
describe('消防疏散路线推演系统 - 集成测试', () => {
    let sim;
    beforeEach(() => {
        sim = new src_1.FireEvacuationSimulation();
    });
    const createTestCADLayers = () => [
        {
            layerName: '消防栓-001',
            originalName: '消防栓-001',
            geometry: [
                { x: 10, y: 20, z: 0 },
                { x: 12, y: 20, z: 0 },
                { x: 12, y: 22, z: 0 },
                { x: 10, y: 22, z: 0 }
            ],
            isOnEvacuationRoute: true,
            hazardLevel: 'medium'
        },
        {
            layerName: '消防栓_001',
            originalName: '消防栓_001',
            geometry: [
                { x: 10, y: 20, z: 0 },
                { x: 12, y: 20, z: 0 },
                { x: 12, y: 22, z: 0 },
                { x: 10, y: 22, z: 0 }
            ],
            isOnEvacuationRoute: true,
            hazardLevel: 'medium'
        },
        {
            layerName: '安全出口-A1',
            originalName: '安全出口-A1',
            geometry: [
                { x: 0, y: 0, z: 0 },
                { x: 2, y: 0, z: 0 },
                { x: 2, y: 3, z: 0 },
                { x: 0, y: 3, z: 0 }
            ],
            isOnEvacuationRoute: true,
            hazardLevel: 'high'
        }
    ];
    test('边界规则：同一障碍物被标了两个名字 - 名称归一化检测', () => {
        expect((0, src_1.normalizeName)('消防栓_001')).toBe((0, src_1.normalizeName)('消防栓-001'));
        expect((0, src_1.normalizeName)('消防栓 001')).toBe((0, src_1.normalizeName)('消防栓001'));
        expect((0, src_1.normalizeName)('FIRE_HYDRANT')).toBe((0, src_1.normalizeName)('fire_hydrant'));
    });
    test('边界规则：同一障碍物被标了两个名字 - 冲突检测', () => {
        const obs1 = (0, src_1.createObstruction)({
            name: '消防栓-001',
            nameSource: 'cad',
            position: { x: 11, y: 21, z: 0 },
            geometry: createTestCADLayers()[0].geometry,
            operator: '测试员'
        });
        const obs2 = (0, src_1.createObstruction)({
            name: '消防栓_001',
            nameSource: 'cad',
            position: { x: 11, y: 21, z: 0 },
            geometry: createTestCADLayers()[1].geometry,
            operator: '测试员'
        });
        const conflict = (0, src_1.checkDuplicateName)(obs1, obs2);
        expect(conflict).not.toBeNull();
        expect(conflict.sharedNames).toContain('消防栓-001');
        expect(conflict.sharedNames).toContain('消防栓_001');
        const result = (0, src_1.detectConflicts)([obs1, obs2], '测试员');
        expect(result.result.hasConflict).toBe(true);
        expect(result.result.conflicts.length).toBe(1);
        expect(result.result.conflicts[0].type).toBe('duplicate_name');
    });
    test('第一步：CAD图层名第一次导入 - 自动检测冲突', async () => {
        const cadLayers = createTestCADLayers();
        const result = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        expect(result.success).toBe(true);
        expect(result.data?.summary.imported).toBe(3);
        expect(result.data?.conflictCount).toBe(1);
        expect(result.requiresReview).toBe(true);
        expect(result.reviewItems?.length).toBe(1);
        const obstructions = result.data.obstructions;
        const pendingReview = obstructions.filter(o => o.status === src_1.ObstructionStatus.PENDING_REVIEW);
        expect(pendingReview.length).toBe(2);
        const allNames = obstructions.flatMap(o => (0, src_1.getAllNames)(o));
        expect(allNames).toContain('消防栓-001');
        expect(allNames).toContain('消防栓_001');
        expect(allNames).toContain('安全出口-A1');
        expect(result.reviewItems[0].conflictingNames).toContain('消防栓-001');
        expect(result.reviewItems[0].description).toBe('同一障碍物被标记了两个名称，需要培训学员复核确认');
    });
    test('重复导入同一批CAD图层名 - 不要把数量翻倍', async () => {
        const cadLayers = createTestCADLayers();
        const result1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const count1 = result1.data.obstructions.length;
        expect(count1).toBe(3);
        const result2 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg', true);
        const count2 = result2.data.obstructions.length;
        expect(count2).toBe(3);
        expect(result2.data.summary.imported).toBe(0);
        expect(result2.data.summary.skipped + result2.data.summary.updated).toBe(3);
    });
    test('航测内业小魏只改了一条备注 - 历史里要能看出改前改后的差别', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const conflictObs = step1.data.obstructions.find(o => o.conflictInfo);
        expect(conflictObs).toBeDefined();
        const oldNotes = conflictObs.notes;
        const updateResult = await sim.updateObstructionNotes(conflictObs.id, '经现场复核，确认为同一消防栓', '小魏');
        expect(updateResult.success).toBe(true);
        const history = sim.getObstructionHistory(conflictObs.id);
        const notesChange = history.find(h => h.fieldName === 'notes');
        expect(notesChange).toBeDefined();
        expect(notesChange.diffDescription).toContain(oldNotes || '（空）');
        expect(notesChange.diffDescription).toContain('经现场复核，确认为同一消防栓');
        expect(notesChange.diffDescription).toContain('→');
    });
    test('第二步：航测内业小魏补看测距仪记录', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const exitObs = step1.data.obstructions.find(o => !o.conflictInfo);
        expect(exitObs).toBeDefined();
        const step2 = await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 },
                notes: '距离疏散门5.0米'
            }
        ], '小魏');
        expect(step2.success).toBe(true);
        expect(step2.data?.validRecords).toBe(1);
        expect(step2.requiresReview).toBe(true);
        expect(step2.warnings?.[0]).toContain('需要培训学员复核');
    });
    test('冲突未解决 - 不能进入第三步', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const step3 = await sim.step3_update3DView(src_1.DisplayMode.VIEW_3D, '培训学员');
        expect(step3.success).toBe(false);
        expect(step3.errors[0].message).toBe('操作无效');
        expect(step3.errors[0].suggestion).toBe('请检查当前状态是否允许执行此操作');
    });
    test('培训学员复核并合并冲突 - 可以进入第三步', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const conflicts = step1.data.obstructions.filter(o => o.conflictInfo);
        expect(conflicts.length).toBe(2);
        const resolveResult = await sim.resolvePendingConflict(conflicts[0].id, conflicts[1].id, src_1.ConflictResolution.MERGE, '培训学员', '消防栓001');
        expect(resolveResult.success).toBe(true);
        expect(resolveResult.data?.merged).toBe(true);
        expect(resolveResult.data?.primary.canonicalName).toBe('消防栓001');
        expect(resolveResult.data?.secondary.status).toBe(src_1.ObstructionStatus.DUPLICATE);
        const mergedNames = (0, src_1.getAllNames)(resolveResult.data.primary);
        expect(mergedNames).toContain('消防栓-001');
        expect(mergedNames).toContain('消防栓_001');
        expect(mergedNames).toContain('消防栓001');
        expect(resolveResult.data.primary.cadLayers.length).toBe(2);
        const exitObs = step1.data.obstructions.find(o => o.aliases[0].name === '安全出口-A1');
        await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 },
                notes: '距离疏散门5.0米'
            }
        ], '小魏');
        expect(sim.canProceedToNextStage()).toBe(true);
        const step3 = await sim.step3_update3DView(src_1.DisplayMode.VIEW_3D, '培训学员');
        expect(step3.success).toBe(true);
        expect(step3.data?.itemCount).toBeGreaterThan(0);
    });
    test('3D视图点击 - 能回到CAD图层名或测距仪记录', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const conflicts = step1.data.obstructions.filter(o => o.conflictInfo);
        await sim.resolvePendingConflict(conflicts[0].id, conflicts[1].id, src_1.ConflictResolution.MERGE, '培训学员', '消防栓001');
        const exitObs = step1.data.obstructions.find(o => o.aliases[0].name === '安全出口-A1');
        await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 },
                notes: '距离疏散门5.0米'
            }
        ], '小魏');
        await sim.step3_update3DView(src_1.DisplayMode.VIEW_3D, '培训学员');
        const detailResult = await sim.selectItemForReview(exitObs.id, 'obstruction');
        expect(detailResult.success).toBe(true);
        const detail = detailResult.data.detail;
        const sourceTrace = detailResult.data.sourceTrace;
        expect(detail.allNames).toContain('安全出口-A1');
        expect(sourceTrace.cadLayers.length).toBe(1);
        expect(sourceTrace.cadLayers[0].layerName).toBe('安全出口-A1');
        expect(sourceTrace.cadLayers[0].importSource).toBe('B栋三楼.dwg');
        expect(sourceTrace.rangefinderRecords.length).toBe(1);
        expect(sourceTrace.rangefinderRecords[0].distance).toBe(5.0);
        expect(sourceTrace.rangefinderRecords[0].measuredBy).toBe('小魏');
        expect(sourceTrace.nameHistory.length).toBe(1);
    });
    test('图表展示 - 先服务复核', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const conflicts = step1.data.obstructions.filter(o => o.conflictInfo);
        await sim.resolvePendingConflict(conflicts[0].id, conflicts[1].id, src_1.ConflictResolution.MERGE, '培训学员', '消防栓001');
        const exitObs = step1.data.obstructions.find(o => o.aliases[0].name === '安全出口-A1');
        await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 },
                notes: '距离疏散门5.0米'
            }
        ], '小魏');
        const step3 = await sim.step3_update3DView(src_1.DisplayMode.CHART, '培训学员');
        expect(step3.success).toBe(true);
        const chartData = step3.data?.chartData;
        expect(chartData.title).toBe('障碍物危险等级分布');
        expect(chartData.dataSource).toContain('高危');
        expect(chartData.dataSource).toContain('中危');
        const dataPoint = chartData.dataPoints[0];
        expect(dataPoint.sourceRef).toBeDefined();
        expect(dataPoint.sourceRef.cadLayerName || dataPoint.sourceRef.rangefinderId).toBeDefined();
    });
    test('错误提示 - 说人话，不吐内部字段名', async () => {
        const cadLayers = createTestCADLayers();
        await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const result = await sim.step2_supplementRangefinder([
            {
                obstructionId: 'non_existent_id',
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 }
            }
        ], '小魏');
        expect(result.success).toBe(false);
        expect(result.errors[0].message).not.toMatch(/obstruction_id|foreign_key|not found/i);
        expect(result.errors[0].message).toBe('找不到指定的数据');
        expect(result.errors[0].suggestion).toBe('请刷新页面或检查数据是否已被删除');
        const { formatErrorForDisplay } = require('../src/core/ErrorHandler');
        const formatted = formatErrorForDisplay(result.errors[0]);
        expect(formatted.content).toContain('障碍物');
        expect(formatted.content).toContain('non_existent_id');
        expect(formatted.timestamp).toBeDefined();
    });
    test('完整三步流程 - 碰到冲突留给培训学员复核', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        expect(step1.requiresReview).toBe(true);
        expect(step1.reviewItems).toBeDefined();
        expect(step1.nextStage).toBeDefined();
        const state1 = sim.getState();
        expect(state1.currentStage).not.toBe('completed');
        const conflicts = step1.data.obstructions.filter(o => o.conflictInfo);
        expect(conflicts.length).toBeGreaterThan(0);
        for (const item of step1.reviewItems) {
            expect(item.description).toBe('同一障碍物被标记了两个名称，需要培训学员复核确认');
        }
        const resolveResult = await sim.resolvePendingConflict(conflicts[0].id, conflicts[1].id, src_1.ConflictResolution.MANUAL, '培训学员');
        expect(resolveResult.data?.primary.status).toBe(src_1.ObstructionStatus.PENDING_REVIEW);
        const step2 = await sim.step2_supplementRangefinder([], '小魏');
        expect(step2.requiresReview).toBe(true);
        expect(step2.nextStage).toBeUndefined();
        await sim.resolvePendingConflict(conflicts[0].id, conflicts[1].id, src_1.ConflictResolution.MERGE, '培训学员', '消防栓001');
        const exitObs = step1.data.obstructions.find(o => o.aliases[0].name === '安全出口-A1');
        await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 5.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 }
            }
        ], '小魏');
        const step3 = await sim.step3_update3DView(src_1.DisplayMode.VIEW_3D, '培训学员');
        expect(step3.success).toBe(true);
        const finalState = sim.getState();
        expect(finalState.currentStage).toBe('completed');
        expect(finalState.stageHistory.length).toBe(3);
    });
    test('合并回滚 - 撤销错误的合并', async () => {
        const { rollbackMerge } = require('../src/core/BoundaryRules');
        const obs1 = (0, src_1.createObstruction)({
            name: '消防栓-001',
            nameSource: 'cad',
            position: { x: 11, y: 21, z: 0 },
            geometry: createTestCADLayers()[0].geometry,
            operator: '测试员'
        });
        const obs2 = (0, src_1.createObstruction)({
            name: '消防栓_001',
            nameSource: 'cad',
            position: { x: 11, y: 21, z: 0 },
            geometry: createTestCADLayers()[1].geometry,
            operator: '测试员'
        });
        const detectResult = (0, src_1.detectConflicts)([obs1, obs2], '测试员');
        const [a, b] = detectResult.updated;
        const { resolveConflict } = require('../src/core/BoundaryRules');
        const mergeResult = resolveConflict(a, b, src_1.ConflictResolution.MERGE, '测试员', '消防栓001');
        const rollbackResult = rollbackMerge(mergeResult.primary, obs1, obs2, '测试员');
        expect(rollbackResult.primary.aliases.length).toBe(1);
        expect(rollbackResult.secondary.aliases.length).toBe(1);
        expect(rollbackResult.primary.notes).toContain('回滚');
        expect(rollbackResult.primary.conflictInfo).toBeUndefined();
        expect(rollbackResult.secondary.conflictInfo).toBeUndefined();
    });
    test('测距仪数据校验 - 距离与坐标不匹配', async () => {
        const cadLayers = createTestCADLayers();
        const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
        const exitObs = step1.data.obstructions.find(o => !o.conflictInfo);
        const step2 = await sim.step2_supplementRangefinder([
            {
                obstructionId: exitObs.id,
                measuredBy: '小魏',
                distance: 10.0,
                fromPoint: { x: 0, y: 0, z: 0 },
                toPoint: { x: 5, y: 0, z: 0 },
                notes: '故意写错距离'
            }
        ], '小魏');
        expect(step2.data?.invalidRecords).toBe(1);
        expect(step2.errors[0].message).toBe('测距仪记录数据无效');
        expect(step2.errors[0].suggestion).toContain('检查测量距离与坐标是否匹配');
    });
});
//# sourceMappingURL=integration.test.js.map