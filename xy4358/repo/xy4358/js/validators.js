const Validators = {
    runAllChecks: function() {
        const alerts = {
            doseWarnings: this.checkDoseWarnings(),
            allergyWarnings: this.checkAllergyWarnings(),
            cageConflicts: this.checkCageConflicts(),
            missedFeedings: this.checkMissedFeedings(),
            openObservations: this.checkOpenObservations(),
            updatedAt: Utils.formatDateTime(new Date())
        };
        
        Storage.saveAlerts(alerts);
        return alerts;
    },

    checkDoseWarnings: function() {
        const warnings = [];
        const plans = Storage.getMedicationPlans();
        const pets = Storage.getPets();
        const medications = Storage.getMedications();

        const petMap = {};
        pets.forEach(pet => {
            petMap[pet.petId] = pet;
        });

        const medMap = {};
        medications.forEach(med => {
            medMap[med.name] = med;
        });

        plans.forEach(plan => {
            const pet = petMap[plan.petId];
            const medication = medMap[plan.medicationName];
            
            if (!pet || !pet.weight) return;

            let warning = null;

            if (plan.maxDose && plan.dose > plan.maxDose) {
                warning = {
                    id: Utils.generateId(),
                    type: 'dose_exceeds_max',
                    severity: 'danger',
                    petId: plan.petId,
                    petName: plan.petName || pet.petName,
                    medicationName: plan.medicationName,
                    plannedDose: plan.dose,
                    maxDose: plan.maxDose,
                    unit: plan.unit,
                    message: `${plan.petName || pet.petName} 的 ${plan.medicationName} 剂量 ${plan.dose}${plan.unit} 超过最大剂量 ${plan.maxDose}${plan.unit}`,
                    planId: plan.id,
                    createdAt: Utils.formatDateTime(new Date())
                };
            }
            else if (medication && medication.maxDose && plan.dose > medication.maxDose) {
                warning = {
                    id: Utils.generateId(),
                    type: 'dose_exceeds_max',
                    severity: 'danger',
                    petId: plan.petId,
                    petName: plan.petName || pet.petName,
                    medicationName: plan.medicationName,
                    plannedDose: plan.dose,
                    maxDose: medication.maxDose,
                    unit: plan.unit,
                    message: `${plan.petName || pet.petName} 的 ${plan.medicationName} 剂量 ${plan.dose}${plan.unit} 超过药品最大剂量 ${medication.maxDose}${plan.unit}`,
                    planId: plan.id,
                    createdAt: Utils.formatDateTime(new Date())
                };
            }
            else if (plan.dosePerKg) {
                const calculatedDose = Utils.calculateDose(
                    pet.weight, 
                    plan.dosePerKg, 
                    plan.minDose, 
                    plan.maxDose
                );
                
                if (calculatedDose && plan.dose > calculatedDose * 1.2) {
                    warning = {
                        id: Utils.generateId(),
                        type: 'dose_over_weight',
                        severity: 'warning',
                        petId: plan.petId,
                        petName: plan.petName || pet.petName,
                        medicationName: plan.medicationName,
                        weight: pet.weight,
                        dosePerKg: plan.dosePerKg,
                        plannedDose: plan.dose,
                        calculatedDose: calculatedDose,
                        unit: plan.unit,
                        message: `${plan.petName || pet.petName} (${pet.weight}kg) 的 ${plan.medicationName} 剂量 ${plan.dose}${plan.unit} 可能超出按体重计算的推荐剂量 ${calculatedDose}${plan.unit}`,
                        planId: plan.id,
                        createdAt: Utils.formatDateTime(new Date())
                    };
                }
            }
            else if (medication && medication.defaultDose) {
                const calculatedDose = Utils.calculateDose(
                    pet.weight,
                    medication.defaultDose,
                    medication.minDose,
                    medication.maxDose
                );
                
                if (calculatedDose && plan.dose > calculatedDose * 1.2) {
                    warning = {
                        id: Utils.generateId(),
                        type: 'dose_over_weight',
                        severity: 'warning',
                        petId: plan.petId,
                        petName: plan.petName || pet.petName,
                        medicationName: plan.medicationName,
                        weight: pet.weight,
                        dosePerKg: medication.defaultDose,
                        plannedDose: plan.dose,
                        calculatedDose: calculatedDose,
                        unit: plan.unit,
                        message: `${plan.petName || pet.petName} (${pet.weight}kg) 的 ${plan.medicationName} 剂量 ${plan.dose}${plan.unit} 可能超出按体重计算的推荐剂量 ${calculatedDose}${plan.unit}`,
                        planId: plan.id,
                        createdAt: Utils.formatDateTime(new Date())
                    };
                }
            }

            if (warning) {
                warnings.push(warning);
            }
        });

        return warnings;
    },

    checkAllergyWarnings: function() {
        const warnings = [];
        const plans = Storage.getMedicationPlans();
        const pets = Storage.getPets();
        const medications = Storage.getMedications();

        const petMap = {};
        pets.forEach(pet => {
            petMap[pet.petId] = pet;
        });

        const medMap = {};
        medications.forEach(med => {
            medMap[med.name] = med;
        });

        plans.forEach(plan => {
            const pet = petMap[plan.petId];
            const medication = medMap[plan.medicationName];
            
            if (!pet) return;

            const petAllergies = pet.allergies || [];
            const medContraindications = medication?.contraindications || plan.contraindications || [];

            if (petAllergies.length === 0) return;

            const medNameLower = plan.medicationName.toLowerCase();
            
            for (const allergy of petAllergies) {
                const allergyLower = allergy.toLowerCase();
                
                if (medNameLower.includes(allergyLower) || allergyLower.includes(medNameLower)) {
                    warnings.push({
                        id: Utils.generateId(),
                        type: 'direct_allergy',
                        severity: 'danger',
                        petId: plan.petId,
                        petName: plan.petName || pet.petName,
                        medicationName: plan.medicationName,
                        allergen: allergy,
                        message: `⚠️ ${plan.petName || pet.petName} 对 ${allergy} 过敏，正在使用的 ${plan.medicationName} 可能存在风险！`,
                        planId: plan.id,
                        createdAt: Utils.formatDateTime(new Date())
                    });
                }
            }

            for (const contraindication of medContraindications) {
                const contraLower = contraindication.toLowerCase();
                
                for (const allergy of petAllergies) {
                    const allergyLower = allergy.toLowerCase();
                    
                    if (contraLower.includes(allergyLower) || allergyLower.includes(contraLower)) {
                        warnings.push({
                            id: Utils.generateId(),
                            type: 'contraindication',
                            severity: 'danger',
                            petId: plan.petId,
                            petName: plan.petName || pet.petName,
                            medicationName: plan.medicationName,
                            allergen: allergy,
                            contraindication: contraindication,
                            message: `🚨 ${plan.petName || pet.petName} 对 ${allergy} 过敏，${plan.medicationName} 的禁忌症包含 ${contraindication}，存在严重风险！`,
                            planId: plan.id,
                            createdAt: Utils.formatDateTime(new Date())
                        });
                    }
                }
            }
        });

        return warnings;
    },

    checkCageConflicts: function() {
        const conflicts = [];
        const cages = Storage.getCages();
        const pets = Storage.getPets();

        const petMap = {};
        pets.forEach(pet => {
            petMap[pet.petId] = pet;
        });

        cages.forEach(cage => {
            const petIds = cage.petIds || [];
            
            if (petIds.length <= 1) return;

            if (cage.capacity && petIds.length > cage.capacity) {
                const petNames = petIds.map(id => {
                    const pet = petMap[id];
                    return pet ? pet.petName : id;
                }).join('、');

                conflicts.push({
                    id: Utils.generateId(),
                    type: 'over_capacity',
                    severity: 'warning',
                    cageNumber: cage.cageNumber,
                    location: cage.location,
                    petIds: petIds,
                    petNames: petNames,
                    capacity: cage.capacity,
                    actualCount: petIds.length,
                    message: `笼位 ${cage.cageNumber} (${cage.location || '未知区域'}) 容量为 ${cage.capacity}，但实际容纳 ${petIds.length} 只宠物: ${petNames}`,
                    createdAt: Utils.formatDateTime(new Date())
                });
            }

            const speciesSet = new Set();
            const genders = [];
            const hasFemalesInHeat = [];

            petIds.forEach(petId => {
                const pet = petMap[petId];
                if (pet) {
                    if (pet.species) {
                        speciesSet.add(pet.species);
                    }
                    if (pet.gender) {
                        genders.push({
                            petId: petId,
                            petName: pet.petName,
                            gender: pet.gender,
                            inHeat: pet.inHeat || false
                        });
                    }
                    if (pet.inHeat) {
                        hasFemalesInHeat.push(pet.petName || petId);
                    }
                }
            });

            if (speciesSet.size > 1) {
                const speciesList = Array.from(speciesSet).join('、');
                const petNames = petIds.map(id => {
                    const pet = petMap[id];
                    return pet ? `${pet.petName}(${pet.species || '未知'})` : id;
                }).join('、');

                conflicts.push({
                    id: Utils.generateId(),
                    type: 'mixed_species',
                    severity: 'warning',
                    cageNumber: cage.cageNumber,
                    location: cage.location,
                    species: Array.from(speciesSet),
                    petIds: petIds,
                    petNames: petNames,
                    message: `笼位 ${cage.cageNumber} 混合饲养不同物种 (${speciesList}): ${petNames}，可能存在风险`,
                    createdAt: Utils.formatDateTime(new Date())
                });
            }

            const males = genders.filter(g => g.gender === '公' || g.gender === 'male');
            const females = genders.filter(g => g.gender === '母' || g.gender === 'female');

            if (males.length > 0 && females.length > 0) {
                const maleNames = males.map(m => m.petName).join('、');
                const femaleNames = females.map(f => f.petName).join('、');

                conflicts.push({
                    id: Utils.generateId(),
                    type: 'mixed_gender',
                    severity: hasFemalesInHeat.length > 0 ? 'danger' : 'warning',
                    cageNumber: cage.cageNumber,
                    location: cage.location,
                    males: males,
                    females: females,
                    hasFemalesInHeat: hasFemalesInHeat.length > 0,
                    message: hasFemalesInHeat.length > 0 
                        ? `🚨 笼位 ${cage.cageNumber} 公母混养，且 ${hasFemalesInHeat.join('、')} 处于发情期，存在严重风险！公: ${maleNames}，母: ${femaleNames}`
                        : `笼位 ${cage.cageNumber} 公母混养: 公(${maleNames})，母(${femaleNames})`,
                    createdAt: Utils.formatDateTime(new Date())
                });
            }
        });

        return conflicts;
    },

    checkMissedFeedings: function() {
        const missed = [];
        const today = Utils.getToday();
        const now = new Date();
        const currentHour = now.getHours();
        
        let currentShift = 'morning';
        if (currentHour >= 12 && currentHour < 18) {
            currentShift = 'afternoon';
        } else if (currentHour >= 18) {
            currentShift = 'evening';
        }

        const shiftOrder = ['morning', 'afternoon', 'evening'];
        const currentShiftIndex = shiftOrder.indexOf(currentShift);

        const plans = Storage.getMedicationPlans();
        const records = Storage.getFeedingRecords();

        const completedPlanIds = new Set();
        records.forEach(record => {
            if (record.planId && record.status === 'completed') {
                completedPlanIds.add(record.planId);
            }
        });

        plans.forEach(plan => {
            if (plan.status === 'completed' || completedPlanIds.has(plan.id)) {
                return;
            }

            const planDate = plan.date || today;
            const planShiftIndex = shiftOrder.indexOf(plan.shift);

            if (planDate < today) {
                missed.push({
                    id: Utils.generateId(),
                    type: 'overdue',
                    severity: 'danger',
                    petId: plan.petId,
                    petName: plan.petName,
                    medicationName: plan.medicationName,
                    dose: plan.dose,
                    unit: plan.unit,
                    date: planDate,
                    shift: plan.shift,
                    shiftName: Utils.getShiftName(plan.shift),
                    time: plan.time,
                    message: `🚨 ${plan.petName} 的 ${plan.medicationName} (${planDate} ${Utils.getShiftName(plan.shift)}) 已逾期未喂！`,
                    planId: plan.id,
                    createdAt: Utils.formatDateTime(new Date())
                });
            } else if (planDate === today && planShiftIndex < currentShiftIndex) {
                missed.push({
                    id: Utils.generateId(),
                    type: 'missed_today',
                    severity: 'warning',
                    petId: plan.petId,
                    petName: plan.petName,
                    medicationName: plan.medicationName,
                    dose: plan.dose,
                    unit: plan.unit,
                    date: planDate,
                    shift: plan.shift,
                    shiftName: Utils.getShiftName(plan.shift),
                    time: plan.time,
                    message: `⚠️ ${plan.petName} 的 ${plan.medicationName} (${Utils.getShiftName(plan.shift)}) 可能漏喂，请确认`,
                    planId: plan.id,
                    createdAt: Utils.formatDateTime(new Date())
                });
            }
        });

        return missed;
    },

    checkOpenObservations: function() {
        const observations = Storage.getOpenObservations();
        
        return observations.map(obs => ({
            id: obs.id,
            type: 'open_observation',
            severity: obs.severity || 'warning',
            petId: obs.petId,
            petName: obs.petName,
            title: obs.title,
            description: obs.description,
            createdBy: obs.createdBy,
            createdAt: obs.createdAt,
            status: obs.status,
            message: `🔴 ${obs.petName}: ${obs.title} - ${obs.description} (状态: ${obs.status === 'in_progress' ? '处理中' : '待处理'})`
        }));
    },

    validateMedicationPlan: function(plan) {
        const errors = [];
        const warnings = [];

        if (!plan.petId) {
            errors.push('缺少宠物ID');
        }

        if (!plan.medicationName) {
            errors.push('缺少药品名称');
        }

        if (!plan.dose || isNaN(plan.dose)) {
            errors.push('缺少有效剂量');
        }

        if (plan.date) {
            const today = Utils.getToday();
            if (plan.date < today) {
                warnings.push('计划日期在过去，可能需要补录');
            }
        }

        const pet = Storage.getPetByPetId(plan.petId);
        if (pet && pet.weight && plan.dosePerKg) {
            const calculatedDose = Utils.calculateDose(
                pet.weight,
                plan.dosePerKg,
                plan.minDose,
                plan.maxDose
            );
            
            if (calculatedDose && plan.dose > calculatedDose * 1.2) {
                warnings.push(`剂量 ${plan.dose}${plan.unit} 可能超出按体重 (${pet.weight}kg) 计算的推荐剂量 ${calculatedDose}${plan.unit}`);
            }
        }

        if (pet && pet.allergies && pet.allergies.length > 0) {
            const medNameLower = plan.medicationName.toLowerCase();
            for (const allergy of pet.allergies) {
                if (medNameLower.includes(allergy.toLowerCase())) {
                    errors.push(`宠物对 ${allergy} 过敏，与药品 ${plan.medicationName} 可能存在冲突！`);
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    },

    validateFeedingRecord: function(record) {
        const errors = [];
        const warnings = [];

        if (!record.planId && !record.petId) {
            errors.push('缺少计划ID或宠物ID');
        }

        if (!record.status) {
            errors.push('缺少喂药状态');
        }

        if (record.status === 'completed' && !record.administeredBy) {
            warnings.push('已完成的喂药记录建议填写执行人');
        }

        if (record.actualDose && record.planId) {
            const plans = Storage.getMedicationPlans();
            const plan = plans.find(p => p.id === record.planId);
            
            if (plan && record.actualDose !== plan.dose) {
                warnings.push(`实际剂量 (${record.actualDose}) 与计划剂量 (${plan.dose}) 不一致`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    },

    checkRiskLevel: function(planId) {
        const plans = Storage.getMedicationPlans();
        const plan = plans.find(p => p.id === planId);
        
        if (!plan) {
            return { level: 'unknown', reasons: ['无法找到计划'] };
        }

        const riskReasons = [];
        let level = 'normal';

        const pet = Storage.getPetByPetId(plan.petId);
        
        if (pet && pet.allergies && pet.allergies.length > 0) {
            const medNameLower = plan.medicationName.toLowerCase();
            for (const allergy of pet.allergies) {
                if (medNameLower.includes(allergy.toLowerCase())) {
                    riskReasons.push(`对 ${allergy} 过敏，与药品 ${plan.medicationName} 可能冲突`);
                    level = 'high';
                }
            }
        }

        if (pet && pet.weight && plan.dosePerKg) {
            const calculatedDose = Utils.calculateDose(
                pet.weight,
                plan.dosePerKg,
                plan.minDose,
                plan.maxDose
            );
            
            if (plan.maxDose && plan.dose > plan.maxDose) {
                riskReasons.push(`剂量 ${plan.dose}${plan.unit} 超过最大剂量 ${plan.maxDose}${plan.unit}`);
                level = 'high';
            } else if (calculatedDose && plan.dose > calculatedDose * 1.2) {
                riskReasons.push(`剂量 ${plan.dose}${plan.unit} 超出推荐剂量 ${calculatedDose}${plan.unit} 20% 以上`);
                level = level === 'high' ? 'high' : 'medium';
            }
        }

        if (plan.priority === 'high') {
            riskReasons.push('优先级标记为高');
            level = level === 'high' ? 'high' : 'medium';
        }

        if (plan.instructions && plan.instructions.includes('注意')) {
            riskReasons.push('有特殊用药说明');
        }

        return {
            level: level,
            reasons: riskReasons,
            planId: planId,
            petName: plan.petName,
            medicationName: plan.medicationName
        };
    },

    updateRiskLevel: function(planId, newLevel, reason) {
        const plans = Storage.getMedicationPlans();
        const index = plans.findIndex(p => p.id === planId);
        
        if (index === -1) {
            return false;
        }

        plans[index].riskOverride = {
            level: newLevel,
            reason: reason,
            overriddenAt: Utils.formatDateTime(new Date()),
            overriddenBy: 'user'
        };
        plans[index].updatedAt = Utils.formatDateTime(new Date());

        return Storage.saveMedicationPlans(plans);
    },

    getStatistics: function() {
        const alerts = this.runAllChecks();
        
        return {
            totalWarnings: alerts.doseWarnings.length + 
                           alerts.allergyWarnings.length + 
                           alerts.cageConflicts.length + 
                           alerts.missedFeedings.length + 
                           alerts.openObservations.length,
            doseWarnings: alerts.doseWarnings.length,
            allergyWarnings: alerts.allergyWarnings.length,
            cageConflicts: alerts.cageConflicts.length,
            missedFeedings: alerts.missedFeedings.length,
            openObservations: alerts.openObservations.length,
            highRiskCount: [
                ...alerts.doseWarnings.filter(w => w.severity === 'danger'),
                ...alerts.allergyWarnings.filter(w => w.severity === 'danger'),
                ...alerts.cageConflicts.filter(c => c.severity === 'danger'),
                ...alerts.missedFeedings.filter(m => m.severity === 'danger')
            ].length
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
}
