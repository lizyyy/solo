function similarity(a, b) {
    const sa = a.toLowerCase().trim();
    const sb = b.toLowerCase().trim();
    if (sa === sb)
        return 1.0;
    if (sa.includes(sb) || sb.includes(sa))
        return 0.85;
    const setA = new Set(sa.split(/\s+/));
    const setB = new Set(sb.split(/\s+/));
    let intersection = 0;
    for (const w of setA) {
        if (setB.has(w))
            intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    if (union === 0)
        return 0;
    return intersection / union;
}
function completenessScore(track) {
    let score = 0;
    let total = 5;
    if (track.bpm !== null)
        score++;
    if (track.keyCamelot !== null)
        score++;
    if (track.energy !== null)
        score++;
    if (track.title && track.title !== '(未知标题)')
        score++;
    if (track.artist && track.artist !== '(未知艺术家)')
        score++;
    return score / total;
}
export function findDuplicates(tracks, threshold = 0.8) {
    const groups = [];
    const assigned = new Set();
    for (let i = 0; i < tracks.length; i++) {
        if (assigned.has(tracks[i].id))
            continue;
        const members = [];
        const ti = tracks[i];
        for (let j = i + 1; j < tracks.length; j++) {
            if (assigned.has(tracks[j].id))
                continue;
            const tj = tracks[j];
            const titleSim = similarity(ti.title, tj.title);
            const artistSim = similarity(ti.artist, tj.artist);
            if (titleSim >= threshold && artistSim >= threshold) {
                members.push({
                    trackId: tj.id,
                    title: tj.title,
                    artist: tj.artist,
                    bpm: tj.bpm,
                    key: tj.keyCamelot,
                    energy: tj.energy,
                    source: tj.source,
                    completenessScore: completenessScore(tj),
                });
                assigned.add(tj.id);
            }
        }
        if (members.length > 0) {
            assigned.add(ti.id);
            const canonical = {
                trackId: ti.id,
                title: ti.title,
                artist: ti.artist,
                bpm: ti.bpm,
                key: ti.keyCamelot,
                energy: ti.energy,
                source: ti.source,
                completenessScore: completenessScore(ti),
            };
            const allMembers = [canonical, ...members];
            const richest = allMembers.reduce((best, m) => m.completenessScore > best.completenessScore ? m : best, canonical);
            groups.push({
                canonicalId: richest.trackId,
                canonicalTitle: richest.title,
                canonicalArtist: richest.artist,
                members: allMembers,
                mergeStrategy: 'keep_richest',
            });
        }
    }
    return groups;
}
export function mergeDuplicates(tracks, groups) {
    const changes = [];
    let fieldsFilled = 0;
    const mergedIds = new Set();
    const trackMap = new Map();
    for (const t of tracks)
        trackMap.set(t.id, t);
    for (const group of groups) {
        const canonical = trackMap.get(group.canonicalId);
        if (!canonical)
            continue;
        const otherMembers = group.members.filter(m => m.trackId !== group.canonicalId);
        const mergedFromIds = [];
        for (const member of otherMembers) {
            const mt = trackMap.get(member.trackId);
            if (!mt)
                continue;
            mergedIds.add(member.trackId);
            mergedFromIds.push(member.trackId);
            if (canonical.bpm === null && mt.bpm !== null) {
                canonical.bpm = mt.bpm;
                canonical.originalBpm = mt.originalBpm;
                fieldsFilled++;
                changes.push({
                    trackId: canonical.id,
                    trackTitle: canonical.title,
                    trackArtist: canonical.artist,
                    changeType: 'field_filled',
                    field: 'bpm',
                    oldValue: 'null',
                    newValue: String(mt.bpm),
                    reason: `从重复曲目合并BPM (来源: ${mt.source || mt.id})`,
                    timestamp: new Date().toISOString(),
                    source: 'auto',
                    superseded: false,
                });
            }
            if (canonical.keyCamelot === null && mt.keyCamelot !== null) {
                canonical.keyCamelot = mt.keyCamelot;
                canonical.keyMusical = mt.keyMusical;
                canonical.originalKey = mt.originalKey;
                fieldsFilled++;
                changes.push({
                    trackId: canonical.id,
                    trackTitle: canonical.title,
                    trackArtist: canonical.artist,
                    changeType: 'field_filled',
                    field: 'key',
                    oldValue: 'null',
                    newValue: `${mt.keyCamelot} (${mt.keyMusical})`,
                    reason: `从重复曲目合并调性 (来源: ${mt.source || mt.id})`,
                    timestamp: new Date().toISOString(),
                    source: 'auto',
                    superseded: false,
                });
            }
            if (canonical.energy === null && mt.energy !== null) {
                canonical.energy = mt.energy;
                canonical.originalEnergy = mt.originalEnergy;
                fieldsFilled++;
                changes.push({
                    trackId: canonical.id,
                    trackTitle: canonical.title,
                    trackArtist: canonical.artist,
                    changeType: 'field_filled',
                    field: 'energy',
                    oldValue: 'null',
                    newValue: String(mt.energy),
                    reason: `从重复曲目合并能量值 (来源: ${mt.source || mt.id})`,
                    timestamp: new Date().toISOString(),
                    source: 'auto',
                    superseded: false,
                });
            }
        }
        canonical.mergedFrom = mergedFromIds;
        canonical.duplicatesOf = group.members.map(m => m.trackId).filter(id => id !== canonical.id);
        for (const mid of mergedFromIds) {
            changes.push({
                trackId: mid,
                trackTitle: trackMap.get(mid)?.title || '',
                trackArtist: trackMap.get(mid)?.artist || '',
                changeType: 'duplicate_merged',
                field: 'track',
                oldValue: '独立曲目',
                newValue: `合并到 ${canonical.id} (${canonical.title})`,
                reason: `重复曲目，保留完整度最高的记录 (${canonical.title} - ${canonical.artist})`,
                timestamp: new Date().toISOString(),
                source: 'auto',
                superseded: false,
            });
        }
    }
    const merged = tracks.filter(t => !mergedIds.has(t.id));
    return { merged, changes, fieldsFilled };
}
//# sourceMappingURL=dedup.js.map