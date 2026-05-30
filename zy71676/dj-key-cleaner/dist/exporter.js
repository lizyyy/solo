import fs from 'fs';
import path from 'path';
import { generateReport, formatReportText } from './reporter.js';
import Papa from 'papaparse';
export function exportCSV(session, outputPath) {
    const tracks = session.tracks;
    const rows = tracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        bpm: t.bpm ?? '',
        key_camelot: t.keyCamelot ?? '',
        key_musical: t.keyMusical ?? '',
        energy: t.energy ?? '',
        album: t.album,
        genre: t.genre,
        year: t.year ?? '',
        source: t.source,
        original_bpm: t.originalBpm ?? '',
        original_key: t.originalKey ?? '',
        original_energy: t.originalEnergy ?? '',
        manual_confirmed: t.manualConfirmed ? 'yes' : 'no',
        duplicate_of: t.duplicatesOf.join(';'),
        merged_from: t.mergedFrom.join(';'),
    }));
    const csv = Papa.unparse(rows, {
        columns: [
            'id', 'title', 'artist', 'bpm', 'key_camelot', 'key_musical',
            'energy', 'album', 'genre', 'year', 'source',
            'original_bpm', 'original_key', 'original_energy',
            'manual_confirmed', 'duplicate_of', 'merged_from',
        ],
        header: true,
    });
    fs.writeFileSync(outputPath, csv, 'utf-8');
}
export function exportJSON(session, outputPath) {
    const output = {
        sessionId: session.id,
        timestamp: session.timestamp,
        inputFiles: session.inputFiles,
        stats: session.stats,
        tracks: session.tracks,
        changes: session.changes,
        duplicates: session.duplicates,
        dataCaliberNote: '本输出所有stats数字与tracks/changes/duplicates列表条目来自同一CleaningSession，无二次统计。original_*字段保留原始值供对比，无需反查数据库。',
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
export function exportReport(session, outputPath) {
    const report = generateReport(session);
    const text = formatReportText(report);
    fs.writeFileSync(outputPath, text, 'utf-8');
}
export function exportAll(session, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const baseName = `dj-clean-${session.id}`;
    const files = [];
    const csvPath = path.join(outputDir, `${baseName}.csv`);
    exportCSV(session, csvPath);
    files.push(csvPath);
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    exportJSON(session, jsonPath);
    files.push(jsonPath);
    const reportPath = path.join(outputDir, `${baseName}-report.txt`);
    exportReport(session, reportPath);
    files.push(reportPath);
    return files;
}
//# sourceMappingURL=exporter.js.map