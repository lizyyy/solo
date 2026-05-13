const GameState = {
    IDLE: 'idle',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover'
};

const MEDICINES = [
    { id: 1, name: '阿莫西林胶囊', dosage: '0.5g', category: '抗生素' },
    { id: 2, name: '阿莫西林克拉维酸钾', dosage: '0.625g', category: '抗生素' },
    { id: 3, name: '头孢氨苄胶囊', dosage: '0.25g', category: '抗生素' },
    { id: 4, name: '头孢拉定胶囊', dosage: '0.25g', category: '抗生素' },
    { id: 5, name: '布洛芬缓释胶囊', dosage: '0.3g', category: '解热镇痛' },
    { id: 6, name: '布洛芬片', dosage: '0.2g', category: '解热镇痛' },
    { id: 7, name: '对乙酰氨基酚片', dosage: '0.5g', category: '解热镇痛' },
    { id: 8, name: '奥美拉唑肠溶胶囊', dosage: '20mg', category: '消化系统' },
    { id: 9, name: '泮托拉唑钠肠溶片', dosage: '40mg', category: '消化系统' },
    { id: 10, name: '兰索拉唑肠溶片', dosage: '30mg', category: '消化系统' },
    { id: 11, name: '氯雷他定片', dosage: '10mg', category: '抗过敏' },
    { id: 12, name: '西替利嗪片', dosage: '10mg', category: '抗过敏' },
    { id: 13, name: '地氯雷他定片', dosage: '5mg', category: '抗过敏' },
    { id: 14, name: '二甲双胍片', dosage: '0.5g', category: '糖尿病' },
    { id: 15, name: '格列美脲片', dosage: '2mg', category: '糖尿病' },
    { id: 16, name: '阿卡波糖片', dosage: '50mg', category: '糖尿病' },
    { id: 17, name: '硝苯地平缓释片', dosage: '10mg', category: '高血压' },
    { id: 18, name: '氨氯地平片', dosage: '5mg', category: '高血压' },
    { id: 19, name: '缬沙坦胶囊', dosage: '80mg', category: '高血压' },
    { id: 20, name: '阿托伐他汀钙片', dosage: '10mg', category: '降脂' },
    { id: 21, name: '辛伐他汀片', dosage: '20mg', category: '降脂' },
    { id: 22, name: '阿司匹林肠溶片', dosage: '100mg', category: '抗血小板' },
    { id: 23, name: '氯吡格雷片', dosage: '75mg', category: '抗血小板' },
    { id: 24, name: '甲硝唑片', dosage: '0.2g', category: '抗厌氧菌' },
    { id: 25, name: '替硝唑片', dosage: '0.5g', category: '抗厌氧菌' }
];

const SIMILAR_NAMES = {
    '阿莫西林胶囊': ['阿莫西林克拉维酸钾', '氨苄西林胶囊'],
    '头孢氨苄胶囊': ['头孢拉定胶囊', '头孢克洛胶囊'],
    '布洛芬缓释胶囊': ['布洛芬片', '芬必得'],
    '奥美拉唑肠溶胶囊': ['泮托拉唑钠肠溶片', '兰索拉唑肠溶片'],
    '氯雷他定片': ['西替利嗪片', '地氯雷他定片'],
    '二甲双胍片': ['格列美脲片', '阿卡波糖片'],
    '硝苯地平缓释片': ['氨氯地平片', '非洛地平片'],
    '阿托伐他汀钙片': ['辛伐他汀片', '瑞舒伐他汀片'],
    '阿司匹林肠溶片': ['氯吡格雷片', '替格瑞洛片'],
    '甲硝唑片': ['替硝唑片', '奥硝唑片']
};

const FORBIDDEN_COMBINATIONS = {
    '阿莫西林胶囊': ['甲硝唑片', '酮康唑'],
    '布洛芬缓释胶囊': ['阿司匹林肠溶片', '肝素'],
    '奥美拉唑肠溶胶囊': ['氯吡格雷片', '地西泮'],
    '二甲双胍片': ['华法林', '硝苯地平缓释片'],
    '硝苯地平缓释片': ['西地那非', '红霉素'],
    '阿托伐他汀钙片': ['红霉素', '克拉霉素', '伊曲康唑']
};

const PATIENTS = [
    '张某某', '李某某', '王某某', '赵某某', '陈某某',
    '刘某某', '周某某', '吴某某', '郑某某', '孙某某'
];

class PharmacyGame {
    constructor(options = {}) {
        this.state = GameState.IDLE;
        this.level = 1;
        this.score = 0;
        this.initialLives = options.lives || 3;
        this.lives = this.initialLives;
        this.initialMaxTime = options.maxTime || 60;
        this.maxTime = this.initialMaxTime;
        this.timeRemaining = this.maxTime;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentPrescription = null;
        this.cabinetMedicines = [];
        this.gameHistory = [];
        this.scoreDetails = [];
        this.clickedMedicines = new Set();
        this.timer = null;
        this.roundTransitionTimer = null;
        this.isRoundLocked = false;
        this._onStateChange = options.onStateChange || null;
        this._onPrescriptionChange = options.onPrescriptionChange || null;
        this._onCabinetChange = options.onCabinetChange || null;
        this._onScoreChange = options.onScoreChange || null;
        this._onTimeChange = options.onTimeChange || null;
        this._onLivesChange = options.onLivesChange || null;
        this._onComboChange = options.onComboChange || null;
    }

    _emitStateChange() {
        if (this._onStateChange) {
            this._onStateChange(this.state);
        }
    }

    _emitPrescriptionChange() {
        if (this._onPrescriptionChange) {
            this._onPrescriptionChange(this.currentPrescription);
        }
    }

    _emitCabinetChange() {
        if (this._onCabinetChange) {
            this._onCabinetChange(this.cabinetMedicines, this.clickedMedicines);
        }
    }

    _emitScoreChange() {
        if (this._onScoreChange) {
            this._onScoreChange(this.score);
        }
    }

    _emitTimeChange() {
        if (this._onTimeChange) {
            this._onTimeChange(this.timeRemaining);
        }
    }

    _emitLivesChange() {
        if (this._onLivesChange) {
            this._onLivesChange(this.lives);
        }
    }

    _emitComboChange() {
        if (this._onComboChange) {
            this._onComboChange(this.combo, this.maxCombo);
        }
    }

    start() {
        this._stopTimer();
        this._cancelRoundTransition();
        this.level = 1;
        this.score = 0;
        this.lives = this.initialLives;
        this.maxTime = this.initialMaxTime;
        this.combo = 0;
        this.maxCombo = 0;
        this.timeRemaining = this.maxTime;
        this.gameHistory = [];
        this.scoreDetails = [];
        this.clickedMedicines = new Set();
        this.isRoundLocked = false;
        this.state = GameState.PLAYING;
        this._emitStateChange();
        this._emitScoreChange();
        this._emitTimeChange();
        this._emitLivesChange();
        this._emitComboChange();
        this._generateNewRound();
        this._startTimer();
    }

    pause() {
        if (this.state !== GameState.PLAYING) return false;
        this.state = GameState.PAUSED;
        this._stopTimer();
        this._emitStateChange();
        return true;
    }

    resume() {
        if (this.state !== GameState.PAUSED) return false;
        this.state = GameState.PLAYING;
        this._startTimer();
        this._emitStateChange();
        return true;
    }

    restart() {
        this._stopTimer();
        this.start();
    }

    _startTimer() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            if (this.state === GameState.PLAYING) {
                this.timeRemaining--;
                this._emitTimeChange();
                if (this.timeRemaining <= 0) {
                    this._handleTimeout();
                }
            }
        }, 1000);
    }

    _stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    _cancelRoundTransition() {
        if (this.roundTransitionTimer) {
            clearTimeout(this.roundTransitionTimer);
            this.roundTransitionTimer = null;
        }
    }

    _handleTimeout() {
        if (!this.currentPrescription) return;
        this.combo = 0;
        this._emitComboChange();
        this.lives--;
        this._emitLivesChange();
        const historyEntry = {
            type: 'timeout',
            timestamp: Date.now(),
            prescription: this.currentPrescription,
            message: '时间耗尽，未选择药品'
        };
        this.gameHistory.push(historyEntry);
        this.scoreDetails.push({
            type: 'timeout',
            description: `超时未配药: ${this.currentPrescription.medicine.name}`,
            points: 0
        });
        if (this.lives <= 0) {
            this._gameOver();
        } else {
            this.timeRemaining = this.maxTime;
            this._emitTimeChange();
            this._generateNewRound();
        }
    }

    _generateNewRound() {
        this.isRoundLocked = false;
        this.clickedMedicines = new Set();
        this.currentPrescription = this._generatePrescription();
        this._emitPrescriptionChange();
        this.cabinetMedicines = this._generateCabinet(this.currentPrescription);
        this._emitCabinetChange();
        const historyEntry = {
            type: 'new_round',
            timestamp: Date.now(),
            level: this.level,
            prescription: this.currentPrescription,
            cabinet: [...this.cabinetMedicines]
        };
        this.gameHistory.push(historyEntry);
    }

    _generatePrescription() {
        const medicine = MEDICINES[Math.floor(Math.random() * MEDICINES.length)];
        const patient = PATIENTS[Math.floor(Math.random() * PATIENTS.length)];
        const warnings = this._generateWarnings(medicine);
        return {
            medicine: medicine,
            patient: patient,
            warnings: warnings,
            timestamp: Date.now()
        };
    }

    _generateWarnings(medicine) {
        const warnings = [];
        if (SIMILAR_NAMES[medicine.name]) {
            const similarCount = Math.min(2, SIMILAR_NAMES[medicine.name].length);
            const similar = [...SIMILAR_NAMES[medicine.name]].sort(() => Math.random() - 0.5).slice(0, similarCount);
            if (similar.length > 0) {
                warnings.push({
                    type: 'similar',
                    message: `注意相似药名: ${similar.join('、')}`
                });
            }
        }
        if (FORBIDDEN_COMBINATIONS[medicine.name]) {
            const forbiddenCount = Math.min(2, FORBIDDEN_COMBINATIONS[medicine.name].length);
            const forbidden = [...FORBIDDEN_COMBINATIONS[medicine.name]].sort(() => Math.random() - 0.5).slice(0, forbiddenCount);
            if (forbidden.length > 0) {
                warnings.push({
                    type: 'forbidden',
                    message: `禁忌药品: ${forbidden.join('、')}`
                });
            }
        }
        return warnings;
    }

    _generateCabinet(prescription) {
        const cabinet = [];
        const correctMedicine = {
            ...prescription.medicine,
            isCorrect: true,
            type: 'correct'
        };
        cabinet.push(correctMedicine);
        const similarNames = SIMILAR_NAMES[prescription.medicine.name] || [];
        similarNames.forEach(name => {
            if (cabinet.length >= 8) return;
            const similarMedicine = {
                id: 'similar_' + name,
                name: name,
                dosage: prescription.medicine.dosage,
                category: prescription.medicine.category,
                isCorrect: false,
                type: 'similar'
            };
            cabinet.push(similarMedicine);
        });
        const forbiddenNames = FORBIDDEN_COMBINATIONS[prescription.medicine.name] || [];
        forbiddenNames.forEach(name => {
            if (cabinet.length >= 8) return;
            const forbiddenMedicine = {
                id: 'forbidden_' + name,
                name: name,
                dosage: '0.5g',
                category: '其他',
                isCorrect: false,
                type: 'forbidden'
            };
            cabinet.push(forbiddenMedicine);
        });
        const otherMedicines = MEDICINES.filter(m => m.id !== prescription.medicine.id);
        while (cabinet.length < 8 && otherMedicines.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherMedicines.length);
            const randomMedicine = otherMedicines.splice(randomIndex, 1)[0];
            if (!cabinet.find(m => m.name === randomMedicine.name)) {
                cabinet.push({
                    ...randomMedicine,
                    isCorrect: false,
                    type: 'other'
                });
            }
        }
        return cabinet.sort(() => Math.random() - 0.5);
    }

    selectMedicine(medicineId) {
        if (this.state !== GameState.PLAYING) return { success: false, message: '游戏未进行中' };
        if (this.clickedMedicines.has(medicineId)) {
            return { success: false, message: '该药品已点击过', duplicate: true };
        }
        if (this.isRoundLocked) {
            return { success: false, message: '回合已锁定，正在切换中' };
        }
        this.clickedMedicines.add(medicineId);
        const medicine = this.cabinetMedicines.find(m => m.id === medicineId);
        if (!medicine) {
            return { success: false, message: '药品不存在' };
        }
        const historyEntry = {
            type: 'select',
            timestamp: Date.now(),
            medicine: medicine,
            prescription: this.currentPrescription
        };
        if (medicine.isCorrect) {
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }
            const basePoints = 100;
            const comboBonus = Math.min(this.combo - 1, 5) * 20;
            const timeBonus = Math.floor(this.timeRemaining * 2);
            const totalPoints = basePoints + comboBonus + timeBonus;
            this.score += totalPoints;
            historyEntry.success = true;
            historyEntry.points = totalPoints;
            historyEntry.combo = this.combo;
            this.scoreDetails.push({
                type: 'correct',
                description: `正确配药: ${medicine.name} (连击x${this.combo})`,
                points: totalPoints
            });
            this._emitScoreChange();
            this._emitComboChange();
            const roundsToLevelUp = 5;
            if (this.scoreDetails.filter(d => d.type === 'correct').length % roundsToLevelUp === 0) {
                this.level++;
            }
            this.isRoundLocked = true;
            this._cancelRoundTransition();
            this.roundTransitionTimer = setTimeout(() => {
                this.roundTransitionTimer = null;
                if (this.state === GameState.PLAYING) {
                    this.timeRemaining = this.maxTime;
                    this._emitTimeChange();
                    this._generateNewRound();
                }
            }, 500);
            this.gameHistory.push(historyEntry);
            return { 
                success: true, 
                message: '配药正确！', 
                points: totalPoints,
                combo: this.combo
            };
        } else {
            this.combo = 0;
            this._emitComboChange();
            this.lives--;
            this._emitLivesChange();
            const wrongType = medicine.type;
            let errorMessage = '选择了错误的药品';
            if (wrongType === 'similar') {
                errorMessage = '选择了相似药名的药品！';
            } else if (wrongType === 'forbidden') {
                errorMessage = '选择了禁忌药品！';
            }
            historyEntry.success = false;
            historyEntry.errorType = wrongType;
            historyEntry.message = errorMessage;
            this.scoreDetails.push({
                type: 'wrong',
                description: `${errorMessage}: ${medicine.name}`,
                points: 0
            });
            this.gameHistory.push(historyEntry);
            if (this.lives <= 0) {
                this._gameOver();
            }
            return { 
                success: false, 
                message: errorMessage,
                errorType: wrongType
            };
        }
    }

    _gameOver() {
        this.state = GameState.GAME_OVER;
        this._stopTimer();
        this._cancelRoundTransition();
        this.isRoundLocked = false;
        this._emitStateChange();
        const finalEntry = {
            type: 'gameover',
            timestamp: Date.now(),
            finalScore: this.score,
            finalLevel: this.level,
            maxCombo: this.maxCombo
        };
        this.gameHistory.push(finalEntry);
    }

    getGameHistory() {
        return [...this.gameHistory];
    }

    getScoreDetails() {
        return [...this.scoreDetails];
    }

    getState() {
        return {
            state: this.state,
            level: this.level,
            score: this.score,
            lives: this.lives,
            timeRemaining: this.timeRemaining,
            combo: this.combo,
            maxCombo: this.maxCombo,
            currentPrescription: this.currentPrescription,
            cabinetMedicines: [...this.cabinetMedicines],
            clickedMedicines: new Set(this.clickedMedicines)
        };
    }

    getGameState() {
        return this.state;
    }

    destroy() {
        this._stopTimer();
        this._cancelRoundTransition();
        this.isRoundLocked = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PharmacyGame,
        GameState,
        MEDICINES,
        SIMILAR_NAMES,
        FORBIDDEN_COMBINATIONS
    };
}
