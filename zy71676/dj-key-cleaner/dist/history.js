import fs from 'fs';
import path from 'path';
const HISTORY_DIR = '.dj-clean-history';
function ensureHistoryDir(basePath) {
    const dir = path.join(basePath, HISTORY_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function loadHistory(basePath) {
    const dir = ensureHistoryDir(basePath);
    const historyFile = path.join(dir, 'history.json');
    if (!fs.existsSync(historyFile))
        return [];
    try {
        return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveHistory(basePath, entries) {
    const dir = ensureHistoryDir(basePath);
    const historyFile = path.join(dir, 'history.json');
    fs.writeFileSync(historyFile, JSON.stringify(entries, null, 2), 'utf-8');
}
export function recordHistory(basePath, sessionId, inputFiles, stats, changes) {
    const entries = loadHistory(basePath);
    const entry = {
        sessionId,
        timestamp: new Date().toISOString(),
        inputFiles,
        summary: stats,
        changes,
    };
    entries.push(entry);
    saveHistory(basePath, entries);
}
export function checkManualConfirmations(basePath, trackId, field) {
    const entries = loadHistory(basePath);
    for (let i = entries.length - 1; i >= 0; i--) {
        for (const change of entries[i].changes) {
            if (change.trackId === trackId &&
                change.field === field &&
                change.source === 'manual' &&
                !change.superseded) {
                return change;
            }
        }
    }
    return null;
}
export function protectManualOverrides(basePath, proposedChanges) {
    const protectedChanges = [];
    const overridden = [];
    for (const change of proposedChanges) {
        if (change.source === 'manual') {
            protectedChanges.push(change);
            continue;
        }
        const existing = checkManualConfirmations(basePath, change.trackId, change.field);
        if (existing && existing.newValue !== change.newValue) {
            const blocked = {
                ...change,
                superseded: true,
                reason: `${change.reason} [被阻止: 已有人工确认记录 "${existing.newValue}" by ${existing.reason}]`,
            };
            overridden.push(blocked);
        }
        else {
            protectedChanges.push(change);
        }
    }
    return { protected: protectedChanges, overridden };
}
export function applyManualConfirmation(basePath, trackId, trackTitle, trackArtist, field, value, reason) {
    const entries = loadHistory(basePath);
    for (const entry of entries) {
        for (const change of entry.changes) {
            if (change.trackId === trackId &&
                change.field === field &&
                change.source === 'manual' &&
                !change.superseded) {
                change.superseded = true;
            }
        }
    }
    saveHistory(basePath, entries);
    const record = {
        trackId,
        trackTitle,
        trackArtist,
        changeType: 'manual_confirm',
        field,
        oldValue: '(手动覆盖)',
        newValue: value,
        reason,
        timestamp: new Date().toISOString(),
        source: 'manual',
        superseded: false,
    };
    return record;
}
export function getHistory(basePath) {
    return loadHistory(basePath);
}
export function getChangeLogForTrack(basePath, trackId) {
    const entries = loadHistory(basePath);
    const records = [];
    for (const entry of entries) {
        for (const change of entry.changes) {
            if (change.trackId === trackId) {
                records.push(change);
            }
        }
    }
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
//# sourceMappingURL=history.js.map