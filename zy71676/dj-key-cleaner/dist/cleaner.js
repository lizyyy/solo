import { protectManualOverrides, recordHistory, checkManualConfirmations } from './history.js';
import { normalizeKey, makeKeyChange } from './key-normalizer.js';
import { detectBpmFix, makeBpmChange } from './bpm-fixer.js';
import { findDuplicates, mergeDuplicates } from './dedup.js';
import { createHash } from 'crypto';
function generateTrackId(track, index) {
    const raw = `${track.title || ''}-${track.artist || ''}-${track.bpm || ''}-${track.key || ''}-${index}`;
    return createHash('md5').update(raw).digest('hex').slice(0, 12);
}
function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function parseEnergy(raw) {
    if (raw === null || raw === undefined)
        return { value: null, original: '' };
    const s = String(raw).trim();
    if (s === '' || s === '-' || s === 'N/A')
        return { value: null, original: s };
    const num = parseFloat(s);
    if (!isNaN(num) && num >= 0 && num <= 10) {
        return { value: Math.round(num * 10) / 10, original: s };
    }
    const stars = (s.match(/[★*]/g) || []).length;
    if (stars > 0 && stars <= 10) {
        return { value: stars, original: s };
    }
    const levelMatch = s.match(/level\s*(\d+)/i);
    if (levelMatch) {
        return { value: parseInt(levelMatch[1], 10), original: s };
    }
    return { value: null, original: s };
}
export function cleanLibrary(parseResult, basePath, inputFiles) {
    const sessionId = generateSessionId();
    const allChanges = [];
    const stats = {
        totalInput: parseResult.totalRows,
        successfullyParsed: parseResult.successfulRows,
        parseErrors: parseResult.totalRows - parseResult.successfulRows,
        bpmFixed: 0,
        bpmHalfSpeed: 0,
        bpmDoubleSpeed: 0,
        keysNormalized: 0,
        keysFailed: 0,
        energyParsed: 0,
        energyFailed: 0,
        duplicatesFound: 0,
        duplicatesMerged: 0,
        manualConfirmed: 0,
        autoChanges: 0,
        manualChanges: 0,
        fieldsFilledFromMerge: 0,
    };
    const tracks = [];
    for (let i = 0; i < parseResult.tracks.length; i++) {
        const raw = parseResult.tracks[i];
        const id = generateTrackId(raw, i);
        const bpmResult = detectBpmFix(raw.bpm, raw.key, raw.genre);
        if (bpmResult.isHalfSpeed) {
            stats.bpmHalfSpeed++;
            stats.bpmFixed++;
        }
        else if (bpmResult.isDoubleSpeed) {
            stats.bpmDoubleSpeed++;
            stats.bpmFixed++;
        }
        else if (bpmResult.wasRounded) {
            stats.bpmFixed++;
        }
        const keyResult = normalizeKey(raw.key);
        if (keyResult.changed && keyResult.camelot) {
            stats.keysNormalized++;
        }
        else if (!keyResult.camelot && raw.key) {
            stats.keysFailed++;
        }
        const energyResult = parseEnergy(raw.energy);
        if (energyResult.value !== null) {
            stats.energyParsed++;
        }
        else if (raw.energy) {
            stats.energyFailed++;
        }
        const track = {
            id,
            title: (raw.title || '(未知标题)').trim(),
            artist: (raw.artist || '(未知艺术家)').trim(),
            bpm: bpmResult.fixedBpm,
            keyCamelot: keyResult.camelot,
            keyMusical: keyResult.musical,
            energy: energyResult.value,
            album: (raw.album || '').trim(),
            genre: (raw.genre || '').trim(),
            year: raw.year ? parseInt(String(raw.year), 10) || null : null,
            source: (raw.source || '').trim(),
            originalBpm: raw.bpm ?? null,
            originalKey: raw.key || null,
            originalEnergy: raw.energy ?? null,
            duplicatesOf: [],
            manualConfirmed: false,
            mergedFrom: [],
        };
        const bpmChange = makeBpmChange(id, track.title, track.artist, bpmResult);
        if (bpmChange)
            allChanges.push(bpmChange);
        const keyChange = makeKeyChange(id, track.title, track.artist, keyResult);
        if (keyChange)
            allChanges.push(keyChange);
        tracks.push(track);
    }
    const duplicateGroups = findDuplicates(tracks);
    stats.duplicatesFound = duplicateGroups.reduce((sum, g) => sum + g.members.length - 1, 0);
    const { merged, changes: mergeChanges, fieldsFilled } = mergeDuplicates(tracks, duplicateGroups);
    allChanges.push(...mergeChanges);
    stats.duplicatesMerged = stats.duplicatesFound;
    stats.fieldsFilledFromMerge = fieldsFilled;
    const { protected: protectedChanges, overridden } = protectManualOverrides(basePath, allChanges);
    stats.autoChanges = protectedChanges.filter(c => c.source === 'auto').length;
    for (const blocked of overridden) {
        const trackIdx = merged.findIndex(t => t.id === blocked.trackId);
        if (trackIdx >= 0) {
            const manualRecord = checkManualConfirmations(basePath, blocked.trackId, blocked.field);
            if (manualRecord) {
                if (blocked.field === 'bpm') {
                    const parsed = parseFloat(manualRecord.newValue);
                    if (!isNaN(parsed))
                        merged[trackIdx].bpm = parsed;
                }
                else if (blocked.field === 'key') {
                    const keyRes = normalizeKey(manualRecord.newValue);
                    merged[trackIdx].keyCamelot = keyRes.camelot;
                    merged[trackIdx].keyMusical = keyRes.musical;
                }
                else if (blocked.field === 'energy') {
                    const parsed = parseFloat(manualRecord.newValue);
                    if (!isNaN(parsed))
                        merged[trackIdx].energy = parsed;
                }
                merged[trackIdx].manualConfirmed = true;
                stats.manualConfirmed++;
            }
        }
    }
    const finalChanges = [...protectedChanges, ...overridden];
    recordHistory(basePath, sessionId, inputFiles, stats, finalChanges);
    const session = {
        id: sessionId,
        inputFiles,
        timestamp: new Date().toISOString(),
        totalInputRows: parseResult.totalRows,
        successfullyParsed: parseResult.successfulRows,
        parseWarnings: parseResult.warnings,
        tracks: merged,
        changes: finalChanges,
        duplicates: duplicateGroups,
        stats,
    };
    return session;
}
export { generateTrackId, generateSessionId };
//# sourceMappingURL=cleaner.js.map