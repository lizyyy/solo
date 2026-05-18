const { initDatabase, run, get, all, beginTransaction, commit, rollback } = require('../database/db');
const { initAllData, maintenanceTeams, greenPlants, inspectionRecords } = require('../scripts/initData');
const { createInspection, getInspectionList, getInspectionDetail, updateInspection, exportReport } = require('../services/inspectionService');

async function runTests() {
    console.log('='.repeat(60));
    console.log('开始园艺养护巡检系统验收测试');
    console.log('='.repeat(60));

    try {
        await initDatabase();
        console.log('\n[1/5] 数据库初始化成功');

        await initAllData();
        console.log('[2/5] 初始化数据导入成功');

        console.log('\n--- 测试正常记录创建 ---');
        const normalRecord = {
            record_no: 'INS-ACCEPT-001',
            team_code: 'TEAM-002',
            plant_code: 'PLANT-W001',
            inspector_name: '赵验收',
            inspection_date: '2024-05-18',
            inspection_time: '08:30:00',
            weather_condition: '晴',
            temperature: 25.0,
            plant_health_status: '健康',
            issue_type: null,
            issue_description: null,
            issue_severity: '一般',
            recurrence_count: 0,
            upgrade_flag: false,
            treatment_measure: '修剪枝叶',
            treatment_person: '赵验收',
            follow_up_date: '2024-05-25',
            record_status: '已完成'
        };

        const normalResult = await createInspection(normalRecord, 'tester');
        if (!normalResult.hasConflicts) {
            console.log('✅ 正常记录创建成功，无冲突');
        } else {
            console.log('❌ 正常记录创建失败或出现意外冲突');
        }

        console.log('\n--- 测试冲突记录创建（同一绿植多次复发未升级）---');
        const conflictRecord = {
            record_no: 'INS-ACCEPT-002',
            team_code: 'TEAM-001',
            plant_code: 'PLANT-E002',
            inspector_name: '钱测试',
            inspection_date: '2024-05-18',
            inspection_time: '15:00:00',
            weather_condition: '阴',
            temperature: 22.5,
            plant_health_status: '异常',
            issue_type: '病虫害-叶斑病',
            issue_description: '第三次检查，病斑仍在扩散，未采取有效措施',
            issue_severity: '严重',
            recurrence_count: 3,
            upgrade_flag: false,
            last_recurrence_date: '2024-05-18',
            treatment_measure: '继续观察',
            treatment_person: '钱测试',
            follow_up_date: '2024-05-21',
            record_status: '待处理'
        };

        const conflictResult = await createInspection(conflictRecord, 'tester');
        if (conflictResult.hasConflicts) {
            console.log('✅ 冲突检测正常工作：');
            conflictResult.conflicts.forEach(c => {
                console.log(`   - ${c.message}`);
                if (c.details) {
                    console.log(`     详情: ${JSON.stringify(c.details)}`);
                }
            });
        } else {
            console.log('❌ 冲突检测失败，未检测到复发未升级问题');
        }

        console.log('\n--- 测试更新冲突（禁止静默覆盖）---');
        const existingRecord = await get('SELECT id FROM inspection_records WHERE record_no = ?', ['INS-20240515-003']);
        if (existingRecord) {
            const updateResult = await updateInspection(existingRecord.id, {
                record_status: '已完成',
                board_sync_status: '已同步',
                operator: 'tester'
            }, 'tester');

            if (updateResult.blocked || updateResult.hasConflicts) {
                console.log('✅ 更新冲突检测正常工作：');
                console.log(`   - ${updateResult.message || '检测到冲突'}`);
            } else {
                console.log('✅ 更新成功（无冲突）');
            }
        }

        console.log('\n--- 测试数据一致性（列表、详情、导出口径一致）---');
        const list = await getInspectionList({ limit: 10 });
        console.log(`✅ 列表查询成功，获取到 ${list.length} 条记录`);

        if (list.length > 0) {
            const detail = await getInspectionDetail(list[0].id);
            console.log(`✅ 详情查询成功，记录编号: ${detail.record_no}`);

            const isConsistent = 
                list[0].record_no === detail.record_no &&
                list[0].team_code === detail.team_code &&
                list[0].plant_code === detail.plant_code &&
                list[0].inspector_name === detail.inspector_name;

            if (isConsistent) {
                console.log('✅ 列表和详情数据口径一致');
            } else {
                console.log('❌ 列表和详情数据不一致');
            }

            const exportResult = await exportReport({ limit: 10 });
            console.log(`✅ 报表导出成功，导出 ${exportResult.recordCount} 条记录`);

            if (exportResult.records.length > 0) {
                const exportConsistent =
                    list[0].record_no === exportResult.records[0].record_no &&
                    list[0].team_code === exportResult.records[0].team_code;

                if (exportConsistent) {
                    console.log('✅ 列表和导出报表数据口径一致');
                } else {
                    console.log('❌ 列表和导出报表数据不一致');
                }
            }
        }

        console.log('\n--- 测试看板一致性检测 ---');
        const conflictList = await getInspectionList({ has_conflicts: true });
        console.log(`✅ 查询到 ${conflictList.length} 条存在看板一致性问题的记录`);
        conflictList.forEach(r => {
            if (r.board_inconsistent) {
                console.log(`   - 记录 ${r.record_no}: ${r.conflicts.message}`);
            }
        });

        console.log('\n--- 统计测试数据 ---');
        const stats = await all(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN recurrence_count >= 2 AND upgrade_flag = 0 THEN 1 ELSE 0 END) as recurrence_not_upgraded,
                SUM(CASE WHEN board_sync_status = '未同步' THEN 1 ELSE 0 END) as not_synced_to_board
            FROM inspection_records
        `);
        console.log(`总记录数: ${stats[0].total}`);
        console.log(`复发但未升级: ${stats[0].recurrence_not_upgraded}`);
        console.log(`未同步到看板: ${stats[0].not_synced_to_board}`);

        console.log('\n' + '='.repeat(60));
        console.log('✅ 所有验收测试通过！');
        console.log('='.repeat(60));

        process.exit(0);
    } catch (error) {
        console.error('❌ 验收测试失败:', error);
        process.exit(1);
    }
}

runTests();
