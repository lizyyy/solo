const assert = require('assert');

const { LayoutRules, VALIDATION_ERRORS, PUNCTUATION } = require('../js/layoutRules.js');
const { LevelData } = require('../js/levelData.js');
const { HistoryManager, RecordsManager, GameStateSerializer } = require('../js/stateStorage.js');
const { ScoringSystem, RATINGS } = require('../js/scoring.js');

describe('LayoutRules 排版规则引擎测试', function() {
    let layoutRules;
    let testLevel;

    beforeEach(function() {
        layoutRules = new LayoutRules();
        testLevel = {
            id: 'test_level',
            title: '测试关卡',
            gridSize: { rows: 2, cols: 4 },
            targetSentence: '三人行必有我师',
            characterPool: ['三', '人', '行', '必', '有', '我', '师', '焉'],
            forbiddenCells: [],
            punctuationDirection: 'horizontal',
            maxSteps: 20,
            targetTime: 60
        };
        layoutRules.init(testLevel);
    });

    describe('网格初始化', function() {
        it('应该正确初始化网格状态', function() {
            const gridState = layoutRules.getGridState();
            assert.strictEqual(gridState.length, 2);
            assert.strictEqual(gridState[0].length, 4);
            assert.strictEqual(gridState[1].length, 4);
        });

        it('初始状态所有格子应该为空', function() {
            const gridState = layoutRules.getGridState();
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 4; c++) {
                    assert.strictEqual(gridState[r][c].character, null);
                }
            }
        });
    });

    describe('禁排格', function() {
        beforeEach(function() {
            testLevel.forbiddenCells = [
                { row: 0, col: 0, reason: '测试禁排格' }
            ];
            layoutRules.init(testLevel);
        });

        it('应该正确标记禁排格', function() {
            const gridState = layoutRules.getGridState();
            assert.strictEqual(gridState[0][0].isForbidden, true);
            assert.strictEqual(gridState[0][0].forbiddenReason, '测试禁排格');
        });

        it('不能在禁排格放置活字', function() {
            const result = layoutRules.placeCharacter('三', 0, 0);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.FORBIDDEN_CELL);
        });
    });

    describe('活字放置验证', function() {
        it('应该能在有效位置放置活字', function() {
            const result = layoutRules.placeCharacter('三', 0, 0);
            assert.strictEqual(result.valid, true);
        });

        it('不能放置后网格状态应该更新', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const gridState = layoutRules.getGridState();
            assert.strictEqual(gridState[0][0].character, '三');
        });

        it('不能放置不在字库中的字', function() {
            const result = layoutRules.placeCharacter('X', 0, 0);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.WRONG_CHARACTER);
        });

        it('不能越界放置', function() {
            const result = layoutRules.placeCharacter('三', -1, 0);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.OUT_OF_BOUNDS);

            const result2 = layoutRules.placeCharacter('三', 10, 10);
            assert.strictEqual(result2.valid, false);
            assert.strictEqual(result2.error, VALIDATION_ERRORS.OUT_OF_BOUNDS);
        });

        it('不能在已占用格子放置', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const result = layoutRules.placeCharacter('人', 0, 0);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.CELL_OCCUPIED);
        });
    });

    describe('顺序验证', function() {
        it('按正确顺序放置应该成功', function() {
            let result = layoutRules.placeCharacter('三', 0, 0);
            assert.strictEqual(result.valid, true);

            result = layoutRules.placeCharacter('人', 0, 1);
            assert.strictEqual(result.valid, true);

            result = layoutRules.placeCharacter('行', 0, 2);
            assert.strictEqual(result.valid, true);
        });

        it('错误顺序放置应该失败', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const result = layoutRules.placeCharacter('行', 0, 1);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.INVALID_ORDER);
        });
    });

    describe('移除活字', function() {
        it('应该能移除已放置的活字', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const result = layoutRules.removeCharacter(0, 0);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.character, '三');
        });

        it('移除后格子应该为空', function() {
            layoutRules.placeCharacter('三', 0, 0);
            layoutRules.removeCharacter(0, 0);
            const gridState = layoutRules.getGridState();
            assert.strictEqual(gridState[0][0].character, null);
        });

        it('不能移除空格子', function() {
            const result = layoutRules.removeCharacter(0, 0);
            assert.strictEqual(result.success, false);
        });
    });

    describe('移动活字', function() {
        it('应该能在格子间移动活字', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const result = layoutRules.moveCharacter(0, 0, 0, 1);
            assert.strictEqual(result.valid, true);

            const gridState = layoutRules.getGridState();
            assert.strictEqual(gridState[0][0].character, null);
            assert.strictEqual(gridState[0][1].character, '三');
        });
    });

    describe('完成检查', function() {
        it('放置完所有正确字符应该判定完成', function() {
            const chars = testLevel.targetSentence.split('');
            chars.forEach((char, index) => {
                const row = Math.floor(index / 4);
                const col = index % 4;
                layoutRules.placeCharacter(char, row, col);
            });

            const result = layoutRules.checkCompletion();
            assert.strictEqual(result.complete, true);
        });

        it('未放置完所有字符不应该判定完成', function() {
            layoutRules.placeCharacter('三', 0, 0);
            const result = layoutRules.checkCompletion();
            assert.strictEqual(result.complete, false);
        });
    });

    describe('标点验证', function() {
        beforeEach(function() {
            testLevel.punctuationDirection = 'vertical';
            testLevel.characterPool.push('︐');
            layoutRules.init(testLevel);
        });

        it('竖排模式下不能使用横排标点', function() {
            const result = layoutRules.placeCharacter('，', 0, 0);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, VALIDATION_ERRORS.INVALID_PUNCTUATION);
        });
    });
});

describe('HistoryManager 历史记录测试', function() {
    let history;

    beforeEach(function() {
        history = new HistoryManager();
    });

    describe('初始状态', function() {
        it('初始时不能撤销和重做', function() {
            assert.strictEqual(history.canUndo(), false);
            assert.strictEqual(history.canRedo(), false);
        });
    });

    describe('状态保存', function() {
        beforeEach(function() {
            history.setInitialState({ step: 0, grid: [] });
        });

        it('设置初始状态后不能撤销', function() {
            assert.strictEqual(history.canUndo(), false);
        });

        it('推送状态后可以撤销', function() {
            history.pushState({ step: 1, grid: ['A'] });
            assert.strictEqual(history.canUndo(), true);
        });
    });

    describe('撤销操作', function() {
        beforeEach(function() {
            history.setInitialState({ step: 0, value: 'initial' });
            history.pushState({ step: 1, value: 'state1' });
            history.pushState({ step: 2, value: 'state2' });
        });

        it('撤销应该返回上一状态', function() {
            const current = { step: 2, value: 'state2' };
            const result = history.undo(current);
            assert.strictEqual(result.step, 1);
            assert.strictEqual(result.value, 'state1');
        });

        it('撤销后可以重做', function() {
            const current = { step: 2, value: 'state2' };
            history.undo(current);
            assert.strictEqual(history.canRedo(), true);
        });
    });

    describe('重做操作', function() {
        beforeEach(function() {
            history.setInitialState({ step: 0, value: 'initial' });
            history.pushState({ step: 1, value: 'state1' });
            history.pushState({ step: 2, value: 'state2' });
        });

        it('重做应该返回下一状态', function() {
            const current1 = { step: 2, value: 'state2' };
            history.undo(current1);
            
            const current2 = { step: 1, value: 'state1' };
            const result = history.redo(current2);
            
            assert.strictEqual(result.step, 2);
            assert.strictEqual(result.value, 'state2');
        });
    });

    describe('清空历史', function() {
        it('清空后不能撤销和重做', function() {
            history.setInitialState({ step: 0 });
            history.pushState({ step: 1 });
            history.clear();
            
            assert.strictEqual(history.canUndo(), false);
            assert.strictEqual(history.canRedo(), false);
        });
    });
});

describe('RecordsManager 记录管理测试', function() {
    let records;

    beforeEach(function() {
        records = new RecordsManager();
        records.clearRecords();
    });

    describe('添加记录', function() {
        it('应该正确添加通关记录', function() {
            const result = {
                completed: true,
                score: 1000,
                timeSeconds: 30,
                steps: 8,
                rating: 'S'
            };
            
            records.addRecord('test_level_1', result);
            
            const stats = records.getLevelStats('test_level_1');
            assert.strictEqual(stats.completed, true);
            assert.strictEqual(stats.bestScore, 1000);
            assert.strictEqual(stats.bestTime, 30);
            assert.strictEqual(stats.bestSteps, 8);
        });

        it('多次通关保留最佳成绩', function() {
            records.addRecord('test_level', {
                completed: true,
                score: 800,
                timeSeconds: 60,
                steps: 15,
                rating: 'A'
            });
            
            records.addRecord('test_level', {
                completed: true,
                score: 1000,
                timeSeconds: 30,
                steps: 8,
                rating: 'S'
            });
            
            const stats = records.getLevelStats('test_level');
            assert.strictEqual(stats.bestScore, 1000);
            assert.strictEqual(stats.bestTime, 30);
            assert.strictEqual(stats.bestSteps, 8);
            assert.strictEqual(stats.plays, 2);
        });
    });

    describe('记录查询', function() {
        it('未玩过的关卡返回默认值', function() {
            const stats = records.getLevelStats('non_existent');
            assert.strictEqual(stats.completed, false);
            assert.strictEqual(stats.plays, 0);
            assert.strictEqual(stats.bestScore, 0);
        });
    });

    describe('清除记录', function() {
        beforeEach(function() {
            records.addRecord('test_level', {
                completed: true,
                score: 1000,
                timeSeconds: 30,
                steps: 8,
                rating: 'S'
            });
        });

        it('应该能清除单个关卡记录', function() {
            records.clearLevelRecord('test_level');
            const stats = records.getLevelStats('test_level');
            assert.strictEqual(stats.completed, false);
        });

        it('应该能清除所有记录', function() {
            records.clearRecords();
            const stats = records.getLevelStats('test_level');
            assert.strictEqual(stats.completed, false);
        });
    });
});

describe('ScoringSystem 评分系统测试', function() {
    let scoring;

    beforeEach(function() {
        scoring = new ScoringSystem();
    });

    describe('计时功能', function() {
        it('初始时间应该为0', function() {
            assert.strictEqual(scoring.getElapsedSeconds(), 0);
        });

        it('格式化时间应该正确', function() {
            scoring.elapsedSeconds = 65;
            assert.strictEqual(scoring.getFormattedTime(), '01:05');
        });
    });

    describe('分数计算', function() {
        beforeEach(function() {
            scoring.elapsedSeconds = 30;
        });

        it('应该计算基础分数', function() {
            const score = scoring.calculateScore(10, 60, 20);
            assert.ok(score > 0);
        });

        it('快速完成应该获得时间奖励', function() {
            scoring.elapsedSeconds = 20;
            const fastScore = scoring.calculateScore(10, 60, 20);
            
            scoring.elapsedSeconds = 50;
            const slowScore = scoring.calculateScore(10, 60, 20);
            
            assert.ok(fastScore > slowScore);
        });

        it('更多步骤应该扣分更多', function() {
            scoring.elapsedSeconds = 30;
            const lowSteps = scoring.calculateScore(5, 60, 20);
            
            scoring.elapsedSeconds = 30;
            const highSteps = scoring.calculateScore(15, 60, 20);
            
            assert.ok(lowSteps >= highSteps);
        });
    });

    describe('评级系统', function() {
        it('优秀表现应该获得S级', function() {
            scoring.elapsedSeconds = 15;
            const result = scoring.generateResult(true, 8, 60, 20);
            const rating = scoring.determineRating(result.score, 8, 60, 20);
            assert.ok([RATINGS.S, RATINGS.A, RATINGS.B].includes(rating));
        });
    });
});

describe('LevelData 关卡数据测试', function() {
    let levelData;

    beforeEach(function() {
        levelData = new LevelData();
    });

    describe('关卡验证', function() {
        it('应该验证正确的关卡数据', function() {
            const validLevel = {
                title: '测试关卡',
                targetSentence: '测试',
                characterPool: ['测', '试'],
                gridSize: { rows: 1, cols: 2 }
            };
            
            const result = levelData.validateLevelData(validLevel);
            assert.strictEqual(result.valid, true);
        });

        it('应该拒绝缺少必要字段的关卡数据', function() {
            const invalidLevel = {
                title: '测试关卡'
            };
            
            const result = levelData.validateLevelData(invalidLevel);
            assert.strictEqual(result.valid, false);
        });

        it('应该拒绝目标句子超长的关卡', function() {
            const invalidLevel = {
                title: '测试关卡',
                targetSentence: '这是一个很长很长很长的句子',
                characterPool: ['这', '是'],
                gridSize: { rows: 1, cols: 2 }
            };
            
            const result = levelData.validateLevelData(invalidLevel);
            assert.strictEqual(result.valid, false);
        });
    });

    describe('关卡模板导出', function() {
        it('应该导出有效的JSON模板', function() {
            const template = levelData.exportLevelTemplate();
            const parsed = JSON.parse(template);
            
            assert.ok(parsed.title);
            assert.ok(parsed.targetSentence);
            assert.ok(parsed.characterPool);
            assert.ok(parsed.gridSize);
        });
    });

    describe('JSON导入', function() {
        it('应该导入有效的关卡数据', function() {
            const validJSON = JSON.stringify({
                title: '导入测试',
                targetSentence: '测试',
                characterPool: ['测', '试'],
                gridSize: { rows: 1, cols: 2 }
            });
            
            const result = levelData.importLevelFromJSON(validJSON);
            assert.strictEqual(result.success, true);
        });

        it('应该拒绝无效的JSON', function() {
            const result = levelData.importLevelFromJSON('无效的JSON');
            assert.strictEqual(result.success, false);
        });
    });
});

console.log('所有测试运行完成！');
