const TestData = (function() {
    const patientCases = [
        {
            name: "典型心肌梗死",
            patient: {
                id: "TEST_001",
                name: "测试患者1",
                age: 65,
                gender: "M",
                vitalSigns: {
                    hr: 110,
                    bp: "180/100",
                    spo2: 92,
                    temp: 37.2,
                    respRate: 24
                },
                chiefComplaint: "持续性胸骨后压榨样疼痛伴大汗2小时",
                allergies: [],
                waitTime: 0,
                medicalHistory: ["高血压", "糖尿病"]
            },
            expectedQueue: "red"
        },
        {
            name: "轻度擦伤",
            patient: {
                id: "TEST_002",
                name: "测试患者2",
                age: 25,
                gender: "F",
                vitalSigns: {
                    hr: 75,
                    bp: "115/75",
                    spo2: 99,
                    temp: 36.8,
                    respRate: 16
                },
                chiefComplaint: "手部轻微擦伤",
                allergies: [],
                waitTime: 5,
                medicalHistory: []
            },
            expectedQueue: "green"
        },
        {
            name: "信息缺失-意识障碍",
            patient: {
                id: "TEST_003",
                name: "测试患者3",
                age: null,
                gender: "M",
                vitalSigns: {
                    hr: 115,
                    bp: null,
                    spo2: 89,
                    temp: null,
                    respRate: null
                },
                chiefComplaint: "被发现意识不清",
                allergies: [],
                waitTime: 0,
                medicalHistory: []
            },
            expectedQueue: "red"
        },
        {
            name: "症状矛盾-高热但一般情况好",
            patient: {
                id: "TEST_004",
                name: "测试患者4",
                age: 30,
                gender: "M",
                vitalSigns: {
                    hr: 88,
                    bp: "120/80",
                    spo2: 99,
                    temp: 40.0,
                    respRate: 16
                },
                chiefComplaint: "发热3天，精神好，饮食正常",
                allergies: [],
                waitTime: 10,
                medicalHistory: []
            },
            expectedQueue: "yellow"
        },
        {
            name: "儿童发热",
            patient: {
                id: "TEST_005",
                name: "测试患者5",
                age: 5,
                gender: "M",
                vitalSigns: {
                    hr: 130,
                    bp: "95/60",
                    spo2: 97,
                    temp: 39.0,
                    respRate: 26
                },
                chiefComplaint: "发热1天，精神差",
                allergies: [],
                waitTime: 5,
                medicalHistory: []
            },
            expectedQueue: "yellow"
        },
        {
            name: "常规产检",
            patient: {
                id: "TEST_006",
                name: "测试患者6",
                age: 28,
                gender: "F",
                vitalSigns: {
                    hr: 78,
                    bp: "110/70",
                    spo2: 99,
                    temp: 36.5,
                    respRate: 16
                },
                chiefComplaint: "孕30周常规产检",
                allergies: [],
                waitTime: 20,
                medicalHistory: ["G1P0"]
            },
            expectedQueue: "green"
        }
    ];

    function runTests() {
        console.log('=== 急诊分诊规则测试 ===\n');
        let passed = 0;
        let failed = 0;

        patientCases.forEach((testCase, index) => {
            const result = TriageRules.triage(testCase.patient);
            const isCorrect = result.correctQueue === testCase.expectedQueue;

            if (isCorrect) {
                passed++;
                console.log(`✓ 测试 ${index + 1}: ${testCase.name}`);
                console.log(`  预期: ${testCase.expectedQueue}, 实际: ${result.correctQueue}`);
            } else {
                failed++;
                console.log(`✗ 测试 ${index + 1}: ${testCase.name}`);
                console.log(`  预期: ${testCase.expectedQueue}, 实际: ${result.correctQueue}`);
                console.log(`  理由: ${result.reasons.join(', ')}`);
            }
            console.log('');
        });

        console.log(`=== 测试结果: ${passed}/${passed + failed} 通过 ===`);
        return { passed, failed, total: passed + failed };
    }

    function testEdgeCases() {
        console.log('=== 边界情况测试 ===\n');

        const missingInfoPatient = {
            id: "EDGE_001",
            name: "信息缺失测试",
            age: null,
            gender: "M",
            vitalSigns: {
                hr: 100,
                bp: null,
                spo2: null,
                temp: 38.0,
                respRate: null
            },
            chiefComplaint: "腹痛",
            allergies: [],
            waitTime: 5,
            medicalHistory: []
        };

        const validation = LevelLoader.validatePatient(missingInfoPatient);
        console.log('信息缺失检测:', validation.hasMissingInfo ? '是' : '否');
        console.log('缺失字段:', validation.issues.filter(i => i.severity === 'warning').map(i => i.field));

        const result = TriageRules.triage(missingInfoPatient);
        console.log('分诊结果:', result.correctQueue);
        console.log('警告:', result.warnings);
        console.log('');

        const contradictionPatient = {
            id: "EDGE_002",
            name: "症状矛盾测试",
            age: 60,
            gender: "M",
            vitalSigns: {
                hr: 95,
                bp: "200/60",
                spo2: 97,
                temp: 40.0,
                respRate: 8
            },
            chiefComplaint: "高热但精神如常",
            allergies: [],
            waitTime: 3,
            medicalHistory: []
        };

        const validation2 = LevelLoader.validatePatient(contradictionPatient);
        console.log('症状矛盾检测:', validation2.hasContradiction ? '是' : '否');

        const result2 = TriageRules.triage(contradictionPatient);
        console.log('分诊结果:', result2.correctQueue);
        console.log('警告:', result2.warnings);
    }

    return {
        patientCases,
        runTests,
        testEdgeCases
    };
})();

if (typeof window === 'undefined') {
    global.TriageRules = require('./triageRules.js');
    global.LevelLoader = require('./levelLoader.js');
    global.TestData = TestData;
}
