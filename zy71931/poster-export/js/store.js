const STORE_KEY = 'poster_export_store';

function _load() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : { projects: {}, activeProjectId: null };
    } catch {
        return { projects: {}, activeProjectId: null };
    }
}

function _save(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getStore() {
    return _load();
}

export function getActiveProject() {
    const store = _load();
    if (!store.activeProjectId) return null;
    return store.projects[store.activeProjectId] || null;
}

export function setActiveProject(projectId) {
    const store = _load();
    store.activeProjectId = projectId;
    _save(store);
}

export function createProject(name) {
    const store = _load();
    const id = genId();
    const project = {
        id,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        posterAssets: [],
        colorCards: [],
        authorization: null,
        reviews: [],
        corrections: [],
        exports: [],
        history: []
    };
    store.projects[id] = project;
    store.activeProjectId = id;
    _save(store);
    return project;
}

export function updateProject(projectId, updates) {
    const store = _load();
    if (!store.projects[projectId]) return null;
    Object.assign(store.projects[projectId], updates, { updatedAt: Date.now() });
    _save(store);
    return store.projects[projectId];
}

export function addHistory(projectId, entry) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.history.push({
        id: genId(),
        timestamp: Date.now(),
        ...entry
    });
    project.updatedAt = Date.now();
    _save(store);
}

export function addPosterAsset(projectId, asset) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.posterAssets.push({ id: genId(), ...asset });
    project.updatedAt = Date.now();
    _save(store);
}

export function removePosterAsset(projectId, assetId) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.posterAssets = project.posterAssets.filter(a => a.id !== assetId);
    project.updatedAt = Date.now();
    _save(store);
}

export function addColorCard(projectId, colorCard) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return null;
    const existing = project.colorCards.length > 0 ? project.colorCards[project.colorCards.length - 1] : null;
    const newCard = {
        id: genId(),
        version: existing ? existing.version + 1 : 1,
        previousVersionId: existing ? existing.id : null,
        uploadedAt: Date.now(),
        ...colorCard
    };
    project.colorCards.push(newCard);
    project.updatedAt = Date.now();
    _save(store);
    return newCard;
}

export function setAuthorization(projectId, authData) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.authorization = { ...authData };
    project.updatedAt = Date.now();
    _save(store);
}

export function addReview(projectId, review) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.reviews.push({ id: genId(), timestamp: Date.now(), ...review });
    project.updatedAt = Date.now();
    _save(store);
}

export function addCorrection(projectId, correction) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.corrections.push({ id: genId(), timestamp: Date.now(), ...correction });
    project.updatedAt = Date.now();
    _save(store);
}

export function addExport(projectId, exportRecord) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project) return;
    project.exports.push({ id: genId(), timestamp: Date.now(), ...exportRecord });
    project.updatedAt = Date.now();
    _save(store);
}

export function getColorCardDiff(projectId, newCardData) {
    const store = _load();
    const project = store.projects[projectId];
    if (!project || project.colorCards.length === 0) return null;
    const previous = project.colorCards[project.colorCards.length - 1];
    return computeColorCardDiff(previous, newCardData);
}

export function computeColorCardDiff(oldCard, newCardData) {
    const oldColors = oldCard.colors || [];
    const newColors = newCardData.colors || [];
    const diff = {
        added: [],
        removed: [],
        modified: [],
        unchanged: []
    };

    const oldMap = new Map(oldColors.map(c => [c.name, c]));
    const newMap = new Map(newColors.map(c => [c.name, c]));

    for (const [name, color] of newMap) {
        if (!oldMap.has(name)) {
            diff.added.push({ name, newHex: color.hex });
        } else {
            const oldColor = oldMap.get(name);
            if (oldColor.hex.toLowerCase() !== color.hex.toLowerCase()) {
                diff.modified.push({ name, oldHex: oldColor.hex, newHex: color.hex });
            } else {
                diff.unchanged.push({ name, hex: color.hex });
            }
        }
    }

    for (const [name, color] of oldMap) {
        if (!newMap.has(name)) {
            diff.removed.push({ name, oldHex: color.hex });
        }
    }

    return diff;
}

export { genId, formatTime };
