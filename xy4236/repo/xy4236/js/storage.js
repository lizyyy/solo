
const STORAGE_KEYS = {
    GROUPS: 'jump_rope_groups',
    ATHLETES: 'jump_rope_athletes',
    RESULTS: 'jump_rope_results',
    EXCEPTIONS: 'jump_rope_exceptions',
    SETTINGS: 'jump_rope_settings',
    CURRENT_EVENT: 'jump_rope_current_event'
};

class StorageManager {
    constructor() {
        this.storage = window.localStorage;
        this.initDefaults();
    }

    initDefaults() {
        if (!this.storage.getItem(STORAGE_KEYS.GROUPS)) {
            this.storage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify([]));
        }
        if (!this.storage.getItem(STORAGE_KEYS.ATHLETES)) {
            this.storage.setItem(STORAGE_KEYS.ATHLETES, JSON.stringify([]));
        }
        if (!this.storage.getItem(STORAGE_KEYS.RESULTS)) {
            this.storage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify([]));
        }
        if (!this.storage.getItem(STORAGE_KEYS.EXCEPTIONS)) {
            this.storage.setItem(STORAGE_KEYS.EXCEPTIONS, JSON.stringify([]));
        }
        if (!this.storage.getItem(STORAGE_KEYS.SETTINGS)) {
            this.storage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
                autoSave: true,
                soundEnabled: false
            }));
        }
    }

    get(key) {
        const data = this.storage.getItem(key);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage parse error:', e);
            return null;
        }
    }

    set(key, value) {
        try {
            this.storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    }

    remove(key) {
        this.storage.removeItem(key);
    }

    clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => {
            this.storage.removeItem(key);
        });
        this.initDefaults();
    }

    getGroups() {
        return this.get(STORAGE_KEYS.GROUPS) || [];
    }

    saveGroups(groups) {
        return this.set(STORAGE_KEYS.GROUPS, groups);
    }

    addGroup(group) {
        const groups = this.getGroups();
        const newGroup = {
            id: this.generateId(),
            name: group.name,
            createdAt: new Date().toISOString(),
            ...group
        };
        groups.push(newGroup);
        this.saveGroups(groups);
        return newGroup;
    }

    updateGroup(groupId, updates) {
        const groups = this.getGroups();
        const index = groups.findIndex(g => g.id === groupId);
        if (index > -1) {
            groups[index] = { ...groups[index], ...updates };
            this.saveGroups(groups);
            return groups[index];
        }
        return null;
    }

    deleteGroup(groupId) {
        const groups = this.getGroups();
        const filteredGroups = groups.filter(g => g.id !== groupId);
        this.saveGroups(filteredGroups);

        const athletes = this.getAthletes();
        const filteredAthletes = athletes.filter(a => a.groupId !== groupId);
        this.saveAthletes(filteredAthletes);

        return true;
    }

    getAthletes() {
        return this.get(STORAGE_KEYS.ATHLETES) || [];
    }

    saveAthletes(athletes) {
        return this.set(STORAGE_KEYS.ATHLETES, athletes);
    }

    getAthletesByGroup(groupId) {
        return this.getAthletes().filter(a => a.groupId === groupId);
    }

    addAthlete(athlete) {
        const athletes = this.getAthletes();
        const newAthlete = {
            id: this.generateId(),
            number: athlete.number,
            name: athlete.name,
            team: athlete.team || '',
            groupId: athlete.groupId,
            status: 'checked_in',
            createdAt: new Date().toISOString(),
            ...athlete
        };
        athletes.push(newAthlete);
        this.saveAthletes(athletes);
        return newAthlete;
    }

    updateAthlete(athleteId, updates) {
        const athletes = this.getAthletes();
        const index = athletes.findIndex(a => a.id === athleteId);
        if (index > -1) {
            athletes[index] = { ...athletes[index], ...updates };
            this.saveAthletes(athletes);
            return athletes[index];
        }
        return null;
    }

    deleteAthlete(athleteId) {
        const athletes = this.getAthletes();
        const filteredAthletes = athletes.filter(a => a.id !== athleteId);
        this.saveAthletes(filteredAthletes);
        return true;
    }

    getAthleteById(athleteId) {
        return this.getAthletes().find(a => a.id === athleteId);
    }

    getResults() {
        return this.get(STORAGE_KEYS.RESULTS) || [];
    }

    saveResults(results) {
        return this.set(STORAGE_KEYS.RESULTS, results);
    }

    getResultsByGroup(groupId) {
        return this.getResults().filter(r => r.groupId === groupId);
    }

    getResultsByEvent(eventType) {
        return this.getResults().filter(r => r.eventType === eventType);
    }

    getResultByAthlete(athleteId, eventType) {
        const results = this.getResults();
        return results.find(r => r.athleteId === athleteId && r.eventType === eventType);
    }

    addResult(result) {
        const results = this.getResults();
        const newResult = {
            id: this.generateId(),
            athleteId: result.athleteId,
            groupId: result.groupId,
            eventType: result.eventType,
            rawCount: result.rawCount || 0,
            errorCount: result.errorCount || 0,
            foulCount: result.foulCount || 0,
            duration: result.duration || 60,
            timeUsed: result.timeUsed || 0,
            status: 'pending',
            confirmed: false,
            confirmedAt: null,
            confirmedBy: null,
            exceptionNotes: result.exceptionNotes || '',
            createdAt: new Date().toISOString(),
            ...result
        };

        const existingIndex = results.findIndex(
            r => r.athleteId === newResult.athleteId && 
                 r.eventType === newResult.eventType
        );

        if (existingIndex > -1) {
            results[existingIndex] = newResult;
        } else {
            results.push(newResult);
        }

        this.saveResults(results);
        return newResult;
    }

    updateResult(resultId, updates) {
        const results = this.getResults();
        const index = results.findIndex(r => r.id === resultId);
        if (index > -1) {
            results[index] = { 
                ...results[index], 
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveResults(results);
            return results[index];
        }
        return null;
    }

    deleteResult(resultId) {
        const results = this.getResults();
        const filteredResults = results.filter(r => r.id !== resultId);
        this.saveResults(filteredResults);
        return true;
    }

    confirmResult(resultId, confirmedBy = null) {
        return this.updateResult(resultId, {
            confirmed: true,
            confirmedAt: new Date().toISOString(),
            confirmedBy,
            status: 'confirmed'
        });
    }

    getExceptions() {
        return this.get(STORAGE_KEYS.EXCEPTIONS) || [];
    }

    saveExceptions(exceptions) {
        return this.set(STORAGE_KEYS.EXCEPTIONS, exceptions);
    }

    addException(exception) {
        const exceptions = this.getExceptions();
        const newException = {
            id: this.generateId(),
            resultId: exception.resultId,
            athleteId: exception.athleteId,
            notes: exception.notes,
            createdAt: new Date().toISOString(),
            ...exception
        };
        exceptions.push(newException);
        this.saveExceptions(exceptions);
        return newException;
    }

    getSettings() {
        return this.get(STORAGE_KEYS.SETTINGS) || {};
    }

    updateSettings(updates) {
        const settings = this.getSettings();
        const newSettings = { ...settings, ...updates };
        this.set(STORAGE_KEYS.SETTINGS, newSettings);
        return newSettings;
    }

    getCurrentEvent() {
        return this.get(STORAGE_KEYS.CURRENT_EVENT) || null;
    }

    setCurrentEvent(eventType) {
        return this.set(STORAGE_KEYS.CURRENT_EVENT, eventType);
    }

    exportAllData() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            groups: this.getGroups(),
            athletes: this.getAthletes(),
            results: this.getResults(),
            exceptions: this.getExceptions(),
            settings: this.getSettings()
        };
    }

    importAllData(data) {
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Invalid data format' };
        }

        try {
            if (data.groups) this.saveGroups(data.groups);
            if (data.athletes) this.saveAthletes(data.athletes);
            if (data.results) this.saveResults(data.results);
            if (data.exceptions) this.saveExceptions(data.exceptions);
            if (data.settings) this.set(STORAGE_KEYS.SETTINGS, data.settings);

            return { success: true, imported: Object.keys(data).length };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

export default StorageManager;
export { STORAGE_KEYS };
