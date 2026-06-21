/**
 * 地下管廊巡检战 - 验证脚本
 * 
 * 使用方法：
 * 1. 打开 http://localhost:9191
 * 2. 打开浏览器开发者工具 (F12)
 * 3. 切到 Console 面板
 * 4. 复制粘贴本文件全部内容，回车运行
 * 5. 查看输出结果
 * 
 * 验证项：
 * - TEST 1: 复合非冲突导入（groupClaims + records 但无冲突）
 * - TEST 2: 有冲突导入（原有功能回归）
 * - TEST 3: 完整链路：游戏→暂停→继续→结算→历史→导出
 * - TEST 4: 空值/重复/边界记录检测
 */

(function() {
    const results = [];
    const log = (msg) => {
        console.log(`[验证] ${msg}`);
        results.push(msg);
    };
    const pass = (name) => log(`✅ PASS: ${name}`);
    const fail = (name, detail) => log(`❌ FAIL: ${name} - ${detail}`);
    
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    
    async function runTests() {
        console.log('%c地下管廊巡检战 - 验证开始', 'font-size: 16px; font-weight: bold; color: #667eea;');
        console.log('=' .repeat(50));
        
        // ============================================
        // TEST 1: 复合非冲突导入
        // ============================================
        console.log('\n%cTEST 1: 复合非冲突导入', 'font-weight: bold; color: #27ae60;');
        
        try {
            // 切到导入标签
            document.querySelector('[data-tab="import"]').click();
            await delay(300);
            
            // 加载非冲突样例
            document.getElementById('loadNonConflictBtn').click();
            await delay(300);
            
            // 导入
            document.getElementById('importBtn').click();
            await delay(800);
            
            const importResult = document.getElementById('importResult');
            const conflictAlert = document.getElementById('conflictAlert');
            const validationReport = document.getElementById('validationReport');
            const validationItems = validationReport.querySelectorAll('.validation-item');
            const itemTexts = Array.from(validationItems).map(i => i.textContent.trim());
            
            const hasImportResult = !importResult.classList.contains('hidden');
            const noConflictAlert = conflictAlert.classList.contains('hidden');
            const hasNoConflictMsg = itemTexts.some(t => t.includes('未发现冲突'));
            const hasRecordCount = itemTexts.some(t => t.includes('共导入 4 条记录'));
            const hasGroupClaimCheck = itemTexts.some(t => t.includes('共5条'));
            
            if (hasImportResult && noConflictAlert && hasNoConflictMsg && hasRecordCount && hasGroupClaimCheck) {
                pass('复合非冲突导入 - 冲突告警不显示，提示未发现冲突');
            } else {
                fail('复合非冲突导入', 
                    `importResult=${hasImportResult}, conflictAlertVisible=${!noConflictAlert}, ` +
                    `noConflictMsg=${hasNoConflictMsg}, recordCount=${hasRecordCount}`);
            }
        } catch (e) {
            fail('复合非冲突导入', e.message);
        }
        
        // ============================================
        // TEST 2: 有冲突导入（回归）
        // ============================================
        console.log('\n%cTEST 2: 有冲突导入（回归）', 'font-weight: bold; color: #27ae60;');
        
        try {
            // 加载有冲突示例
            document.getElementById('loadSampleBtn').click();
            await delay(300);
            
            // 导入
            document.getElementById('importBtn').click();
            await delay(800);
            
            const conflictAlert = document.getElementById('conflictAlert');
            const conflictItems = document.querySelectorAll('#conflictDetails .conflict-item');
            const validationReport = document.getElementById('validationReport');
            const itemTexts = Array.from(validationReport.querySelectorAll('.validation-item')).map(i => i.textContent.trim());
            
            const alertVisible = !conflictAlert.classList.contains('hidden');
            const conflictCount = conflictItems.length;
            const hasConflictMsg = itemTexts.some(t => t.includes('处群说法与实际数据冲突'));
            const hasEmptyWarning = itemTexts.some(t => t.includes('处空值字段'));
            const hasDuplicateWarning = itemTexts.some(t => t.includes('条重复记录'));
            const hasBoundaryWarning = itemTexts.some(t => t.includes('条边界记录'));
            
            if (alertVisible && conflictCount > 0 && hasConflictMsg && hasEmptyWarning && hasDuplicateWarning && hasBoundaryWarning) {
                pass(`有冲突导入 - 显示${conflictCount}个冲突项，空值/重复/边界检测正常`);
            } else {
                fail('有冲突导入', 
                    `alertVisible=${alertVisible}, conflicts=${conflictCount}, ` +
                    `conflictMsg=${hasConflictMsg}, empty=${hasEmptyWarning}, ` +
                    `duplicate=${hasDuplicateWarning}, boundary=${hasBoundaryWarning}`);
            }
        } catch (e) {
            fail('有冲突导入', e.message);
        }
        
        // ============================================
        // TEST 3: 完整链路：游戏→暂停→继续→结算→历史→导出
        // ============================================
        console.log('\n%cTEST 3: 完整链路：游戏→暂停→继续→结算→历史→导出', 'font-weight: bold; color: #27ae60;');
        
        try {
            // 切到游戏标签
            document.querySelector('[data-tab="game"]').click();
            await delay(300);
            
            // 清历史
            localStorage.removeItem('tunnelPatrol_history');
            
            // 开始游戏
            document.getElementById('startBtn').click();
            await delay(1500);
            
            const pauseBtnVisible = document.getElementById('pauseBtn').style.display !== 'none';
            if (!pauseBtnVisible) {
                fail('游戏启动', '暂停按钮未显示');
            }
            
            // 场景1选B（正确）
            let options = document.querySelectorAll('.option-btn');
            if (options.length < 1) {
                fail('场景渲染', '场景1选项未加载');
            }
            options[1].click(); // B是正确答案
            await delay(1200);
            
            const scoreAfter1 = parseInt(document.getElementById('score').textContent);
            const progressAfter1 = document.getElementById('progress').textContent;
            
            // 暂停
            document.getElementById('pauseBtn').click();
            await delay(500);
            
            const pauseScreenVisible = !document.getElementById('pauseScreen').classList.contains('hidden');
            const scenarioHidden = document.getElementById('scenarioScreen').classList.contains('hidden');
            const scoreAtPause = document.getElementById('score').textContent;
            const progressAtPause = document.getElementById('progress').textContent;
            
            // 等2秒验证暂停期间时间不流逝
            await delay(2000);
            const scoreStillFrozen = document.getElementById('score').textContent === scoreAtPause;
            const progressStillFrozen = document.getElementById('progress').textContent === progressAtPause;
            
            // 继续
            document.getElementById('resumeBtn').click();
            await delay(500);
            
            const scenarioVisibleAfterResume = !document.getElementById('scenarioScreen').classList.contains('hidden');
            
            // 完成剩余题目
            for (let i = 0; i < 4; i++) {
                options = document.querySelectorAll('.option-btn');
                if (options.length > 0) {
                    options[1].click(); // 都选B
                    await delay(1200);
                }
            }
            
            await delay(1000);
            
            // 验证结算页
            const resultVisible = !document.getElementById('resultScreen').classList.contains('hidden');
            const pauseLogExists = document.getElementById('pauseLogSection') !== null;
            const pauseLogItems = pauseLogExists ? document.querySelectorAll('#pauseLogSection .choice-item').length : 0;
            const finalScore = parseInt(document.getElementById('resultScore').textContent.replace(/[^0-9]/g, ''));
            
            // 验证历史记录
            const history = JSON.parse(localStorage.getItem('tunnelPatrol_history') || '[]');
            const latest = history[0];
            const historyHasPause = latest && latest.pauseCount > 0;
            const historyHasPauseEvents = latest && latest.pauseEvents && latest.pauseEvents.length > 0;
            
            // 验证导出数据
            const exportData = {
                tool: '地下管廊巡检战',
                record: {
                    ...latest,
                    humanReadable: {
                        overall: `本次巡检最终得分${latest.score}分，${latest.passed ? '通过' : '未通过'}考核。`,
                        summary: generateHumanReadableSummary(latest)
                    }
                }
            };
            
            const exportHasTool = exportData.tool === '地下管廊巡检战';
            const exportHasPause = exportData.record.pauseCount > 0;
            const exportHasPauseEvents = exportData.record.pauseEvents && exportData.record.pauseEvents.length > 0;
            const exportHasHumanReadable = !!exportData.record.humanReadable;
            const humanReadableHasPause = exportData.record.humanReadable.summary.includes('暂停次数');
            const exportAllChoicesHaveReasons = latest.choices.every(c => c.reason);
            
            // 验证历史页显示
            document.querySelector('[data-tab="history"]').click();
            await delay(500);
            const historyItems = document.querySelectorAll('.history-item');
            const firstHistoryItem = historyItems[0];
            const details = firstHistoryItem ? firstHistoryItem.querySelector('details') : null;
            if (details) details.open = true;
            await delay(300);
            const historyPageHasPause = details && details.textContent.includes('暂停');
            
            // 汇总判断
            const allPass = 
                pauseBtnVisible &&
                pauseScreenVisible && scenarioHidden &&
                scoreStillFrozen && progressStillFrozen &&
                scenarioVisibleAfterResume &&
                resultVisible && pauseLogExists && pauseLogItems > 0 &&
                history.length > 0 && historyHasPause && historyHasPauseEvents &&
                exportHasTool && exportHasPause && exportHasPauseEvents &&
                exportHasHumanReadable && humanReadableHasPause &&
                exportAllChoicesHaveReasons &&
                historyPageHasPause;
            
            if (allPass) {
                pass('完整链路 - 游戏→暂停→继续→结算→历史→导出 全链路一致');
                console.log(`  - 暂停次数: ${latest.pauseCount}`);
                console.log(`  - 暂停事件: ${latest.pauseEvents.length}条`);
                console.log(`  - 最终得分: ${latest.score}`);
                console.log(`  - 选择记录: ${latest.choices.length}条，全部有原因`);
                console.log(`  - 历史记录: ${history.length}条，含暂停信息`);
                console.log(`  - 导出包含: 工具标识、暂停记录、人话版总结、扣分原因`);
            } else {
                fail('完整链路', 
                    `pauseBtn=${pauseBtnVisible}, pauseScreen=${pauseScreenVisible}, ` +
                    `frozen=${scoreStillFrozen}, resume=${scenarioVisibleAfterResume}, ` +
                    `result=${resultVisible}, pauseLog=${pauseLogExists}, ` +
                    `history=${history.length}, exportTool=${exportHasTool}, ` +
                    `exportPause=${exportHasPause}, humanReadable=${exportHasHumanReadable}`);
            }
        } catch (e) {
            fail('完整链路', e.message);
            console.error(e);
        }
        
        // ============================================
        // TEST 4: 空值/重复/边界记录检测
        // ============================================
        console.log('\n%cTEST 4: 空值/重复/边界记录检测', 'font-weight: bold; color: #27ae60;');
        
        try {
            // 切回导入页，加载有冲突示例（包含空值重复边界）
            document.querySelector('[data-tab="import"]').click();
            await delay(300);
            
            document.getElementById('loadSampleBtn').click();
            await delay(300);
            document.getElementById('importBtn').click();
            await delay(800);
            
            const validationReport = document.getElementById('validationReport');
            const issues = validationReport.querySelectorAll('.validation-item.warning');
            
            const hasEmptyName = Array.from(issues).some(i => i.textContent.includes('用户名为空'));
            const hasEmptyScore = Array.from(issues).some(i => i.textContent.includes('分数为空'));
            const hasDuplicate = Array.from(issues).some(i => i.textContent.includes('重复'));
            const hasBoundary = Array.from(issues).some(i => i.textContent.includes('边界分数'));
            
            if (hasEmptyName && hasEmptyScore && hasDuplicate && hasBoundary) {
                pass('边界检测 - 空值、重复、边界记录全部检测到');
            } else {
                fail('边界检测', 
                    `emptyName=${hasEmptyName}, emptyScore=${hasEmptyScore}, ` +
                    `duplicate=${hasDuplicate}, boundary=${hasBoundary}`);
            }
        } catch (e) {
            fail('边界检测', e.message);
        }
        
        // ============================================
        // 汇总
        // ============================================
        console.log('\n' + '=' .repeat(50));
        const passCount = results.filter(r => r.startsWith('✅')).length;
        const failCount = results.filter(r => r.startsWith('❌')).length;
        console.log(`%c验证完成：${passCount}/${passCount + failCount} 项通过`, 
            `font-size: 16px; font-weight: bold; color: ${failCount === 0 ? '#27ae60' : '#e74c3c'};`);
        
        if (failCount === 0) {
            console.log('%c🎉 全部验证通过！', 'font-size: 18px; font-weight: bold; color: #27ae60;');
        } else {
            console.log('%c⚠️ 有失败项，请检查上方输出', 'font-size: 14px; color: #e74c3c;');
        }
    }
    
    runTests();
})();