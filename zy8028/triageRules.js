const TriageRules = (function() {
    const QUEUES = {
        red: { level: 1, name: '红区', priority: 'immediate', waitTime: 0 },
        yellow: { level: 2, name: '黄区', priority: 'emergency', waitTime: 10 },
        green: { level: 3, name: '绿区', priority: 'non-emergency', waitTime: 60 },
        observe: { level: 4, name: '留观', priority: 'observation', waitTime: 30 }
    };

    function triage(patient) {
        const validation = patient._validation || { issues: [], hasMissingInfo: false, hasContradiction: false };
        const vitals = patient.vitalSigns || {};
        const complaint = (patient.chiefComplaint || '').toLowerCase();

        let result = determineTriageLevel(patient, vitals, complaint);
        let reasons = [];
        let penalties = [];
        let warnings = [];

        if (validation.hasMissingInfo) {
            warnings.push('信息缺失：部分数据不可用，采取保守评估策略');
            if (result === 'green') {
                result = 'yellow';
                penalties.push('因信息缺失，降级处理');
            }
        }

        if (validation.hasContradiction) {
            warnings.push('检测到症状矛盾：使用最坏情况假设');
            if (result !== 'red') {
                penalties.push('因症状矛盾，提升优先级');
                result = upgradePriority(result);
            }
        }

        if (patient.allergies && patient.allergies.length > 0) {
            warnings.push(`过敏史：${patient.allergies.join(', ')}`);
        }

        reasons = buildReasons(result, patient, vitals, complaint);

        const points = calculatePoints(result, patient, validation.hasMissingInfo, validation.hasContradiction);

        return {
            correctQueue: result,
            correctLevel: QUEUES[result].level,
            reasons: reasons,
            warnings: warnings,
            penalties: penalties,
            points: points,
            edgeCases: {
                missingInfo: validation.hasMissingInfo,
                contradiction: validation.hasContradiction
            }
        };
    }

    function determineTriageLevel(patient, vitals, complaint) {
        if (isImmediateLifeThreatening(patient, vitals, complaint)) {
            return 'red';
        }

        if (isEmergency(patient, vitals, complaint)) {
            return 'yellow';
        }

        if (isNonEmergency(patient, vitals, complaint)) {
            return 'green';
        }

        return 'observe';
    }

    function isImmediateLifeThreatening(patient, vitals, complaint) {
        if (vitals.spo2 !== null && vitals.spo2 !== undefined && vitals.spo2 < 90) {
            return true;
        }

        if (vitals.hr !== null && vitals.hr !== undefined && (vitals.hr > 140 || vitals.hr < 50)) {
            return true;
        }

        if (vitals.bp) {
            const [sys] = vitals.bp.split('/').map(Number);
            if (sys > 200 || sys < 70) {
                return true;
            }
        }

        if (vitals.respRate !== null && vitals.respRate !== undefined && (vitals.respRate > 35 || vitals.respRate < 8)) {
            return true;
        }

        if (containsChestPain(complaint) && vitals.hr !== null && vitals.hr !== undefined && vitals.hr > 100) {
            return true;
        }

        if (containskeywords(complaint, ['意识障碍', '昏迷', '嗜睡', '呼之不应', '心搏骤停', '休克'])) {
            return true;
        }

        if (containskeywords(complaint, ['大出血', '消化道出血', '咯血', '呕血', '鲜血']) && patient.waitTime > 10) {
            return true;
        }

        if (patient.age !== null && patient.age !== undefined && patient.age > 70) {
            if (containskeywords(complaint, ['跌倒', '摔伤', '外伤'])) {
                return true;
            }
        }

        return false;
    }

    function isEmergency(patient, vitals, complaint) {
        if (vitals.spo2 !== null && vitals.spo2 !== undefined && vitals.spo2 < 94) {
            return true;
        }

        if (vitals.hr !== null && vitals.hr !== undefined && (vitals.hr > 120 || vitals.hr < 60)) {
            return true;
        }

        if (vitals.bp) {
            const [sys, dia] = vitals.bp.split('/').map(Number);
            if (sys > 180 || dia > 110) {
                return true;
            }
        }

        if (vitals.temp !== null && vitals.temp !== undefined && vitals.temp >= 39.5) {
            return true;
        }

        if (vitals.respRate !== null && vitals.respRate !== undefined && (vitals.respRate > 28 || vitals.respRate < 12)) {
            return true;
        }

        if (containskeywords(complaint, ['发热', '感染', '肺炎'])) {
            if (vitals.temp !== null && vitals.temp !== undefined && vitals.temp >= 38.5) {
                return true;
            }
        }

        if (containskeywords(complaint, ['腹痛', '胸痛', '背痛']) && patient.waitTime > 20) {
            return true;
        }

        if (containskeywords(complaint, ['骨折', '撕裂伤', '切割伤', '开放性伤口']) && patient.waitTime > 30) {
            return true;
        }

        if (patient.age !== null && patient.age !== undefined && patient.age < 10) {
            if (containskeywords(complaint, ['呕吐', '哭闹', '摔伤'])) {
                return true;
            }
        }

        if (containskeywords(complaint, ['呼吸困难', '气促', '喘息']) && patient.waitTime > 15) {
            return true;
        }

        return false;
    }

    function isNonEmergency(patient, vitals, complaint) {
        if (vitals.spo2 !== null && vitals.spo2 !== undefined && vitals.spo2 >= 96) {
            if (vitals.hr !== null && vitals.hr !== undefined && vitals.hr >= 60 && vitals.hr <= 100) {
                if (vitals.temp !== null && vitals.temp !== undefined && vitals.temp < 38.5) {
                    if (containskeywords(complaint, ['体检', '复诊', '常规', '配药', '换药'])) {
                        return true;
                    }
                }
            }
        }

        if (containskeywords(complaint, ['头晕', '乏力', '慢性', '常规检查']) && patient.waitTime < 30) {
            return true;
        }

        return false;
    }

    function containsChestPain(complaint) {
        return containskeywords(complaint, ['胸痛', '胸闷', '心前区不适', '心脏不适']);
    }

    function containskeywords(complaint, keywords) {
        return keywords.some(keyword => complaint.includes(keyword.toLowerCase()) || complaint.includes(keyword));
    }

    function upgradePriority(queue) {
        switch (queue) {
            case 'green': return 'yellow';
            case 'yellow': return 'red';
            case 'observe': return 'yellow';
            default: return queue;
        }
    }

    function buildReasons(queue, patient, vitals, complaint) {
        const reasons = [];

        if (vitals.spo2 !== null && vitals.spo2 !== undefined) {
            if (vitals.spo2 < 90) {
                reasons.push(`血氧饱和度危急: ${vitals.spo2}%`);
            } else if (vitals.spo2 < 94) {
                reasons.push(`血氧饱和度偏低: ${vitals.spo2}%`);
            }
        }

        if (vitals.hr !== null && vitals.hr !== undefined) {
            if (vitals.hr > 140 || vitals.hr < 50) {
                reasons.push(`心率异常: ${vitals.hr}次/分`);
            }
        }

        if (vitals.bp) {
            const [sys, dia] = vitals.bp.split('/').map(Number);
            if (sys > 180 || dia > 110) {
                reasons.push(`血压升高: ${vitals.bp}mmHg`);
            } else if (sys > 140) {
                reasons.push(`血压偏高: ${vitals.bp}mmHg`);
            }
        }

        if (vitals.temp !== null && vitals.temp !== undefined) {
            if (vitals.temp >= 39.5) {
                reasons.push(`高热: ${vitals.temp}°C`);
            } else if (vitals.temp >= 38.5) {
                reasons.push(`发热: ${vitals.temp}°C`);
            }
        }

        if (vitals.respRate !== null && vitals.respRate !== undefined) {
            if (vitals.respRate > 30) {
                reasons.push(`呼吸急促: ${vitals.respRate}次/分`);
            }
        }

        if (complaint) {
            reasons.push(`主诉: ${patient.chiefComplaint}`);
        }

        if (patient.age !== null && patient.age !== undefined) {
            if (patient.age > 70) {
                reasons.push(`老年患者: ${patient.age}岁`);
            } else if (patient.age < 10) {
                reasons.push(`儿童患者: ${patient.age}岁`);
            }
        }

        return reasons;
    }

    function calculatePoints(queue, patient, hasMissingInfo, hasContradiction) {
        let basePoints = 100;

        switch (queue) {
            case 'red': basePoints = 150; break;
            case 'yellow': basePoints = 100; break;
            case 'green': basePoints = 80; break;
            case 'observe': basePoints = 90; break;
        }

        if (hasMissingInfo) {
            basePoints *= 1.2;
        }

        if (hasContradiction) {
            basePoints *= 1.3;
        }

        return Math.round(basePoints);
    }

    function evaluateTriage(patient, selectedQueue) {
        const correct = triage(patient);
        const isCorrect = correct.correctQueue === selectedQueue;

        let penalty = 0;
        let penaltyReason = '';

        if (!isCorrect) {
            penalty = 50;
            const correctQueueName = QUEUES[correct.correctQueue].name;
            const selectedQueueName = QUEUES[selectedQueue].name;
            penaltyReason = `正确分诊应为${correctQueueName}，误分至${selectedQueueName}`;
        }

        return {
            isCorrect: isCorrect,
            correctQueue: correct.correctQueue,
            correctLevel: correct.correctLevel,
            reasons: correct.reasons,
            warnings: correct.warnings,
            penalties: correct.penalties,
            edgeCases: correct.edgeCases,
            pointsEarned: isCorrect ? correct.points : 0,
            pointsPenalty: penalty,
            penaltyReason: penaltyReason,
            totalPoints: isCorrect ? correct.points : -penalty
        };
    }

    function getQueueInfo(queue) {
        return QUEUES[queue] || null;
    }

    function getAllQueues() {
        return { ...QUEUES };
    }

    return {
        triage,
        evaluateTriage,
        getQueueInfo,
        getAllQueues,
        QUEUES
    };
})();
