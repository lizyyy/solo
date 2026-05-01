const Tests = {
    results: [],
    passed: 0,
    failed: 0,

    runAll: function() {
        console.log('=== 开始运行测试 ===');
        this.results = [];
        this.passed = 0;
        this.failed = 0;

        this.testGameState();
        this.testChart();
        this.testScoring();
        this.testStorage();

        this.printResults();
        return {
            passed: this.passed,
            failed: this.failed,
            results: this.results
        };
    },

    assert: function(condition, testName, message) {
        const result = {
            name: testName,
            passed: condition,
            message: message || (condition ? '通过' : '失败')
        };

        this.results.push(result);

        if (condition) {
            this.passed++;
            console.log(`✅ ${testName}: ${result.message}`);
        } else {
            this.failed++;
            console.error(`❌ ${testName}: ${result.message}`);
        }

        return condition;
    },

    assertEqual: function(actual, expected, testName) {
        const condition = actual === expected;
        const message = condition 
            ? `实际值: ${actual}, 期望值: ${expected}`
            : `实际值: ${actual}, 期望值: ${expected}`;
        return this.assert(condition, testName, message);
    },

    testGameState: function() {
        console.log('\n--- 测试 GameState 模块 ---');

        GameState.init();
        this.assertEqual(GameState.getState(), GameState.STATES.MENU, '初始状态应为 MENU');

        const testChart = {
            id: 'test',
            name: '测试谱面',
            notes: [
                { time: 500, type: 'left', id: 'note1' },
                { time: 1000, type: 'right', id: 'note2' }
            ]
        };

        GameState.startGame(testChart);
        this.assertEqual(GameState.getState(), GameState.STATES.PLAYING, '开始游戏后状态应为 PLAYING');
        this.assertEqual(GameState.gameData.currentChart, testChart, '当前谱面应正确设置');

        GameState.pauseGame();
        this.assertEqual(GameState.getState(), GameState.STATES.PAUSED, '暂停后状态应为 PAUSED');

        GameState.resumeGame();
        this.assertEqual(GameState.getState(), GameState.STATES.PLAYING, '恢复后状态应为 PLAYING');

        GameState.finishGame();
        this.assertEqual(GameState.getState(), GameState.STATES.RESULT, '结束后状态应为 RESULT');

        GameState.goToMenu();
        this.assertEqual(GameState.getState(), GameState.STATES.MENU, '返回菜单后状态应为 MENU');
    },

    testChart: function() {
        console.log('\n--- 测试 Chart 模块 ---');

        const builtInCharts = Chart.getBuiltInCharts();
        this.assert(builtInCharts.length >= 3, '内置谱面数量应至少为3');

        const beginnerChart = Chart.getChartById('beginner');
        this.assert(beginnerChart !== undefined, '应能获取 beginner 谱面');
        this.assertEqual(beginnerChart.name, '新手入门', 'beginner 谱面名称应正确');

        const validNote = { time: 500, type: 'left', id: 'test' };
        this.assert(Chart.isValidNote(validNote), '有效音符应通过验证');

        const invalidNote1 = { time: -100, type: 'left' };
        this.assert(!Chart.isValidNote(invalidNote1), '时间为负的音符应无效');

        const invalidNote2 = { time: 500, type: 'invalid' };
        this.assert(!Chart.isValidNote(invalidNote2), '类型无效的音符应无效');

        const chartData = {
            id: 'test_chart',
            name: '测试谱面',
            bpm: 120,
            beatInterval: 0.5,
            notes: [
                { time: 500, type: 'left', id: 'n1' },
                { time: 1000, type: 'down', id: 'n2' },
                { time: 1500, type: 'up', id: 'n3' },
                { time: 2000, type: 'right', id: 'n4' }
            ]
        };

        const parsedChart = Chart.parseChart(chartData);
        this.assert(parsedChart !== null, '谱面解析应成功');
        this.assertEqual(parsedChart.notes.length, 4, '解析后的音符数量应正确');

        const notesInRange = Chart.getNotesInRange(parsedChart, 800, 1600);
        this.assertEqual(notesInRange.length, 2, '时间范围内的音符数量应正确');

        const simulator = Chart.createBeatSimulator(parsedChart);
        this.assert(simulator !== null, '节拍模拟器应创建成功');

        const beatsPassed = simulator.update(1000);
        this.assert(beatsPassed >= 0, '节拍更新应返回有效数值');
    },

    testScoring: function() {
        console.log('\n--- 测试 Scoring 模块 ---');

        Scoring.init(10);
        const initialStats = Scoring.getStats();
        this.assertEqual(initialStats.score, 0, '初始分数应为0');
        this.assertEqual(initialStats.combo, 0, '初始连击应为0');
        this.assertEqual(initialStats.totalNotes, 10, '总音符数应正确设置');

        const perfectJudgement = Scoring.calculateJudgement(1000, 1000);
        this.assertEqual(perfectJudgement, 'perfect', '完全准时应为 Perfect');

        const goodJudgement = Scoring.calculateJudgement(1000, 1075);
        this.assertEqual(goodJudgement, 'good', '75ms误差应为 Good');

        const nullJudgement = Scoring.calculateJudgement(1000, 1200);
        this.assertEqual(nullJudgement, null, '200ms误差应无判定');

        Scoring.init(3);
        
        const testNotes = [
            { time: 500, type: 'left', id: 'n1' },
            { time: 1000, type: 'down', id: 'n2' },
            { time: 1500, type: 'right', id: 'n3' }
        ];

        Scoring.setActiveNotes(testNotes);

        const hitResult1 = Scoring.handleHit(testNotes[0], 500, 'left');
        this.assertEqual(hitResult1, 'perfect', '正确击中应为 Perfect');

        const stats1 = Scoring.getStats();
        this.assertEqual(stats1.combo, 1, '击中后连击应为1');
        this.assertEqual(stats1.perfectCount, 1, 'Perfect计数应为1');

        const hitResult2 = Scoring.handleHit(testNotes[1], 1050, 'down');
        this.assertEqual(hitResult2, 'good', '50ms误差应为 Good');

        const stats2 = Scoring.getStats();
        this.assertEqual(stats2.combo, 2, '连击应为2');
        this.assertEqual(stats2.goodCount, 1, 'Good计数应为1');

        Scoring.handleMiss(testNotes[2].id);
        const stats3 = Scoring.getStats();
        this.assertEqual(stats3.combo, 0, 'Miss后连击应重置为0');
        this.assertEqual(stats3.missCount, 1, 'Miss计数应为1');

        Scoring.init(4);
        for (let i = 0; i < 4; i++) {
            const note = { time: (i + 1) * 500, type: 'left', id: `n${i}` };
            Scoring.setActiveNotes([note]);
            Scoring.handleHit(note, (i + 1) * 500, 'left');
        }

        const stats4 = Scoring.getStats();
        this.assertEqual(stats4.maxCombo, 4, '最高连击应为4');
        this.assert(stats4.score > 0, '分数应大于0');

        const accuracy = Scoring.getAccuracy();
        this.assertEqual(accuracy, 100, '全Perfect准确率应为100%');

        const grade = Scoring.getGrade();
        this.assertEqual(grade, 'S', '100%准确率应为S级');

        this.assert(Scoring.isAllPerfect(), '全Perfect应返回true');
        this.assert(Scoring.isFullCombo(), '全连应返回true');
        this.assert(Scoring.isCleared(), '应判定为通关');
    },

    testStorage: function() {
        console.log('\n--- 测试 Storage 模块 ---');

        const available = Storage.isAvailable();
        this.assert(typeof available === 'boolean', 'localStorage可用性应返回布尔值');

        if (available) {
            const testKey = '__test_key__';
            const testData = { value: 'test', number: 42 };

            const saveResult = Storage.save(testKey, testData);
            this.assert(saveResult, '保存数据应成功');

            const loadedData = Storage.load(testKey);
            this.assertEqual(loadedData.value, 'test', '加载的数据值应正确');
            this.assertEqual(loadedData.number, 42, '加载的数据数字应正确');

            Storage.remove(testKey);
            const afterRemove = Storage.load(testKey, 'default');
            this.assertEqual(afterRemove, 'default', '删除后应返回默认值');

            const chartId = 'test_chart_score';
            const initialHighScore = Storage.getHighScore(chartId);
            this.assertEqual(initialHighScore, 0, '新谱面最高分应为0');

            Storage.saveHighScore(chartId, 5000);
            const highScore1 = Storage.getHighScore(chartId);
            this.assertEqual(highScore1, 5000, '保存的最高分应正确');

            Storage.saveHighScore(chartId, 3000);
            const highScore2 = Storage.getHighScore(chartId);
            this.assertEqual(highScore2, 5000, '较低分数不应覆盖最高分');

            Storage.saveHighScore(chartId, 8000);
            const highScore3 = Storage.getHighScore(chartId);
            this.assertEqual(highScore3, 8000, '更高分数应覆盖最高分');

            const testChart = {
                id: 'test_custom_chart',
                name: '测试自定义谱面',
                bpm: 150,
                beatInterval: 0.4,
                notes: [
                    { time: 500, type: 'up', id: 'n1' }
                ]
            };

            Storage.saveCustomChart(testChart);
            const loadedChart = Storage.getCustomChartById('test_custom_chart');
            this.assert(loadedChart !== undefined, '自定义谱面应能加载');
            this.assertEqual(loadedChart.name, '测试自定义谱面', '谱面名称应正确');

            Storage.deleteCustomChart('test_custom_chart');
            const afterDelete = Storage.getCustomChartById('test_custom_chart');
            this.assertEqual(afterDelete, undefined, '删除后谱面不应存在');
        } else {
            console.log('⚠️ localStorage 不可用，跳过部分存储测试');
        }

        const allCharts = Storage.getAllCharts();
        this.assert(Array.isArray(allCharts.builtIn), '内置谱面应为数组');
        this.assert(Array.isArray(allCharts.custom), '自定义谱面应为数组');
        this.assert(Array.isArray(allCharts.all), '所有谱面应为数组');
    },

    printResults: function() {
        console.log('\n=== 测试结果 ===');
        console.log(`✅ 通过: ${this.passed}`);
        console.log(`❌ 失败: ${this.failed}`);
        console.log(`📊 总计: ${this.results.length}`);
        
        if (this.failed === 0) {
            console.log('\n🎉 所有测试通过！');
        } else {
            console.log('\n⚠️ 部分测试失败，请检查代码。');
        }
    }
};

window.Tests = Tests;

console.log('测试模块已加载。在浏览器控制台运行 Tests.runAll() 执行测试。');
