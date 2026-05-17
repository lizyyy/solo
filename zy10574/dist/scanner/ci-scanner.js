import fs from 'fs/promises';
import path from 'path';
import { normalizeVersion } from '../utils/version-parser.js';
export async function scanCIConfigs(rootPath) {
    const configs = [];
    const anomalies = [];
    const ciPaths = [
        { path: path.join(rootPath, '.github', 'workflows'), type: 'github-actions' },
        { path: path.join(rootPath, '.gitlab-ci.yml'), type: 'gitlab-ci' },
        { path: path.join(rootPath, '.circleci', 'config.yml'), type: 'circleci' },
        { path: path.join(rootPath, 'Jenkinsfile'), type: 'jenkins' }
    ];
    for (const { path: ciPath, type } of ciPaths) {
        try {
            const stats = await fs.stat(ciPath);
            if (stats.isDirectory() && type === 'github-actions') {
                const files = await fs.readdir(ciPath);
                for (const file of files) {
                    if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                        const filePath = path.join(ciPath, file);
                        const result = await parseGitHubActions(filePath);
                        configs.push(result.config);
                        anomalies.push(...result.anomalies);
                    }
                }
            }
            else if (stats.isFile()) {
                if (type === 'gitlab-ci') {
                    const result = await parseGitLabCI(ciPath);
                    configs.push(result.config);
                    anomalies.push(...result.anomalies);
                }
                else if (type === 'circleci') {
                    const result = await parseCircleCI(ciPath);
                    configs.push(result.config);
                    anomalies.push(...result.anomalies);
                }
                else if (type === 'jenkins') {
                    const result = await parseJenkinsfile(ciPath);
                    configs.push(result.config);
                    anomalies.push(...result.anomalies);
                }
            }
        }
        catch {
            // CI config doesn't exist, skip
        }
    }
    return { configs, anomalies };
}
async function parseGitHubActions(filePath) {
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const nodeVersions = [];
    const nodeVersionPatterns = [
        /node-version:\s*['"]([\d.x]+)['"]/g,
        /node:\s*['"]([\d.x]+)['"]/g,
        /NODE_VERSION:\s*['"]([\d.x]+)['"]/g
    ];
    for (const pattern of nodeVersionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const version = normalizeVersion(match[1]);
            if (!nodeVersions.includes(version) && version && !version.includes('$')) {
                nodeVersions.push(version);
            }
        }
    }
    const matrixMatch = content.match(/node-version:\s*\[\s*([^\]]+)\s*\]/);
    if (matrixMatch) {
        const versions = matrixMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
        for (const v of versions) {
            if (v && !v.includes('$')) {
                const version = normalizeVersion(v);
                if (version && !nodeVersions.includes(version)) {
                    nodeVersions.push(version);
                }
            }
        }
    }
    return {
        config: {
            type: 'github-actions',
            path: filePath,
            nodeVersions,
            rawContent: content
        },
        anomalies
    };
}
async function parseGitLabCI(filePath) {
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const nodeVersions = [];
    const patterns = [
        /node:\s*['"]?([^\s'"]+)['"]?/g,
        /NODE_VERSION:\s*['"]?([^\s'"]+)['"]?/g,
        /image:\s*node:([^\s]+)/g
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const version = normalizeVersion(match[1]);
            if (!nodeVersions.includes(version)) {
                nodeVersions.push(version);
            }
        }
    }
    return {
        config: {
            type: 'gitlab-ci',
            path: filePath,
            nodeVersions,
            rawContent: content
        },
        anomalies
    };
}
async function parseCircleCI(filePath) {
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const nodeVersions = [];
    const patterns = [
        /node-version:\s*['"]?([^\s'"]+)['"]?/g,
        /NODE_VERSION:\s*['"]?([^\s'"]+)['"]?/g,
        /docker:\s*- image:\s*node:([^\s]+)/g
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const version = normalizeVersion(match[1]);
            if (!nodeVersions.includes(version)) {
                nodeVersions.push(version);
            }
        }
    }
    return {
        config: {
            type: 'circleci',
            path: filePath,
            nodeVersions,
            rawContent: content
        },
        anomalies
    };
}
async function parseJenkinsfile(filePath) {
    const anomalies = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const nodeVersions = [];
    const patterns = [
        /nodeVersion\s*=\s*['"]?([^\s'"]+)['"]?/g,
        /NODE_VERSION\s*=\s*['"]?([^\s'"]+)['"]?/g,
        /node:([^\s'"]+)/g
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const version = normalizeVersion(match[1]);
            if (!nodeVersions.includes(version)) {
                nodeVersions.push(version);
            }
        }
    }
    return {
        config: {
            type: 'jenkins',
            path: filePath,
            nodeVersions,
            rawContent: content
        },
        anomalies
    };
}
//# sourceMappingURL=ci-scanner.js.map