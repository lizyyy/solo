import fs from 'fs/promises';
import path from 'path';
import { parseVersionRange } from '../utils/version-parser.js';
export async function scanPackages(rootPath, options) {
    const packages = [];
    const anomalies = [];
    const visited = new Set();
    async function scanDirectory(currentPath, currentDepth) {
        if (currentDepth > options.depth || visited.has(currentPath))
            return;
        visited.add(currentPath);
        const packageJsonPath = path.join(currentPath, 'package.json');
        try {
            const stats = await fs.stat(packageJsonPath);
            if (stats.isFile()) {
                const result = await readPackageJson(packageJsonPath, currentPath === rootPath);
                packages.push(result.package);
                if (result.anomaly) {
                    anomalies.push(result.anomaly);
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                anomalies.push({
                    id: `read-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    type: 'file-read-error',
                    location: { file: packageJsonPath },
                    message: `Failed to read package.json: ${error.message}`,
                    cause: 'file system error'
                });
            }
        }
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
                    await scanDirectory(path.join(currentPath, entry.name), currentDepth + 1);
                }
            }
            const nodeModulesPath = path.join(currentPath, 'node_modules');
            try {
                const nodeModulesStats = await fs.stat(nodeModulesPath);
                if (nodeModulesStats.isDirectory()) {
                    await scanNodeModules(nodeModulesPath, currentDepth + 1);
                }
            }
            catch {
                // node_modules doesn't exist, skip
            }
        }
        catch (error) {
            anomalies.push({
                id: `scan-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                type: 'directory-scan-error',
                location: { file: currentPath },
                message: `Failed to scan directory: ${error.message}`,
                cause: 'file system error'
            });
        }
    }
    async function scanNodeModules(nodeModulesPath, currentDepth) {
        if (currentDepth > options.depth)
            return;
        try {
            const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue;
                const entryPath = path.join(nodeModulesPath, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('@')) {
                    const packageJsonPath = path.join(entryPath, 'package.json');
                    try {
                        const result = await readPackageJson(packageJsonPath, false);
                        packages.push(result.package);
                        if (result.anomaly) {
                            anomalies.push(result.anomaly);
                        }
                    }
                    catch {
                        // skip if package.json doesn't exist
                    }
                }
                else if (entry.isDirectory() && entry.name.startsWith('@')) {
                    const subEntries = await fs.readdir(entryPath, { withFileTypes: true });
                    for (const subEntry of subEntries) {
                        if (subEntry.isDirectory()) {
                            const packageJsonPath = path.join(entryPath, subEntry.name, 'package.json');
                            try {
                                const result = await readPackageJson(packageJsonPath, false);
                                packages.push(result.package);
                                if (result.anomaly) {
                                    anomalies.push(result.anomaly);
                                }
                            }
                            catch {
                                // skip
                            }
                        }
                    }
                }
            }
        }
        catch {
            // skip if node_modules can't be read
        }
    }
    await scanDirectory(rootPath, 0);
    return { packages, anomalies };
}
async function readPackageJson(filePath, isRoot) {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    let anomaly;
    if (parsed.engines?.node) {
        const parseResult = parseVersionRange(parsed.engines.node, {
            file: filePath,
            packageName: parsed.name || 'unknown'
        });
        anomaly = parseResult.anomaly;
    }
    return {
        package: {
            name: parsed.name || path.basename(path.dirname(filePath)),
            version: parsed.version || '0.0.0',
            engines: parsed.engines,
            path: filePath,
            isRoot,
            dependencies: parsed.dependencies,
            devDependencies: parsed.devDependencies
        },
        anomaly
    };
}
function shouldSkipDirectory(name) {
    const skipList = [
        'node_modules',
        '.git',
        '.github',
        'dist',
        'build',
        'coverage',
        '.next',
        '.nuxt',
        '.output'
    ];
    return skipList.includes(name) || name.startsWith('.');
}
//# sourceMappingURL=package-scanner.js.map