const LevelLoader = (function() {
    const SAMPLE_LEVEL = {
        id: "level_001",
        name: "夜班第一关",
        description: "急诊室夜班开始了，5位患者正在等待分诊",
        timeLimit: 180,
        patients: [
            {
                id: "P001",
                name: "王大爷",
                age: 72,
                gender: "M",
                vitalSigns: {
                    hr: 110,
                    bp: "180/100",
                    spo2: 91,
                    temp: 38.5,
                    respRate: 26
                },
                chiefComplaint: "持续性胸骨后压榨样疼痛2小时，伴大汗淋漓",
                allergies: [],
                waitTime: 0,
                medicalHistory: ["高血压病史10年", "糖尿病5年"]
            },
            {
                id: "P002",
                name: "李女士",
                age: 35,
                gender: "F",
                vitalSigns: {
                    hr: 78,
                    bp: "110/70",
                    spo2: 99,
                    temp: 37.1,
                    respRate: 16
                },
                chiefComplaint: "右手切割伤1小时，出血较多",
                allergies: ["青霉素"],
                waitTime: 5,
                medicalHistory: []
            },
            {
                id: "P003",
                name: "张先生",
                age: 48,
                gender: "M",
                vitalSigns: {
                    hr: 95,
                    bp: "140/88",
                    spo2: 96,
                    temp: 39.2,
                    respRate: 22
                },
                chiefComplaint: "发热伴咳嗽3天，呼吸困难半天",
                allergies: [],
                waitTime: 10,
                medicalHistory: ["吸烟20年"]
            },
            {
                id: "P004",
                name: "刘小宝",
                age: 8,
                gender: "M",
                vitalSigns: {
                    hr: 130,
                    bp: "90/60",
                    spo2: 97,
                    temp: 37.8,
                    respRate: 28
                },
                chiefComplaint: "玩耍时不慎从沙发摔下，哭闹不安伴呕吐1次",
                allergies: [],
                waitTime: 3,
                medicalHistory: []
            },
            {
                id: "P005",
                name: "陈阿姨",
                age: 58,
                gender: "F",
                vitalSigns: {
                    hr: 65,
                    bp: "130/82",
                    spo2: 98,
                    temp: 36.8,
                    respRate: 14
                },
                chiefComplaint: "头晕乏力1周，血压升高就诊",
                allergies: ["磺胺类"],
                waitTime: 8,
                medicalHistory: ["颈椎病", "睡眠障碍"]
            }
        ]
    };

    const MISSING_INFO_LEVEL = {
        id: "level_002",
        name: "夜班第二关-信息缺失",
        description: "患者信息不完整，需要根据现有信息做出判断",
        timeLimit: 150,
        patients: [
            {
                id: "P006",
                name: "赵先生",
                age: null,
                gender: "M",
                vitalSigns: {
                    hr: 120,
                    bp: null,
                    spo2: 88,
                    temp: null,
                    respRate: null
                },
                chiefComplaint: "突发意识障碍，被路人发现倒在地上",
                allergies: [],
                waitTime: 2,
                medicalHistory: []
            },
            {
                id: "P007",
                name: "孙女士",
                age: 42,
                gender: "F",
                vitalSigns: {
                    hr: 82,
                    bp: "125/80",
                    spo2: 100,
                    temp: 37.0,
                    respRate: 18
                },
                chiefComplaint: "孕28周，常规产检",
                allergies: [],
                waitTime: 15,
                medicalHistory: ["G2P1"]
            },
            {
                id: "P008",
                name: "周大爷",
                age: 76,
                gender: "M",
                vitalSigns: {
                    hr: 55,
                    bp: "90/60",
                    spo2: 94,
                    temp: 36.2,
                    respRate: 12
                },
                chiefComplaint: "腹胀腹痛3天，加重伴停止排气排便3小时",
                allergies: [],
                waitTime: 5,
                medicalHistory: ["高血压术后", "长期服用降压药"]
            }
        ]
    };

    const CONTRADICTION_LEVEL = {
        id: "level_003",
        name: "夜班第三关-症状矛盾",
        description: "患者症状存在矛盾，需要仔细分析",
        timeLimit: 150,
        patients: [
            {
                id: "P009",
                name: "吴先生",
                age: 55,
                gender: "M",
                vitalSigns: {
                    hr: 100,
                    bp: "160/95",
                    spo2: 97,
                    temp: 40.1,
                    respRate: 14
                },
                chiefComplaint: "高热39.8℃三天，但精神状态良好，无明显不适",
                allergies: [],
                waitTime: 4,
                medicalHistory: ["体检发现肺部阴影"]
            },
            {
                id: "P010",
                name: "郑女士",
                age: 29,
                gender: "F",
                vitalSigns: {
                    hr: 140,
                    bp: "85/55",
                    spo2: 99,
                    temp: 36.8,
                    respRate: 20
                },
                chiefComplaint: "突发心悸、面色苍白2小时，自述即将去世的恐惧感",
                allergies: [],
                waitTime: 1,
                medicalHistory: ["焦虑症", "甲状腺功能亢进病史"]
            },
            {
                id: "P011",
                name: "黄爷爷",
                age: 82,
                gender: "M",
                vitalSigns: {
                    hr: 68,
                    bp: "135/78",
                    spo2: 95,
                    temp: 37.0,
                    respRate: 16
                },
                chiefComplaint: "轻度嗜睡，呼吸较慢，可被唤醒",
                allergies: ["阿司匹林"],
                waitTime: 6,
                medicalHistory: ["慢性阻塞性肺疾病", "长期使用长效支气管扩张剂"]
            }
        ]
    };

    const LEVELS = [SAMPLE_LEVEL, MISSING_INFO_LEVEL, CONTRADICTION_LEVEL];

    function validatePatient(patient) {
        const issues = [];

        if (!patient.vitalSigns) {
            issues.push({ field: 'vitalSigns', severity: 'error', message: '缺少生命体征信息' });
        }

        if (!patient.chiefComplaint) {
            issues.push({ field: 'chiefComplaint', severity: 'error', message: '缺少主诉信息' });
        }

        const vitals = patient.vitalSigns || {};

        if (vitals.hr === null || vitals.hr === undefined) {
            issues.push({ field: 'hr', severity: 'warning', message: '心率缺失' });
        }
        if (!vitals.bp) {
            issues.push({ field: 'bp', severity: 'warning', message: '血压缺失' });
        }
        if (vitals.spo2 === null || vitals.spo2 === undefined) {
            issues.push({ field: 'spo2', severity: 'warning', message: '血氧饱和度缺失' });
        }
        if (vitals.temp === null || vitals.temp === undefined) {
            issues.push({ field: 'temp', severity: 'warning', message: '体温缺失' });
        }
        if (vitals.respRate === null || vitals.respRate === undefined) {
            issues.push({ field: 'respRate', severity: 'warning', message: '呼吸频率缺失' });
        }

        const hasContradiction = checkContradiction(patient);
        if (hasContradiction) {
            issues.push({ field: 'general', severity: 'info', message: '存在症状矛盾' });
        }

        return {
            valid: !issues.some(i => i.severity === 'error'),
            issues: issues,
            hasMissingInfo: issues.some(i => i.severity === 'warning'),
            hasContradiction: hasContradiction
        };
    }

    function checkContradiction(patient) {
        const vitals = patient.vitalSigns || {};
        const hr = vitals.hr;
        const bp = vitals.bp;
        const temp = vitals.temp;
        const respRate = vitals.respRate;

        if (temp !== null && temp !== undefined && temp >= 39.5 && hr !== null && hr !== undefined && hr < 100) {
            return true;
        }

        if (bp) {
            const [sys, dia] = bp.split('/').map(Number);
            if (sys > 180 && dia < 70) {
                return true;
            }
        }

        if (respRate !== null && respRate !== undefined && respRate < 10 && hr !== null && hr !== undefined && hr > 100) {
            return true;
        }

        return false;
    }

    function loadLevel(levelId) {
        const level = LEVELS.find(l => l.id === levelId);
        if (!level) {
            console.error('Level not found:', levelId);
            return null;
        }

        const enrichedPatients = level.patients.map(patient => {
            const validation = validatePatient(patient);
            return {
                ...patient,
                _validation: validation,
                _hasMissingInfo: validation.hasMissingInfo,
                _hasContradiction: validation.hasContradiction,
                _issues: validation.issues
            };
        });

        return {
            ...level,
            patients: enrichedPatients
        };
    }

    function loadLevelByIndex(index) {
        if (index < 0 || index >= LEVELS.length) {
            console.error('Level index out of range:', index);
            return null;
        }
        return loadLevel(LEVELS[index].id);
    }

    function getAvailableLevels() {
        return LEVELS.map(l => ({ id: l.id, name: l.name, patientCount: l.patients.length }));
    }

    function getLevelCount() {
        return LEVELS.length;
    }

    return {
        loadLevel,
        loadLevelByIndex,
        getAvailableLevels,
        getLevelCount,
        validatePatient,
        SAMPLE_LEVEL
    };
})();
