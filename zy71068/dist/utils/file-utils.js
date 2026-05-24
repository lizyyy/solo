import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
export async function isDirectory(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
export async function readJsonFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}
export async function writeJsonFile(filePath, data, pretty = true) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(filePath, content, 'utf-8');
}
export async function writeTextFile(filePath, content) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
}
export async function scanDirectory(dir, patterns, ignore = []) {
    const allFiles = [];
    for (const pattern of patterns) {
        const files = await glob(pattern, {
            cwd: dir,
            absolute: true,
            ignore: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                ...ignore,
            ],
            nodir: true,
        });
        allFiles.push(...files);
    }
    return [...new Set(allFiles)];
}
export function getFileExtension(fileName) {
    return path.extname(fileName).toLowerCase().slice(1);
}
export function getRelativePath(basePath, filePath) {
    return path.relative(basePath, filePath);
}
export function normalizePath(filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
}
//# sourceMappingURL=file-utils.js.map