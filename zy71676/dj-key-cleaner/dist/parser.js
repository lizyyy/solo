import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
const FIELD_ALIASES = {
    title: ['title', 'track', 'song', 'name', 'track_title', 'song_name'],
    artist: ['artist', 'artist_name', 'performer', 'dj'],
    bpm: ['bpm', 'tempo', 'beats_per_minute', 'bpm_analyzed'],
    key: ['key', 'tonality', 'musical_key', 'key_signature', 'harmonic_key', 'camelot'],
    energy: ['energy', 'energy_level', 'intensity', 'e_level'],
    album: ['album', 'release', 'album_title'],
    genre: ['genre', 'style', 'category'],
    year: ['year', 'date', 'release_year'],
    source: ['source', 'software', 'origin', 'from'],
};
function normalizeFieldName(header) {
    const h = header.toLowerCase().trim().replace(/[\s_-]+/g, '_');
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.includes(h) || h === canonical)
            return canonical;
    }
    return null;
}
function parseFlexibleValue(raw) {
    if (raw === undefined || raw === null)
        return undefined;
    const s = String(raw).trim();
    if (s === '' || s === '-' || s === 'N/A' || s === 'n/a' || s === 'null' || s === 'NULL' || s === 'undefined')
        return undefined;
    return s;
}
function mapRowToRawTrack(row, rowIndex) {
    const warnings = [];
    const track = {};
    for (const [rawHeader, value] of Object.entries(row)) {
        const field = normalizeFieldName(rawHeader);
        if (!field)
            continue;
        const parsed = parseFlexibleValue(value);
        if (parsed !== undefined) {
            track[field] = parsed;
        }
    }
    if (!track.title && !track.artist) {
        warnings.push({
            rowIndex,
            rawLine: JSON.stringify(row).slice(0, 200),
            field: 'title/artist',
            message: '行缺少标题和艺术家，跳过',
            severity: 'warn',
        });
        return { track: {}, warnings };
    }
    if (!track.title)
        track.title = '(未知标题)';
    if (!track.artist)
        track.artist = '(未知艺术家)';
    return { track, warnings };
}
export function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = {
        tracks: [],
        warnings: [],
        totalRows: 0,
        successfulRows: 0,
    };
    const parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h,
    });
    result.totalRows = parsed.data.length;
    for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        if (!row || typeof row !== 'object')
            continue;
        const { track, warnings } = mapRowToRawTrack(row, i);
        result.warnings.push(...warnings);
        if (track.title || track.artist) {
            result.tracks.push(track);
            result.successfulRows++;
        }
    }
    for (const err of parsed.errors) {
        result.warnings.push({
            rowIndex: err.row ?? -1,
            rawLine: '',
            field: err.type || 'parse',
            message: `CSV解析错误: ${err.message}`,
            severity: 'error',
        });
    }
    return result;
}
export function parseJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = {
        tracks: [],
        warnings: [],
        totalRows: 0,
        successfulRows: 0,
    };
    let data;
    try {
        data = JSON.parse(content);
    }
    catch (e) {
        result.warnings.push({
            rowIndex: 0,
            rawLine: content.slice(0, 200),
            field: 'json',
            message: `JSON解析失败: ${e.message}`,
            severity: 'error',
        });
        return result;
    }
    const items = Array.isArray(data) ? data : [data];
    result.totalRows = items.length;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object') {
            result.warnings.push({
                rowIndex: i,
                rawLine: String(item).slice(0, 100),
                field: 'format',
                message: '非对象行，跳过',
                severity: 'warn',
            });
            continue;
        }
        const { track, warnings } = mapRowToRawTrack(item, i);
        result.warnings.push(...warnings);
        if (track.title || track.artist) {
            result.tracks.push(track);
            result.successfulRows++;
        }
    }
    return result;
}
export function parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv' || ext === '.tsv') {
        return parseCSV(filePath);
    }
    else if (ext === '.json') {
        return parseJSON(filePath);
    }
    else {
        const result = { tracks: [], warnings: [], totalRows: 0, successfulRows: 0 };
        result.warnings.push({
            rowIndex: 0,
            rawLine: filePath,
            field: 'file',
            message: `不支持的文件格式: ${ext}，尝试按CSV解析`,
            severity: 'warn',
        });
        return parseCSV(filePath);
    }
}
export function parseFiles(filePaths) {
    const combined = {
        tracks: [],
        warnings: [],
        totalRows: 0,
        successfulRows: 0,
    };
    for (const fp of filePaths) {
        if (!fs.existsSync(fp)) {
            combined.warnings.push({
                rowIndex: 0,
                rawLine: fp,
                field: 'file',
                message: `文件不存在: ${fp}`,
                severity: 'error',
            });
            continue;
        }
        const result = parseFile(fp);
        combined.tracks.push(...result.tracks);
        combined.warnings.push(...result.warnings);
        combined.totalRows += result.totalRows;
        combined.successfulRows += result.successfulRows;
    }
    return combined;
}
//# sourceMappingURL=parser.js.map