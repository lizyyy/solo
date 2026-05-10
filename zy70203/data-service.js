const DataService = (() => {
    const STORAGE_KEYS = {
        RESIDENTS: 'bp_screening_residents',
        SCREENINGS: 'bp_screening_records',
        RETESTS: 'bp_retest_records',
        FOLLOWUPS: 'bp_followup_records',
        OPERATORS: 'bp_operators'
    };

    const RISK_LEVELS = {
        NORMAL: 'normal',
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    };

    const RISK_LABELS = {
        normal: '正常',
        low: '低危',
        medium: '中危',
        high: '高危'
    };

    const SCREENING_STATUSES = {
        PENDING_REVIEW: 'pending_review',
        REVIEWED: 'reviewed',
        NEED_RETEST: 'need_retest',
        RESOLVED: 'resolved'
    };

    const SCREENING_STATUS_LABELS = {
        pending_review: '待复核',
        reviewed: '已复核',
        need_retest: '需复测',
        resolved: '已结案'
    };

    const RETEST_STATUSES = {
        PENDING: 'pending',
        COMPLETED: 'completed',
        NORMAL: 'normal',
        STILL_ABNORMAL: 'still_abnormal'
    };

    const RETEST_STATUS_LABELS = {
        pending: '待复测',
        completed: '已复测',
        normal: '复测正常',
        still_abnormal: '仍异常'
    };

    const FOLLOWUP_STATUSES = {
        ASSIGNED: 'assigned',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        ESCALATED: 'escalated'
    };

    const FOLLOWUP_STATUS_LABELS = {
        assigned: '已分配',
        in_progress: '随访中',
        completed: '已完成',
        escalated: '需转诊'
    };

    const DEFAULT_OPERATORS = [
        { id: 'op_1', name: '张医生', phone: '13800138001', department: '社区卫生服务中心' },
        { id: 'op_2', name: '李护士', phone: '13800138002', department: '社区卫生服务中心' },
        { id: 'op_3', name: '王医生', phone: '13800138003', department: '社区卫生服务中心' }
    ];

    function generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 6);
        return `${prefix}${timestamp}_${random}`;
    }

    function getCurrentDateTime() {
        return new Date().toISOString();
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function calculateAge(birthDate) {
        if (!birthDate) return null;
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    function calculateRiskLevel(systolic, diastolic, age = null, hasHistory = false) {
        const sys = parseInt(systolic) || 0;
        const dia = parseInt(diastolic) || 0;

        if (sys >= 180 || dia >= 110) {
            return RISK_LEVELS.HIGH;
        }

        if (sys >= 160 || dia >= 100) {
            if (age && age >= 65) return RISK_LEVELS.HIGH;
            if (hasHistory) return RISK_LEVELS.HIGH;
            return RISK_LEVELS.MEDIUM;
        }

        if (sys >= 140 || dia >= 90) {
            if (age && age >= 65) return RISK_LEVELS.MEDIUM;
            if (hasHistory) return RISK_LEVELS.MEDIUM;
            return RISK_LEVELS.LOW;
        }

        return RISK_LEVELS.NORMAL;
    }

    function needsRetest(riskLevel) {
        return riskLevel === RISK_LEVELS.LOW || 
               riskLevel === RISK_LEVELS.MEDIUM || 
               riskLevel === RISK_LEVELS.HIGH;
    }

    function loadData(key, defaultValue = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Error loading data from ${key}:`, e);
            return defaultValue;
        }
    }

    function saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Error saving data to ${key}:`, e);
            return false;
        }
    }

    function initializeData() {
        if (!localStorage.getItem(STORAGE_KEYS.OPERATORS)) {
            saveData(STORAGE_KEYS.OPERATORS, DEFAULT_OPERATORS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.RESIDENTS)) {
            saveData(STORAGE_KEYS.RESIDENTS, []);
        }
        if (!localStorage.getItem(STORAGE_KEYS.SCREENINGS)) {
            saveData(STORAGE_KEYS.SCREENINGS, []);
        }
        if (!localStorage.getItem(STORAGE_KEYS.RETESTS)) {
            saveData(STORAGE_KEYS.RETESTS, []);
        }
        if (!localStorage.getItem(STORAGE_KEYS.FOLLOWUPS)) {
            saveData(STORAGE_KEYS.FOLLOWUPS, []);
        }
    }

    const Residents = {
        getAll() {
            return loadData(STORAGE_KEYS.RESIDENTS, []);
        },

        getById(id) {
            const residents = this.getAll();
            return residents.find(r => r.id === id);
        },

        getByIdCard(idCard) {
            const residents = this.getAll();
            return residents.find(r => r.idCard === idCard);
        },

        search(query) {
            const residents = this.getAll();
            if (!query) return residents;
            const q = query.toLowerCase();
            return residents.filter(r => 
                r.name.toLowerCase().includes(q) ||
                (r.idCard && r.idCard.includes(q)) ||
                (r.phone && r.phone.includes(q))
            );
        },

        create(data) {
            const residents = this.getAll();
            const existing = this.getByIdCard(data.idCard);
            if (existing) {
                return { success: false, error: '该身份证号已存在居民档案', duplicate: existing };
            }

            const resident = {
                id: generateId('res_'),
                name: data.name,
                idCard: data.idCard,
                gender: data.gender,
                birthDate: data.birthDate,
                phone: data.phone,
                address: data.address || '',
                community: data.community || '',
                hasHypertensionHistory: data.hasHypertensionHistory === 'true' || data.hasHypertensionHistory === true,
                hasDiabetes: data.hasDiabetes === 'true' || data.hasDiabetes === true,
                hasOtherChronic: data.hasOtherChronic || '',
                emergencyContact: data.emergencyContact || '',
                emergencyPhone: data.emergencyPhone || '',
                createdAt: getCurrentDateTime(),
                updatedAt: getCurrentDateTime(),
                status: 'active'
            };

            residents.push(resident);
            saveData(STORAGE_KEYS.RESIDENTS, residents);
            return { success: true, data: resident };
        },

        update(id, data) {
            const residents = this.getAll();
            const index = residents.findIndex(r => r.id === id);
            if (index === -1) {
                return { success: false, error: '居民档案不存在' };
            }

            if (data.idCard && data.idCard !== residents[index].idCard) {
                const existing = this.getByIdCard(data.idCard);
                if (existing && existing.id !== id) {
                    return { success: false, error: '该身份证号已存在其他居民档案' };
                }
            }

            residents[index] = {
                ...residents[index],
                ...data,
                updatedAt: getCurrentDateTime()
            };

            saveData(STORAGE_KEYS.RESIDENTS, residents);
            return { success: true, data: residents[index] };
        },

        delete(id) {
            const residents = this.getAll();
            const filtered = residents.filter(r => r.id !== id);
            saveData(STORAGE_KEYS.RESIDENTS, filtered);
            return { success: true };
        },

        batchImport(residentsData) {
            const residents = this.getAll();
            const results = {
                success: [],
                failed: [],
                duplicates: []
            };

            for (const data of residentsData) {
                try {
                    const existing = this.getByIdCard(data.idCard);
                    if (existing) {
                        results.duplicates.push({ data, existing });
                        continue;
                    }

                    const result = this.create(data);
                    if (result.success) {
                        results.success.push(result.data);
                    } else {
                        results.failed.push({ data, error: result.error });
                    }
                } catch (e) {
                    results.failed.push({ data, error: e.message });
                }
            }

            return results;
        },

        getStatistics() {
            const residents = this.getAll();
            const screenings = Screenings.getAll();
            
            const today = new Date();
            const thisMonth = today.getMonth();
            const thisYear = today.getFullYear();

            const total = residents.length;
            const withHistory = residents.filter(r => r.hasHypertensionHistory).length;
            const hasScreening = new Set(screenings.map(s => s.residentId)).size;
            const noScreening = total - hasScreening;

            return { total, withHistory, hasScreening, noScreening };
        }
    };

    const Screenings = {
        getAll() {
            return loadData(STORAGE_KEYS.SCREENINGS, []);
        },

        getById(id) {
            const screenings = this.getAll();
            return screenings.find(s => s.id === id);
        },

        getByResidentId(residentId) {
            return this.getAll().filter(s => s.residentId === residentId)
                .sort((a, b) => new Date(b.screeningTime) - new Date(a.screeningTime));
        },

        create(data, resident = null) {
            const screenings = this.getAll();

            if (!resident && data.residentId) {
                resident = Residents.getById(data.residentId);
            }

            if (data.residentId && !resident) {
                return { success: false, error: '来源居民记录缺失，请先创建居民档案' };
            }

            const age = resident ? calculateAge(resident.birthDate) : null;
            const hasHistory = resident ? resident.hasHypertensionHistory : false;

            const riskLevel = calculateRiskLevel(
                data.systolic, 
                data.diastolic, 
                age,
                hasHistory
            );

            const screening = {
                id: generateId('scr_'),
                residentId: data.residentId,
                residentName: resident ? resident.name : (data.residentName || ''),
                residentIdCard: resident ? resident.idCard : (data.residentIdCard || ''),
                systolic: parseInt(data.systolic),
                diastolic: parseInt(data.diastolic),
                heartRate: data.heartRate ? parseInt(data.heartRate) : null,
                screeningTime: data.screeningTime || getCurrentDateTime(),
                location: data.location || '',
                operator: data.operator || '',
                riskLevel,
                status: needsRetest(riskLevel) ? SCREENING_STATUSES.PENDING_REVIEW : SCREENING_STATUSES.REVIEWED,
                reviewedBy: null,
                reviewedAt: null,
                reviewNotes: null,
                notes: data.notes || '',
                createdAt: getCurrentDateTime(),
                updatedAt: getCurrentDateTime()
            };

            if (screening.riskLevel === RISK_LEVELS.NORMAL) {
                screening.status = SCREENING_STATUSES.RESOLVED;
                screening.reviewedBy = '系统自动确认';
                screening.reviewedAt = getCurrentDateTime();
            }

            screenings.push(screening);
            saveData(STORAGE_KEYS.SCREENINGS, screenings);
            return { success: true, data: screening };
        },

        review(id, action, notes = '', operator = '') {
            const screenings = this.getAll();
            const index = screenings.findIndex(s => s.id === id);
            if (index === -1) {
                return { success: false, error: '筛查记录不存在' };
            }

            const screening = screenings[index];
            if (screening.status !== SCREENING_STATUSES.PENDING_REVIEW) {
                return { success: false, error: '该记录已完成复核，不可重复操作' };
            }

            if (action === 'confirm_risk') {
                screening.status = SCREENING_STATUSES.NEED_RETEST;
            } else if (action === 'mark_normal') {
                screening.status = SCREENING_STATUSES.RESOLVED;
                screening.riskLevel = RISK_LEVELS.NORMAL;
            } else {
                return { success: false, error: '无效的复核操作' };
            }

            screening.reviewedBy = operator;
            screening.reviewedAt = getCurrentDateTime();
            screening.reviewNotes = notes;
            screening.updatedAt = getCurrentDateTime();

            screenings[index] = screening;
            saveData(STORAGE_KEYS.SCREENINGS, screenings);
            return { success: true, data: screening };
        },

        updateStatus(id, status, extraData = {}) {
            const screenings = this.getAll();
            const index = screenings.findIndex(s => s.id === id);
            if (index === -1) {
                return { success: false, error: '筛查记录不存在' };
            }

            screenings[index] = {
                ...screenings[index],
                ...extraData,
                status,
                updatedAt: getCurrentDateTime()
            };

            saveData(STORAGE_KEYS.SCREENINGS, screenings);
            return { success: true, data: screenings[index] };
        },

        batchImport(screeningsData) {
            const results = {
                success: [],
                failed: [],
                missingResident: [],
                duplicates: []
            };

            const existingKeys = new Set(this.getAll().map(s => 
                `${s.residentIdCard}_${formatDate(s.screeningTime)}`
            ));

            for (const data of screeningsData) {
                try {
                    let resident = null;
                    if (data.residentIdCard) {
                        resident = Residents.getByIdCard(data.residentIdCard);
                    }
                    
                    if (!resident && data.residentId) {
                        resident = Residents.getById(data.residentId);
                    }

                    if (!resident) {
                        results.missingResident.push({ data, error: '未找到对应居民档案' });
                        continue;
                    }

                    const checkKey = `${resident.idCard}_${formatDate(data.screeningTime || getCurrentDateTime())}`;
                    if (existingKeys.has(checkKey)) {
                        results.duplicates.push({ data, error: '同一居民当日筛查记录已存在' });
                        continue;
                    }
                    existingKeys.add(checkKey);

                    const result = this.create({ ...data, residentId: resident.id }, resident);
                    if (result.success) {
                        results.success.push(result.data);
                    } else {
                        results.failed.push({ data, error: result.error });
                    }
                } catch (e) {
                    results.failed.push({ data, error: e.message });
                }
            }

            return results;
        },

        getStatistics() {
            const screenings = this.getAll();
            const today = new Date();
            const thisMonth = today.getMonth();
            const thisYear = today.getFullYear();

            const total = screenings.length;
            
            const riskCounts = {
                [RISK_LEVELS.HIGH]: 0,
                [RISK_LEVELS.MEDIUM]: 0,
                [RISK_LEVELS.LOW]: 0,
                [RISK_LEVELS.NORMAL]: 0
            };

            const statusCounts = {
                [SCREENING_STATUSES.PENDING_REVIEW]: 0,
                [SCREENING_STATUSES.REVIEWED]: 0,
                [SCREENING_STATUSES.NEED_RETEST]: 0,
                [SCREENING_STATUSES.RESOLVED]: 0
            };

            let thisMonthCount = 0;

            for (const s of screenings) {
                riskCounts[s.riskLevel]++;
                statusCounts[s.status]++;

                const sDate = new Date(s.screeningTime);
                if (sDate.getMonth() === thisMonth && sDate.getFullYear() === thisYear) {
                    thisMonthCount++;
                }
            }

            return { total, riskCounts, statusCounts, thisMonthCount };
        },

        getPendingReview() {
            return this.getAll().filter(s => s.status === SCREENING_STATUSES.PENDING_REVIEW);
        },

        getNeedingRetest() {
            return this.getAll().filter(s => s.status === SCREENING_STATUSES.NEED_RETEST);
        }
    };

    const Retests = {
        getAll() {
            return loadData(STORAGE_KEYS.RETESTS, []);
        },

        getById(id) {
            return this.getAll().find(r => r.id === id);
        },

        getByScreeningId(screeningId) {
            return this.getAll()
                .filter(r => r.screeningId === screeningId)
                .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        },

        getByResidentId(residentId) {
            return this.getAll()
                .filter(r => r.residentId === residentId)
                .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
        },

        create(data) {
            const retests = this.getAll();
            const screening = Screenings.getById(data.screeningId);

            if (!screening) {
                return { success: false, error: '来源筛查记录缺失' };
            }

            if (screening.status !== SCREENING_STATUSES.NEED_RETEST) {
                return { success: false, error: '当前筛查状态不允许创建复测任务' };
            }

            const existingRetests = this.getByScreeningId(data.screeningId);
            const pendingRetest = existingRetests.find(r => r.status === RETEST_STATUSES.PENDING);
            if (pendingRetest) {
                return { 
                    success: false, 
                    error: '该筛查已有待完成的复测任务，请先完成或取消后再创建',
                    duplicate: pendingRetest
                };
            }

            const resident = Residents.getById(screening.residentId);

            const retest = {
                id: generateId('ret_'),
                screeningId: data.screeningId,
                residentId: screening.residentId,
                residentName: screening.residentName,
                originalSystolic: screening.systolic,
                originalDiastolic: screening.diastolic,
                originalRiskLevel: screening.riskLevel,
                scheduledDate: data.scheduledDate,
                scheduledTime: data.scheduledTime || '',
                location: data.location || '',
                operator: data.operator || '',
                status: RETEST_STATUSES.PENDING,
                resultSystolic: null,
                resultDiastolic: null,
                resultHeartRate: null,
                resultRiskLevel: null,
                completedAt: null,
                completedBy: '',
                notes: '',
                createdAt: getCurrentDateTime(),
                updatedAt: getCurrentDateTime()
            };

            retests.push(retest);
            saveData(STORAGE_KEYS.RETESTS, retests);

            return { success: true, data: retest };
        },

        complete(id, resultData, operator = '') {
            const retests = this.getAll();
            const index = retests.findIndex(r => r.id === id);
            if (index === -1) {
                return { success: false, error: '复测记录不存在' };
            }

            const retest = retests[index];
            if (retest.status !== RETEST_STATUSES.PENDING) {
                return { success: false, error: '该复测已完成，不可重复提交' };
            }

            const resident = Residents.getById(retest.residentId);
            const age = resident ? calculateAge(resident.birthDate) : null;
            const hasHistory = resident ? resident.hasHypertensionHistory : false;

            const resultRiskLevel = calculateRiskLevel(
                resultData.systolic,
                resultData.diastolic,
                age,
                hasHistory
            );

            retests[index] = {
                ...retest,
                resultSystolic: parseInt(resultData.systolic),
                resultDiastolic: parseInt(resultData.diastolic),
                resultHeartRate: resultData.heartRate ? parseInt(resultData.heartRate) : null,
                resultRiskLevel,
                status: resultRiskLevel === RISK_LEVELS.NORMAL ? RETEST_STATUSES.NORMAL : RETEST_STATUSES.STILL_ABNORMAL,
                completedAt: getCurrentDateTime(),
                completedBy: operator,
                notes: resultData.notes || '',
                updatedAt: getCurrentDateTime()
            };

            saveData(STORAGE_KEYS.RETESTS, retests);

            if (resultRiskLevel === RISK_LEVELS.NORMAL) {
                Screenings.updateStatus(retest.screeningId, SCREENING_STATUSES.RESOLVED, {
                    retestResult: '复测正常',
                    retestCompletedAt: retests[index].completedAt
                });
            }

            return { success: true, data: retests[index] };
        },

        cancel(id) {
            const retests = this.getAll();
            const index = retests.findIndex(r => r.id === id);
            if (index === -1) {
                return { success: false, error: '复测记录不存在' };
            }

            retests.splice(index, 1);
            saveData(STORAGE_KEYS.RETESTS, retests);

            return { success: true };
        },

        getStatistics() {
            const retests = this.getAll();
            const total = retests.length;
            
            const statusCounts = {
                [RETEST_STATUSES.PENDING]: 0,
                [RETEST_STATUSES.COMPLETED]: 0,
                [RETEST_STATUSES.NORMAL]: 0,
                [RETEST_STATUSES.STILL_ABNORMAL]: 0
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            let overdue = 0;
            let upcoming = 0;

            for (const r of retests) {
                statusCounts[r.status]++;

                if (r.status === RETEST_STATUSES.PENDING) {
                    const scheduled = new Date(r.scheduledDate);
                    scheduled.setHours(0, 0, 0, 0);
                    
                    if (scheduled < today) {
                        overdue++;
                    } else if (scheduled >= today && scheduled < tomorrow) {
                        upcoming++;
                    }
                }
            }

            return { total, statusCounts, overdue, upcoming };
        },

        getPending() {
            return this.getAll().filter(r => r.status === RETEST_STATUSES.PENDING);
        },

        getStillAbnormal() {
            return this.getAll().filter(r => r.status === RETEST_STATUSES.STILL_ABNORMAL);
        }
    };

    const Followups = {
        getAll() {
            return loadData(STORAGE_KEYS.FOLLOWUPS, []);
        },

        getById(id) {
            return this.getAll().find(f => f.id === id);
        },

        getByRetestId(retestId) {
            return this.getAll().filter(f => f.retestId === retestId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        },

        getByResidentId(residentId) {
            return this.getAll().filter(f => f.residentId === residentId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        },

        getByOperator(operatorId) {
            return this.getAll().filter(f => f.assignedTo === operatorId)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        },

        create(data) {
            const followups = this.getAll();
            const retest = Retests.getById(data.retestId);

            if (!retest) {
                return { success: false, error: '来源复测记录缺失' };
            }

            if (retest.status !== RETEST_STATUSES.STILL_ABNORMAL) {
                return { success: false, error: '只有复测仍异常的记录才需要随访' };
            }

            const screening = Screenings.getById(retest.screeningId);

            const followup = {
                id: generateId('fup_'),
                retestId: data.retestId,
                screeningId: retest.screeningId,
                residentId: retest.residentId,
                residentName: retest.residentName,
                originalRiskLevel: retest.resultRiskLevel,
                assignedTo: data.assignedTo,
                assignedToName: data.assignedToName || '',
                assignedBy: data.assignedBy || '',
                priority: data.priority || 'normal',
                status: FOLLOWUP_STATUSES.ASSIGNED,
                scheduledDate: data.scheduledDate || '',
                notes: '',
                progress: [],
                createdAt: getCurrentDateTime(),
                updatedAt: getCurrentDateTime()
            };

            followups.push(followup);
            saveData(STORAGE_KEYS.FOLLOWUPS, followups);

            return { success: true, data: followup };
        },

        updateProgress(id, progressData, operator = '') {
            const followups = this.getAll();
            const index = followups.findIndex(f => f.id === id);
            if (index === -1) {
                return { success: false, error: '随访记录不存在' };
            }

            const followup = followups[index];
            const progress = {
                id: generateId('prg_'),
                date: progressData.date || getCurrentDateTime(),
                content: progressData.content,
                operator,
                systolic: progressData.systolic ? parseInt(progressData.systolic) : null,
                diastolic: progressData.diastolic ? parseInt(progressData.diastolic) : null,
                medicationAdherence: progressData.medicationAdherence || '',
                lifestyleChanges: progressData.lifestyleChanges || ''
            };

            followup.progress.push(progress);
            followup.updatedAt = getCurrentDateTime();

            if (progressData.status && progressData.status !== followup.status) {
                followup.status = progressData.status;
            }

            followups[index] = followup;
            saveData(STORAGE_KEYS.FOLLOWUPS, followups);

            if (followup.status === FOLLOWUP_STATUSES.COMPLETED || 
                followup.status === FOLLOWUP_STATUSES.ESCALATED) {
                Screenings.updateStatus(followup.screeningId, SCREENING_STATUSES.RESOLVED, {
                    followupResult: followup.status === FOLLOWUP_STATUSES.ESCALATED ? '已转诊' : '随访完成',
                    followupCompletedAt: getCurrentDateTime()
                });
            }

            return { success: true, data: followup };
        },

        updateStatus(id, status) {
            const followups = this.getAll();
            const index = followups.findIndex(f => f.id === id);
            if (index === -1) {
                return { success: false, error: '随访记录不存在' };
            }

            followups[index] = {
                ...followups[index],
                status,
                updatedAt: getCurrentDateTime()
            };

            saveData(STORAGE_KEYS.FOLLOWUPS, followups);
            return { success: true, data: followups[index] };
        },

        getStatistics() {
            const followups = this.getAll();
            const total = followups.length;

            const statusCounts = {
                [FOLLOWUP_STATUSES.ASSIGNED]: 0,
                [FOLLOWUP_STATUSES.IN_PROGRESS]: 0,
                [FOLLOWUP_STATUSES.COMPLETED]: 0,
                [FOLLOWUP_STATUSES.ESCALATED]: 0
            };

            const operatorStats = {};

            for (const f of followups) {
                statusCounts[f.status]++;
                
                if (f.assignedTo) {
                    if (!operatorStats[f.assignedTo]) {
                        operatorStats[f.assignedTo] = { total: 0, completed: 0 };
                    }
                    operatorStats[f.assignedTo].total++;
                    if (f.status === FOLLOWUP_STATUSES.COMPLETED || f.status === FOLLOWUP_STATUSES.ESCALATED) {
                        operatorStats[f.assignedTo].completed++;
                    }
                }
            }

            return { total, statusCounts, operatorStats };
        },

        getActive() {
            return this.getAll().filter(f => 
                f.status === FOLLOWUP_STATUSES.ASSIGNED || 
                f.status === FOLLOWUP_STATUSES.IN_PROGRESS
            );
        }
    };

    const Operators = {
        getAll() {
            return loadData(STORAGE_KEYS.OPERATORS, DEFAULT_OPERATORS);
        },

        getById(id) {
            return this.getAll().find(o => o.id === id);
        }
    };

    const Export = {
        exportToCSV(data, filename) {
            if (!data || data.length === 0) {
                return { success: false, error: '没有可导出的数据' };
            }

            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => 
                    headers.map(header => {
                        const value = row[header];
                        if (value === null || value === undefined) return '';
                        const str = String(value);
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            return `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    }).join(',')
                )
            ].join('\n');

            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}_${formatDate(getCurrentDateTime())}.csv`;
            link.click();

            return { success: true };
        },

        exportResidents(residents = null) {
            const data = (residents || Residents.getAll()).map(r => ({
                '姓名': r.name,
                '身份证号': r.idCard,
                '性别': r.gender === 'male' ? '男' : r.gender === 'female' ? '女' : '未知',
                '出生日期': formatDate(r.birthDate),
                '联系电话': r.phone || '',
                '家庭住址': r.address || '',
                '社区': r.community || '',
                '高血压病史': r.hasHypertensionHistory ? '是' : '否',
                '糖尿病史': r.hasDiabetes ? '是' : '否',
                '其他慢性病': r.hasOtherChronic || '',
                '紧急联系人': r.emergencyContact || '',
                '紧急联系电话': r.emergencyPhone || '',
                '建档时间': formatDateTime(r.createdAt)
            }));
            return this.exportToCSV(data, '居民档案');
        },

        exportScreenings(screenings = null) {
            const data = (screenings || Screenings.getAll()).map(s => ({
                '居民姓名': s.residentName,
                '身份证号': s.residentIdCard,
                '收缩压': s.systolic,
                '舒张压': s.diastolic,
                '心率': s.heartRate || '',
                '筛查时间': formatDateTime(s.screeningTime),
                '筛查地点': s.location || '',
                '操作员': s.operator || '',
                '风险等级': RISK_LABELS[s.riskLevel],
                '状态': SCREENING_STATUS_LABELS[s.status],
                '复核人': s.reviewedBy || '',
                '复核时间': s.reviewedAt ? formatDateTime(s.reviewedAt) : '',
                '备注': s.notes || ''
            }));
            return this.exportToCSV(data, '筛查记录');
        },

        exportRetests(retests = null) {
            const data = (retests || Retests.getAll()).map(r => ({
                '居民姓名': r.residentName,
                '原收缩压': r.originalSystolic,
                '原舒张压': r.originalDiastolic,
                '原风险等级': RISK_LABELS[r.originalRiskLevel],
                '计划复测日期': formatDate(r.scheduledDate),
                '计划复测时间': r.scheduledTime || '',
                '复测地点': r.location || '',
                '操作员': r.operator || '',
                '状态': RETEST_STATUS_LABELS[r.status],
                '复测收缩压': r.resultSystolic || '',
                '复测舒张压': r.resultDiastolic || '',
                '复测心率': r.resultHeartRate || '',
                '复测风险等级': r.resultRiskLevel ? RISK_LABELS[r.resultRiskLevel] : '',
                '完成时间': r.completedAt ? formatDateTime(r.completedAt) : '',
                '完成人': r.completedBy || ''
            }));
            return this.exportToCSV(data, '复测记录');
        },

        exportFollowups(followups = null) {
            const data = (followups || Followups.getAll()).map(f => ({
                '居民姓名': f.residentName,
                '风险等级': RISK_LABELS[f.originalRiskLevel],
                '随访责任人': f.assignedToName || '',
                '优先级': f.priority === 'high' ? '高' : f.priority === 'medium' ? '中' : '低',
                '状态': FOLLOWUP_STATUS_LABELS[f.status],
                '计划随访日期': formatDate(f.scheduledDate),
                '随访次数': f.progress.length,
                '创建时间': formatDateTime(f.createdAt)
            }));
            return this.exportToCSV(data, '随访记录');
        },

        exportDashboardReport() {
            const residentStats = Residents.getStatistics();
            const screeningStats = Screenings.getStatistics();
            const retestStats = Retests.getStatistics();
            const followupStats = Followups.getStatistics();

            const summary = [
                { '指标': '居民档案总数', '数值': residentStats.total },
                { '指标': '有高血压病史', '数值': residentStats.withHistory },
                { '指标': '已筛查人数', '数值': residentStats.hasScreening },
                { '指标': '筛查记录总数', '数值': screeningStats.total },
                { '指标': '本月筛查', '数值': screeningStats.thisMonthCount },
                { '指标': '待复核', '数值': screeningStats.statusCounts[SCREENING_STATUSES.PENDING_REVIEW] },
                { '指标': '高危人数', '数值': screeningStats.riskCounts[RISK_LEVELS.HIGH] },
                { '指标': '中危人数', '数值': screeningStats.riskCounts[RISK_LEVELS.MEDIUM] },
                { '指标': '低危人数', '数值': screeningStats.riskCounts[RISK_LEVELS.LOW] },
                { '指标': '复测任务总数', '数值': retestStats.total },
                { '指标': '待复测', '数值': retestStats.statusCounts[RETEST_STATUSES.PENDING] },
                { '指标': '复测逾期', '数值': retestStats.overdue },
                { '指标': '随访任务总数', '数值': followupStats.total },
                { '指标': '进行中随访', '数值': followupStats.statusCounts[FOLLOWUP_STATUSES.IN_PROGRESS] }
            ];

            return this.exportToCSV(summary, '血压筛查统计报表');
        }
    };

    initializeData();

    return {
        Residents,
        Screenings,
        Retests,
        Followups,
        Operators,
        Export,
        Constants: {
            RISK_LEVELS,
            RISK_LABELS,
            SCREENING_STATUSES,
            SCREENING_STATUS_LABELS,
            RETEST_STATUSES,
            RETEST_STATUS_LABELS,
            FOLLOWUP_STATUSES,
            FOLLOWUP_STATUS_LABELS
        },
        Utils: {
            generateId,
            formatDate,
            formatDateTime,
            calculateAge,
            calculateRiskLevel,
            needsRetest,
            getCurrentDateTime
        }
    };
})();
