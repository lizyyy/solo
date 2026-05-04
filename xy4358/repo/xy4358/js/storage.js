const Storage = {
    STORAGE_KEYS: {
        PETS: 'pet_feeding_pets',
        MEDICATIONS: 'pet_feeding_medications',
        MEDICATION_PLANS: 'pet_feeding_medication_plans',
        FEEDING_RECORDS: 'pet_feeding_feeding_records',
        SHIFTS: 'pet_feeding_shifts',
        CAGES: 'pet_feeding_cages',
        ALERTS: 'pet_feeding_alerts',
        OBSERVATIONS: 'pet_feeding_observations',
        IMPORT_HISTORY: 'pet_feeding_import_history'
    },

    init: function() {
        const keys = Object.values(this.STORAGE_KEYS);
        keys.forEach(key => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify([]));
            }
        });
        
        if (!localStorage.getItem(this.STORAGE_KEYS.ALERTS)) {
            localStorage.setItem(this.STORAGE_KEYS.ALERTS, JSON.stringify({
                doseWarnings: [],
                allergyWarnings: [],
                cageConflicts: [],
                missedFeedings: [],
                openObservations: []
            }));
        }
    },

    getData: function(key) {
        const data = localStorage.getItem(key);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('解析存储数据失败:', e);
            return [];
        }
    },

    setData: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    },

    getPets: function() {
        return this.getData(this.STORAGE_KEYS.PETS);
    },

    getPetById: function(id) {
        const pets = this.getPets();
        return pets.find(p => p.id === id);
    },

    getPetByPetId: function(petId) {
        const pets = this.getPets();
        return pets.find(p => p.petId === petId);
    },

    savePets: function(pets) {
        return this.setData(this.STORAGE_KEYS.PETS, pets);
    },

    addPet: function(pet) {
        const pets = this.getPets();
        pet.id = pet.id || Utils.generateId();
        pet.createdAt = pet.createdAt || Utils.formatDateTime(new Date());
        pet.updatedAt = Utils.formatDateTime(new Date());
        pets.push(pet);
        return this.savePets(pets);
    },

    updatePet: function(id, updates) {
        const pets = this.getPets();
        const index = pets.findIndex(p => p.id === id);
        if (index !== -1) {
            pets[index] = { ...pets[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.savePets(pets);
        }
        return false;
    },

    deletePet: function(id) {
        const pets = this.getPets();
        const filtered = pets.filter(p => p.id !== id);
        return this.savePets(filtered);
    },

    getMedications: function() {
        return this.getData(this.STORAGE_KEYS.MEDICATIONS);
    },

    getMedicationById: function(id) {
        const medications = this.getMedications();
        return medications.find(m => m.id === id);
    },

    getMedicationByName: function(name) {
        const medications = this.getMedications();
        return medications.find(m => m.name === name);
    },

    saveMedications: function(medications) {
        return this.setData(this.STORAGE_KEYS.MEDICATIONS, medications);
    },

    addMedication: function(medication) {
        const medications = this.getMedications();
        medication.id = medication.id || Utils.generateId();
        medication.createdAt = medication.createdAt || Utils.formatDateTime(new Date());
        medication.updatedAt = Utils.formatDateTime(new Date());
        medications.push(medication);
        return this.saveMedications(medications);
    },

    updateMedication: function(id, updates) {
        const medications = this.getMedications();
        const index = medications.findIndex(m => m.id === id);
        if (index !== -1) {
            medications[index] = { ...medications[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveMedications(medications);
        }
        return false;
    },

    deleteMedication: function(id) {
        const medications = this.getMedications();
        const filtered = medications.filter(m => m.id !== id);
        return this.saveMedications(filtered);
    },

    getMedicationPlans: function() {
        return this.getData(this.STORAGE_KEYS.MEDICATION_PLANS);
    },

    getMedicationPlansByDate: function(date) {
        const plans = this.getMedicationPlans();
        return plans.filter(p => p.date === date);
    },

    getMedicationPlansByDateAndShift: function(date, shift) {
        const plans = this.getMedicationPlans();
        return plans.filter(p => p.date === date && p.shift === shift);
    },

    getMedicationPlansByPetId: function(petId) {
        const plans = this.getMedicationPlans();
        return plans.filter(p => p.petId === petId);
    },

    saveMedicationPlans: function(plans) {
        return this.setData(this.STORAGE_KEYS.MEDICATION_PLANS, plans);
    },

    addMedicationPlan: function(plan) {
        const plans = this.getMedicationPlans();
        plan.id = plan.id || Utils.generateId();
        plan.createdAt = plan.createdAt || Utils.formatDateTime(new Date());
        plan.updatedAt = Utils.formatDateTime(new Date());
        plans.push(plan);
        return this.saveMedicationPlans(plans);
    },

    updateMedicationPlan: function(id, updates) {
        const plans = this.getMedicationPlans();
        const index = plans.findIndex(p => p.id === id);
        if (index !== -1) {
            plans[index] = { ...plans[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveMedicationPlans(plans);
        }
        return false;
    },

    deleteMedicationPlan: function(id) {
        const plans = this.getMedicationPlans();
        const filtered = plans.filter(p => p.id !== id);
        return this.saveMedicationPlans(filtered);
    },

    getFeedingRecords: function() {
        return this.getData(this.STORAGE_KEYS.FEEDING_RECORDS);
    },

    getFeedingRecordsByDate: function(date) {
        const records = this.getFeedingRecords();
        return records.filter(r => r.date === date);
    },

    getFeedingRecordsByDateAndShift: function(date, shift) {
        const records = this.getFeedingRecords();
        return records.filter(r => r.date === date && r.shift === shift);
    },

    getFeedingRecordsByPlanId: function(planId) {
        const records = this.getFeedingRecords();
        return records.filter(r => r.planId === planId);
    },

    saveFeedingRecords: function(records) {
        return this.setData(this.STORAGE_KEYS.FEEDING_RECORDS, records);
    },

    addFeedingRecord: function(record) {
        const records = this.getFeedingRecords();
        record.id = record.id || Utils.generateId();
        record.createdAt = record.createdAt || Utils.formatDateTime(new Date());
        records.push(record);
        return this.saveFeedingRecords(records);
    },

    updateFeedingRecord: function(id, updates) {
        const records = this.getFeedingRecords();
        const index = records.findIndex(r => r.id === id);
        if (index !== -1) {
            records[index] = { ...records[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveFeedingRecords(records);
        }
        return false;
    },

    getCages: function() {
        return this.getData(this.STORAGE_KEYS.CAGES);
    },

    getCageById: function(id) {
        const cages = this.getCages();
        return cages.find(c => c.id === id);
    },

    getCageByNumber: function(cageNumber) {
        const cages = this.getCages();
        return cages.find(c => c.cageNumber === cageNumber);
    },

    getCagesByDate: function(date) {
        const cages = this.getCages();
        return cages.filter(c => !c.date || c.date === date);
    },

    saveCages: function(cages) {
        return this.setData(this.STORAGE_KEYS.CAGES, cages);
    },

    addCage: function(cage) {
        const cages = this.getCages();
        cage.id = cage.id || Utils.generateId();
        cage.createdAt = cage.createdAt || Utils.formatDateTime(new Date());
        cage.updatedAt = Utils.formatDateTime(new Date());
        cages.push(cage);
        return this.saveCages(cages);
    },

    updateCage: function(id, updates) {
        const cages = this.getCages();
        const index = cages.findIndex(c => c.id === id);
        if (index !== -1) {
            cages[index] = { ...cages[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveCages(cages);
        }
        return false;
    },

    getShifts: function() {
        return this.getData(this.STORAGE_KEYS.SHIFTS);
    },

    getShiftByDateAndShift: function(date, shift) {
        const shifts = this.getShifts();
        return shifts.find(s => s.date === date && s.shift === shift);
    },

    getShiftsByDate: function(date) {
        const shifts = this.getShifts();
        return shifts.filter(s => s.date === date);
    },

    saveShifts: function(shifts) {
        return this.setData(this.STORAGE_KEYS.SHIFTS, shifts);
    },

    addShift: function(shift) {
        const shifts = this.getShifts();
        shift.id = shift.id || Utils.generateId();
        shift.createdAt = shift.createdAt || Utils.formatDateTime(new Date());
        shifts.push(shift);
        return this.saveShifts(shifts);
    },

    updateShift: function(id, updates) {
        const shifts = this.getShifts();
        const index = shifts.findIndex(s => s.id === id);
        if (index !== -1) {
            shifts[index] = { ...shifts[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveShifts(shifts);
        }
        return false;
    },

    getObservations: function() {
        return this.getData(this.STORAGE_KEYS.OBSERVATIONS);
    },

    getOpenObservations: function() {
        const observations = this.getObservations();
        return observations.filter(o => o.status !== 'closed');
    },

    getObservationsByPetId: function(petId) {
        const observations = this.getObservations();
        return observations.filter(o => o.petId === petId);
    },

    saveObservations: function(observations) {
        return this.setData(this.STORAGE_KEYS.OBSERVATIONS, observations);
    },

    addObservation: function(observation) {
        const observations = this.getObservations();
        observation.id = observation.id || Utils.generateId();
        observation.createdAt = observation.createdAt || Utils.formatDateTime(new Date());
        observation.status = observation.status || 'open';
        observations.push(observation);
        return this.saveObservations(observations);
    },

    updateObservation: function(id, updates) {
        const observations = this.getObservations();
        const index = observations.findIndex(o => o.id === id);
        if (index !== -1) {
            observations[index] = { ...observations[index], ...updates, updatedAt: Utils.formatDateTime(new Date()) };
            return this.saveObservations(observations);
        }
        return false;
    },

    getAlerts: function() {
        const alerts = localStorage.getItem(this.STORAGE_KEYS.ALERTS);
        try {
            return alerts ? JSON.parse(alerts) : {
                doseWarnings: [],
                allergyWarnings: [],
                cageConflicts: [],
                missedFeedings: [],
                openObservations: []
            };
        } catch (e) {
            console.error('解析警告数据失败:', e);
            return {
                doseWarnings: [],
                allergyWarnings: [],
                cageConflicts: [],
                missedFeedings: [],
                openObservations: []
            };
        }
    },

    saveAlerts: function(alerts) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
            return true;
        } catch (e) {
            console.error('保存警告数据失败:', e);
            return false;
        }
    },

    updateAlertCategory: function(category, data) {
        const alerts = this.getAlerts();
        alerts[category] = data;
        alerts.updatedAt = Utils.formatDateTime(new Date());
        return this.saveAlerts(alerts);
    },

    getImportHistory: function() {
        return this.getData(this.STORAGE_KEYS.IMPORT_HISTORY);
    },

    addImportHistory: function(importData) {
        const history = this.getImportHistory();
        importData.id = importData.id || Utils.generateId();
        importData.importedAt = importData.importedAt || Utils.formatDateTime(new Date());
        history.push(importData);
        return this.setData(this.STORAGE_KEYS.IMPORT_HISTORY, history);
    },

    clearAllData: function() {
        const keys = Object.values(this.STORAGE_KEYS);
        keys.forEach(key => {
            localStorage.removeItem(key);
        });
        this.init();
        return true;
    },

    exportAllData: function() {
        const exportData = {};
        const keys = Object.keys(this.STORAGE_KEYS);
        keys.forEach(key => {
            const storageKey = this.STORAGE_KEYS[key];
            exportData[key] = this.getData(storageKey);
        });
        exportData.ALERTS = this.getAlerts();
        exportData.exportedAt = Utils.formatDateTime(new Date());
        return exportData;
    },

    importAllData: function(data) {
        try {
            if (data.PETS) this.savePets(data.PETS);
            if (data.MEDICATIONS) this.saveMedications(data.MEDICATIONS);
            if (data.MEDICATION_PLANS) this.saveMedicationPlans(data.MEDICATION_PLANS);
            if (data.FEEDING_RECORDS) this.saveFeedingRecords(data.FEEDING_RECORDS);
            if (data.SHIFTS) this.saveShifts(data.SHIFTS);
            if (data.CAGES) this.saveCages(data.CAGES);
            if (data.OBSERVATIONS) this.saveObservations(data.OBSERVATIONS);
            if (data.ALERTS) this.saveAlerts(data.ALERTS);
            if (data.IMPORT_HISTORY) this.setData(this.STORAGE_KEYS.IMPORT_HISTORY, data.IMPORT_HISTORY);
            
            return true;
        } catch (e) {
            console.error('导入数据失败:', e);
            return false;
        }
    },

    getAvailableDates: function() {
        const plans = this.getMedicationPlans();
        const dates = new Set();
        
        plans.forEach(plan => {
            if (plan.date) {
                dates.add(plan.date);
            }
        });
        
        const today = Utils.getToday();
        dates.add(today);
        
        const sortedDates = Array.from(dates).sort();
        return sortedDates;
    },

    getStatistics: function() {
        const pets = this.getPets();
        const medications = this.getMedications();
        const plans = this.getMedicationPlans();
        const records = this.getFeedingRecords();
        const observations = this.getObservations();
        const alerts = this.getAlerts();
        
        const today = Utils.getToday();
        const todayPlans = plans.filter(p => p.date === today);
        const todayRecords = records.filter(r => r.date === today);
        
        const completedToday = todayRecords.filter(r => r.status === 'completed').length;
        const pendingToday = todayPlans.length - completedToday;
        
        const openObservations = observations.filter(o => o.status !== 'closed').length;
        
        const totalWarnings = (alerts.doseWarnings?.length || 0) + 
                              (alerts.allergyWarnings?.length || 0) + 
                              (alerts.cageConflicts?.length || 0) + 
                              (alerts.missedFeedings?.length || 0);
        
        return {
            petsCount: pets.length,
            medicationsCount: medications.length,
            plansCount: plans.length,
            recordsCount: records.length,
            todayPlansCount: todayPlans.length,
            completedToday: completedToday,
            pendingToday: pendingToday,
            openObservations: openObservations,
            totalWarnings: totalWarnings,
            doseWarnings: alerts.doseWarnings?.length || 0,
            allergyWarnings: alerts.allergyWarnings?.length || 0,
            cageConflicts: alerts.cageConflicts?.length || 0,
            missedFeedings: alerts.missedFeedings?.length || 0
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
