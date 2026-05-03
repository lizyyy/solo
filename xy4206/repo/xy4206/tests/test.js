class TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    assertTrue(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertCloseEnough(actual, expected, tolerance = 0.001, message) {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected} ±${tolerance}, got ${actual}`);
        }
    }

    async run() {
        console.log('🧪 开始运行测试套件...\n');
        console.log('='.repeat(60));

        for (const test of this.tests) {
            try {
                await test.fn();
                this.passed++;
                console.log(`✅ PASS: ${test.name}`);
            } catch (error) {
                this.failed++;
                console.log(`❌ FAIL: ${test.name}`);
                console.log(`   ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`\n📊 测试结果: ${this.passed} 通过, ${this.failed} 失败`);
        
        if (this.failed === 0) {
            console.log('🎉 所有测试通过!');
        } else {
            console.log('⚠️ 存在失败的测试');
        }

        return { passed: this.passed, failed: this.failed };
    }
}

const suite = new TestSuite();

suite.test('Parser: MIDI转音符名', () => {
    const parser = new Parser();
    suite.assertEqual(parser.midiToNoteName(60), 'C4', 'MIDI 60 should be C4');
    suite.assertEqual(parser.midiToNoteName(69), 'A4', 'MIDI 69 should be A4');
    suite.assertEqual(parser.midiToNoteName(72), 'C5', 'MIDI 72 should be C5');
});

suite.test('Parser: 解析简单JSON乐谱', () => {
    const parser = new Parser();
    const json = JSON.stringify({
        title: 'Test Score',
        composer: 'Test Composer',
        timeSignature: '4/4',
        tempo: 120,
        measures: [
            {
                number: 1,
                notes: [
                    { pitch: 60, velocity: 64, startTime: 0, duration: 1 }
                ]
            }
        ]
    });

    const score = parser.parseScoreJSON(json);
    suite.assertEqual(score.title, 'Test Score', 'Title should match');
    suite.assertEqual(score.tempo, 120, 'Tempo should be 120');
    suite.assertEqual(score.measures.length, 1, 'Should have 1 measure');
    suite.assertEqual(score.measures[0].notes.length, 1, 'Should have 1 note in measure');
});

suite.test('Parser: 解析CSV演奏记录', () => {
    const parser = new Parser();
    const csv = `time,type,pitch,velocity,duration,noteName
0.0,note,60,64,0.5,C4
0.5,note,62,64,0.5,D4`;

    const performance = parser.parsePerformanceCSV(csv);
    suite.assertTrue(performance.notes.length >= 2, 'Should have at least 2 notes');
});

suite.test('Aligner: 简单对齐', () => {
    const aligner = new Aligner();
    const score = {
        title: 'Test',
        composer: 'Test',
        timeSignature: '4/4',
        tempo: 120,
        measures: [
            {
                number: 1,
                timeSignature: '4/4',
                tempo: 120,
                notes: [
                    { pitch: 60, noteName: 'C4', velocity: 64, startTime: 0, duration: 0.5 },
                    { pitch: 62, noteName: 'D4', velocity: 64, startTime: 0.5, duration: 0.5 }
                ],
                pedalEvents: []
            }
        ]
    };

    const performance = {
        notes: [
            { pitch: 60, noteName: 'C4', velocity: 64, startTime: 0.01, duration: 0.49, endTime: 0.5 },
            { pitch: 62, noteName: 'D4', velocity: 64, startTime: 0.52, duration: 0.48, endTime: 1.0 }
        ],
        pedalEvents: [],
        noteOnEvents: [],
        noteOffEvents: []
    };

    const alignment = aligner.align(score, performance);
    suite.assertEqual(alignment.measures.length, 1, 'Should have 1 measure alignment');
    suite.assertEqual(alignment.globalMetrics.totalNotes, 2, 'Should have 2 total notes');
    suite.assertEqual(alignment.globalMetrics.alignedNotes, 2, 'Should have 2 aligned notes');
});

suite.test('Scorer: 正确演奏得高分', () => {
    const scorer = new Scorer();
    const alignment = {
        measures: [
            {
                measureNumber: 1,
                notes: [
                    {
                        status: 'matched',
                        target: { pitch: 60, startTime: 0, absoluteTime: 0 },
                        performance: { pitch: 60, startTime: 0.01, duration: 0.5 },
                        timingDeviation: 0.01,
                        velocityDiff: 0,
                        durationDiff: 0,
                        isEarly: false,
                        isLate: false,
                        isVelocityMismatch: false,
                        isDurationMismatch: false
                    }
                ],
                extraNotes: []
            }
        ],
        globalMetrics: {
            totalNotes: 1,
            alignedNotes: 1,
            missedNotes: 0,
            extraNotes: 0
        }
    };

    const scoreData = { measures: [{ notes: [] }] };
    const analysis = scorer.score(alignment, scoreData);
    
    suite.assertTrue(analysis.totalScore > 90, 'Correct performance should score high');
    suite.assertEqual(analysis.summary.totalNotes, 1, 'Should have 1 total note');
    suite.assertEqual(analysis.summary.missedNotes, 0, 'Should have 0 missed notes');
});

suite.test('Scorer: 漏音扣分', () => {
    const scorer = new Scorer();
    const alignment = {
        measures: [
            {
                measureNumber: 1,
                notes: [
                    {
                        status: 'missed',
                        target: { pitch: 60, startTime: 0, absoluteTime: 0 },
                        performance: null,
                        reason: 'no_match'
                    }
                ],
                extraNotes: []
            }
        ],
        globalMetrics: {
            totalNotes: 1,
            alignedNotes: 0,
            missedNotes: 1,
            extraNotes: 0
        }
    };

    const scoreData = { measures: [{ notes: [] }] };
    const analysis = scorer.score(alignment, scoreData);
    
    suite.assertEqual(analysis.summary.missedNotes, 1, 'Should have 1 missed note');
    suite.assertTrue(analysis.errors.length > 0, 'Should have errors recorded');
});

suite.test('Player: 时间格式化', () => {
    const player = new Player();
    suite.assertEqual(player.formatTime(0), '00:00', '0 seconds should be 00:00');
    suite.assertEqual(player.formatTime(65), '01:05', '65 seconds should be 01:05');
    suite.assertEqual(player.formatTime(122.5), '02:02', '122.5 seconds should be 02:02');
});

suite.test('Storage: ID生成', () => {
    const storage = new Storage();
    const id1 = storage.generateId();
    const id2 = storage.generateId();
    
    suite.assertTrue(id1.length > 0, 'ID should not be empty');
    suite.assertTrue(id1 !== id2, 'IDs should be unique');
});

suite.test('Exporter: 错误类型名称', () => {
    const exporter = new Exporter();
    suite.assertEqual(exporter.getErrorTypeName('missed'), '漏音', 'missed should be 漏音');
    suite.assertEqual(exporter.getErrorTypeName('wrong_pitch'), '错音', 'wrong_pitch should be 错音');
    suite.assertEqual(exporter.getErrorTypeName('timing'), '节奏问题', 'timing should be 节奏问题');
    suite.assertEqual(exporter.getErrorTypeName('slur_break'), '连音断裂', 'slur_break should be 连音断裂');
});

suite.test('Exporter: 严重程度标签', () => {
    const exporter = new Exporter();
    suite.assertEqual(exporter.getSeverityLabel('high'), '严重', 'high should be 严重');
    suite.assertEqual(exporter.getSeverityLabel('medium'), '中等', 'medium should be 中等');
    suite.assertEqual(exporter.getSeverityLabel('low'), '轻微', 'low should be 轻微');
});

suite.test('Scorer: 评分等级', () => {
    const scorer = new Scorer();
    
    let grade = scorer.getScoreGrade(95);
    suite.assertEqual(grade.grade, 'A', '95 should be A');
    suite.assertEqual(grade.label, '优秀', '95 should be 优秀');
    
    grade = scorer.getScoreGrade(85);
    suite.assertEqual(grade.grade, 'B', '85 should be B');
    
    grade = scorer.getScoreGrade(75);
    suite.assertEqual(grade.grade, 'C', '75 should be C');
    
    grade = scorer.getScoreGrade(65);
    suite.assertEqual(grade.grade, 'D', '65 should be D');
    
    grade = scorer.getScoreGrade(55);
    suite.assertEqual(grade.grade, 'F', '55 should be F');
});

suite.test('Parser: 拍号解析', () => {
    const parser = new Parser();
    const aligner = new Aligner();
    
    suite.assertEqual(parser.parseTimeSignature('4/4'), 4, '4/4 should have 4 beats per measure');
    suite.assertEqual(parser.parseTimeSignature('3/4'), 3, '3/4 should have 3 beats per measure');
    suite.assertEqual(parser.parseTimeSignature('6/8'), 6, '6/8 should have 6 beats per measure');
});

suite.test('Aligner: 时间容差配置', () => {
    const aligner = new Aligner();
    suite.assertTrue(aligner.timingTolerance > 0, 'Should have positive timing tolerance');
});

if (typeof window !== 'undefined') {
    window.runTests = () => {
        return suite.run();
    };
    console.log('💡 在控制台输入 runTests() 运行所有测试');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestSuite, suite };
}
