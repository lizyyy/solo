const GameTests = (function() {
    const tests = [];
    let testResults = {
        passed: 0,
        failed: 0,
        total: 0
    };

    function addTest(name, testFunction) {
        tests.push({
            name: name,
            run: testFunction
        });
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
        }
    }

    function assertNotEqual(actual, expected, message) {
        if (actual === expected) {
            throw new Error(`${message}: 期望不相等, 实际都是 ${actual}`);
        }
    }

    addTest('初始状态测试', function() {
        EmergencyTriageGame.resetGame();
        const state = EmergencyTriageGame.getState();
        
        assertEqual(state.isRunning, false, '游戏初始状态应该为未运行');
        assertEqual(state.isPaused, false, '游戏初始状态应该为未暂停');
        assertEqual(state.score, 0, '初始分数应该为0');
        assertEqual(state.lives, 3, '初始生命值应该为3');
        assertEqual(state.level, 1, '初始等级应该为1');
        assertEqual(state.patients.length, 0, '初始病人队列应该为空');
    });

    addTest('病人创建测试', function() {
        EmergencyTriageGame.resetGame();
        const patientTypes = ['red', 'yellow', 'orange', 'green'];
        
        patientTypes.forEach(type => {
            const patient = EmergencyTriageGame.createPatient(type);
            
            assert(patient.id.length > 0, '病人ID不应该为空');
            assert(patient.name.length > 0, '病人姓名不应该为空');
            assertEqual(patient.type, type, `病人类型应该为 ${type}`);
            assert(patient.symptoms.length > 0, '病人症状不应该为空');
            assert(patient.age >= 18 && patient.age <= 77, `病人年龄应该在合理范围内, 实际: ${patient.age}`);
            assertEqual(patient.isBeingTriaged, false, '病人初始状态不应该在分诊中');
            
            const config = EmergencyTriageGame.getPatientTypes()[type];
            assertEqual(patient.timeRemaining, config.maxTime, `病人初始时间应该等于最大时间`);
            assertEqual(patient.maxTime, config.maxTime, `病人最大时间配置应该正确`);
        });
    });

    addTest('游戏启动测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        const state = EmergencyTriageGame.getState();
        
        assertEqual(state.isRunning, true, '启动后游戏状态应该为运行中');
        assertEqual(state.isPaused, false, '启动后游戏状态应该为未暂停');
        assertEqual(state.score, 0, '启动后分数应该为0');
        
        EmergencyTriageGame.resetGame();
        const resetState = EmergencyTriageGame.getState();
        assertEqual(resetState.isRunning, false, '重置后游戏状态应该为未运行');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('暂停功能测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.togglePause();
        let state = EmergencyTriageGame.getState();
        assertEqual(state.isPaused, true, '第一次切换后应该为暂停状态');
        
        EmergencyTriageGame.togglePause();
        state = EmergencyTriageGame.getState();
        assertEqual(state.isPaused, false, '第二次切换后应该为继续状态');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('病人数量限制测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        const config = EmergencyTriageGame.getConfig();
        
        for (let i = 0; i < config.MAX_PATIENTS + 3; i++) {
            EmergencyTriageGame.spawnPatient();
        }
        
        const state = EmergencyTriageGame.getState();
        assert(state.patients.length <= config.MAX_PATIENTS, 
            `病人数量不应该超过最大限制 ${config.MAX_PATIENTS}`);
        
        EmergencyTriageGame.resetGame();
    });

    addTest('计分系统测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        const patient = EmergencyTriageGame.addTestPatient('green');
        const stateBefore = EmergencyTriageGame.getState();
        
        const patientTypes = EmergencyTriageGame.getPatientTypes();
        const config = patientTypes['green'];
        
        assertEqual(stateBefore.patients.length, 1, '应该有1个病人');
        assertEqual(stateBefore.score, 0, '初始分数为0');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('正确分诊加分测试', function() {
        EmergencyTriageGame.resetGame();
        
        EmergencyTriageGame.startGame();
        
        const patient = EmergencyTriageGame.addTestPatient('yellow');
        const patientId = patient.id;
        
        const gameState = EmergencyTriageGame.getState();
        const originalScore = gameState.score;
        
        EmergencyTriageGame.triagePatient('yellow');
        
        const afterState = EmergencyTriageGame.getState();
        
        assert(afterState.score > originalScore, '正确分诊应该加分');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('错误分诊扣分测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.addTestPatient('red');
        
        const beforeState = EmergencyTriageGame.getState();
        const originalScore = beforeState.score;
        
        EmergencyTriageGame.triagePatient('green');
        
        const afterState = EmergencyTriageGame.getState();
        
        assert(afterState.score <= originalScore, '错误分诊应该扣分或保持0分');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('游戏结束时间耗尽测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.endGame('time');
        
        const state = EmergencyTriageGame.getState();
        assertEqual(state.isRunning, false, '游戏结束后应该为未运行状态');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('游戏结束生命耗尽测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.endGame('lives');
        
        const state = EmergencyTriageGame.getState();
        assertEqual(state.isRunning, false, '游戏结束后应该为未运行状态');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('重复点击同一病人测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.addTestPatient('orange');
        
        const stateBefore = EmergencyTriageGame.getState();
        const countBefore = stateBefore.patients.length;
        
        EmergencyTriageGame.triagePatient('orange');
        
        const stateAfter = EmergencyTriageGame.getState();
        const countAfter = stateAfter.patients.length;
        
        assertEqual(countAfter, countBefore - 1, '分诊后病人数量应该减少');
        
        EmergencyTriageGame.triagePatient('orange');
        
        const stateAfterSecond = EmergencyTriageGame.getState();
        assertEqual(stateAfterSecond.patients.length, countAfter, '对不存在的病人分诊不应该改变状态');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('分诊台资源冲突测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.addTestPatient('green');
        
        const stateBefore = EmergencyTriageGame.getState();
        const scoreBefore = stateBefore.score;
        
        EmergencyTriageGame.triagePatient('green');
        
        EmergencyTriageGame.addTestPatient('green');
        
        const stateAfterFirst = EmergencyTriageGame.getState();
        
        EmergencyTriageGame.triagePatient('green');
        
        const stateAfterSecond = EmergencyTriageGame.getState();
        
        assert(stateAfterSecond.score >= scoreBefore, '资源冲突时不应该扣分');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('危急病人特殊处理测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        const patient = EmergencyTriageGame.addTestPatient('red');
        const stateBefore = EmergencyTriageGame.getState();
        
        assertEqual(stateBefore.stats.criticalPatients, 1, '危急病人应该被统计');
        
        EmergencyTriageGame.triagePatient('red');
        
        const stateAfter = EmergencyTriageGame.getState();
        
        assertEqual(stateAfter.stats.criticalCorrect, 1, '正确处理危急病人应该被统计');
        assert(stateAfter.score > 0, '正确处理危急病人应该加分');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('连击系统测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        EmergencyTriageGame.addTestPatient('green');
        EmergencyTriageGame.triagePatient('green');
        
        let state = EmergencyTriageGame.getState();
        assertEqual(state.combo, 1, '第一次正确分诊连击数应该为1');
        
        EmergencyTriageGame.addTestPatient('yellow');
        EmergencyTriageGame.triagePatient('yellow');
        
        state = EmergencyTriageGame.getState();
        assertEqual(state.combo, 2, '连续正确分诊连击数应该为2');
        
        EmergencyTriageGame.addTestPatient('orange');
        EmergencyTriageGame.triagePatient('green');
        
        state = EmergencyTriageGame.getState();
        assertEqual(state.combo, 0, '错误分诊应该重置连击数');
        
        EmergencyTriageGame.resetGame();
    });

    addTest('分数不应该为负数测试', function() {
        EmergencyTriageGame.resetGame();
        EmergencyTriageGame.startGame();
        
        for (let i = 0; i < 10; i++) {
            EmergencyTriageGame.addTestPatient('red');
            EmergencyTriageGame.triagePatient('green');
        }
        
        const state = EmergencyTriageGame.getState();
        assert(state.score >= 0, `分数不应该为负数, 实际: ${state.score}`);
        
        EmergencyTriageGame.resetGame();
    });

    function runTests() {
        console.log('========== 开始运行游戏测试 ==========');
        console.log('');
        
        testResults = {
            passed: 0,
            failed: 0,
            total: tests.length
        };

        tests.forEach((test, index) => {
            console.log(`测试 ${index + 1}: ${test.name}`);
            
            try {
                test.run();
                console.log('✅ 通过');
                testResults.passed++;
            } catch (error) {
                console.log('❌ 失败:', error.message);
                testResults.failed++;
            }
            
            console.log('');
        });

        console.log('========== 测试结果 ==========');
        console.log(`总测试数: ${testResults.total}`);
        console.log(`通过: ${testResults.passed}`);
        console.log(`失败: ${testResults.failed}`);
        console.log(`通过率: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
        console.log('');

        return testResults;
    }

    function getResults() {
        return { ...testResults };
    }

    window.addEventListener('load', function() {
        console.log('游戏测试模块加载完成');
        console.log('在浏览器控制台输入 GameTests.runTests() 运行测试');
    });

    return {
        runTests: runTests,
        getResults: getResults,
        addTest: addTest
    };
})();
