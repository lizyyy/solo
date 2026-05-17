import fs from 'fs/promises';
import path from 'path';
export async function scanLockfile(rootPath) {
    const entries = [];
    const anomalies = [];
    const lockfilePaths = [
        path.join(rootPath, 'package-lock.json'),
        path.join(rootPath, 'yarn.lock'),
        path.join(rootPath, 'pnpm-lock.yaml')
    ];
    for (const lockfilePath of lockfilePaths) {
        try {
            const stats = await fs.stat(lockfilePath);
            if (stats.isFile()) {
                const result = await parseLockfile(lockfilePath);
                entries.push(...result.entries);
                anomalies.push(...result.anomalies);
            }
        }
        catch {
            // lockfile doesn't exist, skip
        }
    }
    return { entries, anomalies };
}
async function parseLockfile(filePath) {
    const entries = [];
    const anomalies = [];
    const fileName = path.basename(filePath);
    try {
        if (fileName === 'package-lock.json') {
            const result = await parsePackageLockJson(filePath);
            entries.push(...result.entries);
            anomalies.push(...result.anomalies);
        }
        else if (fileName === 'yarn.lock') {
            const result = await parseYarnLock(filePath);
            entries.push(...result.entries);
            anomalies.push(...result.anomalies);
        }
        else if (fileName === 'pnpm-lock.yaml') {
            const result = await parsePnpmLock(filePath);
            entries.push(...result.entries);
            anomalies.push(...result.anomalies);
        }
    }
    catch (error) {
        anomalies.push({
            id: `lockfile-parse-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: 'lockfile-parse-error',
            location: { file: filePath },
            message: `Failed to parse lockfile: ${error.message}`,
            cause: 'lockfile format error'
        });
    }
    return { entries, anomalies };
}
async function parsePackageLockJson(filePath) {
    const entries = [];
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    function traversePackages(packages) {
        for (const [pkgPath, pkg] of Object.entries(packages)) {
            const name = pkgPath.replace(/^node_modules\//, '');
            if (name && pkg.version) {
                entries.push({
                    name,
                    version: pkg.version,
                    engines: pkg.engines,
                    path: filePath
                });
            }
        }
    }
    if (parsed.packages) {
        traversePackages(parsed.packages);
    }
    if (parsed.dependencies) {
        for (const [name, dep] of Object.entries(parsed.dependencies)) {
            const depAny = dep;
            if (depAny.version) {
                entries.push({
                    name,
                    version: depAny.version,
                    engines: depAny.engines,
                    path: filePath
                });
            }
        }
    }
    return { entries, anomalies };
}
async function parseYarnLock(filePath) {
    const entries = [];
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const packageBlocks = content.split(/\r?\n\r?\n/);
    for (const block of packageBlocks) {
        if (!block.trim() || block.startsWith('#'))
            continue;
        const lines = block.split('\n');
        const nameLine = lines[0];
        const nameMatch = nameLine.match(/^"?(.+?)@/);
        const versionMatch = block.match(/version\s+"?([^\s"]+)"?/);
        if (nameMatch && versionMatch) {
            entries.push({
                name: nameMatch[1],
                version: versionMatch[1],
                path: filePath
            });
        }
    }
    return { entries, anomalies };
}
async function parsePnpmLock(filePath) {
    const entries = [];
    const anomalies = [];
    try {
        const yaml = await import('js-yaml');
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = yaml.load(content);
        if (parsed.packages && typeof parsed.packages === 'object') {
            for (const [pkgKey, pkgValue] of Object.entries(parsed.packages)) {
                const name = pkgKey.replace(/^\/?/, '').split('@')[0];
                if (pkgValue?.version) {
                    entries.push({
                        name: name || 'unknown',
                        version: pkgValue.version,
                        engines: pkgValue.engines,
                        path: filePath
                    });
                }
            }
        }
    }
    catch {
        anomalies.push({
            id: `pnpm-lock-parse-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: 'lockfile-parse-error',
            location: { file: filePath },
            message: 'js-yaml import failed, skipping pnpm-lock.yaml parsing',
            cause: 'yaml parsing dependency issue'
        });
    }
    return { entries, anomalies };
}
//# sourceMappingURL=lockfile-scanner.js.map