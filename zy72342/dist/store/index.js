"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const defaultConfig = {
    threshold: 0.5,
    autoResolveAbove: true,
    requireReviewAtThreshold: true,
    defaultHandlerForPending: '张老师',
};
const dataFilePath = path.join(__dirname, '../../data/store.json');
function loadFromDisk() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const raw = fs.readFileSync(dataFilePath, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch (e) {
        console.warn('Failed to load store from disk, using empty store');
    }
    return null;
}
function saveToDisk(data) {
    try {
        const dir = path.dirname(dataFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (e) {
        console.error('Failed to save store to disk:', e);
    }
}
class DataStore {
    constructor() {
        const loaded = loadFromDisk();
        this.data = loaded || {
            users: [],
            surveyRows: [],
            boundaryNotes: [],
            filterResults: [],
            counterExamples: [],
            auditLogs: [],
            filterRuns: [],
            config: defaultConfig,
        };
    }
    persist() {
        saveToDisk(this.data);
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    getConfig() {
        return { ...this.data.config };
    }
    updateConfig(config) {
        this.data.config = { ...this.data.config, ...config };
        this.persist();
        return this.getConfig();
    }
    getUsers() {
        return [...this.data.users];
    }
    addUser(user) {
        const newUser = { ...user, id: this.generateId() };
        this.data.users.push(newUser);
        this.persist();
        return newUser;
    }
    findUserByName(name) {
        return this.data.users.find(u => u.name === name);
    }
    getSurveyRows() {
        return [...this.data.surveyRows];
    }
    getSurveyRowById(id) {
        return this.data.surveyRows.find(r => r.id === id);
    }
    getSurveyRowsByQuestion(questionId) {
        return this.data.surveyRows.filter(r => r.questionId === questionId);
    }
    addSurveyRow(row) {
        const newRow = { ...row, id: this.generateId() };
        this.data.surveyRows.push(newRow);
        this.persist();
        return newRow;
    }
    addSurveyRows(rows) {
        const newRows = rows.map(r => ({ ...r, id: this.generateId() }));
        this.data.surveyRows.push(...newRows);
        this.persist();
        return newRows;
    }
    getBoundaryNotes() {
        return [...this.data.boundaryNotes];
    }
    getBoundaryNoteById(id) {
        return this.data.boundaryNotes.find(n => n.id === id);
    }
    getBoundaryNotesByQuestion(questionId) {
        return this.data.boundaryNotes.filter(n => n.questionId === questionId);
    }
    addBoundaryNote(note) {
        const newNote = { ...note, id: this.generateId() };
        this.data.boundaryNotes.push(newNote);
        this.persist();
        return newNote;
    }
    updateBoundaryNote(id, updates) {
        const idx = this.data.boundaryNotes.findIndex(n => n.id === id);
        if (idx === -1)
            return undefined;
        this.data.boundaryNotes[idx] = { ...this.data.boundaryNotes[idx], ...updates };
        this.persist();
        return this.data.boundaryNotes[idx];
    }
    addBoundaryNotes(notes) {
        const newNotes = notes.map(n => ({ ...n, id: this.generateId() }));
        this.data.boundaryNotes.push(...newNotes);
        this.persist();
        return newNotes;
    }
    getFilterResults() {
        return [...this.data.filterResults];
    }
    getFilterResultById(id) {
        return this.data.filterResults.find(r => r.id === id);
    }
    getFilterResultsByQuestion(questionId) {
        return this.data.filterResults.filter(r => r.questionId === questionId);
    }
    getFilterResultsByRespondent(respondentId) {
        return this.data.filterResults.filter(r => r.respondentId === respondentId);
    }
    getFilterResultsByStatus(status) {
        return this.data.filterResults.filter(r => r.status === status);
    }
    addFilterResult(result) {
        const newResult = { ...result, id: this.generateId() };
        this.data.filterResults.push(newResult);
        this.persist();
        return newResult;
    }
    addFilterResults(results) {
        const newResults = results.map(r => ({ ...r, id: this.generateId() }));
        this.data.filterResults.push(...newResults);
        this.persist();
        return newResults;
    }
    updateFilterResult(id, updates) {
        const idx = this.data.filterResults.findIndex(r => r.id === id);
        if (idx === -1)
            return undefined;
        this.data.filterResults[idx] = {
            ...this.data.filterResults[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.persist();
        return this.data.filterResults[idx];
    }
    deleteFilterResultsByRun(runId) {
        this.data.filterResults = this.data.filterResults.filter(r => !r.id.startsWith('run-' + runId));
        this.persist();
    }
    getCounterExamples() {
        return [...this.data.counterExamples];
    }
    getCounterExampleById(id) {
        return this.data.counterExamples.find(c => c.id === id);
    }
    getCounterExamplesByStatus(status) {
        return this.data.counterExamples.filter(c => c.status === status);
    }
    getCounterExamplesByHandler(handler) {
        return this.data.counterExamples.filter(c => c.nextHandler === handler);
    }
    addCounterExample(example) {
        const newExample = { ...example, id: this.generateId() };
        this.data.counterExamples.push(newExample);
        this.persist();
        return newExample;
    }
    addCounterExamples(examples) {
        const newExamples = examples.map(e => ({ ...e, id: this.generateId() }));
        this.data.counterExamples.push(...newExamples);
        this.persist();
        return newExamples;
    }
    updateCounterExample(id, updates) {
        const idx = this.data.counterExamples.findIndex(c => c.id === id);
        if (idx === -1)
            return undefined;
        this.data.counterExamples[idx] = {
            ...this.data.counterExamples[idx],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.persist();
        return this.data.counterExamples[idx];
    }
    getAuditLogs() {
        return [...this.data.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    getAuditLogsByEntity(entityType, entityId) {
        return this.data.auditLogs
            .filter(l => l.entityType === entityType && l.entityId === entityId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    getAuditLogsByActor(actor) {
        return this.data.auditLogs
            .filter(l => l.actor === actor)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    addAuditLog(log) {
        const newLog = { ...log, id: this.generateId() };
        this.data.auditLogs.push(newLog);
        this.persist();
        return newLog;
    }
    getFilterRuns() {
        return [...this.data.filterRuns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }
    getFilterRunById(id) {
        return this.data.filterRuns.find(r => r.id === id);
    }
    addFilterRun(run) {
        const newRun = { ...run, id: this.generateId() };
        this.data.filterRuns.push(newRun);
        this.persist();
        return newRun;
    }
    updateFilterRun(id, updates) {
        const idx = this.data.filterRuns.findIndex(r => r.id === id);
        if (idx === -1)
            return undefined;
        this.data.filterRuns[idx] = { ...this.data.filterRuns[idx], ...updates };
        this.persist();
        return this.data.filterRuns[idx];
    }
    reset() {
        this.data = {
            users: [],
            surveyRows: [],
            boundaryNotes: [],
            filterResults: [],
            counterExamples: [],
            auditLogs: [],
            filterRuns: [],
            config: defaultConfig,
        };
        this.persist();
    }
    importData(data) {
        if (data.users)
            this.data.users = [...data.users];
        if (data.surveyRows)
            this.data.surveyRows = [...data.surveyRows];
        if (data.boundaryNotes)
            this.data.boundaryNotes = [...data.boundaryNotes];
        if (data.filterResults)
            this.data.filterResults = [...data.filterResults];
        if (data.counterExamples)
            this.data.counterExamples = [...data.counterExamples];
        if (data.auditLogs)
            this.data.auditLogs = [...data.auditLogs];
        if (data.filterRuns)
            this.data.filterRuns = [...data.filterRuns];
        if (data.config)
            this.data.config = { ...data.config };
        this.persist();
    }
    exportData() {
        return JSON.parse(JSON.stringify(this.data));
    }
}
exports.store = new DataStore();
//# sourceMappingURL=index.js.map